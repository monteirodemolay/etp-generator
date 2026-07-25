/**
 * Papéis e permissões dentro do sistema.
 *
 * As SENHAS não ficam aqui — vivem no Firebase Authentication. Este cadastro
 * guarda apenas quem é a pessoa, qual o papel e o que ela pode fazer.
 *
 * Três dimensões de controle, todas configuráveis por usuário padrão:
 *   - paginas: quais abas do menu a pessoa vê
 *   - acoes: o que pode fazer (criar, editar, excluir, esvaziar lixeira)
 *   - entidadesSomenteLeitura: subconjunto das entidades atribuídas onde a
 *     pessoa só consulta, sem poder gravar nada
 *
 * Estas permissões organizam a interface. A barreira de verdade são as
 * Regras de Segurança do Firestore.
 */

export const PAPEIS = {
  admin: {
    rotulo: "Administrador",
    descricao: "Acesso total: todas as páginas, todas as entidades, todas as ações. A \"chave geral\".",
  },
  padrao: {
    rotulo: "Usuário padrão",
    descricao: "Acesso configurado individualmente: você escolhe páginas, entidades e ações permitidas.",
  },
};

export const PAGINAS_CONFIGURAVEIS = [
  { id: "etps", rotulo: "Meus ETPs" },
  { id: "declaracoes", rotulo: "Declarações de PCA" },
  { id: "justificativas", rotulo: "Justificativas" },
  { id: "normativos", rotulo: "Materiais Normativos" },
  { id: "lixeira", rotulo: "Lixeira" },
  { id: "backup", rotulo: "Backup" },
];
export const PAGINAS_PADRAO = Object.fromEntries(PAGINAS_CONFIGURAVEIS.map(p => [p.id, true]));

export const ACOES_CONFIGURAVEIS = [
  { id: "criarDocumentos", rotulo: "Criar documentos", descricao: "Abrir novo ETP, Declaração ou Justificativa." },
  { id: "editarDocumentos", rotulo: "Editar documentos", descricao: "Alterar e gravar documentos já existentes." },
  { id: "excluirDocumentos", rotulo: "Excluir documentos", descricao: "Mover documentos para a lixeira." },
  { id: "esvaziarLixeira", rotulo: "Esvaziar lixeira", descricao: "Apagar em definitivo, sem possibilidade de restaurar." },
];
export const ACOES_PADRAO = {
  criarDocumentos: true, editarDocumentos: true, excluirDocumentos: true, esvaziarLixeira: false,
};

export function emptyUsuario(email) {
  return {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    email: (email || "").trim().toLowerCase(),
    nomeCompleto: "",
    cargo: "",
    papel: "padrao",
    entidades: [],               // ids das entidades a que tem acesso (visualizar e/ou editar)
    entidadesSomenteLeitura: [], // subconjunto de "entidades": pode ver, mas não gravar nada
    entidadePrincipal: "",       // qual delas abre por padrão
    paginas: { ...PAGINAS_PADRAO },
    acoes: { ...ACOES_PADRAO },
    ativo: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Encontra o cadastro do e-mail que está logado
export function usuarioPorEmail(usuarios, email) {
  const alvo = String(email || "").trim().toLowerCase();
  if (!alvo) return null;
  return (usuarios || []).find(u => u.email === alvo) || null;
}

// Permissões de quem está usando. Sem cadastro correspondente, trata como
// administrador — só chega aqui quem já passou pelas Regras do Firestore, e
// isso evita travar o primeiro acesso, quando ainda não há ninguém cadastrado.
export function permissoesDe(usuario) {
  if (!usuario || usuario.papel === "admin") {
    return {
      admin: true, gerenciarUsuarios: true, gerenciarEntidades: true,
      criarDocumentos: true, editarDocumentos: true, excluirDocumentos: true, esvaziarLixeira: true,
      paginas: Object.fromEntries(PAGINAS_CONFIGURAVEIS.map(p => [p.id, true])),
      papel: "admin", semCadastro: !usuario,
    };
  }
  if (!usuario.ativo) {
    return {
      admin: false, gerenciarUsuarios: false, gerenciarEntidades: false,
      criarDocumentos: false, editarDocumentos: false, excluirDocumentos: false, esvaziarLixeira: false,
      paginas: {}, papel: usuario.papel, inativo: true,
    };
  }
  const acoes = { ...ACOES_PADRAO, ...(usuario.acoes || {}) };
  const paginas = { ...PAGINAS_PADRAO, ...(usuario.paginas || {}) };
  return { admin: false, gerenciarUsuarios: false, gerenciarEntidades: false, ...acoes, paginas, papel: "padrao" };
}

// Uma entidade é "somente leitura" para o usuário quando ele tem acesso a
// ela, mas o Administrador marcou explicitamente que não pode gravar nada
// ali — só consultar.
export function entidadeEhSomenteLeitura(usuario, entidadeId) {
  if (!usuario || usuario.papel === "admin" || !entidadeId) return false;
  return (usuario.entidadesSomenteLeitura || []).includes(entidadeId);
}

// Entidades que a pessoa enxerga.
//
// Administrador vê todas. Usuário padrão vê SOMENTE as que lhe foram
// atribuídas — sem entidade atribuída, não vê nenhuma.
//
// Esta função já teve um bug: devolvia todas as entidades quando o usuário
// não tinha nenhuma atribuída, como rede de proteção para não travar o
// acesso. Era o contrário do correto — um esquecimento do administrador ao
// cadastrar alguém virava acesso irrestrito. Fica registrado aqui porque essa
// versão errada chegou a ir para produção; esta é a corrigida.
export function entidadesVisiveis(usuario, secretarias) {
  if (!usuario) return secretarias; // sem cadastro nenhum — primeiro acesso, ainda configurando
  if (usuario.papel === "admin") return secretarias;
  const permitidas = usuario.entidades || [];
  return (secretarias || []).filter(s => permitidas.includes(s.id));
}

// Pode escolher "Todas as Entidades" no seletor do painel?
// Só quem administra: o usuário padrão trabalha numa entidade por vez, entre
// as que lhe foram atribuídas.
export function podeVerTodasEntidades(usuario) {
  return !usuario || usuario.papel === "admin";
}

// Qual entidade deve abrir por padrão para esta pessoa.
// Para o administrador, "todas"; para os demais, a principal (ou a primeira).
export function entidadeInicial(usuario, secretarias) {
  if (podeVerTodasEntidades(usuario)) return "todas";
  const visiveis = entidadesVisiveis(usuario, secretarias);
  if (visiveis.length === 0) return null;
  const principal = usuario.entidadePrincipal;
  return visiveis.some(s => s.id === principal) ? principal : visiveis[0].id;
}

// Rótulo curto para a lista: "SEMAS e +2"
export function resumoEntidades(usuario, secretarias) {
  if (!usuario) return "—";
  if (usuario.papel === "admin") return "Todas as entidades";
  const ids = usuario.entidades || [];
  if (ids.length === 0) return "Nenhuma entidade atribuída";

  const principalId = usuario.entidadePrincipal && ids.includes(usuario.entidadePrincipal)
    ? usuario.entidadePrincipal : ids[0];
  const principal = (secretarias || []).find(s => s.id === principalId);
  const nome = principal?.sigla || principal?.nome || "Entidade";
  const extras = ids.length - 1;
  return extras > 0 ? `${nome} e +${extras}` : nome;
}
