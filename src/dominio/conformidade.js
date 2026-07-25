/**
 * Verificação de conformidade antes de finalizar o ETP.
 *
 * Separa os apontamentos em três níveis:
 *   "impeditivo" — exigência legal não atendida
 *   "atencao"    — provavelmente incompleto, mas não impede
 *   "ok"         — verificação atendida
 *
 * Cada apontamento carrega, quando cabível, o dispositivo que o fundamenta —
 * é o que permite ao servidor conferir a exigência na fonte, e é por onde o
 * Core Normativo vai enriquecer o checklist com o texto da norma.
 *
 * Esta conferência é apoio ao trabalho, não parecer jurídico: verifica
 * preenchimento e coerência interna. A adequação de cada texto ao caso
 * concreto continua sendo avaliação do responsável técnico.
 */

import { SECOES, REQUIRED_IDS, FUNDAMENTO_OBRIGATORIOS, secaoPorId } from "../conteudo/incisos.js";
import { num, brl, valorTotalEtp } from "./valores.js";
import { listaResponsaveis } from "./etp.js";
import { contarPrevistosNoPca } from "./pca.js";
import { numeracaoFinal } from "./numeracao.js";

// ---------- Checklist de conformidade ----------
// Confere o ETP antes de finalizar. Cada apontamento tem gravidade:
//   "impeditivo" — exigência legal não atendida
//   "atencao"    — algo provavelmente incompleto, mas não impede
//   "ok"         — verificação atendida
export function verificarConformidade(etp) {
  const itens = etp.itens || [];
  const excluidos = etp.incisosExcluidos || [];
  const apontamentos = [];

  const add = (nivel, texto, onde, fundamento = null) =>
    apontamentos.push({ nivel, texto, onde, fundamento });

  // --- Identificação ---
  if (!etp.meta.titulo?.trim()) add("impeditivo", "O objeto da contratação não foi definido.", "meta");
  else add("ok", "Objeto da contratação definido.", "meta");

  if (!etp.meta.processo?.trim()) add("atencao", "Número do processo administrativo não informado.", "meta");
  if (listaResponsaveis(etp).length === 0) add("impeditivo", "Nenhum responsável técnico cadastrado para assinar.", "meta");
  else add("ok", `${listaResponsaveis(etp).length} responsável(is) cadastrado(s).`, "meta");

  // --- Itens e quantidades ---
  if (itens.length === 0) {
    add("impeditivo", "Nenhum item cadastrado na planilha.", "itens");
  } else {
    add("ok", `${itens.length} item(ns) cadastrado(s).`, "itens");
    const semQtd = itens.filter(i => !num(i.quantidade)).length;
    if (semQtd > 0) add("impeditivo", `${semQtd} item(ns) sem quantidade informada.`, "itens");
    const semDesc = itens.filter(i => !i.descricao?.trim()).length;
    if (semDesc > 0) add("impeditivo", `${semDesc} item(ns) sem descrição.`, "itens");
  }

  // --- PCA (art. 12, VII) ---
  if (itens.length > 0) {
    if (!etp.pca) {
      add("atencao", "Planilha do PCA não importada — não há como demonstrar o alinhamento ao plano.", "pca");
    } else {
      const previstos = contarPrevistosNoPca(etp);
      if (previstos === itens.length) add("ok", "Todos os itens estão previstos no PCA.", "pca");
      else add("atencao", `${itens.length - previstos} item(ns) sem previsão no PCA — requer inclusão no plano ou justificativa.`, "pca", "lei-14133-2021:12.VII");
    }
  }

  // --- Estimativa de valor (art. 23) ---
  if (itens.length > 0) {
    const total = valorTotalEtp(etp);
    if (total === 0) {
      add("impeditivo", "Nenhuma cotação lançada — a contratação está sem estimativa de valor.", "cotacoes", "lei-14133-2021:23");
    } else {
      add("ok", `Valor total estimado: ${brl(total)}.`, "cotacoes");
      const semCotacao = itens.filter(i => (etp.cotacoes?.[i.id] || []).length === 0).length;
      if (semCotacao > 0) add("atencao", `${semCotacao} item(ns) sem nenhuma cotação registrada.`, "cotacoes");
      const umaCotacao = itens.filter(i => (etp.cotacoes?.[i.id] || []).length === 1).length;
      if (umaCotacao > 0) add("atencao", `${umaCotacao} item(ns) com apenas uma cotação — a pesquisa de preços costuma exigir mais de uma fonte.`, "cotacoes");
    }
  }

  // --- Incisos obrigatórios (art. 18, §2º) ---
  REQUIRED_IDS.forEach(id => {
    const sec = secaoPorId(id);
    if (excluidos.includes(id)) {
      add("impeditivo", `Inciso ${id} (${sec.titulo}) foi deixado fora do ETP, mas é de preenchimento obrigatório.`, "documento", FUNDAMENTO_OBRIGATORIOS);
    } else if (!etp.sections[id]?.trim()) {
      add("impeditivo", `Inciso ${id} (${sec.titulo}) está em branco e é de preenchimento obrigatório.`, "documento", FUNDAMENTO_OBRIGATORIOS);
    }
  });
  const obrigatoriosOk = REQUIRED_IDS.filter(id => !excluidos.includes(id) && etp.sections[id]?.trim()).length;
  if (obrigatoriosOk === REQUIRED_IDS.length) add("ok", "Todos os incisos obrigatórios estão preenchidos.", "documento");

  // --- Referências cruzadas quebradas pela renumeração ---
  const numeros = numeracaoFinal(etp);
  const mudaram = SECOES.filter(sec => numeros[sec.id] && numeros[sec.id] !== sec.id).map(sec => sec.id);
  if (mudaram.length > 0) {
    const citacoes = [];
    Object.entries(etp.sections || {}).forEach(([id, html]) => {
      if (!html?.trim() || excluidos.includes(id)) return;
      const texto = html.replace(/<[^>]+>/g, " ");
      mudaram.forEach(orig => {
        const padrao = new RegExp(`inciso\\s+${orig}\\b`, "i");
        if (padrao.test(texto)) citacoes.push(`${numeros[id] || id} cita "inciso ${orig}", que passou a ser ${numeros[orig]}`);
      });
    });
    if (citacoes.length > 0) {
      add("atencao", `Referência entre incisos possivelmente desatualizada pela renumeração: ${citacoes.join("; ")}.`, "documento");
    }
  }

  return apontamentos;
}
