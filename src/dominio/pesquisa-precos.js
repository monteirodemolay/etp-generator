/**
 * Pesquisa de Preços — módulo próprio, com identidade de documento (como
 * ETP, Justificativa e Declaração já têm), pensado para futuramente poder
 * ser puxado para dentro de um ETP como base do Levantamento de Preços.
 *
 * A lógica de estatística por item (média/mediana, valores fora da faixa)
 * já existia dentro do próprio ETP — está reaproveitada aqui, desacoplada
 * do objeto de ETP, para poder servir os dois lugares.
 */

// ---------- Fontes de pesquisa, na ordem de preferência da IN SEGES/ME
// nº 65/2021, art. 5º — a norma mais usada como referência por municípios
// que não têm regulamento próprio. A ordem importa: as primeiras são
// preferenciais; pesquisa direta com fornecedores (a última) precisa de
// no mínimo 3 cotações válidas e, preferencialmente, não deve ser a única
// fonte usada.
export const FONTES_PESQUISA_PRECOS = [
  { id: "painel-precos", ordem: 1, rotulo: "Painel de Preços (ou banco de preços em vigor)",
    ajuda: "Fonte preferencial — painel oficial de preços praticados pela Administração Pública." },
  { id: "contratacoes-similares", ordem: 2, rotulo: "Contratações públicas similares",
    ajuda: "Contratos de outros entes públicos, em execução ou concluídos nos últimos 180 dias." },
  { id: "midia-especializada", ordem: 3, rotulo: "Mídia especializada / sítios eletrônicos",
    ajuda: "Sítios especializados, comerciais ou de domínio amplo — exige registrar data e hora do acesso." },
  { id: "fornecedores", ordem: 4, rotulo: "Pesquisa direta com fornecedores",
    ajuda: "Mínimo de 3 cotações válidas; propostas não devem se diferenciar em mais de 180 dias entre si." },
  { id: "banco-dados-publico", ordem: 5, rotulo: "Banco de dados públicos / orçamento sintético",
    ajuda: "Ex.: SINAPI, tabelas de referência oficiais." },
];

export function rotuloFonte(id) {
  return FONTES_PESQUISA_PRECOS.find(f => f.id === id)?.rotulo || id;
}

// ---------- Modelo do documento ----------
export function emptyPesquisaPrecos(dadosIniciais = {}) {
  return {
    id: "pesq_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    numeroProcesso: dadosIniciais.numeroProcesso || "",
    objeto: dadosIniciais.objeto || "",
    orgao: dadosIniciais.orgao || "",
    responsavelNome: dadosIniciais.responsavelNome || "",
    responsavelCargo: dadosIniciais.responsavelCargo || "",
    dataElaboracao: dadosIniciais.dataElaboracao || "",
    secretariaId: dadosIniciais.secretariaId || null,
    municipioId: dadosIniciais.municipioId || null,
    itens: dadosIniciais.itens || [], // { id, codigo, descricao, unidade, quantidade }
    cotacoes: dadosIniciais.cotacoes || {}, // { itemId: [{ id, fonteId, origem, valor, dataAcesso, excluida, justificativaExclusao }] }
    metodologia: dadosIniciais.metodologia || "mediana", // "media" | "mediana" | "menor-valor"
    justificativaMetodologia: dadosIniciais.justificativaMetodologia || "",
    margemExclusao: dadosIniciais.margemExclusao ?? 25,
    valoresAdotados: dadosIniciais.valoresAdotados || {}, // { itemId: valor }
    status: dadosIniciais.status || "rascunho", // "rascunho" | "concluida"
    createdAt: dadosIniciais.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------- Estatísticas por item ----------
// Só considera as cotações NÃO excluídas — uma cotação excluída (valor
// inexequível ou excessivo) fica registrada, com a justificativa, mas não
// entra no cálculo.
export function calcularEstatisticasCotacoes(cotacoesDoItem) {
  const validas = (cotacoesDoItem || []).filter(c => !c.excluida && Number(c.valor) > 0);
  const valores = validas.map(c => Number(c.valor)).sort((a, b) => a - b);
  const n = valores.length;
  if (n === 0) return { n: 0, media: 0, mediana: 0, min: 0, max: 0 };

  const media = valores.reduce((s, v) => s + v, 0) / n;
  const mediana = n % 2 === 1
    ? valores[(n - 1) / 2]
    : (valores[n / 2 - 1] + valores[n / 2]) / 2;

  return { n, media, mediana, min: valores[0], max: valores[n - 1] };
}

export function valorPelaMetodologia(stats, metodologia) {
  if (!stats || stats.n === 0) return 0;
  if (metodologia === "media") return stats.media;
  if (metodologia === "menor-valor") return stats.min;
  return stats.mediana; // padrão: mediana
}

// Um valor é considerado fora da faixa quando se afasta da mediana em mais
// que a margem (%) definida — sinaliza pra revisão, nunca exclui sozinho:
// a exclusão de fato é sempre uma escolha registrada por quem elabora.
export function foraDoPadrao(valor, mediana, margemPct) {
  const v = Number(valor);
  if (!v || !mediana) return false;
  return Math.abs(v - mediana) / mediana > margemPct / 100;
}

// Total geral da pesquisa: soma de quantidade × valor adotado, por item.
export function totalGeralPesquisa(pesquisa) {
  return (pesquisa.itens || []).reduce((soma, item) => {
    const valor = Number(pesquisa.valoresAdotados?.[item.id]) || 0;
    const quantidade = Number(item.quantidade) || 0;
    return soma + valor * quantidade;
  }, 0);
}

// Quantos itens ainda não têm cotação nenhuma registrada — usado pra avisar
// antes de considerar a pesquisa concluída.
export function itensSemCotacao(pesquisa) {
  return (pesquisa.itens || []).filter(item => {
    const stats = calcularEstatisticasCotacoes(pesquisa.cotacoes?.[item.id]);
    return stats.n === 0;
  });
}

// ---------- Importação de itens: Excel, PDF ou Word ----------
// As três formas convergem para o mesmo parser de tabela genérica —
// reconhece variações de nome de coluna (Descrição/Item/Produto,
// Unidade/Un/UN, Quantidade/Qtd, Código/Cód), em vez de exigir um layout
// fixo como as planilhas do Sistema Centi.

function normalizarCabecalho(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // tira acento
    .toLowerCase().trim();
}

const SINONIMOS_COLUNA = {
  codigo: ["codigo", "cod", "catmat", "referencia", "ref"],
  descricao: ["descricao", "item", "produto", "especificacao", "discriminacao", "objeto"],
  unidade: ["unidade", "un", "und", "um"],
  quantidade: ["quantidade", "qtd", "qtde", "quant"],
};

function localizarColunas(linhaCabecalho) {
  const colunas = {};
  linhaCabecalho.forEach((celula, idx) => {
    const norm = normalizarCabecalho(celula);
    if (!norm) return;
    // Divide em palavras — pega "descrição" dentro de "Descrição do Produto",
    // mas não deixa "Valor Unitário" ser confundido com "Unidade" (que usa o
    // sinônimo curto "un"): só bate se alguma palavra INTEIRA do cabeçalho
    // corresponder a um sinônimo, não uma parte de palavra qualquer.
    const palavras = norm.split(/[^a-z0-9]+/).filter(Boolean);
    for (const [campo, sinonimos] of Object.entries(SINONIMOS_COLUNA)) {
      if (colunas[campo] !== undefined) continue;
      if (sinonimos.includes(norm) || sinonimos.some(s => palavras.includes(s))) colunas[campo] = idx;
    }
  });
  return colunas;
}

// linhas: array de arrays (célula por célula) — o mesmo formato que
// XLSX.utils.sheet_to_json({ header: 1 }) devolve, e que também é fácil de
// montar a partir de uma tabela HTML (Word) ou de texto de PDF já
// tabulado. Acha a linha de cabeçalho sozinho, testando linha por linha até
// reconhecer pelo menos "descrição" e ("unidade" ou "quantidade").
export function parseItensTabela(linhas) {
  let indiceCabecalho = -1;
  let colunas = {};
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const candidatas = localizarColunas(linhas[i] || []);
    if (candidatas.descricao !== undefined && (candidatas.unidade !== undefined || candidatas.quantidade !== undefined)) {
      indiceCabecalho = i;
      colunas = candidatas;
      break;
    }
  }
  if (indiceCabecalho === -1) return [];

  const itens = [];
  for (let i = indiceCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i] || [];
    const descricao = colunas.descricao !== undefined ? String(linha[colunas.descricao] ?? "").trim() : "";
    if (!descricao) continue; // linha em branco, ou fora da tabela (rodapé etc.)
    itens.push({
      id: "item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      codigo: colunas.codigo !== undefined ? String(linha[colunas.codigo] ?? "").trim() : "",
      descricao,
      unidade: colunas.unidade !== undefined ? (String(linha[colunas.unidade] ?? "").trim() || "UNIDADE") : "UNIDADE",
      quantidade: colunas.quantidade !== undefined ? String(linha[colunas.quantidade] ?? "1").trim() || "1" : "1",
    });
  }
  return itens;
}
