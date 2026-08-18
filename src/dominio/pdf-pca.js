/**
 * Importação de itens do PCA a partir de PDFs de "Pedido de Compras/Serviços"
 * (Sistema Centi) ou "DFD" (Documento de Formalização da Demanda).
 *
 * A leitura de texto linear de um PDF (usada no módulo de OF) embaralha o
 * conteúdo de tabelas com células que quebram linha — a ordem de leitura de
 * uma célula multi-linha entra no meio de outras colunas. Por isso, aqui a
 * extração usa a POSIÇÃO REAL (x, y) de cada palavra na página: agrupa por
 * coluna (posição horizontal) e por linha (posição vertical), reconstruindo
 * a tabela como uma grade, não como texto corrido.
 *
 * Cada item extraído tem o formato: { codigo, descricao, unidade, quantidade }
 * — o mesmo já usado pela importação de planilha (dominio/planilhas.js).
 */

import { mesclarItensRepetidos } from "./pca.js";

// ---------- Detecção do formato ----------
export function detectarFormatoPdfPca(texto) {
  if (/DOCUMENTO\s+DE\s+FORMALIZA[ÇC][ÃA]O\s+DA\s+DEMANDA/i.test(texto)) return "dfd";
  if (/PEDIDOS?\s+DE\s+COMPRAS\s*\/?\s*SERVI[ÇC]OS/i.test(texto)) return "pedido";
  return null;
}

// ---------- Utilidades de agrupamento espacial ----------

// Agrupa palavras em "linhas" por proximidade vertical (mesma posição Y,
// com uma tolerância), preservando a ordem de leitura (topo->baixo, depois
// esquerda->direita dentro da linha).
function agruparEmLinhas(palavras, tolerancia = 3) {
  const ordenadas = [...palavras].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const linhas = [];
  for (const p of ordenadas) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(ultima[0].y - p.y) < tolerancia) ultima.push(p);
    else linhas.push([p]);
  }
  return linhas.map(l => ({
    y: l[0].y,
    texto: [...l].sort((a, b) => a.x - b.x).map(p => p.texto).join(" "),
  }));
}

// A coluna de descrição é um texto corrido, sem nenhum separador visual entre um item e o
// próximo (mesma fonte, mesmo recuo, mesmo espaçamento de linha) — o único jeito de saber onde
// uma descrição acaba e a próxima começa é a posição da linha-âncora (código + unidade +
// quantidade) de cada item, e o meio geométrico entre duas âncoras é só um palpite. Na prática,
// esse palpite frequentemente cai NO MEIO de uma frase (ex.: ".. COR" | "PRÓPRIA E SEM
// MANCHAS .."), partindo a descrição ao meio e emendando o resto no item vizinho.
//
// Quando uma linha inteira termina em pontuação de fim de frase (. ! ? :), isso quase sempre
// significa que o parágrafo realmente terminou ali — do contrário o texto teria continuado
// preenchendo a mesma linha até a margem, em vez de pular pra próxima. Por isso, entre duas
// âncoras, preferimos cortar na linha com pontuação final mais próxima do meio geométrico, em
// vez de cortar cegamente na metade — cai no fim de uma frase, não no meio dela.
function pontoDeCorte(linhasDoIntervalo, meioGeometrico) {
  const comPontuacaoFinal = linhasDoIntervalo.filter(l => /[.!?:]$/.test(l.texto.trim()));
  if (comPontuacaoFinal.length === 0) return meioGeometrico;
  const maisProxima = comPontuacaoFinal.reduce((a, b) =>
    Math.abs(b.y - meioGeometrico) < Math.abs(a.y - meioGeometrico) ? b : a
  );
  return maisProxima.y + 0.01; // +epsilon: inclui a própria linha no item ANTERIOR ao corte
}

// Um ponto de corte por intervalo entre duas âncoras consecutivas (não por item) — vira o
// limite "depois" do item i e o limite "antes" do item i+1 ao mesmo tempo.
function cortesEntreAncoras(ancorasY, linhasDescricao) {
  return ancorasY.slice(0, -1).map((y, i) => {
    const proxima = ancorasY[i + 1];
    const doIntervalo = linhasDescricao.filter(l => l.y > y && l.y < proxima);
    return pontoDeCorte(doIntervalo, (y + proxima) / 2);
  });
}

function normalizarQuantidade(str) {
  if (!str) return "";
  const limpo = String(str).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  if (isNaN(n)) return String(str).trim();
  return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, "");
}

// ---------- Formato DFD ----------
// Tabela: ITEM | CÓDIGO | DESCRIÇÃO | UNIDADE | QUANTIDADE
// Cada linha "âncora" tem o número do item no início e termina em
// "unidade quantidade,dddd" — o miolo (entre eles) é parte da descrição ou
// um fragmento de código. Código pode vir inteiro ali, ou quebrado em duas
// partes: uma ANTES da âncora (fim da linha anterior) e outra DEPOIS
// (início da linha seguinte), quando tem mais dígitos do que cabe na coluna.
export function extrairItensDfd(palavrasPorPagina) {
  const todosItens = [];

  for (const palavras of palavrasPorPagina) {
    const header = palavras.find(p => p.texto === "ITEM");
    if (!header) continue;

    const rodape = palavras.find(p => /Centi|Assinatura/i.test(p.texto));
    const fimTop = rodape ? rodape.y : Infinity;
    // A seção seguinte ("5 - PREVISÃO DE ENTREGA...") usa o mesmo número de
    // um possível item 5 -- só conta como fim de tabela se estiver na
    // margem esquerda (título de seção), não dentro da coluna ITEM.
    const secaoSeguinte = palavras.find(p => p.texto === "5" && p.x < 45 && p.y > header.y + 50);
    const fimReal = Math.min(fimTop, secaoSeguinte ? secaoSeguinte.y : Infinity);

    const corpoBruto = palavras.filter(p => p.y > header.y + 2 && p.y < fimReal);

    // Linhas de parágrafo largo (texto de fechamento após a tabela) têm uma
    // palavra que começa bem à esquerda, fora de qualquer coluna da
    // tabela -- descarta a linha inteira quando isso acontece.
    const ysParagrafo = new Set(
      corpoBruto.filter(p => p.x < 50).map(p => Math.round(p.y * 10) / 10)
    );
    const corpo = corpoBruto.filter(p => !ysParagrafo.has(Math.round(p.y * 10) / 10));

    const linhas = agruparEmLinhas(corpo);
    const anchorRegex = /^(\d{1,3})\s+(?:(.*?)\s+)?(\S+)\s+(\d+,\d{4})\s*$/;
    const ancoras = [];
    for (const l of linhas) {
      const m = l.texto.match(anchorRegex);
      if (m) ancoras.push({ y: l.y, itemNum: m[1], meio: m[2] || "", unidade: m[3], quantidade: m[4] });
    }
    if (ancoras.length === 0) continue;

    // Limite entre a coluna estreita (item-num + fragmentos de código) e a
    // coluna larga de descrição. Precisa ser um limite justo — largo
    // demais deixa a primeira palavra da descrição vazar pra dentro do
    // fragmento de código, quebrando a checagem de "só dígitos".
    const limiteColunaEstreita = 118;
    const linhasEsquerda = agruparEmLinhas(corpo.filter(p => p.x < limiteColunaEstreita));
    const linhasDescricaoTodas = agruparEmLinhas(corpo.filter(p => p.x >= limiteColunaEstreita));

    // Cortes sensíveis a fim de frase — só pra coluna de descrição (ver pontoDeCorte acima). Os
    // fragmentos de código continuam usando o meio geométrico puro: são só dígitos, sem frase
    // pra respeitar, e usar o mesmo corte da descrição arriscaria cortar o número ao meio.
    const ancorasY = ancoras.map(a => a.y);
    const cortesDescricao = cortesEntreAncoras(ancorasY, linhasDescricaoTodas);

    for (let i = 0; i < ancoras.length; i++) {
      const a = ancoras[i];
      const limiteAntes = i > 0 ? (ancoras[i - 1].y + a.y) / 2 : -Infinity;
      const limiteDepois = i + 1 < ancoras.length ? (a.y + ancoras[i + 1].y) / 2 : fimReal;
      const limiteAntesDesc = i > 0 ? cortesDescricao[i - 1] : -Infinity;
      const limiteDepoisDesc = i < cortesDescricao.length ? cortesDescricao[i] : fimReal;

      // Fragmentos de código: linhas puramente numéricas na faixa
      // esquerda, dentro da janela deste item, que não sejam o próprio
      // número do item.
      const fragmentosCodigo = linhasEsquerda
        .filter(l => l.y > limiteAntes && l.y < limiteDepois && l.y !== a.y)
        .map(l => l.texto.trim())
        .filter(t => /^\d{1,12}$/.test(t));

      let codigoInline = "";
      let meioLimpo = a.meio;
      const mInline = a.meio.match(/^(\d{4,12})\s+(.*)$/);
      if (mInline) { codigoInline = mInline[1]; meioLimpo = mInline[2]; }
      else if (/^\d{4,12}$/.test(a.meio.trim())) { codigoInline = a.meio.trim(); meioLimpo = ""; }

      const codigo = fragmentosCodigo.join("") + codigoInline;

      // Descrição: respeita a ordem vertical real — texto antes da âncora,
      // o miolo da própria linha-âncora, e o texto depois, dentro da
      // janela deste item.
      const partesOrdenadas = [
        ...linhasDescricaoTodas.filter(l => l.y > limiteAntesDesc && l.y < a.y).map(l => l.texto),
        ...(meioLimpo ? [meioLimpo] : []),
        ...linhasDescricaoTodas.filter(l => l.y > a.y && l.y < limiteDepoisDesc).map(l => l.texto),
      ];

      todosItens.push({
        idProduto: codigo,
        descricao: partesOrdenadas.join(" ").replace(/\s+/g, " ").trim(),
        unidade: a.unidade,
        quantidade: normalizarQuantidade(a.quantidade),
      });
    }
  }

  return todosItens;
}

// ---------- Formato Pedido (Centi) ----------
// Tabela: Código | Descrição | Un.medida | Situação | Valor Referência |
// Quantidade | Realizada | Valor Total. O código nunca quebra em duas
// linhas aqui (cabe na coluna), e a linha com os valores numéricos fica
// isolada da descrição (que ocupa muitas linhas ao redor, acima e abaixo).
export function extrairItensPedido(palavrasPorPagina) {
  const todosItens = [];

  for (const palavras of palavrasPorPagina) {
    const hCodigo = palavras.find(p => p.texto === "Código");
    const hDescricao = palavras.find(p => p.texto === "Descrição");
    // "Un.medida" pode chegar como um token só, ou quebrado em "Un." + "medida"
    // (varia conforme como o PDF original agrupa o texto).
    const hUnidade = palavras.find(p => p.texto === "Un.medida" || p.texto === "Un.");
    if (!hCodigo || !hDescricao || !hUnidade) continue;

    const limiteDescInicio = (hCodigo.x + 30);
    const limiteDescFim = hUnidade.x - 10;

    const rodape = palavras.find(p => /Centi|Assinatura/i.test(p.texto));
    const fimReal = rodape ? rodape.y : Infinity;
    const corpo = palavras.filter(p => p.y > hCodigo.y + 3 && p.y < fimReal);

    const linhasCodigo = agruparEmLinhas(corpo.filter(p => p.x < limiteDescInicio && /^\d{4,12}$/.test(p.texto)));
    const todasLinhasNaFaixaDesc = agruparEmLinhas(corpo.filter(p => p.x >= limiteDescInicio && p.x < limiteDescFim));
    const cortes = cortesEntreAncoras(linhasCodigo.map(l => l.y), todasLinhasNaFaixaDesc);

    for (let i = 0; i < linhasCodigo.length; i++) {
      const lc = linhasCodigo[i];
      const limiteAntes = i > 0 ? cortes[i - 1] : -Infinity;
      const limiteDepois = i < cortes.length ? cortes[i] : fimReal;

      const descricao = todasLinhasNaFaixaDesc
        .filter(l => l.y > limiteAntes && l.y < limiteDepois)
        .map(l => l.texto).join(" ").replace(/\s+/g, " ").trim();

      // Na mesma linha Y do código: unidade + quantidade (2º número no
      // formato decimal, entre "Valor Referência" e "Realizada").
      const naLinha = corpo.filter(p => Math.abs(p.y - lc.y) < 3);
      const numeros = naLinha.filter(p => /^[\d.]+,\d{4}$/.test(p.texto)).sort((a, b) => a.x - b.x);
      const unidade = naLinha.find(p => /^[A-ZÇÃÕÁÉÍÓÚa-z]+$/.test(p.texto) && p.x < limiteDescInicio + 50)?.texto || "";
      const quantidade = numeros.length >= 2 ? numeros[1].texto : "";

      todosItens.push({
        idProduto: lc.texto.trim(),
        descricao,
        unidade: unidade || "UNIDADE",
        quantidade: normalizarQuantidade(quantidade),
      });
    }
  }

  return todosItens;
}

// ---------- Combinação de múltiplos arquivos ----------
// Junta os itens de vários arquivos (Pedidos ou DFDs) num único conjunto, ordenado por código
// do produto — ou, quando não há código, pela ordem de chegada (arquivo, depois posição no
// arquivo). Quando o mesmo item aparece mais de uma vez (mesmo código repetido em Pedidos
// diferentes, entregas parceladas do mesmo Pedido, etc.), mescla numa linha só com as
// quantidades somadas — ver mesclarItensRepetidos() — em vez de duplicar a linha.
export function combinarItensDeMultiplosArquivos(resultadosPorArquivo) {
  const todos = [];
  resultadosPorArquivo.forEach((r, idxArquivo) => {
    r.itens.forEach((item, idxItem) => {
      todos.push({ ...item, _ordem: idxArquivo * 10000 + idxItem });
    });
  });
  todos.sort((a, b) => {
    if (a.idProduto && b.idProduto) return a.idProduto.localeCompare(b.idProduto, "pt-BR", { numeric: true });
    if (a.idProduto) return -1;
    if (b.idProduto) return 1;
    return a._ordem - b._ordem;
  });
  const semOrdem = todos.map(({ _ordem, ...item }) => item);
  return mesclarItensRepetidos(semOrdem).map(item => ({ ...item, id: "it_" + Math.random().toString(36).slice(2, 8) }));
}
