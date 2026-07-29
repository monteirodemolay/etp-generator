/**
 * Repartição: o nível abaixo de Entidade, opcional.
 *
 * Uma Entidade (ex.: Fundo Municipal de Assistência Social) pode ter
 * setores internos que emitem e controlam suas próprias Ordens de
 * Fornecimento — ex.: "Setor de Compras", "Almoxarifado", "Área Técnica",
 * "TI". Isto NÃO é obrigatório: uma entidade sem nenhuma repartição
 * cadastrada continua funcionando exatamente como hoje, sem esse nível.
 *
 * Repartição só existe no contexto de Ordem de Fornecimento por enquanto —
 * não se aplica a ETP, Justificativa ou Declaração.
 */

export function emptyReparticao(nome, entidadeId) {
  return {
    id: "rep_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    nome: nome || "",
    entidadeId: entidadeId || null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// As repartições de uma entidade específica, em ordem alfabética.
export function reparticoesDaEntidade(entidadeId, reparticoes) {
  return (reparticoes || [])
    .filter(r => r.entidadeId === entidadeId)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
}

// Quantas OFs pertencem a esta repartição — usado para avisar antes de
// excluir, no mesmo espírito de contarDocumentosDaEntidade.
export function contarOfsDaReparticao(reparticaoId, ofs) {
  return (ofs || []).filter(o => o.reparticaoId === reparticaoId).length;
}
