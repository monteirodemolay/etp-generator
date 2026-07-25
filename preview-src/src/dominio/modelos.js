/**
 * Como nasce cada documento e como se lê seu estado.
 */

import { todayISO } from "./datas.js";

import { TIPOS_OBJETO } from "./opcoes.js";

import { SECOES, REQUIRED_IDS } from "../conteudo/incisos.js";


export function emptyEtp() {
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

// Justificativa de Aquisição — documento próprio, salvo em lista (chave "just:<id>"), como os ETPs
export function emptyJustificativa() {
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
// Guarda só os itens e o preenchimento manual; a planilha do PCA fica numa chave
// própria da entidade ("pca:<entidadeId>"), porque cada entidade tem seu PCA —
// o da FMAS não é o mesmo da SEMAS. Ver dominio/entidades.js: chavePcaEntidade().
export function emptyDeclaracao() {
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

// Título curto para exibir na lista de documentos avulsos
export function tituloDocumento(doc) {
  const obj = (doc.campos?.objeto ?? doc.objeto ?? "").trim();
  return obj || "Sem objeto definido";
}

// Duplica qualquer documento (ETP, justificativa ou declaração): copia tudo, gera id novo,
// zera as datas e acrescenta "(cópia)" ao título, para não confundir com o original.
export function duplicarDocumento(doc, prefixoId) {
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

export function progress(etp) {
  const filled = SECOES.filter(s => etp.sections[s.id]?.trim().length > 0).length;
  const reqFilled = REQUIRED_IDS.filter(id => etp.sections[id]?.trim().length > 0).length;
  return { filled, total: SECOES.length, reqFilled, reqTotal: REQUIRED_IDS.length,
    pct: Math.round((filled / SECOES.length) * 100) };
}

// Situação de um ETP, derivada do preenchimento. São os três únicos estados
// que o sistema consegue afirmar a partir dos dados — não há "em revisão" nem
// "aprovado" porque nada no app registra essas transições.
//
// Devolve apenas a situação; a cor de cada uma é escolha da interface.
export function situacaoEtp(etp) {
  const p = progress(etp);
  if (p.filled === 0) return { chave: "rascunho", rotulo: "Rascunho" };
  if (p.reqFilled === p.reqTotal) return { chave: "concluido", rotulo: "Concluído" };
  return { chave: "elaboracao", rotulo: "Em elaboração" };
}
