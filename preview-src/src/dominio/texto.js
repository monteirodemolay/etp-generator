/**
 * Tratamento de texto e HTML.
 *
 * O conteúdo dos incisos é HTML, produzido pelo editor com formatação. Estas
 * funções fazem a ponte entre texto simples e HTML nos dois sentidos.
 */

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Converte o texto simples devolvido pelos modelos padrão (parágrafos separados por linha em
// branco, marcadores com "•") em HTML compatível com o editor formatado. Se o texto já vier em
// HTML (como os modelos que já geram <p>/<ul> diretamente), devolve sem alterações.
export function textoParaHtml(texto) {
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

