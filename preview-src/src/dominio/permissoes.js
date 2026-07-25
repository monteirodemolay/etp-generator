/**
 * Papéis e permissões dentro do sistema.
 *
 * As SENHAS não ficam aqui — vivem no Firebase Authentication. Este cadastro
 * guarda apenas quem é a pessoa, qual o papel e a quais entidades tem acesso.
 *
 * Estas permissões organizam a interface: escondem o que não cabe a cada
 * papel. A barreira de verdade são as Regras de Segurança do Firestore, que
 * decidem quem consegue sequer ler o banco.
 */


// ---------- Usuários e permissões ----------
// As SENHAS não ficam aqui: elas vivem no Firebase Authentication. Este cadastro guarda
// apenas quem é a pessoa, qual o papel e a quais entidades ela tem acesso.
export const PAPEIS = {
  admin: {
    rotulo: "Administrador",
    descricao: "Gerencia entidades, usuários e permissões, além de criar e excluir documentos.",
  },
  padrao: {
    rotulo: "Usuário padrão",
    descricao: "Cria e edita documentos das entidades que lhe forem atribuídas.",
  },
};

// O que cada papel pode fazer. Serve para a interface esconder o que não cabe;
// a barreira de verdade continua sendo as Regras de Segurança do Firestore.
export const PERMISSOES = {
  admin: {
    gerenciarUsuarios: true, gerenciarEntidades: true,
    criarDocumentos: true, editarDocumentos: true,
    excluirDocumentos: true, esvaziarLixeira: true,
  },
  padrao: {
    gerenciarUsuarios: false, gerenciarEntidades: false,
    criarDocumentos: true, editarDocumentos: true,
    excluirDocumentos: true, esvaziarLixeira: false,
  },
};

export function emptyUsuario(email) {
  return {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    email: (email || "").trim().toLowerCase(),
    nomeCompleto: "",
    cargo: "",
    papel: "padrao",
    entidades: [],          // ids das entidades a que tem acesso
    entidadePrincipal: "",  // qual delas abre por padrão
    ativo: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Encontra o cadastro do e-mail que está logado
export function usuarioPorEmail(usuarios, email) {
  const alvo = String(email || "").trim().toLowerCase();
  if (!alvo) return null;
  return usuarios.find(u => u.email === alvo) || null;
}

// Permissões de quem está usando. Sem cadastro correspondente, trata como administrador:
// só chega aqui quem já passou pelas Regras do Firestore, e isso evita travar o primeiro
// acesso, quando ainda não há nenhum usuário cadastrado.
export function permissoesDe(usuario) {
  if (!usuario) return { ...PERMISSOES.admin, papel: "admin", semCadastro: true };
  if (!usuario.ativo) return { gerenciarUsuarios: false, gerenciarEntidades: false,
    criarDocumentos: false, editarDocumentos: false, excluirDocumentos: false,
    esvaziarLixeira: false, papel: usuario.papel, inativo: true };
  return { ...PERMISSOES[usuario.papel || "padrao"], papel: usuario.papel || "padrao" };
}

// Entidades que a pessoa enxerga. Administrador vê todas; sem cadastro, também.
// Entidades que a pessoa enxerga.
//
// Administrador vê todas. Usuário padrão vê SOMENTE as que lhe foram
// atribuídas — sem entidade atribuída, não vê nenhuma.
//
// Antes esta função devolvia todas as entidades quando o usuário não tinha
// nenhuma atribuída, como rede de proteção para não travar o acesso. Era o
// contrário do correto: um esquecimento do administrador ao cadastrar alguém
// virava acesso irrestrito. Agora a pessoa vê uma tela explicando a quem
// pedir, e o administrador precisa atribuir explicitamente.
export function entidadesVisiveis(usuario, secretarias) {
  // Sem cadastro nenhum no sistema — primeiro acesso, ainda configurando
  if (!usuario) return secretarias;
  if (usuario.papel === "admin") return secretarias;
  const permitidas = usuario.entidades || [];
  return secretarias.filter(s => permitidas.includes(s.id));
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
  const principal = secretarias.find(s => s.id === principalId);
  const nome = principal?.sigla || principal?.nome || "Entidade";
  const extras = ids.length - 1;
  return extras > 0 ? `${nome} e +${extras}` : nome;
}
