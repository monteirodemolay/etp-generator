/**
 * Log de Auditoria — grava e lista eventos numa coleção própria do
 * Firestore (log_auditoria), separada da coleção "dados" porque precisa de
 * consultas reais (ordenar por data, filtrar por entidade), não o esquema
 * de chave-prefixo usado em storage.js.
 */

import { collection, doc, setDoc, getDocs, query, orderBy, limit as limitarQuery } from "firebase/firestore";
import { db } from "./firebase.js";
import { montarEventoAuditoria } from "./dominio/auditoria.js";

const COL_AUDITORIA = "log_auditoria";

// Grava um evento. Falha silenciosamente (só loga no console) — uma falha
// ao registrar auditoria não pode travar a ação que está sendo auditada.
export async function registrarEvento(dadosEvento) {
  try {
    const evento = montarEventoAuditoria(dadosEvento);
    const id = "aud_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    await setDoc(doc(db, COL_AUDITORIA, id), evento);
    return evento;
  } catch (e) {
    console.error("Não foi possível registrar o evento de auditoria", e);
    return null;
  }
}

// Lista os eventos mais recentes primeiro. limite alto o bastante para uso
// normal, sem carregar a coleção inteira indefinidamente.
export async function listarEventos(limite = 500) {
  const q = query(collection(db, COL_AUDITORIA), orderBy("quando", "desc"), limitarQuery(limite));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
