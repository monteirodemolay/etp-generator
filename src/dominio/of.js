/**
 * Ordem de Fornecimento: extração automática de dados do PDF, cálculo de
 * status, geração de identificadores.
 *
 * Nada aqui toca em Firestore, EmailJS ou leitura de arquivo — isso fica em
 * of-servico.js, isolado, do mesmo jeito que o gerador de Word fica isolado
 * do resto do domínio. Aqui só tem lógica pura, testável sem navegador.
 */

// ---------- Extração de texto do PDF (heurística por regex) ----------
// É best-effort: o PDF de uma OF não tem estrutura garantida entre órgãos
// diferentes. O servidor sempre confere e ajusta antes de disparar — os
// campos abrem editáveis, nunca são usados direto sem revisão.
import { fmtDateISO } from "./datas.js";
import { ehDiaUtil, proximoDiaUtil } from "./dias-uteis.js";

export function extrairDadosDoPdf(textoCompleto) {
  const matchOf =
    textoCompleto.match(/ORDEM\s+FORNECIMENTO\/SERVIÇOS\s+(\d+)/i) ||
    textoCompleto.match(/ORDEM\s+(?:DE\s+)?FORNECIMENTO(?:\/SERVIÇOS)?[\s:ºN°]*(\d+)/i) ||
    textoCompleto.match(/O\.?F\.?[:\s]+(\d+)/i);
  const numeroOf = matchOf ? matchOf[1] : null;

  const matchCnpjSupplier = textoCompleto.match(
    /(?:CPF\/CNPJ|CNPJ|CPF)[:\s]+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i
  );
  let cnpj = "";
  if (matchCnpjSupplier) {
    cnpj = matchCnpjSupplier[1];
  } else {
    const todosCnpjs = textoCompleto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g);
    if (todosCnpjs?.length > 1) cnpj = todosCnpjs[1];
    else if (todosCnpjs) cnpj = todosCnpjs[0];
  }

  let empresa = "";
  const matchBloco = textoCompleto.match(
    /Fornecedor[:\s]+([\s\S]*?)(?=Dados bancários|CPF\/CNPJ|CPF|CNPJ|Telefone|Endereço|Dotação|$)/i
  );
  if (matchBloco?.[1]) {
    const linhas = matchBloco[1].trim().split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    if (linhas.length > 0) empresa = linhas[0];
  }
  if (!empresa || empresa.length < 3) {
    const matchPadraoEmpresa = textoCompleto.match(
      /\b([A-Z0-9\s.&'-]{3,80}\s+(?:LTDA|S\/A|MEI|ME|EPP|SERVICOS|COMERCIO|EIRELI))\b/i
    );
    if (matchPadraoEmpresa) empresa = matchPadraoEmpresa[1].trim();
  }
  empresa = empresa
    .replace(/^Fornecedor[:\s]*/i, "")
    .replace(/^Dados do Fornecedor\s*/i, "")
    .replace(/^[\d\s\-_]+/, "")
    .trim();
  if (/^\d+$/.test(empresa) || /^\d{2}\.\d{3}\.\d{3}/.test(empresa)) empresa = "";

  return { numeroOf, cnpj, empresa };
}

// ---------- WhatsApp ----------
// Só o link wa.me — quem dispara ainda aperta "enviar" manualmente, no
// próprio WhatsApp. Não é um envio automático (isso exigiria uma conta
// comercial paga na Meta), é o link que já vem com a mensagem pronta.
export function normalizarTelefoneWhatsApp(telefone) {
  const digitos = String(telefone || "").replace(/\D/g, "");
  if (!digitos) return null;
  // Sem DDI, assume Brasil (55). Números já com 55 na frente ficam como estão.
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

export function gerarLinkWhatsApp(telefone, mensagem) {
  const numero = normalizarTelefoneWhatsApp(telefone);
  const texto = encodeURIComponent(mensagem || "");
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

export function montarMensagemWhatsApp(of, linkAceite) {
  return `Olá! Segue a Ordem de Fornecimento nº ${of.numeroOf}, da Prefeitura.\n` +
    `Confirme o recebimento pelo link: ${linkAceite}`;
}

// ---------- Central do fornecedor (CNPJ + e-mail) ----------
// Chave estável e determinística, usada como ID de documento no índice
// público que liga um fornecedor às suas OFs — nunca como filtro de busca
// livre, para não permitir listar tudo. Normaliza os dois lados (CNPJ só
// dígitos, e-mail em minúsculo) para que "12.345/0001-99" e "12345000199"
// cheguem na mesma chave.
export function chaveIndiceFornecedor(cnpj, email) {
  const cnpjLimpo = String(cnpj || "").replace(/\D/g, "");
  const emailLimpo = String(email || "").trim().toLowerCase();
  if (!cnpjLimpo || !emailLimpo) return null;
  return `${cnpjLimpo}_${emailLimpo.replace(/[^a-z0-9@.\-]/g, "")}`;
}

// Agrupa as OFs de um fornecedor por ano -> mês -> status, para a central
// dele exibir organizado, como combinado.
export function agruparOfsPorAnoMes(ofs) {
  const grupos = {};
  for (const of_ of ofs || []) {
    const ts = of_.createdAt || Date.now();
    const data = new Date(ts);
    const ano = data.getFullYear();
    const mes = data.getMonth(); // 0-11
    grupos[ano] = grupos[ano] || {};
    grupos[ano][mes] = grupos[ano][mes] || [];
    grupos[ano][mes].push(of_);
  }
  return Object.keys(grupos).sort((a, b) => b - a).map(ano => ({
    ano: Number(ano),
    meses: Object.keys(grupos[ano]).sort((a, b) => b - a).map(mes => ({
      mes: Number(mes),
      itens: grupos[ano][mes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    })),
  }));
}

// ---------- Identificadores ----------
export function gerarNumeroOfSugerido() {
  return `OF-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Confere se já existe outra OF com o mesmo número — o gerador aleatório
// (4 dígitos) tem colisão real depois de algumas dezenas de registros.
export function numeroOfDuplicado(numeroOf, ofs, idAtual = null) {
  const alvo = String(numeroOf || "").trim().toLowerCase();
  if (!alvo) return false;
  return (ofs || []).some(o => o.id !== idAtual && String(o.numeroOf).trim().toLowerCase() === alvo);
}

export function gerarToken() {
  return crypto.randomUUID();
}

export function gerarChaveRecibo(numeroOf) {
  return `REC-${numeroOf}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ---------- Situação de uma OF (para a tabela de gestão) ----------
// Nunca afirma "entregue" — só o que o próprio fluxo pode garantir: se o
// fornecedor confirmou, se está no prazo, se passou do prazo, se houve
// divergência relatada.
export function calcularSituacao(item) {
  if (item.status === "Rascunho") return { chave: "rascunho", texto: "Rascunho" };

  // O recibo de confirmação (reciboImutavel) é a prova real de que o
  // fornecedor confirmou o recebimento — nunca é apagado nem reescrito
  // depois de criado. Se por algum motivo o campo "status" ficar
  // desatualizado (ex.: um reenvio antigo, antes de uma correção, que
  // resetava o status por engano), o recibo prevalece: a situação nunca
  // volta a mostrar "aguardando" pra uma OF que já foi confirmada de verdade.
  const statusEfetivo = (item.reciboImutavel && item.status === "Aguardando Aceite") ? "Em Dia" : item.status;

  if (statusEfetivo === "Aguardando Aceite") {
    const vinteEQuatroHorasMs = 24 * 60 * 60 * 1000;
    const precisaReenviar = item.dataEnvioTimestamp && (Date.now() - item.dataEnvioTimestamp > vinteEQuatroHorasMs);
    return {
      chave: precisaReenviar ? "sem-resposta" : "aguardando",
      texto: precisaReenviar ? "Sem resposta há mais de 24h" : "Aguardando confirmação do fornecedor",
      precisaReenviar,
    };
  }

  if (statusEfetivo === "Divergência") return { chave: "divergencia", texto: "Divergência relatada pelo fornecedor" };

  // A partir daqui, o fornecedor já confirmou o recebimento da OF (status
  // "Em Dia"). Isso NÃO é o mesmo que o produto ter chegado — é só o
  // fornecedor confirmando que recebeu a ordem e o prazo começou a contar.
  //
  // Se a equipe já fechou a avaliação da entrega em si, essa é a palavra
  // final — nunca mais depende de "hoje", porque uma entrega registrada
  // como no prazo não pode virar "vencida" só porque o tempo passou.
  if (item.confirmacaoEntrega) {
    const { situacao, dataEntregaReal } = item.confirmacaoEntrega;
    if (situacao === SITUACAO_ENTREGA.NAO_ENTREGUE) {
      return { chave: "nao-entregue", texto: "Não entregue", naoEntregue: true };
    }
    if (situacao === SITUACAO_ENTREGA.NO_PRAZO) {
      return { chave: "em-dia", texto: `Entregue no prazo (${fmtDateISO(dataEntregaReal)})` };
    }
    if (situacao === SITUACAO_ENTREGA.FORA_DO_PRAZO) {
      return { chave: "atrasado", texto: `Entregue fora do prazo (${fmtDateISO(dataEntregaReal)})`, atrasado: true };
    }
  }

  // Ainda sem a confirmação da equipe — mostra um alerta provisório
  // (o prazo já venceu e ninguém fechou a entrega ainda), mas isso não é o
  // veredito final, é só um lembrete de que falta confirmar.
  if (item.prazoLimite) {
    const [d, m, a] = item.prazoLimite.split("/");
    const dataLimite = new Date(a, m - 1, d);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (hoje > dataLimite) {
      return { chave: "aguardando-confirmacao", texto: "Prazo vencido — já pode notificar ou confirmar a entrega", precisaConfirmarEntrega: true };
    }
  }

  return { chave: "aguardando-entrega", texto: "Aguardando confirmação da entrega", precisaConfirmarEntrega: true };
}

// ---------- Confirmação da entrega, feita pela equipe ----------

export const SITUACAO_ENTREGA = {
  NO_PRAZO: "no-prazo",
  FORA_DO_PRAZO: "fora-do-prazo",
  NAO_ENTREGUE: "nao-entregue",
};

// A equipe informa só a data real de entrega (ou marca que não chegou) — o
// sistema decide sozinho se ficou dentro ou fora do prazo, comparando com
// o prazoLimiteISO já calculado desde a confirmação do fornecedor.
export function classificarEntrega(dataEntregaReal, prazoLimiteISO) {
  if (!dataEntregaReal) return SITUACAO_ENTREGA.NAO_ENTREGUE;
  if (!prazoLimiteISO) return null; // não deveria acontecer, mas não afirma nada sem prazo pra comparar
  return entregaDentroDoPrazo(dataEntregaReal, prazoLimiteISO)
    ? SITUACAO_ENTREGA.NO_PRAZO
    : SITUACAO_ENTREGA.FORA_DO_PRAZO;
}

export function montarConfirmacaoEntrega(dataEntregaReal, prazoLimiteISO, confirmadoPor) {
  return {
    situacao: classificarEntrega(dataEntregaReal, prazoLimiteISO),
    dataEntregaReal: dataEntregaReal || null,
    confirmadoEm: Date.now(),
    confirmadoPor: confirmadoPor || "",
  };
}

// ---------- Notas Fiscais ----------
export function emptyNotaFiscal({ nomeArquivo, arquivoBase64, numeroNF, valorNF }) {
  return {
    id: "nf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    nomeArquivo: nomeArquivo || "",
    arquivoBase64: arquivoBase64 || "",
    numeroNF: (numeroNF || "").trim(),
    valorNF: valorNF || "",
    anexadoEm: Date.now(),
    atestado: null, // { atestadoPor, nomeAtestador, cargoAtestador, quando, observacao }
  };
}

// Só pode atestar uma Nota Fiscal depois que a entrega foi confirmada como
// realmente recebida (o "recebimento e aceite do produto") -- se a equipe
// marcou como "não entregue", não faz sentido nenhum atestar a nota.
export function podeAtestarNotaFiscal(of) {
  return !!of.confirmacaoEntrega && of.confirmacaoEntrega.situacao !== SITUACAO_ENTREGA.NAO_ENTREGUE;
}

// ---------- Agrupamento por aba, para a tela de gestão ----------
// "Entregue no prazo" e "fora do prazo" ficam juntos numa aba só
// ("Entregues"), diferenciados pela cor do selo na tabela — separar em duas
// abas deixaria a barra grande demais no celular.
export const GRUPOS_SITUACAO_OF = [
  { id: "todas", rotulo: "Todas" },
  { id: "rascunho", rotulo: "Rascunhos" },
  { id: "aguardando-fornecedor", rotulo: "Aguardando fornecedor" },
  { id: "aguardando-entrega", rotulo: "Aguardando entrega" },
  { id: "entregues", rotulo: "Entregues" },
  { id: "nao-entregues", rotulo: "Não entregues" },
  { id: "divergencias", rotulo: "Divergências" },
];

// ---------- Validação do lote de importação (várias OFs de uma vez) ----------

// Verifica um item do lote: mensagem de erro (se houver) ou null se estiver
// pronto para disparar. Confere o número tanto contra as OFs já existentes
// quanto contra os OUTROS arquivos do mesmo lote — dois PDFs do lote podem
// colidir entre si mesmo sem nenhum já existir no banco.
export function validarItemLote(item, todosOsItensDoLote, ofsExistentes) {
  const outrosDoLote = (todosOsItensDoLote || [])
    .filter(i => i.idLocal !== item.idLocal)
    .map(i => ({ id: i.idLocal, numeroOf: i.numeroOf }));
  if (numeroOfDuplicado(item.numeroOf, [...(ofsExistentes || []), ...outrosDoLote], item.idLocal)) {
    return "Número de OF repetido";
  }
  if (!item.emailFornecedor?.trim()) return "Falta e-mail";
  return null;
}

// Reaplica a validação em todos os itens do lote — chamado sempre que algum
// item muda (edição manual, remoção, novo arquivo lido).
export function recalcularErrosLote(itens, ofsExistentes) {
  return itens.map(item => ({ ...item, erro: validarItemLote(item, itens, ofsExistentes) }));
}

export function grupoDaSituacao(chaveSituacao) {
  switch (chaveSituacao) {
    case "rascunho": return "rascunho";
    case "aguardando": case "sem-resposta": return "aguardando-fornecedor";
    case "aguardando-entrega": case "aguardando-confirmacao": case "vencido": return "aguardando-entrega";
    case "em-dia": case "atrasado": return "entregues";
    case "nao-entregue": return "nao-entregues";
    case "divergencia": return "divergencias";
    default: return "todas";
  }
}

// ---------- Abas simplificadas, pra tela de gestão ----------
// Reaproveita o agrupamento fino acima (que os Relatórios continuam usando,
// com toda a granularidade), só consolidando mais um nível — cinco abas em
// vez de sete, agrupando pelo que importa no dia a dia: ainda em andamento,
// já concluída, ou precisando de atenção.
export const GRUPOS_ABA_OF = [
  { id: "todas", rotulo: "Todas" },
  { id: "rascunho", rotulo: "Rascunhos" },
  { id: "em-andamento", rotulo: "Em andamento" },
  { id: "concluidas", rotulo: "Concluídas" },
  { id: "atencao", rotulo: "Precisa de atenção" },
];

export function grupoAbaDaSituacao(chaveSituacao) {
  const grupo = grupoDaSituacao(chaveSituacao);
  switch (grupo) {
    case "rascunho": return "rascunho";
    case "aguardando-fornecedor": case "aguardando-entrega": return "em-andamento";
    case "entregues": return "concluidas";
    case "nao-entregues": case "divergencias": return "atencao";
    default: return "todas";
  }
}

// ---------- Ordenação da tabela ----------
function paraDataOrdenavel(item) {
  if (item.prazoLimiteISO) return item.prazoLimiteISO;
  if (!item.prazoLimite) return "";
  const [d, m, a] = item.prazoLimite.split("/");
  if (!d || !m || !a) return "";
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// linhas: [{ item, situacao }] — o mesmo formato já usado na tabela.
// campo: "numeroOf" | "empresa" | "prazoLimite" | "situacao"
// direcao: "asc" | "desc"
export function ordenarLinhasOf(linhas, campo, direcao) {
  const mult = direcao === "desc" ? -1 : 1;
  const copia = [...linhas];
  copia.sort((a, b) => {
    let va = "", vb = "";
    if (campo === "numeroOf") { va = a.item.numeroOf || ""; vb = b.item.numeroOf || ""; }
    else if (campo === "empresa") { va = a.item.empresa || ""; vb = b.item.empresa || ""; } // CNPJ nunca entra aqui, de propósito
    else if (campo === "prazoLimite") { va = paraDataOrdenavel(a.item); vb = paraDataOrdenavel(b.item); }
    else if (campo === "situacao") { va = a.situacao?.texto || ""; vb = b.situacao?.texto || ""; }
    return mult * va.localeCompare(vb, "pt-BR", { numeric: true, sensitivity: "base" });
  });
  return copia;
}

// Calcula a data-limite (string pt-BR, para exibir) a partir de agora + prazoDias.
// Mantida por compatibilidade com quem ainda não passa o calendário — não
// considera feriado nenhum, só soma dias corridos puros.
export function calcularPrazoLimite(prazoDias, agora = new Date()) {
  const dataLimite = new Date(agora);
  dataLimite.setDate(dataLimite.getDate() + parseInt(prazoDias || 10, 10));
  return dataLimite.toLocaleDateString("pt-BR");
}

// A mesma data-limite, em formato ISO (aaaa-mm-dd) — string em dd/mm/aaaa não
// dá para comparar diretamente ("15/01/2026" > "03/12/2025" seria falso,
// textualmente). O ISO compara certo só com "maior/menor que" de string.
export function calcularPrazoLimiteISO(prazoDias, agora = new Date()) {
  const dataLimite = new Date(agora);
  dataLimite.setDate(dataLimite.getDate() + parseInt(prazoDias || 10, 10));
  return paraISOSimples(dataLimite);
}

function paraISOSimples(data) {
  const pad = n => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

// A data-limite considerando o calendário de dias úteis (feriados e fins de
// semana) do município da entidade dona da OF, segundo a regra escolhida:
//
//   "corridos" — conta os dias normalmente; só ajusta o RESULTADO se ele
//                cair num dia sem expediente, empurrando para o próximo
//                dia útil.
//   "uteis"    — pula os dias sem expediente durante TODA a contagem, não
//                só no final; o prazo "anda" só nos dias que funcionam.
//
// Devolve a data em ISO (aaaa-mm-dd) — para exibir, formate com fmtDateISO.
export function calcularPrazoLimiteComCalendario(prazoDias, tipoContagem, feriados, municipioId, agora = new Date()) {
  const dias = parseInt(prazoDias || 10, 10);

  if (tipoContagem === "uteis") {
    let data = new Date(agora);
    let contados = 0;
    let tentativas = 0; // trava de segurança, nunca deveria chegar perto disso
    while (contados < dias && tentativas < 730) {
      data.setDate(data.getDate() + 1);
      if (ehDiaUtil(paraISOSimples(data), feriados, municipioId)) contados++;
      tentativas++;
    }
    return paraISOSimples(data);
  }

  // "corridos" (padrão): soma normal, ajusta só o final
  const dataBruta = new Date(agora);
  dataBruta.setDate(dataBruta.getDate() + dias);
  return proximoDiaUtil(paraISOSimples(dataBruta), feriados, municipioId);
}

// Compara a data em que o fornecedor diz que entregou com o prazo combinado.
// Ambas em ISO, para comparar como texto sem precisar de objetos Date.
export function entregaDentroDoPrazo(dataEntregaISO, prazoLimiteISO) {
  if (!dataEntregaISO || !prazoLimiteISO) return null; // ainda não há como avaliar
  return dataEntregaISO <= prazoLimiteISO;
}

export function emptyOf(dadosIniciais = {}) {
  return {
    id: null,
    numeroOf: dadosIniciais.numeroOf || "",
    empresa: dadosIniciais.empresa || "",
    cnpj: dadosIniciais.cnpj || "",
    emailFornecedor: dadosIniciais.emailFornecedor || "",
    telefoneFornecedor: dadosIniciais.telefoneFornecedor || "",
    prazoDias: dadosIniciais.prazoDias ?? 10,
    status: "Rascunho",
    pdfBase64: dadosIniciais.pdfBase64 || "",
    processoOrigem: dadosIniciais.processoOrigem || "", // referência opcional a um ETP/processo
    secretariaId: dadosIniciais.secretariaId || null,
    municipioId: dadosIniciais.municipioId || null, // gravado já na criação, para o fornecedor não precisar consultar a entidade
    tipoContagemPrazo: dadosIniciais.tipoContagemPrazo || "corridos", // "corridos" | "uteis"
    // Timbre da entidade "congelado" no momento da criação — permite a tela
    // pública do fornecedor mostrar o mesmo timbre que o admin vê, sem
    // precisar de acesso à lista de entidades (que ela não tem).
    timbreSnapshot: dadosIniciais.timbreSnapshot || null,
    // Credenciais do EmailJS "congeladas" no momento da criação — mesma
    // lógica do timbre: a entidade pode não ter conta própria, e nesse caso
    // usa o padrão do sistema (ver dominio/emailjs-config.js).
    emailJsSnapshot: dadosIniciais.emailJsSnapshot || null,
    // Nome da entidade "congelado" no momento da criação — mesmo motivo do
    // timbre: a Central do Fornecedor é pública e não tem acesso à lista de
    // entidades, então precisa que a OF já traga isso consigo.
    nomeEntidadeSnapshot: dadosIniciais.nomeEntidadeSnapshot || null,
    // Notas Fiscais anexadas pelo fornecedor -- pode anexar quantas quiser,
    // a qualquer momento (ex.: entregas parciais). Cada uma só pode ser
    // "atestada" (pela equipe) depois que a entrega foi confirmada. Desfazer
    // um ateste nunca apaga nada: o campo volta pra null, mas o evento fica
    // registrado por completo na auditoria (mesmo cuidado já usado em
    // desfazerConfirmacaoEntrega).
    notasFiscais: dadosIniciais.notasFiscais || [], // { id, nomeArquivo, arquivoBase64, numeroNF, valorNF, anexadoEm, atestado }

    // Quando várias OFs da mesma empresa são disparadas juntas (mesmo CNPJ,
    // mesmo lote de importação), todas ganham o mesmo loteId -- usado só
    // pra agrupar num único e-mail e numa única confirmação de "recebi
    // tudo". Cada OF continua sendo um registro totalmente independente:
    // prazo, entrega, notificação de atraso e disputa continuam por OF,
    // sem nenhuma mudança aí.
    loteId: dadosIniciais.loteId || null,
    // Repartição (setor) dentro da entidade que emitiu esta OF — opcional;
    // null quando a entidade não usa esse nível de divisão.
    reparticaoId: dadosIniciais.reparticaoId || null,
    envios: [], // log de cada disparo/reenvio: { data, timestamp }
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
