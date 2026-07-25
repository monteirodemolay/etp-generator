/**
 * Conversão do conteúdo dos incisos para o formato interno do Word (OOXML).
 *
 * O editor produz HTML; o Word entende WordprocessingML. Estas funções traduzem
 * tudo que o servidor consegue escrever: negrito, itálico, sublinhado, tachado,
 * títulos, listas, citações e tabelas com células mescladas.
 */

// Unidades do OOXML
export const PT_PARA_EMU = 12700;   // 1 ponto = 12700 EMU (imagens)
export const PT_PARA_TWIP = 20;     // 1 ponto = 20 twips (medidas de página)


export function escXml(txt) {
  return String(txt ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Converte um trecho de texto com a formatação acumulada (negrito, itálico etc.)
export function trecho(texto, fmt) {
  if (!texto) return "";
  const props = [
    fmt.b ? "<w:b/>" : "",
    fmt.i ? "<w:i/>" : "",
    fmt.u ? '<w:u w:val="single"/>' : "",
    fmt.s ? "<w:strike/>" : "",
    `<w:sz w:val="${fmt.sz || 22}"/>`,
  ].join("");
  return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${escXml(texto)}</w:t></w:r>`;
}

// Percorre os nós de um bloco reunindo o texto já formatado
export function trechosDoNo(no, fmt, doc) {
  const TEXTO = 3, ELEMENTO = 1;
  if (no.nodeType === TEXTO) {
    const t = no.nodeValue.replace(/\s+/g, " ");
    return t.trim() === "" && t !== " " ? "" : trecho(t, fmt);
  }
  if (no.nodeType !== ELEMENTO) return "";

  const tag = no.tagName.toLowerCase();
  if (tag === "br") return '<w:r><w:br/></w:r>';

  const novo = { ...fmt };
  if (tag === "b" || tag === "strong") novo.b = true;
  if (tag === "i" || tag === "em") novo.i = true;
  if (tag === "u") novo.u = true;
  if (tag === "s" || tag === "strike" || tag === "del") novo.s = true;

  let saida = "";
  no.childNodes.forEach(f => { saida += trechosDoNo(f, novo, doc); });
  return saida;
}

// Alinhamento declarado no atributo style do elemento
export function alinhamentoDoNo(no, padrao) {
  const estilo = (no.getAttribute && no.getAttribute("style")) || "";
  const m = estilo.match(/text-align:\s*(left|center|right|justify)/i);
  if (!m) return padrao;
  return { left: "left", center: "center", right: "right", justify: "both" }[m[1].toLowerCase()];
}

export function paragrafo(conteudo, { align = "both", espacoDepois = 200, indent = 0, lista = null, estilo = null } = {}) {
  if (!conteudo) conteudo = "";
  const numeracao = lista ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${lista}"/></w:numPr>` : "";
  const rec = indent ? `<w:ind w:left="${indent}"/>` : "";
  const est = estilo ? `<w:pStyle w:val="${estilo}"/>` : "";
  return `<w:p><w:pPr>${est}${numeracao}<w:jc w:val="${align}"/>` +
         `<w:spacing w:after="${espacoDepois}" w:line="276" w:lineRule="auto"/>${rec}</w:pPr>${conteudo}</w:p>`;
}

// Converte uma tabela HTML para tabela do Word
export function tabelaParaOoxml(tabela, larguraTotal) {
  const linhas = [...tabela.querySelectorAll("tr")];
  if (linhas.length === 0) return "";
  const colunas = Math.max(...linhas.map(l => l.querySelectorAll("td,th").length));
  const larguraCol = Math.floor(larguraTotal / colunas);

  const grade = `<w:tblGrid>${Array(colunas).fill(`<w:gridCol w:w="${larguraCol}"/>`).join("")}</w:tblGrid>`;
  const borda = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map(l => `<w:${l} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join("");

  const corpo = linhas.map(linha => {
    const celulas = [...linha.querySelectorAll("td,th")];
    const tds = celulas.map(c => {
      const cabecalho = c.tagName.toLowerCase() === "th";
      const span = parseInt(c.getAttribute("colspan") || "1", 10);
      const conteudo = trechosDoNo(c, { b: cabecalho, sz: 19 }, null)
        || trecho(c.textContent || "", { b: cabecalho, sz: 19 });
      const props = `<w:tcPr><w:tcW w:w="${larguraCol * span}" w:type="dxa"/>` +
        (span > 1 ? `<w:gridSpan w:val="${span}"/>` : "") +
        (cabecalho ? '<w:shd w:val="clear" w:color="auto" w:fill="ECECEC"/>' : "") +
        `</w:tcPr>`;
      return `<w:tc>${props}${paragrafo(conteudo, { align: "left", espacoDepois: 0 })}</w:tc>`;
    }).join("");
    return `<w:tr>${tds}</w:tr>`;
  }).join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="${larguraTotal}" w:type="dxa"/>` +
         `<w:tblBorders>${borda}</w:tblBorders></w:tblPr>${grade}${corpo}</w:tbl>` +
         paragrafo("", { espacoDepois: 120 });
}

// Converte o HTML dos incisos (vindo do editor) para parágrafos do Word
export function htmlParaOoxml(html, larguraTabela = 9070) {
  if (!html || !html.trim()) return "";
  const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, "text/html");
  const raiz = doc.getElementById("raiz");
  let saida = "";

  const blocos = ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "blockquote", "hr"];

  function percorrer(no) {
    no.childNodes.forEach(filho => {
      if (filho.nodeType === 3) {
        const t = filho.nodeValue.trim();
        if (t) saida += paragrafo(trecho(filho.nodeValue.replace(/\s+/g, " "), {}));
        return;
      }
      if (filho.nodeType !== 1) return;
      const tag = filho.tagName.toLowerCase();

      if (tag === "hr") { saida += paragrafo("", { espacoDepois: 120 }); return; }

      if (tag === "table") { saida += tabelaParaOoxml(filho, larguraTabela); return; }

      if (tag === "ul" || tag === "ol") {
        const numId = tag === "ul" ? 1 : 2;
        filho.querySelectorAll("li").forEach(li => {
          saida += paragrafo(trechosDoNo(li, {}, doc), { align: "both", lista: numId, espacoDepois: 80 });
        });
        return;
      }

      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        const tamanhos = { h1: 30, h2: 26, h3: 24, h4: 23, h5: 22, h6: 21 };
        saida += paragrafo(trechosDoNo(filho, { b: true, sz: tamanhos[tag] }, doc),
          { align: alinhamentoDoNo(filho, "left"), espacoDepois: 120 });
        return;
      }

      if (tag === "blockquote") {
        saida += paragrafo(trechosDoNo(filho, { i: true }, doc), { align: "both", indent: 567 });
        return;
      }

      if (blocos.includes(tag)) {
        const conteudo = trechosDoNo(filho, {}, doc);
        if (conteudo) saida += paragrafo(conteudo, { align: alinhamentoDoNo(filho, "both") });
        return;
      }

      // Elemento solto (texto sem bloco em volta) — vira um parágrafo próprio
      const conteudo = trechosDoNo(filho, {}, doc);
      if (conteudo) saida += paragrafo(conteudo);
    });
  }

  percorrer(raiz);
  return saida;
}
