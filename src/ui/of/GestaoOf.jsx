/**
 * Gestão de Ordens de Fornecimento — tela dentro do painel autenticado.
 *
 * Importa o PDF (extração automática, best-effort) ou cria manualmente,
 * busca o fornecedor já cadastrado pelo CNPJ, e dispara a notificação por
 * e-mail com confirmação prévia — nunca envia direto ao clicar.
 */

import React, { useState, useRef } from "react";
import { Upload, Plus, Trash2, Mail, Printer, Download, Pencil, AlertCircle, Info, Loader2, PackageCheck, Link2, Check, Undo2, X, MoreHorizontal, MessageCircle, Send, FileText, Settings2, ArrowUp, ArrowDown, ArrowUpDown, Camera, MessageSquare, MessageSquareWarning } from "lucide-react";
import { C } from "../tokens.js";
import { ConfirmarExclusao, LinhaDoTempoDisputa } from "../comuns/index.jsx";
import { extrairDadosDoPdf, gerarNumeroOfSugerido, numeroOfDuplicado,
  calcularSituacao, emptyOf,
  GRUPOS_ABA_OF, grupoAbaDaSituacao, ordenarLinhasOf,
  gerarLinkWhatsApp, montarMensagemWhatsApp } from "../../dominio/of.js";
import { normalizarCnpj, formatarCnpj, cnpjValido,
  buscarFornecedorPorCnpj, upsertFornecedor, resumoHistoricoFornecedor } from "../../dominio/fornecedores.js";
import { lerPdfDeArquivo, salvarOf, excluirOf, dispararNotificacaoFornecedor, confirmarEntrega, desfazerConfirmacaoEntrega, dispararNotificacaoAtraso, registrarEnvioManual, abrirDisputaManual, adicionarMensagemDisputaEquipe, encerrarDisputa } from "../../of-servico.js";
import { proximoTurno, precisaAvisoSemResposta, disputaAtiva } from "../../dominio/disputa.js";
import { METODOS_ENVIO_MANUAL, rotuloMetodoEnvio } from "../../dominio/envio-manual.js";
import { comprimirImagemAnexo } from "../../dominio/imagem.js";
import { montarSecoesPacote } from "../../dominio/pacote-processo.js";
import { listarEventos } from "../../auditoria-servico.js";
import { montarTextoNotificacaoAtraso, linkNotificacao, mensagemWhatsAppNotificacao } from "../../dominio/notificacao-of.js";
import { ImportarLoteModal } from "./ImportarLoteModal.jsx";
import { ComprovanteOf } from "./ComprovanteOf.jsx";
import { renderToStaticMarkup } from "react-dom/server";
import { resolverCabecalho, prepararCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { resolverCredenciaisEmailJs } from "../../dominio/emailjs-config.js";
import { reparticoesDaEntidade } from "../../dominio/reparticoes.js";
import { gerarQrCodeDataUrl } from "../../qrcode-servico.js";
import { todayISO, fmtDateISO, fmtDate } from "../../dominio/datas.js";

const COR_SITUACAO = {
  "rascunho": C.inkMuted, "aguardando": C.brass, "sem-resposta": "#fd7e14",
  "divergencia": "#b45309", "vencido": C.red, "em-dia": C.green, "atrasado": C.red,
  "aguardando-entrega": C.brass, "aguardando-confirmacao": "#fd7e14", "nao-entregue": C.red,
};

export function GestaoOf({ ofs, fornecedores, secretarias, municipios, usuarios = [], reparticoes = [], onSalvarReparticao, secretariaId, municipioId, onRecarregar, onSalvarFornecedor, emailUsuario }) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(emptyOf());
  const [lendoPdf, setLendoPdf] = useState(false);
  const [aExcluir, setAExcluir] = useState(null);
  const [aDisparar, setADisparar] = useState(null); // OF aguardando confirmação de envio
  const [confirmandoEntregaDe, setConfirmandoEntregaDe] = useState(null); // OF cuja entrega está sendo confirmada
  const [desfazendoEntregaDe, setDesfazendoEntregaDe] = useState(null); // OF cuja confirmação está sendo desfeita
  const [motivoDesfazer, setMotivoDesfazer] = useState("");
  const [desfazendo, setDesfazendo] = useState(false);
  const [notificandoDe, setNotificandoDe] = useState(null); // OF sendo notificada
  const [registrandoEnvioDe, setRegistrandoEnvioDe] = useState(null); // OF cujo envio manual está sendo registrado
  const [disputaDe, setDisputaDe] = useState(null); // OF cuja conversa/disputa está aberta na tela
  const [abrindoDisputaManual, setAbrindoDisputaManual] = useState(false);
  const [motivoDisputaManual, setMotivoDisputaManual] = useState("");
  const [mensagemEquipeDisputa, setMensagemEquipeDisputa] = useState("");
  const [assinanteEquipeDisputa, setAssinanteEquipeDisputa] = useState("");
  const [decisaoFinalDisputa, setDecisaoFinalDisputa] = useState("manter_prazo");
  const [textoFinalDisputa, setTextoFinalDisputa] = useState("");
  const [enviandoDisputaEquipe, setEnviandoDisputaEquipe] = useState(false);
  const [envioMetodo, setEnvioMetodo] = useState("whatsapp");
  const [envioData, setEnvioData] = useState(todayISO());
  const [envioObs, setEnvioObs] = useState("");
  const [envioAnexo, setEnvioAnexo] = useState(null); // data URL já comprimida
  const [comprimindoAnexo, setComprimindoAnexo] = useState(false);
  const [salvandoEnvioManual, setSalvandoEnvioManual] = useState(false);
  const [notifObs, setNotifObs] = useState("");
  const [notifAssinanteNome, setNotifAssinanteNome] = useState("");
  const [notifAssinanteCargo, setNotifAssinanteCargo] = useState("");
  const [notifPrazoQtd, setNotifPrazoQtd] = useState(24);
  const [notifPrazoUnidade, setNotifPrazoUnidade] = useState("horas");
  const [enviandoNotificacao, setEnviandoNotificacao] = useState(false);
  const [verNotificacoesDe, setVerNotificacoesDe] = useState(null); // OF cujas notificações estão sendo listadas
  const [acoesDe, setAcoesDe] = useState(null); // OF cujo painel de ações está aberto
  const [linkNotifCopiado, setLinkNotifCopiado] = useState(null); // "token_numero" copiado agora
  const [filtroAba, setFiltroAba] = useState("todas");
  const [filtroReparticao, setFiltroReparticao] = useState(""); // "" = todas as repartições
  const [ordenacao, setOrdenacao] = useState({ campo: "prazoLimite", direcao: "asc" });

  function alternarOrdenacao(campo) {
    setOrdenacao(prev => prev.campo === campo
      ? { campo, direcao: prev.direcao === "asc" ? "desc" : "asc" }
      : { campo, direcao: "asc" });
  }
  const [loteAberto, setLoteAberto] = useState(false);
  const [linkCopiadoDe, setLinkCopiadoDe] = useState(null); // token da OF cujo link acabou de ser copiado

  function linkDaOf(item) {
    return `${window.location.origin}${window.location.pathname}?of=${item.token}`;
  }

  async function copiarLink(item) {
    try {
      await navigator.clipboard.writeText(linkDaOf(item));
      setLinkCopiadoDe(item.token);
      setTimeout(() => setLinkCopiadoDe(null), 2000);
    } catch (e) {
      setErro("Não foi possível copiar o link automaticamente. Copie manualmente: " + linkDaOf(item));
    }
  }

  function abrirWhatsApp(item) {
    const link = gerarLinkWhatsApp(item.telefoneFornecedor, montarMensagemWhatsApp(item, linkDaOf(item)));
    window.open(link, "_blank");
  }
  const [dataEntregaForm, setDataEntregaForm] = useState(todayISO());
  const [naoEntregueForm, setNaoEntregueForm] = useState(false);
  const [salvandoEntrega, setSalvandoEntrega] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const inputRef = useRef(null);

  function abrirNova() {
    if (!secretariaId) { setErro("Selecione uma entidade específica antes de criar uma OF."); return; }
    setEditando(emptyOf({ numeroOf: gerarNumeroOfSugerido(), secretariaId, municipioId }));
    setErro("");
    setModalAberto(true);
  }

  async function handleImportarPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!secretariaId) { setErro("Selecione uma entidade específica antes de importar uma OF."); e.target.value = ""; return; }
    setLendoPdf(true);
    setErro("");
    try {
      const { pdfBase64, textoCompleto } = await lerPdfDeArquivo(file);
      const extraido = extrairDadosDoPdf(textoCompleto);
      const cnpjExtraidoNormalizado = normalizarCnpj(extraido.cnpj);
      const fornecedor = cnpjExtraidoNormalizado ? buscarFornecedorPorCnpj(fornecedores, cnpjExtraidoNormalizado) : null;
      setEditando(emptyOf({
        numeroOf: extraido.numeroOf || gerarNumeroOfSugerido(),
        empresa: fornecedor?.razaoSocial || extraido.empresa,
        cnpj: cnpjExtraidoNormalizado,
        emailFornecedor: fornecedor?.email || "",
        telefoneFornecedor: fornecedor?.telefone || "",
        pdfBase64,
        secretariaId, municipioId,
      }));
      setModalAberto(true);
    } catch (e2) {
      setErro("Não foi possível ler o PDF: " + (e2.message || e2));
    }
    setLendoPdf(false);
    e.target.value = "";
  }

  // Ao sair do campo CNPJ, busca no cadastro — se achar, preenche o resto.
  function aoSairDoCnpj() {
    const fornecedor = buscarFornecedorPorCnpj(fornecedores, editando.cnpj);
    setEditando(prev => ({
      ...prev,
      // Normaliza aqui, na origem — é o que garante que toda comparação de
      // CNPJ no resto do sistema (relatórios, histórico, etc.) bata certo,
      // sem precisar lembrar de normalizar em cada lugar que compara.
      cnpj: normalizarCnpj(prev.cnpj),
      empresa: fornecedor ? (prev.empresa || fornecedor.razaoSocial) : prev.empresa,
      emailFornecedor: fornecedor ? (prev.emailFornecedor || fornecedor.email) : prev.emailFornecedor,
      telefoneFornecedor: fornecedor ? (prev.telefoneFornecedor || fornecedor.telefone) : prev.telefoneFornecedor,
    }));
    if (fornecedor) {
      setAviso(`Fornecedor já cadastrado: ${fornecedor.razaoSocial}`);
      setTimeout(() => setAviso(""), 4000);
    }
  }

  async function persistirFornecedor(of) {
    if (!cnpjValido(of.cnpj)) return;
    const atualizado = upsertFornecedor(fornecedores, {
      cnpj: of.cnpj, razaoSocial: of.empresa, email: of.emailFornecedor, telefone: of.telefoneFornecedor,
    });
    onSalvarFornecedor(atualizado);
  }

  // "Congela" o timbre da entidade dentro da própria OF, uma única vez —
  // é o que permite a tela pública do fornecedor (sem acesso à lista de
  // entidades) mostrar o mesmo timbre que o admin vê, sem precisar de
  // nenhuma leitura nova no banco.
  async function comTimbreSnapshot(item) {
    const secretariaDaOf = secretarias?.find(s => s.id === item.secretariaId);
    const comTimbre = item.timbreSnapshot ? item
      : { ...item, timbreSnapshot: await prepararCabecalho(resolverCabecalho(item, secretarias, TIMBRE_PADRAO)) };
    const comEmailJs = comTimbre.emailJsSnapshot ? comTimbre
      : { ...comTimbre, emailJsSnapshot: resolverCredenciaisEmailJs(secretariaDaOf) };
    return comEmailJs.nomeEntidadeSnapshot ? comEmailJs
      : { ...comEmailJs, nomeEntidadeSnapshot: secretariaDaOf?.sigla || secretariaDaOf?.nome || null };
  }

  async function handleSalvarRascunho(e) {
    e.preventDefault();
    if (numeroOfDuplicado(editando.numeroOf, ofs, editando.id)) {
      setErro(`Já existe outra OF com o número "${editando.numeroOf}". Confira antes de salvar.`);
      return;
    }
    try {
      await salvarOf(await comTimbreSnapshot(editando));
      await persistirFornecedor(editando);
      setModalAberto(false);
      onRecarregar();
    } catch (e2) {
      setErro("Erro ao salvar: " + (e2.message || e2));
    }
  }

  async function confirmarDisparo() {
    setEnviando(true);
    setErro("");
    try {
      await dispararNotificacaoFornecedor(await comTimbreSnapshot(aDisparar), emailUsuario);
      await persistirFornecedor(aDisparar);
      setADisparar(null);
      setModalAberto(false);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível enviar: " + (e2.message || e2));
    }
    setEnviando(false);
  }

  function abrirConfirmacaoEntrega(item) {
    const jaTem = item.confirmacaoEntrega;
    setDataEntregaForm(jaTem?.dataEntregaReal || todayISO());
    setNaoEntregueForm(jaTem?.situacao === "nao-entregue");
    setConfirmandoEntregaDe(item);
    setErro("");
  }

  async function handleConfirmarEntrega() {
    setSalvandoEntrega(true);
    try {
      await confirmarEntrega(
        confirmandoEntregaDe.token,
        naoEntregueForm ? null : dataEntregaForm,
        emailUsuario
      );
      setConfirmandoEntregaDe(null);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível registrar a entrega: " + (e2.message || e2));
    }
    setSalvandoEntrega(false);
  }

  function abrirDesfazerEntrega(item) {
    setDesfazendoEntregaDe(item);
    setMotivoDesfazer("");
    setErro("");
  }

  async function handleDesfazerEntrega() {
    if (!motivoDesfazer.trim()) { setErro("Informe o motivo do desfazimento."); return; }
    setDesfazendo(true);
    try {
      await desfazerConfirmacaoEntrega(desfazendoEntregaDe.token, motivoDesfazer.trim(), emailUsuario);
      setDesfazendoEntregaDe(null);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível desfazer: " + (e2.message || e2));
    }
    setDesfazendo(false);
  }

  function abrirNotificacao(item) {
    setNotificandoDe(item);
    setNotifObs("");
    setNotifAssinanteNome("");
    setNotifAssinanteCargo("");
    setNotifPrazoQtd(24);
    setNotifPrazoUnidade("horas");
    setErro("");
  }

  function linkDaNotificacao(item, numero) {
    return linkNotificacao(`${window.location.origin}${window.location.pathname}`, item.token, numero);
  }

  async function copiarLinkNotificacao(item, numero) {
    try {
      await navigator.clipboard.writeText(linkDaNotificacao(item, numero));
      setLinkNotifCopiado(`${item.token}_${numero}`);
      setTimeout(() => setLinkNotifCopiado(null), 2000);
    } catch (e) {
      setErro("Não foi possível copiar. Link: " + linkDaNotificacao(item, numero));
    }
  }

  function abrirWhatsAppNotificacao(item, numero) {
    const link = linkDaNotificacao(item, numero);
    window.open(gerarLinkWhatsApp(item.telefoneFornecedor, mensagemWhatsAppNotificacao(item, numero, link)), "_blank");
  }

  function textoNotificacaoPreview() {
    if (!notificandoDe) return "";
    const sec = secretarias?.find(s => s.id === notificandoDe.secretariaId);
    const mun = municipios?.find(m => m.id === (sec?.municipioId || notificandoDe.municipioId));
    const numeroSeq = (notificandoDe.notificacoes?.length || 0) + 1;
    return montarTextoNotificacaoAtraso({
      of: notificandoDe, numeroSeq,
      nomeEntidade: sec?.nome || "Entidade não identificada",
      observacoes: notifObs,
      assinanteNome: notifAssinanteNome || "[nome de quem assina]",
      assinanteCargo: notifAssinanteCargo || "[cargo]",
      prazoQuantidade: notifPrazoQtd, prazoUnidade: notifPrazoUnidade,
      dataDeHojeExtenso: `${mun?.nome || "Rio Verde"} – ${mun?.uf || "GO"}, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.`,
    });
  }

  async function handleEnviarNotificacao() {
    if (!notifAssinanteNome.trim() || !notifAssinanteCargo.trim()) {
      setErro("Informe quem está assinando (nome e cargo).");
      return;
    }
    setEnviandoNotificacao(true);
    try {
      const sec = secretarias?.find(s => s.id === notificandoDe.secretariaId);
      const mun = municipios?.find(m => m.id === (sec?.municipioId || notificandoDe.municipioId));
      await dispararNotificacaoAtraso(notificandoDe.token, {
        nomeEntidade: sec?.nome || "Entidade não identificada",
        observacoes: notifObs,
        assinanteNome: notifAssinanteNome.trim(),
        assinanteCargo: notifAssinanteCargo.trim(),
        prazoQuantidade: notifPrazoQtd,
        prazoUnidade: notifPrazoUnidade,
        municipioNome: mun?.nome, uf: mun?.uf,
        usuarioEmail: emailUsuario,
      });
      setNotificandoDe(null);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível enviar a notificação: " + (e2.message || e2));
    }
    setEnviandoNotificacao(false);
  }

  function abrirDisputa(item) {
    setDisputaDe(item);
    setAbrindoDisputaManual(false);
    setMotivoDisputaManual("");
    setMensagemEquipeDisputa("");
    setAssinanteEquipeDisputa(emailUsuario || "");
    setDecisaoFinalDisputa("manter_prazo");
    setTextoFinalDisputa("");
    setErro("");
  }

  async function handleAbrirDisputaManual() {
    if (!motivoDisputaManual.trim()) return;
    setEnviandoDisputaEquipe(true);
    setErro("");
    try {
      const atualizado = await abrirDisputaManual(disputaDe.token, motivoDisputaManual.trim(), emailUsuario);
      setDisputaDe(atualizado);
      setAbrindoDisputaManual(false);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível abrir a disputa: " + (e2.message || e2));
    }
    setEnviandoDisputaEquipe(false);
  }

  async function handleResponderDisputaEquipe() {
    if (!mensagemEquipeDisputa.trim()) return;
    setEnviandoDisputaEquipe(true);
    setErro("");
    try {
      const atualizado = await adicionarMensagemDisputaEquipe(disputaDe.token, mensagemEquipeDisputa.trim(), assinanteEquipeDisputa.trim(), emailUsuario);
      setDisputaDe(atualizado);
      setMensagemEquipeDisputa("");
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível enviar a resposta: " + (e2.message || e2));
    }
    setEnviandoDisputaEquipe(false);
  }

  async function handleEncerrarDisputa() {
    if (!textoFinalDisputa.trim()) return;
    setEnviandoDisputaEquipe(true);
    setErro("");
    try {
      const atualizado = await encerrarDisputa(disputaDe.token, decisaoFinalDisputa, textoFinalDisputa.trim(), emailUsuario);
      setDisputaDe(atualizado);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível encerrar a disputa: " + (e2.message || e2));
    }
    setEnviandoDisputaEquipe(false);
  }

  function abrirRegistrarEnvio(item) {
    setRegistrandoEnvioDe(item);
    setEnvioMetodo("whatsapp");
    setEnvioData(todayISO());
    setEnvioObs("");
    setEnvioAnexo(null);
    setErro("");
  }

  async function handleAnexarImagem(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setComprimindoAnexo(true);
    try {
      const dataUrlOriginal = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const comprimida = await comprimirImagemAnexo(dataUrlOriginal);
      setEnvioAnexo(comprimida);
    } catch (e2) {
      setErro("Não foi possível processar a imagem. Tente outra.");
    }
    setComprimindoAnexo(false);
    e.target.value = "";
  }

  async function handleRegistrarEnvioManual() {
    setSalvandoEnvioManual(true);
    setErro("");
    try {
      await registrarEnvioManual(registrandoEnvioDe.token, {
        metodo: envioMetodo, dataEnvio: envioData, observacao: envioObs,
        anexo: envioAnexo, registradoPor: emailUsuario,
      });
      setRegistrandoEnvioDe(null);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível registrar: " + (e2.message || e2));
    }
    setSalvandoEnvioManual(false);
  }

  async function handleExcluir(item) {
    try {
      await excluirOf(item.token);
      setAExcluir(null);
      onRecarregar();
    } catch (e2) {
      setErro("Erro ao excluir: " + (e2.message || e2));
    }
  }

  async function imprimirRecibo(item) {
    const linkConferencia = `${window.location.origin}${window.location.pathname}?recibo=${item.reciboImutavel?.chave}`;

    // Abre a janela JÁ, antes de qualquer espera — chamar window.open depois
    // de um await corre o risco de o navegador bloquear como pop-up, por não
    // estar mais diretamente ligado ao clique do usuário.
    const janela = window.open("", "_blank");
    janela.document.write("<p style='font-family:sans-serif;padding:40px;'>Preparando o comprovante...</p>");

    // Usa o timbre já congelado na OF, se existir (OFs criadas antes desta
    // mudança ainda não têm — resolve ao vivo só nesse caso, como antes).
    const [cabecalho, qrCodeDataUrl] = await Promise.all([
      item.timbreSnapshot || prepararCabecalho(resolverCabecalho(item, secretarias, TIMBRE_PADRAO)),
      gerarQrCodeDataUrl(linkConferencia).catch(() => null),
    ]);

    // Mesmo componente usado na tela do fornecedor — é o que garante que os
    // dois lados veem exatamente o mesmo comprovante, sem divergência.
    const htmlComprovante = renderToStaticMarkup(
      React.createElement(ComprovanteOf, { of: item, cabecalho, qrCodeDataUrl, linkConferencia })
    );

    janela.document.open();
    janela.document.write(`
      <html><head><title>Comprovante - OF nº ${item.numeroOf}</title>
      <style>body{font-family:sans-serif;padding:40px;color:#111;margin:0}</style>
      </head><body>
      ${htmlComprovante}
      <div class="botao-imprimir" style="text-align:center;margin-top:24px;">
        <button onclick="window.print()" style="background:#1C2E4A;color:#fff;border:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer;">
          🖨️ Imprimir / Salvar como PDF
        </button>
      </div>
      <style>@media print { .botao-imprimir { display: none; } }</style>
      </body></html>`);
    janela.document.close();
  }

  async function gerarPacoteEncaminhamento(item) {
    const janela = window.open("", "_blank");
    janela.document.write("<p style='font-family:sans-serif;padding:40px;'>Reunindo os dados do processo...</p>");

    const [cabecalho, eventosAuditoria] = await Promise.all([
      item.timbreSnapshot || prepararCabecalho(resolverCabecalho(item, secretarias, TIMBRE_PADRAO)),
      listarEventos().catch(() => []),
    ]);
    const secoes = montarSecoesPacote(item, eventosAuditoria, usuarios);

    const htmlCabecalho = cabecalho?.tipo === "imagem" && cabecalho.dataUrl
      ? `<img src="${cabecalho.dataUrl}" style="max-width:100%; max-height:90px; display:block; margin:0 auto 12px;" />`
      : cabecalho?.tipo === "texto" && cabecalho.html
        ? `<div style="text-align:center; margin-bottom:12px;">${cabecalho.html}</div>`
        : `<h2 style="text-align:center; margin-bottom:4px;">Prefeitura Municipal</h2>`;

    const listaHtml = (itens) => itens.length
      ? `<ul>${itens.map(i => `<li>${i}</li>`).join("")}</ul>`
      : `<p class="vazio">Nada registrado até o momento.</p>`;

    const notificacoesHtml = secoes.notificacoes.length
      ? secoes.notificacoes.map(n => `
          <div class="notif">
            <p><b>${n.titulo}</b></p>
            <p style="font-size:11px;color:#6B675E;">Assinado por: ${n.assinante}</p>
            <div class="texto-notif">${n.texto}</div>
          </div>`).join("")
      : `<p class="vazio">Nenhuma notificação de atraso foi enviada para esta OF.</p>`;

    janela.document.open();
    janela.document.write(`
      <html><head><title>Pacote de encaminhamento - OF nº ${item.numeroOf}</title>
      <style>
        body{font-family:sans-serif;padding:40px;color:#111;max-width:760px;margin:0 auto}
        .cabecalho{border-bottom:2px solid #1C2E4A;padding-bottom:16px;margin-bottom:20px}
        h2{color:#1C2E4A;font-size:15px;border-bottom:1px solid #DAD3C2;padding-bottom:6px;margin-top:26px}
        ul{padding-left:20px;font-size:13px;line-height:1.7}
        .vazio{font-size:12px;color:#6B675E;font-style:italic}
        .notif{background:#F1ECDF;border:1px solid #DAD3C2;border-radius:8px;padding:14px;margin-top:10px}
        .texto-notif{white-space:pre-wrap;font-size:12px;background:#fff;border-radius:6px;padding:10px;margin-top:8px}
        .rodape{font-size:11px;color:#6B675E;text-align:center;margin-top:30px}
      </style>
      </head><body>
      <div class="cabecalho">
        ${htmlCabecalho}
        <h1 style="text-align:center;margin:8px 0 0;font-size:18px;">Pacote de Encaminhamento — Ordem de Fornecimento</h1>
        <p style="text-align:center;font-size:12px;color:#6B675E;margin:4px 0 0;">Gerado em ${fmtDate(Date.now())}</p>
      </div>

      <h2>Dados gerais</h2>
      ${listaHtml(secoes.dadosGerais)}

      <h2>Histórico de disparo</h2>
      ${listaHtml(secoes.historicoDisparo)}

      <h2>Confirmação do fornecedor</h2>
      ${listaHtml(secoes.confirmacaoFornecedor)}

      <h2>Confirmação da entrega</h2>
      ${listaHtml(secoes.confirmacaoEntrega)}

      <h2>Notificações de atraso enviadas</h2>
      ${notificacoesHtml}

      <h2>Linha do tempo (log de auditoria desta OF)</h2>
      ${listaHtml(secoes.eventosDaOf)}

      <p class="rodape">Documento gerado eletronicamente pelo Hub Compras Públicas, reunindo os registros já existentes no sistema.</p>
      <div class="botao-imprimir" style="text-align:center;margin-top:24px;">
        <button onclick="window.print()" style="background:#1C2E4A;color:#fff;border:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer;">
          🖨️ Imprimir / Salvar como PDF
        </button>
      </div>
      <style>@media print { .botao-imprimir { display: none; } }</style>
      </body></html>`);
    janela.document.close();
  }

  const todasAsLinhas = ofs.map(item => ({ item, situacao: calcularSituacao(item) }));
  const contagemPorGrupo = GRUPOS_ABA_OF.reduce((acc, g) => {
    acc[g.id] = g.id === "todas" ? todasAsLinhas.length
      : todasAsLinhas.filter(l => grupoAbaDaSituacao(l.situacao.chave) === g.id).length;
    return acc;
  }, {});
  const linhasFiltradasPorAba = filtroAba === "todas" ? todasAsLinhas
    : todasAsLinhas.filter(l => grupoAbaDaSituacao(l.situacao.chave) === filtroAba);
  const linhasFiltradas = !filtroReparticao ? linhasFiltradasPorAba
    : linhasFiltradasPorAba.filter(l => l.item.reparticaoId === filtroReparticao);
  const linhas = ordenarLinhasOf(linhasFiltradas, ordenacao.campo, ordenacao.direcao);
  const reparticoesDaEntidadeAtiva = reparticoesDaEntidade(secretariaId, reparticoes);

  // Sem uma entidade específica selecionada (ex.: "Todas as Entidades"), não
  // existe dono claro para a nova OF. Já aconteceu de isso cair em silêncio
  // na entidade mais antiga cadastrada — agora bloqueia de verdade.
  const semEntidadeEspecifica = !secretariaId;

  // Disputa aberta: assume a tela inteira, em vez de um modal por cima da
  // tabela — pedido explícito, pra ficar mais fácil de ler a conversa.
  if (disputaDe) {
    const disputa = disputaAtiva(disputaDe);
    const turno = disputa ? proximoTurno(disputa) : null;
    const semResposta = disputa && precisaAvisoSemResposta(disputa);
    const prazoJaProposto = disputa ? [...disputa.mensagens].reverse().find(m => m.prazoPropostoISO)?.prazoPropostoISO : null;

    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setDisputaDe(null)} className="flex items-center gap-1.5 text-sm font-medium mb-4" style={{ color: C.inkMuted }}>
          ← Voltar pra Ordens de Fornecimento
        </button>

        <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
          <MessageSquare size={15} />
          <span className="text-xs font-semibold tracking-widest uppercase">Disputa</span>
        </div>
        <h1 className="serif text-2xl font-semibold mb-4" style={{ color: C.navy }}>OF nº {disputaDe.numeroOf}</h1>

        {erro && (
          <div className="mb-4 p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
            <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.red }} />{erro}
          </div>
        )}

        {!disputa ? (
          <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
            <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
              Abre uma conversa registrada com o fornecedor — útil pra formalizar algo combinado por telefone,
              ou pra dar espaço pra ele responder a uma notificação ou divergência. No máximo 5 idas e vindas:
              ele aponta, a equipe responde, ele responde de novo, e a equipe dá a solução final.
            </p>
            <textarea rows={3} value={motivoDisputaManual} onChange={e => setMotivoDisputaManual(e.target.value)}
              placeholder="Motivo da abertura (ex.: fornecedor ligou pedindo mais prazo por falta de material)"
              className="w-full px-3 py-2 rounded-lg border text-sm mb-3" style={{ borderColor: C.border }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDisputaDe(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={handleAbrirDisputaManual} disabled={enviandoDisputaEquipe || !motivoDisputaManual.trim()}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.navy, color: C.paper }}>
                {enviandoDisputaEquipe ? "Abrindo..." : "Abrir disputa"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>{disputa.motivoAbertura}</p>

            <LinhaDoTempoDisputa disputa={disputa} />

            {semResposta && (
              <div className="rounded-lg p-2.5 my-4 text-xs" style={{ background: "#fff3cd", color: "#664d03" }}>
                ⚠️ Fornecedor sem responder há mais de 48h.
              </div>
            )}

            {turno === "equipe" && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: C.border }}>
                <input value={assinanteEquipeDisputa} onChange={e => setAssinanteEquipeDisputa(e.target.value)}
                  placeholder="Seu nome (aparece na conversa)"
                  className="w-full px-3 py-2 rounded-lg border text-sm mb-2" style={{ borderColor: C.border }} />
                <textarea rows={4} value={mensagemEquipeDisputa} onChange={e => setMensagemEquipeDisputa(e.target.value)}
                  placeholder="Sua resposta ao fornecedor — seja o mais detalhado possível..."
                  className="w-full px-3 py-2 rounded-lg border text-sm mb-3" style={{ borderColor: C.border }} />
                <div className="flex justify-end gap-2">
                  <button onClick={handleResponderDisputaEquipe} disabled={enviandoDisputaEquipe || !mensagemEquipeDisputa.trim()}
                    className="px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.navy, color: C.paper }}>
                    {enviandoDisputaEquipe ? "Enviando..." : "Enviar resposta"}
                  </button>
                </div>
              </div>
            )}

            {turno === "fornecedor" && (
              <p className="text-xs italic mt-4 pt-4 border-t" style={{ color: C.inkMuted, borderColor: C.border }}>
                Aguardando resposta do fornecedor.
              </p>
            )}

            {turno === "equipe_decidir" && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: C.border }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkMuted }}>Solução final</p>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setDecisaoFinalDisputa("manter_prazo")}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: decisaoFinalDisputa === "manter_prazo" ? C.navy : C.border, background: decisaoFinalDisputa === "manter_prazo" ? C.navy : "white", color: decisaoFinalDisputa === "manter_prazo" ? "white" : C.ink }}>
                    Manter prazo original
                  </button>
                  <button onClick={() => setDecisaoFinalDisputa("novo_prazo")} disabled={!prazoJaProposto}
                    title={!prazoJaProposto ? "O fornecedor não propôs nenhum novo prazo nesta conversa" : ""}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-40"
                    style={{ borderColor: decisaoFinalDisputa === "novo_prazo" ? C.brass : C.border, background: decisaoFinalDisputa === "novo_prazo" ? C.brass : "white", color: decisaoFinalDisputa === "novo_prazo" ? C.navyDark : C.ink }}>
                    Acatar novo prazo{prazoJaProposto ? ` (${fmtDateISO(prazoJaProposto)})` : ""}
                  </button>
                </div>
                <textarea rows={3} value={textoFinalDisputa} onChange={e => setTextoFinalDisputa(e.target.value)}
                  placeholder="Explique a decisão final..."
                  className="w-full px-3 py-2 rounded-lg border text-sm mb-3" style={{ borderColor: C.border }} />
                <div className="flex justify-end gap-2">
                  <button onClick={handleEncerrarDisputa} disabled={enviandoDisputaEquipe || !textoFinalDisputa.trim()}
                    className="px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.green, color: "white" }}>
                    {enviandoDisputaEquipe ? "Encerrando..." : "Encerrar com esta solução"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {disputaDe.disputasEncerradas?.length > 0 && (
          <div className="mt-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkMuted }}>
              Disputas anteriores, já encerradas
            </p>
            <div className="space-y-2">
              {disputaDe.disputasEncerradas.map((d, i) => (
                <div key={i} className="rounded-lg border p-3 text-xs" style={{ borderColor: C.border, background: "white" }}>
                  <p style={{ color: C.ink }}>{d.motivoAbertura}</p>
                  <p style={{ color: C.inkMuted, marginTop: 4 }}>
                    Solução: {d.resolucao?.decisao === "novo_prazo" ? `novo prazo aceito (${fmtDateISO(d.resolucao.novoPrazoISO)})` : "prazo original mantido"} — {d.resolucao?.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Mail size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Fornecedores</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Ordens de Fornecimento</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLoteAberto(true)} disabled={semEntidadeEspecifica}
            title={semEntidadeEspecifica ? "Selecione uma entidade específica primeiro" : "Importa vários PDFs de OF de uma vez"}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: C.brassLight, color: C.navyDark }}>
            <Upload size={15} /> Importar várias OFs
          </button>
          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: C.paperDark, color: semEntidadeEspecifica ? C.inkMuted : C.navy,
              cursor: semEntidadeEspecifica ? "not-allowed" : "pointer", opacity: semEntidadeEspecifica ? 0.6 : 1,
            }}
            title={semEntidadeEspecifica ? "Selecione uma entidade específica primeiro" : undefined}>
            {lendoPdf ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {lendoPdf ? "Lendo PDF..." : "Importar OF (PDF)"}
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={handleImportarPdf} disabled={lendoPdf || semEntidadeEspecifica} />
          </label>
          <button onClick={abrirNova} disabled={semEntidadeEspecifica}
            title={semEntidadeEspecifica ? "Selecione uma entidade específica primeiro" : undefined}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: C.navy, color: C.paper }}>
            <Plus size={15} /> Nova OF manual
          </button>
        </div>
      </div>

      {semEntidadeEspecifica && (
        <div className="mb-4 p-3 rounded-lg text-xs flex items-start gap-2"
          style={{ background: "rgba(166,131,46,0.1)", color: C.ink }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
          <span>
            Selecione uma entidade específica no seletor do topo da tela para criar ou importar uma
            Ordem de Fornecimento. Não é possível cadastrar em "Todas as Entidades" — toda OF precisa
            pertencer a uma entidade só. Você ainda pode consultar as OFs de todas as entidades aqui.
          </span>
        </div>
      )}

      {erro && (
        <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
          <AlertCircle size={13} className="inline mr-1.5" style={{ color: C.red }} />{erro}
        </div>
      )}

      {ofs.length > 0 && (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto etp-scroll border-b" style={{ borderColor: C.border }}>
          {GRUPOS_ABA_OF.map(g => {
            const ativo = filtroAba === g.id;
            const n = contagemPorGrupo[g.id] || 0;
            return (
              <button key={g.id} onClick={() => setFiltroAba(g.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap -mb-px border-b-2"
                style={{ borderColor: ativo ? C.brass : "transparent", color: ativo ? C.navy : C.inkMuted }}>
                {g.rotulo}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: ativo ? "rgba(166,131,46,0.15)" : C.paperDark, color: ativo ? C.brass : C.inkMuted }}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {reparticoesDaEntidadeAtiva.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-medium" style={{ color: C.inkMuted }}>Repartição:</span>
          <select value={filtroReparticao} onChange={e => setFiltroReparticao(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
            <option value="">Ver todas</option>
            {reparticoesDaEntidadeAtiva.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
      )}

      {ofs.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <Mail size={30} className="mx-auto mb-3" style={{ color: C.border }} />
          <p className="text-sm" style={{ color: C.inkMuted }}>Nenhuma Ordem de Fornecimento cadastrada nesta entidade.</p>
        </div>
      ) : linhas.length === 0 ? (
        <div className="text-center py-10 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <p className="text-sm" style={{ color: C.inkMuted }}>Nenhuma OF neste status.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto etp-scroll" style={{ borderColor: C.border, background: "white" }}>
          <table className="w-full text-sm" style={{ minWidth: "820px" }}>
            <thead>
              <tr style={{ background: C.paperDark }}>
                {[
                  ["Nº OF", "numeroOf"], ["Empresa / CNPJ", "empresa"],
                  ["Prazo limite", "prazoLimite"], ["Situação", "situacao"], ["Ações", null],
                ].map(([t, campo]) => (
                  <th key={t} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                    {campo ? (
                      <button onClick={() => alternarOrdenacao(campo)} className="flex items-center gap-1">
                        {t}
                        {ordenacao.campo === campo ? (
                          ordenacao.direcao === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                        ) : <ArrowUpDown size={11} style={{ opacity: 0.4 }} />}
                      </button>
                    ) : t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ item, situacao }) => (
                <tr key={item.token} className="border-t" style={{ borderColor: C.border }}>
                  <td className="px-3 py-3 font-semibold" style={{ color: C.navy }}>
                    {item.numeroOf}
                    {item.reparticaoId && (
                      <span className="block text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit mt-0.5"
                        style={{ background: "rgba(166,131,46,0.14)", color: C.brass }}>
                        {reparticoes.find(r => r.id === item.reparticaoId)?.nome || "Repartição removida"}
                      </span>
                    )}
                    <p className="text-[10.5px] font-normal" style={{ color: C.inkMuted }}>
                      {item.dataEnvioStr ? `Notificada em ${item.dataEnvioStr}` : "Ainda não notificada"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p style={{ color: C.ink }}>{item.empresa || "Não informada"}</p>
                    <p className="text-[11px]" style={{ color: C.inkMuted }}>{formatarCnpj(item.cnpj) || "-"}</p>
                  </td>
                  <td className="px-3 py-3" style={{ color: situacao.vencido ? C.red : C.ink, fontWeight: situacao.vencido ? 600 : 400 }}>
                    {item.prazoLimite || "-"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full block w-fit"
                      style={{ background: `${COR_SITUACAO[situacao.chave]}1A`, color: COR_SITUACAO[situacao.chave] }}>
                      {situacao.texto}
                    </span>
                    {!!item.reciboImutavel && (
                      <button onClick={() => abrirConfirmacaoEntrega(item)}
                        className="mt-1 text-[10.5px] font-semibold underline"
                        style={{ color: C.brass }}>
                        {item.confirmacaoEntrega ? "Alterar status" : "Confirmar entrega / não entregue"}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setAcoesDe(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
                        style={{ background: C.paperDark, color: C.navy }}>
                        <MoreHorizontal size={14} /> Ações
                        {(situacao.atrasado || situacao.naoEntregue || situacao.precisaConfirmarEntrega) && (
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#b45309" }} title="Precisa de atenção" />
                        )}
                      </button>
                      {disputaAtiva(item) && (
                        <button onClick={() => abrirDisputa(item)} title="Há uma disputa em andamento nesta OF"
                          className="p-1.5 rounded-md"
                          style={{ background: precisaAvisoSemResposta(disputaAtiva(item)) ? "#fff3cd" : "#dbeafe",
                            color: precisaAvisoSemResposta(disputaAtiva(item)) ? "#664d03" : C.navy }}>
                          <MessageSquare size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <form onSubmit={handleSalvarRascunho}
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-4" style={{ color: C.navy }}>
              {editando.id ? "Editar OF" : "Conferir / preencher OF"}
            </h2>

            {aviso && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(76,124,89,0.1)", color: C.ink }}>
                <Info size={12} className="inline mr-1" style={{ color: C.green }} />{aviso}
              </p>
            )}

            {[
              ["Nº da OF", "numeroOf", "text", true],
              ["CNPJ", "cnpj", "text", false],
              ["Razão social (empresa)", "empresa", "text", true],
              ["E-mail do fornecedor", "emailFornecedor", "email", false],
              ["Telefone do fornecedor", "telefoneFornecedor", "text", false],
            ].map(([label, campo, tipo, obrig]) => (
              <label key={campo} className="block mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>{label}</span>
                <input type={tipo} value={editando[campo] || ""} required={obrig}
                  onChange={e => setEditando({ ...editando, [campo]: e.target.value })}
                  onBlur={campo === "cnpj" ? aoSairDoCnpj : undefined}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
            ))}

            {editando.cnpj && cnpjValido(editando.cnpj) && (() => {
              const hist = resumoHistoricoFornecedor(editando.cnpj, ofs);
              return hist.total > 0 ? (
                <p className="text-[11px] mb-3" style={{ color: C.inkMuted }}>
                  Este fornecedor já teve {hist.total} OF(s): {hist.concluidas} concluída(s), {hist.comDivergencia} com divergência.
                </p>
              ) : null;
            })()}

            {reparticoesDaEntidadeAtiva.length > 0 && (
              <label className="block mb-4">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                  Repartição (opcional)
                </span>
                <select value={editando.reparticaoId || ""} onChange={e => setEditando({ ...editando, reparticaoId: e.target.value || null })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
                  <option value="">Nenhuma específica</option>
                  {reparticoesDaEntidadeAtiva.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </label>
            )}

            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Prazo de entrega (dias após a confirmação)
              </span>
              <input type="number" min="1" required value={editando.prazoDias}
                onChange={e => setEditando({ ...editando, prazoDias: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: C.inkMuted }}>
                Como contar o prazo?
              </span>
              {[
                { v: "corridos", r: "Dias corridos", d: "Conta normalmente; só ajusta a DATA FINAL se cair num dia sem expediente." },
                { v: "uteis", r: "Dias úteis", d: "Pula os dias sem expediente durante toda a contagem, não só no final." },
              ].map(op => (
                <label key={op.v} className="flex items-start gap-2 mb-1.5 cursor-pointer">
                  <input type="radio" name="tipoContagemPrazo" className="mt-0.5" checked={(editando.tipoContagemPrazo || "corridos") === op.v}
                    onChange={() => setEditando({ ...editando, tipoContagemPrazo: op.v })} />
                  <span className="text-sm">
                    <span className="font-medium" style={{ color: C.ink }}>{op.r}</span>
                    <span className="block text-[11px]" style={{ color: C.inkMuted }}>{op.d}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalAberto(false)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="submit"
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: C.paperDark, color: C.navy }}>
                Salvar rascunho
              </button>
              <button type="button" onClick={() => setADisparar(editando)}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                🚀 Disparar para o fornecedor
              </button>
            </div>
          </form>
        </div>
      )}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Excluir esta Ordem de Fornecimento?"
          descricao={`"${aExcluir.numeroOf}" será apagada. O fornecedor perderá acesso ao link, se ainda não confirmou.`}
          onConfirmar={() => handleExcluir(aExcluir)}
          onCancelar={() => setAExcluir(null)}
        />
      )}

      {aDisparar && (
        <ConfirmarExclusao
          titulo={aDisparar.status === "Rascunho" ? "Enviar e-mail ao fornecedor?" : "Reenviar e-mail ao fornecedor?"}
          descricao={
            `Um e-mail real será enviado agora para "${aDisparar.emailFornecedor || "(nenhum e-mail informado)"}", ` +
            `com o link para confirmar o recebimento da OF nº ${aDisparar.numeroOf}. Isso não pode ser desfeito. ` +
            `"Enviado" aqui significa apenas que o pedido de envio foi aceito — não há confirmação de que o ` +
            `fornecedor efetivamente recebeu.`
          }
          textoBotao={enviando ? "Enviando..." : "Enviar e-mail"}
          onConfirmar={confirmarDisparo}
          onCancelar={() => setADisparar(null)}
        />
      )}

      {confirmandoEntregaDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
              Confirmar entrega — OF nº {confirmandoEntregaDe.numeroOf}
            </h2>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>
              O fornecedor já confirmou o recebimento da OF em {confirmandoEntregaDe.dataAceite}.
              Isto aqui é diferente: é a confirmação de que o produto chegou de verdade.
            </p>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={naoEntregueForm}
                onChange={e => setNaoEntregueForm(e.target.checked)} />
              <span className="text-sm" style={{ color: C.ink }}>O produto não foi entregue</span>
            </label>

            {!naoEntregueForm && (
              <label className="block mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                  Data em que o produto chegou
                </span>
                <input type="date" value={dataEntregaForm} max={todayISO()}
                  onChange={e => setDataEntregaForm(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                <span className="block mt-1 text-[11px]" style={{ color: C.inkMuted }}>
                  Prazo combinado: até {confirmandoEntregaDe.prazoLimite}. O sistema calcula sozinho se
                  está dentro ou fora do prazo — não precisa avaliar isso.
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setConfirmandoEntregaDe(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmarEntrega} disabled={salvandoEntrega}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                {salvandoEntrega ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {verNotificacoesDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="serif text-lg font-semibold" style={{ color: C.navy }}>
                Notificações enviadas — OF nº {verNotificacoesDe.numeroOf}
              </h2>
              <button onClick={() => setVerNotificacoesDe(null)} style={{ color: C.inkMuted }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {(verNotificacoesDe.notificacoes || []).map(n => {
                const chaveCopia = `${verNotificacoesDe.token}_${n.numero}`;
                return (
                  <div key={n.numero} className="rounded-lg border p-3" style={{ borderColor: C.border }}>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: C.navy }}>Notificação nº {n.numero}</p>
                    <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
                      {fmtDate(n.enviadaEm)} · assinada por {n.assinanteNome} ({n.assinanteCargo})
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copiarLinkNotificacao(verNotificacoesDe, n.numero)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium"
                        style={{ background: C.paperDark, color: linkNotifCopiado === chaveCopia ? C.green : C.navy }}>
                        {linkNotifCopiado === chaveCopia ? <Check size={12} /> : <Link2 size={12} />}
                        {linkNotifCopiado === chaveCopia ? "Copiado!" : "Copiar link"}
                      </button>
                      <button onClick={() => abrirWhatsAppNotificacao(verNotificacoesDe, n.numero)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium" style={{ background: C.paperDark, color: "#25D366" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.85 9.85 0 0 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.22 8.22 0 0 1-1.27-4.4c0-4.54 3.7-8.24 8.26-8.24 2.21 0 4.28.86 5.84 2.42a8.18 8.18 0 0 1 2.42 5.83c0 4.55-3.7 8.26-8.27 8.26zm4.53-6.19c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42-.14-.01-.31-.01-.48-.01a.93.93 0 0 0-.67.31c-.23.25-.87.85-.87 2.08s.9 2.41 1.02 2.58c.13.16 1.77 2.7 4.28 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.1-.23-.16-.48-.28z"/>
                        </svg>
                        WhatsApp
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {acoesDe && (() => {
        const item = acoesDe;
        const situacaoItem = calcularSituacao(item);
        const fechar = () => setAcoesDe(null);
        const ItemAcao = ({ icone: Icone, rotulo, sub, cor, onClick, href, download, disabled }) => {
          const conteudo = (
            <>
              <Icone size={16} style={{ color: disabled ? C.inkMuted : (cor || C.navy), flexShrink: 0 }} />
              <span className="flex-1 text-left">
                <span className="block text-sm font-medium" style={{ color: disabled ? C.inkMuted : C.ink }}>{rotulo}</span>
                {sub && <span className="block text-[11px]" style={{ color: C.inkMuted }}>{sub}</span>}
              </span>
            </>
          );
          const classe = `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-black/[0.03]"}`;
          return href ? (
            <a href={href} download={download} onClick={fechar} className={classe}>{conteudo}</a>
          ) : (
            <button onClick={() => { if (!disabled) { onClick(); fechar(); } }} disabled={disabled} className={classe}>{conteudo}</button>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
            <div className="w-full max-w-md max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-white border-b z-10" style={{ borderColor: C.border }}>
                <div>
                  <p className="text-xs" style={{ color: C.inkMuted }}>OF nº {item.numeroOf} · {item.empresa || "Empresa não informada"}</p>
                  <p className="text-sm font-semibold" style={{ color: COR_SITUACAO[situacaoItem.chave] }}>{situacaoItem.texto}</p>
                </div>
                <button onClick={fechar} style={{ color: C.inkMuted }}><X size={18} /></button>
              </div>

              <div className="p-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide px-2 mb-1 mt-2" style={{ color: C.inkMuted }}>Comunicação com o fornecedor</p>
                <ItemAcao icone={Send} rotulo={item.status === "Rascunho" ? "Disparar OF" : "Reenviar OF"}
                  sub={situacaoItem.precisaReenviar ? "Sem resposta há mais de 24h" : "Envia por e-mail"}
                  cor={situacaoItem.precisaReenviar ? "#fd7e14" : C.navy} onClick={() => setADisparar(item)} />
                <ItemAcao icone={Link2} rotulo="Copiar link de confirmação" onClick={() => copiarLink(item)} />
                <ItemAcao icone={MessageCircle} rotulo="Enviar link pelo WhatsApp" cor="#25D366" onClick={() => abrirWhatsApp(item)} />
                <ItemAcao icone={Camera} rotulo="Registrar envio por outro meio"
                  sub={item.enviosManuais?.length ? `${item.enviosManuais.length} registro(s) já feito(s)` : "WhatsApp pessoal, e-mail direto, presencial..."}
                  onClick={() => abrirRegistrarEnvio(item)} />

                <p className="text-[10.5px] font-semibold uppercase tracking-wide px-2 mb-1 mt-4" style={{ color: C.inkMuted }}>Disputa / conversa com o fornecedor</p>
                {disputaAtiva(item) ? (
                  <ItemAcao icone={MessageSquareWarning} rotulo="Ver conversa em andamento"
                    cor={precisaAvisoSemResposta(disputaAtiva(item)) ? "#b45309" : C.navy}
                    sub={precisaAvisoSemResposta(disputaAtiva(item)) ? "Fornecedor sem responder há mais de 48h" : "Disputa aberta, aguardando movimentação"}
                    onClick={() => abrirDisputa(item)} />
                ) : (
                  <ItemAcao icone={MessageSquare} rotulo="Abrir disputa manualmente"
                    sub="Pra formalizar uma conversa, ex.: depois de uma ligação do fornecedor"
                    onClick={() => abrirDisputa(item)} />
                )}
                {(item.disputasEncerradas?.length > 0) && (
                  <ItemAcao icone={MessageSquare} rotulo="Ver histórico de disputas encerradas"
                    sub={`${item.disputasEncerradas.length} já encerrada(s)`} onClick={() => abrirDisputa(item)} />
                )}

                <p className="text-[10.5px] font-semibold uppercase tracking-wide px-2 mb-1 mt-4" style={{ color: C.inkMuted }}>Confirmação da entrega</p>
                {!!item.reciboImutavel ? (
                  <>
                    <ItemAcao icone={PackageCheck} rotulo={item.confirmacaoEntrega ? "Alterar confirmação de entrega" : "Confirmar entrega do produto"}
                      cor={item.confirmacaoEntrega ? C.navy : C.green} onClick={() => abrirConfirmacaoEntrega(item)} />
                    {item.confirmacaoEntrega && (
                      <ItemAcao icone={Undo2} rotulo="Desfazer confirmação de entrega" sub="Avisa o fornecedor por e-mail" cor={C.red}
                        onClick={() => abrirDesfazerEntrega(item)} />
                    )}
                  </>
                ) : (
                  <p className="text-xs px-2" style={{ color: C.inkMuted }}>Disponível depois que o fornecedor confirmar o recebimento.</p>
                )}

                <p className="text-[10.5px] font-semibold uppercase tracking-wide px-2 mb-1 mt-4" style={{ color: C.inkMuted }}>Notificação de atraso</p>
                {(situacaoItem.atrasado || situacaoItem.naoEntregue || situacaoItem.precisaConfirmarEntrega) && (
                  <ItemAcao icone={AlertCircle} rotulo="Notificar atraso/não entrega" cor="#b45309" onClick={() => abrirNotificacao(item)}
                    disabled={situacaoItem.chave === "aguardando-entrega"}
                    sub={situacaoItem.chave === "aguardando-entrega" ? "Só libera depois que o prazo de entrega vencer" : undefined} />
                )}
                {item.notificacoes?.length > 0 ? (
                  <ItemAcao icone={FileText} rotulo="Ver notificações já enviadas" sub={`${item.notificacoes.length} enviada(s)`}
                    onClick={() => setVerNotificacoesDe(item)} />
                ) : !(situacaoItem.atrasado || situacaoItem.naoEntregue || situacaoItem.precisaConfirmarEntrega) && (
                  <p className="text-xs px-2" style={{ color: C.inkMuted }}>Nenhuma notificação necessária até agora.</p>
                )}

                <p className="text-[10.5px] font-semibold uppercase tracking-wide px-2 mb-1 mt-4" style={{ color: C.inkMuted }}>Documentos</p>
                {item.pdfBase64 && (
                  <ItemAcao icone={Download} rotulo="Baixar PDF anexado" href={item.pdfBase64} download={`OF-${item.numeroOf}.pdf`} />
                )}
                {item.reciboImutavel && (
                  <ItemAcao icone={Printer} rotulo="Imprimir / baixar comprovante" onClick={() => imprimirRecibo(item)} />
                )}
                <ItemAcao icone={FileText} rotulo="Gerar pacote de encaminhamento"
                  sub="Todos os dados do processo, prontos pra Comissão de Penalidades ou pra empresa"
                  onClick={() => gerarPacoteEncaminhamento(item)} />

                <p className="text-[10.5px] font-semibold uppercase tracking-wide px-2 mb-1 mt-4" style={{ color: C.inkMuted }}>Gestão</p>
                <ItemAcao icone={Pencil} rotulo="Editar dados da OF" onClick={() => { setEditando(item); setErro(""); setModalAberto(true); }} />
                <ItemAcao icone={Trash2} rotulo="Excluir OF" cor={C.red} onClick={() => setAExcluir(item)} />
              </div>
            </div>
          </div>
        );
      })()}

      {desfazendoEntregaDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-2" style={{ color: C.navy }}>
              Desfazer confirmação de entrega — OF nº {desfazendoEntregaDe.numeroOf}
            </h2>
            <p className="text-xs mb-3" style={{ color: C.inkMuted }}>
              Isso volta a OF pro estado "aguardando confirmação da entrega" e <b>avisa o fornecedor por
              e-mail</b> de que a situação foi revisada, com o motivo abaixo. Fica registrado no log de
              auditoria, sem possibilidade de apagar depois.
            </p>
            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Motivo (obrigatório)
              </span>
              <textarea value={motivoDesfazer} onChange={e => setMotivoDesfazer(e.target.value)} rows={3}
                placeholder="Ex.: confirmado por engano, produto ainda não chegou de fato"
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDesfazendoEntregaDe(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="button" onClick={handleDesfazerEntrega} disabled={desfazendo}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.red, color: "white" }}>
                {desfazendo ? "Desfazendo..." : "Desfazer e avisar o fornecedor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {registrandoEnvioDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.65)" }}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
              Registrar envio por outro meio — OF nº {registrandoEnvioDe.numeroOf}
            </h2>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>
              Só documenta que a OF foi comunicada fora do sistema. O fornecedor ainda precisa clicar no
              link de confirmação em algum momento — use "Copiar link" ou WhatsApp pra isso.
            </p>

            {registrandoEnvioDe.enviosManuais?.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Já registrado</p>
                {registrandoEnvioDe.enviosManuais.map(r => (
                  <div key={r.id} className="rounded-lg border p-2.5 text-xs flex items-start gap-2" style={{ borderColor: C.border }}>
                    {r.anexo && <img src={r.anexo} alt="Anexo" className="w-12 h-12 object-cover rounded" />}
                    <div>
                      <p style={{ color: C.ink }}><b>{rotuloMetodoEnvio(r.metodo)}</b> — {fmtDateISO(r.dataEnvio)}</p>
                      {r.observacao && <p style={{ color: C.inkMuted }}>{r.observacao}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Método</span>
                <select value={envioMetodo} onChange={e => setEnvioMetodo(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
                  {METODOS_ENVIO_MANUAL.map(m => <option key={m.id} value={m.id}>{m.rotulo}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Data do envio</span>
                <input type="date" value={envioData} max={todayISO()} onChange={e => setEnvioData(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
            </div>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Observação (opcional)</span>
              <textarea value={envioObs} onChange={e => setEnvioObs(e.target.value)} rows={2}
                placeholder="Ex.: entregue na sede da empresa, enviado pelo WhatsApp do gestor..."
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Foto como prova (opcional, comprimida automaticamente)
              </span>
              <input type="file" accept="image/*" onChange={handleAnexarImagem} disabled={comprimindoAnexo}
                className="mt-1 w-full text-xs" />
              {comprimindoAnexo && <p className="text-xs mt-1" style={{ color: C.inkMuted }}>Comprimindo imagem...</p>}
              {envioAnexo && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={envioAnexo} alt="Pré-visualização" className="w-16 h-16 object-cover rounded-lg border" style={{ borderColor: C.border }} />
                  <button type="button" onClick={() => setEnvioAnexo(null)} className="text-xs underline" style={{ color: C.red }}>Remover</button>
                </div>
              )}
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRegistrandoEnvioDe(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="button" onClick={handleRegistrarEnvioManual} disabled={salvandoEnvioManual || comprimindoAnexo}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                {salvandoEnvioManual ? "Salvando..." : "Salvar registro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notificandoDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.65)" }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
              Notificar atraso/não entrega — OF nº {notificandoDe.numeroOf}
            </h2>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>
              {notificandoDe.notificacoes?.length
                ? `Esta será a ${notificandoDe.notificacoes.length + 1}ª notificação sobre esta OF.`
                : "Esta será a 1ª notificação sobre esta OF."} O texto completo fica gravado, sem possibilidade de apagar depois.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Assinado por (nome)</span>
                <input value={notifAssinanteNome} onChange={e => setNotifAssinanteNome(e.target.value)}
                  placeholder="Ex.: Edilene Alves da Cruz"
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Cargo</span>
                <input value={notifAssinanteCargo} onChange={e => setNotifAssinanteCargo(e.target.value)}
                  placeholder="Ex.: Secretária de Assistência Social"
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Prazo para manifestação</span>
                <input type="number" min="1" value={notifPrazoQtd} onChange={e => setNotifPrazoQtd(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Unidade</span>
                <select value={notifPrazoUnidade} onChange={e => setNotifPrazoUnidade(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
                  <option value="horas">Horas</option>
                  <option value="dias-corridos">Dias corridos</option>
                  <option value="dias-uteis">Dias úteis</option>
                </select>
              </label>
            </div>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Observações específicas deste caso (opcional)
              </span>
              <textarea value={notifObs} onChange={e => setNotifObs(e.target.value)} rows={2}
                placeholder="Ex.: a empresa solicitou troca de marca, ainda em análise administrativa"
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide mb-1 block" style={{ color: C.inkMuted }}>
                Pré-visualização do documento
              </span>
              <textarea readOnly value={textoNotificacaoPreview()} rows={12}
                className="w-full px-3 py-2 rounded-lg border text-xs font-mono"
                style={{ borderColor: C.border, background: C.paperDark, color: C.ink }} />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setNotificandoDe(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="button" onClick={handleEnviarNotificacao} disabled={enviandoNotificacao}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: "#b45309", color: "white" }}>
                {enviandoNotificacao ? "Enviando..." : "Enviar notificação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loteAberto && (
        <ImportarLoteModal
          ofsExistentes={ofs} fornecedores={fornecedores} secretarias={secretarias}
          secretariaId={secretariaId} municipioId={municipioId} emailUsuario={emailUsuario}
          reparticoes={reparticoes}
          onSalvarFornecedor={onSalvarFornecedor}
          onFechar={() => setLoteAberto(false)}
          onConcluido={onRecarregar}
        />
      )}
    </>
  );
}
