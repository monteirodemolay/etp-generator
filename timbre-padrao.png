// Timbre padrão do app (Prefeitura de Rio Verde), servido como arquivo estático.
//
// Antes, a imagem vivia embutida em base64 dentro do App.jsx (~127 KB de texto),
// engordando o bundle inicial para todos os usuários — inclusive quem nunca usa
// esse timbre. Agora o PNG fica em src/assets e o Vite o publica como asset
// separado, baixado apenas quando necessário.
//
// As rotinas de exportação (Word) e o cabeçalho dos documentos esperam um
// data URL (base64) para embutir a imagem no arquivo gerado. Por isso este
// módulo expõe um carregador assíncrono que busca o asset uma única vez e o
// converte para data URL, mantendo o resultado em cache para as próximas chamadas.

import timbrePadraoUrl from "./assets/timbre-padrao.png";

let cacheDataUrl = null;
let carregando = null;

export const TIMBRE_PADRAO_URL = timbrePadraoUrl;

export function carregarTimbrePadrao() {
  if (cacheDataUrl) return Promise.resolve(cacheDataUrl);
  if (carregando) return carregando;

  carregando = fetch(timbrePadraoUrl)
    .then(resp => {
      if (!resp.ok) throw new Error(`Falha ao carregar o timbre padrão (HTTP ${resp.status})`);
      return resp.blob();
    })
    .then(blob => new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Falha ao converter o timbre padrão para data URL"));
      leitor.readAsDataURL(blob);
    }))
    .then(dataUrl => {
      cacheDataUrl = dataUrl;
      carregando = null;
      return dataUrl;
    })
    .catch(err => {
      carregando = null;
      throw err;
    });

  return carregando;
}
