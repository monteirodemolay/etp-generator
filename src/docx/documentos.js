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
import { cruzarComPca, normalizarTexto } from "../dominio/pca.js";
import { secoesParaRelatorio } from "../dominio/numeracao.js";
import { gerarRelatorioEstimativaHtml } from "../dominio/estimativa.js";
import { brl } from "../dominio/valores.js";
import {
  rotuloFonte, calcularEstatisticasCotacoes, totalGeralPesquisa, FONTES_PESQUISA_PRECOS,
} from "../dominio/pesquisa-precos.js";


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

  // O item importado (do Excel/PDF) pode ter uma descrição truncada ou malformatada pela
  // extração; quando ele está vinculado a uma linha do PCA e a descrição de lá diverge da
  // importada, prefere a do PCA — é o texto confiável, digitado direto no painel.
  const matchesPca = pca ? cruzarComPca(itens, pca, etp.manuaisPca) : null;
  function descricaoParaDocumento(it, match) {
    const importada = (it.descricao || "").trim();
    const doPca = (match?.pcaRow?.produto || "").trim();
    if (doPca && normalizarTexto(doPca) !== normalizarTexto(importada)) return doPca;
    return importada || doPca || "-";
  }

  const linhasItens = itens.map((it, idx) =>
    `<tr><td>${idx + 1}</td><td>${escapeHtml(descricaoParaDocumento(it, matchesPca?.[idx]))}</td><td>${escapeHtml(it.unidade || "")}</td><td>${escapeHtml(String(it.quantidade || "-"))}</td></tr>`
  ).join("");

  const quadroQuantitativos = itens.length > 0
    ? `<h3>Quadro de quantitativos</h3><table><tr><th>Item</th><th>Descrição</th><th>Und.</th><th>Qtd.</th></tr>${linhasItens}</table>`
    : "";

  const linhasPca = matchesPca ? matchesPca.map((m, idx) =>
    `<tr><td>${idx + 1}</td><td>${escapeHtml(descricaoParaDocumento(m.item, m))}</td><td>${m.previsto ? "Sim" : "Não"}</td><td>${escapeHtml(m.sequencial || "—")}</td></tr>`
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

// Pesquisa de Preços — documento próprio, em .docx nativo. Reúne os itens
// pesquisados, as cotações de cada um (por fonte, na ordem de preferência
// da IN 65/2021), a metodologia adotada e o preço estimado final.
export async function gerarDocumentoPesquisaPrecos(pesquisa, cabecalho) {
  const cab = await prepararCabecalho(cabecalho);

  const rotuloMetodologia = { media: "Média", mediana: "Mediana", "menor-valor": "Menor valor" }[pesquisa.metodologia] || "Mediana";

  const linhasItens = (pesquisa.itens || []).map(item => {
    const stats = calcularEstatisticasCotacoes(pesquisa.cotacoes?.[item.id]);
    const valorAdotado = Number(pesquisa.valoresAdotados?.[item.id]) || 0;
    const quantidade = Number(item.quantidade) || 0;
    const linhaItem = `
      <tr>
        <td><b>${escapeHtml(item.descricao || "-")}</b></td>
        <td>${escapeHtml(item.unidade || "-")}</td>
        <td>${quantidade}</td>
        <td>${brl(valorAdotado)}</td>
        <td>${brl(valorAdotado * quantidade)}</td>
      </tr>`;

    const cotacoesDoItem = pesquisa.cotacoes?.[item.id] || [];
    const linhasCotacoes = cotacoesDoItem.length === 0
      ? `<tr><td colspan="4"><i>Nenhuma cotação registrada para este item.</i></td></tr>`
      : cotacoesDoItem.map(c => `
        <tr${c.excluida ? ' style="color:#888"' : ""}>
          <td>${escapeHtml(rotuloFonte(c.fonteId))}</td>
          <td>${escapeHtml(c.origem || "-")}</td>
          <td>${brl(Number(c.valor) || 0)}</td>
          <td>${c.excluida ? `Excluída — ${escapeHtml(c.justificativaExclusao || "sem justificativa registrada")}` : "Considerada"}</td>
        </tr>`).join("");

    return `
      ${linhaItem}
      <tr><td colspan="5">
        <table>
          <tr><th>Fonte</th><th>Origem / empresa</th><th>Valor</th><th>Situação</th></tr>
          ${linhasCotacoes}
        </table>
        <p style="font-size:10pt">${stats.n} cotação(ões) válida(s) · Mediana: ${brl(stats.mediana)} · Média: ${brl(stats.media)}</p>
      </td></tr>`;
  }).join("");

  const fontesUsadas = [...new Set(Object.values(pesquisa.cotacoes || {}).flat().map(c => c.fonteId))]
    .sort((a, b) => (FONTES_PESQUISA_PRECOS.find(f => f.id === a)?.ordem || 99) - (FONTES_PESQUISA_PRECOS.find(f => f.id === b)?.ordem || 99));

  const html = `
<h1 style="text-align:center">PESQUISA DE PREÇOS</h1>
<p style="text-align:center"><i>Lei nº 14.133/2021 · art. 23</i></p>
<table>
  <tr><td><b>Objeto</b></td><td>${escapeHtml(pesquisa.objeto || "-")}</td></tr>
  <tr><td><b>Órgão</b></td><td>${escapeHtml(pesquisa.orgao || "-")}</td></tr>
  <tr><td><b>Processo</b></td><td>${escapeHtml(pesquisa.numeroProcesso || "-")}</td></tr>
  <tr><td><b>Responsável</b></td><td>${escapeHtml(pesquisa.responsavelNome || "-")}${pesquisa.responsavelCargo ? ` — ${escapeHtml(pesquisa.responsavelCargo)}` : ""}</td></tr>
  <tr><td><b>Data</b></td><td>${fmtDateISO(pesquisa.dataElaboracao) || fmtDate(Date.now())}</td></tr>
</table>

<h2>Fontes consultadas</h2>
${fontesUsadas.length > 0
  ? `<ul>${fontesUsadas.map(id => `<li>${escapeHtml(rotuloFonte(id))}</li>`).join("")}</ul>`
  : "<p><i>Nenhuma fonte registrada ainda.</i></p>"}

<h2>Metodologia de cálculo</h2>
<p>Preço estimado adotado com base em: <b>${rotuloMetodologia}</b> das cotações válidas por item.</p>
${pesquisa.justificativaMetodologia?.trim() ? `<p>${escapeHtml(pesquisa.justificativaMetodologia).replace(/\n/g, "<br/>")}</p>` : ""}

<h2>Itens pesquisados</h2>
<table>
  <tr><th>Item</th><th>Unidade</th><th>Quantidade</th><th>Valor unitário adotado</th><th>Valor total</th></tr>
  ${linhasItens}
</table>

<p style="text-align:right"><b>Valor total estimado: ${brl(totalGeralPesquisa(pesquisa))}</b></p>

<p style="text-align:center">&nbsp;</p>
<p style="text-align:center">_______________________________________</p>
<p style="text-align:center"><b>${escapeHtml(pesquisa.responsavelNome || "[Responsável técnico]")}</b></p>
${pesquisa.responsavelCargo ? `<p style="text-align:center">${escapeHtml(pesquisa.responsavelCargo)}</p>` : ""}`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `pesquisa_precos_${(pesquisa.numeroProcesso || todayISO()).replace(/[^\w-]/g, "_")}.docx`,
  });
}

// Termo de Ateste da Nota Fiscal — documento formal certificando que o
// produto/serviço descrito na nota foi recebido e conferido, pra instruir
// o processo de pagamento. Só gerado depois que a nota já foi atestada
// no sistema (o registro em si é o que vale; isto é só a versão impressa).
export async function gerarTermoAtestoNotaFiscal(of, nota, cabecalho) {
  const cab = await prepararCabecalho(cabecalho);
  if (!nota.atestado) throw new Error("Esta Nota Fiscal ainda não foi atestada.");

  const html = `
<h1 style="text-align:center">TERMO DE ATESTE DE NOTA FISCAL</h1>
<p style="text-align:center"><i>Lei nº 14.133/2021</i></p>
<table>
  <tr><td><b>Ordem de Fornecimento</b></td><td>nº ${escapeHtml(of.numeroOf)}</td></tr>
  <tr><td><b>Fornecedor</b></td><td>${escapeHtml(of.empresa || "-")} — CNPJ ${escapeHtml(of.cnpj || "-")}</td></tr>
  <tr><td><b>Nota Fiscal</b></td><td>${escapeHtml(nota.nomeArquivo)}${nota.numeroNF ? ` — nº ${escapeHtml(nota.numeroNF)}` : ""}</td></tr>
  ${nota.valorNF ? `<tr><td><b>Valor</b></td><td>${escapeHtml(nota.valorNF)}</td></tr>` : ""}
  <tr><td><b>Anexada em</b></td><td>${fmtDate(nota.anexadoEm)}</td></tr>
</table>

<p>Atesto, para os devidos fins, que o objeto descrito na Nota Fiscal acima foi recebido e conferido,
correspondendo ao que foi efetivamente entregue no âmbito da Ordem de Fornecimento indicada, estando apto
para prosseguimento do processo de pagamento.</p>

${nota.atestado.observacao?.trim() ? `<p><b>Observação:</b> ${escapeHtml(nota.atestado.observacao)}</p>` : ""}

<p style="text-align:center">&nbsp;</p>
<p style="text-align:right">${fmtDate(nota.atestado.quando)}</p>
<p style="text-align:center">&nbsp;</p>
<p style="text-align:center">_______________________________________</p>
<p style="text-align:center"><b>${escapeHtml(nota.atestado.nomeAtestador || "[Responsável]")}</b></p>
<p style="text-align:center">${escapeHtml(nota.atestado.cargoAtestador || "")}</p>`;

  baixarDocx({
    corpoOoxml: htmlParaOoxml(html),
    cabecalho: cab,
    nomeArquivo: `atesto_nf_OF-${of.numeroOf}_${(nota.numeroNF || nota.id).replace(/[^\w-]/g, "_")}.docx`,
  });
}
