/**
 * Busca o PCA direto da planilha do Google Sheets que alimenta o painel público do
 * PCA (pcaplanejamento-web.github.io/pca), em vez de depender de exportar do painel
 * e importar o Excel manualmente aqui.
 *
 * A planilha e a chave de API usadas abaixo são as mesmas que o próprio painel usa
 * no navegador — ficam expostas no código-fonte da página, sem exigir login, porque
 * é uma chave de leitura da API do Google Sheets (sem escopo de escrita). Se a
 * Prefeitura trocar de planilha, mudar o nome da aba, ou restringir esse acesso, as
 * constantes abaixo é que precisam ser atualizadas.
 */

const SHEET_ID = "1ZAFFvH2X2KX5716p0eqhQbuMnHU-QQNtVDTSbyreq30";
const API_KEY = "AIzaSyBeLQiwqRtvD19jAO6DnYQGqPgoPTGMBe8";
const ABA = "DADOSPCA";

// Compara o LOCAL da planilha com a sigla da entidade ignorando maiúsculas/minúsculas
// e acentos — o painel do PCA usa a sigla em caixa alta, mas não custa ser tolerante.
function normalizarLocal(v) {
  return String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Busca as linhas do PCA de uma entidade direto da planilha do painel, no mesmo
// formato que parsePCASheet() produz a partir do Excel exportado.
export async function buscarPcaOnline(localEntidade) {
  const alvo = normalizarLocal(localEntidade);
  if (!alvo) throw new Error("Esta entidade não tem sigla cadastrada para localizar no painel do PCA.");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(ABA)}?key=${API_KEY}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error("Não foi possível conectar ao painel do PCA agora. Tente de novo em instantes ou importe a planilha manualmente.");
  }
  if (!res.ok) {
    throw new Error(`O painel do PCA respondeu com erro (HTTP ${res.status}). Tente de novo em instantes ou importe a planilha manualmente.`);
  }
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length === 0) throw new Error("O painel do PCA não retornou nenhuma linha.");

  const header = rows[0].map(c => String(c ?? "").trim());
  const col = name => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const cLocal = col("LOCAL");
  const cSeq = col("SEQUENCIAL");
  const cCodigo = col("CÓDIGO");
  const cProduto = col("PRODUTO");
  const cData = col("DATA PARA CONTRATAÇÃO");
  const cPrioridade = col("PRIORIDADE");
  const cQtd = col("QUANTIDADE");
  if (cCodigo === -1 || cProduto === -1) {
    throw new Error("O painel do PCA mudou de formato — colunas 'CÓDIGO' e 'PRODUTO' não encontradas.");
  }

  const linhas = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const localLinha = cLocal !== -1 ? String(row[cLocal] ?? "").trim() : "";
    if (cLocal !== -1 && normalizarLocal(localLinha) !== alvo) continue;
    const codigo = cCodigo !== -1 ? String(row[cCodigo] ?? "").trim() : "";
    const produto = cProduto !== -1 ? String(row[cProduto] ?? "").trim() : "";
    if (!codigo && !produto) continue;
    linhas.push({
      local: localLinha,
      sequencial: cSeq !== -1 ? String(row[cSeq] ?? "").trim() : "",
      codigo,
      produto,
      quantidade: cQtd !== -1 ? String(row[cQtd] ?? "").trim() : "",
      dataContratacao: cData !== -1 ? String(row[cData] ?? "").trim() : "",
      prioridade: cPrioridade !== -1 ? String(row[cPrioridade] ?? "").trim() : "",
    });
  }
  if (linhas.length === 0) {
    throw new Error(
      `Nenhum item encontrado no painel do PCA para "${localEntidade}". Confira se a sigla cadastrada para ` +
      `esta entidade bate com o campo LOCAL do painel — ou importe a planilha manualmente.`
    );
  }
  return linhas;
}
