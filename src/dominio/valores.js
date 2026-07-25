/**
 * Leitura e formatação de valores monetários.
 *
 * A leitura precisa aceitar qualquer formato que um servidor possa colar de
 * uma planilha, de um sistema ou de um e-mail. A formatação mantém até quatro
 * casas decimais, porque preços unitários de licitação frequentemente as usam.
 */

// Lê um valor monetário digitado ou colado em qualquer formato usual:
// "1.234,56"  "1234,56"  "1234.56"  "R$ 2.350,90"  "1,234.56"  "10.000"  "0,4567"
// Regra: quando há vírgula e ponto, o último separador é o decimal. Quando há só ponto,
// um grupo final de exatamente 3 dígitos é separador de milhar (convenção brasileira).
export function num(v) {
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
export function brl(n) {
  const v = Number(n) || 0;
  const decimais = (v.toFixed(6).split(".")[1] || "").replace(/0+$/, "").length;
  const casas = Math.min(4, Math.max(2, decimais));
  return v.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  });
}

// Valor formatado para voltar a um campo de digitação (sem o símbolo, vírgula decimal)
export function formatarParaCampo(v) {
  const n = Number(v) || 0;
  const decimais = (n.toFixed(6).split(".")[1] || "").replace(/0+$/, "").length;
  const casas = Math.min(4, Math.max(2, decimais));
  return n.toFixed(casas).replace(".", ",");
}

// Estatísticas de uma lista de cotações (art. 23, §1º, II da Lei 14.133/2021)
export function statsFor(quotes) {
  const vals = (quotes || []).map(q => num(q.valor)).filter(v => v > 0).sort((a, b) => a - b);
  if (vals.length === 0) return { media: 0, mediana: 0, min: 0, max: 0, n: 0 };
  const media = vals.reduce((a, b) => a + b, 0) / vals.length;
  const mid = Math.floor(vals.length / 2);
  const mediana = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  return { media, mediana, min: vals[0], max: vals[vals.length - 1], n: vals.length };
}

// Valor total estimado de um ETP — usa a média/mediana das cotações (mesma lógica do quadro
// comprobatório do inciso VI); se não houver cotações, cai no valor adotado manualmente.
export function valorTotalEtp(etp) {
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
