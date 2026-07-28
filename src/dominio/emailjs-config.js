/**
 * Credenciais do EmailJS usadas para disparar e-mails de Ordem de
 * Fornecimento — por padrão, as mesmas de sempre (as do FMAS, a primeira
 * entidade a usar o módulo). Uma entidade só precisa das suas próprias
 * credenciais se tiver uma conta EmailJS separada — a grande maioria vai
 * usar o padrão, sem precisar configurar nada.
 */

// As credenciais que já estavam fixas no código — continuam sendo o padrão
// para qualquer entidade que não configurar as suas próprias.
export const EMAILJS_PADRAO = {
  serviceId: "service_wqi3a7r",
  templateIdOf: "template_mqlzkdh",
  templateIdNotificacao: "template_iadthre",
  publicKey: "wadwyjtFqSDvSuRhi",
};

export function emptyEmailJsConfig() {
  return {
    ativo: false, // false = usa o padrão; true = usa os campos abaixo
    serviceId: "",
    templateIdOf: "",
    templateIdNotificacao: "",
    publicKey: "",
  };
}

// Verifica se uma configuração própria está completa o bastante pra usar —
// evita disparar com campo faltando e o e-mail simplesmente não sair.
export function emailJsConfigCompleta(config) {
  return !!(config?.ativo && config.serviceId && config.templateIdOf && config.templateIdNotificacao && config.publicKey);
}

// Resolve quais credenciais usar para uma entidade: as dela, se configuradas
// e completas; senão, o padrão (FMAS).
export function resolverCredenciaisEmailJs(entidade) {
  if (emailJsConfigCompleta(entidade?.emailJs)) {
    return {
      serviceId: entidade.emailJs.serviceId,
      templateIdOf: entidade.emailJs.templateIdOf,
      templateIdNotificacao: entidade.emailJs.templateIdNotificacao,
      publicKey: entidade.emailJs.publicKey,
    };
  }
  return EMAILJS_PADRAO;
}
