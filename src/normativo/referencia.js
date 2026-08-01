/**
 * Referência normativa — o contrato entre o Hub Compras Públicas e o Core Normativo.
 *
 * Este é o único ponto de acoplamento entre os dois projetos. Enquanto o formato
 * aqui definido não mudar, cada lado evolui livremente.
 *
 * Formato canônico (texto, escrito à mão nos mapeamentos):
 *
 *   norma[:artigo][§paragrafo][.inciso][.alinea]
 *
 * Exemplos:
 *   "lei-14133-2021"              → a lei inteira
 *   "lei-14133-2021:18"           → art. 18
 *   "lei-14133-2021:18§1"         → art. 18, § 1º
 *   "lei-14133-2021:18§1.IV"      → art. 18, § 1º, inciso IV
 *   "lei-14133-2021:12.VII"       → art. 12, inciso VII (sem parágrafo)
 *   "lei-14133-2021:23§1.a"       → art. 23, § 1º, alínea "a"
 *   "acordao-1234-2023-tcu"       → acórdão do TCU
 *
 * O identificador da norma segue o mesmo padrão gerado pelo SlugService do
 * Core Normativo: tipo-numero-ano, em minúsculas e sem acentos.
 */

const ROMANOS_VALIDOS = /^[IVXLCDM]+$/;

// O identificador da norma segue o padrão de slug do Core Normativo:
// minúsculas, dígitos e hífens. Exigir o formato faz erros de digitação
// nos mapeamentos aparecerem, em vez de passarem em silêncio.
const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Decompõe uma referência canônica em suas partes.
 * Devolve null quando o texto não é uma referência válida — nunca lança erro,
 * para que um mapeamento com erro de digitação não derrube a tela.
 */
export function analisarReferencia(ref) {
  const texto = String(ref || "").trim();
  if (!texto) return null;

  const [norma, resto] = texto.split(":");
  if (!norma || !SLUG_VALIDO.test(norma)) return null;
  if (!resto) return { norma, artigo: null, paragrafo: null, inciso: null, alinea: null };

  // artigo e parágrafo: "18§1" ou só "18"
  const [parteArtigo, ...partesDivisao] = resto.split(".");
  const casaParagrafo = parteArtigo.match(/^(\d+[A-Z-]*)(?:§(\d+|caput|unico|único))?$/i);
  if (!casaParagrafo) return null;

  const artigo = casaParagrafo[1];
  const paragrafo = casaParagrafo[2] || null;

  // depois do ponto vem inciso e, opcionalmente, alínea
  let inciso = null;
  let alinea = null;
  for (const parte of partesDivisao) {
    if (ROMANOS_VALIDOS.test(parte.toUpperCase()) && !inciso) inciso = parte.toUpperCase();
    else if (/^[a-z]$/i.test(parte)) alinea = parte.toLowerCase();
  }

  return { norma, artigo, paragrafo, inciso, alinea };
}

/**
 * Escreve a referência por extenso, como se cita num documento oficial.
 * Recebe também o título da norma, quando conhecido — do contrário usa o
 * identificador, para que a citação nunca fique vazia.
 *
 *   citarPorExtenso("lei-14133-2021:18§1.IV", "Lei nº 14.133/2021")
 *   → "Lei nº 14.133/2021, art. 18, § 1º, inciso IV"
 */
export function citarPorExtenso(ref, tituloNorma) {
  const p = analisarReferencia(ref);
  if (!p) return String(ref || "");

  const partes = [tituloNorma || p.norma];
  if (p.artigo) partes.push(`art. ${p.artigo}`);
  if (p.paragrafo) {
    const ehUnico = /^(unico|único)$/i.test(p.paragrafo);
    partes.push(ehUnico ? "parágrafo único" : `§ ${p.paragrafo}º`);
  }
  if (p.inciso) partes.push(`inciso ${p.inciso}`);
  if (p.alinea) partes.push(`alínea "${p.alinea}"`);
  return partes.join(", ");
}

/** Só o identificador da norma, para buscar o documento no Core Normativo. */
export function normaDe(ref) {
  return analisarReferencia(ref)?.norma || null;
}

/** Verifica se um texto é uma referência bem formada. */
export function referenciaValida(ref) {
  return analisarReferencia(ref) !== null;
}
