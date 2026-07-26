/**
 * Migração 003 — separa entidades por município.
 *
 * CONTEXTO
 * Até 26/07/2026 o sistema não tinha o conceito de Município — todas as
 * entidades pertenciam implicitamente a uma única Prefeitura (Rio Verde).
 * Com o sistema passando a atender mais de um órgão (ex.: Câmara de
 * Acreúna), cada entidade precisa apontar para um município.
 *
 * O QUE ESTA MIGRAÇÃO FAZ
 * Se ainda não existe nenhum município cadastrado, cria um chamado
 * "Rio Verde" (o primeiro cliente do sistema). Depois, toda entidade sem
 * município definido passa a apontar para o primeiro município cadastrado.
 *
 * ISTO NÃO RESOLVE SOZINHO A CÂMARA DE ACREÚNA (ou qualquer entidade que já
 * pertença a outro município na prática): ela também cai em "Rio Verde" por
 * ser a regra padrão, e precisa ser reapontada manualmente, uma única vez,
 * assim que a tela de Município existir — a migração não tem como adivinhar
 * a quem uma entidade já cadastrada pertence de verdade.
 */

import { emptyMunicipio } from "../dominio/municipios.js";

export const ID_MIGRACAO = "003-separa-entidades-por-municipio";

/**
 * @param {Array} secretarias - entidades já carregadas
 * @param {Array} municipios - municípios já carregados
 * @param {(chave: string, valor: string) => Promise<void>} gravar - grava uma chave no armazenamento
 * @returns {Promise<{ criouMunicipio: boolean, entidadesAtualizadas: number, municipioPadraoId: string }>}
 */
export async function aplicar(secretarias, municipios, gravar) {
  const semMunicipio = (secretarias || []).filter(s => !s.municipioId);

  if (semMunicipio.length === 0) {
    return { criouMunicipio: false, entidadesAtualizadas: 0, municipioPadraoId: municipios?.[0]?.id || null };
  }

  let municipioPadrao = municipios?.[0];
  let criouMunicipio = false;

  if (!municipioPadrao) {
    municipioPadrao = emptyMunicipio("Rio Verde", "GO");
    await gravar("municipio:" + municipioPadrao.id, JSON.stringify(municipioPadrao));
    criouMunicipio = true;
  }

  for (const entidade of semMunicipio) {
    const atualizada = { ...entidade, municipioId: municipioPadrao.id, updatedAt: Date.now() };
    await gravar("sec:" + entidade.id, JSON.stringify(atualizada));
  }

  return { criouMunicipio, entidadesAtualizadas: semMunicipio.length, municipioPadraoId: municipioPadrao.id };
}
