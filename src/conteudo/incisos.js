/**
 * Os treze elementos do Estudo Técnico Preliminar.
 *
 * A ordem e a redação seguem a Lei nº 14.133/2021, art. 18, § 1º.
 * Este arquivo é a fonte da verdade sobre a numeração — nenhum outro ponto do
 * sistema deve presumir qual assunto corresponde a qual algarismo romano.
 *
 * ATENÇÃO — correção aplicada em 24/07/2026:
 * Até a versão anterior, os incisos IV e V estavam invertidos: o sistema
 * tratava "Levantamento de Mercado" como IV e "Estimativa das Quantidades"
 * como V. A lei estabelece o contrário. Como o § 2º torna o inciso IV
 * obrigatório, a inversão fazia o sistema exigir o levantamento de mercado
 * (que a lei não exige) e dispensar as estimativas de quantidades (que a lei
 * exige). Ver src/migracoes/001-corrige-incisos-iv-v.js.
 */

// Note que não há campo "obrigatório" aqui: a obrigatoriedade é definida pelo
// § 2º e vive apenas em REQUIRED_IDS, logo abaixo. Manter os dois seria repetir
// a mesma informação em dois lugares — foi assim que a inversão IV/V passou
// despercebida por tanto tempo.
export const SECOES = [
  {
    id: "I",
    titulo: "Descrição da Necessidade",
    ajuda: "Qual problema, sob a perspectiva do interesse público, esta contratação pretende resolver?",
    fundamento: ["lei-14133-2021:18§1.I"],
  },
  {
    id: "II",
    titulo: "Alinhamento ao PCA",
    ajuda: "Esta contratação está prevista no Plano de Contratações Anual? Indique item/posição, se houver.",
    fundamento: ["lei-14133-2021:18§1.II", "lei-14133-2021:12.VII"],
  },
  {
    id: "III",
    titulo: "Requisitos da Contratação",
    ajuda: "Requisitos técnicos, de sustentabilidade, prazos, garantias e demais condições necessárias.",
    fundamento: ["lei-14133-2021:18§1.III"],
  },
  {
    id: "IV",
    titulo: "Estimativas das Quantidades",
    ajuda: "Quantidades estimadas, com memórias de cálculo e documentos de suporte, considerando interdependências com outras contratações para possibilitar economia de escala.",
    fundamento: ["lei-14133-2021:18§1.IV"],
  },
  {
    id: "V",
    titulo: "Levantamento de Mercado",
    ajuda: "Análise das alternativas possíveis e justificativa técnica e econômica da escolha do tipo de solução a contratar.",
    fundamento: ["lei-14133-2021:18§1.V"],
  },
  {
    id: "VI",
    titulo: "Estimativa do Valor",
    ajuda: "Valor estimado, com preços unitários referenciais, memórias de cálculo e fontes da pesquisa de preços.",
    fundamento: ["lei-14133-2021:18§1.VI", "lei-14133-2021:23"],
  },
  {
    id: "VII",
    titulo: "Descrição da Solução como um Todo",
    ajuda: "Descreva a solução de forma integral, inclusive exigências de manutenção e assistência técnica, quando for o caso.",
    fundamento: ["lei-14133-2021:18§1.VII"],
  },
  {
    id: "VIII",
    titulo: "Justificativas para o Parcelamento",
    ajuda: "Por que a contratação será (ou não) dividida em itens/lotes? Considere economia de escala e competitividade.",
    fundamento: ["lei-14133-2021:18§1.VIII", "lei-14133-2021:40§2"],
  },
  {
    id: "IX",
    titulo: "Resultados Pretendidos",
    ajuda: "Demonstrativo dos resultados em termos de economicidade e melhor aproveitamento dos recursos humanos, materiais e financeiros.",
    fundamento: ["lei-14133-2021:18§1.IX"],
  },
  {
    id: "X",
    titulo: "Providências Prévias",
    ajuda: "O que a Administração precisa adotar antes da celebração do contrato, inclusive capacitação para fiscalização e gestão contratual.",
    fundamento: ["lei-14133-2021:18§1.X"],
  },
  {
    id: "XI",
    titulo: "Contratações Correlatas e Interdependentes",
    ajuda: "Há outras contratações relacionadas ou das quais esta depende para ser executada?",
    fundamento: ["lei-14133-2021:18§1.XI"],
  },
  {
    id: "XII",
    titulo: "Possíveis Impactos Ambientais",
    ajuda: "Impactos ambientais e medidas mitigadoras, incluídos requisitos de baixo consumo de recursos e logística reversa, quando aplicável.",
    fundamento: ["lei-14133-2021:18§1.XII"],
  },
  {
    id: "XIII",
    titulo: "Posicionamento Conclusivo",
    ajuda: "A contratação é adequada para atender à necessidade a que se destina? Fundamente a conclusão.",
    fundamento: ["lei-14133-2021:18§1.XIII"],
  },
];

/**
 * Elementos que o ETP deve conter obrigatoriamente.
 *
 * Lei nº 14.133/2021, art. 18, § 2º: o estudo deverá conter ao menos os
 * elementos dos incisos I, IV, VI, VIII e XIII do § 1º; não contemplando os
 * demais, deve apresentar as devidas justificativas.
 *
 * A lista vem da lei, não do campo "obrig" de cada seção — assim uma edição
 * distraída em SECOES não altera silenciosamente o que a lei exige.
 */
export const REQUIRED_IDS = ["I", "IV", "VI", "VIII", "XIII"];

/** Fundamento da própria regra de obrigatoriedade, para citar no checklist. */
export const FUNDAMENTO_OBRIGATORIOS = "lei-14133-2021:18§2";

export const ROMANOS = [
  "I", "II", "III", "IV", "V", "VI", "VII",
  "VIII", "IX", "X", "XI", "XII", "XIII",
];

/** Seção pelo identificador, sem precisar percorrer a lista toda vez. */
const PORID = Object.fromEntries(SECOES.map(s => [s.id, s]));
export function secaoPorId(id) {
  return PORID[id] || null;
}

/** Um inciso é obrigatório? Consulta a lista da lei, não o campo da seção. */
export function ehObrigatorio(id) {
  return REQUIRED_IDS.includes(id);
}
