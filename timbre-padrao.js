// Armazenamento na nuvem (Firestore), com a mesma interface do armazenamento local:
// get / set / delete / list. Como a assinatura é idêntica, o app não precisa saber
// onde os dados estão — só troca esta implementação.
//
// Modelo: coleção "dados", um documento por chave ("etp:123", "sec:abc"...).
// O conteúdo vai no campo "v" como texto JSON, igual ao que já era gravado antes.
//
// SEGURANÇA — leia o arquivo firestore.rules na raiz do repositório.
// A proteção deste banco vive nas Regras de Segurança do Firestore, publicadas no
// console do Firebase (elas NÃO entram em vigor só por existirem no repositório).
// Regra atual: qualquer operação exige usuário autenticado; nenhuma outra coleção
// é acessível. Atenção: as chaves não carregam dono/secretaria, então todo usuário
// autenticado enxerga todos os documentos — o isolamento entre secretarias, se um
// dia for necessário, exige as mudanças descritas em firestore.rules.

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, documentId, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

const COLECAO = "dados";

// O Firestore limita cada documento a 1 MiB. Valores maiores (a planilha do PCA pode
// chegar perto disso) são quebrados em pedaços e remontados na leitura.
const LIMITE_PEDACO = 700000;
const SUFIXO_PEDACO = "__p";

// O Firestore não aceita "/" em identificadores de documento
function paraId(chave) {
  return String(chave).replace(/\//g, "__barra__");
}
function deId(id) {
  return id.replace(/__barra__/g, "/");
}

const storage = {
  async get(chave) {
    const ref = doc(db, COLECAO, paraId(chave));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Chave "${chave}" não encontrada`);

    const dados = snap.data();

    // Valor quebrado em pedaços: remonta na ordem
    if (dados.pedacos) {
      let texto = "";
      for (let i = 0; i < dados.pedacos; i++) {
        const parte = await getDoc(doc(db, COLECAO, paraId(chave) + SUFIXO_PEDACO + i));
        if (!parte.exists()) throw new Error(`Pedaço ${i} de "${chave}" não encontrado`);
        texto += parte.data().v;
      }
      return { key: chave, value: texto, shared: false };
    }

    return { key: chave, value: dados.v, shared: false };
  },

  async set(chave, valor) {
    const texto = String(valor ?? "");
    const id = paraId(chave);

    // Apaga pedaços de uma gravação anterior, se houver
    const antigo = await getDoc(doc(db, COLECAO, id));
    if (antigo.exists() && antigo.data().pedacos) {
      const lote = writeBatch(db);
      for (let i = 0; i < antigo.data().pedacos; i++) {
        lote.delete(doc(db, COLECAO, id + SUFIXO_PEDACO + i));
      }
      await lote.commit();
    }

    if (texto.length <= LIMITE_PEDACO) {
      await setDoc(doc(db, COLECAO, id), { v: texto, em: Date.now() });
    } else {
      const total = Math.ceil(texto.length / LIMITE_PEDACO);
      const lote = writeBatch(db);
      for (let i = 0; i < total; i++) {
        lote.set(doc(db, COLECAO, id + SUFIXO_PEDACO + i), {
          v: texto.slice(i * LIMITE_PEDACO, (i + 1) * LIMITE_PEDACO),
        });
      }
      lote.set(doc(db, COLECAO, id), { pedacos: total, em: Date.now() });
      await lote.commit();
    }

    return { key: chave, value: texto, shared: false };
  },

  async delete(chave) {
    const id = paraId(chave);
    const ref = doc(db, COLECAO, id);
    const snap = await getDoc(ref);
    const existia = snap.exists();

    if (existia && snap.data().pedacos) {
      const lote = writeBatch(db);
      for (let i = 0; i < snap.data().pedacos; i++) {
        lote.delete(doc(db, COLECAO, id + SUFIXO_PEDACO + i));
      }
      await lote.commit();
    }
    await deleteDoc(ref);
    return { key: chave, deleted: existia, shared: false };
  },

  async list(prefixo = "") {
    const p = paraId(prefixo);
    // Busca por faixa de identificador: tudo que começa com o prefixo
    const consulta = query(
      collection(db, COLECAO),
      where(documentId(), ">=", p),
      where(documentId(), "<", p + "\uf8ff"),
    );
    const snap = await getDocs(consulta);
    const keys = snap.docs
      .map(d => d.id)
      .filter(id => !id.includes(SUFIXO_PEDACO))  // pedaços não são chaves próprias
      .map(deId);
    return { keys, prefix: prefixo, shared: false };
  },
};

export default storage;
