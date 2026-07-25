/**
 * Textos-modelo de cada inciso do ETP.
 *
 * Cada função recebe o ETP e devolve o texto já preenchido com os dados que o
 * servidor cadastrou. Nenhuma delas chama serviço externo: o texto é montado
 * aqui, de graça e sem depender de internet.
 *
 * As funções são nomeadas pelo ASSUNTO que redigem, nunca pelo número do
 * inciso. A correspondência com a numeração da lei fica num só lugar, o mapa
 * MODELOS_PADRAO no fim do arquivo. Foi a ausência dessa separação que
 * permitiu que os incisos IV e V ficassem invertidos sem ninguém notar.
 */

import { escapeHtml } from "../dominio/texto.js";
import { num, brl, statsFor } from "../dominio/valores.js";
import { fmtDate } from "../dominio/datas.js";
import { bemOuServicoDe, verboDe, formatarPrazo } from "../dominio/etp.js";
import { contarPrevistosNoPca } from "../dominio/pca.js";

export function modeloDescricaoNecessidade(etp) {
  const entidade = etp.meta.orgao?.trim() || "[órgão]";
  const setor = etp.meta.setor?.trim() || "[setor requisitante]";
  const bem = bemOuServicoDe(etp);
  return `A ${entidade}, por meio do(a) ${setor}, identificou a necessidade de ${verboDe(etp)} dos ${bem} relacionados na Planilha de Itens que integra este Estudo Técnico Preliminar, indispensáveis à continuidade e ao adequado desempenho das atividades institucionais.

[Complete aqui a justificativa concreta da necessidade: qual carência específica motiva esta contratação, quais atividades ou serviços dependem dela, e o que ocorreria caso a contratação não fosse realizada. Esta é a única seção que exige redação própria do servidor responsável, por tratar-se da motivação específica do caso concreto.]

A não realização desta ${verboDe(etp)} comprometeria a regularidade e a qualidade dos serviços prestados por ${entidade}, justificando-se, portanto, a presente contratação como medida necessária ao atendimento do interesse público.`;
}

// Modelo padrão do inciso II (alinhamento ao PCA), sem chamada de IA — usa o resultado do cruzamento
// já feito na etapa "2. Alinhamento ao PCA" (mesmos dados, nenhuma nova ingestão).
export function modeloAlinhamentoPca(etp) {
  const itens = etp.itens || [];
  if (!etp.pca || itens.length === 0) return "";

  const encontrados = contarPrevistosNoPca(etp);
  const total = itens.length;
  const dataImportacao = fmtDate(etp.pca.importedAt);

  let texto = `A presente contratação foi confrontada com o Plano de Contratações Anual (PCA) vigente, a partir da planilha "${etp.pca.nomeArquivo}" (extraída do painel do PCA em ${dataImportacao}). `;

  if (encontrados === total) {
    texto += `Da comparação, verificou-se que a totalidade dos ${total} item(ns) que compõem esta aquisição já consta prevista no PCA, conforme demonstrado no quadro de alinhamento apresentado a seguir.`;
  } else if (encontrados > 0) {
    texto += `Da comparação, verificou-se que ${encontrados} de ${total} item(ns) que compõem esta aquisição já constam previstos no PCA, conforme demonstrado no quadro de alinhamento apresentado a seguir. Os demais ${total - encontrados} item(ns) ainda não constam expressamente no plano vigente, devendo ser objeto de inclusão ou atualização do planejamento, ou de justificativa fundamentada para a exceção, previamente à formalização da contratação, nos termos do art. 12, VII, da Lei nº 14.133/2021.`;
  } else {
    texto += `Da comparação, não foram localizados registros correspondentes aos itens desta aquisição no PCA vigente, conforme demonstrado no quadro de alinhamento apresentado a seguir, devendo ser providenciada a inclusão ou atualização do planejamento, ou apresentada justificativa fundamentada para a exceção, previamente à formalização da contratação, nos termos do art. 12, VII, da Lei nº 14.133/2021.`;
  }

  return texto;
}

export function modeloRequisitos(etp) {
  const bem = bemOuServicoDe(etp);
  const garantia = etp.meta.prazoGarantiaDias?.trim() ? formatarPrazo(etp.meta.prazoGarantiaDias, etp.meta.prazoGarantiaUnidade) : "12 (doze) meses, ou a estipulada no próprio item";
  const entrega = etp.meta.prazoEntregaDias?.trim() ? formatarPrazo(etp.meta.prazoEntregaDias, etp.meta.prazoEntregaUnidade) : "90 (noventa) dias";
  const local = etp.meta.local?.trim() || "[cidade/região da execução do contrato]";
  const entidade = etp.meta.orgao?.trim() || "[órgão/entidade beneficiária]";
  const condicaoEntrega = etp.meta.parcelamento === "sim"
    ? "de forma parcelada, conforme os itens/lotes definidos no inciso VIII deste Estudo"
    : "de forma única e integral, em uma só remessa";

  return `A definição dos requisitos necessários e suficientes para a escolha da solução de ${bem === "serviços" ? "contratação" : "aquisição"} é fundamental para atender à demanda de forma eficaz, segura e vantajosa para a Administração e para a entidade beneficiária.

Os seguintes parâmetros, exigências e referências são elencados, dentre outros aplicáveis ao caso concreto, para garantir a seleção da proposta mais vantajosa:

• Padrões Mínimos de Qualidade: todos os ${bem} devem atender a normas técnicas e padrões de qualidade reconhecidos, com fabricação recente, em perfeitas condições de uso e com durabilidade e eficiência compatíveis com o uso institucional pretendido;
• Especificações Técnicas: cada item deverá atender às especificações técnicas mínimas descritas na Planilha de Itens que integra este Estudo Técnico Preliminar, incluindo capacidade, potência, funcionalidade, acabamento, eficiência energética e demais atributos que garantam funcionalidade e segurança no uso cotidiano;
• Condições de Entrega: os itens deverão ser entregues ${condicaoEntrega}, devidamente embalados, com todos os manuais, acessórios e itens obrigatórios (cabos, suportes, controles etc., quando aplicável), no local indicado pela Administração, no prazo máximo de ${entrega} contados da emissão da ordem de fornecimento ou serviço;
• Certificações e Normas Técnicas Aplicáveis: os itens devem possuir, quando aplicável, certificações de conformidade emitidas por órgãos reguladores como o INMETRO ou equivalente, além de atender às normas da ABNT e demais regulamentações técnicas específicas vigentes para cada tipo de item;
• Licenças e Regularidade da Empresa Fornecedora: a empresa contratada deve comprovar regularidade junto aos órgãos competentes e possuir autorização legal para comercialização ou prestação dos itens ofertados, garantindo que a contratação seja realizada com empresa idônea e devidamente habilitada;
• Critérios de Sustentabilidade: considerando a responsabilidade socioambiental da Administração, serão priorizadas, sempre que possível, propostas de fornecedores que demonstrem compromisso com práticas sustentáveis, incluindo, quando aplicável, equipamentos com selo Procel de eficiência energética e processos de produção e descarte de menor impacto ambiental;
• Garantia e Assistência Técnica: os itens deverão contar com garantia mínima de ${garantia}, contra defeitos de fabricação, e a empresa fornecedora deverá garantir suporte técnico e assistência autorizada ou credenciada em ${local} ou região próxima, assegurando manutenção e eventuais reparos dentro do prazo contratual;
• Formalização de Instrumento Contratual: em razão do valor estimado da contratação e da diversidade dos itens a serem adquiridos, poderá ser exigida a formalização de instrumento contratual específico, nos termos do art. 95, §1º, da Lei nº 14.133/2021, como meio de assegurar a adequada execução, o cumprimento de prazos e obrigações, e a segurança jurídica do processo.

Considerando a natureza desta ${verboDe(etp)}, os itens deverão ser entregues ${condicaoEntrega}, a fim de garantir a continuidade e o pleno funcionamento das atividades desenvolvidas por ${entidade}.`;
}

export function modeloLevantamentoMercado(etp) {
  const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
  const fontesTexto = fontesUsadas.length > 0 ? fontesUsadas.join(", ") : "Banco de Preços, pesquisa direta com fornecedores e demais fontes públicas disponíveis";
  const bem = bemOuServicoDe(etp);
  const entidade = etp.meta.orgao?.trim() || "[órgão/entidade beneficiária]";
  const solucoes = etp.solucoesMercado || [];
  const escolhida = solucoes.find(s => s.selecionada);
  const naoEscolhidas = solucoes.filter(s => !s.selecionada);

  let blocoAlternativas;
  if (solucoes.length > 0) {
    blocoAlternativas = `No processo de avaliação, foram levantadas ${solucoes.length} solução(ões) de mercado para atender à necessidade identificada no inciso I:\n` +
      solucoes.map(s => `• ${s.nome}${s.selecionada ? " — SOLUÇÃO ESCOLHIDA" : ""};`).join("\n") +
      (escolhida
        ? `\n\nEntre as soluções pesquisadas, optou-se por "${escolhida.nome}", por representar, entre as alternativas relacionadas${naoEscolhidas.length > 0 ? " — as demais descartadas por não atenderem tão adequadamente à relação entre custo, qualidade e adequação à necessidade concreta —" : ""}, a que melhor atende à relação entre custo, qualidade e adequação à necessidade identificada no inciso I.`
        : `\n\n[Marque, na lista de soluções acima, qual delas foi escolhida — o texto se completa sozinho.]`);
  } else {
    blocoAlternativas = `No processo de avaliação, as alternativas abaixo foram analisadas, porém não foram consideradas adequadas frente à necessidade concreta de ${entidade}:
• Locação de equipamentos: opção descartada em razão da natureza da fonte de recurso — quando voltada exclusivamente para aquisição definitiva — e da ausência de economicidade a longo prazo, considerando que a locação demandaria custos recorrentes, sem incorporação patrimonial para a entidade executora das ações;
• Aproveitamento de equipamentos existentes: os poucos equipamentos atualmente disponíveis se encontram em estado de obsolescência ou com desempenho insuficiente, sendo incompatíveis com as demandas operacionais e com os parâmetros de eficiência e segurança exigidos;
• Aquisição de itens com menor capacidade técnica ou de uso residencial: descartada por não atenderem às exigências institucionais de uso contínuo, coletivo e intensivo, o que comprometeria a durabilidade e a eficácia dos serviços prestados.

Optou-se pela solução de mercado descrita neste Estudo Técnico Preliminar por representar, entre as alternativas pesquisadas, a que melhor atende à relação entre custo, qualidade e adequação à necessidade identificada no inciso I.

Dica: cadastre as soluções realmente pesquisadas no quadro acima (podem ser 3, 4, 5 ou mais) e marque a escolhida, que este texto se adapta automaticamente a elas.`;
  }

  return `O levantamento de mercado realizado identificou fornecedores e prestadores capazes de atender às especificações constantes da Planilha de Itens deste Estudo Técnico Preliminar, mediante consulta a ${fontesTexto}, cujos resultados fundamentam a estimativa de valor apresentada no inciso VI.

A pesquisa considerou a disponibilidade de mercado, a existência de padrão usual de especificação para os ${bem} pretendidos e a viabilidade de definição objetiva do objeto no instrumento convocatório, nos termos do art. 6º, XLI, e do art. 29 da Lei nº 14.133/2021.

${blocoAlternativas}`;
}

export function modeloEstimativaQuantidades(etp) {
  const itens = etp.itens || [];
  const metodo = etp.meta.metodologiaQuantidades;
  const detalhamento = etp.meta.detalhamentoQuantidades?.trim();

  const basesMetodologicas = {
    historico: "no histórico de consumo ou utilização registrado pela unidade requisitante",
    beneficiarios: "no número de beneficiários ou atendimentos realizados pela unidade, aplicado a um parâmetro técnico de consumo por pessoa/atendimento",
    parametro: "em parâmetro técnico ou normativo aplicável à natureza do objeto",
    substituicao: "na necessidade de substituição de itens que atingiram o fim de sua vida útil ou se encontram em condições inadequadas de uso",
    comparacao: "em comparação com unidades ou órgãos de porte e natureza semelhantes",
  };

  let paragrafoMetodologia;
  if (metodo === "outro" && detalhamento) {
    paragrafoMetodologia = `<p>${escapeHtml(detalhamento)}</p>`;
  } else if (metodo && basesMetodologicas[metodo]) {
    paragrafoMetodologia = `<p>O levantamento quantitativo foi realizado com base ${basesMetodologicas[metodo]}${detalhamento ? `. Especificamente, ${escapeHtml(detalhamento)}` : ""}, observando-se critérios de economicidade e adequação à real necessidade da contratação, sem prejuízo de eventual repactuação em caso de alteração superveniente da demanda.</p>`;
  } else {
    paragrafoMetodologia = `<p>A definição dos quantitativos considerou a demanda identificada pelo setor requisitante, observando-se critérios de economicidade e adequação à real necessidade da contratação, sem prejuízo de eventual repactuação em caso de alteração superveniente da demanda. [Detalhe a metodologia de levantamento — histórico de consumo, número de beneficiários, parâmetro técnico etc. — no campo correspondente em Dados do Processo, que este texto se completa sozinho.]</p>`;
  }

  return `<p>As quantidades estimadas para cada item constam da Planilha de Itens que integra este Estudo Técnico Preliminar, sintetizadas no quadro de quantitativos apresentado a seguir, totalizando ${itens.length} item(ns).</p>
${paragrafoMetodologia}`;
}

// Modelo padrão do inciso VI (metodologia de levantamento de preços), sem chamada de IA —
// texto fixo com lacunas preenchidas automaticamente a partir dos dados já cadastrados no ETP.
// Pode ser reaproveitado em qualquer aquisição; o servidor ajusta manualmente o que for específico do caso.
export function modeloEstimativaValor(etp) {
  const bem = bemOuServicoDe(etp);
  const itemPalavra = bem === "serviços" ? "serviços" : "itens";
  const metodologia = etp.meta.metodologiaCalculo === "media" ? "média aritmética simples" : "mediana";
  const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
  const fontesTexto = fontesUsadas.length > 0 ? fontesUsadas.join(", ") : "";

  return `
<p>Apresenta-se, neste item, o levantamento e a estimativa de custos para a ${verboDe(etp)} dos ${bem} elencados, com o objetivo de fornecer uma projeção financeira detalhada, embasando a gestão eficiente dos recursos públicos vinculados.</p>
<p>Considerando a especificidade dos ${itemPalavra}, procedeu-se à coleta de cotações junto a fornecedores do segmento${fontesTexto ? `, por meio de ${escapeHtml(fontesTexto)}` : ""}.</p>
<p>Os valores levantados por fornecedor, bem como a ${metodologia} apurada para cada item, constam no quadro de estimativa de valores apresentado a seguir, elaborado a partir do levantamento de preços registrado na etapa "4. Levantamento de Preços" deste Estudo Técnico Preliminar.</p>
<p><b>Metodologia de Cálculo:</b></p>
<p>Neste Estudo Técnico Preliminar (ETP), adotou-se a ${metodologia} como método principal de estimativa de valor por item, por refletir de forma clara e objetiva os preços atualmente praticados no mercado, promovendo equilíbrio entre economicidade e exequibilidade da futura contratação.</p>
`.trim();
}

export function modeloSolucaoComoUmTodo(etp) {
  const itens = etp.itens || [];
  const classificacoes = [...new Set(itens.map(i => i.classificacao).filter(Boolean))];
  const bem = bemOuServicoDe(etp);
  const paragrafoManutencao = etp.meta.manutencaoContinuada
    ? `Esta contratação inclui exigência de manutenção, assistência técnica ou fornecimento continuado de peças, cujas condições específicas estão detalhadas nos requisitos técnicos constantes do inciso III deste Estudo.`
    : `Ressalvado o disposto em instrumento contratual específico, esta contratação não inclui, por si só, exigências de manutenção continuada, assistência técnica ou fornecimento de peças além da garantia legal e contratual aplicável aos ${bem} adquiridos.`;
  return `A solução consiste na ${verboDe(etp)} de ${itens.length} item(ns) descrito(s) na Planilha de Itens que integra este Estudo Técnico Preliminar${classificacoes.length ? `, compreendendo ${classificacoes.join(", ").toLowerCase()}` : ""}.

A entrega/execução será realizada em conformidade com o critério de parcelamento definido no inciso VIII deste Estudo, observadas as especificações técnicas de cada item.

${paragrafoManutencao}`;
}

export function modeloParcelamento(etp) {
  if (etp.meta.parcelamento === "nao") {
    return `Considerando a natureza e as características dos itens que compõem esta aquisição, a contratação não será dividida em itens ou lotes distintos, sendo processada como lote único.

Essa opção se justifica pela busca de economia de escala na aquisição, pela unidade técnica e funcional do objeto, e pela ausência de prejuízo à competitividade do certame, nos termos do art. 40, V, "b", da Lei nº 14.133/2021. O fracionamento da contratação, no caso concreto, não traria ganho de competitividade relevante que justificasse a perda de economia de escala e a maior complexidade de gestão contratual decorrente de múltiplos fornecedores.`;
  }
  if (etp.meta.parcelamento === "sim") {
    return `Considerando a natureza e as características dos itens que compõem esta aquisição, a contratação será dividida em itens/lotes distintos.

Essa opção se justifica pela viabilidade técnica e econômica de fornecimento por diferentes fornecedores, o que amplia a competitividade do certame sem perda relevante de economia de escala, nos termos do art. 40, V, "b", da Lei nº 14.133/2021. A divisão observa a natureza heterogênea e/ou a origem diversa dos itens relacionados na Planilha de Itens deste Estudo, sem comprometer a qualidade técnica da execução.`;
  }
  return `Considerando a natureza e as características dos itens que compõem esta aquisição, [a contratação NÃO será dividida em itens/lotes — opção recomendada quando há economia de escala relevante e unidade técnica do objeto / a contratação SERÁ dividida em itens/lotes distintos — opção recomendada quando há viabilidade de fornecimento por múltiplos fornecedores sem perda de economia de escala].

[Complete com a justificativa aplicável ao caso concreto, considerando: economia de escala; unidade técnica ou funcional do objeto; viabilidade técnica e econômica de fornecimento por diferentes fornecedores; eventual risco de fracionamento indevido da despesa, entre outros aspectos pertinentes, nos termos do art. 40, V, "b", da Lei nº 14.133/2021.]

Dica: defina isso rapidamente no campo "Parcelamento" em Dados do Processo, e este texto se completa sozinho.`;
}

export function modeloResultadosPretendidos(etp) {
  const entidade = etp.meta.orgao?.trim() || "[órgão]";
  return `Com a presente contratação, a Administração busca obter, direta e indiretamente, os seguintes resultados: (i) atendimento à necessidade identificada no inciso I deste Estudo Técnico Preliminar, com a disponibilização, em tempo hábil, dos itens necessários ao pleno funcionamento das atividades de ${entidade}; (ii) modernização e padronização dos bens/serviços utilizados, com reflexo positivo na qualidade e na continuidade dos serviços prestados; (iii) uso eficiente dos recursos públicos, mediante planejamento adequado da contratação; (iv) fortalecimento da transparência e da economicidade na gestão dos recursos destinados a ${entidade}.`;
}

export function modeloProvidenciasPrevias(etp) {
  return `Previamente à celebração do contrato, a Administração deverá adotar as seguintes providências: (i) confirmação da disponibilidade orçamentária e financeira para a despesa, nos termos do art. 18, §1º, VI, c/c art. 7º, III, da Lei nº 14.133/2021; (ii) verificação da adequação do espaço físico e das condições de recebimento dos itens, quando aplicável; (iii) designação do(s) servidor(es) responsável(is) pelo recebimento provisório e definitivo, nos termos dos arts. 140 e seguintes da Lei nº 14.133/2021; (iv) demais atos de instrução processual exigidos para a formalização da contratação.`;
}

export function modeloContratacoesCorrelatas(etp) {
  if (etp.meta.correlataExiste && etp.meta.correlataDescricao?.trim()) {
    return `Foi identificada contratação correlata ou interdependente relacionada ao objeto desta contratação: ${etp.meta.correlataDescricao.trim()}.

A execução do objeto deste Estudo Técnico Preliminar deverá ser articulada com a contratação relacionada acima, de modo a garantir a compatibilidade de prazos e a continuidade das ações envolvidas.`;
  }
  return `Não foram identificadas contratações correlatas ou interdependentes que condicionem a execução do objeto desta contratação.

[Caso exista alguma contratação relacionada — por exemplo, obra, serviço de instalação, ou outro fornecimento do qual esta aquisição dependa ou que dependa dela —, marque o campo correspondente em Dados do Processo e descreva-a lá, que este texto se completa sozinho.]`;
}

export function modeloImpactosAmbientais(etp) {
  const bem = bemOuServicoDe(etp);
  if (etp.meta.impactoAmbientalRelevante && etp.meta.impactoAmbientalDescricao?.trim()) {
    return `Considerando a natureza dos ${bem} objeto desta contratação, foi identificado o seguinte impacto ambiental a ser considerado: ${etp.meta.impactoAmbientalDescricao.trim()}.

A Administração observará, no que couber, critérios de sustentabilidade previstos no art. 25, §1º, da Lei nº 14.133/2021, adotando as medidas de mitigação cabíveis para minimizar o impacto identificado.`;
  }
  return `Considerando a natureza dos ${bem} objeto desta contratação, não são esperados impactos ambientais significativos decorrentes de sua aquisição ou execução.

Ainda assim, a Administração observará, no que couber, critérios de sustentabilidade previstos no art. 25, §1º, da Lei nº 14.133/2021, priorizando produtos e embalagens de menor impacto ambiental, bem como a destinação adequada de resíduos e embalagens, quando aplicável.`;
}

export function modeloPosicionamentoConclusivo(etp) {
  const entidade = etp.meta.orgao?.trim() || "[órgão]";
  return `Diante do exposto, com base nos elementos técnicos, jurídicos e econômicos reunidos neste Estudo Técnico Preliminar — descrição da necessidade, alinhamento ao Plano de Contratações Anual, levantamento de mercado, estimativas de quantidade e de valor, análise de alternativas e demais aspectos abordados —, conclui-se pela viabilidade técnica e econômica desta contratação, por se tratar de solução adequada, vantajosa e compatível com o interesse público e com a necessidade identificada por ${entidade}.`;
}

/**
 * Correspondência entre o inciso e o texto-modelo que o redige.
 *
 * Confira contra a Lei nº 14.133/2021, art. 18, § 1º:
 *   IV — estimativas das quantidades
 *   V  — levantamento de mercado
 */
export const MODELOS_PADRAO = {
  I:    modeloDescricaoNecessidade,
  II:   modeloAlinhamentoPca,
  III:  modeloRequisitos,
  IV:   modeloEstimativaQuantidades,   // art. 18, § 1º, IV
  V:    modeloLevantamentoMercado,     // art. 18, § 1º, V
  VI:   modeloEstimativaValor,
  VII:  modeloSolucaoComoUmTodo,
  VIII: modeloParcelamento,
  IX:   modeloResultadosPretendidos,
  X:    modeloProvidenciasPrevias,
  XI:   modeloContratacoesCorrelatas,
  XII:  modeloImpactosAmbientais,
  XIII: modeloPosicionamentoConclusivo,
};

/** Há texto-modelo para este inciso? */
export function temModelo(id) {
  return typeof MODELOS_PADRAO[id] === "function";
}

/** Gera o texto-modelo do inciso, ou string vazia se não houver. */
export function gerarModelo(id, etp) {
  const fn = MODELOS_PADRAO[id];
  return typeof fn === "function" ? fn(etp) : "";
}
