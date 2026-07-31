/**
 * Lê um PDF preservando a posição (x, y) de cada palavra na página, em vez
 * de texto corrido — necessário para reconstruir corretamente tabelas com
 * células que quebram linha (ver dominio/pdf-pca.js para o porquê).
 */

import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Agrupa os "itens de texto" do pdfjs (que já vêm fragmentados em pedaços
// pequenos) em "palavras" — juntando fragmentos adjacentes sem espaço entre
// eles, preservando a posição do primeiro fragmento de cada palavra.
function agruparEmPalavras(itensTexto) {
  const ordenados = [...itensTexto].sort((a, b) => {
    const diffY = b.transform[5] - a.transform[5];
    return Math.abs(diffY) > 2 ? diffY : a.transform[4] - b.transform[4];
  });

  const palavras = [];
  for (const it of ordenados) {
    const texto = it.str;
    if (!texto.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const partes = texto.split(/(\s+)/).filter(p => p !== "");
    let xAtual = x;
    for (const parte of partes) {
      if (parte.trim() === "") { xAtual += parte.length * (it.width / texto.length || 3); continue; }
      palavras.push({ texto: parte, x: xAtual, y: -y }); // inverte Y: pdfjs cresce pra cima, aqui cresce pra baixo (como "top")
      xAtual += parte.length * (it.width / texto.length || 3);
    }
  }
  return palavras;
}

export async function lerPdfComPosicoes(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const paginas = [];
  let textoCompleto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();
    paginas.push(agruparEmPalavras(conteudo.items));
    textoCompleto += conteudo.items.map(it => it.str).join(" ") + " ";
  }
  return { paginas, textoCompleto };
}
