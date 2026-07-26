/**
 * Cadastro de fornecedores.
 *
 * Guardado na mesma base do resto do sistema (prefixo "fornecedor:"), para
 * aproveitar backup e lixeira já existentes. A busca por CNPJ evita
 * redigitar os dados de quem já mandou OF antes, e o histórico ajuda a
 * enxergar se um fornecedor costuma atrasar ou gerar divergência.
 */

// Deixa só os dígitos — permite comparar CNPJs digitados com ou sem
// pontuação como se fossem o mesmo.
export function normalizarCnpj(v) {
  return String(v || "").replace(/\D/g, "");
}

export function cnpjValido(v) {
  return normalizarCnpj(v).length === 14;
}

export function formatarCnpj(v) {
  const d = normalizarCnpj(v);
  if (d.length !== 14) return v || "";
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}

export function emptyFornecedor(cnpj) {
  return {
    id: "forn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    cnpj: normalizarCnpj(cnpj),
    razaoSocial: "",
    email: "",
    telefone: "",
    endereco: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Acha o fornecedor já cadastrado com este CNPJ, ignorando pontuação.
export function buscarFornecedorPorCnpj(fornecedores, cnpj) {
  const alvo = normalizarCnpj(cnpj);
  if (!alvo) return null;
  return (fornecedores || []).find(f => normalizarCnpj(f.cnpj) === alvo) || null;
}

// Cria o cadastro se não existir, ou atualiza os dados de contato se vieram
// diferentes desta vez (ex.: e-mail novo). Não perde o histórico — quem gera
// as estatísticas é ofsDoFornecedor(), a partir da lista de OFs, não daqui.
export function upsertFornecedor(fornecedores, { cnpj, razaoSocial, email, telefone }) {
  const existente = buscarFornecedorPorCnpj(fornecedores, cnpj);
  if (existente) {
    return {
      ...existente,
      razaoSocial: razaoSocial?.trim() || existente.razaoSocial,
      email: email?.trim() || existente.email,
      telefone: telefone?.trim() || existente.telefone,
      updatedAt: Date.now(),
    };
  }
  return {
    ...emptyFornecedor(cnpj),
    razaoSocial: razaoSocial?.trim() || "",
    email: email?.trim() || "",
    telefone: telefone?.trim() || "",
  };
}

// Histórico de um fornecedor: quantas OFs, quantas em dia, quantas com
// divergência ou atraso. Serve tanto pra mostrar no cadastro quanto para
// sinalizar risco na hora de criar uma nova OF para o mesmo CNPJ.
export function resumoHistoricoFornecedor(cnpj, todasAsOfs) {
  const alvo = normalizarCnpj(cnpj);
  const dele = (todasAsOfs || []).filter(o => normalizarCnpj(o.cnpj) === alvo);
  return {
    total: dele.length,
    concluidas: dele.filter(o => !!o.reciboImutavel).length,
    comDivergencia: dele.filter(o => o.status === "Divergência").length,
    emAberto: dele.filter(o => !o.reciboImutavel && o.status !== "Divergência").length,
  };
}
