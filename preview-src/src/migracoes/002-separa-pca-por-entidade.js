/**
 * Migração 002 — separa o PCA por entidade.
 *
 * CONTEXTO
 * Até 24/07/2026 havia um único arquivo de PCA ("pca:planilha"), compartilhado
 * por todas as Declarações de previsão no PCA, de qualquer entidade. Importar
 * o PCA da FMAS sobrescrevia o que estava lá para a SEMAS, e vice-versa.
 *
 * O QUE ESTA MIGRAÇÃO FAZ
 * Copia o conteúdo da chave antiga "pca:planilha" — se houver — para a chave
 * da primeira entidade cadastrada ("pca:<id da primeira entidade>"), que é a
 * mesma regra já usada para documentos sem entidade definida. Depois remove a
 * chave antiga, para não sobrar um arquivo órfão que ninguém mais lê.
 *
 * Se a entidade já tiver um PCA próprio (por já ter sido usada depois da
 * correção), a migração não sobrescreve — o arquivo mais recente prevalece.
 */

import { chavePcaEntidade } from "../dominio/entidades.js";

export const ID_MIGRACAO = "002-separa-pca-por-entidade";
const CHAVE_ANTIGA = "pca:planilha";

/**
 * Aplica a migração. Recebe o armazenamento e a lista de entidades — não
 * precisa de nenhum documento, diferente da migração 001.
 */
export async function aplicar(storage, secretarias) {
  const resultado = { migrado: false, motivo: null };

  let antigo;
  try {
    antigo = await storage.get(CHAVE_ANTIGA, false);
  } catch (e) {
    resultado.motivo = "nada a migrar";
    return resultado;
  }
  if (!antigo?.value) {
    resultado.motivo = "nada a migrar";
    return resultado;
  }

  const primeira = (secretarias || [])[0];
  if (!primeira) {
    resultado.motivo = "sem entidade cadastrada — mantém a chave antiga por ora";
    return resultado;
  }

  const chaveNova = chavePcaEntidade(primeira.id);
  let jaTemProprio = null;
  try {
    jaTemProprio = await storage.get(chaveNova, false);
  } catch (e) { /* não tem ainda — é o esperado */ }

  if (jaTemProprio?.value) {
    // A entidade já foi usada com o novo esquema; não sobrescreve.
    await storage.delete(CHAVE_ANTIGA, false).catch(() => {});
    resultado.motivo = `"${primeira.sigla || primeira.nome}" já tinha PCA próprio — descartada a chave antiga`;
    return resultado;
  }

  await storage.set(chaveNova, antigo.value, false);
  await storage.delete(CHAVE_ANTIGA, false).catch(() => {});
  resultado.migrado = true;
  resultado.entidade = primeira.sigla || primeira.nome;
  return resultado;
}
