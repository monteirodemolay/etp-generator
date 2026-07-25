/**
 * Geração dos documentos oficiais em .docx.
 *
 * Cada função monta o HTML do documento e entrega ao motor OOXML. O conteúdo
 * jurídico dos textos vem de ../conteudo; aqui fica só a estrutura do papel:
 * o que vem antes, o que vem depois, onde entram os quadros e a assinatura.
 */

import { htmlParaOoxml } from "./ooxml.js";
import { baixarDocx } from "./pacote.js";
import { prepararCabecalho } from "./timbre.js";
import { escapeHtml } from "../dominio/texto.js";
import { fmtDate, fmtDateISO, todayISO } from "../dominio/datas.js";
import { listaResponsaveis, objetoCompleto, linhaAssinaturaData } from "../dominio/etp.js";
import { cruzarComPca } from "../dominio/pca.js";
import { secoesParaRelatorio } from "../dominio/numeracao.js";
import { gerarRelatorioEstimativaHtml } from "../dominio/estimativa.js";


// Gera um documento .doc (HTML compatível com o Word) editável, com o timbre no cabeçalho
// Documento avulso "Demonstração da Previsão da Contratação no PCA" — usa o cruzamento de itens já
// feito na ferramenta "Verificar PCA", independente de qualquer ETP específico.
// Documento avulso "Demonstração da Previsão da Contratação no PCA", em .docx nativo
export async function gerarDocumentoPCAAvulso({ objeto, orgao, cabecalho, linhasTabela }) {
  const cab = await prepararCabecalho(cabecalho);
  const html = `
<h2 style="text-align:center">Demonstração da Previsão da Contratação no Plano de Contratações Anual</h2>
<p>A presente contratação, que visa à "${escapeHtml(objeto)}", destinados a atender às demandas da ${escapeHtml(orgao)}, encontra-se devidamente alinhada aos objetivos estratégicos da Administração Municipal.</p>
<p>O fornecimento desses itens é essencial para o adequado funcionamento das unidades administrativas e operacionais do Município, garantindo suporte às atividades institucionais desenvolvidas no âmbito da Prefeitura, bem como assegurando a continuidade e a eficiência dos serviços públicos prestados.</p>
<p>A demanda encontra-se regularmente prevista no Plano de Contratações Anual (PCA), conforme os sequenciais e respectivos IDs constantes na tabela a seguir, os quais identificam precisamente os itens a serem contratados:</p>
<table>
  <tr><th>Item</th><th>ID</th><th>Descrição</th><th>Sequencial do PCA</th></tr>
  ${linhasTabela}
</table>
<p>Dessa forma, resta evidenciado que a contratação encontra-se compatível com o planejamento anual das contratações, atendendo ao disposto no artigo 12 da Lei nº 14.133/2021, assegurando a adequada vinculação entre a demanda identificada, o Plano de Contratações Anual e a futura contratação.</p>
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center"><i>[DATADO E ASSINADO DIGITALMENTE]</i></p>`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `demonstracao_previsao_pca_${todayISO()}.docx`,
  });
}

// Exporta a Justificativa como .doc, com timbre e assinatura, no mesmo padrão dos demais documentos
// Justificativa de Aquisição em .docx nativo
export async function gerarDocumentoJustificativaWord({ conteudoHtml, cabecalho }) {
  const cab = await prepararCabecalho(cabecalho);
  const html = `
<h2 style="text-align:center">Justificativa</h2>
${conteudoHtml}
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center">Atenciosamente,</p>
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center"><i>[DATADO E ASSINADO DIGITALMENTE]</i></p>`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `justificativa_aquisicao_${todayISO()}.docx`,
  });
}

// Estudo Técnico Preliminar completo, em .docx nativo
export async function gerarDocumentoWord(etp, cabecalho) {
  const cab = await prepararCabecalho(cabecalho);
  const itens = etp.itens || [];
  const pca = etp.pca;
  const responsaveis = listaResponsaveis(etp);
  const resumoResponsaveis = responsaveis.length > 0
    ? responsaveis.map(r => r.nome + (r.cargo ? ` (${r.cargo})` : "")).join("; ")
    : "-";

  const linhasItens = itens.map((it, idx) =>
    `<tr><td>${idx + 1}</td><td>${escapeHtml(it.descricao || "-")}</td><td>${escapeHtml(it.unidade || "")}</td><td>${escapeHtml(String(it.quantidade || "-"))}</td></tr>`
  ).join("");

  const quadroQuantitativos = itens.length > 0
    ? `<h3>Quadro de quantitativos</h3><table><tr><th>Item</th><th>Descrição</th><th>Und.</th><th>Qtd.</th></tr>${linhasItens}</table>`
    : "";

  const linhasPca = pca ? cruzarComPca(itens, pca, etp.manuaisPca).map((m, idx) =>
    `<tr><td>${idx + 1}</td><td>${escapeHtml(m.item.descricao || "-")}</td><td>${m.previsto ? "Sim" : "Não"}</td><td>${escapeHtml(m.sequencial || "—")}</td></tr>`
  ).join("") : "";

  const relatorioEstimativa = gerarRelatorioEstimativaHtml(etp);

  // O quadro de quantitativos acompanha o inciso IV — art. 18, § 1º, IV da
  // Lei nº 14.133/2021 trata das estimativas das quantidades.
  const secoesHtml = secoesParaRelatorio(etp).map(s => `
    <h2 style="text-align:center">${s.numero} — ${escapeHtml(s.titulo)}</h2>
    ${etp.sections[s.id]}
    ${s.id === "II" && pca ? `<h3>Quadro de alinhamento ao PCA</h3><table><tr><th>Item</th><th>Descrição</th><th>Consta no PCA?</th><th>Sequencial</th></tr>${linhasPca}</table>` : ""}
    ${s.id === "IV" ? quadroQuantitativos : ""}
    ${s.id === "VI" ? relatorioEstimativa : ""}
  `).join("");

  const assinaturas = responsaveis.length > 0
    ? responsaveis.map(r =>
        `<p style="text-align:center">&nbsp;</p>
         <p style="text-align:center">_______________________________________</p>
         <p style="text-align:center"><b>${escapeHtml(r.nome)}</b></p>
         ${r.cargo ? `<p style="text-align:center">${escapeHtml(r.cargo)}</p>` : ""}`).join("")
    : `<p style="text-align:center">&nbsp;</p>
       <p style="text-align:center">_______________________________________</p>
       <p style="text-align:center"><b>[Responsável técnico]</b></p>`;

  const html = `
<h1 style="text-align:center">ESTUDO TÉCNICO PRELIMINAR</h1>
<p style="text-align:center"><i>Lei nº 14.133/2021 · art. 18</i></p>
<table>
  <tr><td><b>Objeto</b></td><td>${escapeHtml(objetoCompleto(etp) || "-")}</td></tr>
  <tr><td><b>Órgão</b></td><td>${escapeHtml(etp.meta.orgao || "-")}</td></tr>
  <tr><td><b>Setor</b></td><td>${escapeHtml(etp.meta.setor || "-")}</td></tr>
  <tr><td><b>Responsável</b></td><td>${escapeHtml(resumoResponsaveis)}</td></tr>
  <tr><td><b>Processo</b></td><td>${escapeHtml(etp.meta.processo || "-")}</td></tr>
  <tr><td><b>Data</b></td><td>${fmtDateISO(etp.meta.data) || fmtDate(Date.now())}</td></tr>
</table>
${etp.meta.introducao?.trim() ? `<h2 style="text-align:center">Introdução</h2><p>${escapeHtml(etp.meta.introducao).replace(/\n/g, "<br/>")}</p>` : ""}
${secoesHtml}
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center">${escapeHtml(linhaAssinaturaData(etp))}</p>
${assinaturas}`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `ETP_${(etp.meta.processo || todayISO()).replace(/[^\w-]/g, "_")}.docx`,
  });
}
