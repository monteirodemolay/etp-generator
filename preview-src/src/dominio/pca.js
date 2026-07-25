/**
 * Cruzamento dos itens da contratação com o Plano de Contratações Anual.
 *
 * O vínculo é feito pelo código do produto. Como o Excel entrega o mesmo código
 * ora como texto, ora como número, às vezes com espaço rígido ou zeros à
 * esquerda, a comparação precisa ser tolerante a essas variações — do
 * contrário códigos iguais deixam de casar.
 *
 * Quando o código do item no Centi difere do código no PCA, o servidor vincula
 * manualmente a linha correta; esse vínculo entra aqui como "manuais".
 */

// Cruza um item da Planilha de Itens com as linhas do PCA — por código (Sistema Centi) e, na falta dele, por descrição
// Normaliza um código para comparação: o Excel ora entrega texto, ora número, às vezes com
// espaço rígido ou zeros à esquerda. Sem isso, códigos iguais deixam de casar.
export function normalizarCodigo(v) {
  return String(v ?? "").replace(/[\s\u00A0]/g, "").trim();
}

// Dois códigos são o mesmo se batem exatamente ou se só diferem por zeros à esquerda
export function mesmoCodigo(a, b) {
  const x = normalizarCodigo(a), y = normalizarCodigo(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const semZeros = t => t.replace(/^0+/, "") || "0";
  return /^\d+$/.test(x) && /^\d+$/.test(y) && semZeros(x) === semZeros(y);
}

export function pcaMatchFor(item, pcaLinhas) {
  if (!pcaLinhas || pcaLinhas.length === 0) return null;
  if (item.idProduto) {
    const porCodigo = pcaLinhas.find(l => mesmoCodigo(l.codigo, item.idProduto));
    if (porCodigo) return porCodigo;
  }
  if (item.descricao) {
    const alvo = item.descricao.trim().toLowerCase();
    const porDescricao = pcaLinhas.find(l => l.produto && l.produto.trim().toLowerCase() === alvo);
    if (porDescricao) return porDescricao;
  }
  return null;
}

// Busca linhas do PCA por código ou por parte da descrição. Usada para vincular manualmente
// um item cujo código no Centi é diferente do código no PCA.
export function buscarNoPca(pca, termo, limite = 8) {
  const t = String(termo || "").trim().toLowerCase();
  if (!pca?.linhas || t.length < 2) return [];
  const porCodigo = [];
  const porTexto = [];
  for (const l of pca.linhas) {
    const cod = (l.codigo || "").toLowerCase();
    const prod = (l.produto || "").toLowerCase();
    const seq = (l.sequencial || "").toLowerCase();
    if (mesmoCodigo(cod, t) || mesmoCodigo(seq, t)) porCodigo.unshift(l);  // correspondência exata primeiro
    else if (cod.startsWith(t) || seq.startsWith(t)) porCodigo.push(l);
    else if (prod.includes(t)) porTexto.push(l);
    if (porCodigo.length + porTexto.length > limite * 3) break;
  }
  return [...porCodigo, ...porTexto].slice(0, limite);
}

// Linha do PCA correspondente a um código informado (usada para mostrar o produto ao digitar)
export function linhaPcaPorCodigo(pca, codigo) {
  if (!normalizarCodigo(codigo) || !pca?.linhas) return null;
  return pca.linhas.find(l => mesmoCodigo(l.codigo, codigo)) || null;
}

// Cruza os itens com a planilha do PCA. Além da correspondência automática por código,
// considera os códigos que o servidor preencheu à mão para itens previstos de outra forma.
export function cruzarComPca(itens, pca, manuais = {}) {
  return (itens || []).map(it => {
    const automatico = pca ? pcaMatchFor(it, pca.linhas) : null;
    const manual = !automatico ? (manuais[it.id] || null) : null;

    // Vínculo manual: o servidor apontou qual linha do PCA corresponde a este item, seja
    // escolhendo pelo código do PCA (que pode ser diferente do código do Centi), seja
    // digitando o sequencial direto.
    const linhaVinculada = manual?.codigoPca ? linhaPcaPorCodigo(pca, manual.codigoPca) : null;
    const sequencialManual = linhaVinculada?.sequencial || manual?.sequencial?.trim() || null;

    const pcaRow = automatico || linhaVinculada;
    return {
      item: it,
      pcaRow,
      automatico: !!automatico,
      manual,
      linhaVinculada,
      previsto: !!(automatico || sequencialManual),
      sequencial: automatico ? (automatico.sequencial || "—") : sequencialManual,
      codigo: automatico
        ? (it.idProduto || "-")
        : (manual?.codigoPca?.trim() || manual?.codigo?.trim() || it.idProduto || "-"),
      produtoPca: automatico?.produto || linhaVinculada?.produto || null,
    };
  });
}

// Quantos itens do ETP estão previstos no PCA (incluindo os preenchidos manualmente)
export function contarPrevistosNoPca(etp) {
  return cruzarComPca(etp.itens, etp.pca, etp.manuaisPca).filter(m => m.previsto).length;
}
