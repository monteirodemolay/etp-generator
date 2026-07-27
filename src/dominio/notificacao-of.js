/**
 * Notificação formal de atraso ou não entrega de uma Ordem de Fornecimento —
 * modelo baseado em notificações reais já usadas manualmente pela
 * Prefeitura, automatizando a parte estrutural e deixando um campo livre
 * para os fatos específicos de cada caso.
 *
 * Escopo: só cobre atraso/não entrega de OF (o que o sistema já rastreia).
 * Não cobre recusa de assinatura de contrato nem descumprimento de
 * cláusula durante execução de serviço — o sistema não tem os dados pra
 * sustentar essas notificações automaticamente.
 */

import { formatarCnpj } from "./fornecedores.js";

export function formatarPrazoNotificacao(quantidade, unidade) {
  const n = Number(quantidade) || 0;
  if (unidade === "horas") return `${n} hora(s)`;
  if (unidade === "dias-uteis") return `${n} dia(s) útil(eis)`;
  return `${n} dia(s) corrido(s)`;
}

/**
 * @param {object} p
 * @param {object} p.of - a Ordem de Fornecimento
 * @param {number} p.numeroSeq - qual notificação é esta (1ª, 2ª...) para esta OF
 * @param {string} p.nomeEntidade - nome completo da entidade (ex.: "Secretaria Municipal de Assistência Social")
 * @param {string} [p.observacoes] - fatos específicos deste caso, texto livre
 * @param {string} p.assinanteNome
 * @param {string} p.assinanteCargo
 * @param {number} p.prazoQuantidade
 * @param {string} p.prazoUnidade - "horas" | "dias-corridos" | "dias-uteis"
 * @param {string} p.dataDeHojeExtenso - ex.: "Rio Verde – Goiás, 27 de julho de 2026."
 */
export function montarTextoNotificacaoAtraso({
  of, numeroSeq, nomeEntidade, observacoes, assinanteNome, assinanteCargo,
  prazoQuantidade, prazoUnidade, dataDeHojeExtenso,
}) {
  const rotuloPrazo = formatarPrazoNotificacao(prazoQuantidade, prazoUnidade);

  // A primeira notificação não pode dizer "sem que houvesse resposta" —
  // ainda não houve nenhuma tentativa anterior para não ter havido resposta.
  const paragrafoHistorico = numeroSeq === 1
    ? "Esta é a 1ª notificação enviada sobre esta Ordem de Fornecimento."
    : `Esta é a ${numeroSeq}ª notificação enviada sobre esta Ordem de Fornecimento, sendo que a(s) anterior(es) não obteve(obtiveram) resposta ou regularização por parte da empresa.`;

  const recebimento = of.dataAceite
    ? `, que confirmou o recebimento em ${of.dataAceite}`
    : "";

  const partes = [
    "NOTIFICAÇÃO",
    "",
    `ORDEM DE FORNECIMENTO Nº ${of.numeroOf}`,
    "",
    "ASSUNTO: DESCUMPRIMENTO DE OBRIGAÇÃO ASSUMIDA E POSSIBILIDADE DE APLICAÇÃO DE PENALIDADES ADMINISTRATIVAS",
    "",
    `A ${nomeEntidade}, no exercício de suas atribuições legais e com fundamento na Lei nº 14.133/2021, notifica formalmente a empresa ${of.empresa}, inscrita no CNPJ sob nº ${formatarCnpj(of.cnpj)}, considerando o não cumprimento das obrigações assumidas e derivativas da Ordem de Fornecimento nº ${of.numeroOf}, conforme os fatos a seguir expostos:`,
    "",
    `Os documentos foram devidamente encaminhados à empresa em ${of.dataEnvioStr || "data não registrada"}${recebimento}, estabelecendo o prazo de ${of.prazoDias} dia(s) para a entrega, com limite em ${of.prazoLimite || "não definido"}. Contudo, até a presente data, a empresa não realizou a entrega dentro do prazo avençado.`,
  ];

  if (observacoes?.trim()) {
    partes.push("", observacoes.trim());
  }

  partes.push(
    "",
    "Tal conduta configura inadimplemento contratual, nos termos do art. 155, inciso II, da Lei nº 14.133/2021, podendo ensejar advertência, multa, impedimento de licitar e contratar com a Administração Pública e declaração de inidoneidade, conforme os artigos 156 e 157 do mesmo diploma legal.",
    "",
    `${paragrafoHistorico} O não atendimento à presente notificação poderá ensejar o encaminhamento deste expediente à Comissão de Penalidades Administrativas, para apuração de responsabilidades e aplicação das sanções cabíveis.`,
    "",
    `Solicita-se que a empresa apresente manifestação formal acerca dos fatos narrados, no prazo de ${rotuloPrazo}, a contar do recebimento desta notificação.`,
    "",
    dataDeHojeExtenso,
    "",
    assinanteNome,
    assinanteCargo,
  );

  return partes.join("\n");
}

// Link público pra abrir a íntegra desta notificação específica (uma OF pode
// ter várias notificações; o "n" diz qual delas). Reaproveita a mesma leitura
// pública já existente da OF (of_registros/{token}) — nenhuma regra nova.
// Recebe a URL base como parâmetro (em vez de ler "window" direto) só pra
// esta função dar pra testar isoladamente, sem precisar simular navegador.
export function linkNotificacao(urlBase, token, numeroSeq) {
  return `${urlBase}?notificacao=${token}&n=${numeroSeq}`;
}

export function mensagemWhatsAppNotificacao(of, numeroSeq, link) {
  return `Prezado(a), a empresa ${of.empresa} recebeu a Notificação nº ${numeroSeq} ` +
    `referente à Ordem de Fornecimento nº ${of.numeroOf}.\n` +
    `Veja a íntegra pelo link: ${link}`;
}

export function emptyNotificacao({
  numero, textoCompleto, assinanteNome, assinanteCargo, prazoQuantidade, prazoUnidade, observacoes, usuarioEmail,
}) {
  return {
    numero,
    enviadaEm: Date.now(),
    textoCompleto,
    assinanteNome,
    assinanteCargo,
    prazoQuantidade,
    prazoUnidade,
    observacoes: observacoes || "",
    usuarioEmail,
  };
}
