/**
 * Confirmação manual de envio — para quando a OF é comunicada ao fornecedor
 * por fora do sistema (WhatsApp pessoal, e-mail direto, presencialmente),
 * e a equipe quer deixar isso registrado, com prova opcional.
 *
 * Pode ser registrada a qualquer momento, inclusive depois — não muda o
 * fluxo normal de disparo pelo sistema, só documenta quando ele não foi
 * usado.
 */

export const METODOS_ENVIO_MANUAL = [
  { id: "whatsapp", rotulo: "WhatsApp" },
  { id: "email-pessoal", rotulo: "E-mail pessoal" },
  { id: "presencial", rotulo: "Presencial" },
  { id: "outro", rotulo: "Outro" },
];

export function rotuloMetodoEnvio(id) {
  return METODOS_ENVIO_MANUAL.find(m => m.id === id)?.rotulo || id;
}

/**
 * @param {object} p
 * @param {string} p.metodo - um dos METODOS_ENVIO_MANUAL
 * @param {string} p.dataEnvio - data informada pelo usuário, ISO (aaaa-mm-dd)
 * @param {string} [p.observacao] - texto livre
 * @param {string} [p.anexo] - data URL da imagem já comprimida, ou null
 * @param {string} p.registradoPor - e-mail de quem registrou
 */
export function emptyEnvioManual({ metodo, dataEnvio, observacao, anexo, registradoPor }) {
  return {
    id: "envio_manual_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    metodo,
    dataEnvio,
    observacao: observacao || "",
    anexo: anexo || null,
    registradoPor,
    registradoEm: Date.now(),
  };
}
