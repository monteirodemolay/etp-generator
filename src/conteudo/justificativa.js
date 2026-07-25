/**
 * Texto-modelo da Justificativa de Aquisição.
 *
 * Documento anterior à contratação: por isso não pede empresa, CNPJ nem número
 * de pregão — nada disso existe ainda nesta etapa do processo.
 */

import { escapeHtml } from "../dominio/texto.js";

// ---------- Justificativa de Aquisição (ferramenta avulsa) ----------
// Gera o texto padrão (HTML), no mesmo espírito dos "Usar modelo padrão (sem IA)" dos incisos do
// ETP — genérico, sem inventar dado que o servidor não informou, com lacuna em colchetes quando falta.
export function gerarTextoPadraoJustificativa(dados) {
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
