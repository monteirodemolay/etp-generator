/**
 * Relatório de Ordens de Fornecimento — sintético (números agregados) e
 * analítico (listagem linha a linha), com filtros combináveis, nenhum
 * obrigatório: sem filtro nenhum, o relatório cobre tudo.
 */

import { calcularSituacao, grupoDaSituacao, GRUPOS_SITUACAO_OF } from "./of.js";

// ---------- Filtragem ----------
// filtros: { ano, secretariaId, municipioId, cnpj, grupoSituacao }
// Qualquer campo ausente/vazio simplesmente não filtra por aquele critério.
export function filtrarOfsParaRelatorio(ofs, filtros = {}) {
  const { ano, secretariaId, municipioId, cnpj, grupoSituacao, reparticaoId } = filtros;
  return (ofs || []).filter(of_ => {
    if (ano && new Date(of_.createdAt || 0).getFullYear() !== Number(ano)) return false;
    if (secretariaId && of_.secretariaId !== secretariaId) return false;
    if (municipioId && of_.municipioId !== municipioId) return false;
    if (cnpj && of_.cnpj !== cnpj) return false;
    if (reparticaoId && of_.reparticaoId !== reparticaoId) return false;
    if (grupoSituacao && grupoDaSituacao(calcularSituacao(of_).chave) !== grupoSituacao) return false;
    return true;
  });
}

// Anos distintos presentes na base — para popular o filtro de ano sem
// depender de uma lista fixa.
export function anosDisponiveis(ofs) {
  const anos = new Set((ofs || []).map(o => new Date(o.createdAt || 0).getFullYear()));
  return [...anos].sort((a, b) => b - a);
}

// ---------- Relatório sintético ----------
// Números agregados: total, por status, por mês, e os dois indicadores de
// desempenho mais úteis para acompanhar a saúde do processo.
export function montarSintese(ofsFiltradas) {
  const porGrupo = {};
  for (const g of GRUPOS_SITUACAO_OF) if (g.id !== "todas") porGrupo[g.id] = 0;

  const porMes = {}; // "aaaa-mm" -> contagem
  let somaDiasConfirmacao = 0, qtdConfirmadas = 0;
  let somaDiasEntrega = 0, qtdEntregues = 0;
  let entreguesNoPrazo = 0, entreguesForaDoPrazo = 0;

  for (const of_ of ofsFiltradas) {
    const situacao = calcularSituacao(of_);
    const grupo = grupoDaSituacao(situacao.chave);
    porGrupo[grupo] = (porGrupo[grupo] || 0) + 1;

    const data = new Date(of_.createdAt || 0);
    const chaveMes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    porMes[chaveMes] = (porMes[chaveMes] || 0) + 1;

    if (of_.dataEnvioTimestamp && of_.status !== "Rascunho") {
      // dataAceite existe só depois de confirmado; se existir, mede o intervalo
      if (of_.reciboImutavel?.dataConfirmacao) {
        qtdConfirmadas++;
        // Aproximação: usamos updatedAt como proxy de quando confirmou, já
        // que dataAceite é string formatada, não epoch — suficiente para
        // uma média de dias, sem exigir mudança no modelo hoje.
        const dias = Math.max(0, Math.round((of_.updatedAt - of_.dataEnvioTimestamp) / 86400000));
        somaDiasConfirmacao += dias;
      }
    }

    if (of_.confirmacaoEntrega?.dataEntregaReal) {
      qtdEntregues++;
      if (of_.confirmacaoEntrega.situacao === "no-prazo") entreguesNoPrazo++;
      if (of_.confirmacaoEntrega.situacao === "fora-do-prazo") entreguesForaDoPrazo++;
    }
  }

  return {
    total: ofsFiltradas.length,
    porGrupo,
    porMes: Object.entries(porMes).sort(([a], [b]) => a.localeCompare(b)).map(([mes, qtd]) => ({ mes, qtd })),
    tempoMedioConfirmacaoDias: qtdConfirmadas > 0 ? Math.round((somaDiasConfirmacao / qtdConfirmadas) * 10) / 10 : null,
    percentualNoPrazo: (entreguesNoPrazo + entreguesForaDoPrazo) > 0
      ? Math.round((entreguesNoPrazo / (entreguesNoPrazo + entreguesForaDoPrazo)) * 100)
      : null,
    entreguesNoPrazo,
    entreguesForaDoPrazo,
  };
}

// ---------- Relatório analítico ----------
// Uma linha por OF, já com a situação calculada e os dados mais relevantes
// para auditoria — pronto para tabela ou impressão.
export function montarAnalitico(ofsFiltradas) {
  return ofsFiltradas
    .map(of_ => ({ of: of_, situacao: calcularSituacao(of_) }))
    .sort((a, b) => (b.of.createdAt || 0) - (a.of.createdAt || 0));
}
