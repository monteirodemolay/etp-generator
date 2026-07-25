/**
 * Migração 001 — corrige a inversão dos incisos IV e V.
 *
 * CONTEXTO
 * Até 24/07/2026 o sistema tratava, na ordem invertida em relação à lei:
 *   IV = Levantamento de Mercado      (a lei diz: estimativas das quantidades)
 *   V  = Estimativa das Quantidades   (a lei diz: levantamento de mercado)
 *
 * Como o art. 18, § 2º torna o inciso IV obrigatório, a inversão fazia o
 * sistema exigir o levantamento de mercado e dispensar as estimativas de
 * quantidades — o oposto do que a Lei nº 14.133/2021 determina.
 *
 * O QUE ESTA MIGRAÇÃO FAZ
 * Troca o conteúdo gravado em sections.IV com o de sections.V, de modo que
 * cada texto passe a ficar sob o inciso correto. Nada é apagado.
 *
 * SEGURANÇA
 * - Só roda uma vez por documento, marcado por "migracoes" no próprio ETP.
 * - Se o ETP já estiver correto (marca presente), é ignorado.
 * - Falha em um documento não interrompe os demais.
 * - Não altera ETPs sem nenhum dos dois incisos preenchidos.
 */

export const ID_MIGRACAO = "001-corrige-incisos-iv-v";

/** O documento já passou por esta migração? */
export function jaMigrado(etp) {
  return Array.isArray(etp?.migracoes) && etp.migracoes.includes(ID_MIGRACAO);
}

/**
 * Devolve a versão corrigida do ETP, sem alterar o original.
 * Quando não há o que corrigir, devolve o mesmo objeto — o chamador pode
 * comparar por identidade para saber se houve mudança.
 */
export function corrigirEtp(etp) {
  if (!etp || jaMigrado(etp)) return etp;

  const sections = { ...(etp.sections || {}) };
  const textoIV = sections.IV;
  const textoV = sections.V;

  const temAlgum = (textoIV && textoIV.trim()) || (textoV && textoV.trim());

  // Mesmo sem conteúdo, marca como migrado: o ETP nasceu na numeração antiga
  // e daqui em diante seguirá a correta.
  if (temAlgum) {
    sections.IV = textoV || "";
    sections.V = textoIV || "";
  }

  // A lista de incisos excluídos também referencia os identificadores
  const excluidos = (etp.incisosExcluidos || []).map(id =>
    id === "IV" ? "V" : id === "V" ? "IV" : id
  );

  return {
    ...etp,
    sections,
    incisosExcluidos: excluidos,
    migracoes: [...(etp.migracoes || []), ID_MIGRACAO],
    updatedAt: Date.now(),
  };
}

/**
 * Levanta o que seria alterado, sem gravar nada.
 * Serve para conferir antes de aplicar.
 */
export function levantarImpacto(etps) {
  const pendentes = (etps || []).filter(e => !jaMigrado(e));
  return {
    total: (etps || []).length,
    jaCorrigidos: (etps || []).length - pendentes.length,
    pendentes: pendentes.length,
    comTexto: pendentes.filter(e =>
      (e.sections?.IV || "").trim() || (e.sections?.V || "").trim()
    ).length,
    documentos: pendentes.map(e => ({
      id: e.id,
      titulo: e.meta?.titulo || "ETP sem título",
      processo: e.meta?.processo || null,
      temTextoIV: !!(e.sections?.IV || "").trim(),
      temTextoV: !!(e.sections?.V || "").trim(),
    })),
  };
}

/**
 * Aplica a migração em todos os ETPs e grava.
 * Recebe a função de gravação para não depender de qual armazenamento está
 * em uso — o mesmo código serve para o navegador e para a nuvem.
 */
export async function aplicar(etps, gravar) {
  const resultado = { corrigidos: 0, ignorados: 0, falhas: [] };

  for (const etp of etps || []) {
    if (jaMigrado(etp)) {
      resultado.ignorados++;
      continue;
    }
    try {
      const corrigido = corrigirEtp(etp);
      await gravar("etp:" + corrigido.id, JSON.stringify(corrigido));
      resultado.corrigidos++;
    } catch (e) {
      console.error("Falha ao migrar ETP " + etp?.id, e);
      resultado.falhas.push({ id: etp?.id, erro: String(e?.message || e) });
    }
  }

  return resultado;
}
