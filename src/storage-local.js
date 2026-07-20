// Shim de armazenamento local, compatível com a API `window.storage` usada
// dentro dos artefatos do Claude (get/set/delete/list), mas gravando no
// localStorage do navegador — para o app funcionar sozinho, fora do Claude.
//
// Obs.: os dados ficam só neste navegador/computador. Trocar de máquina ou
// limpar os dados do site apaga os ETPs salvos aqui.

const DB_KEY = "etpgen:db";

function readDb() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

const storage = {
  async get(key) {
    const db = readDb();
    if (!(key in db)) throw new Error(`Chave "${key}" não encontrada`);
    return { key, value: db[key], shared: false };
  },

  async set(key, value) {
    const db = readDb();
    db[key] = value;
    writeDb(db);
    return { key, value, shared: false };
  },

  async delete(key) {
    const db = readDb();
    const existed = key in db;
    delete db[key];
    writeDb(db);
    return { key, deleted: existed, shared: false };
  },

  async list(prefix = "") {
    const db = readDb();
    const keys = Object.keys(db).filter(k => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

export default storage;
