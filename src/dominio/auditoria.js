/**
 * Log de Auditoria — registro de ações significativas praticadas pela
 * equipe (autenticada) dentro do sistema, para responder a uma eventual
 * auditoria de funções.
 *
 * Deliberadamente NÃO registra:
 * - Ações do fornecedor (confirmar recebimento, relatar divergência) — já
 *   ficam permanentemente marcadas na própria OF (dataAceite, reciboImutavel).
 * - Alterações campo a campo dentro de um documento em edição — só o
 *   "abrir" e o "salvar" contam como eventos, não cada letra digitada.
 *
 * Cada evento, uma vez gravado, é definitivo — nada aqui é editável nem
 * apagável, nem pelo administrador. Ver firestore.rules: a coleção só
 * aceita "create".
 */

export const TIPOS_EVENTO = {
  // Documentos (ETP, Justificativa, Declaração)
  DOCUMENTO_CRIADO: "documento.criado",
  DOCUMENTO_ABERTO: "documento.aberto",
  DOCUMENTO_EDITADO: "documento.editado",
  DOCUMENTO_EXCLUIDO: "documento.excluido",
  DOCUMENTO_RESTAURADO: "documento.restaurado",
  DOCUMENTO_APAGADO_DEFINITIVO: "documento.apagado_definitivo",
  DOCUMENTO_DUPLICADO: "documento.duplicado",

  // Ordem de Fornecimento
  OF_CRIADA: "of.criada",
  OF_DISPARADA: "of.disparada",
  OF_ENTREGA_CONFIRMADA: "of.entrega_confirmada",
  OF_ENTREGA_DESFEITA: "of.entrega_desfeita",
  OF_NOTIFICACAO_ENVIADA: "of.notificacao_enviada",
  OF_EXCLUIDA: "of.excluida",

  // Administração
  USUARIO_CRIADO: "usuario.criado",
  USUARIO_EDITADO: "usuario.editado",
  USUARIO_EXCLUIDO: "usuario.excluido",
  ENTIDADE_CRIADA: "entidade.criada",
  ENTIDADE_EDITADA: "entidade.editada",
  ENTIDADE_EXCLUIDA: "entidade.excluida",
  BACKUP_EXPORTADO: "backup.exportado",
  BACKUP_RESTAURADO: "backup.restaurado",
};

// Rótulo em português de cada tipo, para exibir na tela de Auditoria.
export const ROTULOS_EVENTO = {
  [TIPOS_EVENTO.DOCUMENTO_CRIADO]: "Criou o documento",
  [TIPOS_EVENTO.DOCUMENTO_ABERTO]: "Abriu o documento",
  [TIPOS_EVENTO.DOCUMENTO_EDITADO]: "Editou o documento",
  [TIPOS_EVENTO.DOCUMENTO_EXCLUIDO]: "Excluiu o documento (foi para a lixeira)",
  [TIPOS_EVENTO.DOCUMENTO_RESTAURADO]: "Restaurou o documento da lixeira",
  [TIPOS_EVENTO.DOCUMENTO_APAGADO_DEFINITIVO]: "Apagou o documento definitivamente",
  [TIPOS_EVENTO.DOCUMENTO_DUPLICADO]: "Duplicou o documento",
  [TIPOS_EVENTO.OF_CRIADA]: "Criou a Ordem de Fornecimento",
  [TIPOS_EVENTO.OF_DISPARADA]: "Disparou a Ordem de Fornecimento",
  [TIPOS_EVENTO.OF_ENTREGA_CONFIRMADA]: "Confirmou a entrega da OF",
  [TIPOS_EVENTO.OF_ENTREGA_DESFEITA]: "Desfez a confirmação de entrega da OF",
  [TIPOS_EVENTO.OF_NOTIFICACAO_ENVIADA]: "Enviou notificação de atraso/não entrega",
  [TIPOS_EVENTO.OF_EXCLUIDA]: "Excluiu a Ordem de Fornecimento",
  [TIPOS_EVENTO.USUARIO_CRIADO]: "Cadastrou um usuário",
  [TIPOS_EVENTO.USUARIO_EDITADO]: "Alterou um usuário (permissões ou dados)",
  [TIPOS_EVENTO.USUARIO_EXCLUIDO]: "Excluiu um usuário",
  [TIPOS_EVENTO.ENTIDADE_CRIADA]: "Cadastrou uma entidade",
  [TIPOS_EVENTO.ENTIDADE_EDITADA]: "Alterou uma entidade",
  [TIPOS_EVENTO.ENTIDADE_EXCLUIDA]: "Excluiu uma entidade",
  [TIPOS_EVENTO.BACKUP_EXPORTADO]: "Exportou um backup",
  [TIPOS_EVENTO.BACKUP_RESTAURADO]: "Restaurou um backup",
};

export function rotuloEvento(tipo) {
  return ROTULOS_EVENTO[tipo] || tipo;
}

/**
 * @param {object} p
 * @param {string} p.tipo - um dos TIPOS_EVENTO
 * @param {string} p.usuarioEmail - quem praticou a ação (sempre a equipe, autenticada)
 * @param {string} [p.secretariaId] - a entidade a que o evento pertence, quando fizer sentido
 * @param {{tipo: string, id: string, rotulo: string}} [p.alvo] - o que foi afetado (ex.: { tipo: "of", id, rotulo: "OF-1234" })
 * @param {string} [p.detalhes] - texto livre curto, explicando o motivo (ex.: "confirmado por engano")
 */
export function montarEventoAuditoria({ tipo, usuarioEmail, secretariaId, alvo, detalhes }) {
  return {
    tipo,
    usuarioEmail: usuarioEmail || "desconhecido",
    secretariaId: secretariaId || null,
    alvo: alvo || null,
    detalhes: detalhes || "",
    quando: Date.now(),
  };
}
