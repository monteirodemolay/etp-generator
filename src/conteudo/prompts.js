/**
 * Textos de contexto para uso em ferramentas de IA externas.
 *
 * O aplicativo NÃO chama serviço de IA. Estes textos são montados aqui, com os
 * dados do ETP, para o servidor revisar, copiar e colar numa ferramenta
 * gratuita de sua escolha — trazendo depois a resposta para o campo do inciso.
 *
 * A numeração segue a Lei nº 14.133/2021, art. 18, § 1º:
 *   IV — estimativas das quantidades
 *   V  — levantamento de mercado
 */

import { formatarPrazo } from "../dominio/etp.js";

import { escapeHtml } from "../dominio/texto.js";
import { brl, num, statsFor, valorTotalEtp } from "../dominio/valores.js";
import { fmtDate } from "../dominio/datas.js";
import { bemOuServicoDe, verboDe, objetoCompleto, listaResponsaveis } from "../dominio/etp.js";
import { cruzarComPca, contarPrevistosNoPca } from "../dominio/pca.js";
import { SECOES } from "./incisos.js";



export const PROMPTS_POR_TOPICO = {
  I: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, jurisprudência do TCU, Tribunais de Contas e boas práticas de planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Descrição da Necessidade" do Estudo Técnico Preliminar (ETP).

Objetivo do estudo
Elaborar um diagnóstico técnico detalhado que demonstre a necessidade administrativa que motivou a contratação, evidenciando o problema existente, os impactos decorrentes da ausência da contratação e a motivação para atendimento do interesse público.

Considere exclusivamente as informações fornecidas pelo usuário.

O estudo deverá:
• contextualizar a realidade administrativa;
• identificar o problema que se pretende solucionar;
• demonstrar as consequências da não contratação;
• demonstrar quem será beneficiado pela contratação;
• evidenciar a relação entre a necessidade e as atividades desempenhadas pelo órgão;
• explicar como a contratação contribuirá para a continuidade, eficiência e melhoria dos serviços públicos;
• demonstrar o interesse público envolvido;
• justificar tecnicamente a necessidade da contratação.

O texto deve possuir linguagem formal, técnica, impessoal e compatível com processos administrativos.
Não utilize listas.
Não faça recomendações.
Não cite artigos da lei, salvo quando solicitado.
Produza texto completo, robusto e pronto para integrar diretamente o ETP.`,

  II: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Alinhamento ao Plano de Contratações Anual (PCA)" do Estudo Técnico Preliminar.

Analise as informações fornecidas e elabore um estudo demonstrando se a contratação está prevista no Plano de Contratações Anual ou, quando não estiver, apresente justificativa técnica para sua realização.

O estudo deverá abordar:
• alinhamento com o planejamento estratégico do órgão;
• compatibilidade com o Plano de Contratações Anual;
• integração com os objetivos institucionais;
• relação da contratação com políticas públicas desenvolvidas pelo órgão;
• atendimento ao princípio do planejamento;
• atendimento ao interesse público;
• justificativa para eventual inexistência no PCA;
• impactos administrativos decorrentes da contratação.

A redação deve demonstrar que a contratação decorre de planejamento administrativo e atende às necessidades institucionais.
Produza texto técnico, completo, robusto e pronto para integrar o ETP.`,

  III: `Você é especialista em especificações técnicas de contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Requisitos da Contratação" do Estudo Técnico Preliminar.

Com base nas informações fornecidas, identifique e descreva todos os requisitos necessários para que a futura contratação atenda adequadamente à necessidade administrativa.

O estudo deverá contemplar, quando aplicável:
• requisitos técnicos;
• requisitos funcionais;
• requisitos operacionais;
• requisitos de desempenho;
• requisitos mínimos de qualidade;
• requisitos de segurança;
• requisitos legais;
• requisitos normativos;
• requisitos ambientais;
• requisitos de sustentabilidade;
• requisitos de garantia;
• requisitos de assistência técnica;
• requisitos de instalação;
• requisitos de treinamento;
• requisitos de manutenção;
• requisitos de entrega;
• requisitos de logística;
• requisitos relacionados à durabilidade;
• requisitos relacionados à compatibilidade com soluções existentes.

Explique tecnicamente a necessidade de cada requisito apresentado.
Evite apenas listar características.
Justifique por que cada requisito é indispensável para o atendimento da necessidade administrativa.
Produza texto técnico, detalhado, coeso e pronto para integrar diretamente o Estudo Técnico Preliminar.`,

  IV: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Estimativa das Quantidades" do Estudo Técnico Preliminar.

Objetivo do estudo
Demonstrar tecnicamente como foram definidas as quantidades necessárias para atendimento da demanda administrativa, evidenciando que os quantitativos decorrem de critérios objetivos, estudos prévios e necessidade efetiva da Administração.

Com base nas informações fornecidas pelo usuário, desenvolva um estudo abordando, sempre que aplicável:
• metodologia utilizada para definição das quantidades;
• memória de cálculo utilizada;
• histórico de consumo;
• séries históricas;
• número de usuários atendidos;
• expansão ou redução da demanda;
• consumo médio;
• capacidade operacional;
• sazonalidade;
• previsão de crescimento institucional;
• perdas naturais;
• estoque existente;
• estoque mínimo;
• margem de segurança;
• critérios técnicos adotados.

Explique de forma fundamentada por que as quantidades estimadas representam o necessário ao atendimento da demanda, evitando tanto o subdimensionamento quanto o superdimensionamento da contratação.
Quando houver quantitativos apresentados pelo usuário, incorpore-os ao texto de forma natural.
Jamais invente quantidades.
Caso os quantitativos não sejam informados, elabore o estudo utilizando fundamentação técnica genérica.
Produza texto robusto, detalhado e pronto para integrar o ETP.`,

  V: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, das boas práticas do Tribunal de Contas da União (TCU), dos Tribunais de Contas Estaduais e do planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Levantamento de Mercado" do Estudo Técnico Preliminar (ETP).

Objetivo do estudo
Realizar uma análise técnica das alternativas disponíveis no mercado capazes de atender à necessidade administrativa, demonstrando que a solução escolhida decorre de avaliação comparativa, fundamentada e orientada pela busca da proposta mais vantajosa para a Administração Pública.

Com base exclusivamente nas informações fornecidas pelo usuário, desenvolva um estudo que contemple, sempre que aplicável:
• identificação das soluções existentes no mercado;
• modalidades de fornecimento ou execução disponíveis;
• tecnologias, metodologias ou modelos de atendimento existentes;
• comparação entre diferentes soluções sob os aspectos técnicos, operacionais, econômicos e administrativos;
• vantagens e limitações de cada alternativa identificada;
• análise da maturidade das soluções disponíveis;
• avaliação da compatibilidade das alternativas com a realidade da Administração;
• justificativa técnica para eventual descarte das demais soluções avaliadas;
• demonstração das razões que tornam a solução escolhida a mais adequada ao atendimento da necessidade administrativa.

Sempre que houver informações suficientes, demonstre que foram considerados critérios de eficiência, economicidade, qualidade, desempenho, sustentabilidade, facilidade de manutenção, disponibilidade no mercado, prazo de atendimento, capacidade operacional e custo-benefício.

O texto deverá evidenciar que houve efetivo estudo de mercado, e não mera indicação da solução pretendida.
Não utilize listas na resposta final.
Produza texto técnico, analítico, robusto e pronto para integrar diretamente o Estudo Técnico Preliminar.`,

  VI: `Você é especialista em orçamento estimativo nas contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Estimativa do Valor da Contratação" do Estudo Técnico Preliminar.

Objetivo do estudo
Demonstrar que a estimativa financeira da contratação foi elaborada mediante critérios técnicos, observando as práticas de pesquisa de preços, compatibilidade com o mercado e obtenção da proposta mais vantajosa para a Administração.

Desenvolva um estudo abordando, quando aplicável:
• metodologia utilizada para estimativa de preços;
• parâmetros utilizados;
• fontes de pesquisa;
• preços públicos;
• contratações similares;
• painéis de preços;
• fornecedores;
• bancos oficiais;
• composição dos custos;
• adequação dos valores ao mercado;
• atualização monetária, quando pertinente;
• compatibilidade entre preço e solução escolhida;
• confiabilidade da pesquisa de preços;
• análise da razoabilidade dos valores.

Caso o usuário forneça o valor estimado, explique tecnicamente sua composição e adequação.
Caso não forneça valores, produza texto genérico, sem inventar preços.
O estudo deverá demonstrar que o orçamento estimado representa referência confiável para a futura contratação.
Produza texto técnico, completo e pronto para integrar o Estudo Técnico Preliminar.`,

  VII: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Descrição da Solução como um Todo" do Estudo Técnico Preliminar.

Objetivo do estudo
Descrever detalhadamente a solução escolhida para atendimento da necessidade administrativa, demonstrando que ela representa a alternativa tecnicamente mais adequada dentre aquelas avaliadas.

Com base nas informações fornecidas, desenvolva um estudo contemplando, quando aplicável:
• descrição completa da solução;
• funcionamento da solução;
• integração entre bens, serviços ou obras;
• ciclo de vida da solução;
• forma de execução;
• requisitos técnicos;
• requisitos operacionais;
• logística;
• manutenção;
• assistência técnica;
• garantias;
• treinamento;
• fornecimento;
• instalação;
• suporte;
• desempenho esperado;
• compatibilidade com a estrutura existente;
• ganhos operacionais;
• eficiência administrativa;
• economicidade;
• sustentabilidade.

Explique como todos os componentes se integram para atender plenamente à necessidade administrativa.
Justifique por que a solução é considerada suficiente, adequada e vantajosa.
O texto deverá representar uma visão sistêmica da contratação.
Produza texto técnico, analítico e robusto.`,

  VIII: `Você é especialista em Licitações Públicas.

Sua tarefa é elaborar exclusivamente o tópico "Justificativa do Parcelamento" do Estudo Técnico Preliminar.

Objetivo do estudo
Analisar tecnicamente a viabilidade do parcelamento ou não da contratação, demonstrando os impactos da decisão sobre a competitividade, economicidade, eficiência contratual e interesse público.

Desenvolva estudo abordando:
• possibilidade técnica de divisão do objeto;
• natureza do objeto;
• unidade funcional;
• economia de escala;
• especialização dos fornecedores;
• ampliação da competitividade;
• gerenciamento contratual;
• riscos operacionais;
• custos administrativos;
• impactos sobre a execução;
• viabilidade logística;
• eficiência da fiscalização;
• vantajosidade para a Administração.

Caso o usuário informe que haverá parcelamento, fundamente tecnicamente essa decisão.
Caso informe que não haverá parcelamento, demonstre por que a execução conjunta representa a alternativa mais vantajosa.
Não apenas afirme a conclusão.
Explique todo o raciocínio técnico que levou à decisão.
Produza texto robusto, fundamentado e pronto para integrar o ETP.`,

  IX: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, das boas práticas do Tribunal de Contas da União (TCU), dos Tribunais de Contas Estaduais e do planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Resultados Pretendidos" do Estudo Técnico Preliminar (ETP).

Objetivo do estudo
Demonstrar, de forma técnica e fundamentada, quais benefícios institucionais serão alcançados com a contratação, evidenciando os ganhos esperados para a Administração Pública, para os usuários dos serviços públicos e para o interesse público.

Com base exclusivamente nas informações fornecidas pelo usuário, desenvolva um estudo que contemple, sempre que aplicável:
• solução integral da necessidade administrativa;
• melhoria da qualidade dos serviços prestados;
• aumento da eficiência administrativa;
• redução de falhas operacionais;
• continuidade dos serviços públicos;
• melhoria dos processos internos;
• otimização dos recursos públicos;
• redução de desperdícios;
• racionalização de custos;
• incremento da produtividade;
• melhoria do atendimento ao cidadão;
• redução de riscos administrativos;
• fortalecimento da governança;
• atendimento às políticas públicas;
• sustentabilidade econômica, ambiental e social;
• maior segurança operacional;
• aumento da confiabilidade da solução contratada.

Explique de que forma a contratação contribuirá para o alcance dos objetivos institucionais, demonstrando sua relevância para a Administração Pública.
Não apresente apenas expectativas genéricas. Desenvolva uma análise técnica consistente, relacionando os resultados pretendidos às características da solução escolhida.
O texto deve possuir linguagem formal, técnica, impessoal e estar pronto para integrar diretamente o Estudo Técnico Preliminar.`,

  X: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Providências Prévias à Contratação" do Estudo Técnico Preliminar.

Objetivo do estudo
Identificar todas as medidas administrativas, operacionais, técnicas e organizacionais que deverão ser adotadas pela Administração antes da celebração do futuro contrato, garantindo condições adequadas para sua execução.

Com base nas informações fornecidas pelo usuário, desenvolva um estudo contemplando, sempre que aplicável:
• designação de gestor e fiscais do contrato;
• capacitação dos servidores envolvidos;
• adequação da infraestrutura física;
• adequação tecnológica;
• preparação dos locais de entrega ou execução;
• elaboração do Termo de Referência ou Projeto Básico;
• definição dos mecanismos de fiscalização;
• organização dos fluxos administrativos;
• definição das responsabilidades das unidades envolvidas;
• disponibilidade orçamentária;
• disponibilidade financeira;
• cronograma de implantação;
• compatibilização com contratos existentes;
• obtenção de licenças, autorizações ou documentos necessários;
• outras providências indispensáveis ao sucesso da contratação.

Explique tecnicamente por que cada providência é necessária para garantir a adequada execução contratual, a eficiência administrativa e a mitigação de riscos.
Caso não existam providências específicas, fundamente tecnicamente essa conclusão.
Produza texto completo, robusto e pronto para integrar o Estudo Técnico Preliminar.`,

  XI: `Você é especialista em planejamento das contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Contratações Correlatas e/ou Interdependentes" do Estudo Técnico Preliminar.

Objetivo do estudo
Analisar a existência de outras contratações que possuam relação técnica, operacional, logística, financeira ou funcional com o objeto pretendido, demonstrando eventual dependência entre elas ou a inexistência dessa relação.

Com base nas informações fornecidas pelo usuário, desenvolva um estudo contemplando, quando aplicável:
• contratos vigentes relacionados;
• futuras contratações necessárias;
• fornecimentos complementares;
• serviços acessórios;
• obras relacionadas;
• equipamentos compatíveis;
• sistemas integrados;
• contratos de manutenção;
• contratos de suporte;
• dependência operacional entre objetos;
• necessidade de integração entre soluções;
• riscos decorrentes da inexistência de contratações correlatas;
• independência da solução, quando for o caso.

Explique tecnicamente se a contratação depende da existência de outros contratos ou se possui autonomia operacional.
Caso não existam contratações correlatas ou interdependentes, justifique tecnicamente essa conclusão.
O texto deverá demonstrar análise efetiva da integração da contratação com os demais instrumentos administrativos do órgão.
Produza texto técnico, consistente e pronto para integrar o ETP.`,

  XII: `Você é especialista em sustentabilidade aplicada às contratações públicas.

Sua tarefa é elaborar exclusivamente o tópico "Possíveis Impactos Ambientais" do Estudo Técnico Preliminar.

Objetivo do estudo
Analisar os possíveis impactos ambientais decorrentes da futura contratação, bem como as medidas destinadas à prevenção, mitigação ou compensação desses impactos, observando os princípios do desenvolvimento nacional sustentável.

Com base nas informações fornecidas pelo usuário, desenvolva estudo contemplando, quando aplicável:
• consumo de recursos naturais;
• eficiência energética;
• consumo de água;
• geração de resíduos;
• descarte de materiais;
• logística reversa;
• reciclagem;
• reutilização de materiais;
• redução de emissão de poluentes;
• redução da geração de resíduos sólidos;
• durabilidade dos materiais;
• utilização de produtos sustentáveis;
• certificações ambientais;
• conformidade com normas ambientais;
• mitigação dos impactos ambientais;
• boas práticas ambientais;
• responsabilidade socioambiental.

Sempre que houver possibilidade, demonstre que a contratação poderá contribuir para a adoção de práticas sustentáveis pela Administração Pública.
Caso a contratação não gere impactos ambientais relevantes, apresente fundamentação técnica que justifique essa conclusão.
Produza texto técnico, robusto, fundamentado e pronto para integrar o Estudo Técnico Preliminar.`,

  XIII: `Você é especialista em Licitações e Contratos Administrativos, com profundo conhecimento da Lei nº 14.133/2021, do planejamento das contratações públicas, da governança pública e das boas práticas adotadas pelos órgãos de controle.

Sua tarefa é elaborar exclusivamente o tópico "Posicionamento Conclusivo" do Estudo Técnico Preliminar.

Objetivo do estudo
Elaborar a conclusão técnica do Estudo Técnico Preliminar, consolidando todas as análises realizadas ao longo do documento e apresentando manifestação fundamentada acerca da viabilidade da contratação pretendida.

Com base exclusivamente nas informações fornecidas pelo usuário e nas conclusões dos demais tópicos do ETP, desenvolva um parecer técnico conclusivo que contemple, sempre que aplicável:
• confirmação da existência da necessidade administrativa;
• demonstração de que as alternativas disponíveis foram avaliadas;
• justificativa da solução escolhida;
• demonstração da viabilidade técnica;
• demonstração da viabilidade operacional;
• demonstração da viabilidade econômica;
• demonstração da compatibilidade com o interesse público;
• adequação ao planejamento institucional;
• atendimento aos princípios da eficiência, economicidade e vantajosidade;
• análise dos riscos remanescentes;
• confirmação de que os requisitos da contratação foram devidamente definidos;
• conclusão quanto à conveniência e oportunidade administrativa da contratação.

O texto deverá possuir estrutura semelhante a um parecer técnico, apresentando raciocínio lógico, linguagem formal, fundamentação consistente e conclusão objetiva.
Evite reproduzir literalmente os demais tópicos do ETP. Em vez disso, sintetize as conclusões alcançadas, demonstrando que os estudos realizados evidenciam a viabilidade da contratação.
Finalize com manifestação técnica clara indicando que, diante dos estudos desenvolvidos, conclui-se pela viabilidade da contratação pretendida, ressalvadas eventuais adequações decorrentes das fases subsequentes do planejamento e da instrução processual.
Produza texto completo, robusto, juridicamente consistente e pronto para integrar diretamente o Estudo Técnico Preliminar.`,
};

export function montarContextoParaPrompt(etp) {
  const itens = etp.itens || [];
  const valoresAdotados = etp.valoresAdotados || {};
  const partes = [];

  partes.push(`Objeto da contratação: ${objetoCompleto(etp) || "(não informado)"}`);
  partes.push(`Órgão/Secretaria: ${etp.meta.orgao || "(não informado)"}`);
  partes.push(`Unidade/setor demandante: ${etp.meta.setor || "(não informado)"}`);
  partes.push(`Tipo de objeto: ${etp.meta.tipo}`);

  if (itens.length > 0) {
    const linhasItens = itens.slice(0, 60).map(i => `- ${i.descricao}${i.quantidade ? ` (quantidade: ${i.quantidade} ${i.unidade || ""})` : ""}`).join("\n");
    partes.push(`Itens e quantidades levantados:\n${linhasItens}`);
  }

  if (etp.pca) {
    const encontrados = contarPrevistosNoPca(etp);
    partes.push(`Alinhamento ao Plano de Contratações Anual: ${encontrados} de ${itens.length} itens já constam previstos no PCA vigente.`);
  }

  const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
  if (fontesUsadas.length > 0) partes.push(`Levantamento de mercado: cotações coletadas junto a ${fontesUsadas.join(", ")}.`);

  const totalEstimado = itens.reduce((s, i) => s + num(i.quantidade) * num(valoresAdotados[i.id] || 0), 0);
  if (totalEstimado > 0) {
    const metodologia = etp.meta.metodologiaCalculo === "media" ? "média aritmética simples" : "mediana";
    partes.push(`Estimativa de valor: ${brl(totalEstimado)} (metodologia de cálculo: ${metodologia} por item).`);
  }

  if (etp.meta.prazoGarantiaDias?.trim()) partes.push(`Prazo de garantia exigido: ${formatarPrazo(etp.meta.prazoGarantiaDias, etp.meta.prazoGarantiaUnidade)}.`);
  if (etp.meta.prazoEntregaDias?.trim()) partes.push(`Prazo de entrega/execução exigido: ${formatarPrazo(etp.meta.prazoEntregaDias, etp.meta.prazoEntregaUnidade)}.`);

  if (etp.meta.parcelamento === "sim") partes.push("Parcelamento: a contratação será parcelada em itens/lotes.");
  else if (etp.meta.parcelamento === "nao") partes.push("Parcelamento: a contratação não será parcelada (lote único).");

  if (etp.meta.correlataExiste) {
    partes.push(`Contratações correlatas/interdependentes: ${etp.meta.correlataDescricao?.trim() || "há contratação relacionada, sem detalhamento adicional informado."}`);
  } else {
    partes.push("Contratações correlatas/interdependentes: não foram identificadas.");
  }

  if (etp.meta.impactoAmbientalRelevante) {
    partes.push(`Impactos ambientais: ${etp.meta.impactoAmbientalDescricao?.trim() || "há impacto relevante identificado, sem detalhamento adicional informado."}`);
  } else {
    partes.push("Impactos ambientais: não são esperados impactos ambientais significativos.");
  }

  if (etp.meta.metodologiaQuantidades) {
    partes.push(`Metodologia de levantamento das quantidades: ${etp.meta.detalhamentoQuantidades?.trim() || etp.meta.metodologiaQuantidades}.`);
  }

  if (etp.meta.fonteRecurso?.trim()) partes.push(`Fonte de recurso: ${etp.meta.fonteRecurso.trim()}.`);

  const solucoes = etp.solucoesMercado || [];
  if (solucoes.length > 0) {
    const escolhida = solucoes.find(s => s.selecionada);
    partes.push(`Soluções de mercado pesquisadas: ${solucoes.map(s => s.nome).join("; ")}.${escolhida ? ` Solução escolhida: ${escolhida.nome}.` : ""}`);
  }

  return partes.join("\n");
}

export function montarContextoPorTopico(etp, sectionId) {
  const itens = etp.itens || [];
  const valoresAdotados = etp.valoresAdotados || {};
  const linhas = [];

  linhas.push(`Objeto da contratação: ${objetoCompleto(etp) || "(não informado)"}`);
  linhas.push(`Órgão/Secretaria: ${etp.meta.orgao || "(não informado)"}`);
  linhas.push(`Unidade/setor demandante: ${etp.meta.setor || "(não informado)"}`);
  linhas.push(`Tipo de objeto: ${etp.meta.tipo}`);

  const precisaListaItens = ["III", "IV", "V", "VI", "VII"].includes(sectionId);
  if (precisaListaItens && itens.length > 0) {
    const linhasItens = itens.slice(0, 60).map(i => `- ${i.descricao}${i.quantidade ? ` (quantidade: ${i.quantidade} ${i.unidade || ""})` : ""}`).join("\n");
    linhas.push(`Itens e quantidades levantados:\n${linhasItens}`);
  } else if (itens.length > 0) {
    linhas.push(`Quantidade de itens que compõem esta contratação: ${itens.length}.`);
  }

  if (sectionId === "II" && etp.pca) {
    const encontrados = contarPrevistosNoPca(etp);
    linhas.push(`Alinhamento ao Plano de Contratações Anual: ${encontrados} de ${itens.length} itens já constam previstos no PCA vigente (planilha "${etp.pca.nomeArquivo}").`);
  }

  if (["IV", "VI"].includes(sectionId)) {
    const fontesUsadas = [...new Set(Object.values(etp.cotacoes || {}).flat().map(q => q.fonte).filter(Boolean))];
    if (fontesUsadas.length > 0) linhas.push(`Levantamento de mercado: cotações coletadas junto a ${fontesUsadas.join(", ")}.`);
  }

  if (sectionId === "IV") {
    const solucoes = etp.solucoesMercado || [];
    if (solucoes.length > 0) {
      const escolhida = solucoes.find(s => s.selecionada);
      linhas.push(`Soluções de mercado pesquisadas: ${solucoes.map(s => s.nome).join("; ")}.${escolhida ? ` Solução escolhida: ${escolhida.nome}.` : ""}`);
    }
  }

  if (sectionId === "V" && etp.meta.metodologiaQuantidades) {
    linhas.push(`Metodologia de levantamento das quantidades: ${etp.meta.detalhamentoQuantidades?.trim() || etp.meta.metodologiaQuantidades}.`);
  }

  if (sectionId === "VI") {
    const totalEstimado = itens.reduce((s, i) => s + num(i.quantidade) * num(valoresAdotados[i.id] || 0), 0);
    if (totalEstimado > 0) {
      const metodologia = etp.meta.metodologiaCalculo === "media" ? "média aritmética simples" : "mediana";
      linhas.push(`Estimativa de valor: ${brl(totalEstimado)} (metodologia de cálculo: ${metodologia} por item).`);
    }
  }

  if (sectionId === "III") {
    if (etp.meta.prazoGarantiaDias?.trim()) linhas.push(`Prazo de garantia exigido: ${formatarPrazo(etp.meta.prazoGarantiaDias, etp.meta.prazoGarantiaUnidade)}.`);
    if (etp.meta.prazoEntregaDias?.trim()) linhas.push(`Prazo de entrega/execução exigido: ${formatarPrazo(etp.meta.prazoEntregaDias, etp.meta.prazoEntregaUnidade)}.`);
  }

  if (sectionId === "VII" && etp.meta.manutencaoContinuada) {
    linhas.push("Esta contratação exige manutenção, assistência técnica ou fornecimento continuado de peças.");
  }

  if (sectionId === "VIII") {
    if (etp.meta.parcelamento === "sim") linhas.push("Parcelamento: a contratação será parcelada em itens/lotes.");
    else if (etp.meta.parcelamento === "nao") linhas.push("Parcelamento: a contratação não será parcelada (lote único).");
  }

  if (sectionId === "X" && etp.meta.fonteRecurso?.trim()) {
    linhas.push(`Fonte de recurso: ${etp.meta.fonteRecurso.trim()}.`);
  }

  if (sectionId === "XI") {
    linhas.push(etp.meta.correlataExiste
      ? `Contratações correlatas/interdependentes: ${etp.meta.correlataDescricao?.trim() || "há contratação relacionada, sem detalhamento adicional informado."}`
      : "Contratações correlatas/interdependentes: não foram identificadas.");
  }

  if (sectionId === "XII") {
    linhas.push(etp.meta.impactoAmbientalRelevante
      ? `Impactos ambientais: ${etp.meta.impactoAmbientalDescricao?.trim() || "há impacto relevante identificado, sem detalhamento adicional informado."}`
      : "Impactos ambientais: não são esperados impactos ambientais significativos.");
  }

  if (sectionId === "XIII") {
    // Síntese breve do processo para embasar a conclusão, sem repetir listas completas
    const sintese = [];
    if (itens.length > 0) sintese.push(`${itens.length} item(ns) levantado(s)`);
    if (etp.pca) {
      const encontrados = contarPrevistosNoPca(etp);
      sintese.push(`${encontrados}/${itens.length} alinhados ao PCA`);
    }
    const totalEstimado = itens.reduce((s, i) => s + num(i.quantidade) * num(valoresAdotados[i.id] || 0), 0);
    if (totalEstimado > 0) sintese.push(`valor estimado de ${brl(totalEstimado)}`);
    if (sintese.length > 0) linhas.push(`Síntese do processo: ${sintese.join("; ")}.`);
  }

  return linhas.join("\n");
}

export function gerarPromptIA(etp, sectionId) {
  const base = PROMPTS_POR_TOPICO[sectionId];
  const contexto = montarContextoPorTopico(etp, sectionId);
  return `${base}

DADOS DO PROCESSO (utilize exclusivamente estas informações; não invente dados que não constem aqui)
${contexto}`;
}

export function gerarPromptGeralIA(etp) {
  const contexto = montarContextoParaPrompt(etp);
  const blocos = SECOES.map(s => `### ${s.id} — ${s.titulo}\n${PROMPTS_POR_TOPICO[s.id]}`).join("\n\n");
  return `Elabore o Estudo Técnico Preliminar (ETP) completo, respondendo TODOS os 13 tópicos a seguir, na ordem apresentada. Para cada tópico, inicie a resposta exatamente com uma linha no formato "### [algarismo romano] — [título do tópico]" e, em seguida, escreva o texto correspondente, seguindo rigorosamente a instrução específica daquele tópico. Não pule nenhum tópico.

${blocos}

DADOS DO PROCESSO (utilize exclusivamente estas informações; não invente dados que não constem aqui)
${contexto}`;
}
