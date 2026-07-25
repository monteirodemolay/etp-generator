/**
 * Dimensionamento do timbre no cabeçalho.
 *
 * A imagem precisa caber entre as margens sem distorcer. Imagens menores que o
 * limite não são ampliadas — esticar um brasão de baixa resolução fica pior do
 * que deixá-lo pequeno.
 */

import { secretariaDoDoc } from "../dominio/entidades.js";
import { TIMBRE_PADRAO } from "./timbre-padrao.js";

// A4 em pontos: 210mm x 297mm
export const PAGINA = { largura: 595.3, altura: 841.9, margemLateral: 72, margemCabecalho: 35.4 };
export const LARGURA_UTIL = PAGINA.largura - PAGINA.margemLateral * 2;
export const ALTURA_MAX_TIMBRE = 80;

export function medirImagem(dataUrl) {
  return new Promise(resolve => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ largura: img.naturalWidth, altura: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export function dimensionarTimbre(medida) {
  if (!medida?.largura || !medida?.altura) return null;
  const larguraPt = medida.largura * 0.75; // 96 dpi -> 72 pontos por polegada
  const alturaPt = medida.altura * 0.75;
  const escala = Math.min(LARGURA_UTIL / larguraPt, ALTURA_MAX_TIMBRE / alturaPt, 1);
  return {
    largura: Math.round(larguraPt * escala * 10) / 10,
    altura: Math.round(alturaPt * escala * 10) / 10,
  };
}

export function resolverCabecalho(doc, secretarias, timbreGlobal) {
  const sec = secretariaDoDoc(doc, secretarias);
  const tipo = sec?.tipoTimbre;

  if (tipo === "nenhum") return { tipo: "nenhum" };
  if (tipo === "texto") return { tipo: "texto", html: sec.timbreHtml || "" };
  if (tipo === "imagem") return { tipo: "imagem", dataUrl: sec.timbre || timbreGlobal || TIMBRE_PADRAO };
  return { tipo: "imagem", dataUrl: sec?.timbre || timbreGlobal || TIMBRE_PADRAO };
}

export async function prepararCabecalho(cabecalho) {
  if (cabecalho?.tipo !== "imagem" || !cabecalho.dataUrl) return cabecalho;
  const tamanho = dimensionarTimbre(await medirImagem(cabecalho.dataUrl));
  return { ...cabecalho, tamanho };
}


// Redimensiona uma imagem (data URL) para uma largura máxima, para não pesar no armazenamento
export function redimensionarImagem(dataUrl, maxWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png", 0.92));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
