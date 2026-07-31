/**
 * Serviço da Ordem de Fornecimento: Firestore + EmailJS + leitura de PDF.
 *
 * Isolado do domínio de propósito — igual o motor de Word fica isolado em
 * docx/. Tudo aqui tem efeito colateral (rede, arquivo); nada aqui decide
 * REGRA, só EXECUTA o que o domínio (of.js) já calculou.
 *
 * Este módulo fala com DUAS coleções do Firestore, diferentes da nossa base
 * principal ("dados"), porque parte do fluxo precisa ser lida e escrita por
 * quem não tem login (o fornecedor):
 *
 *   of_registros/{token}   — a Ordem de Fornecimento em si. O documento
 *                             inteiro é identificado pelo próprio token do
 *                             link, não por um id qualquer.
 *   of_recibos/{chave}     — o recibo de confirmação, uma vez criado nunca
 *                             muda mais (nem a equipe interna consegue
 *                             alterar — só existe, ou não existe).
 *
 * A separação entre quem pode "listar tudo" (equipe, logada) e quem só pode
 * "ler um documento específico, se souber o link" (fornecedor, sem login) é
 * feita nas Regras de Segurança do Firestore, não aqui no código — ver
 * of-firestore.rules.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy,
} from "firebase/firestore";
import { db } from "./firebase.js";
import emailjs from "@emailjs/browser";
import * as pdfjsLib from "pdfjs-dist";
import { extrairDadosDoPdf, calcularPrazoLimite, calcularPrazoLimiteISO,
  calcularPrazoLimiteComCalendario, montarConfirmacaoEntrega, chaveIndiceFornecedor } from "./dominio/of.js";
import { diasFechadosNoPeriodo } from "./dominio/dias-uteis.js";
import { fmtDateISO, todayISO } from "./dominio/datas.js";
import storage from "./storage.js";
import { registrarEvento } from "./auditoria-servico.js";
import { TIPOS_EVENTO } from "./dominio/auditoria.js";
import { montarTextoNotificacaoAtraso, formatarPrazoNotificacao, emptyNotificacao, linkNotificacao } from "./dominio/notificacao-of.js";
import { EMAILJS_PADRAO } from "./dominio/emailjs-config.js";
import { emptyEnvioManual, rotuloMetodoEnvio } from "./dominio/envio-manual.js";
import { emptyDisputa, novaMensagemDisputa, disputaAtiva } from "./dominio/disputa.js";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// As chaves do EmailJS são públicas por natureza (como as do Firebase) — a
// proteção real é restringir, no painel do EmailJS, quais domínios podem
// disparar envio ("Allowed origins"). Sem isso, qualquer pessoa que ler o
// código do site pode extrair estas três strings e mandar e-mail em nome do
// sistema, usando a cota da conta.
//
// Cada OF carrega suas próprias credenciais (of.emailJsSnapshot), congeladas
// na criação — para entidades sem conta própria no EmailJS, isso resolve
// sozinho para as credenciais padrão (ver dominio/emailjs-config.js).

const COL_OF = "of_registros";
// Índice mínimo chave -> token, usado só para a conferência pública por
// chave digitada. Não duplica os dados da OF — a regra de segurança exige
// que a chave já esteja gravada no registro real antes de aceitar este
// índice, então não dá para forjar uma entrada apontando para uma OF que
// nunca foi de fato confirmada.
const COL_INDICE_CHAVE = "of_indice_chave";

// ---------- Leitura do PDF ----------
// Devolve o texto extraído (para extrairDadosDoPdf, no domínio) junto com o
// arquivo em data URL, para anexar à OF.
export async function lerPdfDeArquivo(file) {
  const leitor = new FileReader();
  const pdfBase64 = await new Promise((resolve, reject) => {
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(file);
  });

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textoCompleto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();
    const itensOrdenados = conteudo.items.sort((a, b) => {
      const diffY = b.transform[5] - a.transform[5];
      return Math.abs(diffY) > 2 ? diffY : a.transform[4] - b.transform[4];
    });
    textoCompleto += itensOrdenados.map(it => it.str).join(" ") + " ";
  }

  return { pdfBase64, textoCompleto };
}

// ---------- Ordens de Fornecimento (equipe, autenticada) ----------
export async function listarOfs() {
  const q = query(collection(db, COL_OF), orderBy("numeroOf", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function salvarOf(of) {
  const token = of.token || crypto.randomUUID();
  const payload = { ...of, token, updatedAt: Date.now() };
  await setDoc(doc(db, COL_OF, token), payload, { merge: true });
  await manterIndiceFornecedor(payload);
  return payload;
}

const COL_INDICE_FORNECEDOR = "of_fornecedor_indice";

// Mantém o índice que liga um fornecedor (CNPJ + e-mail) às OFs dele — é o
// que permite a central pública funcionar sem nenhuma busca livre no banco
// (ver firestore.rules). Roda sempre que uma OF é salva; se o CNPJ ou
// e-mail ainda não permitem montar uma chave, não faz nada — a OF continua
// existindo normalmente, só não aparece na central até esses dados existirem.
async function manterIndiceFornecedor(of) {
  const chave = chaveIndiceFornecedor(of.cnpj, of.emailFornecedor);
  if (!chave) return;
  try {
    const atual = await getDoc(doc(db, COL_INDICE_FORNECEDOR, chave));
    const tokens = atual.exists() ? (atual.data().tokens || []) : [];
    if (!tokens.includes(of.token)) {
      await setDoc(doc(db, COL_INDICE_FORNECEDOR, chave), { tokens: [...tokens, of.token] });
    }
  } catch (e) { console.error("Não foi possível atualizar o índice do fornecedor", e); }
}

// ---------- Central do fornecedor (público, sem login) ----------
// Duas leituras, ambas por "get" direto: primeiro o índice (CNPJ + e-mail
// batendo exatamente), depois cada OF encontrada.
export async function buscarOfsDoFornecedor(cnpj, email) {
  const chave = chaveIndiceFornecedor(cnpj, email);
  if (!chave) return [];
  const indice = await getDoc(doc(db, COL_INDICE_FORNECEDOR, chave));
  if (!indice.exists()) return [];
  const tokens = indice.data().tokens || [];
  const ofs = await Promise.all(tokens.map(t => buscarOfPorToken(t)));
  return ofs.filter(Boolean);
}

export async function excluirOf(token) {
  await deleteDoc(doc(db, COL_OF, token));
}

// Dispara (ou reenvia) a notificação ao fornecedor. Grava a OF, acrescenta
// este envio ao log (não sobrescreve os anteriores) e chama o EmailJS.
//
// "Enviado" aqui significa apenas que o EmailJS aceitou a requisição — não
// há confirmação de que o fornecedor recebeu de fato (endereço errado,
// caixa cheia etc. não aparecem neste ponto).
export async function dispararNotificacaoFornecedor(of, usuarioEmail) {
  if (!of.emailFornecedor) throw new Error("Informe o e-mail do fornecedor antes de disparar.");

  const agora = new Date();
  const token = of.token || crypto.randomUUID();
  const linkAceite = `${window.location.origin}${window.location.pathname}?of=${token}`;

  // Guarda quem disparou dentro da própria OF (visível na tela) — o
  // registro definitivo, à prova de edição, fica no log de auditoria.
  // Um reenvio NUNCA apaga nada: só empilha mais um registro em "envios",
  // sem mexer no status se a OF já tiver sido confirmada (o botão existe
  // só pra reenviar o link em caso de e-mail perdido, não pra "desconfirmar"
  // nada), e sem sobrescrever a data original de notificação.
  const primeiroDisparo = of.status === "Rascunho";
  const envioAtual = { data: agora.toLocaleString("pt-BR"), timestamp: agora.getTime(), disparadoPor: usuarioEmail || "desconhecido" };
  const payload = {
    ...of,
    token,
    ...(primeiroDisparo ? { status: "Aguardando Aceite" } : {}),
    dataEnvioTimestamp: of.dataEnvioTimestamp || agora.getTime(),
    dataEnvioStr: of.dataEnvioStr || agora.toLocaleString("pt-BR"),
    disparadoPor: usuarioEmail || "desconhecido",
    envios: [...(of.envios || []), envioAtual],
  };

  await setDoc(doc(db, COL_OF, token), payload, { merge: true });
  // "Disparar" tem seu próprio caminho de gravação (não passa por salvarOf) —
  // por isso precisa manter o índice do fornecedor aqui também. Sem isso, uma
  // OF criada indo direto pro "Disparar" (sem passar por "Salvar rascunho"
  // antes) nunca aparecia na Central do Fornecedor, mesmo existindo de verdade.
  await manterIndiceFornecedor(payload);

  const credenciais = of.emailJsSnapshot || EMAILJS_PADRAO;
  await emailjs.send(credenciais.serviceId, credenciais.templateIdOf, {
    to_email: of.emailFornecedor,
    empresa: of.empresa,
    numero_of: of.numeroOf,
    link_aceite: linkAceite,
  }, credenciais.publicKey);

  registrarEvento({
    tipo: TIPOS_EVENTO.OF_DISPARADA, usuarioEmail, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: primeiroDisparo
      ? "Primeiro disparo desta OF"
      : `Reenvio nº ${payload.envios.length - 1} (total de ${payload.envios.length} envios). Status mantido: ${of.status}.`,
  });

  return payload;
}

// ---------- Portal do fornecedor (público, sem login) ----------
// Lê UM documento específico pelo token — nunca lista a coleção. É a regra
// de segurança que impede um estranho de enumerar todas as OFs; aqui no
// código só usamos getDoc, nunca query/where nesta coleção pelo público.
export async function buscarOfPorToken(token) {
  const snap = await getDoc(doc(db, COL_OF, token));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// A confirmação registra apenas O MOMENTO EM QUE O FORNECEDOR CLICOU no
// link — não pede nem depende de nenhuma data informada por ele. O prazo
// (prazoLimite/prazoLimiteISO) é calculado pelo próprio sistema, a partir
// desse clique. A data real de chegada do produto é confirmada depois,
// pela própria equipe, numa tela à parte (ainda não construída).
export async function confirmarRecebimento(token, ofAtual) {
  const agora = new Date();
  const dataAceiteStr = agora.toLocaleString("pt-BR");
  const prazoDias = parseInt(ofAtual.prazoDias || 10, 10);

  // Busca só os feriados — é a única leitura pública além da própria OF (ver
  // firestore.rules: só o prefixo "feriado:" é liberado sem login, porque é
  // dado de calendário, sem nada sensível).
  let feriados = [];
  try {
    const { keys } = await storage.list("feriado:", false);
    const valores = await Promise.all(keys.map(k => storage.get(k, false).catch(() => null)));
    feriados = valores.filter(Boolean).map(v => JSON.parse(v.value));
  } catch (e) { console.error("Não foi possível carregar o calendário de feriados", e); }

  // O prazo conta a partir da PRIMEIRA notificação à empresa, não do momento
  // em que ela clica em confirmar — senão, quanto mais a empresa demora pra
  // confirmar, mais prazo ela ganha de graça. Só cai pra "agora" se por
  // algum motivo não houver data de notificação registrada (não deveria
  // acontecer, já que confirmar pressupõe ter sido notificado antes).
  const dataInicioPrazo = ofAtual.dataEnvioTimestamp ? new Date(ofAtual.dataEnvioTimestamp) : agora;
  const prazoLimiteISO = calcularPrazoLimiteComCalendario(
    prazoDias, ofAtual.tipoContagemPrazo || "corridos", feriados, ofAtual.municipioId, dataInicioPrazo);
  const prazoLimiteStr = fmtDateISO(prazoLimiteISO);
  const chave = `REC-${ofAtual.numeroOf}-${agora.getTime()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Dias sem expediente dentro do próprio prazo — para avisar o fornecedor
  // a não tentar entregar nessas datas. Calculado aqui (não salvo no
  // documento), porque é informativo, não faz parte do registro em si.
  const hojeISO = todayISO();
  const diasFechados = diasFechadosNoPeriodo(hojeISO, prazoLimiteISO, feriados, ofAtual.municipioId);

  const reciboImutavel = { chave, dataConfirmacao: dataAceiteStr, status: "CONFIRMADO" };

  // Primeiro grava a confirmação no registro real da OF — é aqui que a
  // chave passa a existir de verdade, dentro do documento que a regra de
  // segurança já protege com a transição validada.
  await updateDoc(doc(db, COL_OF, token), {
    status: "Em Dia", dataAceite: dataAceiteStr, prazoLimite: prazoLimiteStr, prazoLimiteISO,
    reciboImutavel, updatedAt: Date.now(),
  });

  // Só depois cria o índice chave -> token. A regra de segurança confere,
  // nesse momento, que a chave enviada é EXATAMENTE a que acabou de ser
  // gravada no registro real — por isso a ordem das duas escritas importa.
  await setDoc(doc(db, COL_INDICE_CHAVE, chave), { token });

  return {
    ...ofAtual, status: "Em Dia", dataAceite: dataAceiteStr, prazoLimite: prazoLimiteStr,
    prazoLimiteISO, reciboImutavel, diasFechados,
  };
}

// Confirmação da entrega, feita pela EQUIPE (autenticada), não pelo
// fornecedor. Informa a data real (ou marca que não chegou) e o sistema
// calcula sozinho se ficou dentro ou fora do prazo combinado.
export async function confirmarEntrega(token, dataEntregaReal, confirmadoPor) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");
  const confirmacaoEntrega = montarConfirmacaoEntrega(dataEntregaReal, of.prazoLimiteISO, confirmadoPor);
  await updateDoc(doc(db, COL_OF, token), { confirmacaoEntrega, updatedAt: Date.now() });

  registrarEvento({
    tipo: TIPOS_EVENTO.OF_ENTREGA_CONFIRMADA, usuarioEmail: confirmadoPor, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: confirmacaoEntrega.situacao,
  });

  return { ...of, confirmacaoEntrega };
}

// Fase 3: desfazer uma confirmação de entrega feita por engano. Só a
// equipe faz isso (autenticada) — nunca o fornecedor. Devolve a OF pro
// estado "aguardando confirmação da entrega", registra o motivo no log de
// auditoria, e avisa o fornecedor por e-mail de que a situação da OF dele
// foi revisada, incluindo o motivo informado.
export async function desfazerConfirmacaoEntrega(token, motivo, usuarioEmail) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");
  if (!of.confirmacaoEntrega) throw new Error("Esta OF não tem nenhuma confirmação de entrega para desfazer.");

  const confirmacaoAnterior = of.confirmacaoEntrega;
  await updateDoc(doc(db, COL_OF, token), { confirmacaoEntrega: null, updatedAt: Date.now() });

  registrarEvento({
    tipo: TIPOS_EVENTO.OF_ENTREGA_DESFEITA, usuarioEmail, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: `Situação anterior: "${confirmacaoAnterior.situacao}". Motivo do desfazimento: ${motivo}`,
  });

  if (of.emailFornecedor) {
    try {
      const credenciais = of.emailJsSnapshot || EMAILJS_PADRAO;
      await emailjs.send(credenciais.serviceId, credenciais.templateIdOf, {
        to_email: of.emailFornecedor,
        empresa: of.empresa,
        numero_of: of.numeroOf,
        link_aceite: `${window.location.origin}${window.location.pathname}?of=${token}`,
        mensagem: `A confirmação de entrega desta Ordem de Fornecimento foi revisada pela equipe e está novamente aguardando confirmação. Motivo: ${motivo}`,
      }, credenciais.publicKey);
    } catch (e) {
      console.error("A confirmação foi desfeita, mas não foi possível avisar o fornecedor por e-mail", e);
    }
  }

  return { ...of, confirmacaoEntrega: null };
}

// Fase 5: notificação formal de atraso/não entrega. Pode ser enviada quantas
// vezes forem necessárias — cada uma numerada e gravada com o inteiro teor,
// para documentar exatamente o que foi comunicado e quando.
export async function dispararNotificacaoAtraso(token, dadosNotificacao) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");

  const numeroSeq = (of.notificacoes?.length || 0) + 1;
  const dataDeHojeExtenso = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const textoCompleto = montarTextoNotificacaoAtraso({
    of, numeroSeq, nomeEntidade: dadosNotificacao.nomeEntidade,
    observacoes: dadosNotificacao.observacoes,
    assinanteNome: dadosNotificacao.assinanteNome, assinanteCargo: dadosNotificacao.assinanteCargo,
    prazoQuantidade: dadosNotificacao.prazoQuantidade, prazoUnidade: dadosNotificacao.prazoUnidade,
    dataDeHojeExtenso: `${dadosNotificacao.municipioNome || "Rio Verde"} – ${dadosNotificacao.uf || "GO"}, ${dataDeHojeExtenso}.`,
  });

  const registro = emptyNotificacao({
    numero: numeroSeq, textoCompleto,
    assinanteNome: dadosNotificacao.assinanteNome, assinanteCargo: dadosNotificacao.assinanteCargo,
    prazoQuantidade: dadosNotificacao.prazoQuantidade, prazoUnidade: dadosNotificacao.prazoUnidade,
    observacoes: dadosNotificacao.observacoes, usuarioEmail: dadosNotificacao.usuarioEmail,
  });

  const notificacoes = [...(of.notificacoes || []), registro];
  const mudancas = { notificacoes, updatedAt: Date.now() };
  if (!disputaAtiva(of)) {
    mudancas.disputaAtual = emptyDisputa(`Notificação de atraso nº ${numeroSeq} enviada`, "notificacao");
  }
  await updateDoc(doc(db, COL_OF, token), mudancas);

  const linkIntegra = linkNotificacao(
    `${window.location.origin}${window.location.pathname}`, token, numeroSeq
  );

  if (of.emailFornecedor) {
    const credenciais = of.emailJsSnapshot || EMAILJS_PADRAO;
    await emailjs.send(credenciais.serviceId, credenciais.templateIdNotificacao, {
      to_email: of.emailFornecedor,
      empresa: of.empresa,
      numero_of: of.numeroOf,
      numero_notificacao: numeroSeq,
      prazo: formatarPrazoNotificacao(dadosNotificacao.prazoQuantidade, dadosNotificacao.prazoUnidade),
      // A íntegra só fica visível depois de abrir o link — não vai mais
      // inteira dentro do corpo do e-mail (ver dominio/notificacao-of.js).
      link_notificacao: linkIntegra,
      texto_notificacao: textoCompleto, // mantido por compatibilidade, caso o template ainda use
    }, credenciais.publicKey);
  }

  registrarEvento({
    tipo: TIPOS_EVENTO.OF_NOTIFICACAO_ENVIADA, usuarioEmail: dadosNotificacao.usuarioEmail, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: `${numeroSeq}ª notificação — assinada por ${dadosNotificacao.assinanteNome} (${dadosNotificacao.assinanteCargo})`,
  });

  return { ...of, notificacoes };
}

// Confirmação manual de envio — quando a OF foi comunicada ao fornecedor
// por fora do sistema. Pode ser registrada a qualquer momento, quantas
// vezes for preciso. Se ainda não havia nenhuma data de notificação (nem
// disparo pelo sistema, nem outro registro manual), esta passa a ser —
// inclusive tirando a OF do estado "Rascunho", já que na prática ela já
// foi comunicada.
export async function registrarEnvioManual(token, dados) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");

  const registro = emptyEnvioManual(dados);
  const enviosManuais = [...(of.enviosManuais || []), registro];
  const mudancas = { enviosManuais, updatedAt: Date.now() };

  if (!of.dataEnvioTimestamp) {
    const dataObj = new Date(dados.dataEnvio + "T00:00:00");
    mudancas.dataEnvioTimestamp = dataObj.getTime();
    mudancas.dataEnvioStr = dataObj.toLocaleDateString("pt-BR");
    if (of.status === "Rascunho") mudancas.status = "Aguardando Aceite";
  }

  await updateDoc(doc(db, COL_OF, token), mudancas);

  registrarEvento({
    tipo: TIPOS_EVENTO.OF_ENVIO_MANUAL_REGISTRADO, usuarioEmail: dados.registradoPor, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: `Método: ${rotuloMetodoEnvio(dados.metodo)}. Data informada: ${dados.dataEnvio}.${dados.anexo ? " Com anexo." : ""}`,
  });

  return { ...of, ...mudancas };
}

export async function reportarDivergencia(token, texto) {
  const of = await buscarOfPorToken(token);
  const agora = new Date().toLocaleString("pt-BR");
  const mudancas = {
    status: "Divergência", motivoDivergencia: texto, dataDivergencia: agora, updatedAt: Date.now(),
  };
  // Abre a disputa automaticamente, com a própria divergência como a
  // primeira mensagem (o "empresa aponta o problema") — só se ainda não
  // houver uma disputa ativa nesta OF.
  if (of && !disputaAtiva(of)) {
    mudancas.disputaAtual = {
      ...emptyDisputa(`Divergência reportada pelo fornecedor: ${texto}`, "divergencia"),
      mensagens: [novaMensagemDisputa("fornecedor", texto)],
    };
  }
  await updateDoc(doc(db, COL_OF, token), mudancas);
}

// ---------- Modo Disputa ----------
// Conversa registrada e limitada (no máximo 5 passos) entre equipe e
// fornecedor, pra resolver uma divergência ou atraso sem virar um vaivém
// infinito. Ver dominio/disputa.js pra sequência completa.

export async function abrirDisputaManual(token, motivo, usuarioEmail) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");
  if (disputaAtiva(of)) throw new Error("Já existe uma disputa em andamento para esta OF.");
  const disputaAtual = emptyDisputa(motivo, "manual");
  await updateDoc(doc(db, COL_OF, token), { disputaAtual, updatedAt: Date.now() });
  registrarEvento({
    tipo: TIPOS_EVENTO.OF_DISPUTA_ABERTA, usuarioEmail, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: `Aberta manualmente. Motivo: ${motivo}`,
  });
  return { ...of, disputaAtual };
}

export async function adicionarMensagemDisputaFornecedor(token, texto, prazoPropostoISO) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");
  const atual = disputaAtiva(of);
  if (!atual) throw new Error("Não há disputa em andamento para esta OF.");
  const disputaAtual = {
    ...atual,
    mensagens: [...atual.mensagens, novaMensagemDisputa("fornecedor", texto, null, prazoPropostoISO)],
  };
  await updateDoc(doc(db, COL_OF, token), { disputaAtual, updatedAt: Date.now() });
  return { ...of, disputaAtual };
}

export async function adicionarMensagemDisputaEquipe(token, texto, nomeAssinante, usuarioEmail) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");
  const atual = disputaAtiva(of);
  if (!atual) throw new Error("Não há disputa em andamento para esta OF.");
  const disputaAtual = {
    ...atual,
    mensagens: [...atual.mensagens, novaMensagemDisputa("equipe", texto, nomeAssinante)],
  };
  await updateDoc(doc(db, COL_OF, token), { disputaAtual, updatedAt: Date.now() });
  registrarEvento({
    tipo: TIPOS_EVENTO.OF_DISPUTA_MENSAGEM, usuarioEmail, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: `Respondeu na disputa: ${texto}`,
  });
  return { ...of, disputaAtual };
}

// Solução final: encerra a disputa. "decisao" é "manter_prazo" ou
// "novo_prazo" — só aceita um novo prazo se o próprio fornecedor tiver
// proposto um em alguma mensagem (não dá pra equipe inventar um prazo que
// ninguém propôs, isso é decisão de outra tela, não desta conversa).
export async function encerrarDisputa(token, decisao, texto, decididoPor) {
  const of = await buscarOfPorToken(token);
  if (!of) throw new Error("Ordem de Fornecimento não encontrada.");
  const atual = disputaAtiva(of);
  if (!atual) throw new Error("Não há disputa em andamento para esta OF.");

  const prazoProposto = [...atual.mensagens].reverse().find(m => m.prazoPropostoISO)?.prazoPropostoISO;
  if (decisao === "novo_prazo" && !prazoProposto) {
    throw new Error("Nenhum prazo foi proposto pelo fornecedor nesta disputa.");
  }

  const disputaEncerrada = {
    ...atual, aberta: false,
    resolucao: {
      decisao, texto, quando: Date.now(), decididoPor,
      ...(decisao === "novo_prazo" ? { novoPrazoISO: prazoProposto } : {}),
    },
  };

  const mudancas = {
    disputaAtual: null,
    disputasEncerradas: [...(of.disputasEncerradas || []), disputaEncerrada],
    updatedAt: Date.now(),
  };
  if (decisao === "novo_prazo" && prazoProposto) {
    mudancas.prazoLimiteISO = prazoProposto;
    mudancas.prazoLimite = fmtDateISO(prazoProposto);
  }

  await updateDoc(doc(db, COL_OF, token), mudancas);
  registrarEvento({
    tipo: TIPOS_EVENTO.OF_DISPUTA_ENCERRADA, usuarioEmail: decididoPor, secretariaId: of.secretariaId,
    alvo: { tipo: "of", id: token, rotulo: `OF-${of.numeroOf}` },
    detalhes: `Solução final: ${decisao === "novo_prazo" ? `novo prazo aceito (${mudancas.prazoLimite})` : "mantido o prazo original"}. ${texto}`,
  });
  return { ...of, ...mudancas };
}

// ---------- Conferência pública do recibo (por chave digitada) ----------
// Duas leituras, ambas por "get" direto (nunca "list"): primeiro resolve a
// chave para o token pelo índice, depois busca a OF de verdade. Confere de
// novo, no fim, que a chave bate com a gravada no registro — cinto e
// suspensório, mesmo a regra do Firestore já impedindo um índice forjado.
export async function buscarReciboPorChave(chave) {
  const chaveLimpa = chave.trim();
  const indice = await getDoc(doc(db, COL_INDICE_CHAVE, chaveLimpa));
  if (!indice.exists()) return null;

  const of = await buscarOfPorToken(indice.data().token);
  if (!of || of.reciboImutavel?.chave !== chaveLimpa) return null;
  return of;
}
