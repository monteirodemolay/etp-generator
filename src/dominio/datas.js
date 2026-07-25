/**
 * Datas — sempre no padrão brasileiro.
 */

export const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Data relativa curta ("hoje", "há 3 dias") para o painel — cai para a data cheia quando é antigo
export function fmtDateRelativa(ts) {
  const dias = Math.floor((Date.now() - ts) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return fmtDate(ts);
}

// Converte uma data ISO (yyyy-mm-dd) para o formato dd/mm/aaaa
export function fmtDateISO(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Converte uma data ISO (yyyy-mm-dd) para "dia de mês de ano" (ex.: 15 de julho de 2026)
export function fmtDateExtenso(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES_PT[m - 1]} de ${y}`;
}

// Data de hoje no formato ISO (yyyy-mm-dd), para preencher <input type="date">
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
