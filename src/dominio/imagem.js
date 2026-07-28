/**
 * Compressão de imagem, para anexos pequenos (ex.: prova de envio manual da
 * OF) — reduz tamanho e qualidade o bastante para não pesar no documento do
 * Firestore (limite de 1 MB por documento), mantendo legível.
 */

export function comprimirImagemAnexo(dataUrl, maxWidth = 800, qualidade = 0.55) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", qualidade));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
