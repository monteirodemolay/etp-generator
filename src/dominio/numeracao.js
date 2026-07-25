/**
 * Numeração dos incisos no documento final.
 *
 * Incisos vazios ou marcados como "não incluir" não entram no documento, e os
 * seguintes são renumerados. Por isso o número que aparece no papel nem sempre
 * é o mesmo da lei — daí a etiqueta "era IV, sairá como III" na tela de edição.
 */

import { SECOES, ROMANOS } from "../conteudo/incisos.js";

export function secoesParaRelatorio(etp) {
  const excluidos = etp.incisosExcluidos || [];
  return SECOES
    .filter(s => !excluidos.includes(s.id) && etp.sections[s.id]?.trim())
    .map((s, idx) => ({ ...s, numero: ROMANOS[idx] || String(idx + 1) }));
}

export function numeracaoFinal(etp) {
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
