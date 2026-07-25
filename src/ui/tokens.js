/**
 * Paleta e tokens visuais.
 *
 * Um único lugar define as cores do sistema. A referência de papel envelhecido
 * e tinta ferrogálica não é enfeite: documentos de contratação pública são
 * lidos em tela por horas, e contraste alto demais cansa.
 */

// ---------- Design tokens ----------
export const C = {
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

/** Cor de cada situação de ETP. Fica aqui, não no domínio. */
export const COR_SITUACAO = {
  rascunho:   C.inkMuted,
  elaboracao: C.brass,
  concluido:  C.green,
};

/** Cor de cada nível do checklist de conformidade. */
export const COR_NIVEL = {
  impeditivo: C.red,
  atencao:    C.brass,
  ok:         C.green,
};

