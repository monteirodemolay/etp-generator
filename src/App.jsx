import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import * as XLSX from "xlsx";
import { FileText, Plus, Trash2, Printer, Copy, ArrowLeft, Check, AlertCircle, AlertTriangle, ClipboardList, Search, Building2, Loader2, Info, Upload, Download, Table2 as TableIcon, FileEdit, X, ListX, ListChecks, ChevronRight, Users, Bell, Scale } from "lucide-react";
import storage from "./storage";
import { carregarTimbrePadrao } from "./timbre-padrao";

// ---------- Design tokens ----------
const C = {
  navy: "#1C2E4A",
  navyDark: "#122032",
  paper: "#FAF7F0",
  paperDark: "#F1ECDF",
  brass: "#A6832E",
  brassLight: "#C9A94F",
  ink: "#2A2A28",
  inkMuted: "#6B675E",
  border: "#DAD3C2",
  red: "#A6403D",
  green: "#4C7C59",
};

const TIPOS_OBJETO = ["Bens", "Serviços comuns", "Serviços de TI", "Obras e serviços de engenharia"];


const SECOES = [
  { id: "I", titulo: "Descrição da Necessidade", obrig: true,
    ajuda: "Qual problema, sob a perspectiva do interesse público, esta contratação pretende resolver?" },
  { id: "II", titulo: "Alinhamento ao PCA", obrig: false,
    ajuda: "Esta contratação está prevista no Plano de Contratações Anual? Indique item/posição, se houver." },
  { id: "III", titulo: "Requisitos da Contratação", obrig: false,
    ajuda: "Requisitos técnicos, de sustentabilidade, prazos, garantias e demais condições necessárias." },
  { id: "IV", titulo: "Levantamento de Mercado", obrig: true,
    ajuda: "Quais soluções foram pesquisadas (fornecedores, atas, painel de preços)? Justifique a escolha da solução e da forma de contratação." },
  { id: "V", titulo: "Estimativa das Quantidades", obrig: false,
    ajuda: "Quantidades estimadas, com memória de cálculo e histórico de consumo, se aplicável." },
  { id: "VI", titulo: "Estimativa do Valor", obrig: true,
    ajuda: "Valor estimado, com preços unitários referenciais e fontes de pesquisa de preços utilizadas." },
  { id: "VII", titulo: "Descrição da Solução como um Todo", obrig: false,
    ajuda: "Descreva a solução de forma integral, incluindo exigências de manutenção e assistência, se houver." },
  { id: "VIII", titulo: "Justificativa do Parcelamento", obrig: true,
    ajuda: "Por que a contratação será (ou não) dividida em itens/lotes? Considere economia de escala e competitividade." },
  { id: "IX", titulo: "Resultados Pretendidos", obrig: false,
    ajuda: "Quais benefícios diretos e indiretos a Administração espera obter com esta contratação?" },
  { id: "X", titulo: "Providências Prévias", obrig: false,
    ajuda: "O que precisa estar pronto antes da celebração do contrato (adequação de espaço, capacitação, etc.)?" },
  { id: "XI", titulo: "Contratações Correlatas/Interdependentes", obrig: false,
    ajuda: "Há outras contratações relacionadas ou das quais esta depende para ser executada?" },
  { id: "XII", titulo: "Possíveis Impactos Ambientais", obrig: false,
    ajuda: "Há impactos ambientais relevantes? Quais medidas de mitigação ou boas práticas serão adotadas?" },
  { id: "XIII", titulo: "Posicionamento Conclusivo", obrig: true,
    ajuda: "Declaração final: a contratação é técnica e economicamente viável? Fundamente a conclusão." },
];

const REQUIRED_IDS = SECOES.filter(s => s.obrig).map(s => s.id);

// Algarismos romanos usados para renumerar a sequência dos incisos no relatório final,
// quando algum inciso vazio é suprimido (mantém a sequência sem "buracos").
const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII"];

// Lista, na ordem, só os incisos preenchidos, já com o número romano de exibição recalculado.
// s.id continua sendo o identificador original (usado para lógica interna, como o quadro do PCA);
// numero é o algarismo que efetivamente aparece no relatório.
function secoesParaRelatorio(etp) {
  const excluidos = etp.incisosExcluidos || [];
  return SECOES
    .filter(s => !excluidos.includes(s.id) && etp.sections[s.id]?.trim())
    .map((s, idx) => ({ ...s, numero: ROMANOS[idx] || String(idx + 1) }));
}

// Numeração que cada inciso terá no documento final, para mostrar na tela de edição.
// Devolve { [id]: "III" } apenas para os que entram no documento.
function numeracaoFinal(etp) {
  const excluidos = etp.incisosExcluidos || [];
  const mapa = {};
  let pos = 0;
  SECOES.forEach(s => {
    if (excluidos.includes(s.id) || !etp.sections[s.id]?.trim()) return;
    mapa[s.id] = ROMANOS[pos] || String(pos + 1);
    pos++;
  });
  return mapa;
}

// Incisos V e VI usam editor com formatação (negrito, listas, tabelas) em vez de texto simples,
// pois costumam incluir tabelas de quantitativos e valores.

function emptyEtp() {
  const sections = {};
  SECOES.forEach(s => (sections[s.id] = ""));
  return {
    id: "etp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    meta: {
      titulo: "", orgao: "", setor: "", responsavel: "", cargo: "", processo: "", tipo: TIPOS_OBJETO[0], local: "",
      responsaveis: [], // [{id, nome, cargo}] — múltiplos responsáveis técnicos; responsavel/cargo acima ficam como fallback de ETPs antigos
      introducao: "", fonteRecurso: "", data: todayISO(),
      // Campos estruturados — alimentam automaticamente os modelos padrão dos incisos III, VI, VII, VIII, XI e XII
      parcelamento: "", // "" | "nao" | "sim"
      correlataExiste: false, correlataDescricao: "",
      manutencaoContinuada: false,
      prazoGarantiaDias: "", prazoEntregaDias: "",
      prazoGarantiaUnidade: "meses", // "dias" | "meses" | "anos"
      prazoEntregaUnidade: "dias", // "dias" | "meses" | "anos"
      metodologiaCalculo: "mediana", // "mediana" | "media"
      impactoAmbientalRelevante: false, impactoAmbientalDescricao: "",
      metodologiaQuantidades: "", // "" | "historico" | "beneficiarios" | "parametro" | "substituicao" | "comparacao" | "outro"
      detalhamentoQuantidades: "",
    },
    itens: [],
    cotacoes: {}, // { [itemId]: [{id, fonte, valor}] }
    valoresAdotados: {}, // { [itemId]: "12.34" } — valor unitário adotado após o levantamento de preços
    pca: null, // { nomeArquivo, importedAt, linhas: [...] } — última planilha do PCA importada
    solucoesMercado: [], // [{id, nome, selecionada}] — soluções de mercado pesquisadas para o inciso IV
    incisosExcluidos: [], // ids dos incisos que o servidor optou por não incluir neste ETP
    manuaisPca: {}, // { itemId: { codigo, sequencial } } — previsão informada à mão, quando o cruzamento automático não acha
    sections,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Secretaria — unidade organizacional que agrupa os documentos (chave "sec:<id>").
// Cada uma pode ter timbre próprio; sem timbre, cai no timbre geral do app.
// Tipos de entidade que podem contratar — nem toda unidade é uma secretaria
const TIPOS_ENTIDADE = [
  "Secretaria", "Fundo", "Autarquia", "Fundação",
  "Empresa Pública", "Consórcio Público", "Outro",
];

function emptySecretaria(nome, sigla, tipo) {
  return {
    id: "sec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    nome: nome || "",
    sigla: sigla || "",
    tipoEntidade: tipo || "Secretaria",
    tipoTimbre: "imagem", // "imagem" | "texto" | "nenhum"
    timbre: null,         // imagem, quando tipoTimbre = "imagem"
    timbreHtml: "",       // texto formatado, quando tipoTimbre = "texto"
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------- Usuários e permissões ----------
// As SENHAS não ficam aqui: elas vivem no Firebase Authentication. Este cadastro guarda
// apenas quem é a pessoa, qual o papel e a quais entidades ela tem acesso.
const PAPEIS = {
  admin: {
    rotulo: "Administrador",
    descricao: "Gerencia entidades, usuários e permissões, além de criar e excluir documentos.",
  },
  padrao: {
    rotulo: "Usuário padrão",
    descricao: "Cria e edita documentos das entidades que lhe forem atribuídas.",
  },
};

// O que cada papel pode fazer. Serve para a interface esconder o que não cabe;
// a barreira de verdade continua sendo as Regras de Segurança do Firestore.
const PERMISSOES = {
  admin: {
    gerenciarUsuarios: true, gerenciarEntidades: true,
    criarDocumentos: true, editarDocumentos: true,
    excluirDocumentos: true, esvaziarLixeira: true,
  },
  padrao: {
    gerenciarUsuarios: false, gerenciarEntidades: false,
    criarDocumentos: true, editarDocumentos: true,
    excluirDocumentos: true, esvaziarLixeira: false,
  },
};

function emptyUsuario(email) {
  return {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    email: (email || "").trim().toLowerCase(),
    nomeCompleto: "",
    cargo: "",
    papel: "padrao",
    entidades: [],          // ids das entidades a que tem acesso
    entidadePrincipal: "",  // qual delas abre por padrão
    ativo: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Encontra o cadastro do e-mail que está logado
function usuarioPorEmail(usuarios, email) {
  const alvo = String(email || "").trim().toLowerCase();
  if (!alvo) return null;
  return usuarios.find(u => u.email === alvo) || null;
}

// Permissões de quem está usando. Sem cadastro correspondente, trata como administrador:
// só chega aqui quem já passou pelas Regras do Firestore, e isso evita travar o primeiro
// acesso, quando ainda não há nenhum usuário cadastrado.
function permissoesDe(usuario) {
  if (!usuario) return { ...PERMISSOES.admin, papel: "admin", semCadastro: true };
  if (!usuario.ativo) return { gerenciarUsuarios: false, gerenciarEntidades: false,
    criarDocumentos: false, editarDocumentos: false, excluirDocumentos: false,
    esvaziarLixeira: false, papel: usuario.papel, inativo: true };
  return { ...PERMISSOES[usuario.papel || "padrao"], papel: usuario.papel || "padrao" };
}

// Entidades que a pessoa enxerga. Administrador vê todas; sem cadastro, também.
function entidadesVisiveis(usuario, secretarias) {
  if (!usuario || usuario.papel === "admin") return secretarias;
  const permitidas = usuario.entidades || [];
  const filtradas = secretarias.filter(s => permitidas.includes(s.id));
  return filtradas.length > 0 ? filtradas : secretarias;
}

// Rótulo curto para a lista: "SEMAS e +2"
function resumoEntidades(usuario, secretarias) {
  if (!usuario) return "—";
  if (usuario.papel === "admin") return "Todas as entidades";
  const ids = usuario.entidades || [];
  if (ids.length === 0) return "Nenhuma entidade atribuída";

  const principalId = usuario.entidadePrincipal && ids.includes(usuario.entidadePrincipal)
    ? usuario.entidadePrincipal : ids[0];
  const principal = secretarias.find(s => s.id === principalId);
  const nome = principal?.sigla || principal?.nome || "Entidade";
  const extras = ids.length - 1;
  return extras > 0 ? `${nome} e +${extras}` : nome;
}

// Secretaria a que um documento pertence. Documentos criados antes do cadastro de secretarias
// não têm o campo — nesse caso pertencem à primeira secretaria (a padrão), sem precisar
// reescrever nada no armazenamento.
function secretariaDoDoc(doc, secretarias) {
  if (!secretarias?.length) return null;
  return secretarias.find(s => s.id === doc.secretariaId) || secretarias[0];
}

// Timbre a usar num documento: o da secretaria dele, se tiver um próprio;
// senão, o timbre geral do app.
// Cabeçalho a usar num documento, conforme a configuração da secretaria dele.
// Três possibilidades: imagem, texto em HTML, ou nenhum cabeçalho.
// Secretarias antigas (sem o campo tipoTimbre) seguem a regra anterior: imagem própria,
// senão o timbre geral do app.
function resolverCabecalho(doc, secretarias, timbreGlobal) {
  const sec = secretariaDoDoc(doc, secretarias);
  const tipo = sec?.tipoTimbre;

  if (tipo === "nenhum") return { tipo: "nenhum" };
  if (tipo === "texto") return { tipo: "texto", html: sec.timbreHtml || "" };
  if (tipo === "imagem") return { tipo: "imagem", dataUrl: sec.timbre || timbreGlobal || null };
  return { tipo: "imagem", dataUrl: sec?.timbre || timbreGlobal || null };
}

// Busca o timbre geral salvo pelo usuário; se não houver, carrega o timbre padrão do app,
// que agora é um asset separado (baixado sob demanda) em vez de base64 embutido no bundle.
async function obterTimbreGlobal({ persistirPadrao = false } = {}) {
  try {
    const r = await storage.get("timbre:padrao", false);
    if (r?.value) return r.value;
  } catch { /* nenhum timbre salvo ainda — segue para o padrão */ }
  const padrao = await carregarTimbrePadrao();
  if (persistirPadrao) storage.set("timbre:padrao", padrao, false).catch(() => {});
  return padrao;
}

// Completa o cabeçalho com as dimensões da imagem, prontas para o .docx
async function prepararCabecalho(cabecalho) {
  if (cabecalho?.tipo !== "imagem" || !cabecalho.dataUrl) return cabecalho;
  const tamanho = dimensionarTimbre(await medirImagem(cabecalho.dataUrl));
  return { ...cabecalho, tamanho };
}

// ---------- Dimensionamento do timbre ----------
// A4 em pontos: 210mm x 297mm. Largura útil = página menos as margens laterais.
const PAGINA = { largura: 595.3, altura: 841.9, margemLateral: 72, margemCabecalho: 35.4 };
const LARGURA_UTIL = PAGINA.largura - PAGINA.margemLateral * 2;
const ALTURA_MAX_TIMBRE = 80;

// Lê as dimensões naturais da imagem (o timbre é um data URL já carregado na memória)
function medirImagem(dataUrl) {
  return new Promise(resolve => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ largura: img.naturalWidth, altura: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Converte de pixels para pontos e reduz proporcionalmente até caber na largura útil da página
// e na altura máxima do cabeçalho. Imagens menores que o limite não são ampliadas.
function dimensionarTimbre(medida) {
  if (!medida?.largura || !medida?.altura) return null;
  const larguraPt = medida.largura * 0.75; // 96 dpi -> 72 pontos por polegada
  const alturaPt = medida.altura * 0.75;
  const escala = Math.min(LARGURA_UTIL / larguraPt, ALTURA_MAX_TIMBRE / alturaPt, 1);
  return {
    largura: Math.round(larguraPt * escala * 10) / 10,
    altura: Math.round(alturaPt * escala * 10) / 10,
  };
}

// ============================================================================
// Geração de arquivos .docx nativos do Word
// ----------------------------------------------------------------------------
// Um .docx é um pacote ZIP com arquivos XML dentro. Gerar o formato real, em vez
// de HTML renomeado para .doc, evita a recusa do Word ("arquivo corrompido") e
// permite cabeçalho nativo, que se repete em todas as páginas.
// ============================================================================

// ---------- Compactador ZIP (método "armazenado", sem compressão) ----------
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function textoParaBytes(txt) {
  return new TextEncoder().encode(txt);
}

// Monta o pacote ZIP. Recebe [{ nome, dados: Uint8Array }] e devolve Uint8Array.
function criarZip(arquivos) {
  const pedacos = [];
  const central = [];
  let deslocamento = 0;

  const num16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
  const num32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  arquivos.forEach(arq => {
    const nome = textoParaBytes(arq.nome);
    const dados = arq.dados;
    const crc = crc32(dados);

    const cabecalhoLocal = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04,       // assinatura
      20, 0, 0, 0, 0, 0,            // versão, flags, método (0 = armazenado)
      0, 0, 0, 0,                   // data/hora
      ...num32(crc), ...num32(dados.length), ...num32(dados.length),
      ...num16(nome.length), 0, 0,
      ...nome,
    ]);
    pedacos.push(cabecalhoLocal, dados);

    central.push(new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,
      20, 0, 20, 0, 0, 0, 0, 0,
      0, 0, 0, 0,
      ...num32(crc), ...num32(dados.length), ...num32(dados.length),
      ...num16(nome.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...num32(deslocamento),
      ...nome,
    ]));

    deslocamento += cabecalhoLocal.length + dados.length;
  });

  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0,
    ...num16(arquivos.length), ...num16(arquivos.length),
    ...num32(tamanhoCentral), ...num32(deslocamento), 0, 0,
  ]);

  const total = [...pedacos, ...central, fim];
  const tamanho = total.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(tamanho);
  let pos = 0;
  total.forEach(p => { saida.set(p, pos); pos += p.length; });
  return saida;
}

// ---------- Conversão do conteúdo em HTML para o formato interno do Word ----------
const PT_PARA_EMU = 12700;   // 1 ponto = 12700 EMU
const PT_PARA_TWIP = 20;     // 1 ponto = 20 twips

function escXml(txt) {
  return String(txt ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Converte um trecho de texto com a formatação acumulada (negrito, itálico etc.)
function trecho(texto, fmt) {
  if (!texto) return "";
  const props = [
    fmt.b ? "<w:b/>" : "",
    fmt.i ? "<w:i/>" : "",
    fmt.u ? '<w:u w:val="single"/>' : "",
    fmt.s ? "<w:strike/>" : "",
    `<w:sz w:val="${fmt.sz || 22}"/>`,
  ].join("");
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${escXml(texto)}</w:t></w:r>`;
}

// Percorre os nós de um bloco reunindo o texto já formatado
function trechosDoNo(no, fmt, doc) {
  const TEXTO = 3, ELEMENTO = 1;
  if (no.nodeType === TEXTO) {
    const t = no.nodeValue.replace(/\s+/g, " ");
    return t.trim() === "" && t !== " " ? "" : trecho(t, fmt);
  }
  if (no.nodeType !== ELEMENTO) return "";

  const tag = no.tagName.toLowerCase();
  if (tag === "br") return '<w:r><w:br/></w:r>';

  const novo = { ...fmt };
  if (tag === "b" || tag === "strong") novo.b = true;
  if (tag === "i" || tag === "em") novo.i = true;
  if (tag === "u") novo.u = true;
  if (tag === "s" || tag === "strike" || tag === "del") novo.s = true;

  let saida = "";
  no.childNodes.forEach(f => { saida += trechosDoNo(f, novo, doc); });
  return saida;
}

// Alinhamento declarado no atributo style do elemento
function alinhamentoDoNo(no, padrao) {
  const estilo = (no.getAttribute && no.getAttribute("style")) || "";
  const m = estilo.match(/text-align:\s*(left|center|right|justify)/i);
  if (!m) return padrao;
  return { left: "left", center: "center", right: "right", justify: "both" }[m[1].toLowerCase()];
}

function paragrafo(conteudo, { align = "both", espacoDepois = 200, indent = 0, lista = null, estilo = null } = {}) {
  if (!conteudo) conteudo = "";
  const numeracao = lista ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${lista}"/></w:numPr>` : "";
  const rec = indent ? `<w:ind w:left="${indent}"/>` : "";
  const est = estilo ? `<w:pStyle w:val="${estilo}"/>` : "";
  return `<w:p><w:pPr>${est}${numeracao}<w:jc w:val="${align}"/>` +
         `<w:spacing w:after="${espacoDepois}" w:line="276" w:lineRule="auto"/>${rec}</w:pPr>${conteudo}</w:p>`;
}

// Converte uma tabela HTML para tabela do Word
function tabelaParaOoxml(tabela, larguraTotal) {
  const linhas = [...tabela.querySelectorAll("tr")];
  if (linhas.length === 0) return "";
  const colunas = Math.max(...linhas.map(l => l.querySelectorAll("td,th").length));
  const larguraCol = Math.floor(larguraTotal / colunas);

  const grade = `<w:tblGrid>${Array(colunas).fill(`<w:gridCol w:w="${larguraCol}"/>`).join("")}</w:tblGrid>`;
  const borda = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map(l => `<w:${l} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join("");

  const corpo = linhas.map(linha => {
    const celulas = [...linha.querySelectorAll("td,th")];
    const tds = celulas.map(c => {
      const cabecalho = c.tagName.toLowerCase() === "th";
      const span = parseInt(c.getAttribute("colspan") || "1", 10);
      const conteudo = trechosDoNo(c, { b: cabecalho, sz: 19 }, null)
        || trecho(c.textContent || "", { b: cabecalho, sz: 19 });
      const props = `<w:tcPr><w:tcW w:w="${larguraCol * span}" w:type="dxa"/>` +
        (span > 1 ? `<w:gridSpan w:val="${span}"/>` : "") +
        (cabecalho ? '<w:shd w:val="clear" w:color="auto" w:fill="ECECEC"/>' : "") +
        `</w:tcPr>`;
      return `<w:tc>${props}${paragrafo(conteudo, { align: "left", espacoDepois: 0 })}</w:tc>`;
    }).join("");
    return `<w:tr>${tds}</w:tr>`;
  }).join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="${larguraTotal}" w:type="dxa"/>` +
         `<w:tblBorders>${borda}</w:tblBorders></w:tblPr>${grade}${corpo}</w:tbl>` +
         paragrafo("", { espacoDepois: 120 });
}

// Converte o HTML dos incisos (vindo do editor) para parágrafos do Word
function htmlParaOoxml(html, larguraTabela = 9070) {
  if (!html || !html.trim()) return "";
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, "text/html");
  const raiz = doc.getElementById("raiz");
  let saida = "";

  const blocos = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "blockquote", "hr"];

  function percorrer(no) {
    no.childNodes.forEach(filho => {
      if (filho.nodeType === 3) {
        const t = filho.nodeValue.trim();
        if (t) saida += paragrafo(trecho(filho.nodeValue.replace(/\s+/g, " "), {}));
        return;
      }
      if (filho.nodeType !== 1) return;
      const tag = filho.tagName.toLowerCase();

      if (tag === "hr") { saida += paragrafo("", { espacoDepois: 120 }); return; }

      if (tag === "table") { saida += tabelaParaOoxml(filho, larguraTabela); return; }

      if (tag === "ul" || tag === "ol") {
        const numId = tag === "ul" ? 1 : 2;
        filho.querySelectorAll("li").forEach(li => {
          saida += paragrafo(trechosDoNo(li, {}, doc), { align: "both", lista: numId, espacoDepois: 80 });
        });
        return;
      }

      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        const tamanhos = { h1: 30, h2: 26, h3: 24, h4: 23, h5: 22, h6: 21 };
        saida += paragrafo(trechosDoNo(filho, { b: true, sz: tamanhos[tag] }, doc),
          { align: alinhamentoDoNo(filho, "left"), espacoDepois: 120 });
        return;
      }

      if (tag === "blockquote") {
        saida += paragrafo(trechosDoNo(filho, { i: true }, doc), { align: "both", indent: 567 });
        return;
      }

      if (blocos.includes(tag)) {
        const conteudo = trechosDoNo(filho, {}, doc);
        if (conteudo) saida += paragrafo(conteudo, { align: alinhamentoDoNo(filho, "both") });
        return;
      }

      // Elemento solto (texto sem bloco em volta) — vira um parágrafo próprio
      const conteudo = trechosDoNo(filho, {}, doc);
      if (conteudo) saida += paragrafo(conteudo);
    });
  }

  percorrer(raiz);
  return saida;
}

// ---------- Montagem do pacote .docx ----------
function xmlContentTypes(temImagem) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>${temImagem ? `
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="jpg" ContentType="image/jpeg"/>` : ""}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
</Types>`;
}

const XML_RELS_RAIZ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const XML_ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/>
</w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

// Duas listas: marcadores e numerada
const XML_NUMERACAO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">
<w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0">
<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;

// Cabeçalho: imagem, texto em HTML, ou vazio
function xmlCabecalho(cabecalho) {
  let conteudo;
  if (cabecalho?.tipo === "imagem" && cabecalho.tamanho) {
    const cx = Math.round(cabecalho.tamanho.largura * PT_PARA_EMU);
    const cy = Math.round(cabecalho.tamanho.altura * PT_PARA_EMU);
    conteudo = `<w:p><w:pPr><w:jc w:val="center"/>
<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="000000"/></w:pBdr></w:pPr>
<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Timbre"/>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="timbre"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  } else if (cabecalho?.tipo === "texto" && cabecalho.html) {
    conteudo = htmlParaOoxml(cabecalho.html).replace(/<w:jc w:val="both"\/>/g, '<w:jc w:val="center"/>')
      + `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>
<w:spacing w:after="0"/></w:pPr></w:p>`;
  } else {
    conteudo = `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">${conteudo}</w:hdr>`;
}

// Documento principal, com a definição de página e a referência ao cabeçalho
function xmlDocumento(corpoOoxml, margemTopoPt) {
  const tw = pt => Math.round(pt * PT_PARA_TWIP);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${corpoOoxml}
<w:sectPr>
<w:headerReference w:type="default" r:id="rId10"/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="${tw(margemTopoPt)}" w:right="${tw(72)}" w:bottom="${tw(72)}" w:left="${tw(72)}"
 w:header="${tw(35.4)}" w:footer="${tw(35.4)}" w:gutter="0"/>
</w:sectPr></w:body></w:document>`;
}

// Converte um data URL em bytes
function dataUrlParaBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function extensaoDoDataUrl(dataUrl) {
  const m = /^data:image\/(png|jpe?g)/i.exec(dataUrl || "");
  if (!m) return "png";
  return m[1].toLowerCase() === "jpg" ? "jpeg" : m[1].toLowerCase();
}

// Ponto de entrada: monta e baixa o .docx
function baixarDocx({ corpoOoxml, cabecalho, nomeArquivo }) {
  const temImagem = cabecalho?.tipo === "imagem" && cabecalho.dataUrl;
  const ext = temImagem ? extensaoDoDataUrl(cabecalho.dataUrl) : "png";

  const margemTopo = cabecalho?.tipo === "imagem" && cabecalho.tamanho
    ? Math.max(72, 35.4 + cabecalho.tamanho.altura + 24)
    : cabecalho?.tipo === "texto" ? 108 : 72;

  const arquivos = [
    { nome: "[Content_Types].xml", dados: textoParaBytes(xmlContentTypes(temImagem)) },
    { nome: "_rels/.rels", dados: textoParaBytes(XML_RELS_RAIZ) },
    { nome: "word/document.xml", dados: textoParaBytes(xmlDocumento(corpoOoxml, margemTopo)) },
    { nome: "word/styles.xml", dados: textoParaBytes(XML_ESTILOS) },
    { nome: "word/numbering.xml", dados: textoParaBytes(XML_NUMERACAO) },
    { nome: "word/header1.xml", dados: textoParaBytes(xmlCabecalho(cabecalho)) },
    { nome: "word/_rels/document.xml.rels", dados: textoParaBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId12" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`) },
    { nome: "word/_rels/header1.xml.rels", dados: textoParaBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${temImagem ? `
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.${ext}"/>` : ""}
</Relationships>`) },
  ];

  if (temImagem) {
    arquivos.push({ nome: `word/media/image1.${ext}`, dados: dataUrlParaBytes(cabecalho.dataUrl) });
  }

  const zip = criarZip(arquivos);
  const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Justificativa de Aquisição — documento próprio, salvo em lista (chave "just:<id>"), como os ETPs
function emptyJustificativa() {
  return {
    id: "just_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    campos: {
      objeto: "", unidadeBeneficiada: "",
      processo: "", orgao: "Secretaria Municipal de Assistência Social",
      programas: "", localEntrega: "", horarioEntrega: "", prazoPagamentoDias: "",
    },
    conteudo: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Declaração de previsão no PCA — documento próprio, salvo em lista (chave "decl:<id>").
// Guarda só os itens e o preenchimento manual; a planilha do PCA fica compartilhada
// (chave "pca:planilha"), porque é uma tabela de referência grande e comum a todos.
function emptyDeclaracao() {
  return {
    id: "decl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    objeto: "",
    orgao: "Secretaria Municipal de Assistência Social",
    itens: [],
    manuais: {}, // { itemId: { codigo, sequencial } }
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Busca linhas do PCA por código ou por parte da descrição. Usada para vincular manualmente
// um item cujo código no Centi é diferente do código no PCA.
function buscarNoPca(pca, termo, limite = 8) {
  const t = String(termo || "").trim().toLowerCase();
  if (!pca?.linhas || t.length < 2) return [];
  const porCodigo = [];
  const porTexto = [];
  for (const l of pca.linhas) {
    const cod = (l.codigo || "").toLowerCase();
    const prod = (l.produto || "").toLowerCase();
    const seq = (l.sequencial || "").toLowerCase();
    if (mesmoCodigo(cod, t) || mesmoCodigo(seq, t)) porCodigo.unshift(l);  // correspondência exata primeiro
    else if (cod.startsWith(t) || seq.startsWith(t)) porCodigo.push(l);
    else if (prod.includes(t)) porTexto.push(l);
    if (porCodigo.length + porTexto.length > limite * 3) break;
  }
  return [...porCodigo, ...porTexto].slice(0, limite);
}

// Linha do PCA correspondente a um código informado (usada para mostrar o produto ao digitar)
function linhaPcaPorCodigo(pca, codigo) {
  if (!normalizarCodigo(codigo) || !pca?.linhas) return null;
  return pca.linhas.find(l => mesmoCodigo(l.codigo, codigo)) || null;
}

// Cruza os itens com a planilha do PCA. Além da correspondência automática por código,
// considera os códigos que o servidor preencheu à mão para itens previstos de outra forma.
function cruzarComPca(itens, pca, manuais = {}) {
  return (itens || []).map(it => {
    const automatico = pca ? pcaMatchFor(it, pca.linhas) : null;
    const manual = !automatico ? (manuais[it.id] || null) : null;

    // Vínculo manual: o servidor apontou qual linha do PCA corresponde a este item, seja
    // escolhendo pelo código do PCA (que pode ser diferente do código do Centi), seja
    // digitando o sequencial direto.
    const linhaVinculada = manual?.codigoPca ? linhaPcaPorCodigo(pca, manual.codigoPca) : null;
    const sequencialManual = linhaVinculada?.sequencial || manual?.sequencial?.trim() || null;

    const pcaRow = automatico || linhaVinculada;
    return {
      item: it,
      pcaRow,
      automatico: !!automatico,
      manual,
      linhaVinculada,
      previsto: !!(automatico || sequencialManual),
      sequencial: automatico ? (automatico.sequencial || "—") : sequencialManual,
      codigo: automatico
        ? (it.idProduto || "-")
        : (manual?.codigoPca?.trim() || manual?.codigo?.trim() || it.idProduto || "-"),
      produtoPca: automatico?.produto || linhaVinculada?.produto || null,
    };
  });
}

// Quantos itens do ETP estão previstos no PCA (incluindo os preenchidos manualmente)
function contarPrevistosNoPca(etp) {
  return cruzarComPca(etp.itens, etp.pca, etp.manuaisPca).filter(m => m.previsto).length;
}

// ---------- Checklist de conformidade ----------
// Confere o ETP antes de finalizar. Cada apontamento tem gravidade:
//   "impeditivo" — exigência legal não atendida
//   "atencao"    — algo provavelmente incompleto, mas não impede
//   "ok"         — verificação atendida
function verificarConformidade(etp) {
  const itens = etp.itens || [];
  const excluidos = etp.incisosExcluidos || [];
  const apontamentos = [];

  const add = (nivel, texto, onde) => apontamentos.push({ nivel, texto, onde });

  // --- Identificação ---
  if (!etp.meta.titulo?.trim()) add("impeditivo", "O objeto da contratação não foi definido.", "meta");
  else add("ok", "Objeto da contratação definido.", "meta");

  if (!etp.meta.processo?.trim()) add("atencao", "Número do processo administrativo não informado.", "meta");
  if (listaResponsaveis(etp).length === 0) add("impeditivo", "Nenhum responsável técnico cadastrado para assinar.", "meta");
  else add("ok", `${listaResponsaveis(etp).length} responsável(is) cadastrado(s).`, "meta");

  // --- Itens e quantidades ---
  if (itens.length === 0) {
    add("impeditivo", "Nenhum item cadastrado na planilha.", "itens");
  } else {
    add("ok", `${itens.length} item(ns) cadastrado(s).`, "itens");
    const semQtd = itens.filter(i => !num(i.quantidade)).length;
    if (semQtd > 0) add("impeditivo", `${semQtd} item(ns) sem quantidade informada.`, "itens");
    const semDesc = itens.filter(i => !i.descricao?.trim()).length;
    if (semDesc > 0) add("impeditivo", `${semDesc} item(ns) sem descrição.`, "itens");
  }

  // --- PCA (art. 12, VII) ---
  if (itens.length > 0) {
    if (!etp.pca) {
      add("atencao", "Planilha do PCA não importada — não há como demonstrar o alinhamento ao plano.", "pca");
    } else {
      const previstos = contarPrevistosNoPca(etp);
      if (previstos === itens.length) add("ok", "Todos os itens estão previstos no PCA.", "pca");
      else add("atencao", `${itens.length - previstos} item(ns) sem previsão no PCA — requer inclusão no plano ou justificativa (art. 12, VII).`, "pca");
    }
  }

  // --- Estimativa de valor (art. 23) ---
  if (itens.length > 0) {
    const total = valorTotalEtp(etp);
    if (total === 0) {
      add("impeditivo", "Nenhuma cotação lançada — a contratação está sem estimativa de valor.", "cotacoes");
    } else {
      add("ok", `Valor total estimado: ${brl(total)}.`, "cotacoes");
      const semCotacao = itens.filter(i => (etp.cotacoes?.[i.id] || []).length === 0).length;
      if (semCotacao > 0) add("atencao", `${semCotacao} item(ns) sem nenhuma cotação registrada.`, "cotacoes");
      const umaCotacao = itens.filter(i => (etp.cotacoes?.[i.id] || []).length === 1).length;
      if (umaCotacao > 0) add("atencao", `${umaCotacao} item(ns) com apenas uma cotação — a pesquisa de preços costuma exigir mais de uma fonte.`, "cotacoes");
    }
  }

  // --- Incisos obrigatórios (art. 18, §2º) ---
  REQUIRED_IDS.forEach(id => {
    const sec = SECOES.find(x => x.id === id);
    if (excluidos.includes(id)) {
      add("impeditivo", `Inciso ${id} (${sec.titulo}) foi deixado fora do ETP, mas é obrigatório pelo art. 18, §2º.`, "documento");
    } else if (!etp.sections[id]?.trim()) {
      add("impeditivo", `Inciso ${id} (${sec.titulo}) está em branco e é obrigatório.`, "documento");
    }
  });
  const obrigatoriosOk = REQUIRED_IDS.filter(id => !excluidos.includes(id) && etp.sections[id]?.trim()).length;
  if (obrigatoriosOk === REQUIRED_IDS.length) add("ok", "Todos os incisos obrigatórios estão preenchidos.", "documento");

  // --- Referências cruzadas quebradas pela renumeração ---
  const numeros = numeracaoFinal(etp);
  const mudaram = SECOES.filter(sec => numeros[sec.id] && numeros[sec.id] !== sec.id).map(sec => sec.id);
  if (mudaram.length > 0) {
    const citacoes = [];
    Object.entries(etp.sections || {}).forEach(([id, html]) => {
      if (!html?.trim() || excluidos.includes(id)) return;
      const texto = html.replace(/<[^>]+>/g, " ");
      mudaram.forEach(orig => {
        const padrao = new RegExp(`inciso\\s+${orig}\\b`, "i");
        if (padrao.test(texto)) citacoes.push(`${numeros[id] || id} cita "inciso ${orig}", que passou a ser ${numeros[orig]}`);
      });
    });
    if (citacoes.length > 0) {
      add("atencao", `Referência entre incisos possivelmente desatualizada pela renumeração: ${citacoes.join("; ")}.`, "documento");
    }
  }

  return apontamentos;
}

// Título curto para exibir na lista de documentos avulsos
function tituloDocumento(doc) {
  const obj = (doc.campos?.objeto ?? doc.objeto ?? "").trim();
  return obj || "Sem objeto definido";
}

// Duplica qualquer documento (ETP, justificativa ou declaração): copia tudo, gera id novo,
// zera as datas e acrescenta "(cópia)" ao título, para não confundir com o original.
function duplicarDocumento(doc, prefixoId) {
  const copia = JSON.parse(JSON.stringify(doc));
  copia.id = prefixoId + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  copia.createdAt = Date.now();
  copia.updatedAt = Date.now();

  // O título fica em lugares diferentes conforme o tipo de documento
  if (copia.meta?.titulo !== undefined) {
    copia.meta.titulo = (copia.meta.titulo || "Sem título") + " (cópia)";
  } else if (copia.campos?.objeto !== undefined) {
    copia.campos.objeto = (copia.campos.objeto || "Sem objeto") + " (cópia)";
  } else if (copia.objeto !== undefined) {
    copia.objeto = (copia.objeto || "Sem objeto") + " (cópia)";
  }
  return copia;
}

function newItem() {
  return { id: "it_" + Math.random().toString(36).slice(2, 8), idProduto: "", descricao: "", unidade: "UNIDADE", quantidade: "", classificacao: "" };
}

// Lê uma planilha de itens no modelo padrão do Sistema Centi da Prefeitura
// (cabeçalho: Id Produto | Nome do Produto | Unidade Medida | Quantidade | Classificação | ...)
// Apenas a relação de itens é importada — valores ficam para a etapa de Levantamento de Preços.
function parseCentiSheet(rows) {
  function findLabelValue(label) {
    for (const row of rows) {
      const idx = row.findIndex(c => String(c).trim().toLowerCase() === label.toLowerCase());
      if (idx !== -1) {
        for (let j = idx + 1; j < row.length; j++) {
          if (String(row[j] ?? "").trim() !== "") return String(row[j]).trim();
        }
      }
    }
    return "";
  }

  const headerRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === "Nome do Produto"));
  if (headerRowIdx === -1) {
    throw new Error("Não encontrei a coluna 'Nome do Produto' — não parece ser uma planilha do Sistema Centi.");
  }
  const headerRow = rows[headerRowIdx].map(c => String(c ?? "").trim());
  const col = (name) => headerRow.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const cId = col("Id Produto");
  const cNome = col("Nome do Produto");
  const cUnidade = col("Unidade Medida");
  const cQtd = col("Quantidade");
  const cClass = col("Classificação");

  const itens = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const nome = cNome !== -1 ? String(row[cNome] ?? "").trim() : "";
    if (!nome) continue;
    itens.push({
      id: "it_" + Math.random().toString(36).slice(2, 8),
      idProduto: cId !== -1 ? String(row[cId] ?? "").trim() : "",
      descricao: nome,
      unidade: cUnidade !== -1 ? (String(row[cUnidade] ?? "").trim() || "UNIDADE") : "UNIDADE",
      quantidade: cQtd !== -1 ? String(row[cQtd] ?? "").trim() : "",
      classificacao: cClass !== -1 ? String(row[cClass] ?? "").trim() : "",
    });
  }

  return {
    itens,
    codigo: findLabelValue("Código"),
    municipio: findLabelValue("Município"),
  };
}

// Gera e baixa um modelo de planilha em branco (formato compatível com a importação acima)
function baixarModeloPlanilha() {
  const header = ["Id Produto", "Nome do Produto", "Unidade Medida", "Quantidade", "Classificação"];
  // O exemplo já vem com o código preenchido: é por ele que o app cruza o item com o PCA
  const exemplo = ["5241938182", "Ex.: CADEIRA DE RODAS EM ALUMÍNIO DOBRÁVEL ATÉ 120KG", "UNIDADE", "10", "MATERIAL PERMANENTE"];
  const nota = ["", "↑ Apague esta linha de exemplo. O 'Id Produto' é o código do Sistema Centi e é usado para localizar o item no PCA.", "", "", ""];
  const ws = XLSX.utils.aoa_to_sheet([header, exemplo, nota]);
  ws["!cols"] = [{ wch: 14 }, { wch: 55 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Itens");
  XLSX.writeFile(wb, "modelo_planilha_itens.xlsx");
}

// Gera a planilha, no mesmo formato de importação do Sistema Centi, com os itens que ainda não
// constam no PCA — para ser importada no Centi como requerimento de inclusão desses itens no plano.
function baixarPlanilhaInclusaoCenti(itensFaltantes) {
  const header = ["Id Produto", "Nome do Produto", "Unidade Medida", "Quantidade", "Classificação"];
  const rows = itensFaltantes.map(it => [it.idProduto || "", it.descricao || "", it.unidade || "", it.quantidade || "", it.classificacao || ""]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 14 }, { wch: 55 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Itens para inclusão no PCA");
  XLSX.writeFile(wb, "itens_para_inclusao_no_pca.xlsx");
}

// Lê a planilha do PCA (Plano de Contratações Anual) exportada do painel/dashboard
// (cabeçalho: LOCAL | SEQUENCIAL | CÓDIGO | PRODUTO | UNIDADE DE MEDIDA | ... | DATA PARA CONTRATAÇÃO | PRIORIDADE)
function parsePCASheet(rows) {
  const headerRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === "CÓDIGO") && r.some(c => String(c).trim() === "PRODUTO"));
  if (headerRowIdx === -1) {
    throw new Error("Não encontrei as colunas 'CÓDIGO' e 'PRODUTO' — não parece ser a planilha exportada do painel do PCA.");
  }
  const headerRow = rows[headerRowIdx].map(c => String(c ?? "").trim());
  const col = (name) => headerRow.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const cLocal = col("LOCAL");
  const cSeq = col("SEQUENCIAL");
  const cCodigo = col("CÓDIGO");
  const cProduto = col("PRODUTO");
  const cData = col("DATA PARA CONTRATAÇÃO");
  const cPrioridade = col("PRIORIDADE");
  const cQtd = col("QUANTIDADE");

  const linhas = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const codigo = cCodigo !== -1 ? String(row[cCodigo] ?? "").trim() : "";
    const produto = cProduto !== -1 ? String(row[cProduto] ?? "").trim() : "";
    if (!codigo && !produto) continue;
    linhas.push({
      local: cLocal !== -1 ? String(row[cLocal] ?? "").trim() : "",
      sequencial: cSeq !== -1 ? String(row[cSeq] ?? "").trim() : "",
      codigo,
      produto,
      quantidade: cQtd !== -1 ? String(row[cQtd] ?? "").trim() : "",
      dataContratacao: cData !== -1 ? String(row[cData] ?? "").trim() : "",
      prioridade: cPrioridade !== -1 ? String(row[cPrioridade] ?? "").trim() : "",
    });
  }
  if (linhas.length === 0) throw new Error("Nenhuma linha de item foi encontrada nesta planilha.");
  return linhas;
}

// Cruza um item da Planilha de Itens com as linhas do PCA — por código (Sistema Centi) e, na falta dele, por descrição
// Normaliza um código para comparação: o Excel ora entrega texto, ora número, às vezes com
// espaço rígido ou zeros à esquerda. Sem isso, códigos iguais deixam de casar.
function normalizarCodigo(v) {
  return String(v ?? "").replace(/[\s\u00A0]/g, "").trim();
}

// Dois códigos são o mesmo se batem exatamente ou se só diferem por zeros à esquerda
function mesmoCodigo(a, b) {
  const x = normalizarCodigo(a), y = normalizarCodigo(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const semZeros = t => t.replace(/^0+/, "") || "0";
  return /^\d+$/.test(x) && /^\d+$/.test(y) && semZeros(x) === semZeros(y);
}

function pcaMatchFor(item, pcaLinhas) {
  if (!pcaLinhas || pcaLinhas.length === 0) return null;
  if (item.idProduto) {
    const porCodigo = pcaLinhas.find(l => mesmoCodigo(l.codigo, item.idProduto));
    if (porCodigo) return porCodigo;
  }
  if (item.descricao) {
    const alvo = item.descricao.trim().toLowerCase();
    const porDescricao = pcaLinhas.find(l => l.produto && l.produto.trim().toLowerCase() === alvo);
    if (porDescricao) return porDescricao;
  }
  return null;
}

// Gera a planilha de cotação a ser enviada a um fornecedor (Nome/CNPJ + itens, valor em branco)
function gerarPlanilhaCotacaoFornecedor({ etp, nomeEmpresa, cnpj }) {
  const itens = etp.itens || [];
  const rows = [
    ["COTAÇÃO DE PREÇOS"],
    [],
    ["Órgão", etp.meta.orgao || ""],
    ["Objeto", etp.meta.titulo || ""],
    ["Empresa", nomeEmpresa || ""],
    ["CNPJ", cnpj || ""],
    ["Data", fmtDateISO(etp.meta.data) || fmtDate(Date.now())],
    [],
    ["Atenção! Preencha somente a coluna \"Valor Unitário (R$)\". Não altere as demais colunas."],
    [],
    ["Id Item", "Item", "Descrição", "Unidade", "Quantidade", "Valor Unitário (R$)"],
  ];
  itens.forEach((it, idx) => {
    rows.push([it.id, idx + 1, it.descricao, it.unidade, it.quantidade, ""]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 1, hidden: true }, { wch: 6 }, { wch: 55 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cotação");
  const nomeArquivo = (nomeEmpresa || "fornecedor").trim().replace(/[^\w\-]+/g, "_").slice(0, 40) || "fornecedor";
  XLSX.writeFile(wb, `cotacao_${nomeArquivo}.xlsx`);
}

// Lê a planilha de cotação preenchida e devolvida por um fornecedor
function parseCotacaoFornecedorSheet(rows) {
  function findLabelValue(label) {
    for (const row of rows) {
      const idx = row.findIndex(c => String(c).trim().toLowerCase() === label.toLowerCase());
      if (idx !== -1) {
        for (let j = idx + 1; j < row.length; j++) {
          if (String(row[j] ?? "").trim() !== "") return String(row[j]).trim();
        }
      }
    }
    return "";
  }
  const headerRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === "Valor Unitário (R$)"));
  if (headerRowIdx === -1) {
    throw new Error("Não encontrei a coluna 'Valor Unitário (R$)' — use o modelo exportado por este app.");
  }
  const headerRow = rows[headerRowIdx].map(c => String(c ?? "").trim());
  const col = (name) => headerRow.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const cId = col("Id Item");
  const cDescricao = col("Descrição");
  const cValor = col("Valor Unitário (R$)");

  const valores = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const valorRaw = cValor !== -1 ? String(row[cValor] ?? "").trim() : "";
    if (!valorRaw || num(valorRaw) <= 0) continue;
    valores.push({
      itemId: cId !== -1 ? String(row[cId] ?? "").trim() : "",
      descricao: cDescricao !== -1 ? String(row[cDescricao] ?? "").trim() : "",
      valor: valorRaw,
    });
  }

  return { nomeEmpresa: findLabelValue("Empresa"), cnpj: findLabelValue("CNPJ"), valores };
}

// Lê um valor monetário digitado ou colado em qualquer formato usual:
// "1.234,56"  "1234,56"  "1234.56"  "R$ 2.350,90"  "1,234.56"  "10.000"  "0,4567"
// Regra: quando há vírgula e ponto, o último separador é o decimal. Quando há só ponto,
// um grupo final de exatamente 3 dígitos é separador de milhar (convenção brasileira).
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").trim();
  if (!s) return 0;

  const negativo = /^-|\(.*\)$/.test(s);
  s = s.replace(/[^\d,.]/g, ""); // tira R$, espaços, letras
  if (!s) return 0;

  const iVirgula = s.lastIndexOf(",");
  const iPonto = s.lastIndexOf(".");

  if (iVirgula >= 0 && iPonto >= 0) {
    if (iVirgula > iPonto) s = s.replace(/\./g, "").replace(",", ".");  // 1.234,56
    else s = s.replace(/,/g, "");                                        // 1,234.56
  } else if (iVirgula >= 0) {
    s = s.replace(/\./g, "").replace(",", ".");                          // 1234,56
  } else if (iPonto >= 0) {
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    // "1.234" e "1.234.567" são milhar; "1234.56" e "0.4567" são decimais
    if (partes.length > 2 || ultima.length === 3) s = partes.join("");
  }

  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negativo ? -Math.abs(n) : n;
}

// Formata em reais. Mantém até 4 casas decimais quando o valor as tem — preços unitários
// de licitação costumam usar 3 ou 4 — e nunca mostra menos de 2.
function brl(n) {
  const v = Number(n) || 0;
  const decimais = (v.toFixed(6).split(".")[1] || "").replace(/0+$/, "").length;
  const casas = Math.min(4, Math.max(2, decimais));
  return v.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  });
}

// Valor formatado para voltar a um campo de digitação (sem o símbolo, vírgula decimal)
function formatarParaCampo(v) {
  const n = Number(v) || 0;
  const decimais = (n.toFixed(6).split(".")[1] || "").replace(/0+$/, "").length;
  const casas = Math.min(4, Math.max(2, decimais));
  return n.toFixed(casas).replace(".", ",");
}

function progress(etp) {
  const filled = SECOES.filter(s => etp.sections[s.id]?.trim().length > 0).length;
  const reqFilled = REQUIRED_IDS.filter(id => etp.sections[id]?.trim().length > 0).length;
  return { filled, total: SECOES.length, reqFilled, reqTotal: REQUIRED_IDS.length,
    pct: Math.round((filled / SECOES.length) * 100) };
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Data relativa curta ("hoje", "há 3 dias") para o painel — cai para a data cheia quando é antigo
function fmtDateRelativa(ts) {
  const dias = Math.floor((Date.now() - ts) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return fmtDate(ts);
}

// Valor total estimado de um ETP — usa a média/mediana das cotações (mesma lógica do quadro
// comprobatório do inciso VI); se não houver cotações, cai no valor adotado manualmente.
function valorTotalEtp(etp) {
  const itens = etp.itens || [];
  const cotacoes = etp.cotacoes || {};
  const valoresAdotados = etp.valoresAdotados || {};
  const usaMedia = etp.meta?.metodologiaCalculo === "media";
  return itens.reduce((soma, it) => {
    const stats = statsFor(cotacoes[it.id] || []);
    const unitario = stats.n > 0 ? (usaMedia ? stats.media : stats.mediana) : num(valoresAdotados[it.id]);
    return soma + num(it.quantidade) * unitario;
  }, 0);
}

// Data de hoje no formato ISO (yyyy-mm-dd), para preencher <input type="date">
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Converte uma data ISO (yyyy-mm-dd) para o formato dd/mm/aaaa
function fmtDateISO(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Converte uma data ISO (yyyy-mm-dd) para "dia de mês de ano" (ex.: 15 de julho de 2026)
function fmtDateExtenso(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES_PT[m - 1]} de ${y}`;
}

// Linha de fechamento "Cidade - Estado, dia de mês de ano." usada na assinatura do ETP
function linhaAssinaturaData(etp) {
  const local = etp.meta.local?.trim() || "[Cidade] - [Estado]";
  const data = fmtDateExtenso(etp.meta.data) || fmtDateExtenso(todayISO());
  return `${local}, ${data}.`;
}

// Objeto completo do ETP: título resumido + órgão solicitante, usado no documento final
// Lista de responsáveis a exibir/assinar — usa o novo campo de múltiplos responsáveis;
// se estiver vazio, cai no campo antigo (responsavel/cargo), para ETPs criados antes desta mudança.
function listaResponsaveis(etp) {
  if (etp.meta.responsaveis?.length > 0) return etp.meta.responsaveis;
  if (etp.meta.responsavel?.trim()) return [{ id: "legado", nome: etp.meta.responsavel, cargo: etp.meta.cargo || "" }];
  return [];
}

function objetoCompleto(etp) {
  const titulo = etp.meta.titulo?.trim();
  const orgao = etp.meta.orgao?.trim();
  const setor = etp.meta.setor?.trim();
  if (!titulo) return "";
  const partes = [];
  if (setor) partes.push(`do(a) ${setor}`);
  if (orgao) partes.push(`da ${orgao}`);
  return partes.length > 0 ? `${titulo} para atender às necessidades ${partes.join(", ")}` : titulo;
}

// Redimensiona uma imagem (data URL) para uma largura máxima, para não pesar no armazenamento
function redimensionarImagem(dataUrl, maxWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png", 0.92));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ---------- Prompt de IA (para copiar e colar em ferramentas externas) ----------
// Um prompt específico por tópico, fornecido pelo usuário — cada um já é autocontido (traz seu
// próprio "papel" de especialista), pensado para funcionar mesmo se a pessoa copiar só aquele
// tópico isolado, sem contexto de conversa anterior com a IA.
const PROMPTS_POR_TOPICO = {
  I: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, jurisprudência do TCU, Tribunais de Contas e boas práticas de planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Descrição da Necessidade" do Estudo Técnico Preliminar (ETP).

Objetivo do estudo
Elaborar um diagnóstico técnico detalhado que demonstre a necessidade administrativa que motivou a contratação, evidenciando o problema existente, os impactos decorrentes da ausência da contratação e a motivação para atendimento do interesse público.

Considere exclusivamente as informações fornecidas pelo usuário.

O estudo deverá:
• contextualizar a realidade administrativa;
• identificar o problema que se pretende solucionar;
• demonstrar as consequências da não contratação;
• demonstrar quem será beneficiado pela contratação;
• evidenciar a relação entre a necessidade e as atividades desempenhadas pelo órgão;
• explicar como a contratação contribuirá para a continuidade, eficiência e melhoria dos serviços públicos;
• demonstrar o interesse público envolvido;
• justificar tecnicamente a necessidade da contratação.

O texto deve possuir linguagem formal, técnica, impessoal e compatível com processos administrativos.
Não utilize listas.
Não faça recomendações.
Não cite artigos da lei, salvo quando solicitado.
Produza texto completo, robusto e pronto para integrar diretamente o ETP.`,

  II: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Alinhamento ao Plano de Contratações Anual (PCA)" do Estudo Técnico Preliminar.

Analise as informações fornecidas e elabore um estudo demonstrando se a contratação está prevista no Plano de Contratações Anual ou, quando não estiver, apresente justificativa técnica para sua realização.

O estudo deverá abordar:
• alinhamento com o planejamento estratégico do órgão;
• compatibilidade com o Plano de Contratações Anual;
• integração com os objetivos institucionais;
• relação da contratação com políticas públicas desenvolvidas pelo órgão;
• atendimento ao princípio do planejamento;
• atendimento ao interesse público;
• justificativa para eventual inexistência no PCA;
• impactos administrativos decorrentes da contratação.

A redação deve demonstrar que a contratação decorre de planejamento administrativo e atende às necessidades institucionais.
Produza texto técnico, completo, robusto e pronto para integrar o ETP.`,

  III: `Você é especialista em especificações técnicas de contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Requisitos da Contratação" do Estudo Técnico Preliminar.

Com base nas informações fornecidas, identifique e descreva todos os requisitos necessários para que a futura contratação atenda adequadamente à necessidade administrativa.

O estudo deverá contemplar, quando aplicável:
• requisitos técnicos;
• requisitos funcionais;
• requisitos operacionais;
• requisitos de desempenho;
• requisitos mínimos de qualidade;
• requisitos de segurança;
• requisitos legais;
• requisitos normativos;
• requisitos ambientais;
• requisitos de sustentabilidade;
• requisitos de garantia;
• requisitos de assistência técnica;
• requisitos de instalação;
• requisitos de treinamento;
• requisitos de manutenção;
• requisitos de entrega;
• requisitos de logística;
• requisitos relacionados à durabilidade;
• requisitos relacionados à compatibilidade com soluções existentes.

Explique tecnicamente a necessidade de cada requisito apresentado.
Evite apenas listar características.
Justifique por que cada requisito é indispensável para o atendimento da necessidade administrativa.
Produza texto técnico, detalhado, coeso e pronto para integrar diretamente o Estudo Técnico Preliminar.`,

  IV: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, das boas práticas do Tribunal de Contas da União (TCU), dos Tribunais de Contas Estaduais e do planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Levantamento de Mercado" do Estudo Técnico Preliminar (ETP).

Objetivo do estudo
Realizar uma análise técnica das alternativas disponíveis no mercado capazes de atender à necessidade administrativa, demonstrando que a solução escolhida decorre de avaliação comparativa, fundamentada e orientada pela busca da proposta mais vantajosa para a Administração Pública.

Com base exclusivamente nas informações fornecidas pelo usuário, desenvolva um estudo que contemple, sempre que aplicável:
• identificação das soluções existentes no mercado;
• modalidades de fornecimento ou execução disponíveis;
• tecnologias, metodologias ou modelos de atendimento existentes;
• comparação entre diferentes soluções sob os aspectos técnicos, operacionais, econômicos e administrativos;
• vantagens e limitações de cada alternativa identificada;
• análise da maturidade das soluções disponíveis;
• avaliação da compatibilidade das alternativas com a realidade da Administração;
• justificativa técnica para eventual descarte das demais soluções avaliadas;
• demonstração das razões que tornam a solução escolhida a mais adequada ao atendimento da necessidade administrativa.

Sempre que houver informações suficientes, demonstre que foram considerados critérios de eficiência, economicidade, qualidade, desempenho, sustentabilidade, facilidade de manutenção, disponibilidade no mercado, prazo de atendimento, capacidade operacional e custo-benefício.

O texto deverá evidenciar que houve efetivo estudo de mercado, e não mera indicação da solução pretendida.
Não utilize listas na resposta final.
Produza texto técnico, analítico, robusto e pronto para integrar diretamente o Estudo Técnico Preliminar.`,

  V: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Estimativa das Quantidades" do Estudo Técnico Preliminar.

Objetivo do estudo
Demonstrar tecnicamente como foram definidas as quantidades necessárias para atendimento da demanda administrativa, evidenciando que os quantitativos decorrem de critérios objetivos, estudos prévios e necessidade efetiva da Administração.

Com base nas informações fornecidas pelo usuário, desenvolva um estudo abordando, sempre que aplicável:
• metodologia utilizada para definição das quantidades;
• memória de cálculo utilizada;
• histórico de consumo;
• séries históricas;
• número de usuários atendidos;
• expansão ou redução da demanda;
• consumo médio;
• capacidade operacional;
• sazonalidade;
• previsão de crescimento institucional;
• perdas naturais;
• estoque existente;
• estoque mínimo;
• margem de segurança;
• critérios técnicos adotados.

Explique de forma fundamentada por que as quantidades estimadas representam o necessário ao atendimento da demanda, evitando tanto o subdimensionamento quanto o superdimensionamento da contratação.
Quando houver quantitativos apresentados pelo usuário, incorpore-os ao texto de forma natural.
Jamais invente quantidades.
Caso os quantitativos não sejam informados, elabore o estudo utilizando fundamentação técnica genérica.
Produza texto robusto, detalhado e pronto para integrar o ETP.`,

  VI: `Você é especialista em orçamento estimativo nas contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Estimativa do Valor da Contratação" do Estudo Técnico Preliminar.

Objetivo do estudo
Demonstrar que a estimativa financeira da contratação foi elaborada mediante critérios técnicos, observando as práticas de pesquisa de preços, compatibilidade com o mercado e obtenção da proposta mais vantajosa para a Administração.

Desenvolva um estudo abordando, quando aplicável:
• metodologia utilizada para estimativa de preços;
• parâmetros utilizados;
• fontes de pesquisa;
• preços públicos;
• contratações similares;
• painéis de preços;
• fornecedores;
• bancos oficiais;
• composição dos custos;
• adequação dos valores ao mercado;
• atualização monetária, quando pertinente;
• compatibilidade entre preço e solução escolhida;
• confiabilidade da pesquisa de preços;
• análise da razoabilidade dos valores.

Caso o usuário forneça o valor estimado, explique tecnicamente sua composição e adequação.
Caso não forneça valores, produza texto genérico, sem inventar preços.
O estudo deverá demonstrar que o orçamento estimado representa referência confiável para a futura contratação.
Produza texto técnico, completo e pronto para integrar o Estudo Técnico Preliminar.`,

  VII: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Descrição da Solução como um Todo" do Estudo Técnico Preliminar.

Objetivo do estudo
Descrever detalhadamente a solução escolhida para atendimento da necessidade administrativa, demonstrando que ela representa a alternativa tecnicamente mais adequada dentre aquelas avaliadas.

Com base nas informações fornecidas, desenvolva um estudo contemplando, quando aplicável:
• descrição completa da solução;
• funcionamento da solução;
• integração entre bens, serviços ou obras;
• ciclo de vida da solução;
• forma de execução;
• requisitos técnicos;
• requisitos operacionais;
• logística;
• manutenção;
• assistência técnica;
• garantias;
• treinamento;
• fornecimento;
• instalação;
• suporte;
• desempenho esperado;
• compatibilidade com a estrutura existente;
• ganhos operacionais;
• eficiência administrativa;
• economicidade;
• sustentabilidade.

Explique como todos os componentes se integram para atender plenamente à necessidade administrativa.
Justifique por que a solução é considerada suficiente, adequada e vantajosa.
O texto deverá representar uma visão sistêmica da contratação.
Produza texto técnico, analítico e robusto.`,

  VIII: `Você é especialista em Licitações Públicas.

Sua tarefa é elaborar exclusivamente o tópico "Justificativa do Parcelamento" do Estudo Técnico Preliminar.

Objetivo do estudo
Analisar tecnicamente a viabilidade do parcelamento ou não da contratação, demonstrando os impactos da decisão sobre a competitividade, economicidade, eficiência contratual e interesse público.

Desenvolva estudo abordando:
• possibilidade técnica de divisão do objeto;
• natureza do objeto;
• unidade funcional;
• economia de escala;
• especialização dos fornecedores;
• ampliação da competitividade;
• gerenciamento contratual;
• riscos operacionais;
• custos administrativos;
• impactos sobre a execução;
• viabilidade logística;
• eficiência da fiscalização;
• vantajosidade para a Administração.

Caso o usuário informe que haverá parcelamento, fundamente tecnicamente essa decisão.
Caso informe que não haverá parcelamento, demonstre por que a execução conjunta representa a alternativa mais vantajosa.
Não apenas afirme a conclusão.
Explique todo o raciocínio técnico que levou à decisão.
Produza texto robusto, fundamentado e pronto para integrar o ETP.`,

  IX: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, das boas práticas do Tribunal de Contas da União (TCU), dos Tribunais de Contas Estaduais e do planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Resultados Pretendidos" do Estudo Técnico Preliminar (ETP).

Objetivo do estudo
Demonstrar, de forma técnica e fundamentada, quais benefícios institucionais serão alcançados com a contratação, evidenciando os ganhos esperados para a Administração Pública, para os usuários dos serviços públicos e para o interesse público.

Com base exclusivamente nas informações fornecidas pelo usuário, desenvolva um estudo que contemple, sempre que aplicável:
• solução integral da necessidade administrativa;
• melhoria da qualidade dos serviços prestados;
• aumento da eficiência administrativa;
• redução de falhas operacionais;
• continuidade dos serviços públicos;
• melhoria dos processos internos;
• otimização dos recursos públicos;
• redução de desperdícios;
• racionalização de custos;
• incremento da produtividade;
• melhoria do atendimento ao cidadão;
• redução de riscos administrativos;
• fortalecimento da governança;
• atendimento às políticas públicas;
• sustentabilidade econômica, ambiental e social;
• maior segurança operacional;
• aumento da confiabilidade da solução contratada.

Explique de que forma a contratação contribuirá para o alcance dos objetivos institucionais, demonstrando sua relevância para a Administração Pública.
Não apresente apenas expectativas genéricas. Desenvolva uma análise técnica consistente, relacionando os resultados pretendidos às características da solução escolhida.
O texto deve possuir linguagem formal, técnica, impessoal e estar pronto para integrar diretamente o Estudo Técnico Preliminar.`,

  X: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Providências Prévias à Contratação" do Estudo Técnico Preliminar.

Objetivo do estudo
Identificar todas as medidas administrativas, operacionais, técnicas e organizacionais que deverão ser adotadas pela Administração antes da celebração do futuro contrato, garantindo condições adequadas para sua execução.

Com base nas informações fornecidas pelo usuário, desenvolva um estudo contemplando, sempre que aplicável:
• designação de gestor e fiscais do contrato;
• capacitação dos servidores envolvidos;
• adequação da infraestrutura física;
• adequação tecnológica;
• preparação dos locais de entrega ou execução;
• elaboração do Termo de Referência ou Projeto Básico;
• definição dos mecanismos de fiscalização;
• organização dos fluxos administrativos;
• definição das responsabilidades das unidades envolvidas;
• disponibilidade orçamentária;
• disponibilidade financeira;
• cronograma de implantação;
• compatibilização com contratos existentes;
• obtenção de licenças, autorizações ou documentos necessários;
• outras providências indispensáveis ao sucesso da contratação.

Explique tecnicamente por que cada providência é necessária para garantir a adequada execução contratual, a eficiência administrativa e a mitigação de riscos.
Caso não existam providências específicas, fundamente tecnicamente essa conclusão.
Produza texto completo, robusto e pronto para integrar o Estudo Técnico Preliminar.`,

  XI: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Contratações Correlatas e/ou Interdependentes" do Estudo Técnico Preliminar.

Objetivo do estudo
Analisar a existência de outras contratações que possuam relação técnica, operacional, logística, financeira ou funcional com o objeto pretendido, demonstrando eventual dependência entre elas ou a inexistência dessa relação.

Com base nas informações fornecidas pelo usuário, desenvolva um estudo contemplando, quando aplicável:
• contratos vigentes relacionados;
• futuras contratações necessárias;
• fornecimentos complementares;
• serviços acessórios;
• obras relacionadas;
• equipamentos compatíveis;
• sistemas integrados;
• contratos de manutenção;
• contratos de suporte;
• dependência operacional entre objetos;
• necessidade de integração entre soluções;
• riscos decorrentes da inexistência de contratações correlatas;
• independência da solução, quando for o caso.

Explique tecnicamente se a contratação depende da existência de outros contratos ou se possui autonomia operacional.
Caso não existam contratações correlatas ou interdependentes, justifique tecnicamente essa conclusão.
O texto deverá demonstrar análise efetiva da integração da contratação com os demais instrumentos administrativos do órgão.
Produza texto técnico, consistente e pronto para integrar o ETP.`,

  XII: `Você é especialista em sustentabilidade aplicada às contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Possíveis Impactos Ambientais" do Estudo Técnico Preliminar.

Objetivo do estudo
Analisar os possíveis impactos ambientais decorrentes da futura contratação, bem como as medidas destinadas à prevenção, mitigação ou compensação desses impactos, observando os princípios do desenvolvimento nacional sustentável.

Com base nas informações fornecidas pelo usuário, desenvolva estudo contemplando, quando aplicável:
• consumo de recursos naturais;
• eficiência energética;
• consumo de água;
• geração de resíduos;
• descarte de materiais;
• logística reversa;
• reciclagem;
• reutilização de materiais;
• redução de emissão de poluentes;
• redução da geração de resíduos sólidos;
• durabilidade dos materiais;
• utilização de produtos sustentáveis;
• certificações ambientais;
• conformidade com normas ambientais;
• mitigação dos impactos ambientais;
• boas práticas ambientais;
• responsabilidade socioambiental.

Sempre que houver possibilidade, demonstre que a contratação poderá contribuir para a adoção de práticas sustentáveis pela Administração Pública.
Caso a contratação não gere impactos ambientais relevantes, apresente fundamentação técnica que justifique essa conclusão.
Produza texto técnico, robusto, fundamentado e pronto para integrar o Estudo Técnico Preliminar.`,

  XIII: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, do planejamento das contratações públicas, da governança pública e das boas práticas adotadas pelos órgãos de controle.

Sua tarefa é elaborar exclusivamente o tópico "Posicionamento Conclusivo" do Estudo Técnico Preliminar.

Objetivo do estudo
Elaborar a conclusão técnica do Estudo Técnico Preliminar, consolidando todas as análises realizadas ao longo do documento e apresentando manifestação fundamentada acerca da viabilidade da contratação pretendida.

Com base exclusivamente nas informações fornecidas pelo usuário e nas conclusões dos demais tópicos do ETP, desenvolva um parecer técnico conclusivo que contemple, sempre que aplicável:
• confirmação da existência da necessidade administrativa;
• demonstração de que as alternativas disponíveis foram avaliadas;
• justificativa da solução escolhida;
• demonstração da viabilidade técnica;
• demonstração da viabilidade operacional;
• demonstração da viabilidade econômica;
• demonstração da compatibilidade com o interesse público;
• adequação ao planejamento institucional;
• atendimento aos princípios da eficiência, economicidade e vantajosidade;
• análise dos riscos remanescentes;
• confirmação de que os requisitos da contratação foram devidamente definidos;
• conclusão quanto à conveniência e oportunidade administrativa da contratação.

O texto deverá possuir estrutura semelhante a um parecer técnico, apresentando raciocínio lógico, linguagem formal, fundamentação consistente e conclusão objetiva.
Evite reproduzir literalmente os demais tópicos do ETP. Em vez disso, sintetize as conclusões alcançadas, demonstrando que os estudos realizados evidenciam a viabilidade da contratação.
Finalize com manifestação técnica clara indicando que, diante dos estudos desenvolvidos, conclui-se pela viabilidade da contratação pretendida, ressalvadas eventuais adequações decorrentes das fases subsequentes do planejamento e da instrução processual.
Produza texto completo, robusto, juridicamente consistente e pronto para integrar diretamente o Estudo Técnico Preliminar.`,
};

// Monta o bloco de dados do processo a partir do que já está cadastrado no ETP
function montarContextoParaPrompt(etp) {
  const itens = etp.itens || [];
  const valoresAdotados = etp.valoresAdotados || {};
  const partes = [];

  partes.push(`Objeto da contratação: ${objetoCompleto(etp) || "(não informado)"}`);
  partes.push(`Órgão/Secretaria: ${etp.meta.orgao || "(não informado)"}`);
  partes.push(`Unidade/setor demandante: ${etp.meta.setor || "(não informado)"}`);
  partes.push(`Tipo de objeto: ${etp.meta.tipo}`);

  if (itens.length > 0) {
    const linhasItens = itens.slice(0, 60).map(i => `- ${i.descricao}${i.quantidade ? ` (quantidade: ${i.quantidade} ${i.unidade || ""})` : ""}`).join("\n");
    partes.push(`Itens e quantidades levantados:\n${linhasItens}`);
  }

  if (etp.pca) {
    const encontrados = contarPrevistosNoPca(etp);
    partes.push(`Alinhamento ao Plano de Contratações Anual: ${encontrados} de ${itens.length} itens já constam previstos no PCA vigente.`);
  }

  const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
  if (fontesUsadas.length > 0) partes.push(`Levantamento de mercado: cotações coletadas junto a ${fontesUsadas.join(", ")}.`);

  const totalEstimado = itens.reduce((s, i) => s + num(i.quantidade) * num(valoresAdotados[i.id] || 0), 0);
  if (totalEstimado > 0) {
    const metodologia = etp.meta.metodologiaCalculo === "media" ? "média aritmética simples" : "mediana";
    partes.push(`Estimativa de valor: ${brl(totalEstimado)} (metodologia de cálculo: ${metodologia} por item).`);
  }

  if (etp.meta.prazoGarantiaDias?.trim()) partes.push(`Prazo de garantia exigido: ${formatarPrazo(etp.meta.prazoGarantiaDias, etp.meta.prazoGarantiaUnidade)}.`);
  if (etp.meta.prazoEntregaDias?.trim()) partes.push(`Prazo de entrega/execução exigido: ${formatarPrazo(etp.meta.prazoEntregaDias, etp.meta.prazoEntregaUnidade)}.`);

  if (etp.meta.parcelamento === "sim") partes.push("Parcelamento: a contratação será parcelada em itens/lotes.");
  else if (etp.meta.parcelamento === "nao") partes.push("Parcelamento: a contratação não será parcelada (lote único).");

  if (etp.meta.correlataExiste) {
    partes.push(`Contratações correlatas/interdependentes: ${etp.meta.correlataDescricao?.trim() || "há contratação relacionada, sem detalhamento adicional informado."}`);
  } else {
    partes.push("Contratações correlatas/interdependentes: não foram identificadas.");
  }

  if (etp.meta.impactoAmbientalRelevante) {
    partes.push(`Impactos ambientais: ${etp.meta.impactoAmbientalDescricao?.trim() || "há impacto relevante identificado, sem detalhamento adicional informado."}`);
  } else {
    partes.push("Impactos ambientais: não são esperados impactos ambientais significativos.");
  }

  if (etp.meta.metodologiaQuantidades) {
    partes.push(`Metodologia de levantamento das quantidades: ${etp.meta.detalhamentoQuantidades?.trim() || etp.meta.metodologiaQuantidades}.`);
  }

  if (etp.meta.fonteRecurso?.trim()) partes.push(`Fonte de recurso: ${etp.meta.fonteRecurso.trim()}.`);

  const solucoes = etp.solucoesMercado || [];
  if (solucoes.length > 0) {
    const escolhida = solucoes.find(s => s.selecionada);
    partes.push(`Soluções de mercado pesquisadas: ${solucoes.map(s => s.nome).join("; ")}.${escolhida ? ` Solução escolhida: ${escolhida.nome}.` : ""}`);
  }

  return partes.join("\n");
}

// Monta o contexto SÓ com os dados relevantes para o tópico solicitado — usado no modo "Por tópico",
// para não repetir a lista completa de itens e demais dados em todo prompt individual.
function montarContextoPorTopico(etp, sectionId) {
  const itens = etp.itens || [];
  const valoresAdotados = etp.valoresAdotados || {};
  const linhas = [];

  linhas.push(`Objeto da contratação: ${objetoCompleto(etp) || "(não informado)"}`);
  linhas.push(`Órgão/Secretaria: ${etp.meta.orgao || "(não informado)"}`);
  linhas.push(`Unidade/setor demandante: ${etp.meta.setor || "(não informado)"}`);
  linhas.push(`Tipo de objeto: ${etp.meta.tipo}`);

  const precisaListaItens = ["III", "IV", "V", "VI", "VII"].includes(sectionId);
  if (precisaListaItens && itens.length > 0) {
    const linhasItens = itens.slice(0, 60).map(i => `- ${i.descricao}${i.quantidade ? ` (quantidade: ${i.quantidade} ${i.unidade || ""})` : ""}`).join("\n");
    linhas.push(`Itens e quantidades levantados:\n${linhasItens}`);
  } else if (itens.length > 0) {
    linhas.push(`Quantidade de itens que compõem esta contratação: ${itens.length}.`);
  }

  if (sectionId === "II" && etp.pca) {
    const encontrados = contarPrevistosNoPca(etp);
    linhas.push(`Alinhamento ao Plano de Contratações Anual: ${encontrados} de ${itens.length} itens já constam previstos no PCA vigente (planilha "${etp.pca.nomeArquivo}").`);
  }

  if (["IV", "VI"].includes(sectionId)) {
    const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
    if (fontesUsadas.length > 0) linhas.push(`Levantamento de mercado: cotações coletadas junto a ${fontesUsadas.join(", ")}.`);
  }

  if (sectionId === "IV") {
    const solucoes = etp.solucoesMercado || [];
    if (solucoes.length > 0) {
      const escolhida = solucoes.find(s => s.selecionada);
      linhas.push(`Soluções de mercado pesquisadas: ${solucoes.map(s => s.nome).join("; ")}.${escolhida ? ` Solução escolhida: ${escolhida.nome}.` : ""}`);
    }
  }

  if (sectionId === "V" && etp.meta.metodologiaQuantidades) {
    linhas.push(`Metodologia de levantamento das quantidades: ${etp.meta.detalhamentoQuantidades?.trim() || etp.meta.metodologiaQuantidades}.`);
  }

  if (sectionId === "VI") {
    const totalEstimado = itens.reduce((s, i) => s + num(i.quantidade) * num(valoresAdotados[i.id] || 0), 0);
    if (totalEstimado > 0) {
      const metodologia = etp.meta.metodologiaCalculo === "media" ? "média aritmética simples" : "mediana";
      linhas.push(`Estimativa de valor: ${brl(totalEstimado)} (metodologia de cálculo: ${metodologia} por item).`);
    }
  }

  if (sectionId === "III") {
    if (etp.meta.prazoGarantiaDias?.trim()) linhas.push(`Prazo de garantia exigido: ${formatarPrazo(etp.meta.prazoGarantiaDias, etp.meta.prazoGarantiaUnidade)}.`);
    if (etp.meta.prazoEntregaDias?.trim()) linhas.push(`Prazo de entrega/execução exigido: ${formatarPrazo(etp.meta.prazoEntregaDias, etp.meta.prazoEntregaUnidade)}.`);
  }

  if (sectionId === "VII" && etp.meta.manutencaoContinuada) {
    linhas.push("Esta contratação exige manutenção, assistência técnica ou fornecimento continuado de peças.");
  }

  if (sectionId === "VIII") {
    if (etp.meta.parcelamento === "sim") linhas.push("Parcelamento: a contratação será parcelada em itens/lotes.");
    else if (etp.meta.parcelamento === "nao") linhas.push("Parcelamento: a contratação não será parcelada (lote único).");
  }

  if (sectionId === "X" && etp.meta.fonteRecurso?.trim()) {
    linhas.push(`Fonte de recurso: ${etp.meta.fonteRecurso.trim()}.`);
  }

  if (sectionId === "XI") {
    linhas.push(etp.meta.correlataExiste
      ? `Contratações correlatas/interdependentes: ${etp.meta.correlataDescricao?.trim() || "há contratação relacionada, sem detalhamento adicional informado."}`
      : "Contratações correlatas/interdependentes: não foram identificadas.");
  }

  if (sectionId === "XII") {
    linhas.push(etp.meta.impactoAmbientalRelevante
      ? `Impactos ambientais: ${etp.meta.impactoAmbientalDescricao?.trim() || "há impacto relevante identificado, sem detalhamento adicional informado."}`
      : "Impactos ambientais: não são esperados impactos ambientais significativos.");
  }

  if (sectionId === "XIII") {
    // Síntese breve do processo para embasar a conclusão, sem repetir listas completas
    const sintese = [];
    if (itens.length > 0) sintese.push(`${itens.length} item(ns) levantado(s)`);
    if (etp.pca) {
      const encontrados = contarPrevistosNoPca(etp);
      sintese.push(`${encontrados}/${itens.length} alinhados ao PCA`);
    }
    const totalEstimado = itens.reduce((s, i) => s + num(i.quantidade) * num(valoresAdotados[i.id] || 0), 0);
    if (totalEstimado > 0) sintese.push(`valor estimado de ${brl(totalEstimado)}`);
    if (sintese.length > 0) linhas.push(`Síntese do processo: ${sintese.join("; ")}.`);
  }

  return linhas.join("\n");
}

// Gera o prompt completo (instrução + dados do processo + tópico solicitado) pronto para copiar
// Gera o prompt de um único tópico — autocontido, com o "papel" específico daquele tópico e só
// os dados do processo relevantes a ele, para funcionar mesmo se copiado isoladamente, sem
// contexto de conversa anterior com a IA.
function gerarPromptIA(etp, sectionId) {
  const base = PROMPTS_POR_TOPICO[sectionId];
  const contexto = montarContextoPorTopico(etp, sectionId);
  return `${base}

DADOS DO PROCESSO (utilize exclusivamente estas informações; não invente dados que não constem aqui)
${contexto}`;
}

// Gera um único prompt pedindo os 13 tópicos de uma vez, cada um com sua instrução específica
function gerarPromptGeralIA(etp) {
  const contexto = montarContextoParaPrompt(etp);
  const blocos = SECOES.map(s => `### ${s.id} — ${s.titulo}\n${PROMPTS_POR_TOPICO[s.id]}`).join("\n\n");
  return `Elabore o Estudo Técnico Preliminar (ETP) completo, respondendo TODOS os 13 tópicos a seguir, na ordem apresentada. Para cada tópico, inicie a resposta exatamente com uma linha no formato "### [algarismo romano] — [título do tópico]" e, em seguida, escreva o texto correspondente, seguindo rigorosamente a instrução específica daquele tópico. Não pule nenhum tópico.

${blocos}

DADOS DO PROCESSO (utilize exclusivamente estas informações; não invente dados que não constem aqui)
${contexto}`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Converte o texto simples devolvido pelos modelos padrão (parágrafos separados por linha em
// branco, marcadores com "•") em HTML compatível com o editor formatado. Se o texto já vier em
// HTML (como os modelos que já geram <p>/<ul> diretamente), devolve sem alterações.
function textoParaHtml(texto) {
  if (!texto) return "";
  if (/^\s*<(p|ul|ol|h[1-6]|table|div)/i.test(texto)) return texto;
  const blocos = texto.split(/\n{2,}/);
  return blocos.map(bloco => {
    const linhas = bloco.split("\n").map(l => l.trim()).filter(Boolean);
    if (linhas.length > 0 && linhas.every(l => l.startsWith("•"))) {
      return "<ul>" + linhas.map(l => `<li>${escapeHtml(l.replace(/^•\s*/, ""))}</li>`).join("") + "</ul>";
    }
    return `<p>${escapeHtml(bloco.trim()).replace(/\n/g, "<br/>")}</p>`;
  }).join("\n");
}

// Gera um documento .doc (HTML compatível com o Word) editável, com o timbre no cabeçalho
// Documento avulso "Demonstração da Previsão da Contratação no PCA" — usa o cruzamento de itens já
// feito na ferramenta "Verificar PCA", independente de qualquer ETP específico.
// Documento avulso "Demonstração da Previsão da Contratação no PCA", em .docx nativo
async function gerarDocumentoPCAAvulso({ objeto, orgao, cabecalho, linhasTabela }) {
  const cab = await prepararCabecalho(cabecalho);
  const html = `
<h2 style="text-align:center">Demonstração da Previsão da Contratação no Plano de Contratações Anual</h2>
<p>A presente contratação, que visa à "${escapeHtml(objeto)}", destinados a atender às demandas da ${escapeHtml(orgao)}, encontra-se devidamente alinhada aos objetivos estratégicos da Administração Municipal.</p>
<p>O fornecimento desses itens é essencial para o adequado funcionamento das unidades administrativas e operacionais do Município, garantindo suporte às atividades institucionais desenvolvidas no âmbito da Prefeitura, bem como assegurando a continuidade e a eficiência dos serviços públicos prestados.</p>
<p>A demanda encontra-se regularmente prevista no Plano de Contratações Anual (PCA), conforme os sequenciais e respectivos IDs constantes na tabela a seguir, os quais identificam precisamente os itens a serem contratados:</p>
<table>
  <tr><th>Item</th><th>ID</th><th>Descrição</th><th>Sequencial do PCA</th></tr>
  ${linhasTabela}
</table>
<p>Dessa forma, resta evidenciado que a contratação encontra-se compatível com o planejamento anual das contratações, atendendo ao disposto no artigo 12 da Lei nº 14.133/2021, assegurando a adequada vinculação entre a demanda identificada, o Plano de Contratações Anual e a futura contratação.</p>
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center"><i>[DATADO E ASSINADO DIGITALMENTE]</i></p>`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `demonstracao_previsao_pca_${todayISO()}.docx`,
  });
}

// ---------- Justificativa de Aquisição (ferramenta avulsa) ----------
// Gera o texto padrão (HTML), no mesmo espírito dos "Usar modelo padrão (sem IA)" dos incisos do
// ETP — genérico, sem inventar dado que o servidor não informou, com lacuna em colchetes quando falta.
function gerarTextoPadraoJustificativa(dados) {
  const objeto = dados.objeto?.trim() || "[objeto da aquisição]";
  const unidadeBeneficiada = dados.unidadeBeneficiada?.trim() || "[unidade/programa beneficiado]";
  const processo = dados.processo?.trim();
  const orgao = dados.orgao?.trim() || "[órgão/secretaria]";
  const programas = (dados.programas || "").split("\n").map(p => p.trim()).filter(Boolean);
  const localEntrega = dados.localEntrega?.trim() || `sede da ${orgao}`;
  const horarioEntrega = dados.horarioEntrega?.trim() || "[horário de entrega]";
  const prazoPagamentoDias = dados.prazoPagamentoDias?.trim();

  const listaProgramas = programas.length > 0
    ? `<ul>${programas.map(p => `<li>${escapeHtml(p)}.</li>`).join("")}</ul>`
    : "";

  return `
<p>Justifica-se a aquisição de ${escapeHtml(objeto)}, visando atender as necessidades da ${escapeHtml(unidadeBeneficiada)}${processo ? `, conforme Processo nº. ${escapeHtml(processo)}` : ""}.</p>
<p>A aquisição de ${escapeHtml(objeto)} atenderá as necessidades dos Programas vinculados à ${escapeHtml(orgao)};</p>
${listaProgramas}
<p>Os quantitativos foram baseados no levantamento das solicitações ocorridas nos últimos meses para suprir quaisquer outras necessidades que venham surgir.</p>
<p>A entrega deverá ocorrer na ${escapeHtml(localEntrega)} nos horários compreendidos entre ${escapeHtml(horarioEntrega)}. É importante que se destaque que nossa Secretaria possui almoxarifado próprio, com capacidade para armazenar adequadamente as mercadorias estocáveis dessa licitação.</p>
<p>O pagamento será efetuado em até ${prazoPagamentoDias ? escapeHtml(prazoPagamentoDias) : "[prazo]"} dias, após a emissão da nota fiscal de acordo com a autorização de entrega emitida pela ${escapeHtml(orgao)}.</p>
<p>Diante da necessidade, vislumbrando em não acarretar prejuízos ao desempenho e qualidade das atividades prestadas e mantidas pela ${escapeHtml(orgao)}, é que a administração pública toma a iniciativa de realizar o processo de aquisição.</p>
`.trim();
}

// Exporta a Justificativa como .doc, com timbre e assinatura, no mesmo padrão dos demais documentos
// Justificativa de Aquisição em .docx nativo
async function gerarDocumentoJustificativaWord({ conteudoHtml, cabecalho }) {
  const cab = await prepararCabecalho(cabecalho);
  const html = `
<h2 style="text-align:center">Justificativa</h2>
${conteudoHtml}
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center">Atenciosamente,</p>
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center"><i>[DATADO E ASSINADO DIGITALMENTE]</i></p>`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `justificativa_aquisicao_${todayISO()}.docx`,
  });
}

// Estudo Técnico Preliminar completo, em .docx nativo
async function gerarDocumentoWord(etp, cabecalho) {
  const cab = await prepararCabecalho(cabecalho);
  const itens = etp.itens || [];
  const pca = etp.pca;
  const responsaveis = listaResponsaveis(etp);
  const resumoResponsaveis = responsaveis.length > 0
    ? responsaveis.map(r => r.nome + (r.cargo ? ` (${r.cargo})` : "")).join("; ")
    : "-";

  const linhasItens = itens.map((it, idx) =>
    `<tr><td>${idx + 1}</td><td>${escapeHtml(it.descricao || "-")}</td><td>${escapeHtml(it.unidade || "")}</td><td>${escapeHtml(String(it.quantidade || "-"))}</td></tr>`
  ).join("");

  const quadroQuantitativos = itens.length > 0
    ? `<h3>Quadro de quantitativos</h3><table><tr><th>Item</th><th>Descrição</th><th>Und.</th><th>Qtd.</th></tr>${linhasItens}</table>`
    : "";

  const linhasPca = pca ? cruzarComPca(itens, pca, etp.manuaisPca).map((m, idx) =>
    `<tr><td>${idx + 1}</td><td>${escapeHtml(m.item.descricao || "-")}</td><td>${m.previsto ? "Sim" : "Não"}</td><td>${escapeHtml(m.sequencial || "—")}</td></tr>`
  ).join("") : "";

  const relatorioEstimativa = gerarRelatorioEstimativaHtml(etp);

  const secoesHtml = secoesParaRelatorio(etp).map(s => `
    <h2 style="text-align:center">${s.numero} — ${escapeHtml(s.titulo)}</h2>
    ${etp.sections[s.id]}
    ${s.id === "II" && pca ? `<h3>Quadro de alinhamento ao PCA</h3><table><tr><th>Item</th><th>Descrição</th><th>Consta no PCA?</th><th>Sequencial</th></tr>${linhasPca}</table>` : ""}
    ${s.id === "V" ? quadroQuantitativos : ""}
    ${s.id === "VI" ? relatorioEstimativa : ""}
  `).join("");

  const assinaturas = responsaveis.length > 0
    ? responsaveis.map(r =>
        `<p style="text-align:center">&nbsp;</p>
         <p style="text-align:center">_______________________________________</p>
         <p style="text-align:center"><b>${escapeHtml(r.nome)}</b></p>
         ${r.cargo ? `<p style="text-align:center">${escapeHtml(r.cargo)}</p>` : ""}`).join("")
    : `<p style="text-align:center">&nbsp;</p>
       <p style="text-align:center">_______________________________________</p>
       <p style="text-align:center"><b>[Responsável técnico]</b></p>`;

  const html = `
<h1 style="text-align:center">ESTUDO TÉCNICO PRELIMINAR</h1>
<p style="text-align:center"><i>Lei nº 14.133/2021 · art. 18</i></p>
<table>
  <tr><td><b>Objeto</b></td><td>${escapeHtml(objetoCompleto(etp) || "-")}</td></tr>
  <tr><td><b>Órgão</b></td><td>${escapeHtml(etp.meta.orgao || "-")}</td></tr>
  <tr><td><b>Setor</b></td><td>${escapeHtml(etp.meta.setor || "-")}</td></tr>
  <tr><td><b>Responsável</b></td><td>${escapeHtml(resumoResponsaveis)}</td></tr>
  <tr><td><b>Processo</b></td><td>${escapeHtml(etp.meta.processo || "-")}</td></tr>
  <tr><td><b>Data</b></td><td>${fmtDateISO(etp.meta.data) || fmtDate(Date.now())}</td></tr>
</table>
${etp.meta.introducao?.trim() ? `<h2 style="text-align:center">Introdução</h2><p>${escapeHtml(etp.meta.introducao).replace(/\n/g, "<br/>")}</p>` : ""}
${secoesHtml}
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center">${escapeHtml(linhaAssinaturaData(etp))}</p>
${assinaturas}`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `ETP_${(etp.meta.processo || todayISO()).replace(/[^\w-]/g, "_")}.docx`,
  });
}

// Estatísticas de uma lista de cotações (art. 23, §1º, II da Lei 14.133/2021)
function statsFor(quotes) {
  const vals = (quotes || []).map(q => num(q.valor)).filter(v => v > 0).sort((a, b) => a - b);
  if (vals.length === 0) return { media: 0, mediana: 0, min: 0, max: 0, n: 0 };
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const mid = Math.floor(vals.length / 2);
  const mediana = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  return { media, mediana, min: vals[0], max: vals[vals.length - 1], n: vals.length };
}

// Quadro comprobatório da estimativa de valor: por item, reúne as cotações coletadas (fonte,
// fornecedor, valor), a média e a mediana apuradas, e o valor unitário efetivamente adotado —
// tudo num único quadro, para demonstrar de forma clara e completa como cada valor foi apurado.
// HTML autocontido (estilos inline), usado tanto no Word quanto na Pré-visualização/impressão.
function gerarRelatorioEstimativaHtml(etp) {
  const itens = etp.itens || [];
  const valoresAdotados = etp.valoresAdotados || {};
  const cotacoes = etp.cotacoes || {};
  const temAlgumDado = itens.some(it => (cotacoes[it.id] || []).length > 0 || valoresAdotados[it.id]);
  if (!temAlgumDado) return "";

  const th = 'style="border:1px solid #999;padding:5px 7px;background:#eee;text-align:left;font-size:9.5pt;"';
  const td = 'style="border:1px solid #999;padding:5px 7px;text-align:left;font-size:9.5pt;vertical-align:top;"';
  const usaMedia = etp.meta.metodologiaCalculo === "media";
  const metodologia = usaMedia ? "média aritmética simples" : "mediana";
  const labelReferencia = usaMedia ? "Média" : "Mediana";

  const linhas = itens.map((it, idx) => {
    const quotes = cotacoes[it.id] || [];
    const stats = statsFor(quotes);
    const valorReferencia = usaMedia ? stats.media : stats.mediana;
    const cotacoesTexto = quotes.length > 0
      ? quotes.map(q => `${escapeHtml(q.fonte || "-")}${q.empresa ? ` (${escapeHtml(q.empresa)})` : ""}: <b>${brl(num(q.valor))}</b>`).join("<br/>")
      : "—";
    const total = stats.n > 0 ? num(it.quantidade) * valorReferencia : 0;
    return `<tr>
      <td ${td}>${idx + 1}</td>
      <td ${td}>${escapeHtml(it.descricao || "-")}</td>
      <td ${td}>${escapeHtml(String(it.quantidade || "-"))} ${escapeHtml(it.unidade || "")}</td>
      <td ${td}>${cotacoesTexto}</td>
      <td ${td}><b>${stats.n > 0 ? brl(valorReferencia) : "—"}</b></td>
      <td ${td}>${stats.n > 0 ? brl(total) : "—"}</td>
    </tr>`;
  }).join("");

  const totalGeral = itens.reduce((s, it) => {
    const stats = statsFor(cotacoes[it.id] || []);
    const valorReferencia = usaMedia ? stats.media : stats.mediana;
    return s + (stats.n > 0 ? num(it.quantidade) * valorReferencia : 0);
  }, 0);

  return `
<h3>Quadro comprobatório da estimativa de valor</h3>
<p style="font-size:9.5pt;">Demonstra, item a item, as cotações coletadas por fonte/fornecedor e o valor unitário de referência apurado — metodologia de cálculo adotada nesta contratação: ${metodologia}.</p>
<table style="border-collapse:collapse;width:100%;margin-bottom:8pt;">
<tr>
  <th ${th}>Item</th><th ${th}>Descrição</th><th ${th}>Qtd.</th><th ${th}>Cotações coletadas</th>
  <th ${th}>${labelReferencia}</th><th ${th}>Valor Total</th>
</tr>
${linhas}
<tr><td colspan="5" style="border:1px solid #999;padding:5px 7px;text-align:right;font-size:9.5pt;"><b>Valor total estimado da contratação</b></td><td ${td}><b>${brl(totalGeral)}</b></td></tr>
</table>
<p style="font-size:9pt;">Cotações detalhadas conforme documentos anexos ao processo.</p>
`.trim();
}



// Modelo padrão do inciso II (alinhamento ao PCA), sem chamada de IA — usa o resultado do cruzamento
// já feito na etapa "2. Alinhamento ao PCA" (mesmos dados, nenhuma nova ingestão).
function gerarTextoPadraoII(etp) {
  const itens = etp.itens || [];
  if (!etp.pca || itens.length === 0) return "";

  const encontrados = contarPrevistosNoPca(etp);
  const total = itens.length;
  const dataImportacao = fmtDate(etp.pca.importedAt);

  let texto = `A presente contratação foi confrontada com o Plano de Contratações Anual (PCA) vigente, a partir da planilha "${etp.pca.nomeArquivo}" (extraída do painel do PCA em ${dataImportacao}). `;

  if (encontrados === total) {
    texto += `Da comparação, verificou-se que a totalidade dos ${total} item(ns) que compõem esta aquisição já consta prevista no PCA, conforme demonstrado no quadro de alinhamento apresentado a seguir.`;
  } else if (encontrados > 0) {
    texto += `Da comparação, verificou-se que ${encontrados} de ${total} item(ns) que compõem esta aquisição já constam previstos no PCA, conforme demonstrado no quadro de alinhamento apresentado a seguir. Os demais ${total - encontrados} item(ns) ainda não constam expressamente no plano vigente, devendo ser objeto de inclusão ou atualização do planejamento, ou de justificativa fundamentada para a exceção, previamente à formalização da contratação, nos termos do art. 12, VII, da Lei nº 14.133/2021.`;
  } else {
    texto += `Da comparação, não foram localizados registros correspondentes aos itens desta aquisição no PCA vigente, conforme demonstrado no quadro de alinhamento apresentado a seguir, devendo ser providenciada a inclusão ou atualização do planejamento, ou apresentada justificativa fundamentada para a exceção, previamente à formalização da contratação, nos termos do art. 12, VII, da Lei nº 14.133/2021.`;
  }

  return texto;
}

// Modelo padrão do inciso VI (metodologia de levantamento de preços), sem chamada de IA —
// texto fixo com lacunas preenchidas automaticamente a partir dos dados já cadastrados no ETP.
// Pode ser reaproveitado em qualquer aquisição; o servidor ajusta manualmente o que for específico do caso.
function gerarTextoPadraoVI(etp) {
  const bem = bemOuServicoDe(etp);
  const itemPalavra = bem === "serviços" ? "serviços" : "itens";
  const metodologia = etp.meta.metodologiaCalculo === "media" ? "média aritmética simples" : "mediana";
  const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
  const fontesTexto = fontesUsadas.length > 0 ? fontesUsadas.join(", ") : "";

  return `
<p>Apresenta-se, neste item, o levantamento e a estimativa de custos para a ${verboDe(etp)} dos ${bem} elencados, com o objetivo de fornecer uma projeção financeira detalhada, embasando a gestão eficiente dos recursos públicos vinculados.</p>
<p>Considerando a especificidade dos ${itemPalavra}, procedeu-se à coleta de cotações junto a fornecedores do segmento${fontesTexto ? `, por meio de ${escapeHtml(fontesTexto)}` : ""}.</p>
<p>Os valores levantados por fornecedor, bem como a ${metodologia} apurada para cada item, constam no quadro de estimativa de valores apresentado a seguir, elaborado a partir do levantamento de preços registrado na etapa "4. Levantamento de Preços" deste Estudo Técnico Preliminar.</p>
<p><b>Metodologia de Cálculo:</b></p>
<p>Neste Estudo Técnico Preliminar (ETP), adotou-se a ${metodologia} como método principal de estimativa de valor por item, por refletir de forma clara e objetiva os preços atualmente praticados no mercado, promovendo equilíbrio entre economicidade e exequibilidade da futura contratação.</p>
`.trim();
}

// Helper comum: "bens" ou "serviços", conforme o tipo de objeto do ETP
// Formata um prazo com a unidade escolhida (dias/meses/anos), com plural correto — ex.: "1 mês", "12 meses"
function formatarPrazo(valor, unidade) {
  const v = String(valor ?? "").trim();
  if (!v) return "";
  const n = num(v);
  const singular = { dias: "dia", meses: "mês", anos: "ano" }[unidade] || "dia";
  const plural = { dias: "dias", meses: "meses", anos: "anos" }[unidade] || "dias";
  return `${v} ${n === 1 ? singular : plural}`;
}

function bemOuServicoDe(etp) {
  return etp.meta.tipo === "Serviços comuns" || etp.meta.tipo === "Serviços de TI" ? "serviços" : "bens";
}
function verboDe(etp) {
  return bemOuServicoDe(etp) === "serviços" ? "contratação" : "aquisição";
}

// ---------- Modelos padrão dos demais incisos — mesmo princípio do II/VI: texto fixo,
// sem chamada de IA, com lacunas preenchidas a partir dos dados já cadastrados no ETP. ----------

function gerarTextoPadraoI(etp) {
  const entidade = etp.meta.orgao?.trim() || "[órgão]";
  const setor = etp.meta.setor?.trim() || "[setor requisitante]";
  const bem = bemOuServicoDe(etp);
  return `A ${entidade}, por meio do(a) ${setor}, identificou a necessidade de ${verboDe(etp)} dos ${bem} relacionados na Planilha de Itens que integra este Estudo Técnico Preliminar, indispensáveis à continuidade e ao adequado desempenho das atividades institucionais.

[Complete aqui a justificativa concreta da necessidade: qual carência específica motiva esta contratação, quais atividades ou serviços dependem dela, e o que ocorreria caso a contratação não fosse realizada. Esta é a única seção que exige redação própria do servidor responsável, por tratar-se da motivação específica do caso concreto.]

A não realização desta ${verboDe(etp)} comprometeria a regularidade e a qualidade dos serviços prestados por ${entidade}, justificando-se, portanto, a presente contratação como medida necessária ao atendimento do interesse público.`;
}

function gerarTextoPadraoIII(etp) {
  const bem = bemOuServicoDe(etp);
  const garantia = etp.meta.prazoGarantiaDias?.trim() ? formatarPrazo(etp.meta.prazoGarantiaDias, etp.meta.prazoGarantiaUnidade) : "12 (doze) meses, ou a estipulada no próprio item";
  const entrega = etp.meta.prazoEntregaDias?.trim() ? formatarPrazo(etp.meta.prazoEntregaDias, etp.meta.prazoEntregaUnidade) : "90 (noventa) dias";
  const local = etp.meta.local?.trim() || "[cidade/região da execução do contrato]";
  const entidade = etp.meta.orgao?.trim() || "[órgão/entidade beneficiária]";
  const condicaoEntrega = etp.meta.parcelamento === "sim"
    ? "de forma parcelada, conforme os itens/lotes definidos no inciso VIII deste Estudo"
    : "de forma única e integral, em uma só remessa";

  return `A definição dos requisitos necessários e suficientes para a escolha da solução de ${bem === "serviços" ? "contratação" : "aquisição"} é fundamental para atender à demanda de forma eficaz, segura e vantajosa para a Administração e para a entidade beneficiária.

Os seguintes parâmetros, exigências e referências são elencados, dentre outros aplicáveis ao caso concreto, para garantir a seleção da proposta mais vantajosa:

• Padrões Mínimos de Qualidade: todos os ${bem} devem atender a normas técnicas e padrões de qualidade reconhecidos, com fabricação recente, em perfeitas condições de uso e com durabilidade e eficiência compatíveis com o uso institucional pretendido;
• Especificações Técnicas: cada item deverá atender às especificações técnicas mínimas descritas na Planilha de Itens que integra este Estudo Técnico Preliminar, incluindo capacidade, potência, funcionalidade, acabamento, eficiência energética e demais atributos que garantam funcionalidade e segurança no uso cotidiano;
• Condições de Entrega: os itens deverão ser entregues ${condicaoEntrega}, devidamente embalados, com todos os manuais, acessórios e itens obrigatórios (cabos, suportes, controles etc., quando aplicável), no local indicado pela Administração, no prazo máximo de ${entrega} contados da emissão da ordem de fornecimento ou serviço;
• Certificações e Normas Técnicas Aplicáveis: os itens devem possuir, quando aplicável, certificações de conformidade emitidas por órgãos reguladores como o INMETRO ou equivalente, além de atender às normas da ABNT e demais regulamentações técnicas específicas vigentes para cada tipo de item;
• Licenças e Regularidade da Empresa Fornecedora: a empresa contratada deve comprovar regularidade junto aos órgãos competentes e possuir autorização legal para comercialização ou prestação dos itens ofertados, garantindo que a contratação seja realizada com empresa idônea e devidamente habilitada;
• Critérios de Sustentabilidade: considerando a responsabilidade socioambiental da Administração, serão priorizadas, sempre que possível, propostas de fornecedores que demonstrem compromisso com práticas sustentáveis, incluindo, quando aplicável, equipamentos com selo Procel de eficiência energética e processos de produção e descarte de menor impacto ambiental;
• Garantia e Assistência Técnica: os itens deverão contar com garantia mínima de ${garantia}, contra defeitos de fabricação, e a empresa fornecedora deverá garantir suporte técnico e assistência autorizada ou credenciada em ${local} ou região próxima, assegurando manutenção e eventuais reparos dentro do prazo contratual;
• Formalização de Instrumento Contratual: em razão do valor estimado da contratação e da diversidade dos itens a serem adquiridos, poderá ser exigida a formalização de instrumento contratual específico, nos termos do art. 95, §1º, da Lei nº 14.133/2021, como meio de assegurar a adequada execução, o cumprimento de prazos e obrigações, e a segurança jurídica do processo.

Considerando a natureza desta ${verboDe(etp)}, os itens deverão ser entregues ${condicaoEntrega}, a fim de garantir a continuidade e o pleno funcionamento das atividades desenvolvidas por ${entidade}.`;
}

function gerarTextoPadraoIV(etp) {
  const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
  const fontesTexto = fontesUsadas.length > 0 ? fontesUsadas.join(", ") : "Banco de Preços, pesquisa direta com fornecedores e demais fontes públicas disponíveis";
  const bem = bemOuServicoDe(etp);
  const entidade = etp.meta.orgao?.trim() || "[órgão/entidade beneficiária]";
  const solucoes = etp.solucoesMercado || [];
  const escolhida = solucoes.find(s => s.selecionada);
  const naoEscolhidas = solucoes.filter(s => !s.selecionada);

  let blocoAlternativas;
  if (solucoes.length > 0) {
    blocoAlternativas = `No processo de avaliação, foram levantadas ${solucoes.length} solução(ões) de mercado para atender à necessidade identificada no inciso I:\n` +
      solucoes.map(s => `• ${s.nome}${s.selecionada ? " — SOLUÇÃO ESCOLHIDA" : ""};`).join("\n") +
      (escolhida
        ? `\n\nEntre as soluções pesquisadas, optou-se por "${escolhida.nome}", por representar, entre as alternativas relacionadas${naoEscolhidas.length > 0 ? " — as demais descartadas por não atenderem tão adequadamente à relação entre custo, qualidade e adequação à necessidade concreta —" : ""}, a que melhor atende à relação entre custo, qualidade e adequação à necessidade identificada no inciso I.`
        : `\n\n[Marque, na lista de soluções acima, qual delas foi escolhida — o texto se completa sozinho.]`);
  } else {
    blocoAlternativas = `No processo de avaliação, as alternativas abaixo foram analisadas, porém não foram consideradas adequadas frente à necessidade concreta de ${entidade}:
• Locação de equipamentos: opção descartada em razão da natureza da fonte de recurso — quando voltada exclusivamente para aquisição definitiva — e da ausência de economicidade a longo prazo, considerando que a locação demandaria custos recorrentes, sem incorporação patrimonial para a entidade executora das ações;
• Aproveitamento de equipamentos existentes: os poucos equipamentos atualmente disponíveis se encontram em estado de obsolescência ou com desempenho insuficiente, sendo incompatíveis com as demandas operacionais e com os parâmetros de eficiência e segurança exigidos;
• Aquisição de itens com menor capacidade técnica ou de uso residencial: descartada por não atenderem às exigências institucionais de uso contínuo, coletivo e intensivo, o que comprometeria a durabilidade e a eficácia dos serviços prestados.

Optou-se pela solução de mercado descrita neste Estudo Técnico Preliminar por representar, entre as alternativas pesquisadas, a que melhor atende à relação entre custo, qualidade e adequação à necessidade identificada no inciso I.

Dica: cadastre as soluções realmente pesquisadas no quadro acima (podem ser 3, 4, 5 ou mais) e marque a escolhida, que este texto se adapta automaticamente a elas.`;
  }

  return `O levantamento de mercado realizado identificou fornecedores e prestadores capazes de atender às especificações constantes da Planilha de Itens deste Estudo Técnico Preliminar, mediante consulta a ${fontesTexto}, cujos resultados fundamentam a estimativa de valor apresentada no inciso VI.

A pesquisa considerou a disponibilidade de mercado, a existência de padrão usual de especificação para os ${bem} pretendidos e a viabilidade de definição objetiva do objeto no instrumento convocatório, nos termos do art. 6º, XLI, e do art. 29 da Lei nº 14.133/2021.

${blocoAlternativas}`;
}

function gerarTextoPadraoV(etp) {
  const itens = etp.itens || [];
  const metodo = etp.meta.metodologiaQuantidades;
  const detalhamento = etp.meta.detalhamentoQuantidades?.trim();

  const basesMetodologicas = {
    historico: "no histórico de consumo ou utilização registrado pela unidade requisitante",
    beneficiarios: "no número de beneficiários ou atendimentos realizados pela unidade, aplicado a um parâmetro técnico de consumo por pessoa/atendimento",
    parametro: "em parâmetro técnico ou normativo aplicável à natureza do objeto",
    substituicao: "na necessidade de substituição de itens que atingiram o fim de sua vida útil ou se encontram em condições inadequadas de uso",
    comparacao: "em comparação com unidades ou órgãos de porte e natureza semelhantes",
  };

  let paragrafoMetodologia;
  if (metodo === "outro" && detalhamento) {
    paragrafoMetodologia = `<p>${escapeHtml(detalhamento)}</p>`;
  } else if (metodo && basesMetodologicas[metodo]) {
    paragrafoMetodologia = `<p>O levantamento quantitativo foi realizado com base ${basesMetodologicas[metodo]}${detalhamento ? `. Especificamente, ${escapeHtml(detalhamento)}` : ""}, observando-se critérios de economicidade e adequação à real necessidade da contratação, sem prejuízo de eventual repactuação em caso de alteração superveniente da demanda.</p>`;
  } else {
    paragrafoMetodologia = `<p>A definição dos quantitativos considerou a demanda identificada pelo setor requisitante, observando-se critérios de economicidade e adequação à real necessidade da contratação, sem prejuízo de eventual repactuação em caso de alteração superveniente da demanda. [Detalhe a metodologia de levantamento — histórico de consumo, número de beneficiários, parâmetro técnico etc. — no campo correspondente em Dados do Processo, que este texto se completa sozinho.]</p>`;
  }

  return `<p>As quantidades estimadas para cada item constam da Planilha de Itens que integra este Estudo Técnico Preliminar, sintetizadas no quadro de quantitativos apresentado a seguir, totalizando ${itens.length} item(ns).</p>
${paragrafoMetodologia}`;
}

function gerarTextoPadraoVII(etp) {
  const itens = etp.itens || [];
  const classificacoes = [...new Set(itens.map(i => i.classificacao).filter(Boolean))];
  const bem = bemOuServicoDe(etp);
  const paragrafoManutencao = etp.meta.manutencaoContinuada
    ? `Esta contratação inclui exigência de manutenção, assistência técnica ou fornecimento continuado de peças, cujas condições específicas estão detalhadas nos requisitos técnicos constantes do inciso III deste Estudo.`
    : `Ressalvado o disposto em instrumento contratual específico, esta contratação não inclui, por si só, exigências de manutenção continuada, assistência técnica ou fornecimento de peças além da garantia legal e contratual aplicável aos ${bem} adquiridos.`;
  return `A solução consiste na ${verboDe(etp)} de ${itens.length} item(ns) descrito(s) na Planilha de Itens que integra este Estudo Técnico Preliminar${classificacoes.length ? `, compreendendo ${classificacoes.join(", ").toLowerCase()}` : ""}.

A entrega/execução será realizada em conformidade com o critério de parcelamento definido no inciso VIII deste Estudo, observadas as especificações técnicas de cada item.

${paragrafoManutencao}`;
}

function gerarTextoPadraoVIII(etp) {
  if (etp.meta.parcelamento === "nao") {
    return `Considerando a natureza e as características dos itens que compõem esta aquisição, a contratação não será dividida em itens ou lotes distintos, sendo processada como lote único.

Essa opção se justifica pela busca de economia de escala na aquisição, pela unidade técnica e funcional do objeto, e pela ausência de prejuízo à competitividade do certame, nos termos do art. 40, V, "b", da Lei nº 14.133/2021. O fracionamento da contratação, no caso concreto, não traria ganho de competitividade relevante que justificasse a perda de economia de escala e a maior complexidade de gestão contratual decorrente de múltiplos fornecedores.`;
  }
  if (etp.meta.parcelamento === "sim") {
    return `Considerando a natureza e as características dos itens que compõem esta aquisição, a contratação será dividida em itens/lotes distintos.

Essa opção se justifica pela viabilidade técnica e econômica de fornecimento por diferentes fornecedores, o que amplia a competitividade do certame sem perda relevante de economia de escala, nos termos do art. 40, V, "b", da Lei nº 14.133/2021. A divisão observa a natureza heterogênea e/ou a origem diversa dos itens relacionados na Planilha de Itens deste Estudo, sem comprometer a qualidade técnica da execução.`;
  }
  return `Considerando a natureza e as características dos itens que compõem esta aquisição, [a contratação NÃO será dividida em itens/lotes — opção recomendada quando há economia de escala relevante e unidade técnica do objeto / a contratação SERÁ dividida em itens/lotes distintos — opção recomendada quando há viabilidade de fornecimento por múltiplos fornecedores sem perda de economia de escala].

[Complete com a justificativa aplicável ao caso concreto, considerando: economia de escala; unidade técnica ou funcional do objeto; viabilidade técnica e econômica de fornecimento por diferentes fornecedores; eventual risco de fracionamento indevido da despesa, entre outros aspectos pertinentes, nos termos do art. 40, V, "b", da Lei nº 14.133/2021.]

Dica: defina isso rapidamente no campo "Parcelamento" em Dados do Processo, e este texto se completa sozinho.`;
}

function gerarTextoPadraoIX(etp) {
  const entidade = etp.meta.orgao?.trim() || "[órgão]";
  return `Com a presente contratação, a Administração busca obter, direta e indiretamente, os seguintes resultados: (i) atendimento à necessidade identificada no inciso I deste Estudo Técnico Preliminar, com a disponibilização, em tempo hábil, dos itens necessários ao pleno funcionamento das atividades de ${entidade}; (ii) modernização e padronização dos bens/serviços utilizados, com reflexo positivo na qualidade e na continuidade dos serviços prestados; (iii) uso eficiente dos recursos públicos, mediante planejamento adequado da contratação; (iv) fortalecimento da transparência e da economicidade na gestão dos recursos destinados a ${entidade}.`;
}

function gerarTextoPadraoX(etp) {
  return `Previamente à celebração do contrato, a Administração deverá adotar as seguintes providências: (i) confirmação da disponibilidade orçamentária e financeira para a despesa, nos termos do art. 18, §1º, VI, c/c art. 7º, III, da Lei nº 14.133/2021; (ii) verificação da adequação do espaço físico e das condições de recebimento dos itens, quando aplicável; (iii) designação do(s) servidor(es) responsável(is) pelo recebimento provisório e definitivo, nos termos dos arts. 140 e seguintes da Lei nº 14.133/2021; (iv) demais atos de instrução processual exigidos para a formalização da contratação.`;
}

function gerarTextoPadraoXI(etp) {
  if (etp.meta.correlataExiste && etp.meta.correlataDescricao?.trim()) {
    return `Foi identificada contratação correlata ou interdependente relacionada ao objeto desta contratação: ${etp.meta.correlataDescricao.trim()}.

A execução do objeto deste Estudo Técnico Preliminar deverá ser articulada com a contratação relacionada acima, de modo a garantir a compatibilidade de prazos e a continuidade das ações envolvidas.`;
  }
  return `Não foram identificadas contratações correlatas ou interdependentes que condicionem a execução do objeto desta contratação.

[Caso exista alguma contratação relacionada — por exemplo, obra, serviço de instalação, ou outro fornecimento do qual esta aquisição dependa ou que dependa dela —, marque o campo correspondente em Dados do Processo e descreva-a lá, que este texto se completa sozinho.]`;
}

function gerarTextoPadraoXII(etp) {
  const bem = bemOuServicoDe(etp);
  if (etp.meta.impactoAmbientalRelevante && etp.meta.impactoAmbientalDescricao?.trim()) {
    return `Considerando a natureza dos ${bem} objeto desta contratação, foi identificado o seguinte impacto ambiental a ser considerado: ${etp.meta.impactoAmbientalDescricao.trim()}.

A Administração observará, no que couber, critérios de sustentabilidade previstos no art. 25, §1º, da Lei nº 14.133/2021, adotando as medidas de mitigação cabíveis para minimizar o impacto identificado.`;
  }
  return `Considerando a natureza dos ${bem} objeto desta contratação, não são esperados impactos ambientais significativos decorrentes de sua aquisição ou execução.

Ainda assim, a Administração observará, no que couber, critérios de sustentabilidade previstos no art. 25, §1º, da Lei nº 14.133/2021, priorizando produtos e embalagens de menor impacto ambiental, bem como a destinação adequada de resíduos e embalagens, quando aplicável.`;
}

function gerarTextoPadraoXIII(etp) {
  const entidade = etp.meta.orgao?.trim() || "[órgão]";
  return `Diante do exposto, com base nos elementos técnicos, jurídicos e econômicos reunidos neste Estudo Técnico Preliminar — descrição da necessidade, alinhamento ao Plano de Contratações Anual, levantamento de mercado, estimativas de quantidade e de valor, análise de alternativas e demais aspectos abordados —, conclui-se pela viabilidade técnica e econômica desta contratação, por se tratar de solução adequada, vantajosa e compatível com o interesse público e com a necessidade identificada por ${entidade}.`;
}

// Mapa central: cada inciso aponta para sua função de modelo padrão (todas gratuitas, sem IA)
const MODELOS_PADRAO = {
  I: gerarTextoPadraoI,
  II: gerarTextoPadraoII,
  III: gerarTextoPadraoIII,
  IV: gerarTextoPadraoIV,
  V: gerarTextoPadraoV,
  VI: gerarTextoPadraoVI,
  VII: gerarTextoPadraoVII,
  VIII: gerarTextoPadraoVIII,
  IX: gerarTextoPadraoIX,
  X: gerarTextoPadraoX,
  XI: gerarTextoPadraoXI,
  XII: gerarTextoPadraoXII,
  XIII: gerarTextoPadraoXIII,
};

// ---------- App ----------
export default function App({ emailUsuario = null }) {
  const [view, setView] = useState("list"); // list | editor | preview | justificativa | declaracao
  const [etps, setEtps] = useState([]);
  const [justificativas, setJustificativas] = useState([]);
  const [declaracoes, setDeclaracoes] = useState([]);
  const [secretarias, setSecretarias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [normativos, setNormativos] = useState([]);
  const [lixeira, setLixeira] = useState([]);
  const [secretariaAtiva, setSecretariaAtiva] = useState("todas"); // "todas" | id
  const [currentJust, setCurrentJust] = useState(null);
  const [currentDecl, setCurrentDecl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [activeSection, setActiveSection] = useState("itens");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [search, setSearch] = useState("");
  const saveTimer = useRef(null);

  // Carrega uma coleção inteira a partir do prefixo da chave (mesmo mecanismo dos ETPs)
  const carregarColecao = useCallback(async (prefixo) => {
    const itens = [];
    try {
      const keys = await storage.list(prefixo, false);
      if (keys?.keys?.length) {
        for (const k of keys.keys) {
          try {
            const r = await storage.get(k, false);
            if (r?.value) itens.push(JSON.parse(r.value));
          } catch (e) { /* registro ausente, ignora */ }
        }
      }
    } catch (e) {
      console.error("Erro ao carregar " + prefixo, e);
    }
    itens.sort((a, b) => b.updatedAt - a.updatedAt);
    return itens;
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    const [listaEtps, listaJust, listaDecl, listaSec, listaUsr, listaNormas, listaLixo] = await Promise.all([
      carregarColecao("etp:"),
      carregarColecao("just:"),
      carregarColecao("decl:"),
      carregarColecao("sec:"),
      carregarColecao("usr:"),
      carregarColecao("norma:"),
      carregarColecao(PREFIXO_LIXO),
    ]);

    // Primeiro acesso: cria a secretaria padrão para que todo documento tenha onde se apoiar.
    // Documentos antigos, sem secretariaId, passam a pertencer a ela automaticamente.
    let secretariasFinais = listaSec.sort((a, b) => a.createdAt - b.createdAt);
    if (secretariasFinais.length === 0) {
      const padrao = emptySecretaria("Secretaria Municipal de Assistência Social", "SEMAS");
      try {
        await storage.set("sec:" + padrao.id, JSON.stringify(padrao), false);
        secretariasFinais = [padrao];
      } catch (e) { console.error("Erro ao criar secretaria padrão", e); }
    }

    setEtps(listaEtps);
    setJustificativas(listaJust);
    setDeclaracoes(listaDecl);
    setSecretarias(secretariasFinais);
    setUsuarios(listaUsr.sort((a, b) => (a.nomeCompleto || a.email).localeCompare(b.nomeCompleto || b.email)));
    setNormativos(listaNormas.sort((a, b) => b.enviadoEm - a.enviadoEm));
    // O que passou de 30 dias sai da lixeira sozinho
    const lixoValido = await limparLixeiraVencida(listaLixo);
    setLixeira(lixoValido.sort((a, b) => b.excluidoEm - a.excluidoEm));
    setLoading(false);
  }, [carregarColecao]);

  useEffect(() => { loadList(); }, [loadList]);

  const persist = useCallback((etp) => {
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await storage.set("etp:" + etp.id, JSON.stringify(etp), false);
        setSaveState("saved");
      } catch (e) {
        console.error("Erro ao salvar", e);
        setSaveState("idle");
      }
    }, 600);
  }, []);

  function openEtp(etp) {
    setCurrent(etp);
    setCurrentId(etp.id);
    setActiveSection("itens");
    setView("editor");
  }

  // Secretaria que um documento novo deve receber: a que está selecionada no painel,
  // ou a primeira cadastrada quando o filtro está em "todas".
  function secretariaParaNovoDoc() {
    if (secretariaAtiva !== "todas") return secretarias.find(s => s.id === secretariaAtiva) || secretarias[0];
    return secretarias[0];
  }

  // Recebe o que foi preenchido na janela de criação: objeto, tipo, processo e secretaria
  function newEtp(dados = {}) {
    const etp = emptyEtp();
    const sec = secretarias.find(x => x.id === dados.secretariaId) || secretariaParaNovoDoc();
    if (sec) {
      etp.secretariaId = sec.id;
      etp.meta.orgao = sec.nome; // evita redigitar o órgão a cada novo documento
    }
    if (dados.objeto) etp.meta.titulo = dados.objeto;
    if (dados.processo) etp.meta.processo = dados.processo;
    if (dados.tipoObjeto && TIPOS_OBJETO.includes(dados.tipoObjeto)) etp.meta.tipo = dados.tipoObjeto;
    setCurrent(etp);
    setCurrentId(etp.id);
    setActiveSection("itens");
    setView("editor");
    setEtps(prev => [etp, ...prev]);
    storage.set("etp:" + etp.id, JSON.stringify(etp), false).catch(() => {});
  }

  async function deleteEtp(id, e) {
    e?.stopPropagation?.();
    const doc = etps.find(x => x.id === id);
    if (!doc) return;
    try {
      const reg = await moverParaLixeira("etp:", id, doc);
      setEtps(prev => prev.filter(x => x.id !== id));
      setLixeira(prev => [reg, ...prev]);
    } catch (err) { console.error(err); }
  }

  function duplicarEtp(etp, e) {
    e?.stopPropagation();
    const copia = duplicarDocumento(etp, "etp");
    setEtps(prev => [copia, ...prev]);
    storage.set("etp:" + copia.id, JSON.stringify(copia), false).catch(() => {});
  }

  // ----- Usuários -----
  function salvarUsuario(u) {
    const atualizado = { ...u, updatedAt: Date.now() };
    setUsuarios(prev => {
      const existe = prev.some(x => x.id === atualizado.id);
      return existe ? prev.map(x => (x.id === atualizado.id ? atualizado : x)) : [...prev, atualizado];
    });
    storage.set("usr:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }

  async function excluirUsuario(id) {
    try {
      await storage.delete("usr:" + id, false);
      setUsuarios(prev => prev.filter(x => x.id !== id));
    } catch (err) { console.error(err); }
  }

  // ----- Materiais Normativos -----
  // Lê o PDF como data URL e grava o registro inteiro (metadados + conteúdo) numa única chave;
  // o storage.js já fatia automaticamente valores grandes, então não é preciso tratar isso aqui.
  async function uploadNormativo(file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
      leitor.readAsDataURL(file);
    });
    const registro = {
      id: "norma_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      nome: file.name,
      tamanhoBytes: file.size,
      enviadoEm: Date.now(),
      dataUrl,
    };
    await storage.set("norma:" + registro.id, JSON.stringify(registro), false);
    setNormativos(prev => [registro, ...prev]);
  }

  async function excluirNormativo(id) {
    try {
      await storage.delete("norma:" + id, false);
      setNormativos(prev => prev.filter(x => x.id !== id));
    } catch (err) { console.error(err); }
  }

  // ----- Secretarias -----
  function salvarSecretaria(sec) {
    const atualizada = { ...sec, updatedAt: Date.now() };
    setSecretarias(prev => {
      const existe = prev.some(s => s.id === atualizada.id);
      return existe ? prev.map(s => (s.id === atualizada.id ? atualizada : s)) : [...prev, atualizada];
    });
    storage.set("sec:" + atualizada.id, JSON.stringify(atualizada), false).catch(() => {});
  }

  function novaSecretaria() {
    salvarSecretaria(emptySecretaria("", ""));
  }

  async function excluirSecretaria(id) {
    // A última secretaria não pode ser removida — todo documento precisa de uma referência
    if (secretarias.length <= 1) return;
    try {
      await storage.delete("sec:" + id, false);
      setSecretarias(prev => prev.filter(s => s.id !== id));
      if (secretariaAtiva === id) setSecretariaAtiva("todas");
    } catch (err) { console.error(err); }
  }

  // ----- Justificativas de Aquisição -----
  function abrirJustificativa(doc) {
    setCurrentJust(doc);
    setView("justificativa");
  }
  function novaJustificativa(dadosIniciais) {
    const doc = emptyJustificativa();
    const sec = secretarias.find(x => x.id === dadosIniciais?.secretariaId) || secretariaParaNovoDoc();
    if (sec) {
      doc.secretariaId = sec.id;
      doc.campos.orgao = sec.nome;
    }
    if (dadosIniciais?.objeto) doc.campos.objeto = dadosIniciais.objeto;
    if (dadosIniciais?.processo) doc.campos.processo = dadosIniciais.processo;
    if (dadosIniciais?.orgao) doc.campos.orgao = dadosIniciais.orgao;
    if (dadosIniciais?.secretariaId) doc.secretariaId = dadosIniciais.secretariaId;
    storage.set("just:" + doc.id, JSON.stringify(doc), false).catch(() => {});
    setJustificativas(prev => [doc, ...prev]);
    abrirJustificativa(doc);
  }

  function duplicarJustificativa(doc, e) {
    e?.stopPropagation();
    const copia = duplicarDocumento(doc, "just");
    setJustificativas(prev => [copia, ...prev]);
    storage.set("just:" + copia.id, JSON.stringify(copia), false).catch(() => {});
  }
  function salvarJustificativa(doc) {
    const atualizado = { ...doc, updatedAt: Date.now() };
    setCurrentJust(atualizado);
    setJustificativas(prev => prev.map(d => (d.id === atualizado.id ? atualizado : d)));
    storage.set("just:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }
  async function excluirJustificativa(id, e) {
    e?.stopPropagation?.();
    const doc = justificativas.find(x => x.id === id);
    if (!doc) return;
    try {
      const reg = await moverParaLixeira("just:", id, doc);
      setJustificativas(prev => prev.filter(x => x.id !== id));
      setLixeira(prev => [reg, ...prev]);
    } catch (err) { console.error(err); }
  }

  // ----- Declarações de previsão no PCA -----
  function abrirDeclaracao(doc) {
    setCurrentDecl(doc);
    setView("declaracao");
  }
  function novaDeclaracao(dados = {}) {
    const doc = emptyDeclaracao();
    const sec = secretarias.find(x => x.id === dados.secretariaId) || secretariaParaNovoDoc();
    if (sec) {
      doc.secretariaId = sec.id;
      doc.orgao = sec.nome;
    }
    if (dados.objeto) doc.objeto = dados.objeto;
    storage.set("decl:" + doc.id, JSON.stringify(doc), false).catch(() => {});
    setDeclaracoes(prev => [doc, ...prev]);
    abrirDeclaracao(doc);
  }

  function duplicarDeclaracao(doc, e) {
    e?.stopPropagation();
    const copia = duplicarDocumento(doc, "decl");
    setDeclaracoes(prev => [copia, ...prev]);
    storage.set("decl:" + copia.id, JSON.stringify(copia), false).catch(() => {});
  }
  function salvarDeclaracao(doc) {
    const atualizado = { ...doc, updatedAt: Date.now() };
    setCurrentDecl(atualizado);
    setDeclaracoes(prev => prev.map(d => (d.id === atualizado.id ? atualizado : d)));
    storage.set("decl:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }
  async function excluirDeclaracao(id, e) {
    e?.stopPropagation?.();
    const doc = declaracoes.find(x => x.id === id);
    if (!doc) return;
    try {
      const reg = await moverParaLixeira("decl:", id, doc);
      setDeclaracoes(prev => prev.filter(x => x.id !== id));
      setLixeira(prev => [reg, ...prev]);
    } catch (err) { console.error(err); }
  }

  // ----- Lixeira -----
  async function restaurarDocumento(registro) {
    try {
      await restaurarDaLixeira(registro);
      setLixeira(prev => prev.filter(r => r.id !== registro.id));
      await loadList();
    } catch (err) { console.error(err); }
  }

  async function apagarDefinitivo(registro) {
    try {
      await excluirDefinitivo(registro);
      setLixeira(prev => prev.filter(r => r.id !== registro.id));
    } catch (err) { console.error(err); }
  }

  async function esvaziarLixeira() {
    try {
      for (const r of lixeira) await excluirDefinitivo(r).catch(() => {});
      setLixeira([]);
    } catch (err) { console.error(err); }
  }

  function updateMeta(field, value) {
    setCurrent(prev => {
      const next = { ...prev, meta: { ...prev.meta, [field]: value }, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateSection(id, value) {
    setCurrent(prev => {
      const next = { ...prev, sections: { ...prev.sections, [id]: value }, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateItens(itens) {
    setCurrent(prev => {
      const next = { ...prev, itens, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateManuaisPca(manuaisPca) {
    setCurrent(prev => {
      const next = { ...prev, manuaisPca, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateExcluidos(incisosExcluidos) {
    setCurrent(prev => {
      const next = { ...prev, incisosExcluidos, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateSolucoesMercado(solucoesMercado) {
    setCurrent(prev => {
      const next = { ...prev, solucoesMercado, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateCotacoes(cotacoes) {
    setCurrent(prev => {
      const next = { ...prev, cotacoes, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateValoresAdotados(valoresAdotados) {
    setCurrent(prev => {
      const next = { ...prev, valoresAdotados, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updatePca(pca) {
    setCurrent(prev => {
      const next = { ...prev, pca, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function backToList() {
    loadList();
    setView("list");
  }

  // Quem está usando o sistema e o que pode fazer
  const usuarioAtual = usuarioPorEmail(usuarios, emailUsuario);
  const permissoes = permissoesDe(usuarioAtual);
  const secretariasVisiveis = entidadesVisiveis(usuarioAtual, secretarias);

  // Filtro por secretaria — vale para as três coleções. Documentos antigos (sem secretariaId)
  // pertencem à primeira secretaria cadastrada, conforme secretariaDoDoc.
  function pertenceASecretariaAtiva(doc) {
    if (secretariaAtiva === "todas") return true;
    const sec = secretariaDoDoc(doc, secretarias);
    return sec?.id === secretariaAtiva;
  }

  const etpsDaSecretaria = etps.filter(pertenceASecretariaAtiva);
  const justificativasDaSecretaria = justificativas.filter(pertenceASecretariaAtiva);
  const declaracoesDaSecretaria = declaracoes.filter(pertenceASecretariaAtiva);

  const filteredEtps = etpsDaSecretaria.filter(e => {
    const nomesResponsaveis = listaResponsaveis(e).map(r => r.nome).join(" ");
    return (e.meta.titulo + " " + e.meta.orgao + " " + e.meta.processo + " " + nomesResponsaveis)
      .toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ background: C.paperDark, height: "100%", minHeight: 0, fontFamily: "'Inter', system-ui, sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap');
        html, body, #root { height: 100%; }
        .serif { font-family: 'Source Serif 4', Georgia, serif; }
        .etp-scroll::-webkit-scrollbar { width: 8px; }
        .etp-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        textarea:focus, input:focus, select:focus { outline: 2px solid ${C.brass}; outline-offset: 1px; }
        [contenteditable]:focus { outline: 2px solid ${C.brass}; outline-offset: -2px; }
        .rich-content table, [contenteditable] table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .rich-content td, .rich-content th, [contenteditable] td, [contenteditable] th { border: 1px solid ${C.border}; padding: 6px 8px; }
        .rich-content ul, [contenteditable] ul { list-style: disc; padding-left: 1.4em; }
        .rich-content ol, [contenteditable] ol { list-style: decimal; padding-left: 1.4em; }
        .rich-content p, [contenteditable] p { margin: 0 0 8px; }
        .rich-content h4, [contenteditable] h4 { font-size: 1.05em; font-weight: 700; margin: 10px 0 4px; }
        .rich-content h5, [contenteditable] h5 { font-size: 1em; font-weight: 700; font-style: italic; margin: 8px 0 4px; }
        .rich-content h6, [contenteditable] h6 { font-size: 0.95em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin: 8px 0 4px; }
        .rich-content blockquote, [contenteditable] blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid ${C.brass}; font-style: italic; color: ${C.inkMuted}; }
        .rich-content hr, [contenteditable] hr { border: none; border-top: 1px solid ${C.border}; margin: 12px 0; }
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; margin: 0 !important; }
          .print-area, .print-area * { color: #000 !important; }
          .print-area blockquote { border-left-color: #000 !important; }
          .print-area table, .print-area td, .print-area th { border-color: #000 !important; }
          .print-area th { background: #eeeeee !important; }
          .print-area tr:nth-child(even) td { background: transparent !important; }
          .timbre-inline-print { display: none !important; }
          .timbre-fixed-print {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            text-align: center;
            padding: 6px 0 10px;
            background: white;
          }
          .print-area { padding-top: 110px !important; line-height: 1.5; }
          .print-area .titulo-inciso { text-transform: uppercase; letter-spacing: 0.3px; }
        }
        .timbre-fixed-print { display: none; }
      `}</style>

      {view === "list" && (
        <ListView
          etps={filteredEtps} todosEtps={etpsDaSecretaria}
          justificativas={justificativasDaSecretaria} declaracoes={declaracoesDaSecretaria}
          secretarias={secretariasVisiveis} secretariaAtiva={secretariaAtiva} setSecretariaAtiva={setSecretariaAtiva}
          loading={loading} search={search} setSearch={setSearch}
          onOpen={openEtp} onNew={newEtp} onDelete={deleteEtp} onDuplicar={duplicarEtp}
          onAbrirDeclaracao={abrirDeclaracao} onNovaDeclaracao={novaDeclaracao}
          onExcluirDeclaracao={excluirDeclaracao} onDuplicarDeclaracao={duplicarDeclaracao}
          onAbrirJustificativa={abrirJustificativa} onNovaJustificativa={novaJustificativa}
          onExcluirJustificativa={excluirJustificativa} onDuplicarJustificativa={duplicarJustificativa}
          onSalvarSecretaria={salvarSecretaria} onNovaSecretaria={novaSecretaria}
          onExcluirSecretaria={excluirSecretaria}
          onRecarregar={loadList}
          usuarios={usuarios} emailUsuario={emailUsuario} usuarioAtual={usuarioAtual} permissoes={permissoes}
          onSalvarUsuario={salvarUsuario} onExcluirUsuario={excluirUsuario}
          normativos={normativos} onUploadNormativo={uploadNormativo} onExcluirNormativo={excluirNormativo}
          lixeira={lixeira} onRestaurar={restaurarDocumento}
          onApagarDefinitivo={apagarDefinitivo} onEsvaziar={esvaziarLixeira}
        />
      )}

      {view === "justificativa" && currentJust && (
        <JustificativaView doc={currentJust} secretarias={secretarias}
          onSalvar={salvarJustificativa} onBack={backToList} />
      )}

      {view === "declaracao" && currentDecl && (
        <DeclaracaoView doc={currentDecl} secretarias={secretarias}
          onSalvar={salvarDeclaracao} onBack={backToList}
          onGerarJustificativa={(dados) => novaJustificativa(dados)} />
      )}

      {view === "editor" && current && (
        <EditorView
          etp={current} activeSection={activeSection} setActiveSection={setActiveSection}
          onMeta={updateMeta} onSection={updateSection} onItens={updateItens} onCotacoes={updateCotacoes}
          onSolucoesMercado={updateSolucoesMercado} onExcluidos={updateExcluidos} secretarias={secretarias}
          onManuaisPca={updateManuaisPca}
          onValoresAdotados={updateValoresAdotados} onPca={updatePca}
          saveState={saveState} onBack={backToList} onPreview={() => setView("preview")}
        />
      )}

      {view === "preview" && current && (
        <PreviewView etp={current} secretarias={secretarias} onBack={() => setView("editor")} />
      )}
    </div>
  );
}

// ---------- Usuários e permissões ----------
function UsuariosView({ usuarios, secretarias, emailAtual, onSalvar, onNovo, onExcluir }) {
  const [editando, setEditando] = useState(null);   // id em edição
  const [confirmId, setConfirmId] = useState(null);
  const [novoEmail, setNovoEmail] = useState("");
  const [erro, setErro] = useState("");

  function criar(e) {
    e.preventDefault();
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    if (usuarios.some(u => u.email === email)) {
      setErro("Já existe um cadastro com este e-mail.");
      return;
    }
    setErro("");
    const u = emptyUsuario(email);
    onNovo(u);
    setNovoEmail("");
    setEditando(u.id);
  }

  function alternarEntidade(u, entId) {
    const atuais = u.entidades || [];
    const novas = atuais.includes(entId) ? atuais.filter(x => x !== entId) : [...atuais, entId];
    const principal = novas.includes(u.entidadePrincipal) ? u.entidadePrincipal : (novas[0] || "");
    onSalvar({ ...u, entidades: novas, entidadePrincipal: principal });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Building2 size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Controle de acesso</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Usuários e permissões</h1>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg mb-5 text-xs leading-relaxed"
        style={{ background: "rgba(166,131,46,0.1)", color: C.ink }}>
        <Info size={14} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
        <span>
          <b>As senhas não ficam neste cadastro.</b> Elas são criadas e alteradas no Firebase
          Authentication — guardá-las aqui deixaria qualquer pessoa com acesso ao computador lê-las.
          Cadastre a pessoa lá primeiro (com o mesmo e-mail) e depois defina aqui o papel e as entidades.
        </span>
      </div>

      {/* Novo usuário */}
      <form onSubmit={criar} className="rounded-xl border p-4 mb-5" style={{ borderColor: C.border, background: "white" }}>
        <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
          Cadastrar pessoa
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
            placeholder="e-mail cadastrado no Firebase"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
          <button type="submit" disabled={!novoEmail.trim()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: C.navy, color: C.paper }}>
            <Plus size={15} /> Adicionar
          </button>
        </div>
        {erro && <p className="text-xs mt-2" style={{ color: C.red }}>{erro}</p>}
      </form>

      {usuarios.length === 0 ? (
        <div className="text-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Nenhum usuário cadastrado</p>
          <p className="text-sm max-w-md mx-auto" style={{ color: C.inkMuted }}>
            Enquanto não houver cadastro, quem entrar no sistema é tratado como administrador —
            o acesso já foi filtrado pelas Regras do Firebase.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {usuarios.map(u => {
            const aberto = editando === u.id;
            const souEu = u.email === String(emailAtual || "").toLowerCase();
            const p = PAPEIS[u.papel] || PAPEIS.padrao;
            return (
              <div key={u.id} className="rounded-xl border" style={{
                borderColor: aberto ? C.brass : C.border,
                background: u.ativo === false ? C.paperDark : "white",
              }}>
                {/* Linha resumida */}
                <button onClick={() => setEditando(aberto ? null : u.id)}
                  className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: u.papel === "admin" ? "rgba(166,131,46,0.15)" : C.paperDark }}>
                    <span className="serif text-xs font-bold"
                      style={{ color: u.papel === "admin" ? C.brass : C.inkMuted }}>
                      {(u.nomeCompleto || u.email).split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: C.navy }}>
                      {u.nomeCompleto || <span style={{ color: C.inkMuted, fontStyle: "italic" }}>Sem nome cadastrado</span>}
                      {souEu && <span className="ml-1.5 text-[10px] font-normal" style={{ color: C.inkMuted }}>(você)</span>}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: C.inkMuted }}>{u.email}</p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        background: u.papel === "admin" ? "rgba(166,131,46,0.15)" : C.paperDark,
                        color: u.papel === "admin" ? C.brass : C.inkMuted,
                      }}>
                      {p.rotulo}
                    </span>
                    <p className="text-[11px] mt-1" style={{ color: C.inkMuted }}>
                      {resumoEntidades(u, secretarias)}
                    </p>
                  </div>
                  {u.ativo === false && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>Inativo</span>
                  )}
                  <ChevronRight size={16} className="shrink-0 transition-transform"
                    style={{ color: C.inkMuted, transform: aberto ? "rotate(90deg)" : "none" }} />
                </button>

                {/* Detalhes */}
                {aberto && (
                  <div className="px-4 pb-4 border-t pt-4" style={{ borderColor: C.border }}>
                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                          Nome completo
                        </span>
                        <input value={u.nomeCompleto} onChange={e => onSalvar({ ...u, nomeCompleto: e.target.value })}
                          placeholder="Ex.: Luís Eduardo Monteiro Lima"
                          className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                          Cargo
                        </span>
                        <input value={u.cargo || ""} onChange={e => onSalvar({ ...u, cargo: e.target.value })}
                          placeholder="Ex.: Analista Administrativo"
                          className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                      </label>
                    </div>

                    <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
                      Papel
                    </span>
                    <div className="grid sm:grid-cols-2 gap-2 mb-4">
                      {Object.entries(PAPEIS).map(([chave, info]) => (
                        <label key={chave} className="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer"
                          style={{
                            borderColor: u.papel === chave ? C.brass : C.border,
                            background: u.papel === chave ? "rgba(166,131,46,0.06)" : "white",
                          }}>
                          <input type="radio" name={`papel-${u.id}`} checked={u.papel === chave}
                            onChange={() => onSalvar({ ...u, papel: chave })}
                            className="mt-0.5" style={{ accentColor: C.brass }} />
                          <span>
                            <span className="block text-xs font-semibold" style={{ color: C.navy }}>{info.rotulo}</span>
                            <span className="block text-[11px] leading-snug mt-0.5" style={{ color: C.inkMuted }}>
                              {info.descricao}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>

                    {u.papel === "padrao" && (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: C.inkMuted }}>
                          Entidades a que tem acesso
                        </span>
                        <p className="text-[11px] mb-2" style={{ color: C.inkMuted }}>
                          Marque as entidades. A estrela indica qual abre por padrão ao entrar.
                        </p>
                        <div className="space-y-1.5 mb-4">
                          {secretarias.map(sec => {
                            const marcada = (u.entidades || []).includes(sec.id);
                            const principal = u.entidadePrincipal === sec.id;
                            return (
                              <div key={sec.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border"
                                style={{ borderColor: marcada ? C.brass : C.border, background: marcada ? "rgba(166,131,46,0.05)" : "white" }}>
                                <input type="checkbox" checked={marcada}
                                  onChange={() => alternarEntidade(u, sec.id)}
                                  style={{ accentColor: C.brass }} className="w-4 h-4 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate" style={{ color: C.navy }}>
                                    {sec.sigla ? `${sec.sigla} — ${sec.nome}` : (sec.nome || "Entidade sem nome")}
                                  </p>
                                  {sec.tipoEntidade && (
                                    <p className="text-[10px]" style={{ color: C.inkMuted }}>{sec.tipoEntidade}</p>
                                  )}
                                </div>
                                {marcada && (
                                  <button onClick={() => onSalvar({ ...u, entidadePrincipal: sec.id })}
                                    className="text-[10px] font-semibold px-2 py-1 rounded shrink-0"
                                    style={{
                                      background: principal ? C.brass : C.paperDark,
                                      color: principal ? C.navyDark : C.inkMuted,
                                    }}
                                    title="Definir como entidade principal">
                                    {principal ? "★ Principal" : "☆ Tornar principal"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] mb-4 px-3 py-2 rounded-lg" style={{ background: C.paperDark, color: C.inkMuted }}>
                          Resumo: <b style={{ color: C.ink }}>{resumoEntidades(u, secretarias)}</b>
                        </p>
                      </>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: C.border }}>
                      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: C.ink }}>
                        <input type="checkbox" checked={u.ativo !== false}
                          onChange={e => onSalvar({ ...u, ativo: e.target.checked })}
                          style={{ accentColor: C.green }} className="w-4 h-4" />
                        Acesso ativo
                      </label>

                      <div className="ml-auto">
                        {souEu ? (
                          <span className="text-[10px]" style={{ color: C.inkMuted }}>
                            Você não pode excluir o próprio cadastro
                          </span>
                        ) : confirmId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px]" style={{ color: C.red }}>Excluir cadastro?</span>
                            <button onClick={() => { onExcluir(u.id); setConfirmId(null); }}
                              className="px-2 py-1 rounded text-[10px] font-semibold"
                              style={{ background: C.red, color: "white" }}>Sim</button>
                            <button onClick={() => setConfirmId(null)}
                              className="px-2 py-1 rounded text-[10px] font-medium"
                              style={{ background: C.paperDark, color: C.inkMuted }}>Não</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmId(u.id)}
                            className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.red }}>
                            <Trash2 size={12} /> Excluir cadastro
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[10.5px] mt-3 leading-relaxed" style={{ color: C.inkMuted }}>
                      Excluir aqui remove as permissões, mas <b>não apaga a conta no Firebase</b> — para
                      bloquear o acesso de vez, desative ou exclua o usuário no console do Firebase.
                      Desmarcar "Acesso ativo" já impede o uso do sistema.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------- Cadastro de Secretarias ----------
function SecretariasView({ secretarias, onSalvar, onNova, onExcluir, onBack }) {
  // Quando usada como aba do painel não recebe onBack — o menu lateral já faz a navegação
  const [confirmId, setConfirmId] = useState(null);
  const fileRefs = useRef({});

  async function trocarTimbre(sec, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const redimensionado = await redimensionarImagem(dataUrl, 1200);
      onSalvar({ ...sec, timbre: redimensionado });
    } catch (err) { console.error(err); }
    e.target.value = "";
  }

  return (
    <div className={onBack ? "max-w-3xl mx-auto px-6 py-10" : "max-w-3xl"}>
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6" style={{ color: C.navy }}>
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Building2 size={16} />
            <span className="text-xs font-semibold tracking-widest uppercase">Organização</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Entidades</h1>
        </div>
        <button onClick={onNova}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold shrink-0"
          style={{ background: C.navy, color: C.paper }}>
          <Plus size={15} /> Nova Entidade
        </button>
      </div>

      <p className="text-sm mb-6" style={{ color: C.inkMuted }}>
        Entidades são as unidades que contratam: secretarias, fundos, autarquias, fundações e afins.
        Cada documento pertence a uma delas. O nome cadastrado aqui já entra preenchido no campo
        "Órgão" dos documentos novos, e o timbre de cada uma é usado nos arquivos gerados.
      </p>

      <div className="space-y-3">
        {secretarias.map(sec => (
          <div key={sec.id} className="p-4 rounded-xl border" style={{ borderColor: C.border, background: "white" }}>
            <div className="grid sm:grid-cols-[1fr,120px] gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Nome</span>
                <input value={sec.nome} onChange={e => onSalvar({ ...sec, nome: e.target.value })}
                  placeholder="Ex.: Fundo Municipal de Assistência Social"
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Sigla</span>
                <input value={sec.sigla} onChange={e => onSalvar({ ...sec, sigla: e.target.value })}
                  placeholder="Ex.: FMAS"
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
            </div>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Natureza da entidade
              </span>
              <select value={sec.tipoEntidade || "Secretaria"}
                onChange={e => onSalvar({ ...sec, tipoEntidade: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: C.border, maxWidth: "260px" }}>
                {TIPOS_ENTIDADE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <div className="pt-3 border-t" style={{ borderColor: C.border }}>
              <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
                Timbre desta entidade
              </span>

              <div className="inline-flex p-1 rounded-lg mb-3" style={{ background: C.paperDark }}>
                {[
                  { v: "imagem", r: "Imagem" },
                  { v: "texto", r: "Texto" },
                  { v: "nenhum", r: "Nenhum" },
                ].map(op => {
                  const ativo = (sec.tipoTimbre || "imagem") === op.v;
                  return (
                    <button key={op.v} onClick={() => onSalvar({ ...sec, tipoTimbre: op.v })}
                      className="px-3 py-1 rounded-md text-xs font-semibold"
                      style={{
                        background: ativo ? "white" : "transparent",
                        color: ativo ? C.navy : C.inkMuted,
                        boxShadow: ativo ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                      }}>
                      {op.r}
                    </button>
                  );
                })}
              </div>

              {(sec.tipoTimbre || "imagem") === "imagem" && (
                <div className="flex items-center gap-3 flex-wrap">
                  {sec.timbre ? (
                    <img src={sec.timbre} alt="Timbre" className="rounded border" style={{ maxHeight: "44px", borderColor: C.border }} />
                  ) : (
                    <span className="text-xs" style={{ color: C.inkMuted }}>Sem imagem própria — usará o timbre geral do app</span>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    ref={el => { fileRefs.current[sec.id] = el; }}
                    onChange={e => trocarTimbre(sec, e)} />
                  <button onClick={() => fileRefs.current[sec.id]?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium"
                    style={{ background: C.paperDark, color: C.navy }}>
                    <Upload size={12} /> {sec.timbre ? "Trocar imagem" : "Enviar imagem"}
                  </button>
                  {sec.timbre && (
                    <button onClick={() => onSalvar({ ...sec, timbre: null })}
                      className="text-xs font-medium" style={{ color: C.red }}>Remover</button>
                  )}
                </div>
              )}

              {(sec.tipoTimbre || "imagem") === "texto" && (
                <div>
                  <RichTextEditor value={sec.timbreHtml || ""} onChange={v => onSalvar({ ...sec, timbreHtml: v })} />
                  <p className="text-[10px] mt-1.5" style={{ color: C.inkMuted }}>
                    Escreva o cabeçalho como texto formatado. Ele entra no cabeçalho de todas as páginas do
                    documento, centralizado e com uma linha embaixo.
                  </p>
                  {!sec.timbreHtml?.trim() && (
                    <button onClick={() => onSalvar({ ...sec, timbreHtml:
                      `<p style="text-align:center"><b>PREFEITURA MUNICIPAL DE RIO VERDE</b></p><p style="text-align:center">${escapeHtml(sec.nome || "[nome da secretaria]")}</p>` })}
                      className="mt-2 px-2.5 py-1.5 rounded-md text-xs font-medium"
                      style={{ background: C.brass, color: C.navyDark }}>
                      Usar modelo padrão
                    </button>
                  )}
                </div>
              )}

              {(sec.tipoTimbre || "imagem") === "nenhum" && (
                <p className="text-xs" style={{ color: C.inkMuted }}>
                  Os documentos desta secretaria sairão sem cabeçalho — útil quando o timbre é aplicado
                  depois, por outro sistema ou em papel timbrado impresso.
                </p>
              )}

              <div className="flex justify-end mt-3">
                {secretarias.length <= 1 ? (
                  <span className="text-[10px]" style={{ color: C.inkMuted }}>A última entidade não pode ser excluída</span>
                ) : confirmId === sec.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: C.red }}>Excluir?</span>
                    <button onClick={() => { onExcluir(sec.id); setConfirmId(null); }}
                      className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: C.red, color: "white" }}>Sim</button>
                    <button onClick={() => setConfirmId(null)}
                      className="px-2 py-1 rounded text-[10px] font-medium" style={{ background: C.paperDark, color: C.inkMuted }}>Não</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmId(sec.id)} style={{ color: C.red }} title="Excluir entidade">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-2 p-3 rounded-lg text-xs leading-relaxed" style={{ background: C.paperDark, color: C.inkMuted }}>
        <Info size={14} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
        <span>
          Excluir uma entidade não apaga os documentos dela — eles passam a aparecer sob a primeira
          entidade da lista. As alterações desta tela são salvas automaticamente.
        </span>
      </div>
    </div>
  );
}

// ---------- Lixeira ----------
// Excluir não apaga na hora: o documento vai para a lixeira e fica 30 dias disponível para
// restauração. Passado o prazo, some sozinho. Administradores podem esvaziar antes disso.
const DIAS_NA_LIXEIRA = 30;
const PREFIXO_LIXO = "lixo:";

// Rótulo do tipo, a partir do prefixo original da chave
const TIPOS_DOC = {
  "etp:": { rotulo: "ETP", icone: "FileText" },
  "just:": { rotulo: "Justificativa", icone: "FileEdit" },
  "decl:": { rotulo: "Declaração de PCA", icone: "ListChecks" },
};

function diasRestantes(excluidoEm) {
  const passados = (Date.now() - excluidoEm) / 86400000;
  return Math.max(0, Math.ceil(DIAS_NA_LIXEIRA - passados));
}

// Move o documento para a lixeira, guardando de onde veio e quando saiu
async function moverParaLixeira(prefixo, id, doc) {
  const registro = {
    id: "lx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    prefixoOriginal: prefixo,
    idOriginal: id,
    excluidoEm: Date.now(),
    doc,
  };
  await storage.set(PREFIXO_LIXO + registro.id, JSON.stringify(registro), false);
  await storage.delete(prefixo + id, false);
  return registro;
}

// Devolve o documento ao lugar de origem
async function restaurarDaLixeira(registro) {
  await storage.set(
    registro.prefixoOriginal + registro.idOriginal,
    JSON.stringify(registro.doc), false);
  await storage.delete(PREFIXO_LIXO + registro.id, false);
}

async function excluirDefinitivo(registro) {
  await storage.delete(PREFIXO_LIXO + registro.id, false);
}

// Remove o que já passou dos 30 dias. Roda no carregamento, sem incomodar ninguém.
async function limparLixeiraVencida(registros) {
  const vencidos = registros.filter(r => diasRestantes(r.excluidoEm) <= 0);
  for (const r of vencidos) {
    await storage.delete(PREFIXO_LIXO + r.id, false).catch(() => {});
  }
  return registros.filter(r => diasRestantes(r.excluidoEm) > 0);
}

// Título do documento guardado, seja qual for o tipo
function tituloNaLixeira(registro) {
  const d = registro.doc || {};
  if (registro.prefixoOriginal === "etp:") return d.meta?.titulo || "ETP sem título";
  return (d.campos?.objeto ?? d.objeto ?? "").trim() || "Sem objeto definido";
}

// ---------- Backup: exportar e importar tudo ----------
// Enquanto os dados vivem só no navegador, este é o único caminho de recuperação
// caso a máquina seja formatada, o perfil corrompa ou alguém limpe os dados do site.
const CHAVES_COLECAO = ["etp:", "just:", "decl:", "sec:"];
const CHAVES_UNICAS = ["pca:planilha", "timbre:padrao", "diretorio:responsaveis"];

async function montarBackup() {
  const pacote = {
    formato: "gerador-etp-backup",
    versao: 1,
    geradoEm: new Date().toISOString(),
    colecoes: {},
    unicos: {},
  };

  for (const prefixo of CHAVES_COLECAO) {
    pacote.colecoes[prefixo] = [];
    try {
      const chaves = await storage.list(prefixo, false);
      for (const k of chaves?.keys || []) {
        try {
          const r = await storage.get(k, false);
          if (r?.value) pacote.colecoes[prefixo].push({ chave: k, valor: r.value });
        } catch (e) { /* registro ausente */ }
      }
    } catch (e) { console.error("backup: " + prefixo, e); }
  }

  for (const k of CHAVES_UNICAS) {
    try {
      const r = await storage.get(k, false);
      if (r?.value) pacote.unicos[k] = r.value;
    } catch (e) { /* pode não existir */ }
  }

  return pacote;
}

function baixarBackup(pacote) {
  const texto = JSON.stringify(pacote, null, 2);
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_gerador_etp_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Lê o arquivo e confere se é mesmo um backup deste app, antes de qualquer gravação
function lerBackup(texto) {
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (dados?.formato !== "gerador-etp-backup") {
    throw new Error("Este arquivo não é um backup do Gerador de ETP.");
  }
  if (!dados.colecoes || !dados.unicos) {
    throw new Error("O backup está incompleto ou corrompido.");
  }
  return dados;
}

// Quantos itens de cada tipo o arquivo contém — mostrado antes de confirmar
function resumirBackup(pacote) {
  return {
    etps: pacote.colecoes["etp:"]?.length || 0,
    justificativas: pacote.colecoes["just:"]?.length || 0,
    declaracoes: pacote.colecoes["decl:"]?.length || 0,
    secretarias: pacote.colecoes["sec:"]?.length || 0,
    temPca: !!pacote.unicos["pca:planilha"],
    temTimbre: !!pacote.unicos["timbre:padrao"],
    geradoEm: pacote.geradoEm,
  };
}

// Grava o backup. Em "substituir", apaga o que existe hoje nas mesmas coleções antes de
// restaurar; em "mesclar", mantém o que há e sobrescreve apenas documentos de mesmo id.
async function restaurarBackup(pacote, modo = "mesclar") {
  let gravados = 0;

  if (modo === "substituir") {
    for (const prefixo of CHAVES_COLECAO) {
      try {
        const chaves = await storage.list(prefixo, false);
        for (const k of chaves?.keys || []) {
          await storage.delete(k, false).catch(() => {});
        }
      } catch (e) { /* nada a apagar */ }
    }
  }

  for (const prefixo of CHAVES_COLECAO) {
    for (const reg of pacote.colecoes[prefixo] || []) {
      await storage.set(reg.chave, reg.valor, false);
      gravados++;
    }
  }
  for (const [k, v] of Object.entries(pacote.unicos || {})) {
    await storage.set(k, v, false);
    gravados++;
  }
  return gravados;
}

// Situação de um ETP, derivada do preenchimento — os únicos estados que o app consegue afirmar
function situacaoEtp(etp) {
  const p = progress(etp);
  if (p.filled === 0) return { chave: "rascunho", rotulo: "Rascunho", cor: C.inkMuted };
  if (p.reqFilled === p.reqTotal) return { chave: "concluido", rotulo: "Concluído", cor: C.green };
  return { chave: "elaboracao", rotulo: "Em elaboração", cor: C.brass };
}

// Saudação conforme a hora do dia
function saudacaoPorHora(agora = new Date()) {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Primeiro nome, para a saudação não ficar cerimoniosa demais
function primeiroNomeDe(nomeCompleto) {
  const limpo = String(nomeCompleto || "").trim();
  if (!limpo) return null;
  return limpo.split(/\s+/)[0];
}

// Frases que giram abaixo da saudação. Sóbrias, ligadas ao sentido do trabalho —
// planejar bem uma contratação é o que garante que o recurso público chegue a quem precisa.
// Frases de pensadores, sorteadas a cada entrada no sistema.
// Só entram aqui citações com origem documentada — muitas frases célebres circulam
// atribuídas a quem nunca as disse, e num sistema público isso não fica bem.
const FRASES = [
  // --- Antiguidade clássica ---
  { texto: "Não há vento favorável para quem não sabe para onde vai.",
    autor: "Sêneca", obra: "Cartas a Lucílio, 71" },
  { texto: "A saúde do povo deve ser a lei suprema.",
    autor: "Cícero", obra: "Das Leis, III" },
  { texto: "O todo é maior que a soma das partes.",
    autor: "Aristóteles", obra: "Metafísica" },
  { texto: "Uma jornada de mil milhas começa com um único passo.",
    autor: "Lao-Tsé", obra: "Tao Te Ching, 64" },
  { texto: "Nenhum homem entra duas vezes no mesmo rio, pois o rio já não é o mesmo, nem ele.",
    autor: "Heráclito" },
  { texto: "A justiça é a constante e perpétua vontade de dar a cada um o que é seu.",
    autor: "Ulpiano", obra: "Digesto, I" },
  { texto: "Enquanto adiamos, a vida passa.",
    autor: "Sêneca", obra: "Cartas a Lucílio, 1" },
  { texto: "O tempo descobre a verdade.",
    autor: "Sêneca", obra: "Sobre a Ira" },

  // --- Pensamento moderno ---
  { texto: "Saber não basta; é preciso aplicar. Querer não basta; é preciso fazer.",
    autor: "Goethe" },
  { texto: "Nada é mais difícil, e portanto mais precioso, do que ser capaz de decidir.",
    autor: "Napoleão Bonaparte" },
  { texto: "A dúvida é o princípio da sabedoria.",
    autor: "Descartes" },
  { texto: "Homem algum é uma ilha, completa em si mesma.",
    autor: "John Donne", obra: "Meditação XVII" },
  { texto: "Sabemos o que somos, mas não sabemos o que podemos ser.",
    autor: "Shakespeare", obra: "Hamlet" },
  { texto: "O preço da grandeza é a responsabilidade.",
    autor: "Winston Churchill" },
  { texto: "Aquilo que se faz por amor está sempre além do bem e do mal.",
    autor: "Nietzsche", obra: "Além do Bem e do Mal" },
  { texto: "A liberdade consiste em poder fazer tudo aquilo que não prejudique a outrem.",
    autor: "Declaração dos Direitos do Homem e do Cidadão", obra: "1789, art. 4º" },

  // --- Pensamento brasileiro ---
  { texto: "A pátria não é ninguém: são todos.",
    autor: "Rui Barbosa", obra: "Oração aos Moços" },
  { texto: "O ofício de escrever é um ofício de paciência.",
    autor: "Machado de Assis" },
  { texto: "A vida é uma ópera e uma grande ópera.",
    autor: "Machado de Assis", obra: "Dom Casmurro" },
  { texto: "Ninguém educa ninguém, ninguém educa a si mesmo: os homens se educam entre si.",
    autor: "Paulo Freire", obra: "Pedagogia do Oprimido" },
  { texto: "O correr da vida embrulha tudo. A vida é assim: esquenta e esfria, aperta e daí afrouxa.",
    autor: "Guimarães Rosa", obra: "Grande Sertão: Veredas" },

  // --- Trabalho, método e prudência ---
  { texto: "A perfeição é atingida não quando não há mais nada a acrescentar, mas quando não há mais nada a retirar.",
    autor: "Antoine de Saint-Exupéry", obra: "Terra dos Homens" },
  { texto: "Quem não sabe o que procura, não entende o que encontra.",
    autor: "Claude Bernard" },
  { texto: "Dê-me seis horas para derrubar uma árvore e passarei as quatro primeiras afiando o machado.",
    autor: "Abraham Lincoln" },
  { texto: "Tudo deveria ser feito da forma mais simples possível, mas não mais simples que isso.",
    autor: "Albert Einstein" },
  { texto: "O que é afirmado sem prova pode ser negado sem prova.",
    autor: "Euclides", obra: "atribuído" },
];

// Sorteia uma frase diferente da última exibida nesta sessão
let ultimaFrase = -1;
function sortearFrase() {
  if (FRASES.length <= 1) return 0;
  let i = Math.floor(Math.random() * FRASES.length);
  if (i === ultimaFrase) i = (i + 1) % FRASES.length;
  ultimaFrase = i;
  return i;
}

// Nota: as "dicas do dia" que giravam na barra lateral foram substituídas pelo sino de
// notificações no cabeçalho, que mostra pendências reais do usuário em vez de dicas fixas.

// ---------- Lista de documentos avulsos (declarações e justificativas) ----------
// Mesmo comportamento das duas listas: abrir, excluir com confirmação e criar novo.
function ListaDocumentos({ titulo, docs, onAbrir, onExcluir, onDuplicar, onNovo, icone: Icone, vazio, secretarias, mostrarSecretaria }) {
  const [aExcluir, setAExcluir] = useState(null);

  function pedirExclusao(doc, e) {
    e.stopPropagation();
    setAExcluir(doc);
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          {titulo} {docs.length > 0 && `(${docs.length})`}
        </h2>
        <button onClick={onNovo} className="text-xs font-medium flex items-center gap-1" style={{ color: C.brass }}>
          <Plus size={12} /> Novo
        </button>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center" style={{ borderColor: C.border }}>
          <p className="text-xs" style={{ color: C.inkMuted }}>{vazio}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {docs.map((doc, idx) => {
            return (
              <div key={doc.id} onClick={() => onAbrir(doc)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/[0.02] group"
                style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : "none" }}>
                <Icone size={15} className="shrink-0" style={{ color: C.brass }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{tituloDocumento(doc)}</p>
                  <p className="text-xs flex items-center gap-1.5" style={{ color: C.inkMuted }}>
                    {mostrarSecretaria && secretariaDoDoc(doc, secretarias)?.sigla && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: C.paperDark, color: C.brass }}>
                        {secretariaDoDoc(doc, secretarias).sigla}
                      </span>
                    )}
                    editado {fmtDateRelativa(doc.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); onDuplicar(doc, e); }}
                    className="p-1" style={{ color: C.inkMuted }} title="Duplicar">
                    <Copy size={14} />
                  </button>
                  <button onClick={e => pedirExclusao(doc, e)}
                    className="p-1" style={{ color: C.inkMuted }} title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Mover para a lixeira?"
          descricao={`"${tituloDocumento(aExcluir)}" ficará na lixeira por ${DIAS_NA_LIXEIRA} dias e poderá ser restaurado nesse período.`}
          textoBotao="Mover para a lixeira"
          onConfirmar={() => { onExcluir(aExcluir.id, { stopPropagation() {} }); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  );
}

// ---------- List View ----------
// ---------- Painel principal ----------
// Barra lateral fixa + área de conteúdo. As abas trocam o conteúdo sem sair da tela.
function ListView({ etps, todosEtps, justificativas, declaracoes,
  secretarias, secretariaAtiva, setSecretariaAtiva,
  loading, search, setSearch,
  onOpen, onNew, onDelete, onDuplicar,
  onAbrirDeclaracao, onNovaDeclaracao, onExcluirDeclaracao, onDuplicarDeclaracao,
  onAbrirJustificativa, onNovaJustificativa, onExcluirJustificativa, onDuplicarJustificativa,
  onSalvarSecretaria, onNovaSecretaria, onExcluirSecretaria, onRecarregar,
  usuarios, emailUsuario, usuarioAtual, permissoes, onSalvarUsuario, onExcluirUsuario,
  normativos, onUploadNormativo, onExcluirNormativo,
  lixeira, onRestaurar, onApagarDefinitivo, onEsvaziar }) {

  const [aba, setAba] = useState("painel");
  const [showGuia, setShowGuia] = useState(false);
  const [novoDoc, setNovoDoc] = useState(null); // { tipo, tipoInicial }
  const [frase] = useState(sortearFrase);
  const [notifAberta, setNotifAberta] = useState(false);
  const saudacao = saudacaoPorHora();
  const nome = primeiroNomeDe(usuarioAtual?.nomeCompleto);
  const [aExcluir, setAExcluir] = useState(null);   // ETP aguardando confirmação

  function pedirExclusao(etp, e) {
    e.stopPropagation();
    setAExcluir(etp);
  }

  const base = todosEtps || etps;

  // ---- Notificações: pendências reais, calculadas a partir dos próprios ETPs — nunca inventadas ----
  // Dois sinais: (1) impeditivos do checklist de conformidade e (2) ETP sem edição há mais
  // de 15 dias e ainda não concluído. Ordenado do mais urgente (mais impeditivos) para o menos.
  const DIAS_ETP_PARADO = 15;
  const notificacoes = useMemo(() => {
    const agora = Date.now();
    return base
      .filter(e => situacaoEtp(e).chave !== "concluido")
      .map(etp => {
        const impeditivos = verificarConformidade(etp).filter(a => a.nivel === "impeditivo").length;
        const diasParado = Math.floor((agora - etp.updatedAt) / 86400000);
        const parado = diasParado >= DIAS_ETP_PARADO;
        if (impeditivos === 0 && !parado) return null;
        return { etp, impeditivos, diasParado, parado };
      })
      .filter(Boolean)
      .sort((a, b) => b.impeditivos - a.impeditivos || b.diasParado - a.diasParado);
  }, [base]);
  const porSituacao = { concluido: [], elaboracao: [], rascunho: [] };
  base.forEach(e => porSituacao[situacaoEtp(e).chave].push(e));
  const valorTotal = base.reduce((soma, e) => soma + valorTotalEtp(e), 0);
  const pctConcluidos = base.length ? Math.round((porSituacao.concluido.length / base.length) * 100) : 0;
  const recentes = [...base].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);


  const secAtiva = secretarias.find(x => x.id === secretariaAtiva);

  const menu = [
    { id: "painel", rotulo: "Painel", icone: ClipboardList },
    { id: "etps", rotulo: "Meus ETPs", icone: FileText, contador: base.length },
    { id: "declaracoes", rotulo: "Declarações de PCA", icone: ListChecks, contador: declaracoes.length },
    { id: "justificativas", rotulo: "Justificativas", icone: FileEdit, contador: justificativas.length },
    { id: "secretarias", rotulo: "Entidades", icone: Building2, contador: secretarias.length, somenteAdmin: true },
    { id: "usuarios", rotulo: "Usuários", icone: Users, contador: usuarios.length, somenteAdmin: true },
    { id: "normativos", rotulo: "Materiais Normativos", icone: Scale, contador: normativos.length },
    { id: "lixeira", rotulo: "Lixeira", icone: Trash2, contador: lixeira.length },
    { id: "backup", rotulo: "Backup", icone: Download },
  ].filter(m => !m.somenteAdmin || permissoes.gerenciarEntidades);

  return (
    <div className="flex min-h-screen" style={{ background: C.paperDark }}>

      {/* ---------- Barra lateral ---------- */}
      <aside className="w-60 shrink-0 flex flex-col sticky top-0 h-screen" style={{ background: C.navyDark }}>
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.brass }}>
            <ClipboardList size={20} style={{ color: C.navyDark }} />
          </div>
          <div className="min-w-0">
            <p className="serif text-base font-semibold leading-tight" style={{ color: C.paper }}>ETP Inteligente</p>
            <p className="text-[10px] leading-tight" style={{ color: "#8A93A3" }}>Estudo Técnico Preliminar</p>
          </div>
        </div>

        <nav className="px-3 mt-2 flex-1 overflow-y-auto etp-scroll">
          {menu.map(m => {
            const ativo = !m.acao && aba === m.id;
            return (
              <button key={m.id} onClick={() => (m.acao ? m.acao() : setAba(m.id))}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 text-sm"
                style={{
                  background: ativo ? C.brass : "transparent",
                  color: ativo ? C.navyDark : "#B7C0CC",
                  fontWeight: ativo ? 600 : 500,
                }}>
                <m.icone size={16} className="shrink-0" />
                <span className="flex-1 text-left">{m.rotulo}</span>
                {m.contador > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: ativo ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)", color: ativo ? C.navyDark : "#8A93A3" }}>
                    {m.contador}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ---------- Conteúdo ---------- */}
      <div className="flex-1 min-w-0 flex flex-col">

        <header className="flex items-center gap-3 px-7 py-3.5 border-b flex-wrap"
          style={{ borderColor: C.border, background: "white" }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 size={15} className="shrink-0" style={{ color: C.brass }} />
            <select value={secretariaAtiva} onChange={e => setSecretariaAtiva(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border text-xs bg-white max-w-[300px]"
              style={{ borderColor: C.border, color: C.navy }}>
              <option value="todas">Todas as Entidades</option>
              {secretarias.map(x => (
                <option key={x.id} value={x.id}>{x.sigla ? `${x.sigla} — ${x.nome}` : (x.nome || "Sem nome")}</option>
              ))}
            </select>
          </div>
          <div className="relative shrink-0">
            <button onClick={() => setNotifAberta(v => !v)}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg border"
              style={{ borderColor: C.border, color: C.navy, background: "white" }}
              title="Notificações" aria-label="Notificações">
              <Bell size={15} />
              {notificacoes.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
                  style={{ background: C.red, color: "white" }}>
                  {notificacoes.length}
                </span>
              )}
            </button>
            {notifAberta && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifAberta(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border z-20 overflow-hidden"
                  style={{ borderColor: C.border, background: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
                    <p className="text-sm font-semibold" style={{ color: C.navy }}>Notificações</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto etp-scroll">
                    {notificacoes.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-center" style={{ color: C.inkMuted }}>
                        Nenhuma pendência no momento.
                      </p>
                    ) : notificacoes.slice(0, 8).map(n => (
                      <button key={n.etp.id} onClick={() => { setNotifAberta(false); onOpen(n.etp); }}
                        className="w-full text-left flex items-start gap-2.5 px-4 py-3 border-b hover:bg-black/[0.02]"
                        style={{ borderColor: C.border }}>
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: n.impeditivos > 0 ? C.red : C.brass }} />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium truncate" style={{ color: C.navy }}>
                            {n.etp.meta.titulo || "ETP sem título"}
                          </span>
                          <span className="block text-[11px]" style={{ color: C.inkMuted }}>
                            {n.impeditivos > 0
                              ? `${n.impeditivos} pendência(s) impeditiva(s)`
                              : `Sem atualização há ${n.diasParado} dias`}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setShowGuia(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0"
            style={{ borderColor: C.border, color: C.navy, background: "white" }}>
            <FileText size={14} /> Guia rápido
          </button>
          <div className="pl-3 border-l shrink-0 hidden sm:block" style={{ borderColor: C.border }}>
            <p className="text-[11px]" style={{ color: C.inkMuted }}>
              {secAtiva ? (secAtiva.sigla || secAtiva.nome) : "Todas as Entidades"}
            </p>
          </div>
        </header>

        <main className="flex-1 px-7 py-6 overflow-y-auto etp-scroll">

          {aba === "painel" && (
            <>
              {/* ---------- Cabeçalho: saudação + ações principais ---------- */}
              <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
                <div className="min-w-0">
                  <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>
                    {nome ? `${saudacao}, ${nome}.` : `${saudacao}.`}
                  </h1>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: C.inkMuted }}>
                    <span className="italic">“{FRASES[frase].texto}”</span>
                    <span className="ml-1.5 whitespace-nowrap" style={{ color: C.brass }}>— {FRASES[frase].autor}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button onClick={() => setNovoDoc({ tipo: "declaracao" })}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-sm font-medium hover:bg-black/[0.02]"
                    style={{ borderColor: C.border, color: C.navy, background: "white" }}>
                    <ListChecks size={15} style={{ color: C.brass }} /> Declaração de PCA
                  </button>
                  <button onClick={() => setNovoDoc({ tipo: "justificativa" })}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-sm font-medium hover:bg-black/[0.02]"
                    style={{ borderColor: C.border, color: C.navy, background: "white" }}>
                    <FileEdit size={15} style={{ color: C.brass }} /> Justificativa
                  </button>
                  <button onClick={() => setNovoDoc({ tipo: "etp" })}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm"
                    style={{ background: C.navy, color: C.paper }}>
                    <Plus size={16} /> Novo ETP
                  </button>
                </div>
              </div>

              {/* ---------- Faixa proativa: pendências reais, mesmo dado do sino de notificações ---------- */}
              {notificacoes.length > 0 && (() => {
                const impeditivosTotais = notificacoes.filter(n => n.impeditivos > 0).length;
                const paradosTotais = notificacoes.filter(n => n.impeditivos === 0 && n.parado).length;
                const partes = [];
                if (impeditivosTotais > 0) partes.push(`${impeditivosTotais} ETP${impeditivosTotais > 1 ? "s" : ""} com pendência impeditiva`);
                if (paradosTotais > 0) partes.push(`${paradosTotais} ETP${paradosTotais > 1 ? "s" : ""} sem atualização há mais de ${DIAS_ETP_PARADO} dias`);
                return (
                  <div className="rounded-xl px-4 py-3 flex items-center gap-3 mb-5"
                    style={{ background: "rgba(166,131,46,0.1)" }}>
                    <AlertTriangle size={17} className="shrink-0" style={{ color: C.brass }} />
                    <span className="text-sm flex-1" style={{ color: C.ink }}>{partes.join(" · ")}.</span>
                    <button onClick={() => setNotifAberta(true)}
                      className="text-xs font-semibold shrink-0" style={{ color: C.brass }}>
                      Ver pendências
                    </button>
                  </div>
                );
              })()}

              {/* ---------- Resumo: um único cartão com números + barra de progresso ---------- */}
              {base.length > 0 && (() => {
                const fatias = [
                  { rotulo: "Concluídos", n: porSituacao.concluido.length, cor: C.green },
                  { rotulo: "Em elaboração", n: porSituacao.elaboracao.length, cor: C.brass },
                  { rotulo: "Rascunhos", n: porSituacao.rascunho.length, cor: "#C9C2B2" },
                ];
                return (
                  <div className="rounded-xl border p-5 mb-5" style={{ borderColor: C.border, background: "white" }}>
                    <div className="flex items-start justify-between gap-6 flex-wrap">
                      <div className="flex items-baseline gap-2">
                        <span className="serif text-3xl font-semibold leading-none" style={{ color: C.navy }}>{base.length}</span>
                        <span className="text-sm" style={{ color: C.ink }}>
                          ETP{base.length === 1 ? "" : "s"}{secAtiva ? ` em ${secAtiva.sigla || secAtiva.nome}` : ""}
                        </span>
                        <span className="text-sm ml-1" style={{ color: C.inkMuted }}>
                          · {pctConcluidos}% concluído{pctConcluidos === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs" style={{ color: C.inkMuted }}>Valor estimado somado</span>
                        <span className="serif text-xl font-semibold" style={{ color: C.navy }}>{brl(valorTotal)}</span>
                      </div>
                    </div>

                    <div className="flex h-2.5 rounded-full overflow-hidden mt-4" style={{ background: C.paperDark }}>
                      {fatias.map(f => f.n > 0 && (
                        <div key={f.rotulo} style={{ width: `${(f.n / base.length) * 100}%`, background: f.cor }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-5 mt-2.5 flex-wrap">
                      {fatias.map(f => (
                        <span key={f.rotulo} className="flex items-center gap-1.5 text-xs" style={{ color: C.ink }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.cor }} />
                          {f.rotulo}
                          <b style={{ color: C.navy }}>{f.n}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ---------- ETPs recentes ---------- */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: C.border }}>
                  <h3 className="serif text-base font-semibold" style={{ color: C.navy }}>ETPs recentes</h3>
                  {recentes.length > 0 && (
                    <button onClick={() => setAba("etps")} className="text-xs font-medium" style={{ color: C.brass }}>
                      Ver todos
                    </button>
                  )}
                </div>
                {recentes.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <FileText size={28} className="mx-auto mb-2" style={{ color: C.border }} />
                    <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Comece pelo primeiro ETP</p>
                    <p className="text-sm mb-4 max-w-sm mx-auto leading-relaxed" style={{ color: C.inkMuted }}>
                      O app conduz as etapas — itens, PCA, preços e os 13 incisos do art. 18 — e exporta o documento pronto.
                    </p>
                    <button onClick={() => setNovoDoc({ tipo: "etp" })}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                      style={{ background: C.navy, color: C.paper }}>
                      Criar o primeiro ETP
                    </button>
                    <p className="text-[11px] mt-3" style={{ color: C.inkMuted }}>
                      Primeira vez por aqui? Abra o <button onClick={() => setShowGuia(true)} className="underline font-medium" style={{ color: C.brass }}>guia rápido</button>.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto etp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: "560px" }}>
                      <thead>
                        <tr style={{ background: C.paperDark }}>
                          <th className="text-left px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Título / Objeto</th>
                          <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-28" style={{ color: C.inkMuted }}>Atualizado</th>
                          <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-32" style={{ color: C.inkMuted }}>Situação</th>
                          <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-20" style={{ color: C.inkMuted }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentes.map(etp => {
                          const sit = situacaoEtp(etp);
                          const sec = secretariaDoDoc(etp, secretarias);
                          return (
                            <tr key={etp.id} className="border-t hover:bg-black/[0.015] cursor-pointer"
                              style={{ borderColor: C.border }} onClick={() => onOpen(etp)}>
                              <td className="px-5 py-3">
                                <p className="font-medium truncate" style={{ color: C.navy }}>
                                  {etp.meta.titulo || "ETP sem título"}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: C.inkMuted }}>
                                  {sec?.sigla ? `${sec.sigla} · ` : ""}{etp.meta.setor || etp.meta.orgao || "Setor não informado"}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-xs" style={{ color: C.inkMuted }}>
                                {fmtDateRelativa(etp.updatedAt)}
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full"
                                  style={{ background: `${sit.cor}1A`, color: sit.cor }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sit.cor }} />
                                  {sit.rotulo}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1">
                                  <button onClick={e => { e.stopPropagation(); onDuplicar(etp, e); }}
                                    className="p-1.5 rounded" style={{ color: C.inkMuted }} title="Duplicar">
                                    <Copy size={14} />
                                  </button>
                                  <button onClick={e => pedirExclusao(etp, e)}
                                    className="p-1.5 rounded" style={{ color: C.inkMuted }} title="Excluir">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {aba === "etps" && (
            <>
              <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                <div>
                  <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Meus ETPs</h1>
                  <p className="text-sm" style={{ color: C.inkMuted }}>
                    {base.length} estudo(s){secAtiva ? ` em ${secAtiva.sigla || secAtiva.nome}` : ""}.
                  </p>
                </div>
                <button onClick={() => setNovoDoc({ tipo: "etp" })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm shrink-0"
                  style={{ background: C.navy, color: C.paper }}>
                  <Plus size={16} /> Novo ETP
                </button>
              </div>

              <div className="relative mb-5 max-w-lg">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkMuted }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por título, órgão, nº de processo ou responsável..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: C.border, background: "white" }} />
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: C.inkMuted }}>Carregando...</p>
              ) : etps.length === 0 ? (
                <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
                  <FileText size={30} className="mx-auto mb-3" style={{ color: C.border }} />
                  <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
                    {search ? "Nenhum ETP encontrado" : "Nenhum ETP criado ainda"}
                  </p>
                  <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
                    {search ? "Tente outro termo de busca." : "Comece cadastrando os itens da contratação."}
                  </p>
                  {!search && (
                    <button onClick={() => setNovoDoc({ tipo: "etp" })}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm"
                      style={{ background: C.navy, color: C.paper }}>
                      <Plus size={16} /> Criar o primeiro ETP
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {etps.map(etp => {
                    const p = progress(etp);
                    const sit = situacaoEtp(etp);
                    const sec = secretariaDoDoc(etp, secretarias);
                    const qtdItens = (etp.itens || []).length;
                    const valorEtp = valorTotalEtp(etp);
                    const pendencias = verificarConformidade(etp).filter(a => a.nivel === "impeditivo").length;
                    const responsaveis = listaResponsaveis(etp);
                    const responsavel = responsaveis.length === 0 ? null
                      : responsaveis.length === 1 ? responsaveis[0].nome
                      : `${responsaveis[0].nome} e +${responsaveis.length - 1}`;
                    const previstosPca = etp.pca ? contarPrevistosNoPca(etp) : 0;
                    return (
                      <div key={etp.id} onClick={() => onOpen(etp)}
                        className="group relative p-5 rounded-xl border cursor-pointer hover:shadow-sm"
                        style={{ borderColor: C.border, background: "white" }}>
                        <div className="absolute top-4 right-4 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); onDuplicar(etp, e); }}
                            className="p-1.5 rounded-md" style={{ color: C.inkMuted }} title="Duplicar">
                            <Copy size={15} />
                          </button>
                          <button onClick={e => pedirExclusao(etp, e)}
                            className="p-1.5 rounded-md" style={{ color: C.inkMuted }} title="Excluir">
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <h3 className="serif text-lg font-semibold pr-16 mb-1" style={{ color: C.navy }}>
                          {etp.meta.titulo || "ETP sem título"}
                        </h3>
                        <p className="text-xs mb-3 flex items-center gap-1.5 flex-wrap" style={{ color: C.inkMuted }}>
                          {secretariaAtiva === "todas" && sec?.sigla && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: C.paperDark, color: C.brass }}>{sec.sigla}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Building2 size={12} /> {etp.meta.orgao || "Órgão não informado"}
                            {etp.meta.processo && ` · Proc. ${etp.meta.processo}`}
                          </span>
                        </p>

                        {/* Números que ajudam a decidir se vale abrir */}
                        <div className="grid grid-cols-3 gap-2 mb-3 py-2 px-1 rounded-lg" style={{ background: C.paperDark }}>
                          <div className="text-center">
                            <p className="text-sm font-semibold leading-none" style={{ color: C.navy }}>{qtdItens}</p>
                            <p className="text-[9.5px] mt-1" style={{ color: C.inkMuted }}>
                              {qtdItens === 1 ? "item" : "itens"}
                            </p>
                          </div>
                          <div className="text-center border-x" style={{ borderColor: C.border }}>
                            <p className="text-sm font-semibold leading-none"
                              style={{ color: valorEtp > 0 ? C.navy : C.inkMuted }}>
                              {valorEtp > 0 ? brl(valorEtp) : "—"}
                            </p>
                            <p className="text-[9.5px] mt-1" style={{ color: C.inkMuted }}>estimado</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold leading-none"
                              style={{ color: pendencias > 0 ? C.red : C.green }}>
                              {pendencias > 0 ? pendencias : "✓"}
                            </p>
                            <p className="text-[9.5px] mt-1" style={{ color: C.inkMuted }}>
                              {pendencias > 0 ? "pendência(s)" : "conforme"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: C.paperDark }}>
                            <div className="h-1.5 rounded-full" style={{ width: p.pct + "%", background: sit.cor }} />
                          </div>
                          <span className="text-[11px] shrink-0" style={{ color: C.inkMuted }}>
                            {p.filled}/{p.total} incisos
                          </span>
                        </div>

                        {/* Detalhes em linha, cada um só aparece se houver dado */}
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[10.5px] mb-2.5"
                          style={{ color: C.inkMuted }}>
                          {etp.meta.tipo && <span>{etp.meta.tipo}</span>}
                          {responsavel && <span>· {responsavel}</span>}
                          {etp.pca && (
                            <span>· PCA: {previstosPca}/{qtdItens}</span>
                          )}
                          <span>· criado {fmtDate(etp.createdAt)}</span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${sit.cor}1A`, color: sit.cor }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sit.cor }} />
                            {sit.rotulo}
                          </span>
                          <span style={{ color: C.inkMuted }}>editado {fmtDateRelativa(etp.updatedAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {aba === "declaracoes" && (
            <>
              <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Declarações de previsão no PCA</h1>
              <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
                Confere se os itens constam no Plano de Contratações Anual e gera o documento para o processo.
              </p>
              <ListaDocumentos titulo="Declarações" docs={declaracoes}
                onAbrir={onAbrirDeclaracao} onExcluir={onExcluirDeclaracao} onDuplicar={onDuplicarDeclaracao}
                onNovo={() => setNovoDoc({ tipo: "declaracao" })} icone={ListChecks} vazio="Nenhuma declaração criada ainda."
                secretarias={secretarias} mostrarSecretaria={secretariaAtiva === "todas"} />
            </>
          )}

          {aba === "usuarios" && (
            <UsuariosView usuarios={usuarios} secretarias={secretarias} emailAtual={emailUsuario}
              onSalvar={onSalvarUsuario} onNovo={onSalvarUsuario} onExcluir={onExcluirUsuario} />
          )}

          {aba === "secretarias" && (
            <SecretariasView secretarias={secretarias} onSalvar={onSalvarSecretaria}
              onNova={onNovaSecretaria} onExcluir={onExcluirSecretaria} />
          )}

          {aba === "normativos" && (
            <NormativosView normativos={normativos} onUpload={onUploadNormativo} onExcluir={onExcluirNormativo} />
          )}

          {aba === "lixeira" && (
            <LixeiraView lixeira={lixeira} onRestaurar={onRestaurar} onApagar={onApagarDefinitivo}
              onEsvaziar={onEsvaziar} podeEsvaziar={permissoes.esvaziarLixeira} />
          )}

          {aba === "backup" && <TelaBackup onRestaurado={onRecarregar} />}

          {aba === "justificativas" && (
            <>
              <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Justificativas de aquisição</h1>
              <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
                Documento anterior à aquisição, com os dados do processo e o texto de justificativa.
              </p>
              <ListaDocumentos titulo="Justificativas" docs={justificativas}
                onAbrir={onAbrirJustificativa} onExcluir={onExcluirJustificativa} onDuplicar={onDuplicarJustificativa}
                onNovo={() => setNovoDoc({ tipo: "justificativa" })} icone={FileEdit} vazio="Nenhuma justificativa criada ainda."
                secretarias={secretarias} mostrarSecretaria={secretariaAtiva === "todas"} />
            </>
          )}
        </main>

        <footer className="px-7 py-4 border-t flex items-center gap-2 flex-wrap"
          style={{ borderColor: C.border, background: "white" }}>
          <ClipboardList size={14} style={{ color: C.brass }} />
          <span className="text-xs" style={{ color: C.inkMuted }}>
            ETP Inteligente — Para atender a Lei nº 14.133/2021, art. 18
          </span>
          <span className="ml-auto text-xs" style={{ color: C.inkMuted }}>
            Desenvolvido por Luís Eduardo Monteiro Lima
          </span>
        </footer>
      </div>

      {showGuia && <GuiaRapido onFechar={() => setShowGuia(false)} />}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Mover para a lixeira?"
          descricao={`"${aExcluir.meta?.titulo || "ETP sem título"}" ficará na lixeira por ${DIAS_NA_LIXEIRA} dias e poderá ser restaurado nesse período.`}
          textoBotao="Mover para a lixeira"
          onConfirmar={() => { onDelete(aExcluir.id, { stopPropagation() {} }); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}

      {novoDoc && (
        <JanelaNovoDocumento
          inicial={novoDoc}
          secretarias={secretarias}
          secretariaAtiva={secretariaAtiva}
          onFechar={() => setNovoDoc(null)}
          onCriar={dados => {
            setNovoDoc(null);
            if (dados.tipo === "etp") onNew(dados);
            else if (dados.tipo === "declaracao") onNovaDeclaracao(dados);
            else onNovaJustificativa(dados);
          }}
        />
      )}
    </div>
  );
}


// ---------- Backup ----------
function TelaBackup({ onRestaurado }) {
  const [exportando, setExportando] = useState(false);
  const [resumoAtual, setResumoAtual] = useState(null);
  const [arquivo, setArquivo] = useState(null);   // { pacote, resumo }
  const [modo, setModo] = useState("mesclar");
  const [erro, setErro] = useState("");
  const [restaurando, setRestaurando] = useState(false);
  const [feito, setFeito] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    montarBackup().then(p => setResumoAtual(resumirBackup(p))).catch(() => {});
  }, []);

  async function exportar() {
    setExportando(true);
    setErro("");
    try {
      const pacote = await montarBackup();
      baixarBackup(pacote);
      setFeito("Backup baixado. Guarde o arquivo num lugar seguro — de preferência numa pasta sincronizada.");
      setTimeout(() => setFeito(""), 6000);
    } catch (e) {
      console.error(e);
      setErro("Não foi possível gerar o backup.");
    }
    setExportando(false);
  }

  async function escolherArquivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro("");
    setArquivo(null);
    try {
      const texto = await f.text();
      const pacote = lerBackup(texto);
      setArquivo({ pacote, resumo: resumirBackup(pacote), nome: f.name });
    } catch (err) {
      setErro(err.message || "Arquivo inválido.");
    }
    e.target.value = "";
  }

  async function confirmarRestauracao() {
    setRestaurando(true);
    setErro("");
    try {
      await restaurarBackup(arquivo.pacote, modo);
      setArquivo(null);
      setFeito("Backup restaurado.");
      onRestaurado?.();
    } catch (e) {
      console.error(e);
      setErro("Falha ao restaurar. Nada foi perdido — tente novamente.");
    }
    setRestaurando(false);
  }

  const linhaResumo = (r) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
      {[["ETPs", r.etps], ["Justificativas", r.justificativas], ["Declarações", r.declaracoes], ["Secretarias", r.secretarias]]
        .map(([rot, n]) => (
          <div key={rot} className="px-2 py-2.5 rounded-lg" style={{ background: C.paperDark }}>
            <p className="serif text-xl font-semibold leading-none" style={{ color: C.navy }}>{n}</p>
            <p className="text-[10.5px] mt-1" style={{ color: C.inkMuted }}>{rot}</p>
          </div>
        ))}
    </div>
  );

  return (
    <>
      <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Backup</h1>
      <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
        Seus documentos ficam gravados apenas neste navegador. Baixe uma cópia de tempos em tempos — é o
        que permite recuperar tudo se a máquina for formatada ou os dados do site forem limpos.
      </p>

      {feito && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2 text-xs"
          style={{ background: "rgba(76,124,89,0.1)", color: C.ink }}>
          <Check size={14} className="shrink-0 mt-0.5" style={{ color: C.green }} /> {feito}
        </div>
      )}
      {erro && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2 text-xs"
          style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: C.red }} /> {erro}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Exportar */}
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Download size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Salvar cópia</span>
          </div>
          <h3 className="serif text-lg font-semibold mb-3" style={{ color: C.navy }}>Exportar tudo</h3>

          {resumoAtual ? (
            <>
              {linhaResumo(resumoAtual)}
              <p className="text-[11px] mt-3" style={{ color: C.inkMuted }}>
                Inclui também {resumoAtual.temPca ? "a planilha do PCA importada, " : ""}
                {resumoAtual.temTimbre ? "o timbre geral " : ""}e o diretório de responsáveis.
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: C.inkMuted }}>Levantando o que há para salvar...</p>
          )}

          <button onClick={exportar} disabled={exportando}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: C.navy, color: C.paper }}>
            {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {exportando ? "Preparando..." : "Baixar backup (.json)"}
          </button>

          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
            style={{ background: C.paperDark, color: C.inkMuted }}>
            <Info size={13} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
            <span>
              Salve numa pasta do OneDrive, Google Drive ou na rede da Prefeitura: assim o arquivo sobe
              sozinho para a nuvem e você fica protegido mesmo se perder o computador.
            </span>
          </div>
        </div>

        {/* Importar */}
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Upload size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Recuperar</span>
          </div>
          <h3 className="serif text-lg font-semibold mb-3" style={{ color: C.navy }}>Importar backup</h3>

          {!arquivo ? (
            <>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: C.inkMuted }}>
                Escolha um arquivo gerado por este app. Antes de gravar qualquer coisa, você verá o que ele
                contém e escolherá como restaurar.
              </p>
              <input ref={inputRef} type="file" accept=".json,application/json" onChange={escolherArquivo} className="hidden" />
              <button onClick={() => inputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border"
                style={{ borderColor: C.border, color: C.navy, background: "white" }}>
                <Upload size={15} /> Escolher arquivo
              </button>
            </>
          ) : (
            <>
              <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
                <b style={{ color: C.navy }}>{arquivo.nome}</b>
                {arquivo.resumo.geradoEm && ` · gerado em ${fmtDate(new Date(arquivo.resumo.geradoEm).getTime())}`}
              </p>
              {linhaResumo(arquivo.resumo)}

              <div className="mt-4 space-y-2">
                {[
                  ["mesclar", "Mesclar com o que já existe", "Mantém seus documentos atuais. Documentos de mesmo identificador são substituídos pela versão do arquivo."],
                  ["substituir", "Substituir tudo", "Apaga os documentos atuais e deixa apenas os do arquivo."],
                ].map(([v, titulo, desc]) => (
                  <label key={v} className="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer"
                    style={{
                      borderColor: modo === v ? C.brass : C.border,
                      background: modo === v ? "rgba(166,131,46,0.06)" : "white",
                    }}>
                    <input type="radio" name="modo-restauracao" checked={modo === v} onChange={() => setModo(v)}
                      className="mt-0.5" style={{ accentColor: C.brass }} />
                    <span>
                      <span className="block text-xs font-semibold" style={{ color: C.navy }}>{titulo}</span>
                      <span className="block text-[11px] leading-snug mt-0.5" style={{ color: C.inkMuted }}>{desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              {modo === "substituir" && (
                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
                  style={{ background: "rgba(166,64,61,0.08)", color: C.ink }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.red }} />
                  <span>
                    Seus {resumoAtual?.etps || 0} ETP(s), {resumoAtual?.justificativas || 0} justificativa(s) e{" "}
                    {resumoAtual?.declaracoes || 0} declaração(ões) atuais serão apagados. Se ainda não baixou um
                    backup do estado de hoje, faça isso antes.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => setArquivo(null)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                  Cancelar
                </button>
                <button onClick={confirmarRestauracao} disabled={restaurando}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                  style={{ background: modo === "substituir" ? C.red : C.navy, color: "white" }}>
                  {restaurando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {restaurando ? "Restaurando..." : modo === "substituir" ? "Substituir tudo" : "Mesclar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- Confirmação de exclusão ----------
// Substitui o clique duplo, que era fácil demais de disparar sem querer.
function ConfirmarExclusao({ titulo, descricao, textoBotao = "Excluir", onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(18,32,50,0.6)" }} onClick={onCancelar}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(166,64,61,0.1)" }}>
            <AlertCircle size={19} style={{ color: C.red }} />
          </div>
          <div>
            <h3 className="serif text-lg font-semibold leading-tight" style={{ color: C.navy }}>{titulo}</h3>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: C.inkMuted }}>{descricao}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancelar}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}>
            Cancelar
          </button>
          <button onClick={onConfirmar}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: C.red, color: "white" }}>
            {textoBotao}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatarBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------- Materiais Normativos ----------
// Biblioteca de referência: leis, decretos e normativas locais em PDF, para consulta rápida
// durante a elaboração do ETP. Cada registro guarda o PDF já em base64 (o storage.js cuida de
// fatiar automaticamente arquivos grandes) — não há servidor de arquivos separado a manter.
function NormativosView({ normativos, onUpload, onExcluir }) {
  const fileRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aExcluir, setAExcluir] = useState(null);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setErro("Envie apenas arquivos em PDF."); return; }
    if (file.size > 8 * 1024 * 1024) { setErro("Arquivo maior que 8 MB — reduza o PDF antes de enviar."); return; }
    setErro("");
    setEnviando(true);
    try {
      await onUpload(file);
    } catch {
      setErro("Não foi possível enviar o arquivo. Tente novamente.");
    }
    setEnviando(false);
  }

  const ordenados = [...normativos].sort((a, b) => b.enviadoEm - a.enviadoEm);

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Materiais Normativos</h1>
          <p className="text-sm max-w-xl leading-relaxed" style={{ color: C.inkMuted }}>
            Leis, decretos e normativas locais sobre a elaboração do ETP, disponíveis para consulta
            por qualquer usuário do sistema.
          </p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={enviando}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm shrink-0 disabled:opacity-60"
          style={{ background: C.navy, color: C.paper }}>
          <Upload size={16} /> {enviando ? "Enviando..." : "Enviar PDF"}
        </button>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
      </div>

      {erro && (
        <p className="text-xs mb-4 px-3 py-2.5 rounded-lg" style={{ background: "rgba(166,64,61,0.09)", color: C.ink }}>
          {erro}
        </p>
      )}

      {ordenados.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <Scale size={30} className="mx-auto mb-3" style={{ color: C.border }} />
          <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Nenhum material enviado ainda</p>
          <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
            Envie a Lei nº 14.133/2021, decretos municipais ou instruções normativas em PDF.
          </p>
          <button onClick={() => fileRef.current?.click()}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: C.navy, color: C.paper }}>
            Enviar o primeiro PDF
          </button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {ordenados.map((n, i) => (
            <div key={n.id} className="flex items-center gap-3 px-5 py-3.5"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
              <Scale size={17} className="shrink-0" style={{ color: C.brass }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{n.nome}</p>
                <p className="text-[11px]" style={{ color: C.inkMuted }}>
                  {formatarBytes(n.tamanhoBytes)} · enviado {fmtDateRelativa(n.enviadoEm)}
                </p>
              </div>
              <a href={n.dataUrl} download={n.nome}
                className="p-2 rounded-lg" style={{ color: C.inkMuted }} title="Baixar">
                <Download size={15} />
              </a>
              <button onClick={() => setAExcluir(n)}
                className="p-2 rounded-lg" style={{ color: C.inkMuted }} title="Excluir">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Excluir material normativo?"
          descricao={`"${aExcluir.nome}" será apagado de vez e deixará de aparecer para todos os usuários. Esta ação não pode ser desfeita.`}
          onConfirmar={() => { onExcluir(aExcluir.id); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </>
  );
}

// ---------- Lixeira ----------
function LixeiraView({ lixeira, onRestaurar, onApagar, onEsvaziar, podeEsvaziar }) {
  const [confirmando, setConfirmando] = useState(null);   // registro a apagar de vez
  const [confirmandoTudo, setConfirmandoTudo] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Trash2 size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Recuperação</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Lixeira</h1>
        </div>
        {lixeira.length > 0 && podeEsvaziar && (
          <button onClick={() => setConfirmandoTudo(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium shrink-0"
            style={{ background: "white", color: C.red, border: `1px solid rgba(166,64,61,0.3)` }}>
            <Trash2 size={14} /> Esvaziar lixeira
          </button>
        )}
      </div>

      <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
        Documentos excluídos ficam aqui por <b>{DIAS_NA_LIXEIRA} dias</b> e depois somem sozinhos.
        Até lá, dá para restaurar a qualquer momento.
      </p>

      {lixeira.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <Trash2 size={30} className="mx-auto mb-3" style={{ color: C.border }} />
          <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Lixeira vazia</p>
          <p className="text-sm" style={{ color: C.inkMuted }}>Nada foi excluído nos últimos {DIAS_NA_LIXEIRA} dias.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {lixeira.map((r, idx) => {
            const dias = diasRestantes(r.excluidoEm);
            const tipo = TIPOS_DOC[r.prefixoOriginal]?.rotulo || "Documento";
            const urgente = dias <= 5;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : "none" }}>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{tituloNaLixeira(r)}</p>
                  <p className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: C.inkMuted }}>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: C.paperDark, color: C.inkMuted }}>{tipo}</span>
                    excluído {fmtDateRelativa(r.excluidoEm)}
                  </p>
                </div>

                <span className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
                  style={{
                    background: urgente ? "rgba(166,64,61,0.1)" : C.paperDark,
                    color: urgente ? C.red : C.inkMuted,
                  }}>
                  {dias === 1 ? "resta 1 dia" : `restam ${dias} dias`}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => onRestaurar(r)}
                    className="px-2.5 py-1.5 rounded-md text-xs font-semibold"
                    style={{ background: C.navy, color: C.paper }}>
                    Restaurar
                  </button>
                  <button onClick={() => setConfirmando(r)}
                    className="p-1.5 rounded-md" style={{ color: C.red }} title="Excluir definitivamente">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmando && (
        <ConfirmarExclusao
          titulo="Excluir definitivamente?"
          descricao={`"${tituloNaLixeira(confirmando)}" será apagado de vez. Esta ação não pode ser desfeita.`}
          textoBotao="Excluir de vez"
          onConfirmar={() => { onApagar(confirmando); setConfirmando(null); }}
          onCancelar={() => setConfirmando(null)}
        />
      )}

      {confirmandoTudo && (
        <ConfirmarExclusao
          titulo="Esvaziar a lixeira?"
          descricao={`Os ${lixeira.length} documento(s) da lixeira serão apagados de vez. Esta ação não pode ser desfeita.`}
          textoBotao="Esvaziar"
          onConfirmar={() => { onEsvaziar(); setConfirmandoTudo(false); }}
          onCancelar={() => setConfirmandoTudo(false)}
        />
      )}
    </>
  );
}

// ---------- Janela de novo documento ----------
// Recolhe o essencial antes de criar. Assim o documento só nasce quando você confirma —
// nada de ETP em branco aparecendo na lista por engano.
function JanelaNovoDocumento({ inicial, secretarias, secretariaAtiva, onFechar, onCriar }) {
  const [tipo, setTipo] = useState(inicial.tipo || "etp");
  const [objeto, setObjeto] = useState("");
  const [tipoObjeto, setTipoObjeto] = useState(inicial.tipoObjeto || TIPOS_OBJETO[0]);
  const [processo, setProcesso] = useState("");
  const [secretariaId, setSecretariaId] = useState(
    secretariaAtiva !== "todas" ? secretariaAtiva : (secretarias[0]?.id || "")
  );

  const rotulos = {
    etp: { titulo: "Novo Estudo Técnico Preliminar", icone: FileText,
           ajuda: "O documento principal, com os 13 incisos do art. 18." },
    declaracao: { titulo: "Nova Declaração de previsão no PCA", icone: ListChecks,
                  ajuda: "Confere se os itens constam no Plano de Contratações Anual." },
    justificativa: { titulo: "Nova Justificativa de aquisição", icone: FileEdit,
                     ajuda: "Documento anterior à aquisição, com a motivação da compra." },
  };
  const r = rotulos[tipo];
  const Icone = r.icone;
  const secretaria = secretarias.find(x => x.id === secretariaId);

  function confirmar(e) {
    e.preventDefault();
    onCriar({
      tipo,
      objeto: objeto.trim(),
      tipoObjeto,
      processo: processo.trim(),
      secretariaId,
      orgao: secretaria?.nome || "",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(18,32,50,0.6)" }} onClick={onFechar}>
      <form onSubmit={confirmar} onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">

        <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(166,131,46,0.12)" }}>
              <Icone size={19} style={{ color: C.brass }} />
            </div>
            <div>
              <h3 className="serif text-lg font-semibold leading-tight" style={{ color: C.navy }}>{r.titulo}</h3>
              <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>{r.ajuda}</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} className="shrink-0" style={{ color: C.inkMuted }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {/* Trocar o tipo sem fechar a janela */}
          <div className="inline-flex p-1 rounded-lg mb-4" style={{ background: C.paperDark }}>
            {[["etp", "ETP"], ["declaracao", "Declaração"], ["justificativa", "Justificativa"]].map(([v, rot]) => (
              <button key={v} type="button" onClick={() => setTipo(v)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold"
                style={{
                  background: tipo === v ? "white" : "transparent",
                  color: tipo === v ? C.navy : C.inkMuted,
                  boxShadow: tipo === v ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}>
                {rot}
              </button>
            ))}
          </div>

          <label className="block mb-4">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
              Objeto {tipo === "etp" ? "(o que será contratado)" : ""}
            </span>
            <input value={objeto} onChange={e => setObjeto(e.target.value)} autoFocus
              placeholder={tipo === "etp"
                ? "Ex.: Aquisição de material de copa e cozinha"
                : "Ex.: Aquisição de gás engarrafado P45"}
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm"
              style={{ borderColor: C.border }} />
            <span className="text-[10.5px] mt-1 block" style={{ color: C.inkMuted }}>
              Pode deixar em branco e preencher depois — mas ajuda a achar o documento na lista.
            </span>
          </label>

          {tipo === "etp" && (
            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Tipo de objeto
              </span>
              <select value={tipoObjeto} onChange={e => setTipoObjeto(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white"
                style={{ borderColor: C.border }}>
                {TIPOS_OBJETO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-[10.5px] mt-1 block" style={{ color: C.inkMuted }}>
                Os textos-modelo dos incisos se ajustam a esta escolha.
              </span>
            </label>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Entidade
              </span>
              <select value={secretariaId} onChange={e => setSecretariaId(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white"
                style={{ borderColor: C.border }}>
                {secretarias.map(x => (
                  <option key={x.id} value={x.id}>{x.sigla || x.nome || "Sem nome"}</option>
                ))}
              </select>
            </label>

            {tipo !== "declaracao" && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                  Nº do processo
                </span>
                <input value={processo} onChange={e => setProcesso(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: C.border }} />
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onFechar}
              className="px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: C.navy, color: C.paper }}>
              <Plus size={15} /> Criar e abrir
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------- Guia rápido ----------
function GuiaRapido({ onFechar }) {
  const passos = [
    ["1. Planilha de Itens", "Importe do Sistema Centi ou cadastre à mão. O código do produto é essencial: é por ele que o app localiza cada item no PCA."],
    ["2. Alinhamento ao PCA", "Importe a planilha do painel do PCA. O cruzamento é automático; para códigos divergentes, você vincula a linha certa pela busca."],
    ["3. Dados do Processo", "Objeto, setor, responsáveis, prazos e demais campos que alimentam os textos-modelo dos incisos."],
    ["4. Levantamento de Preços", "Lance as cotações por item e escolha a metodologia (média ou mediana). Daí sai a estimativa de valor."],
    ["5. Documento", "Os 13 incisos numa página só. Use o texto-modelo, escreva do seu jeito, ou leve o prompt a uma IA gratuita."],
    ["6. Conformidade e exportação", "Confira as pendências antes de finalizar e baixe em Word ou PDF."],
    ["7. Analise a melhor forma de atender à seu problema, lendo e verificando o Estudo. Às vezes outra solução é mais viável."],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
      onClick={onFechar}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl"
          style={{ borderColor: C.border }}>
          <div>
            <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
              <FileText size={15} />
              <span className="text-xs font-semibold tracking-widest uppercase">Como funciona</span>
            </div>
            <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Guia rápido</h3>
          </div>
          <button onClick={onFechar} className="shrink-0" style={{ color: C.inkMuted }}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {passos.map(([titulo, texto], i) => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center serif text-xs font-bold"
                style={{ background: C.paperDark, color: C.brass }}>{i + 1}</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: C.navy }}>{titulo}</p>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: C.inkMuted }}>{texto}</p>
              </div>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed pt-2 border-t" style={{ borderColor: C.border, color: C.inkMuted }}>
            As Declarações de PCA e as Justificativas de aquisição são documentos independentes — não precisam
            de um ETP aberto e ficam salvas em listas próprias.
          </p>
        </div>
      </div>
    </div>
  );
}



// ---------- Ferramenta avulsa: Verificar Itens no PCA ----------
// Independente de qualquer ETP — fica salva neste navegador para reutilização.
function DeclaracaoView({ doc, secretarias, onSalvar, onBack, onGerarJustificativa }) {
  const itens = doc.itens || [];
  const objeto = doc.objeto || "";
  const orgao = doc.orgao || "";
  const manuais = doc.manuais || {};

  // A planilha do PCA é uma tabela de referência compartilhada entre todas as declarações —
  // fica numa chave própria para não duplicar milhares de linhas em cada documento.
  const [pca, setPca] = useState(null);
  const [timbreGlobal, setTimbreGlobal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFaltantes, setShowFaltantes] = useState(false);
  const cabecalho = resolverCabecalho(doc, secretarias, timbreGlobal);
  const timbre = cabecalho.tipo === "imagem" ? cabecalho.dataUrl : null;

  const fileItensRef = useRef(null);
  const filePcaRef = useRef(null);
  const [importingItens, setImportingItens] = useState(false);
  const [importingPca, setImportingPca] = useState(false);
  const [errorItens, setErrorItens] = useState("");
  const [errorPca, setErrorPca] = useState("");

  useEffect(() => {
    Promise.all([
      storage.get("pca:planilha", false).catch(() => null),
      obterTimbreGlobal().catch(() => null),
    ]).then(([pcaRes, timbre]) => {
      if (pcaRes?.value) setPca(JSON.parse(pcaRes.value));
      if (timbre) setTimbreGlobal(timbre);
    }).finally(() => setLoading(false));
  }, []);

  function atualizarItens(v) { onSalvar({ ...doc, itens: v }); }
  function atualizarObjeto(v) { onSalvar({ ...doc, objeto: v }); }
  function atualizarOrgao(v) { onSalvar({ ...doc, orgao: v }); }
  function atualizarPca(v) {
    setPca(v);
    storage.set("pca:planilha", JSON.stringify(v), false).catch(() => {});
  }
  function atualizarManual(itemId, campo, valor) {
    const atual = manuais[itemId] || { codigo: "", sequencial: "" };
    onSalvar({ ...doc, manuais: { ...manuais, [itemId]: { ...atual, [campo]: valor } } });
  }

  async function handleImportItens(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingItens(true);
    setErrorItens("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const result = parseCentiSheet(rows);
      if (result.itens.length === 0) throw new Error("Nenhum item encontrado nesta planilha.");
      atualizarItens(result.itens);
    } catch (err) {
      console.error(err);
      setErrorItens(err.message || "Não foi possível importar esta planilha.");
    }
    setImportingItens(false);
    e.target.value = "";
  }

  async function handleImportPca(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingPca(true);
    setErrorPca("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const linhas = parsePCASheet(rows);
      atualizarPca({ nomeArquivo: file.name, importedAt: Date.now(), linhas });
    } catch (err) {
      console.error(err);
      setErrorPca(err.message || "Não foi possível importar esta planilha.");
    }
    setImportingPca(false);
    e.target.value = "";
  }

  const matches = cruzarComPca(itens, pca, manuais);
  const encontrados = matches.filter(m => m.previsto).length;
  const semPcaMatch = matches.filter(m => !m.pcaRow).map(m => m.item); // sem correspondência automática
  const itensFaltantes = matches.filter(m => !m.previsto).map(m => m.item); // ainda sem sequencial nenhum
  const totalmenteAlinhado = itens.length > 0 && pca && encontrados === itens.length;

  function baixarDocumento() {
    const linhasTabela = matches.filter(m => m.previsto).map((m, idx) =>
      `<tr><td>${idx + 1}</td><td>${escapeHtml(m.codigo)}</td><td>${escapeHtml(m.item.descricao || "-")}</td><td>${escapeHtml(m.sequencial || "-")}</td></tr>`
    ).join("");
    gerarDocumentoPCAAvulso({ objeto, orgao, cabecalho, linhasTabela }).catch(e => console.error(e));
  }

  function irParaJustificativa() {
    onGerarJustificativa({ objeto, orgao });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6" style={{ color: C.navy }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
          <ListChecks size={16} />
          <span className="text-xs font-semibold tracking-widest uppercase">Declaração de previsão no PCA</span>
        </div>
        <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>
          {objeto.trim() || "Nova declaração"}
        </h1>
      </div>

      <div>
        <div>
          {loading ? (
            <p className="text-sm" style={{ color: C.inkMuted }}>Carregando...</p>
          ) : (
            <>
              <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
                Confere se uma lista de itens já consta no Plano de Contratações Anual e gera o documento pronto
                para anexar ao processo. Cada declaração é salva separadamente — você pode ter várias, uma por
                contratação.
              </p>

              <div className="mb-5 p-4 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="text-sm font-semibold" style={{ color: C.navy }}>1. Planilha de Itens</span>
                  <span className="text-xs" style={{ color: C.inkMuted }}>{itens.length} item(ns)</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input ref={fileItensRef} type="file" accept=".xlsx,.xls" onChange={handleImportItens} className="hidden" />
                  <button onClick={() => fileItensRef.current?.click()} disabled={importingItens}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
                    style={{ background: C.navy, color: C.paper }}>
                    {importingItens ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {importingItens ? "Importando..." : "Importar do Sistema Centi"}
                  </button>
                  <button onClick={baixarModeloPlanilha}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                    style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}>
                    <FileText size={13} /> Baixar modelo em branco
                  </button>
                  {itens.length > 0 && (
                    <button onClick={() => atualizarItens([])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ color: C.red }}>
                      <Trash2 size={13} /> Limpar lista
                    </button>
                  )}
                </div>
                {errorItens && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {errorItens}</p>}
              </div>

              <div className="mb-5 p-4 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="text-sm font-semibold" style={{ color: C.navy }}>2. Planilha do PCA</span>
                  {pca && <span className="text-xs" style={{ color: C.inkMuted }}>{pca.nomeArquivo} · {pca.linhas.length} itens no painel · importada em {fmtDate(pca.importedAt)}</span>}
                </div>
                <input ref={filePcaRef} type="file" accept=".xlsx,.xls" onChange={handleImportPca} className="hidden" />
                <button onClick={() => filePcaRef.current?.click()} disabled={importingPca}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
                  style={{ background: C.navy, color: C.paper }}>
                  {importingPca ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {importingPca ? "Importando..." : pca ? "Atualizar planilha do PCA" : "Importar planilha do PCA"}
                </button>
                {errorPca && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {errorPca}</p>}
              </div>

              {itens.length > 0 && pca && (
                <div className="mb-5">
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: C.paperDark }}>
                          <th className="text-left px-3 py-2 text-xs font-semibold uppercase w-10" style={{ color: C.inkMuted }}>#</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
                          <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Consta no PCA?</th>
                          <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-24" style={{ color: C.inkMuted }}>Sequencial (PCA)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m, idx) => (
                          <tr key={m.item.id} className="border-t align-top" style={{ borderColor: C.border }}>
                            <td className="px-3 py-2 text-xs" style={{ color: C.inkMuted }}>{idx + 1}</td>
                            <td className="px-3 py-2">{m.item.descricao || `Item ${idx + 1}`}</td>
                            <td className="px-2 py-2">
                              {m.previsto ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(76,124,89,0.12)", color: C.green }}>
                                  <Check size={11} /> Sim
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
                                  <AlertCircle size={11} /> Não
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-xs" style={{ color: m.previsto ? C.ink : C.inkMuted }}>
                              {m.sequencial || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 p-3 rounded-lg flex items-center gap-2 text-xs flex-wrap" style={{ background: totalmenteAlinhado ? "rgba(76,124,89,0.1)" : "rgba(166,131,46,0.1)", color: C.ink }}>
                    {totalmenteAlinhado ? <Check size={14} style={{ color: C.green }} /> : <Info size={14} style={{ color: C.brass }} />}
                    <span><b>{encontrados}</b> de <b>{itens.length}</b> itens localizados no PCA (inclui os que você completou manualmente).</span>
                  </div>

                  {semPcaMatch.length > 0 && (
                    <button onClick={() => setShowFaltantes(true)}
                      className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium"
                      style={{ background: itensFaltantes.length > 0 ? "rgba(166,64,61,0.1)" : "rgba(166,131,46,0.12)", color: itensFaltantes.length > 0 ? C.red : C.brass }}>
                      <ListX size={13} /> Itens sem previsão no PCA ({semPcaMatch.length}
                      {itensFaltantes.length !== semPcaMatch.length ? ` · ${itensFaltantes.length} pendente(s)` : ""})
                    </button>
                  )}
                </div>
              )}

              <div className="mt-5 p-4 rounded-lg flex items-center justify-between gap-3 flex-wrap" style={{ background: "rgba(28,46,74,0.06)", border: `1px solid ${C.border}` }}>
                <span className="text-sm" style={{ color: C.ink }}>
                  Criar uma <b>Justificativa de Aquisição</b> a partir desta declaração — ela nasce como documento
                  próprio, já com o objeto e o órgão preenchidos.
                </span>
                <button onClick={irParaJustificativa}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold shrink-0"
                  style={{ background: C.navy, color: C.paper }}>
                  Criar Justificativa →
                </button>
              </div>

              <div className="p-4 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
                <span className="text-sm font-semibold block mb-3" style={{ color: C.navy }}>3. Documento de demonstração no PCA</span>
                <label className="block mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Objeto (descrição resumida da aquisição)</span>
                  <input value={objeto} onChange={e => atualizarObjeto(e.target.value)}
                    placeholder="Ex.: aquisição de materiais de copa e cozinha"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
                </label>
                <label className="block mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Órgão / Secretaria</span>
                  <input value={orgao} onChange={e => atualizarOrgao(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
                </label>
                <button onClick={baixarDocumento} disabled={encontrados === 0 || !objeto.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: C.navy, color: C.paper }}>
                  <Download size={15} /> Baixar documento (Word)
                </button>
                {(encontrados === 0 || !objeto.trim()) && (
                  <p className="text-xs mt-2" style={{ color: C.inkMuted }}>
                    Importe os itens e o PCA (com ao menos um item localizado) e preencha o Objeto para gerar o documento.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showFaltantes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
          onClick={e => { e.stopPropagation(); setShowFaltantes(false); }}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl z-10" style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Itens sem previsão no PCA</h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  {itensFaltantes.length} de {semPcaMatch.length} ainda pendente(s)
                </p>
              </div>
              <button onClick={() => setShowFaltantes(false)} className="shrink-0" style={{ color: C.inkMuted }}><X size={20} /></button>
            </div>

            <div className="p-5">
              <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
                Estes itens não foram localizados automaticamente na planilha do PCA importada. Se algum já
                estiver previsto no PCA sob outro código, use a busca para localizar a linha correta — o app
                puxa o produto e o sequencial automaticamente. Os que ficarem sem vínculo podem ser baixados
                numa planilha para inclusão no Sistema Centi.
              </p>
              {itensFaltantes.some(it => !it.idProduto) && (
                <div className="flex items-start gap-2 mb-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: "rgba(166,64,61,0.08)", color: C.ink }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: C.red }} />
                  <span>
                    Algum(ns) item(ns) está(ão) sem código/ID original (provavelmente adicionado manualmente, e não
                    pela importação do Sistema Centi).
                  </span>
                </div>
              )}

              <div className="space-y-3 mb-5">
                {semPcaMatch.map((it, idx) => {
                  const dados = manuais[it.id] || { codigo: "", codigoPca: "", sequencial: "" };
                  const resolvido = !!(dados.codigoPca?.trim() || dados.sequencial?.trim());
                  return (
                    <div key={it.id} className="p-4 rounded-lg border-2" style={{ borderColor: resolvido ? "rgba(76,124,89,0.4)" : C.border, background: resolvido ? "rgba(76,124,89,0.04)" : "white" }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-xs font-semibold" style={{ color: C.inkMuted }}>Item {itens.indexOf(it) + 1}</span>
                          <p className="text-sm font-medium" style={{ color: C.navy }}>{it.descricao || `Item ${idx + 1}`}</p>
                        </div>
                        {resolvido ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(76,124,89,0.15)", color: C.green }}>
                            <Check size={12} /> Previsto
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
                            <AlertCircle size={12} /> Pendente
                          </span>
                        )}
                      </div>
                      <VinculoPca item={it} pca={pca} dados={dados}
                        onAlterar={novos => onManuaisPca({ ...manuais, [it.id]: novos })} />
                    </div>
                  );
                })}
              </div>

              {itensFaltantes.length > 0 && (
                <button onClick={() => baixarPlanilhaInclusaoCenti(itensFaltantes)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: C.navy, color: C.paper }}>
                  <Download size={14} /> Baixar planilha para inclusão no Centi ({itensFaltantes.length} pendente(s))
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Justificativa de Aquisição (ferramenta avulsa) ----------
function JustificativaView({ doc, secretarias, onSalvar, onBack }) {
  const campos = doc.campos;
  const conteudo = doc.conteudo || "";
  const [timbreGlobal, setTimbreGlobal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modoPreview, setModoPreview] = useState(false);
  const cabecalho = resolverCabecalho(doc, secretarias, timbreGlobal);
  const timbre = cabecalho.tipo === "imagem" ? cabecalho.dataUrl : null;

  useEffect(() => {
    obterTimbreGlobal()
      .then(setTimbreGlobal)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function atualizarCampo(campo, valor) {
    onSalvar({ ...doc, campos: { ...campos, [campo]: valor } });
  }
  function atualizarConteudo(html) {
    onSalvar({ ...doc, conteudo: html });
  }

  function gerarPadrao() {
    atualizarConteudo(gerarTextoPadraoJustificativa(campos));
  }

  function baixarDocumento() {
    gerarDocumentoJustificativaWord({ conteudoHtml: conteudo, cabecalho }).catch(e => console.error(e));
  }

  const camposPreenchidos = Object.values(campos).filter(v => v?.trim?.()).length;

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-10"><p className="text-sm" style={{ color: C.inkMuted }}>Carregando...</p></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6" style={{ color: C.navy }}>
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
          <FileEdit size={16} />
          <span className="text-xs font-semibold tracking-widest uppercase">Justificativa de aquisição</span>
        </div>
        <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>
          {campos.objeto?.trim() || "Nova justificativa"}
        </h1>
      </div>

      <p className="text-sm mb-6" style={{ color: C.inkMuted }}>
        Preencha os dados abaixo e gere o texto padrão automaticamente (sem IA), ou escreva a justificativa do seu
        jeito no editor formatado. As alterações são salvas automaticamente.
      </p>

      <div className="inline-flex p-1 rounded-lg mb-5" style={{ background: C.paperDark }}>
        <button onClick={() => setModoPreview(false)}
          className="px-3.5 py-1.5 rounded-md text-xs font-semibold"
          style={{ background: !modoPreview ? "white" : "transparent", color: !modoPreview ? C.navy : C.inkMuted, boxShadow: !modoPreview ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Dados e texto
        </button>
        <button onClick={() => setModoPreview(true)}
          className="px-3.5 py-1.5 rounded-md text-xs font-semibold"
          style={{ background: modoPreview ? "white" : "transparent", color: modoPreview ? C.navy : C.inkMuted, boxShadow: modoPreview ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Pré-visualizar
        </button>
      </div>

      {!modoPreview ? (
        <>
          <div className="p-4 rounded-lg border mb-5" style={{ borderColor: C.border, background: "white" }}>
            <span className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{ color: C.inkMuted }}>
              Dados da aquisição ({camposPreenchidos}/8 preenchidos)
            </span>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Objeto (o que está sendo adquirido)" value={campos.objeto} onChange={v => atualizarCampo("objeto", v)}
                placeholder="Ex.: Material de Consumo (Gás engarrafado P45kg)" />
              <Field label="Nº do Processo" value={campos.processo} onChange={v => atualizarCampo("processo", v)}
                placeholder="Ex.: 136187/2025" />
              <Field label="Órgão / Secretaria" value={campos.orgao} onChange={v => atualizarCampo("orgao", v)} />
              <Field label="Unidade/programa beneficiado" value={campos.unidadeBeneficiada} onChange={v => atualizarCampo("unidadeBeneficiada", v)}
                placeholder="Ex.: Unidade de Produção FABRIS e dos Programas vinculados ao FMAS" />
              <Field label="Local de entrega" value={campos.localEntrega} onChange={v => atualizarCampo("localEntrega", v)}
                placeholder="Ex.: sede da Secretaria Municipal de Assistência Social" />
              <Field label="Horário de entrega" value={campos.horarioEntrega} onChange={v => atualizarCampo("horarioEntrega", v)}
                placeholder="Ex.: 08:00 às 11:00 e 13:00 às 17:00, de segunda a sexta-feira" />
              <Field label="Prazo de pagamento (dias)" value={campos.prazoPagamentoDias} onChange={v => atualizarCampo("prazoPagamentoDias", v)}
                placeholder="Ex.: 10" />
            </div>
            <label className="block mt-1">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Programas/unidades beneficiados (um por linha)
              </span>
              <textarea value={campos.programas} onChange={e => atualizarCampo("programas", e.target.value)} rows={2}
                placeholder={"Ex.: Unidades de Produção Fabris\nCentro de Convivência Municipal"}
                className="mt-1.5 w-full px-3 py-2 rounded-lg border text-sm leading-relaxed resize-y"
                style={{ borderColor: C.border, background: "white" }} />
            </label>
            <p className="text-[10px] mt-2" style={{ color: C.inkMuted }}>
              Esta justificativa é anterior à aquisição — por isso não pede empresa, CNPJ nem nº de pregão, que
              ainda não existem nesta etapa.
            </p>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={gerarPadrao}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
              style={{ background: C.brass, color: C.navyDark }}
              title="Preenche com o texto-modelo salvo no app — grátis, sem IA e sem API">
              <FileEdit size={13} /> Gerar justificativa padrão (sem IA)
            </button>
          </div>
          <RichTextEditor value={conteudo} onChange={atualizarConteudo} />
        </>
      ) : (
        <div className="rounded-lg border p-8 bg-white" style={{ borderColor: C.border }}>
          {timbre && (
            <div className="mb-6 flex justify-center">
              <img src={timbre} alt="Timbre" style={{ maxHeight: "110px", maxWidth: "100%" }} />
            </div>
          )}
          <h2 className="serif text-lg font-semibold text-center mb-4 uppercase" style={{ color: C.navy }}>Justificativa</h2>
          {conteudo ? (
            <div className="text-sm leading-relaxed rich-content text-justify" style={{ color: C.ink }}
              dangerouslySetInnerHTML={{ __html: conteudo }} />
          ) : (
            <p className="text-sm" style={{ color: C.inkMuted }}>Nenhum texto ainda — volte em "Dados e texto" e gere ou escreva a justificativa.</p>
          )}
          <p className="text-sm text-center mt-10 italic" style={{ color: C.ink }}>Atenciosamente,</p>
          <p className="text-sm text-center mt-16 italic" style={{ color: C.ink }}>[DATADO E ASSINADO DIGITALMENTE]</p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-5">
        <button onClick={baixarDocumento} disabled={!conteudo.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: C.navy, color: C.paper }}>
          <Download size={15} /> Baixar documento (Word)
        </button>
      </div>
    </div>
  );
}

function EditorView({ etp, activeSection, setActiveSection, onMeta, onSection, onItens, onCotacoes,
  onValoresAdotados, onPca, onManuaisPca, onSolucoesMercado, onExcluidos, secretarias, saveState, onBack, onPreview }) {
  const p = progress(etp);
  const numeros = numeracaoFinal(etp);
  const excluidos = etp.incisosExcluidos || [];
  const [showChecklist, setShowChecklist] = useState(false);
  const pendencias = verificarConformidade(etp).filter(a => a.nivel === "impeditivo").length;

  // Leva o documento até o inciso escolhido, em vez de trocar de tela
  function irParaInciso(id) {
    setActiveSection("documento");
    requestAnimationFrame(() => {
      const alvo = document.getElementById(`inciso-${id}`);
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const etapas = [
    { id: "itens", rotulo: "1. Planilha de Itens", pronto: (etp.itens || []).length > 0 },
    { id: "pca", rotulo: "2. Alinhamento ao PCA", pronto: !!etp.pca && (etp.itens || []).length > 0 && contarPrevistosNoPca(etp) === etp.itens.length },
    { id: "meta", rotulo: "3. Dados do Processo", pronto: !!etp.meta.titulo?.trim() },
    { id: "cotacoes", rotulo: "4. Levantamento de Preços", pronto: valorTotalEtp(etp) > 0 },
  ];

  const itemMenu = (ativo, conteudo, aoClicar, chave) => (
    <button key={chave} onClick={aoClicar}
      className="w-full text-left px-4 py-2.5 text-xs border-l-4 flex items-center gap-2"
      style={{
        borderColor: ativo ? C.brass : "transparent",
        background: ativo ? "rgba(166,131,46,0.15)" : "transparent",
        color: ativo ? C.brassLight : "#B7C0CC",
      }}>
      {conteudo}
    </button>
  );

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      <header className="no-print flex items-center justify-between px-6 py-3 border-b shrink-0 z-30"
        style={{ background: C.navy, borderColor: C.navyDark }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-white/10 shrink-0" style={{ color: C.paper }}>
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <span className="serif text-sm font-medium block truncate" style={{ color: C.paper }}>
              {etp.meta.titulo || "Novo ETP"}
            </span>
            {etp.meta.processo && (
              <span className="text-[10px]" style={{ color: "#B7C0CC" }}>Proc. {etp.meta.processo}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs" style={{ color: saveState === "saving" ? C.brassLight : "#9FE0B0" }}>
            {saveState === "saving" ? "Salvando..." : "● Salvo"}
          </span>
          <button onClick={() => setShowChecklist(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{
              background: pendencias > 0 ? "rgba(166,64,61,0.9)" : "rgba(255,255,255,0.12)",
              color: C.paper,
            }}
            title="Confere o preenchimento e a coerência do ETP antes de finalizar">
            {pendencias > 0 ? <AlertCircle size={14} /> : <Check size={14} />}
            {pendencias > 0 ? `${pendencias} pendência(s)` : "Conformidade"}
          </button>
          <button onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.brass, color: C.navyDark }}>
            <FileText size={14} /> Pré-visualizar
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Índice lateral — fixo, rola por conta própria e fica sempre visível */}
        <nav className="no-print w-60 shrink-0 overflow-y-auto etp-scroll" style={{ background: C.navyDark }}>
          <div className="px-4 pt-4 pb-1 text-[9.5px] font-bold tracking-widest uppercase" style={{ color: C.brass }}>
            Preparação
          </div>
          {etapas.map(et => itemMenu(activeSection === et.id, (
            <>
              <span className="flex-1">{et.rotulo}</span>
              {et.pronto && <Check size={12} className="shrink-0" style={{ color: C.green }} />}
            </>
          ), () => setActiveSection(et.id), et.id))}

          <div className="px-4 pt-4 pb-1 text-[9.5px] font-bold tracking-widest uppercase" style={{ color: C.brass }}>
            Documento — art. 18
          </div>
          {itemMenu(activeSection === "documento", (
            <span className="flex-1 font-semibold">Abrir documento completo</span>
          ), () => setActiveSection("documento"), "documento")}

          {SECOES.map(s => {
            const fora = excluidos.includes(s.id);
            const preenchido = !!etp.sections[s.id]?.trim();
            return (
              <button key={s.id} onClick={() => irParaInciso(s.id)}
                className="w-full text-left pl-6 pr-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-white/5"
                style={{ color: fora ? "#5C6675" : "#B7C0CC", textDecoration: fora ? "line-through" : "none" }}>
                <span className="serif font-bold w-7 shrink-0"
                  style={{ color: fora ? "#5C6675" : (preenchido ? C.brassLight : "#8A93A3") }}>
                  {numeros[s.id] || s.id}
                </span>
                <span className="flex-1 leading-tight truncate">{s.titulo}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: fora ? "transparent" : preenchido ? C.green : (s.obrig ? C.red : "#4A5568") }} />
              </button>
            );
          })}

          <div className="px-4 py-3 mt-2 text-[11px]" style={{ color: "#8A93A3" }}>
            {Object.keys(numeros).length}/13 no documento
            {excluidos.length > 0 && ` · ${excluidos.length} fora`}
            <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.round((p.reqFilled / p.reqTotal) * 100)}%`,
                background: p.reqFilled === p.reqTotal ? C.green : C.brass,
              }} />
            </div>
            <div className="mt-1" style={{ color: p.reqFilled === p.reqTotal ? C.green : C.brassLight }}>
              {p.reqFilled}/{p.reqTotal} obrigatórios
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto etp-scroll" style={{ background: C.paper }}>
          {activeSection === "documento" ? (
            <DocumentoIncisos etp={etp} onSection={onSection} onSolucoesMercado={onSolucoesMercado}
              onExcluidos={onExcluidos} secretarias={secretarias} />
          ) : (
            <div className="max-w-3xl mx-auto px-8 py-10">
              {activeSection === "meta" ? (
                <MetaForm etp={etp} onMeta={onMeta} />
              ) : activeSection === "itens" ? (
                <ItemsForm etp={etp} onItens={onItens} onMeta={onMeta} />
              ) : activeSection === "pca" ? (
                <PCAForm etp={etp} onPca={onPca} onManuaisPca={onManuaisPca} />
              ) : (
                <CotacoesForm etp={etp} onValoresAdotados={onValoresAdotados} onCotacoes={onCotacoes} onMeta={onMeta} />
              )}
            </div>
          )}
        </main>
      </div>

      {showChecklist && (
        <ChecklistConformidade etp={etp}
          onIrPara={destino => setActiveSection(destino)}
          onFechar={() => setShowChecklist(false)} />
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block mb-4">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
    </label>
  );
}

function MetaForm({ etp, onMeta }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Preenche a data automaticamente com o dia atual, caso o ETP ainda não tenha uma (ex.: registros antigos)
  useEffect(() => {
    if (!etp.meta.data) onMeta("data", todayISO());
  }, [etp.id]);

  // Sugere o título a partir das classificações dos itens já cadastrados, sem depender de IA
  function handleSugerirObjeto() {
    setError("");
    const itens = etp.itens || [];
    if (itens.length === 0) {
      setError('Cadastre os itens na etapa "1. Planilha de Itens" primeiro.');
      return;
    }
    const verbo = etp.meta.tipo === "Serviços comuns" || etp.meta.tipo === "Serviços de TI"
      ? "Contratação de" : "Aquisição de";

    // Agrupa pelas classificações mais frequentes da planilha
    const contagem = {};
    itens.forEach(i => {
      const c = (i.classificacao || "").trim();
      if (c) contagem[c] = (contagem[c] || 0) + 1;
    });
    const principais = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c.toLowerCase());

    if (principais.length === 0) {
      setError("Os itens não têm classificação preenchida — escreva o objeto manualmente.");
      return;
    }
    const lista = principais.length === 1
      ? principais[0]
      : principais.slice(0, -1).join(", ") + " e " + principais[principais.length - 1];
    onMeta("titulo", `${verbo} ${lista}`);
  }

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Dados do Processo</h2>
      <p className="text-sm mb-6" style={{ color: C.inkMuted }}>Identificação do objeto e do processo administrativo.</p>

      <label className="block mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Título do objeto (resumido)</span>
      </label>
      <div className="flex gap-2 mb-1.5">
        <input value={etp.meta.titulo} onChange={e => onMeta("titulo", e.target.value)}
          placeholder="Ex.: Aquisição de brinquedos e materiais recreativos"
          className="flex-1 px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
        <button onClick={handleSugerirObjeto}
          title="Monta o título a partir das classificações da Planilha de Itens"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium shrink-0"
          style={{ background: C.brass, color: C.navyDark }}>
          <FileEdit size={13} /> Sugerir
        </button>
      </div>
      <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
        O botão "Sugerir" monta o título a partir das classificações dos itens já cadastrados. O setor e o
        órgão entram depois, automaticamente, no objeto completo do documento.
      </p>
      {etp.meta.titulo?.trim() && (
        <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: C.paperDark, color: C.ink }}>
          <span className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: C.inkMuted }}>Objeto completo no ETP:</span>
          <br />"{objetoCompleto(etp)}"
        </div>
      )}
      {error && <p className="text-xs mb-4" style={{ color: C.red }}>{error}</p>}

      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Setor requisitante" value={etp.meta.setor} onChange={v => onMeta("setor", v)}
          placeholder="Ex.: Divisão de Proteção Social Básica" />
        <Field label="Órgão / Secretaria" value={etp.meta.orgao} onChange={v => onMeta("orgao", v)}
          placeholder="Ex.: Secretaria Municipal de Assistência Social" />
        <Field label="Nº do processo" value={etp.meta.processo} onChange={v => onMeta("processo", v)}
          placeholder="Ex.: 2026.001.000123" />
      </div>

      <ResponsaveisManager responsaveis={etp.meta.responsaveis} onChange={v => onMeta("responsaveis", v)} />

      <div className="grid sm:grid-cols-3 gap-x-4">
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Tipo de objeto</span>
          <select value={etp.meta.tipo} onChange={e => onMeta("tipo", e.target.value)}
            className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
            {TIPOS_OBJETO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <Field label="Local (para assinatura)" value={etp.meta.local} onChange={v => onMeta("local", v)}
          placeholder="Ex.: Rio Verde – Goiás" />
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Data</span>
          <input type="date" value={etp.meta.data || todayISO()} onChange={e => onMeta("data", e.target.value)}
            className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
        </label>
      </div>
      <label className="block mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Introdução (opcional)</span>
        <textarea value={etp.meta.introducao} onChange={e => onMeta("introducao", e.target.value)} rows={4}
          placeholder="Parágrafo de abertura situando o documento — ex.: convênio, emenda parlamentar ou programa vinculado."
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm leading-relaxed resize-y"
          style={{ borderColor: C.border, background: "white" }} />
      </label>
      <label className="block mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Fonte de recurso (opcional)</span>
        <input value={etp.meta.fonteRecurso || ""} onChange={e => onMeta("fonteRecurso", e.target.value)}
          placeholder="Ex.: Emenda Parlamentar nº ... / Programação nº ... – GND 4 – Investimento"
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
        <span className="text-xs mt-1 block" style={{ color: C.inkMuted }}>
          Se preenchido, entra automaticamente no modelo padrão do inciso VI (Estimativa do Valor).
        </span>
      </label>

      <div className="mt-8 mb-3">
        <h3 className="serif text-lg font-semibold" style={{ color: C.navy }}>Detalhes para os modelos padrão</h3>
        <p className="text-xs" style={{ color: C.inkMuted }}>
          Opcional, mas quanto mais preenchido aqui, menos colchete <code>[complete aqui]</code> sobra nos
          modelos padrão (sem IA) dos incisos III, VI, VII, VIII, XI e XII.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-4">
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Prazo de garantia</span>
          <div className="mt-1.5 flex gap-2">
            <input value={etp.meta.prazoGarantiaDias} onChange={e => onMeta("prazoGarantiaDias", e.target.value)}
              placeholder="Ex.: 12" className="flex-1 px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
            <select value={etp.meta.prazoGarantiaUnidade || "meses"} onChange={e => onMeta("prazoGarantiaUnidade", e.target.value)}
              className="px-2 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
              <option value="dias">dias</option>
              <option value="meses">meses</option>
              <option value="anos">anos</option>
            </select>
          </div>
        </label>
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Prazo de entrega/execução</span>
          <div className="mt-1.5 flex gap-2">
            <input value={etp.meta.prazoEntregaDias} onChange={e => onMeta("prazoEntregaDias", e.target.value)}
              placeholder="Ex.: 30" className="flex-1 px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
            <select value={etp.meta.prazoEntregaUnidade || "dias"} onChange={e => onMeta("prazoEntregaUnidade", e.target.value)}
              className="px-2 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
              <option value="dias">dias</option>
              <option value="meses">meses</option>
              <option value="anos">anos</option>
            </select>
          </div>
        </label>
      </div>

      <label className="block mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Parcelamento (inciso VIII)
        </span>
        <select value={etp.meta.parcelamento || ""} onChange={e => onMeta("parcelamento", e.target.value)}
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border, maxWidth: "360px" }}>
          <option value="">Não definido</option>
          <option value="nao">Não será parcelada (lote único)</option>
          <option value="sim">Será parcelada em itens/lotes</option>
        </select>
      </label>

      <label className="flex items-start gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={!!etp.meta.manutencaoContinuada}
          onChange={e => onMeta("manutencaoContinuada", e.target.checked)}
          className="mt-0.5" style={{ accentColor: C.brass }} />
        <span className="text-sm" style={{ color: C.ink }}>
          Esta contratação exige manutenção, assistência técnica ou fornecimento continuado de peças (inciso VII)
        </span>
      </label>

      <label className="flex items-start gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={!!etp.meta.correlataExiste}
          onChange={e => onMeta("correlataExiste", e.target.checked)}
          className="mt-0.5" style={{ accentColor: C.brass }} />
        <span className="text-sm" style={{ color: C.ink }}>
          Há contratação correlata ou interdependente (inciso XI)
        </span>
      </label>
      {etp.meta.correlataExiste && (
        <input value={etp.meta.correlataDescricao || ""} onChange={e => onMeta("correlataDescricao", e.target.value)}
          placeholder="Descreva brevemente a contratação relacionada e a natureza da dependência"
          className="w-full mb-4 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
      )}

      <label className="flex items-start gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={!!etp.meta.impactoAmbientalRelevante}
          onChange={e => onMeta("impactoAmbientalRelevante", e.target.checked)}
          className="mt-0.5" style={{ accentColor: C.brass }} />
        <span className="text-sm" style={{ color: C.ink }}>
          Há impacto ambiental relevante a considerar (inciso XII)
        </span>
      </label>
      {etp.meta.impactoAmbientalRelevante && (
        <input value={etp.meta.impactoAmbientalDescricao || ""} onChange={e => onMeta("impactoAmbientalDescricao", e.target.value)}
          placeholder="Descreva brevemente o impacto e a medida de mitigação prevista"
          className="w-full mb-4 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
      )}

      <label className="block mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Como as quantidades foram levantadas (inciso V)
        </span>
        <select value={etp.meta.metodologiaQuantidades || ""} onChange={e => onMeta("metodologiaQuantidades", e.target.value)}
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
          <option value="">Não definido</option>
          <option value="historico">Histórico de consumo/utilização</option>
          <option value="beneficiarios">Número de beneficiários/atendimentos</option>
          <option value="parametro">Parâmetro técnico ou normativo</option>
          <option value="substituicao">Substituição de itens por fim de vida útil</option>
          <option value="comparacao">Comparação com unidades/órgãos similares</option>
          <option value="outro">Outro (descrever)</option>
        </select>
      </label>
      {etp.meta.metodologiaQuantidades && (
        <label className="block mb-4">
          <span className="text-xs" style={{ color: C.inkMuted }}>
            {({
              historico: "Detalhe o período analisado e o consumo médio observado (ex.: \"últimos 12 meses, consumo médio de 40 unidades/mês\").",
              beneficiarios: "Informe o número de beneficiários/atendimentos e o parâmetro de consumo por pessoa (ex.: \"120 assistidos, 1 kit por pessoa/semestre\").",
              parametro: "Cite a norma, portaria ou parâmetro técnico utilizado como referência.",
              substituicao: "Informe quantos itens serão substituídos e a condição que motiva a troca (ex.: \"8 equipamentos com mais de 10 anos de uso, fora de garantia\").",
              comparacao: "Cite a unidade/órgão comparado e os números levantados.",
              outro: "Descreva livremente a metodologia utilizada — este texto entra direto no modelo padrão do inciso V.",
            })[etp.meta.metodologiaQuantidades]}
          </span>
          <textarea value={etp.meta.detalhamentoQuantidades || ""} onChange={e => onMeta("detalhamentoQuantidades", e.target.value)}
            rows={2} placeholder="Digite os números e/ou a referência concreta que embasou o levantamento..."
            className="mt-1.5 w-full px-3 py-2 rounded-lg border text-sm leading-relaxed resize-y"
            style={{ borderColor: C.border, background: "white" }} />
        </label>
      )}

      <div className="mt-6 p-4 rounded-lg text-xs leading-relaxed" style={{ background: C.paperDark, color: C.inkMuted }}>
        Os incisos marcados com <b style={{ color: C.brass }}>*</b> na barra lateral (I, IV, VI, VIII e XIII) são de
        preenchimento obrigatório conforme o art. 18, §2º da Lei nº 14.133/2021 — os demais podem ser
        justificadamente dispensados conforme as particularidades do caso concreto.
      </div>
    </div>
  );
}

// ---------- Editor com formatação (negrito, listas, tabela) ----------
// Usa contentEditable + document.execCommand — simples, sem dependências externas.
// O conteúdo é guardado como HTML dentro de etp.sections[id].
// ---------- Barra de formatação ----------
// Age sobre o campo que estiver em foco no momento, como no Word. Por isso pode ser
// compartilhada por vários editores ao mesmo tempo — os botões nunca roubam o foco.
function BarraFormatacao({ aoAlterar, rotuloAlvo }) {
  const [linhasTabela, setLinhasTabela] = useState(3);
  const [colunasTabela, setColunasTabela] = useState(3);
  const [showTabelaConfig, setShowTabelaConfig] = useState(false);

  function exec(cmd, arg = null) {
    document.execCommand(cmd, false, arg);
    aoAlterar?.();
  }

  function inserirTabela() {
    const linhas = Math.min(30, Math.max(1, Number(linhasTabela) || 3));
    const colunas = Math.min(12, Math.max(1, Number(colunasTabela) || 3));
    let html = '<table style="width:100%;border-collapse:collapse;margin:8px 0;"><tbody>';
    for (let r = 0; r < linhas; r++) {
      html += "<tr>";
      for (let c = 0; c < colunas; c++) {
        html += `<td style="border:1px solid #999;padding:6px 8px;min-width:50px;">&nbsp;</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br/></p>";
    document.execCommand("insertHTML", false, html);
    aoAlterar?.();
    setShowTabelaConfig(false);
  }

  const btn = (label, onClick, title) => (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={onClick} title={title}
      className="px-2.5 py-1.5 rounded text-xs font-medium hover:bg-black/5"
      style={{ color: C.navy }}>
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap">
      <select onMouseDown={e => e.stopPropagation()}
        onChange={e => { exec("formatBlock", e.target.value); e.target.value = ""; }}
        defaultValue="" className="px-2 py-1.5 rounded text-xs font-medium bg-white border mr-1"
        style={{ borderColor: C.border, color: C.navy }} title="Estilo do parágrafo">
        <option value="" disabled>Estilo</option>
        <option value="<p>">Parágrafo normal</option>
        <option value="<h4>">Título 1</option>
        <option value="<h5>">Título 2</option>
        <option value="<h6>">Título 3</option>
        <option value="<blockquote>">Citação</option>
      </select>
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn(<b>N</b>, () => exec("bold"), "Negrito")}
      {btn(<i>I</i>, () => exec("italic"), "Itálico")}
      {btn(<u>S</u>, () => exec("underline"), "Sublinhado")}
      {btn(<span style={{ textDecoration: "line-through" }}>T</span>, () => exec("strikeThrough"), "Tachado")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn("⯇", () => exec("justifyLeft"), "Alinhar à esquerda")}
      {btn("☰", () => exec("justifyCenter"), "Centralizar")}
      {btn("⯈", () => exec("justifyRight"), "Alinhar à direita")}
      {btn("☰☰", () => exec("justifyFull"), "Justificar")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn("• Lista", () => exec("insertUnorderedList"), "Lista com marcadores")}
      {btn("1. Lista", () => exec("insertOrderedList"), "Lista numerada")}
      {btn("⇥", () => exec("indent"), "Aumentar recuo")}
      {btn("⇤", () => exec("outdent"), "Diminuir recuo")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      <div className="relative">
        {btn(<span className="flex items-center gap-1"><TableIcon size={13} /> Tabela</span>,
          () => setShowTabelaConfig(v => !v), "Inserir tabela")}
        {showTabelaConfig && (
          <div className="absolute top-full left-0 mt-1 z-30 flex items-center gap-2 p-2.5 rounded-lg border shadow-lg"
            style={{ background: "white", borderColor: C.border }}>
            <label className="flex items-center gap-1 text-xs" style={{ color: C.inkMuted }}>
              Linhas
              <input type="number" min="1" max="30" value={linhasTabela} onChange={e => setLinhasTabela(e.target.value)}
                className="w-12 px-1 py-1 rounded border text-xs text-center" style={{ borderColor: C.border }} />
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: C.inkMuted }}>
              Colunas
              <input type="number" min="1" max="12" value={colunasTabela} onChange={e => setColunasTabela(e.target.value)}
                className="w-12 px-1 py-1 rounded border text-xs text-center" style={{ borderColor: C.border }} />
            </label>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={inserirTabela}
              className="px-2.5 py-1 rounded text-xs font-medium" style={{ background: C.navy, color: C.paper }}>
              Inserir
            </button>
          </div>
        )}
      </div>
      {btn("— Linha", () => exec("insertHorizontalRule"), "Inserir linha horizontal")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn("⌫", () => exec("removeFormat"), "Limpar formatação")}
      {btn("↶", () => exec("undo"), "Desfazer")}
      {btn("↷", () => exec("redo"), "Refazer")}
      {rotuloAlvo && (
        <span className="ml-auto text-[11px] px-2.5 py-1 rounded-full"
          style={{ background: C.paperDark, color: C.inkMuted }}>
          {rotuloAlvo}
        </span>
      )}
    </div>
  );
}

// ---------- Campo de texto formatado ----------
// Sincroniza o HTML só quando o valor muda de fora (ex.: "Usar modelo padrão"), para não
// atropelar o cursor enquanto se digita.
function CampoFormatado({ value, onChange, onFocus, placeholder, minHeight = "70px" }) {
  const ref = useRef(null);
  const [vazio, setVazio] = useState(!value);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
      setVazio(!ref.current.textContent.trim());
    }
  }, [value]);

  function aoDigitar() {
    const html = ref.current?.innerHTML || "";
    setVazio(!ref.current?.textContent.trim());
    onChange(html);
  }

  return (
    <div className="relative">
      {vazio && placeholder && (
        <span className="absolute pointer-events-none px-2 py-1.5 text-sm italic"
          style={{ color: "#B9B4A6" }}>{placeholder}</span>
      )}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={aoDigitar} onBlur={aoDigitar} onFocus={onFocus}
        className="px-2 py-1.5 text-sm leading-relaxed text-justify rounded-md"
        style={{ minHeight, outline: "none", border: "1px solid transparent" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.border; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; }} />
    </div>
  );
}

// Mantido para as telas que usam um editor isolado (timbre em texto da Secretaria)
function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) ref.current.innerHTML = value || "";
  }, [value]);

  function sincronizar() {
    onChange(ref.current?.innerHTML || "");
    setVersao(v => v + 1);
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
      <div className="border-b" style={{ borderColor: C.border, background: C.paperDark }}>
        <BarraFormatacao aoAlterar={sincronizar} />
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={sincronizar} onBlur={sincronizar}
        className="px-4 py-3 text-sm leading-relaxed"
        style={{ minHeight: "160px", background: "white", outline: "none" }} />
    </div>
  );
}

// ---------- Responsáveis técnicos (múltiplos, com diretório salvo entre ETPs) ----------
function ResponsaveisManager({ responsaveis, onChange }) {
  const [diretorio, setDiretorio] = useState([]); // [{nome, cargo}] — pessoas já usadas em qualquer ETP
  const [novoNome, setNovoNome] = useState("");
  const [novoCargo, setNovoCargo] = useState("");

  useEffect(() => {
    storage.get("diretorio:responsaveis", false)
      .then(r => setDiretorio(r?.value ? JSON.parse(r.value) : []))
      .catch(() => setDiretorio([]));
  }, []);

  function salvarNoDiretorio(nome, cargo) {
    setDiretorio(prev => {
      const semDuplicata = prev.filter(p => p.nome.toLowerCase() !== nome.toLowerCase());
      const atualizado = [...semDuplicata, { nome, cargo }];
      storage.set("diretorio:responsaveis", JSON.stringify(atualizado), false).catch(() => {});
      return atualizado;
    });
  }

  function preencherPeloDiretorio(nome) {
    const encontrado = diretorio.find(p => p.nome === nome);
    if (encontrado) setNovoCargo(encontrado.cargo || "");
  }

  function adicionar() {
    if (!novoNome.trim()) return;
    const novo = { id: "resp_" + Math.random().toString(36).slice(2, 8), nome: novoNome.trim(), cargo: novoCargo.trim() };
    onChange([...(responsaveis || []), novo]);
    salvarNoDiretorio(novo.nome, novo.cargo);
    setNovoNome("");
    setNovoCargo("");
  }

  function remover(id) {
    onChange((responsaveis || []).filter(r => r.id !== id));
  }

  return (
    <div className="mb-4 p-3.5 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
      <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
        Responsáveis técnicos (assinatura)
      </span>

      {(!responsaveis || responsaveis.length === 0) ? (
        <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
          Nenhum responsável adicionado ainda. Pode incluir mais de um — todos assinam o documento final.
        </p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {responsaveis.map(r => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: C.border, background: "white" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{r.nome}</p>
                {r.cargo && <p className="text-xs truncate" style={{ color: C.inkMuted }}>{r.cargo}</p>}
              </div>
              <button onClick={() => remover(r.id)} className="shrink-0" style={{ color: C.red }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input list="diretorio-nomes" value={novoNome}
          onChange={e => { setNovoNome(e.target.value); preencherPeloDiretorio(e.target.value); }}
          placeholder="Nome do responsável" className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
        <input list="diretorio-cargos" value={novoCargo} onChange={e => setNovoCargo(e.target.value)}
          placeholder="Cargo (opcional)" className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
        <button onClick={adicionar} disabled={!novoNome.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: C.navy, color: C.paper }}>
          <Plus size={13} /> Adicionar
        </button>
      </div>
      <datalist id="diretorio-nomes">
        {diretorio.map(p => <option key={p.nome} value={p.nome} />)}
      </datalist>
      <datalist id="diretorio-cargos">
        {[...new Set(diretorio.map(p => p.cargo).filter(Boolean))].map(c => <option key={c} value={c} />)}
      </datalist>
      <p className="text-[10px] mt-2" style={{ color: C.inkMuted }}>
        Nomes já usados em qualquer ETP aparecem como sugestão automática — fica salvo neste navegador, entre ETPs.
      </p>
    </div>
  );
}

// ---------- Soluções de mercado pesquisadas (inciso IV) ----------
function SolucoesMercadoManager({ solucoes, onChange }) {
  const [novaSolucao, setNovaSolucao] = useState("");

  function adicionar() {
    if (!novaSolucao.trim()) return;
    onChange([...solucoes, { id: "sol_" + Math.random().toString(36).slice(2, 8), nome: novaSolucao.trim(), selecionada: solucoes.length === 0 }]);
    setNovaSolucao("");
  }
  function remover(id) {
    onChange(solucoes.filter(s => s.id !== id));
  }
  function selecionar(id) {
    onChange(solucoes.map(s => ({ ...s, selecionada: s.id === id })));
  }

  return (
    <div className="mb-4 p-3.5 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
      <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
        Soluções de mercado pesquisadas
      </span>

      {solucoes.length === 0 ? (
        <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
          Nenhuma solução cadastrada ainda. Adicione todas as opções encontradas na pesquisa (podem ser 3, 4, 5 ou mais) e marque a escolhida.
        </p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {solucoes.map(s => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: s.selecionada ? C.brass : C.border, background: "white" }}>
              <span className="text-sm flex-1">{s.nome}</span>
              {s.selecionada ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: "rgba(166,131,46,0.15)", color: C.brass }}>
                  <Check size={12} /> Escolhida
                </span>
              ) : (
                <button onClick={() => selecionar(s.id)}
                  className="text-xs font-medium px-2 py-1 rounded-full shrink-0" style={{ color: C.navy, border: `1px solid ${C.border}` }}>
                  Selecionar esta
                </button>
              )}
              <button onClick={() => remover(s.id)} className="shrink-0" style={{ color: C.red }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input value={novaSolucao} onChange={e => setNovaSolucao(e.target.value)}
          onKeyDown={e => e.key === "Enter" && adicionar()}
          placeholder="Ex.: Aquisição direta de equipamento novo"
          className="flex-1 px-2 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
        <button onClick={adicionar} disabled={!novaSolucao.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: C.navy, color: C.paper }}>
          <Plus size={13} /> Adicionar
        </button>
      </div>
      <p className="text-[10px] mt-2" style={{ color: C.inkMuted }}>
        Essas opções entram automaticamente no "Usar modelo padrão" abaixo, junto com a que foi escolhida.
      </p>
    </div>
  );
}

// ---------- Vínculo de um item a uma linha do PCA ----------
// Resolve o caso em que o código do item no Centi é diferente do código no PCA: o servidor
// busca a linha certa (por código, sequencial ou descrição) e vincula manualmente.
function VinculoPca({ item, pca, dados, onAlterar }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const vinculada = dados?.codigoPca ? linhaPcaPorCodigo(pca, dados.codigoPca) : null;
  const resultados = buscarNoPca(pca, busca);

  function vincular(linha) {
    onAlterar({ ...dados, codigoPca: linha.codigo, sequencial: linha.sequencial || "" });
    setBusca("");
    setAberto(false);
  }

  function desvincular() {
    onAlterar({ ...dados, codigoPca: "", sequencial: "" });
  }

  if (vinculada) {
    return (
      <div className="p-2.5 rounded-lg" style={{ background: "rgba(76,124,89,0.08)", border: "1px solid rgba(76,124,89,0.35)" }}>
        <div className="flex items-start gap-2">
          <Check size={13} className="shrink-0 mt-0.5" style={{ color: C.green }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: C.navy }}>
              Vinculado ao PCA · sequencial {vinculada.sequencial || "—"}
            </p>
            <p className="text-[11px] leading-snug mt-0.5" style={{ color: C.inkMuted }}>
              Código no PCA: <b style={{ color: C.ink }}>{vinculada.codigo}</b>
              {item.idProduto && item.idProduto !== vinculada.codigo && (
                <> · no Centi: <b style={{ color: C.ink }}>{item.idProduto}</b></>
              )}
            </p>
            <p className="text-[11px] leading-snug" style={{ color: C.inkMuted }}>{vinculada.produto}</p>
          </div>
          <button onClick={desvincular} className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded"
            style={{ color: C.red }}>Desfazer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {item.idProduto && (
        <p className="text-[11px] mb-1.5" style={{ color: C.inkMuted }}>
          Código deste item no Centi: <b style={{ color: C.ink }}>{item.idProduto}</b> — não localizado no PCA.
        </p>
      )}
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Localizar no PCA
        </span>
        <input value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          placeholder="Código do PCA, sequencial ou parte da descrição…"
          className="mt-1 w-full px-2.5 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
      </label>

      {aberto && busca.trim().length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden max-h-56 overflow-y-auto etp-scroll"
          style={{ background: "white", borderColor: C.border }}>
          {resultados.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-xs font-medium mb-1" style={{ color: C.ink }}>
                Nada encontrado no PCA para "{busca}".
              </p>
              {mesmoCodigo(busca, item.idProduto) ? (
                <p className="text-[11px] leading-relaxed" style={{ color: C.inkMuted }}>
                  Este é o código do item no Centi — e ele não consta na planilha do PCA importada.
                  É justamente esse o caso em que o código do PCA é <b>outro</b>: procure pelo{" "}
                  <b>nome do produto</b> ou pelo <b>sequencial</b>. Se o item realmente não estiver no
                  plano, deixe em branco e use a planilha de inclusão no Centi.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed" style={{ color: C.inkMuted }}>
                  Tente pelo nome do produto ou pelo sequencial. A planilha importada tem{" "}
                  {pca?.linhas?.length || 0} linha(s).
                </p>
              )}
            </div>
          ) : resultados.map((l, i) => (
            <button key={`${l.codigo}-${l.sequencial}-${i}`} onClick={() => vincular(l)}
              className="w-full text-left px-3 py-2 hover:bg-black/[0.03]"
              style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
              <p className="text-xs font-medium leading-snug" style={{ color: C.navy }}>{l.produto || "(sem descrição)"}</p>
              <p className="text-[10.5px] mt-0.5" style={{ color: C.inkMuted }}>
                cód. <b>{l.codigo || "—"}</b> · seq. <b>{l.sequencial || "—"}</b>
                {l.local ? ` · ${l.local}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] mt-1.5" style={{ color: C.inkMuted }}>
        Use quando o código do item no Centi for diferente do código no PCA. Se preferir, informe o
        sequencial direto no campo abaixo.
      </p>
      <label className="block mt-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Ou informe o sequencial à mão
        </span>
        <input value={dados?.sequencial || ""}
          onChange={e => onAlterar({ ...dados, sequencial: e.target.value, codigoPca: "" })}
          placeholder="Ex.: 10808"
          className="mt-1 w-full px-2.5 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
      </label>
    </div>
  );
}

// ---------- Checklist de conformidade ----------
function ChecklistConformidade({ etp, onIrPara, onFechar }) {
  const apontamentos = verificarConformidade(etp);
  const impeditivos = apontamentos.filter(a => a.nivel === "impeditivo");
  const atencoes = apontamentos.filter(a => a.nivel === "atencao");
  const oks = apontamentos.filter(a => a.nivel === "ok");
  const liberado = impeditivos.length === 0;

  const rotuloEtapa = {
    meta: "Dados do Processo", itens: "Planilha de Itens",
    pca: "Alinhamento ao PCA", cotacoes: "Levantamento de Preços",
    documento: "Documento",
  };

  const linha = (a, i, cor, icone) => (
    <button key={i} onClick={() => { onIrPara(a.onde); onFechar(); }}
      className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-black/[0.02]"
      style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
      <span className="shrink-0 mt-0.5" style={{ color: cor }}>{icone}</span>
      <span className="flex-1 text-xs leading-relaxed" style={{ color: C.ink }}>{a.texto}</span>
      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full"
        style={{ background: C.paperDark, color: C.inkMuted }}>
        {rotuloEtapa[a.onde] || a.onde}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
      onClick={onFechar}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">

        <div className="p-5 pb-4 border-b sticky top-0 bg-white rounded-t-xl z-10" style={{ borderColor: C.border }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
                <ClipboardList size={15} />
                <span className="text-xs font-semibold tracking-widest uppercase">Antes de finalizar</span>
              </div>
              <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Conformidade do ETP</h3>
            </div>
            <button onClick={onFechar} className="shrink-0" style={{ color: C.inkMuted }}><X size={20} /></button>
          </div>

          <div className="mt-3 p-3 rounded-lg flex items-center gap-2 text-sm"
            style={{ background: liberado ? "rgba(76,124,89,0.1)" : "rgba(166,64,61,0.08)" }}>
            {liberado ? <Check size={16} style={{ color: C.green }} /> : <AlertCircle size={16} style={{ color: C.red }} />}
            <span style={{ color: C.ink }}>
              {liberado
                ? <>Nenhuma pendência impeditiva{atencoes.length > 0 ? ` — mas há ${atencoes.length} ponto(s) de atenção.` : ". O ETP está pronto para finalizar."}</>
                : <><b>{impeditivos.length} pendência(s) impeditiva(s)</b> — revise antes de finalizar o documento.</>}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {impeditivos.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.red }}>
                Impeditivos ({impeditivos.length})
              </h4>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "rgba(166,64,61,0.3)" }}>
                {impeditivos.map((a, i) => linha(a, i, C.red, <AlertCircle size={13} />))}
              </div>
            </div>
          )}

          {atencoes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.brass }}>
                Pontos de atenção ({atencoes.length})
              </h4>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                {atencoes.map((a, i) => linha(a, i, C.brass, <Info size={13} />))}
              </div>
            </div>
          )}

          {oks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.green }}>
                Verificado ({oks.length})
              </h4>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                {oks.map((a, i) => linha(a, i, C.green, <Check size={13} />))}
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed" style={{ color: C.inkMuted }}>
            Esta conferência é um apoio ao seu trabalho, não um parecer jurídico. Ela verifica o preenchimento
            e a coerência interna do documento — a adequação de cada texto ao caso concreto continua sendo
            avaliação sua. Clique em qualquer linha para ir direto ao ponto.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Documento contínuo dos incisos ----------
// Todos os 13 incisos numa página só, no formato do documento final. A barra de formatação
// fica fixa no topo e age sobre o inciso em foco, como no Word.
function DocumentoIncisos({ etp, onSection, onSolucoesMercado, onExcluidos, secretarias }) {
  const [focado, setFocado] = useState(null);
  const [promptAberto, setPromptAberto] = useState(null); // { id, texto }
  const [copiado, setCopiado] = useState(false);
  const [timbreGlobal, setTimbreGlobal] = useState(null);

  useEffect(() => {
    obterTimbreGlobal()
      .then(setTimbreGlobal)
      .catch(() => {});
  }, []);

  const excluidos = etp.incisosExcluidos || [];
  const numeros = numeracaoFinal(etp);
  const cabecalho = resolverCabecalho(etp, secretarias, timbreGlobal);

  function alternarExclusao(id, obrigatorio) {
    if (!excluidos.includes(id) && obrigatorio) {
      const ok = window.confirm(
        `O inciso ${id} é de preenchimento obrigatório pelo art. 18, §2º, da Lei nº 14.133/2021.\n\n` +
        `Os demais podem ser dispensados justificadamente, mas este exige fundamentação específica.\n\n` +
        `Deseja mesmo deixá-lo fora deste ETP?`);
      if (!ok) return;
    }
    onExcluidos(excluidos.includes(id) ? excluidos.filter(x => x !== id) : [...excluidos, id]);
  }

  function usarModelo(id) {
    const gerar = MODELOS_PADRAO[id];
    if (gerar) onSection(id, textoParaHtml(gerar(etp)));
  }

  function abrirPrompt(id) {
    setPromptAberto({ id, texto: gerarPromptIA(etp, id) });
    setCopiado(false);
  }

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(promptAberto.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) { console.error(e); }
  }

  const secaoFocada = SECOES.find(s => s.id === focado);
  const totalNoDoc = Object.keys(numeros).length;

  return (
    <div>
      {/* Barra de formatação fixa */}
      <div className="sticky top-0 z-20 border-b" style={{ background: "white", borderColor: C.border }}>
        <BarraFormatacao
          rotuloAlvo={secaoFocada ? `Editando: ${numeros[secaoFocada.id] || secaoFocada.id} — ${secaoFocada.titulo}` : "Clique num inciso para editar"} />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-7">
        {/* Resumo do documento */}
        <div className="flex items-center gap-2 mb-5 p-3 rounded-lg text-xs flex-wrap"
          style={{ background: C.paperDark, color: C.inkMuted }}>
          <FileText size={14} style={{ color: C.brass }} />
          <span><b style={{ color: C.navy }}>{totalNoDoc}</b> de 13 incisos entrarão no documento</span>
          {excluidos.length > 0 && <span>· {excluidos.length} deixado(s) de fora</span>}
          <button onClick={() => { setPromptAberto({ id: "todos", texto: gerarPromptGeralIA(etp) }); setCopiado(false); }}
            className="ml-auto px-2.5 py-1 rounded-md text-[10.5px] font-semibold"
            style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}
            title="Monta um único texto pedindo os 13 incisos de uma vez">
            ⧉ Texto para IA externa · todos
          </button>
        </div>

        {/* Folha do documento */}
        <div className="rounded-xl border p-10 shadow-sm" style={{ background: "white", borderColor: C.border }}>
          {cabecalho.tipo === "imagem" && cabecalho.dataUrl && (
            <div className="pb-4 mb-6 border-b text-center" style={{ borderColor: C.border }}>
              <img src={cabecalho.dataUrl} alt="Timbre" style={{ maxHeight: "70px", maxWidth: "100%", margin: "0 auto" }} />
            </div>
          )}
          {cabecalho.tipo === "texto" && cabecalho.html && (
            <div className="pb-4 mb-6 border-b text-center rich-content text-xs" style={{ borderColor: C.border, color: C.ink }}
              dangerouslySetInnerHTML={{ __html: cabecalho.html }} />
          )}

          <h2 className="serif text-xl font-semibold text-center mb-1" style={{ color: C.navy }}>
            ESTUDO TÉCNICO PRELIMINAR
          </h2>
          <p className="text-xs text-center italic mb-7" style={{ color: C.inkMuted }}>
            Lei nº 14.133/2021 · art. 18
          </p>

          {SECOES.map(s => {
            const fora = excluidos.includes(s.id);
            const numero = numeros[s.id];
            const mudou = numero && numero !== s.id;
            const preenchido = !!etp.sections[s.id]?.trim();
            const emFoco = focado === s.id;

            if (fora) {
              return (
                <div key={s.id} className="flex items-center gap-2 my-1.5 px-3 py-2 rounded-lg text-xs"
                  style={{ background: C.paperDark, color: C.inkMuted }}>
                  <X size={12} className="shrink-0" style={{ color: C.red }} />
                  <span><b style={{ color: C.ink }}>{s.id} — {s.titulo}</b> · fora deste ETP</span>
                  <button onClick={() => alternarExclusao(s.id, s.obrig)}
                    className="ml-auto px-2.5 py-1 rounded-md text-[10px] font-semibold shrink-0"
                    style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}>
                    Incluir de volta
                  </button>
                </div>
              );
            }

            return (
              <section key={s.id} id={`inciso-${s.id}`} className="group py-3 rounded-lg"
                style={{
                  background: emFoco ? "rgba(166,131,46,0.035)" : "transparent",
                  boxShadow: emFoco ? "-14px 0 0 rgba(166,131,46,0.035), 14px 0 0 rgba(166,131,46,0.035)" : "none",
                  scrollMarginTop: "110px",
                }}
                onClick={() => setFocado(s.id)}>

                <div className="flex items-baseline gap-2 justify-center flex-wrap mb-1">
                  <h3 className="serif text-sm font-bold uppercase tracking-wide" style={{ color: C.navy }}>
                    {numero || s.id} — {s.titulo}
                  </h3>
                  {s.obrig && (
                    <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>Obrigatório</span>
                  )}
                  {mudou && (
                    <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(166,131,46,0.15)", color: C.brass }}>
                      era {s.id} · sairá como {numero}
                    </span>
                  )}
                  {!preenchido && (
                    <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: C.paperDark, color: C.inkMuted }}>vazio · não sairá</span>
                  )}
                </div>
                <p className="text-[11px] text-center italic mb-2" style={{ color: C.inkMuted }}>{s.ajuda}</p>

                <div className="flex items-center gap-1.5 justify-center mb-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ opacity: emFoco ? 1 : undefined }}>
                  {MODELOS_PADRAO[s.id] && (() => {
                    const semPca = s.id === "II" && (!etp.pca || (etp.itens || []).length === 0);
                    return (
                      <button onClick={e => { e.stopPropagation(); if (!semPca) usarModelo(s.id); }}
                        disabled={semPca}
                        className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold disabled:opacity-40"
                        style={{ background: C.brass, color: C.navyDark }}
                        title={semPca
                          ? 'Importe a planilha do PCA na etapa "2. Alinhamento ao PCA" primeiro'
                          : "Preenche com o texto-modelo do app — grátis, sem IA"}>
                        ✎ Modelo padrão
                      </button>
                    );
                  })()}
                  <button onClick={e => { e.stopPropagation(); abrirPrompt(s.id); }}
                    className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold"
                    style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}
                    title="Abre o texto pronto para você revisar e levar a uma IA gratuita">
                    ⧉ Texto para IA externa
                  </button>
                  <button onClick={e => { e.stopPropagation(); alternarExclusao(s.id, s.obrig); }}
                    className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold"
                    style={{ background: "white", color: C.red, border: "1px solid rgba(166,64,61,0.3)" }}
                    title="Deixa este inciso fora do documento final">
                    × Não incluir
                  </button>
                </div>

                {s.id === "IV" && (
                  <div onClick={e => e.stopPropagation()}>
                    <SolucoesMercadoManager solucoes={etp.solucoesMercado || []} onChange={onSolucoesMercado} />
                  </div>
                )}

                <CampoFormatado
                  value={etp.sections[s.id] || ""}
                  onChange={v => onSection(s.id, v)}
                  onFocus={() => setFocado(s.id)}
                  placeholder="Clique para escrever, ou use o Modelo padrão acima…"
                />

                <QuadrosAutomaticos etp={etp} secaoId={s.id} />
              </section>
            );
          })}

          <div className="mt-9 pt-5 border-t text-center text-xs" style={{ borderColor: C.border, color: C.ink }}>
            <p>{linhaAssinaturaData(etp)}</p>
            {listaResponsaveis(etp).map(r => (
              <div key={r.id} className="mt-7">
                <p>_______________________________________</p>
                <p className="font-semibold mt-1">{r.nome}</p>
                {r.cargo && <p style={{ color: C.inkMuted }}>{r.cargo}</p>}
              </div>
            ))}
            {listaResponsaveis(etp).length === 0 && (
              <div className="mt-7" style={{ color: C.inkMuted }}>
                <p>_______________________________________</p>
                <p className="mt-1 italic">Cadastre o responsável em "Dados do Processo"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pop-up do prompt — editável antes de copiar */}
      {promptAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(18,32,50,0.6)" }} onClick={() => setPromptAberto(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl"
              style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-lg font-semibold" style={{ color: C.navy }}>
                  {promptAberto.id === "todos" ? "Texto para IA externa — todos os incisos" : `Texto para IA externa — inciso ${promptAberto.id}`}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  Revise ou ajuste abaixo, copie e cole numa IA gratuita (ChatGPT, Gemini etc.).
                  Depois traga a resposta para o campo do inciso.
                </p>
              </div>
              <button onClick={() => setPromptAberto(null)} className="shrink-0" style={{ color: C.inkMuted }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <textarea value={promptAberto.texto}
                onChange={e => setPromptAberto({ ...promptAberto, texto: e.target.value })}
                rows={16}
                className="w-full px-3 py-2.5 rounded-lg border text-xs font-mono leading-relaxed resize-y"
                style={{ borderColor: C.border, background: C.paperDark, color: C.ink }} />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button onClick={() => setPromptAberto(null)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                  Fechar
                </button>
                <button onClick={copiarPrompt}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: C.navy, color: C.paper }}>
                  <Copy size={14} /> {copiado ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quadros que o app monta sozinho e que aparecem dentro dos incisos II, V e VI
function QuadrosAutomaticos({ etp, secaoId }) {
  const marca = (titulo, conteudo, obs) => (
    <div className="mt-3 mb-1 rounded-lg p-3"
      style={{ border: `1px dashed ${C.brassLight}`, background: "rgba(166,131,46,0.045)" }}>
      <p className="text-[9px] font-bold uppercase tracking-wide mb-2" style={{ color: C.brass }}>
        ▦ Gerado automaticamente · {titulo}
      </p>
      {conteudo}
      {obs && <p className="text-[9.5px] mt-1.5 italic" style={{ color: C.inkMuted }}>{obs}</p>}
    </div>
  );

  if (secaoId === "II" && etp.pca && etp.itens?.length > 0) {
    return marca("Alinhamento ao PCA", (
      <table className="w-full text-[10.5px] border-collapse">
        <thead>
          <tr style={{ background: C.paperDark }}>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Item</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Descrição</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Consta?</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Sequencial</th>
          </tr>
        </thead>
        <tbody>
          {cruzarComPca(etp.itens, etp.pca, etp.manuaisPca).slice(0, 4).map((m, i) => (
            <tr key={m.item.id}>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{i + 1}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{m.item.descricao || "-"}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{m.previsto ? "Sim" : "Não"}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{m.sequencial || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ), etp.itens.length > 4
      ? `Mostrando 4 de ${etp.itens.length} itens — o documento final traz todos.`
      : "Vem da etapa 2 — Alinhamento ao PCA.");
  }

  if (secaoId === "V" && etp.itens?.length > 0) {
    return marca("Quadro de quantitativos", (
      <table className="w-full text-[10.5px] border-collapse">
        <thead>
          <tr style={{ background: C.paperDark }}>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Item</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Descrição</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Und.</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Qtd.</th>
          </tr>
        </thead>
        <tbody>
          {etp.itens.slice(0, 4).map((it, i) => (
            <tr key={it.id}>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{i + 1}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{it.descricao || "-"}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{it.unidade || ""}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{it.quantidade || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ), etp.itens.length > 4
      ? `Mostrando 4 de ${etp.itens.length} itens — o documento final traz todos.`
      : "Vem da etapa 1 — Planilha de Itens.");
  }

  if (secaoId === "VI") {
    const html = gerarRelatorioEstimativaHtml(etp);
    if (!html) return null;
    return marca("Comprobatório da estimativa de valor", (
      <div className="text-[10.5px] rich-content" style={{ color: C.ink }}
        dangerouslySetInnerHTML={{ __html: html }} />
    ), "Vem da etapa 4 — Levantamento de Preços.");
  }

  return null;
}

// ---------- Planilha de Itens ----------
function ItemsForm({ etp, onItens, onMeta }) {
  const itens = etp.itens || [];
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);

  function update(idx, field, val) {
    const next = itens.map((it, i) => (i === idx ? { ...it, [field]: val } : it));
    onItens(next);
  }
  function add() { onItens([...itens, newItem()]); }
  function remove(idx) {
    const id = itens[idx]?.id;
    onItens(itens.filter((_, i) => i !== idx));
    if (id) setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  function toggleOne(id) {
    setConfirmBulk(false);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setConfirmBulk(false);
    setSelected(prev => (prev.size === itens.length ? new Set() : new Set(itens.map(it => it.id))));
  }
  function removeSelected() {
    if (selected.size === 0) return;
    onItens(itens.filter(it => !selected.has(it.id)));
    setSelected(new Set());
    setConfirmBulk(false);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const result = parseCentiSheet(rows);
      if (result.itens.length === 0) throw new Error("Nenhum item encontrado nesta planilha.");
      if (itens.length > 0) {
        setPendingImport(result); // pede confirmação inline antes de substituir
      } else {
        applyImport(result);
      }
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Não foi possível importar esta planilha.");
    }
    setImporting(false);
    e.target.value = "";
  }

  function applyImport(result) {
    onItens(result.itens);
    setSelected(new Set());
    setConfirmBulk(false);
    if (result.codigo && !etp.meta.processo) onMeta("processo", "Pedido " + result.codigo);
    if (result.municipio && !etp.meta.orgao) onMeta("orgao", result.municipio);
    setImportMsg(`${result.itens.length} itens importados.`);
    setPendingImport(null);
  }

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>1. Planilha de Itens</h2>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        Primeiro passo: o que será comprado. Só a relação de itens — sem valores. A estimativa de valor vem depois,
        na etapa de Levantamento de Preços, com base nas cotações do Banco de Preços.
      </p>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: C.navy, color: C.paper }}>
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {importing ? "Importando..." : "Importar planilha do Sistema Centi"}
        </button>
        <button onClick={baixarModeloPlanilha}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: C.paperDark, color: C.navy }}>
          <FileText size={13} /> Baixar modelo em branco
        </button>
        {importMsg && <span className="text-xs" style={{ color: C.green }}>{importMsg}</span>}
        {selected.size > 0 && !confirmBulk && (
          <button onClick={() => setConfirmBulk(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
            <Trash2 size={13} /> Excluir selecionados ({selected.size})
          </button>
        )}
      </div>

      {confirmBulk && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "rgba(166,64,61,0.08)" }}>
          <AlertCircle size={15} className="shrink-0" style={{ color: C.red }} />
          <span className="text-xs flex-1" style={{ color: C.ink }}>
            {selected.size === itens.length
              ? `Confirma a exclusão de todos os ${itens.length} itens?`
              : `Confirma a exclusão dos ${selected.size} itens selecionados?`}
          </span>
          <button onClick={removeSelected}
            className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: C.red, color: "white" }}>
            Confirmar exclusão
          </button>
          <button onClick={() => setConfirmBulk(false)}
            className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
            Cancelar
          </button>
        </div>
      )}
      {pendingImport && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "rgba(166,131,46,0.1)" }}>
          <AlertCircle size={15} className="shrink-0" style={{ color: C.brass }} />
          <span className="text-xs flex-1" style={{ color: C.ink }}>
            Substituir os {itens.length} itens atuais pelos {pendingImport.itens.length} itens importados?
          </span>
          <button onClick={() => applyImport(pendingImport)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: C.brass, color: C.navyDark }}>
            Confirmar substituição
          </button>
          <button onClick={() => setPendingImport(null)}
            className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
            Cancelar
          </button>
        </div>
      )}

      {importError && (
        <p className="text-xs mb-3 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {importError}</p>
      )}

      <div className="rounded-lg border overflow-x-auto etp-scroll" style={{ borderColor: C.border }}>
        <table className="w-full text-sm" style={{ minWidth: "760px" }}>
          <thead>
            <tr style={{ background: C.paperDark }}>
              <th className="px-3 py-2 w-8">
                {itens.length > 0 && (
                  <input type="checkbox" checked={selected.size === itens.length} onChange={toggleAll}
                    style={{ accentColor: C.brass }} className="w-3.5 h-3.5" />
                )}
              </th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-8" style={{ color: C.inkMuted }}>#</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-32" style={{ color: C.inkMuted }}>
                Código
              </th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-24" style={{ color: C.inkMuted }}>Unid.</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-16" style={{ color: C.inkMuted }}>Qtd.</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-40" style={{ color: C.inkMuted }}>Classificação</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, idx) => (
              <tr key={it.id} className="border-t align-top" style={{ borderColor: C.border, background: selected.has(it.id) ? "rgba(166,131,46,0.06)" : "transparent" }}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleOne(it.id)}
                    style={{ accentColor: C.brass }} className="w-3.5 h-3.5" />
                </td>
                <td className="px-2 py-2 text-xs" style={{ color: C.inkMuted }}>{idx + 1}</td>
                <td className="px-2 py-2">
                  {(() => {
                    const noPca = linhaPcaPorCodigo(etp.pca, it.idProduto);
                    return (
                      <>
                        <input value={it.idProduto || ""} onChange={e => update(idx, "idProduto", e.target.value)}
                          placeholder="Cód. Centi"
                          className="w-full px-2 py-1.5 rounded border text-sm font-mono"
                          style={{ borderColor: noPca ? C.green : (it.idProduto?.trim() ? C.border : C.brassLight) }}
                          title="Código do produto no Sistema Centi — é por ele que o app cruza o item com o PCA" />
                        {noPca && (
                          <p className="text-[9.5px] mt-1 leading-snug flex items-start gap-1" style={{ color: C.green }}>
                            <Check size={9} className="shrink-0 mt-0.5" />
                            <span>seq. {noPca.sequencial || "—"}</span>
                          </p>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="px-2 py-2">
                  {(() => {
                    const noPca = linhaPcaPorCodigo(etp.pca, it.idProduto);
                    return (
                      <>
                        <input value={it.descricao} onChange={e => update(idx, "descricao", e.target.value)}
                          placeholder="Descrição do item" className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                        {noPca && noPca.produto && (
                          <p className="text-[9.5px] mt-1 leading-snug px-1" style={{ color: C.inkMuted }}>
                            No PCA: {noPca.produto}
                            {!it.descricao?.trim() && (
                              <button onClick={() => update(idx, "descricao", noPca.produto)}
                                className="ml-1.5 font-semibold" style={{ color: C.brass }}>usar</button>
                            )}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="px-2 py-2">
                  <input value={it.unidade} onChange={e => update(idx, "unidade", e.target.value)}
                    className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                </td>
                <td className="px-2 py-2">
                  <input value={it.quantidade} onChange={e => update(idx, "quantidade", e.target.value)}
                    className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                </td>
                <td className="px-2 py-2">
                  <input list="classificacoes-usadas" value={it.classificacao || ""}
                    onChange={e => update(idx, "classificacao", e.target.value)}
                    placeholder="Ex.: MATERIAL DE COPA"
                    className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                </td>
                <td className="px-2 py-2">
                  <button onClick={() => remove(idx)} style={{ color: C.red }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="classificacoes-usadas">
          {[...new Set(itens.map(i => i.classificacao).filter(Boolean))].map(c => <option key={c} value={c} />)}
        </datalist>
        {itens.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: C.inkMuted }}>Nenhum item adicionado ainda. Importe uma planilha ou adicione manualmente.</p>
        )}
      </div>

      <button onClick={add} className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium"
        style={{ background: C.paperDark, color: C.navy }}>
        <Plus size={13} /> Adicionar item
      </button>

      {itens.length > 0 && (() => {
        const semCodigo = itens.filter(i => !i.idProduto?.trim()).length;
        return (
          <>
            <div className="mt-4 p-3 rounded-lg flex items-center gap-2 text-xs" style={{ background: C.paperDark, color: C.inkMuted }}>
              <Info size={13} className="shrink-0" style={{ color: C.brass }} />
              {itens.length} item(ns) cadastrado(s). Os valores serão levantados na etapa "4. Levantamento de Preços".
            </div>
            {semCodigo > 0 && (
              <div className="mt-2 p-3 rounded-lg flex items-start gap-2 text-xs leading-relaxed"
                style={{ background: "rgba(166,131,46,0.1)", color: C.ink }}>
                <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
                <span>
                  <b>{semCodigo} item(ns) sem código.</b> O cruzamento com o PCA é feito pelo código do produto —
                  sem ele, o item não será localizado automaticamente na etapa 2 e você terá de informar o
                  sequencial à mão. Se possível, preencha o código do Sistema Centi.
                </span>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ---------- Alinhamento ao PCA ----------
function PCAForm({ etp, onPca, onManuaisPca }) {
  const itens = etp.itens || [];
  const pca = etp.pca;
  const manuais = etp.manuaisPca || {};
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [showFaltantes, setShowFaltantes] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const linhas = parsePCASheet(rows);
      onPca({ nomeArquivo: file.name, importedAt: Date.now(), linhas });
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Não foi possível importar esta planilha.");
    }
    setImporting(false);
    e.target.value = "";
  }

  function atualizarManual(itemId, campo, valor) {
    const atual = manuais[itemId] || { codigo: "", sequencial: "" };
    onManuaisPca({ ...manuais, [itemId]: { ...atual, [campo]: valor } });
  }

  const matches = cruzarComPca(itens, pca, manuais);
  const encontrados = matches.filter(m => m.previsto).length;
  const semMatchAutomatico = matches.filter(m => !m.pcaRow).map(m => m.item);
  const itensFaltantes = matches.filter(m => !m.previsto).map(m => m.item);
  const totalmenteAlinhado = itens.length > 0 && pca && encontrados === itens.length;

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>2. Alinhamento ao PCA</h2>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        Importe a planilha exportada do painel do PCA. O app cruza os itens pelo código do produto e mostra
        quais já estão previstos no plano.
      </p>

      <div className="mb-5 p-4 rounded-lg border" style={{ borderColor: C.border, background: "white" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-sm font-semibold" style={{ color: C.navy }}>Planilha do PCA</span>
          {pca && (
            <span className="text-xs" style={{ color: C.inkMuted }}>
              {pca.nomeArquivo} · {pca.linhas.length} itens no painel · importada em {fmtDate(pca.importedAt)}
            </span>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: C.navy, color: C.paper }}>
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {importing ? "Importando..." : pca ? "Atualizar planilha do PCA" : "Importar planilha do PCA"}
        </button>
        {importError && (
          <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}>
            <AlertCircle size={12} /> {importError}
          </p>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="text-sm" style={{ color: C.inkMuted }}>
          Cadastre os itens na etapa "1. Planilha de Itens" primeiro.
        </p>
      ) : !pca ? (
        <p className="text-sm" style={{ color: C.inkMuted }}>
          Importe a planilha do PCA acima para ver o cruzamento.
        </p>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.paperDark }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase w-10" style={{ color: C.inkMuted }}>#</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Consta no PCA?</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Sequencial</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, idx) => (
                  <tr key={m.item.id} className="border-t align-top" style={{ borderColor: C.border }}>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkMuted }}>{idx + 1}</td>
                    <td className="px-3 py-2">{m.item.descricao || `Item ${idx + 1}`}</td>
                    <td className="px-2 py-2">
                      {m.previsto ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(76,124,89,0.12)", color: C.green }}>
                          <Check size={11} /> Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
                          <AlertCircle size={11} /> Não
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs" style={{ color: m.previsto ? C.ink : C.inkMuted }}>
                      {m.sequencial || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 p-3 rounded-lg flex items-center gap-2 text-xs flex-wrap"
            style={{ background: totalmenteAlinhado ? "rgba(76,124,89,0.1)" : "rgba(166,131,46,0.1)", color: C.ink }}>
            {totalmenteAlinhado ? <Check size={14} style={{ color: C.green }} /> : <Info size={14} style={{ color: C.brass }} />}
            <span><b>{encontrados}</b> de <b>{itens.length}</b> itens previstos no PCA (inclui os informados à mão).</span>
          </div>

          {semMatchAutomatico.length > 0 && (
            <button onClick={() => setShowFaltantes(true)}
              className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: itensFaltantes.length > 0 ? "rgba(166,64,61,0.1)" : "rgba(166,131,46,0.12)",
                color: itensFaltantes.length > 0 ? C.red : C.brass,
              }}>
              <ListX size={13} /> Itens não localizados automaticamente ({semMatchAutomatico.length}
              {itensFaltantes.length !== semMatchAutomatico.length ? ` · ${itensFaltantes.length} pendente(s)` : ""})
            </button>
          )}
        </>
      )}

      {showFaltantes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
          onClick={() => setShowFaltantes(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl z-10"
              style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Itens sem previsão no PCA</h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  {itensFaltantes.length} de {semMatchAutomatico.length} ainda pendente(s)
                </p>
              </div>
              <button onClick={() => setShowFaltantes(false)} className="shrink-0" style={{ color: C.inkMuted }}>
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
                Estes itens não foram localizados automaticamente na planilha importada. Se algum já estiver
                previsto no PCA sob outro código, use a busca para localizar a linha correta — o app puxa o
                produto e o sequencial automaticamente. Os que ficarem sem preenchimento
                podem ser baixados numa planilha para inclusão no Sistema Centi.
              </p>

              <div className="space-y-3 mb-5">
                {semMatchAutomatico.map((it, idx) => {
                  const dados = manuais[it.id] || { codigo: "", codigoPca: "", sequencial: "" };
                  const resolvido = !!(dados.codigoPca?.trim() || dados.sequencial?.trim());
                  return (
                    <div key={it.id} className="p-4 rounded-lg border-2"
                      style={{
                        borderColor: resolvido ? "rgba(76,124,89,0.4)" : C.border,
                        background: resolvido ? "rgba(76,124,89,0.04)" : "white",
                      }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-xs font-semibold" style={{ color: C.inkMuted }}>
                            Item {itens.indexOf(it) + 1}
                          </span>
                          <p className="text-sm font-medium" style={{ color: C.navy }}>
                            {it.descricao || `Item ${idx + 1}`}
                          </p>
                        </div>
                        {resolvido ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: "rgba(76,124,89,0.15)", color: C.green }}>
                            <Check size={12} /> Previsto
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
                            <AlertCircle size={12} /> Pendente
                          </span>
                        )}
                      </div>
                      <VinculoPca item={it} pca={pca} dados={dados}
                        onAlterar={novos => onSalvar({ ...doc, manuais: { ...manuais, [it.id]: novos } })} />
                    </div>
                  );
                })}
              </div>

              {itensFaltantes.length > 0 && (
                <button onClick={() => baixarPlanilhaInclusaoCenti(itensFaltantes)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: C.navy, color: C.paper }}>
                  <Download size={14} /> Baixar planilha para inclusão no Centi ({itensFaltantes.length} pendente(s))
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const FONTES_COTACAO = ["Banco de Preços", "Internet", "Outro"];

function CotacoesForm({ etp, onCotacoes, onValoresAdotados, onMeta }) {
  const itens = etp.itens || [];
  const cotacoes = etp.cotacoes || {};
  const valoresAdotados = etp.valoresAdotados || {};
  const metodologia = etp.meta.metodologiaCalculo === "media" ? "media" : "mediana";
  const labelMetodologia = metodologia === "media" ? "média" : "mediana";
  const totalGeral = itens.reduce((sum, it) => sum + num(it.quantidade) * num(valoresAdotados[it.id]), 0);

  function valorMetodologia(stats) {
    return metodologia === "media" ? stats.media : stats.mediana;
  }

  const [activeItemId, setActiveItemId] = useState(null);
  const [margem, setMargem] = useState(25);
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportNome, setExportNome] = useState("");
  const [exportCnpj, setExportCnpj] = useState("");
  const [novaFonte, setNovaFonte] = useState(FONTES_COTACAO[0]);
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [novoValor, setNovoValor] = useState("");

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importMsg, setImportMsg] = useState("");

  // Fontes já usadas neste ETP + as sugestões padrão — cresce conforme o servidor digita novas
  const fontesConhecidas = [...new Set([
    ...FONTES_COTACAO,
    ...Object.values(cotacoes).flat().map(q => q.fonte).filter(Boolean),
  ])];

  function forDoPadrao(valor, mediana) {
    const v = num(valor);
    if (!v || !mediana) return false;
    return Math.abs(v - mediana) / mediana > margem / 100;
  }

  function abrirPopup(itemId) {
    setActiveItemId(itemId);
    setNovaFonte(FONTES_COTACAO[0]);
    setNovaEmpresa("");
    setNovoValor("");
  }

  function salvarNovaCotacao() {
    if (!activeItemId || !novoValor.trim()) return;
    const list = cotacoes[activeItemId] || [];
    onCotacoes({
      ...cotacoes,
      [activeItemId]: [...list, {
        id: "q_" + Math.random().toString(36).slice(2, 8),
        fonte: novaFonte?.trim() || FONTES_COTACAO[0], empresa: novaEmpresa.trim(), valor: novoValor.trim(),
      }],
    });
    setNovaFonte(FONTES_COTACAO[0]);
    setNovaEmpresa("");
    setNovoValor("");
  }
  function removeQuote(itemId, qid) {
    onCotacoes({ ...cotacoes, [itemId]: (cotacoes[itemId] || []).filter(q => q.id !== qid) });
  }
  function setAdotado(itemId, val) {
    onValoresAdotados({ ...valoresAdotados, [itemId]: val });
  }

  function handleExport() {
    gerarPlanilhaCotacaoFornecedor({ etp, nomeEmpresa: exportNome, cnpj: exportCnpj });
    setShowExportForm(false);
    setExportNome("");
    setExportCnpj("");
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const result = parseCotacaoFornecedorSheet(rows);
      if (result.valores.length === 0) throw new Error("Nenhum valor preenchido foi encontrado nesta planilha.");

      const next = { ...cotacoes };
      let matched = 0;
      result.valores.forEach(v => {
        let itemId = v.itemId && itens.some(it => it.id === v.itemId) ? v.itemId : null;
        if (!itemId && v.descricao) {
          const found = itens.find(it => it.descricao.trim().toLowerCase() === v.descricao.trim().toLowerCase());
          itemId = found ? found.id : null;
        }
        if (!itemId) return;
        matched++;
        const list = next[itemId] || [];
        next[itemId] = [...list, {
          id: "q_" + Math.random().toString(36).slice(2, 8),
          fonte: "Fornecedor", empresa: result.nomeEmpresa, cnpj: result.cnpj, valor: v.valor,
        }];
      });
      onCotacoes(next);
      setImportMsg(`${matched} cotação(ões) importada(s)${result.nomeEmpresa ? ` de ${result.nomeEmpresa}` : ""}.`);
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Não foi possível importar esta planilha.");
    }
    setImporting(false);
    e.target.value = "";
  }

  const itemAtivo = activeItemId ? itens.find(i => i.id === activeItemId) : null;
  const quotesAtivo = itemAtivo ? (cotacoes[itemAtivo.id] || []) : [];
  const statsAtivo = statsFor(quotesAtivo);
  const adotadoAtivo = itemAtivo ? (valoresAdotados[itemAtivo.id] || "") : "";

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>4. Levantamento de Preços</h2>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        Registre as cotações por item (Banco de Preços, Internet, fornecedores) para compor a estimativa de
        valor exigida pelo art. 23, §1º, da Lei nº 14.133/2021.
      </p>

      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg flex-wrap" style={{ background: C.paperDark }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Metodologia de cálculo:</span>
        <select value={metodologia} onChange={e => onMeta("metodologiaCalculo", e.target.value)}
          className="px-2 py-1.5 rounded border text-sm bg-white" style={{ borderColor: C.border }}>
          <option value="mediana">Mediana</option>
          <option value="media">Média aritmética simples</option>
        </select>
        <span className="text-xs" style={{ color: C.inkMuted }}>
          Uma única escolha vale para todos os itens — usada no botão "usar {labelMetodologia}" e no texto padrão do inciso VI.
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button onClick={() => setShowExportForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: C.paperDark, color: C.navy }}>
          <Download size={13} /> Exportar planilha para fornecedor
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: C.navy, color: C.paper }}>
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {importing ? "Importando..." : "Importar cotação preenchida"}
        </button>
        {importMsg && <span className="text-xs" style={{ color: C.green }}>{importMsg}</span>}
      </div>
      {importError && (
        <p className="text-xs mb-3 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {importError}</p>
      )}

      {showExportForm && (
        <div className="flex items-end gap-2 mb-5 p-3 rounded-lg flex-wrap" style={{ background: C.paperDark }}>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Nome da empresa</span>
            <input value={exportNome} onChange={e => setExportNome(e.target.value)} placeholder="Ex.: Fornecedor XYZ Ltda"
              className="mt-1 px-2 py-1.5 rounded border text-sm bg-white" style={{ borderColor: C.border, width: "220px" }} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>CNPJ</span>
            <input value={exportCnpj} onChange={e => setExportCnpj(e.target.value)} placeholder="00.000.000/0000-00"
              className="mt-1 px-2 py-1.5 rounded border text-sm bg-white" style={{ borderColor: C.border, width: "160px" }} />
          </label>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: C.brass, color: C.navyDark }}>
            <Download size={13} /> Gerar planilha
          </button>
          <span className="text-xs w-full" style={{ color: C.inkMuted }}>
            Gera um .xlsx com a lista de itens e a coluna "Valor Unitário" em branco, pronta para enviar ao fornecedor.
          </span>
        </div>
      )}

      {itens.length === 0 ? (
        <p className="text-sm" style={{ color: C.inkMuted }}>Cadastre itens na etapa "1. Planilha de Itens" primeiro.</p>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.paperDark }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-20" style={{ color: C.inkMuted }}>Qtd.</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-52" style={{ color: C.inkMuted }}>Cotações</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-32" style={{ color: C.inkMuted }}>Valor Adotado (R$)</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Total do Item</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const quotes = cotacoes[it.id] || [];
                  const s = statsFor(quotes);
                  const adotado = valoresAdotados[it.id] || "";
                  const temForaDoPadrao = quotes.some(q => forDoPadrao(q.valor, s.mediana));
                  return (
                    <tr key={it.id} className="border-t align-top" style={{ borderColor: C.border }}>
                      <td className="px-3 py-2">
                        <p className="text-sm" style={{ color: C.navy }}>{it.descricao || `Item ${idx + 1}`}</p>
                        {it.classificacao && <p className="text-[10px]" style={{ color: C.inkMuted }}>{it.classificacao}</p>}
                      </td>
                      <td className="px-2 py-2 text-xs" style={{ color: C.inkMuted }}>{it.quantidade || "?"} {it.unidade}</td>
                      <td className="px-2 py-2 text-xs" style={{ color: C.inkMuted }}>
                        <button onClick={() => abrirPopup(it.id)}
                          className="text-left px-2 py-1.5 rounded-md border w-full" style={{ borderColor: C.border }}>
                          {s.n > 0 ? (
                            <>
                              {s.n} cotação(ões) · {labelMetodologia === "média" ? "Média" : "Mediana"} <b style={{ color: C.navy }}>{brl(valorMetodologia(s))}</b>
                              {temForaDoPadrao && (
                                <span className="flex items-center gap-1 mt-0.5" style={{ color: C.red }}>
                                  <AlertCircle size={11} /> valor fora do padrão
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: C.brass }}>+ adicionar cotação</span>
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: C.border }}>
                          <span className="px-1.5 py-1.5 text-xs font-semibold shrink-0"
                            style={{ background: C.paperDark, color: C.inkMuted }}>R$</span>
                          <input value={adotado} onChange={e => setAdotado(it.id, e.target.value)}
                            placeholder="0,0000" className="w-full px-2 py-1.5 text-sm"
                            style={{ border: "none", outline: "none" }}
                            title="Aceita 1.234,56 · 1234,56 · 1234.56 · com ou sem R$" />
                        </div>
                        {s.n > 0 && (
                          <button onClick={() => setAdotado(it.id, formatarParaCampo(valorMetodologia(s)))}
                            className="text-[10px] mt-1" style={{ color: C.brass }}>usar {labelMetodologia}</button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs font-medium" style={{ color: C.navy }}>
                        {adotado ? brl(num(it.quantidade) * num(adotado)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 rounded-lg flex items-center justify-between" style={{ background: C.navy }}>
            <span className="text-sm" style={{ color: C.paper }}>Valor total estimado da contratação</span>
            <span className="serif text-lg font-bold" style={{ color: C.brassLight }}>{brl(totalGeral)}</span>
          </div>
        </>
      )}

      {itemAtivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.55)" }}
          onClick={() => setActiveItemId(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl" style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-lg font-semibold" style={{ color: C.navy }}>Cotações do item</h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  {itemAtivo.descricao} · {itemAtivo.quantidade || "?"} {itemAtivo.unidade}
                </p>
              </div>
              <button onClick={() => setActiveItemId(null)} className="shrink-0" style={{ color: C.inkMuted }}><X size={18} /></button>
            </div>

            <div className="p-5">
              {statsAtivo.n > 0 && (
                <div className="flex items-center gap-4 text-xs mb-4 p-3 rounded-lg flex-wrap" style={{ background: C.paperDark, color: C.inkMuted }}>
                  <span className="font-semibold" style={{ color: C.navy }}>{statsAtivo.n} cotação(ões) registrada(s)</span>
                  <span>Média: <b style={{ color: C.navy }}>{brl(statsAtivo.media)}</b></span>
                  <span>Mediana: <b style={{ color: C.navy }}>{brl(statsAtivo.mediana)}</b></span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase" style={{ background: "rgba(166,131,46,0.15)", color: C.brass }}>
                    metodologia: {labelMetodologia}
                  </span>
                </div>
              )}

              <div className="mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Cotações registradas</span>
              </div>
              {quotesAtivo.length === 0 ? (
                <p className="text-sm mb-4" style={{ color: C.inkMuted }}>Nenhuma cotação registrada ainda — adicione a primeira abaixo.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {quotesAtivo.map(q => {
                    const flagged = forDoPadrao(q.valor, statsAtivo.mediana);
                    return (
                      <div key={q.id} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: flagged ? C.red : C.border, background: flagged ? "rgba(166,64,61,0.05)" : "white" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: C.navy }}>
                            {q.fonte}{q.empresa ? ` — ${q.empresa}` : ""}
                          </p>
                          {flagged && (
                            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: C.red }}>
                              <AlertCircle size={11} className="shrink-0" />
                              Fora da margem de {margem}% em torno da mediana — considere revisar ou excluir.
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-semibold shrink-0" style={{ color: C.navy }}>{brl(num(q.valor))}</span>
                        <button onClick={() => removeQuote(itemAtivo.id, q.id)} title="Remover cotação" className="shrink-0" style={{ color: C.red }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3.5 rounded-lg border-2 border-dashed mb-4" style={{ borderColor: C.border }}>
                <span className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: C.inkMuted }}>Nova cotação</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <input list="fontes-cotacao-datalist" value={novaFonte} onChange={e => setNovaFonte(e.target.value)}
                    placeholder="Fonte" className="px-2 py-2 rounded-lg border text-sm" style={{ borderColor: C.border, width: "150px" }} />
                  <input value={novaEmpresa} onChange={e => setNovaEmpresa(e.target.value)}
                    placeholder="Fornecedor (opcional)" className="px-2 py-2 rounded-lg border text-sm flex-1 min-w-[130px]" style={{ borderColor: C.border }} />
                  <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                    <span className="px-2 py-2 text-xs font-semibold shrink-0"
                      style={{ background: C.paperDark, color: C.inkMuted }}>R$</span>
                    <input value={novoValor} onChange={e => setNovoValor(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && salvarNovaCotacao()}
                      placeholder="0,0000" className="px-2 py-2 text-sm w-24"
                      style={{ border: "none", outline: "none" }}
                      title="Aceita 1.234,56 · 1234,56 · 1234.56 · com ou sem R$" />
                  </div>
                  <button onClick={salvarNovaCotacao} disabled={!novoValor.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: C.navy, color: C.paper }}>
                    <Check size={14} /> Salvar cotação
                  </button>
                </div>
              </div>
              <datalist id="fontes-cotacao-datalist">
                {fontesConhecidas.map(f => <option key={f} value={f} />)}
              </datalist>

              <div className="flex items-center gap-2 flex-wrap mb-3 p-2.5 rounded-lg text-xs" style={{ background: C.paperDark, color: C.inkMuted }}>
                <Info size={13} className="shrink-0" style={{ color: C.brass }} />
                <span>Margem de aceitação em torno da mediana:</span>
                <input type="number" min="0" value={margem}
                  onChange={e => setMargem(Math.max(0, Number(e.target.value) || 0))}
                  className="w-14 px-1.5 py-1 rounded border text-xs text-center bg-white" style={{ borderColor: C.border }} />
                <span>%. Cotações fora dessa faixa ficam sinalizadas — a exclusão é sempre uma escolha sua.</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t flex-wrap" style={{ borderColor: C.border }}>
                <span className="text-xs font-medium" style={{ color: C.inkMuted }}>Valor unitário adotado:</span>
                <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: C.border }}>
                  <span className="px-2 py-1.5 text-xs font-semibold shrink-0"
                    style={{ background: C.paperDark, color: C.inkMuted }}>R$</span>
                  <input value={adotadoAtivo} onChange={e => setAdotado(itemAtivo.id, e.target.value)}
                    placeholder="0,0000" className="w-28 px-2 py-1.5 text-sm"
                    style={{ border: "none", outline: "none" }}
                    title="Aceita 1.234,56 · 1234,56 · 1234.56 · com ou sem R$" />
                </div>
                {statsAtivo.n > 0 && (
                  <button onClick={() => setAdotado(itemAtivo.id, formatarParaCampo(valorMetodologia(statsAtivo)))}
                    className="text-xs font-medium" style={{ color: C.brass }}>usar {labelMetodologia}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Preview View ----------
function PreviewView({ etp, secretarias, onBack }) {
  const [copied, setCopied] = useState(false);
  const [timbreGlobal, setTimbre] = useState(null);
  const [timbreLoading, setTimbreLoading] = useState(true);
  const [timbreError, setTimbreError] = useState("");
  const timbreFileRef = useRef(null);
  // O timbre da secretaria do ETP tem prioridade; o gerenciado nesta tela é o timbre geral
  const secretariaDoEtp = secretariaDoDoc(etp, secretarias);
  const cabecalho = resolverCabecalho(etp, secretarias, timbreGlobal);
  const timbre = cabecalho.tipo === "imagem" ? cabecalho.dataUrl : null;

  useEffect(() => {
    // Se nenhum timbre foi salvo ainda, carrega o padrão do app (asset) e já o grava para as próximas vezes
    obterTimbreGlobal({ persistirPadrao: true })
      .then(setTimbre)
      .catch(() => {})
      .finally(() => setTimbreLoading(false));
  }, []);

  async function handleTimbreUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTimbreLoading(true);
    setTimbreError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const resized = await redimensionarImagem(dataUrl, 900);
      await storage.set("timbre:padrao", resized, false);
      setTimbre(resized);
    } catch (err) {
      console.error(err);
      setTimbreError("Não foi possível salvar o timbre.");
    }
    setTimbreLoading(false);
    e.target.value = "";
  }

  async function handleTimbreRemove() {
    try {
      await storage.delete("timbre:padrao", false);
    } catch (err) { /* já não existe */ }
    setTimbre(null);
  }

  function fullText() {
    let t = `ESTUDO TÉCNICO PRELIMINAR (ETP)\n`;
    t += `Fundamento: art. 18 da Lei nº 14.133/2021\n\n`;
    t += `Objeto: ${objetoCompleto(etp) || "-"}\n`;
    t += `Órgão/Secretaria: ${etp.meta.orgao || "-"}\n`;
    t += `Setor requisitante: ${etp.meta.setor || "-"}\n`;
    const responsaveis = listaResponsaveis(etp);
    t += `Responsável técnico: ${responsaveis.length > 0 ? responsaveis.map(r => r.nome + (r.cargo ? ` (${r.cargo})` : "")).join("; ") : "-"}\n`;
    t += `Processo nº: ${etp.meta.processo || "-"}\n`;
    t += `Tipo de objeto: ${etp.meta.tipo}\n\n`;
    if (etp.meta.introducao?.trim()) t += `INTRODUÇÃO\n${etp.meta.introducao.trim()}\n\n`;
    secoesParaRelatorio(etp).forEach(s => {
      const conteudo = (etp.sections[s.id] || "").replace(/<li[^>]*>/g, "\n• ").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
      t += `${s.numero} — ${s.titulo.toUpperCase()}\n${conteudo}\n`;
      if (s.id === "II" && etp.pca && etp.itens?.length > 0) {
        t += `\nQuadro de alinhamento ao PCA:\n`;
        etp.itens.forEach(it => {
          const m = cruzarComPca([it], etp.pca, etp.manuaisPca)[0];
          t += `• ${it.descricao || "-"} — ${m.previsto ? `consta (seq. ${m.sequencial || "-"})` : "não consta"}\n`;
        });
      }
      if (s.id === "V" && etp.itens?.length > 0) {
        t += `\nQuadro de quantitativos:\n`;
        etp.itens.forEach(it => {
          t += `• ${it.descricao || "-"} — ${it.unidade || ""} — qtd. ${it.quantidade || "-"}\n`;
        });
      }
      if (s.id === "VI") {
        const valoresAdotados = etp.valoresAdotados || {};
        const cotacoes = etp.cotacoes || {};
        const temAlgumDado = etp.itens.some(it => (cotacoes[it.id] || []).length > 0 || valoresAdotados[it.id]);
        if (temAlgumDado) {
          const usaMedia = etp.meta.metodologiaCalculo === "media";
          const metodologia = usaMedia ? "média aritmética simples" : "mediana";
          const labelReferencia = usaMedia ? "Média" : "Mediana";
          t += `\nQuadro comprobatório da estimativa de valor (metodologia adotada: ${metodologia}):\n`;
          let totalGeral = 0;
          etp.itens.forEach(it => {
            const quotes = cotacoes[it.id] || [];
            const stats = statsFor(quotes);
            const valorReferencia = usaMedia ? stats.media : stats.mediana;
            const totalItem = stats.n > 0 ? num(it.quantidade) * valorReferencia : 0;
            if (stats.n > 0) totalGeral += totalItem;
            t += `\n${it.descricao || "-"} (qtd. ${it.quantidade || "-"} ${it.unidade || ""})\n`;
            if (quotes.length > 0) {
              quotes.forEach(q => {
                t += `  • ${q.fonte || "-"}${q.empresa ? ` (${q.empresa})` : ""}: ${brl(num(q.valor))}\n`;
              });
              t += `  ${labelReferencia}: ${brl(valorReferencia)} · Total do item: ${brl(totalItem)}\n`;
            }
          });
          t += `\nValor total estimado da contratação: ${brl(totalGeral)}\n`;
        }
      }
      t += `\n`;
    });
    t += `${linhaAssinaturaData(etp)}\n`;
    const responsaveisAssinatura = listaResponsaveis(etp);
    if (responsaveisAssinatura.length > 0) {
      responsaveisAssinatura.forEach(r => {
        t += `\n_______________________________________\n${r.nome}\n${r.cargo || ""}\n`;
      });
    }
    return t;
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(fullText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { console.error(e); }
  }

  return (
    <div>
      <header className="no-print flex items-center justify-between px-6 py-3 border-b sticky top-0 z-10"
        style={{ background: C.navy, borderColor: C.navyDark }}>
        <button onClick={onBack} className="flex items-center gap-2 text-sm p-1.5 rounded-md hover:bg-white/10" style={{ color: C.paper }}>
          <ArrowLeft size={18} /> Voltar à edição
        </button>
        <div className="flex items-center gap-2">
          <button onClick={copyText} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.paperDark, color: C.navy }}>
            <Copy size={13} /> {copied ? "Copiado!" : "Copiar texto"}
          </button>
          <button onClick={() => gerarDocumentoWord(etp, cabecalho).catch(e => console.error(e))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.paperDark, color: C.navy }}>
            <Download size={13} /> Baixar Word (.doc)
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.brass, color: C.navyDark }}>
            <Printer size={13} /> Imprimir / Salvar PDF
          </button>
        </div>
      </header>

      <div className="no-print max-w-3xl mx-auto pt-6 px-4">
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg" style={{ background: "white", border: `1px solid ${C.border}` }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Timbre da Secretaria:</span>
          {timbreLoading ? (
            <span className="text-xs" style={{ color: C.inkMuted }}>Carregando...</span>
          ) : timbre ? (
            <>
              <img src={timbre} alt="Timbre" style={{ maxHeight: "36px" }} />
              <button onClick={() => timbreFileRef.current?.click()}
                className="text-xs font-medium" style={{ color: C.navy }}>Trocar</button>
              <button onClick={handleTimbreRemove}
                className="text-xs font-medium" style={{ color: C.red }}>Remover</button>
            </>
          ) : (
            <button onClick={() => timbreFileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
              style={{ background: C.navy, color: C.paper }}>
              <Upload size={13} /> Enviar timbre (imagem)
            </button>
          )}
          <input ref={timbreFileRef} type="file" accept="image/*" onChange={handleTimbreUpload} className="hidden" />
          {timbreError && <span className="text-xs" style={{ color: C.red }}>{timbreError}</span>}
          <span className="text-xs w-full" style={{ color: C.inkMuted }}>
            Enviado uma vez, fica salvo e aparece automaticamente em todos os seus ETPs — na pré-visualização, no
            PDF impresso e no arquivo Word exportado.
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 px-4">
        <div className="print-area bg-white shadow-sm rounded-lg p-10" style={{ border: `1px solid ${C.border}` }}>
          {timbre && (
            <div className="timbre-fixed-print">
              <img src={timbre} alt="Timbre da Secretaria" style={{ maxHeight: "90px", maxWidth: "90%" }} />
            </div>
          )}
          {timbre && (
            <div className="mb-6 flex justify-center timbre-inline-print">
              <img src={timbre} alt="Timbre da Secretaria" style={{ maxHeight: "110px", maxWidth: "100%" }} />
            </div>
          )}
          <div className="text-center mb-8 pb-6 border-b" style={{ borderColor: C.border }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.brass }}>Lei nº 14.133/2021 · art. 18</p>
            <h1 className="serif text-2xl font-bold" style={{ color: C.navy }}>Estudo Técnico Preliminar</h1>
            <p className="serif text-lg mt-1" style={{ color: C.ink }}>{objetoCompleto(etp) || "(objeto não informado)"}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-8">
            <p><b style={{ color: C.inkMuted }}>Órgão:</b> {etp.meta.orgao || "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Setor:</b> {etp.meta.setor || "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Responsável:</b> {listaResponsaveis(etp).length > 0 ? listaResponsaveis(etp).map(r => r.nome + (r.cargo ? ` — ${r.cargo}` : "")).join("; ") : "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Processo:</b> {etp.meta.processo || "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Tipo:</b> {etp.meta.tipo}</p>
            <p><b style={{ color: C.inkMuted }}>Data:</b> {fmtDateISO(etp.meta.data) || fmtDate(etp.updatedAt)}</p>
          </div>

          {etp.meta.introducao?.trim() && (
            <div className="mb-6">
              <h3 className="serif text-base font-bold mb-1.5 text-center" style={{ color: C.navy }}>Introdução</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-justify">{etp.meta.introducao}</p>
            </div>
          )}

          {secoesParaRelatorio(etp).map(s => (
            <div key={s.id} className="mb-6">
              <h3 className="serif text-base font-bold mb-1.5 text-center titulo-inciso" style={{ color: C.navy }}>
                {s.numero} — {s.titulo}
              </h3>
              <div className="text-sm leading-relaxed rich-content text-justify" style={{ color: C.ink }}
                dangerouslySetInnerHTML={{ __html: etp.sections[s.id] }} />
              {s.id === "II" && etp.pca && etp.itens?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.inkMuted }}>
                    Quadro de alinhamento ao PCA
                  </p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: C.paperDark }}>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Item</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Descrição</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Consta no PCA?</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Sequencial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cruzarComPca(etp.itens, etp.pca, etp.manuaisPca).map((m, idx) => (
                        <tr key={m.item.id}>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{idx + 1}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{m.item.descricao || `Item ${idx + 1}`}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border, color: m.previsto ? C.green : C.red }}>{m.previsto ? "Sim" : "Não"}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{m.sequencial || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] mt-1" style={{ color: C.inkMuted }}>
                    Fonte: planilha "{etp.pca.nomeArquivo}", importada em {fmtDate(etp.pca.importedAt)}.
                  </p>
                </div>
              )}
              {s.id === "V" && etp.itens?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.inkMuted }}>
                    Quadro de quantitativos
                  </p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: C.paperDark }}>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Item</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Descrição</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Und.</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Qtd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etp.itens.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{idx + 1}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{it.descricao || "-"}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{it.unidade}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{it.quantidade || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {s.id === "VI" && gerarRelatorioEstimativaHtml(etp) && (
                <div className="mt-3 rich-content text-sm" style={{ color: C.ink }}
                  dangerouslySetInnerHTML={{ __html: gerarRelatorioEstimativaHtml(etp) }} />
              )}
            </div>
          ))}

          <div className="mt-12 text-sm text-center" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            <p>{linhaAssinaturaData(etp)}</p>
            {listaResponsaveis(etp).length > 0 ? (
              listaResponsaveis(etp).map(r => (
                <div key={r.id} className="mt-10">
                  <p>_______________________________________</p>
                  <p className="mt-1 font-semibold">{r.nome}</p>
                  {r.cargo && <p>{r.cargo}</p>}
                </div>
              ))
            ) : (
              <div className="mt-10">
                <p>_______________________________________</p>
                <p className="mt-1 font-semibold">[Responsável técnico]</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
