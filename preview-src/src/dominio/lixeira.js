/**
 * Lixeira com retenção de 30 dias.
 *
 * Excluir não apaga na hora: o documento vai para a lixeira e fica disponível
 * para restauração. Passado o prazo, sai sozinho. Guardamos de onde o
 * documento veio, para saber devolvê-lo ao lugar certo.
 *
 * As funções que gravam recebem o armazenamento como primeiro argumento, em
 * vez de importá-lo. Assim esta camada não conhece Firebase nem navegador —
 * e pode ser testada com um armazenamento de mentira.
 */

export const DIAS_NA_LIXEIRA = 30;
export const PREFIXO_LIXO = "lixo:";


// Rótulo do tipo, a partir do prefixo original da chave
export const TIPOS_DOC = {
  "etp:": { rotulo: "ETP", icone: "FileText" },
  "just:": { rotulo: "Justificativa", icone: "FileEdit" },
  "decl:": { rotulo: "Declaração de PCA", icone: "ListChecks" },
};

export function diasRestantes(excluidoEm) {
  const passados = (Date.now() - excluidoEm) / 86400000;
  return Math.max(0, Math.ceil(DIAS_NA_LIXEIRA - passados));
}

// Move o documento para a lixeira, guardando de onde veio e quando saiu
export async function moverParaLixeira(storage, prefixo, id, doc) {
  const registro = {
    id: "lx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    prefixoOriginal: prefixo,
    idOriginal: id,
    excluidoEm: Date.now(),
    doc,
  };
  await storage.set(PREFIXO_LIXO + registro.id, JSON.stringify(registro), false);
  await storage.delete(prefixo + id, false);
  return registro;
}

// Devolve o documento ao lugar de origem
export async function restaurarDaLixeira(storage, registro) {
  await storage.set(
    registro.prefixoOriginal + registro.idOriginal,
    JSON.stringify(registro.doc), false);
  await storage.delete(PREFIXO_LIXO + registro.id, false);
}

export async function excluirDefinitivo(storage, registro) {
  await storage.delete(PREFIXO_LIXO + registro.id, false);
}

// Remove o que já passou dos 30 dias. Roda no carregamento, sem incomodar ninguém.
export async function limparLixeiraVencida(storage, registros) {
  const vencidos = registros.filter(r => diasRestantes(r.excluidoEm) <= 0);
  for (const r of vencidos) {
    await storage.delete(PREFIXO_LIXO + r.id, false).catch(() => {});
  }
  return registros.filter(r => diasRestantes(r.excluidoEm) > 0);
}

// Título do documento guardado, seja qual for o tipo
export function tituloNaLixeira(registro) {
  const d = registro.doc || {};
  if (registro.prefixoOriginal === "etp:") return d.meta?.titulo || "ETP sem título";
  return (d.campos?.objeto ?? d.objeto ?? "").trim() || "Sem objeto definido";
}
