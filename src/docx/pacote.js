/**
 * Montagem do pacote .docx.
 *
 * O arquivo é um ZIP com uma estrutura fixa de partes XML que se referenciam
 * entre si. Um detalhe importante: o cabeçalho só pode ser DECLARADO quando
 * existe de fato — declarar um cabeçalho inexistente faz o Word recusar o
 * arquivo como corrompido.
 */

import { criarZip, textoParaBytes } from "./zip.js";
import { PT_PARA_EMU, PT_PARA_TWIP, htmlParaOoxml } from "./ooxml.js";


// ---------- Montagem do pacote .docx ----------
export function xmlContentTypes(temImagem) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>${temImagem ? `
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="jpg" ContentType="image/jpeg"/>` : ""}
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
</Types>`;
}

const XML_RELS_RAIZ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const XML_ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/>
</w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

// Duas listas: marcadores e numerada
const XML_NUMERACAO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">
<w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0">
<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;

// Cabeçalho: imagem, texto em HTML, ou vazio
export function xmlCabecalho(cabecalho) {
  let conteudo;
  if (cabecalho?.tipo === "imagem" && cabecalho.tamanho) {
    const cx = Math.round(cabecalho.tamanho.largura * PT_PARA_EMU);
    const cy = Math.round(cabecalho.tamanho.altura * PT_PARA_EMU);
    conteudo = `<w:p><w:pPr><w:jc w:val="center"/>
<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="000000"/></w:pBdr></w:pPr>
<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Timbre"/>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="timbre"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  } else if (cabecalho?.tipo === "texto" && cabecalho.html) {
    conteudo = htmlParaOoxml(cabecalho.html).replace(/<w:jc w:val="both"\/>/g, '<w:jc w:val="center"/>')
      + `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>
<w:spacing w:after="0"/></w:pPr></w:p>`;
  } else {
    conteudo = `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">${conteudo}</w:hdr>`;
}

// Documento principal, com a definição de página e a referência ao cabeçalho
export function xmlDocumento(corpoOoxml, margemTopoPt) {
  const tw = pt => Math.round(pt * PT_PARA_TWIP);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${corpoOoxml}
<w:sectPr>
<w:headerReference w:type="default" r:id="rId10"/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="${tw(margemTopoPt)}" w:right="${tw(72)}" w:bottom="${tw(72)}" w:left="${tw(72)}"
 w:header="${tw(35.4)}" w:footer="${tw(35.4)}" w:gutter="0"/>
</w:sectPr></w:body></w:document>`;
}

// Converte um data URL em bytes
export function dataUrlParaBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function extensaoDoDataUrl(dataUrl) {
  const m = /^data:image\/(png|jpe?g)/i.exec(dataUrl || "");
  if (!m) return "png";
  return m[1].toLowerCase() === "jpg" ? "jpeg" : m[1].toLowerCase();
}

// Ponto de entrada: monta e baixa o .docx
export function baixarDocx({ corpoOoxml, cabecalho, nomeArquivo }) {
  const temImagem = cabecalho?.tipo === "imagem" && cabecalho.dataUrl;
  const ext = temImagem ? extensaoDoDataUrl(cabecalho.dataUrl) : "png";

  const margemTopo = cabecalho?.tipo === "imagem" && cabecalho.tamanho
    ? Math.max(72, 35.4 + cabecalho.tamanho.altura + 24)
    : cabecalho?.tipo === "texto" ? 108 : 72;

  const arquivos = [
    { nome: "[Content_Types].xml", dados: textoParaBytes(xmlContentTypes(temImagem)) },
    { nome: "_rels/.rels", dados: textoParaBytes(XML_RELS_RAIZ) },
    { nome: "word/document.xml", dados: textoParaBytes(xmlDocumento(corpoOoxml, margemTopo)) },
    { nome: "word/styles.xml", dados: textoParaBytes(XML_ESTILOS) },
    { nome: "word/numbering.xml", dados: textoParaBytes(XML_NUMERACAO) },
    { nome: "word/header1.xml", dados: textoParaBytes(xmlCabecalho(cabecalho)) },
    { nome: "word/_rels/document.xml.rels", dados: textoParaBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId11" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId12" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`) },
    { nome: "word/_rels/header1.xml.rels", dados: textoParaBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${temImagem ? `
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.${ext}"/>` : ""}
</Relationships>`) },
  ];

  if (temImagem) {
    arquivos.push({ nome: `word/media/image1.${ext}`, dados: dataUrlParaBytes(cabecalho.dataUrl) });
  }

  const zip = criarZip(arquivos);
  const blob = new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
