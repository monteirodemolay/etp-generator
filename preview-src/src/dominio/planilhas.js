/**
 * Leitura e geração de planilhas Excel.
 *
 * O sistema conversa com o Sistema Centi e com o painel do PCA por planilha,
 * porque é o formato que esses sistemas exportam. Também gera a planilha de
 * cotação para envio a fornecedores e lê de volta os valores preenchidos.
 */

import { fmtDate, fmtDateISO } from "./datas.js";

import { num } from "./valores.js";
import { todayISO } from "./datas.js";
import { objetoCompleto } from "./etp.js";


export function newItem() {
  return { id: "it_" + Math.random().toString(36).slice(2, 8), idProduto: "", descricao: "", unidade: "UNIDADE", quantidade: "", classificacao: "" };
}

// Lê uma planilha de itens no modelo padrão do Sistema Centi da Prefeitura
// (cabeçalho: Id Produto | Nome do Produto | Unidade Medida | Quantidade | Classificação | ...)
// Apenas a relação de itens é importada — valores ficam para a etapa de Levantamento de Preços.
export function parseCentiSheet(rows) {
  function findLabelValue(label) {
    for (const row of rows) {
      const idx = row.findIndex(c => String(c).trim().toLowerCase() === label.toLowerCase());
      if (idx !== -1) {
        for (let j = idx + 1; j < row.length; j++) {
          if (String(row[j] ?? "").trim() !== "") return String(row[j]).trim();
        }
      }
    }
    return "";
  }

  const headerRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === "Nome do Produto"));
  if (headerRowIdx === -1) {
    throw new Error("Não encontrei a coluna 'Nome do Produto' — não parece ser uma planilha do Sistema Centi.");
  }
  const headerRow = rows[headerRowIdx].map(c => String(c ?? "").trim());
  const col = (name) => headerRow.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const cId = col("Id Produto");
  const cNome = col("Nome do Produto");
  const cUnidade = col("Unidade Medida");
  const cQtd = col("Quantidade");
  const cClass = col("Classificação");

  const itens = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const nome = cNome !== -1 ? String(row[cNome] ?? "").trim() : "";
    if (!nome) continue;
    itens.push({
      id: "it_" + Math.random().toString(36).slice(2, 8),
      idProduto: cId !== -1 ? String(row[cId] ?? "").trim() : "",
      descricao: nome,
      unidade: cUnidade !== -1 ? (String(row[cUnidade] ?? "").trim() || "UNIDADE") : "UNIDADE",
      quantidade: cQtd !== -1 ? String(row[cQtd] ?? "").trim() : "",
      classificacao: cClass !== -1 ? String(row[cClass] ?? "").trim() : "",
    });
  }

  return {
    itens,
    codigo: findLabelValue("Código"),
    municipio: findLabelValue("Município"),
  };
}

// Lê a planilha do PCA (Plano de Contratações Anual) exportada do painel/dashboard
// (cabeçalho: LOCAL | SEQUENCIAL | CÓDIGO | PRODUTO | UNIDADE DE MEDIDA | ... | DATA PARA CONTRATAÇÃO | PRIORIDADE)
export function parsePCASheet(rows) {
  const headerRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === "CÓDIGO") && r.some(c => String(c).trim() === "PRODUTO"));
  if (headerRowIdx === -1) {
    throw new Error("Não encontrei as colunas 'CÓDIGO' e 'PRODUTO' — não parece ser a planilha exportada do painel do PCA.");
  }
  const headerRow = rows[headerRowIdx].map(c => String(c ?? "").trim());
  const col = (name) => headerRow.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const cLocal = col("LOCAL");
  const cSeq = col("SEQUENCIAL");
  const cCodigo = col("CÓDIGO");
  const cProduto = col("PRODUTO");
  const cData = col("DATA PARA CONTRATAÇÃO");
  const cPrioridade = col("PRIORIDADE");
  const cQtd = col("QUANTIDADE");

  const linhas = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const codigo = cCodigo !== -1 ? String(row[cCodigo] ?? "").trim() : "";
    const produto = cProduto !== -1 ? String(row[cProduto] ?? "").trim() : "";
    if (!codigo && !produto) continue;
    linhas.push({
      local: cLocal !== -1 ? String(row[cLocal] ?? "").trim() : "",
      sequencial: cSeq !== -1 ? String(row[cSeq] ?? "").trim() : "",
      codigo,
      produto,
      quantidade: cQtd !== -1 ? String(row[cQtd] ?? "").trim() : "",
      dataContratacao: cData !== -1 ? String(row[cData] ?? "").trim() : "",
      prioridade: cPrioridade !== -1 ? String(row[cPrioridade] ?? "").trim() : "",
    });
  }
  if (linhas.length === 0) throw new Error("Nenhuma linha de item foi encontrada nesta planilha.");
  return linhas;
}

// Gera e baixa um modelo de planilha em branco (formato compatível com a importação acima)
export function baixarModeloPlanilha() {
  const header = ["Id Produto", "Nome do Produto", "Unidade Medida", "Quantidade", "Classificação"];
  // O exemplo já vem com o código preenchido: é por ele que o app cruza o item com o PCA
  const exemplo = ["5241938182", "Ex.: CADEIRA DE RODAS EM ALUMÍNIO DOBRÁVEL ATÉ 120KG", "UNIDADE", "10", "MATERIAL PERMANENTE"];
  const nota = ["", "↑ Apague esta linha de exemplo. O 'Id Produto' é o código do Sistema Centi e é usado para localizar o item no PCA.", "", "", ""];
  const ws = XLSX.utils.aoa_to_sheet([header, exemplo, nota]);
  ws["!cols"] = [{ wch: 14 }, { wch: 55 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Itens");
  XLSX.writeFile(wb, "modelo_planilha_itens.xlsx");
}

// Gera a planilha, no mesmo formato de importação do Sistema Centi, com os itens que ainda não
// constam no PCA — para ser importada no Centi como requerimento de inclusão desses itens no plano.
export function baixarPlanilhaInclusaoCenti(itensFaltantes) {
  const header = ["Id Produto", "Nome do Produto", "Unidade Medida", "Quantidade", "Classificação"];
  const rows = itensFaltantes.map(it => [it.idProduto || "", it.descricao || "", it.unidade || "", it.quantidade || "", it.classificacao || ""]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = [{ wch: 14 }, { wch: 55 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Itens para inclusão no PCA");
  XLSX.writeFile(wb, "itens_para_inclusao_no_pca.xlsx");
}

// Gera a planilha de cotação a ser enviada a um fornecedor (Nome/CNPJ + itens, valor em branco)
export function gerarPlanilhaCotacaoFornecedor({ etp, nomeEmpresa, cnpj }) {
  const itens = etp.itens || [];
  const rows = [
    ["COTAÇÃO DE PREÇOS"],
    [],
    ["Órgão", etp.meta.orgao || ""],
    ["Objeto", etp.meta.titulo || ""],
    ["Empresa", nomeEmpresa || ""],
    ["CNPJ", cnpj || ""],
    ["Data", fmtDateISO(etp.meta.data) || fmtDate(Date.now())],
    [],
    ["Atenção! Preencha somente a coluna \"Valor Unitário (R$)\". Não altere as demais colunas."],
    [],
    ["Id Item", "Item", "Descrição", "Unidade", "Quantidade", "Valor Unitário (R$)"],
  ];
  itens.forEach((it, idx) => {
    rows.push([it.id, idx + 1, it.descricao, it.unidade, it.quantidade, ""]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 1, hidden: true }, { wch: 6 }, { wch: 55 }, { wch: 12 }, { wch: 10 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cotação");
  const nomeArquivo = (nomeEmpresa || "fornecedor").trim().replace(/[^\w\-]+/g, "_").slice(0, 40) || "fornecedor";
  XLSX.writeFile(wb, `cotacao_${nomeArquivo}.xlsx`);
}

// Lê a planilha de cotação preenchida e devolvida por um fornecedor
export function parseCotacaoFornecedorSheet(rows) {
  function findLabelValue(label) {
    for (const row of rows) {
      const idx = row.findIndex(c => String(c).trim().toLowerCase() === label.toLowerCase());
      if (idx !== -1) {
        for (let j = idx + 1; j < row.length; j++) {
          if (String(row[j] ?? "").trim() !== "") return String(row[j]).trim();
        }
      }
    }
    return "";
  }
  const headerRowIdx = rows.findIndex(r => r.some(c => String(c).trim() === "Valor Unitário (R$)"));
  if (headerRowIdx === -1) {
    throw new Error("Não encontrei a coluna 'Valor Unitário (R$)' — use o modelo exportado por este app.");
  }
  const headerRow = rows[headerRowIdx].map(c => String(c ?? "").trim());
  const col = (name) => headerRow.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const cId = col("Id Item");
  const cDescricao = col("Descrição");
  const cValor = col("Valor Unitário (R$)");

  const valores = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const valorRaw = cValor !== -1 ? String(row[cValor] ?? "").trim() : "";
    if (!valorRaw || num(valorRaw) <= 0) continue;
    valores.push({
      itemId: cId !== -1 ? String(row[cId] ?? "").trim() : "",
      descricao: cDescricao !== -1 ? String(row[cDescricao] ?? "").trim() : "",
      valor: valorRaw,
    });
  }

  return { nomeEmpresa: findLabelValue("Empresa"), cnpj: findLabelValue("CNPJ"), valores };
}
