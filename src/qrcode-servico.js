/**
 * Geração de QR Code — inteiramente no navegador, sem chamar nenhum serviço
 * externo. Isolado à parte, do mesmo jeito que o motor de Word e o de
 * e-mail ficam isolados: efeito colateral (biblioteca de terceiro), não
 * lógica de negócio.
 */

import QRCode from "qrcode";

export async function gerarQrCodeDataUrl(texto, tamanhoPx = 180) {
  return QRCode.toDataURL(texto, {
    width: tamanhoPx,
    margin: 1,
    color: { dark: "#1C2E4A", light: "#FFFFFF" },
  });
}
