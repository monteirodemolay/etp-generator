/**
 * Lê a maior tabela dentro de um arquivo Word (.docx), devolvendo linha por
 * linha, célula por célula — o mesmo formato que uma planilha Excel lida
 * com XLSX.utils.sheet_to_json({ header: 1 }) produz, para poder reaproveitar
 * o mesmo parser de itens (ver dominio/pesquisa-precos.js).
 */

import mammoth from "mammoth";

export async function lerTabelaDeWord(file) {
  const arrayBuffer = await file.arrayBuffer();
  const resultado = await mammoth.convertToHtml({ arrayBuffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(resultado.value, "text/html");
  const tabelas = [...doc.querySelectorAll("table")];

  // Um documento pode ter várias tabelas (ex.: cabeçalho institucional
  // também em tabela) — assume que a tabela de itens é a maior delas.
  let maiorTabela = [];
  for (const tabela of tabelas) {
    const linhas = [...tabela.querySelectorAll("tr")].map(tr =>
      [...tr.querySelectorAll("td, th")].map(celula => celula.textContent.trim())
    );
    if (linhas.length > maiorTabela.length) maiorTabela = linhas;
  }
  return maiorTabela;
}
