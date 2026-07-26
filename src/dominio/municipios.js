/**
 * Município: o nível acima de Entidade.
 *
 * O sistema nasceu pensando numa única Prefeitura (Rio Verde), com Entidade
 * cobrindo secretarias, fundos etc. Com o sistema passando a atender mais de
 * um órgão (ex.: Câmara de Acreúna), cada Entidade passa a pertencer a um
 * Município — é por aqui que o calendário de dias úteis (feriados, pontos
 * facultativos) se separa corretamente entre eles.
 *
 * Isto NÃO é uma barreira de acesso entre municípios — quem cuida disso é o
 * papel de Usuário e as entidades atribuídas a ele (ver dominio/permissoes.js).
 * Município aqui serve só para agrupar dado que é local por natureza:
 * feriados municipais, pontos facultativos, e futuramente o que mais surgir.
 */

export function emptyMunicipio(nome, uf) {
  return {
    id: "mun_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    nome: nome || "",
    uf: uf || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// O município de uma entidade. Entidades cadastradas antes deste conceito
// existir (ou apontando para um município excluído) caem no mais antigo
// cadastrado — mesma regra já usada para entidade sem dono e documento sem
// entidade, para não deixar nada "órfão" sem explicação.
export function municipioDaEntidade(entidade, municipios) {
  if (!municipios?.length) return null;
  return municipios.find(m => m.id === entidade?.municipioId) || municipios[0];
}

// Quantas entidades pertencem a este município — usado para avisar antes de
// excluir, no mesmo espírito de contarDocumentosDaEntidade.
export function contarEntidadesDoMunicipio(municipioId, secretarias) {
  return (secretarias || []).filter(s => s.municipioId === municipioId).length;
}
