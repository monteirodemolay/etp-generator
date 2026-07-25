/**
 * Quadro comprobatório da estimativa de valor (inciso VI).
 *
 * Monta a tabela que demonstra, item a item, quais cotações foram coletadas e
 * como se chegou ao valor adotado. É a peça que sustenta a estimativa perante
 * o controle interno.
 */

import { escapeHtml } from "./texto.js";
import { num, brl, statsFor } from "./valores.js";

export function gerarRelatorioEstimativaHtml(etp) {
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
