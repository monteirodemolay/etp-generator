/**
 * Pacote de encaminhamento de uma OF — reúne, num documento só, tudo que
 * já existe espalhado pelo sistema: dados gerais, histórico de disparo (
 * pelo sistema e manual), confirmação do fornecedor, confirmação da
 * entrega pela equipe, e cada notificação de atraso enviada.
 *
 * Serve tanto pra encaminhar à Comissão de Penalidades Administrativas
 * quanto pra disponibilizar à própria empresa, se for o caso.
 */

import { formatarCnpj } from "./fornecedores.js";
import { rotuloMetodoEnvio } from "./envio-manual.js";
import { calcularSituacao } from "./of.js";
import { rotuloEvento } from "./auditoria.js";

// Monta as seções do pacote, em texto simples — a camada de UI decide como
// exibir/imprimir cada uma.
export function montarSecoesPacote(of, eventosAuditoria = []) {
  const situacao = calcularSituacao(of);

  const dadosGerais = [
    `Ordem de Fornecimento nº: ${of.numeroOf}`,
    `Empresa: ${of.empresa || "-"}`,
    `CNPJ: ${formatarCnpj(of.cnpj) || "-"}`,
    `Situação atual: ${situacao.texto}`,
    `Prazo de entrega: ${of.prazoDias || "-"} dia(s), limite em ${of.prazoLimite || "-"}`,
  ];

  const historicoDisparo = [
    ...(of.envios || []).map(e =>
      `Disparo pelo sistema — ${e.data}${e.disparadoPor ? ` (por ${e.disparadoPor})` : ""}`),
    ...(of.enviosManuais || []).map(e =>
      `Envio manual — ${rotuloMetodoEnvio(e.metodo)}, em ${e.dataEnvio}${e.observacao ? `: ${e.observacao}` : ""}`),
  ];

  const confirmacaoFornecedor = of.reciboImutavel
    ? [
        `Confirmado pelo fornecedor em: ${of.reciboImutavel.dataConfirmacao}`,
        `Chave de autenticidade: ${of.reciboImutavel.chave}`,
      ]
    : ["O fornecedor ainda não confirmou o recebimento desta OF."];

  const confirmacaoEntrega = of.confirmacaoEntrega
    ? [
        `Situação da entrega: ${situacao.texto}`,
        of.confirmacaoEntrega.dataEntregaReal ? `Data informada da entrega: ${of.confirmacaoEntrega.dataEntregaReal}` : "Marcada como não entregue.",
        `Confirmado por: ${of.confirmacaoEntrega.confirmadoPor || "-"}`,
      ]
    : ["A equipe ainda não confirmou a situação da entrega."];

  const notificacoes = (of.notificacoes || []).map(n => ({
    titulo: `Notificação nº ${n.numero} — enviada em ${new Date(n.enviadaEm).toLocaleString("pt-BR")}`,
    assinante: `${n.assinanteNome} (${n.assinanteCargo})`,
    texto: n.textoCompleto,
  }));

  const eventosDaOf = eventosAuditoria
    .filter(e => e.alvo?.tipo === "of" && e.alvo?.id === of.token)
    .sort((a, b) => a.quando - b.quando)
    .map(e => `${new Date(e.quando).toLocaleString("pt-BR")} — ${e.usuarioEmail} — ${rotuloEvento(e.tipo)}${e.detalhes ? `: ${e.detalhes}` : ""}`);

  return { dadosGerais, historicoDisparo, confirmacaoFornecedor, confirmacaoEntrega, notificacoes, eventosDaOf };
}
