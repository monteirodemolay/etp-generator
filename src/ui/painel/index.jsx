/**
 * Painel principal: barra lateral, indicadores, ETPs recentes e as listas de
 * documentos. As abas trocam o conteúdo sem sair da tela.
 */

import { entidadeEhSomenteLeitura } from "../../dominio/permissoes.js";

import React, { useState, useEffect, useMemo, Fragment } from "react";
import {
  ClipboardList, FileText, Plus, ListChecks, FileEdit, Building2, Users,
  Download, Trash2, Search, Copy, Info, Check, AlertCircle, TrendingUp, X, Scale,
  AlertTriangle, Bell, ChevronRight, Mail, ShieldCheck, Users2, BarChart3,
} from "lucide-react";
import { C, COR_SITUACAO } from "../tokens.js";
import { ConfirmarExclusao } from "../comuns/index.jsx";
import { FRASES, DICAS, saudacaoPorHora, primeiroNomeDe, sortearFrase } from "../../conteudo/frases.js";
import { TIPOS_OBJETO } from "../../dominio/opcoes.js";
import { progress, situacaoEtp, tituloDocumento } from "../../dominio/modelos.js";
import { valorTotalEtp, brl } from "../../dominio/valores.js";
import { fmtDateRelativa, fmtDate } from "../../dominio/datas.js";
import { secretariaDoDoc } from "../../dominio/entidades.js";
import { listaResponsaveis } from "../../dominio/etp.js";
import { verificarConformidade } from "../../dominio/conformidade.js";
import { contarPrevistosNoPca } from "../../dominio/pca.js";
import { DIAS_NA_LIXEIRA } from "../../dominio/lixeira.js";
import { LixeiraView } from "./lixeira.jsx";
import { NormativosView } from "./normativos.jsx";
import { AdminView } from "../admin/AdminView.jsx";
import { FornecedoresView } from "../of/FornecedoresView.jsx";
import { RelatoriosOf } from "../of/RelatoriosOf.jsx";
import { GestaoOf } from "../of/GestaoOf.jsx";
import { GuiaRapido, JanelaNovoDocumento } from "./janelas.jsx";


// ---------- List View ----------
// ---------- Painel principal ----------
// Barra lateral fixa + área de conteúdo. As abas trocam o conteúdo sem sair da tela.
// ---------- List View ----------
// ---------- Painel principal ----------
// Barra lateral fixa + área de conteúdo. As abas trocam o conteúdo sem sair da tela.
export function ListView({ etps, todosEtps, justificativas, declaracoes,
  secretarias, secretariaAtiva, setSecretariaAtiva,
  loading, search, setSearch,
  onOpen, onNew, onDelete, onDuplicar,
  onAbrirDeclaracao, onNovaDeclaracao, onExcluirDeclaracao, onDuplicarDeclaracao,
  onAbrirJustificativa, onNovaJustificativa, onExcluirJustificativa, onDuplicarJustificativa,
  onSalvarSecretaria, onNovaSecretaria, onExcluirSecretaria, onRecarregar,
  municipios, onNovoMunicipio, onExcluirMunicipio,
  feriados, onSalvarFeriado, onExcluirFeriado,
  termos, onSalvarTermos,
  usuarios, emailUsuario, usuarioAtual, permissoes, onSalvarUsuario, onExcluirUsuario,
  normativos, onUploadNormativo, onExcluirNormativo,
  ofs, fornecedores, onSalvarFornecedor, onExcluirFornecedor, todasAsOfs, onRecarregarOfs,
  lixeira, onRestaurar, onApagarDefinitivo, onEsvaziar,
  documentoAberto = null, viewAtual, onFecharDocumento, podeVerTodasEntidades }) {

  const [aba, setAba] = useState("painel");
  // Enquanto um documento (Justificativa/Declaração) está aberto, ele ocupa o conteúdo, mas o
  // menu lateral continua indicando a seção correspondente — não a última aba clicada.
  const abaAtiva = documentoAberto
    ? (viewAtual === "justificativa" ? "justificativas" : "declaracoes")
    : aba;
  const [showGuia, setShowGuia] = useState(false);
  // Novo documento agora abre direto no editor (sem janela intermediária) — objeto, processo
  // e entidade ficam editáveis dentro do próprio documento, e nada é gravado até a primeira
  // alteração real (ver persist/salvarJustificativa/salvarDeclaracao).
  const [frase] = useState(sortearFrase);
  const [notifAberta, setNotifAberta] = useState(false);
  const saudacao = saudacaoPorHora();
  const nome = primeiroNomeDe(usuarioAtual?.nomeCompleto);
  const [aExcluir, setAExcluir] = useState(null);   // ETP aguardando confirmação
  const [pendAberta, setPendAberta] = useState(null); // id do ETP com o detalhe de pendências aberto no cartão

  function pedirExclusao(etp, e) {
    e.stopPropagation();
    setAExcluir(etp);
  }

  const base = todosEtps || etps;

  // A entidade selecionada no filtro pode ter sido marcada como "somente leitura" para este
  // usuário — nesse caso, mesmo quem tem permissão geral de criar não pode criar aqui.
  const entidadeAtivaSomenteLeitura = secretariaAtiva !== "todas" && entidadeEhSomenteLeitura(usuarioAtual, secretariaAtiva);
  const podeCriarDocumentos = permissoes.criarDocumentos && !entidadeAtivaSomenteLeitura;

  // ---- Notificações: pendências reais, calculadas a partir dos próprios ETPs — nunca inventadas ----
  // Dois sinais: (1) impeditivos do checklist de conformidade e (2) ETP sem edição há mais
  // de 15 dias e ainda não concluído. Ordenado do mais urgente (mais impeditivos) para o menos.
  const DIAS_ETP_PARADO = 15;
  const notificacoes = useMemo(() => {
    const agora = Date.now();
    return base
      .filter(e => situacaoEtp(e).chave !== "concluido")
      .map(etp => {
        const impeditivos = verificarConformidade(etp).filter(a => a.nivel === "impeditivo").length;
        const diasParado = Math.floor((agora - etp.updatedAt) / 86400000);
        const parado = diasParado >= DIAS_ETP_PARADO;
        if (impeditivos === 0 && !parado) return null;
        return { etp, impeditivos, diasParado, parado };
      })
      .filter(Boolean)
      .sort((a, b) => b.impeditivos - a.impeditivos || b.diasParado - a.diasParado);
  }, [base]);
  const porSituacao = { concluido: [], elaboracao: [], rascunho: [] };
  base.forEach(e => porSituacao[situacaoEtp(e).chave].push(e));
  const valorTotal = base.reduce((soma, e) => soma + valorTotalEtp(e), 0);
  const pctConcluidos = base.length ? Math.round((porSituacao.concluido.length / base.length) * 100) : 0;
  const recentes = [...base].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);


  const secAtiva = secretarias.find(x => x.id === secretariaAtiva);

  const menu = [
    { id: "painel", rotulo: "Painel", icone: ClipboardList },
    { id: "etps", rotulo: "Meus ETPs", icone: FileText, contador: base.length },
    { id: "declaracoes", rotulo: "Declarações de PCA", icone: ListChecks, contador: declaracoes.length },
    { id: "justificativas", rotulo: "Justificativas", icone: FileEdit, contador: justificativas.length },
    { id: "ordens_fornecimento", rotulo: "Ordens de Fornecimento", icone: Mail, contador: ofs.length },
    { id: "fornecedores", rotulo: "Fornecedores", icone: Users2, contador: fornecedores.length },
    { id: "relatorios_of", rotulo: "Relatórios de OF", icone: BarChart3 },
    { id: "normativos", rotulo: "Materiais Normativos", icone: Scale, contador: normativos.length },
    { id: "lixeira", rotulo: "Lixeira", icone: Trash2, contador: lixeira.length },
    // Entidades, Usuários, Dias Úteis e Backup viviam soltos na lateral — agora
    // moram juntos aqui dentro, como sub-abas de uma única tela administrativa.
    { id: "admin", rotulo: "Admin", icone: ShieldCheck, somenteAdmin: true },
  ].filter(m => (m.somenteAdmin ? permissoes.gerenciarEntidades : permissoes.paginas?.[m.id] !== false));

  return (
    <div className="flex min-h-screen" style={{ background: C.paperDark }}>

      {/* ---------- Barra lateral ---------- */}
      <aside className="w-60 shrink-0 flex flex-col sticky top-0 h-screen" style={{ background: C.navyDark }}>
      <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.brass }}>
            <ClipboardList size={20} style={{ color: C.navyDark }} />
          </div>
          <div className="min-w-0">
            <p className="serif text-base font-semibold leading-tight" style={{ color: C.paper }}>Hub Compras Públicas</p>
            <p className="text-[10px] leading-tight" style={{ color: "#8A93A3" }}>Estudo Técnico Preliminar</p>
          </div>
        </div>

        <nav className="px-3 mt-2 flex-1 overflow-y-auto etp-scroll">
          {menu.map(m => {
            const ativo = !m.acao && abaAtiva === m.id;
            return (
              <button key={m.id} onClick={() => { if (documentoAberto) onFecharDocumento(); setAba(m.id); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1 text-sm"
                style={{
                  background: ativo ? C.brass : "transparent",
                  color: ativo ? C.navyDark : "#B7C0CC",
                  fontWeight: ativo ? 600 : 500,
                }}>
                <m.icone size={16} className="shrink-0" />
                <span className="flex-1 text-left">{m.rotulo}</span>
                {m.contador > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: ativo ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)", color: ativo ? C.navyDark : "#8A93A3" }}>
                    {m.contador}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t" style={{ borderColor: C.border }}>
          <a href="?termos=" className="text-[10.5px] hover:underline" style={{ color: C.inkMuted }}>
            Termos de Uso e Política de Privacidade
          </a>
        </div>
      </aside>

      {/* ---------- Conteúdo ---------- */}
      <div className="flex-1 min-w-0 flex flex-col">

        <header className="flex items-center gap-3 px-7 py-3.5 border-b flex-wrap"
          style={{ borderColor: C.border, background: "white" }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 size={15} className="shrink-0" style={{ color: C.brass }} />
            <select value={secretariaAtiva} onChange={e => setSecretariaAtiva(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border text-xs bg-white max-w-[300px]"
              style={{ borderColor: C.border, color: C.navy }}>
              {podeVerTodasEntidades && <option value="todas">Todas as Entidades</option>}
              {secretarias.map(x => (
                <option key={x.id} value={x.id}>{x.sigla ? `${x.sigla} — ${x.nome}` : (x.nome || "Sem nome")}</option>
              ))}
            </select>
          </div>
          <div className="relative shrink-0">
            <button onClick={() => setNotifAberta(v => !v)}
              className="relative flex items-center justify-center w-8 h-8 rounded-lg border"
              style={{ borderColor: C.border, color: C.navy, background: "white" }}
              title="Notificações" aria-label="Notificações">
              <Bell size={15} />
              {notificacoes.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
                  style={{ background: C.red, color: "white" }}>
                  {notificacoes.length}
                </span>
              )}
            </button>
            {notifAberta && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setNotifAberta(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border z-20 overflow-hidden"
                  style={{ borderColor: C.border, background: "white", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: C.border }}>
                    <p className="text-sm font-semibold" style={{ color: C.navy }}>Notificações</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto etp-scroll">
                    {notificacoes.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-center" style={{ color: C.inkMuted }}>
                        Nenhuma pendência no momento.
                      </p>
                    ) : notificacoes.slice(0, 8).map(n => (
                      <button key={n.etp.id} onClick={() => { setNotifAberta(false); onOpen(n.etp); }}
                        className="w-full text-left flex items-start gap-2.5 px-4 py-3 border-b hover:bg-black/[0.02]"
                        style={{ borderColor: C.border }}>
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: n.impeditivos > 0 ? C.red : C.brass }} />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium truncate" style={{ color: C.navy }}>
                            {n.etp.meta.titulo || "ETP sem título"}
                          </span>
                          <span className="block text-[11px]" style={{ color: C.inkMuted }}>
                            {n.impeditivos > 0
                              ? `${n.impeditivos} pendência(s) impeditiva(s)`
                              : `Sem atualização há ${n.diasParado} dias`}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setShowGuia(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shrink-0"
            style={{ borderColor: C.border, color: C.navy, background: "white" }}>
            <FileText size={14} /> Guia rápido
          </button>
          <div className="pl-3 border-l shrink-0 hidden sm:block" style={{ borderColor: C.border }}>
            <p className="text-[11px]" style={{ color: C.inkMuted }}>
              {secAtiva ? (secAtiva.sigla || secAtiva.nome) : (podeVerTodasEntidades ? "Todas as Entidades" : "Nenhuma entidade")}
            </p>
          </div>
        </header>
<main
  className="flex-1 px-7 py-6 overflow-y-auto etp-scroll"
  style={{ paddingBottom: "64px" }}
>
          {documentoAberto ? documentoAberto : (
          <>

          {!podeVerTodasEntidades && secretarias.length === 0 && (
            <div className="max-w-md mx-auto mt-16 text-center">
              <Building2 size={32} className="mx-auto mb-3" style={{ color: C.border }} />
              <h2 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
                Nenhuma entidade atribuída
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: C.inkMuted }}>
                Sua conta ainda não tem acesso a nenhuma entidade. Procure o administrador
                do sistema para que ele atribua as entidades em que você vai trabalhar.
              </p>
            </div>
          )}

          {(podeVerTodasEntidades || secretarias.length > 0) && aba === "painel" && (
            <>
              {/* ---------- Cabeçalho: saudação + ações principais ---------- */}
              <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
                <div className="min-w-0">
                  <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>
                    {nome ? `${saudacao}, ${nome}.` : `${saudacao}.`}
                  </h1>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: C.inkMuted }}>
                    <span className="italic">“{FRASES[frase].texto}”</span>
                    <span className="ml-1.5 whitespace-nowrap" style={{ color: C.brass }}>— {FRASES[frase].autor}</span>
                  </p>
                </div>
                {podeCriarDocumentos && (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button onClick={() => onNovaDeclaracao({})}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-sm font-medium hover:bg-black/[0.02]"
                      style={{ borderColor: C.border, color: C.navy, background: "white" }}>
                      <ListChecks size={15} style={{ color: C.brass }} /> Declaração de PCA
                    </button>
                    <button onClick={() => onNovaJustificativa({})}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-sm font-medium hover:bg-black/[0.02]"
                      style={{ borderColor: C.border, color: C.navy, background: "white" }}>
                      <FileEdit size={15} style={{ color: C.brass }} /> Justificativa
                    </button>
                    <button onClick={() => onNew({})}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm"
                      style={{ background: C.navy, color: C.paper }}>
                      <Plus size={16} /> Novo ETP
                    </button>
                  </div>
                )}
              </div>

              {/* ---------- Faixa proativa: pendências reais, mesmo dado do sino de notificações ---------- */}
              {notificacoes.length > 0 && (() => {
                const impeditivosTotais = notificacoes.filter(n => n.impeditivos > 0).length;
                const paradosTotais = notificacoes.filter(n => n.impeditivos === 0 && n.parado).length;
                const partes = [];
                if (impeditivosTotais > 0) partes.push(`${impeditivosTotais} ETP${impeditivosTotais > 1 ? "s" : ""} com pendência impeditiva`);
                if (paradosTotais > 0) partes.push(`${paradosTotais} ETP${paradosTotais > 1 ? "s" : ""} sem atualização há mais de ${DIAS_ETP_PARADO} dias`);
                return (
                  <div className="rounded-xl px-4 py-3 flex items-center gap-3 mb-5"
                    style={{ background: "rgba(166,131,46,0.1)" }}>
                    <AlertTriangle size={17} className="shrink-0" style={{ color: C.brass }} />
                    <span className="text-sm flex-1" style={{ color: C.ink }}>{partes.join(" · ")}.</span>
                    <button onClick={() => setNotifAberta(true)}
                      className="text-xs font-semibold shrink-0" style={{ color: C.brass }}>
                      Ver pendências
                    </button>
                  </div>
                );
              })()}

              {/* ---------- Resumo: um único cartão com números + barra de progresso ---------- */}
              {base.length > 0 && (() => {
                const fatias = [
                  { rotulo: "Concluídos", n: porSituacao.concluido.length, cor: C.green },
                  { rotulo: "Em elaboração", n: porSituacao.elaboracao.length, cor: C.brass },
                  { rotulo: "Rascunhos", n: porSituacao.rascunho.length, cor: "#C9C2B2" },
                ];
                return (
                  <div className="rounded-xl border p-5 mb-5" style={{ borderColor: C.border, background: "white" }}>
                    <div className="flex items-start justify-between gap-6 flex-wrap">
                      <div className="flex items-baseline gap-2">
                        <span className="serif text-3xl font-semibold leading-none" style={{ color: C.navy }}>{base.length}</span>
                        <span className="text-sm" style={{ color: C.ink }}>
                          ETP{base.length === 1 ? "" : "s"}{secAtiva ? ` em ${secAtiva.sigla || secAtiva.nome}` : ""}
                        </span>
                        <span className="text-sm ml-1" style={{ color: C.inkMuted }}>
                          · {pctConcluidos}% concluído{pctConcluidos === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs" style={{ color: C.inkMuted }}>Valor estimado somado</span>
                        <span className="serif text-xl font-semibold" style={{ color: C.navy }}>{brl(valorTotal)}</span>
                      </div>
                    </div>

                    <div className="flex h-2.5 rounded-full overflow-hidden mt-4" style={{ background: C.paperDark }}>
                      {fatias.map(f => f.n > 0 && (
                        <div key={f.rotulo} style={{ width: `${(f.n / base.length) * 100}%`, background: f.cor }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-5 mt-2.5 flex-wrap">
                      {fatias.map(f => (
                        <span key={f.rotulo} className="flex items-center gap-1.5 text-xs" style={{ color: C.ink }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.cor }} />
                          {f.rotulo}
                          <b style={{ color: C.navy }}>{f.n}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ---------- ETPs recentes ---------- */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: C.border }}>
                  <h3 className="serif text-base font-semibold" style={{ color: C.navy }}>ETPs recentes</h3>
                  {recentes.length > 0 && (
                    <button onClick={() => setAba("etps")} className="text-xs font-medium" style={{ color: C.brass }}>
                      Ver todos
                    </button>
                  )}
                </div>
                {recentes.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <FileText size={28} className="mx-auto mb-2" style={{ color: C.border }} />
                    <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
                      {podeCriarDocumentos ? "Comece pelo primeiro ETP" : "Nenhum ETP disponível"}
                    </p>
                    {podeCriarDocumentos ? (
                      <>
                        <p className="text-sm mb-4 max-w-sm mx-auto leading-relaxed" style={{ color: C.inkMuted }}>
                          O app conduz as etapas — itens, PCA, preços e os 13 incisos do art. 18 — e exporta o documento pronto.
                        </p>
                        <button onClick={() => onNew({})}
                          className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                          style={{ background: C.navy, color: C.paper }}>
                          Criar o primeiro ETP
                        </button>
                        <p className="text-[11px] mt-3" style={{ color: C.inkMuted }}>
                          Primeira vez por aqui? Abra o <button onClick={() => setShowGuia(true)} className="underline font-medium" style={{ color: C.brass }}>guia rápido</button>.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: C.inkMuted }}>
                        Sua conta não tem permissão para criar documentos nesta entidade.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto etp-scroll">
                    <table className="w-full text-sm" style={{ minWidth: "560px" }}>
                      <thead>
                        <tr style={{ background: C.paperDark }}>
                          <th className="text-left px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Título / Objeto</th>
                          <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-28" style={{ color: C.inkMuted }}>Atualizado</th>
                          <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-32" style={{ color: C.inkMuted }}>Situação</th>
                          <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-24" style={{ color: C.inkMuted }}>Pendências</th>
                          <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-20" style={{ color: C.inkMuted }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentes.map(etp => {
                          const sit = situacaoEtp(etp);
                          const sec = secretariaDoDoc(etp, secretarias);
                          const pendenciasList = verificarConformidade(etp).filter(a => a.nivel === "impeditivo");
                          return (
                            <Fragment key={etp.id}>
                            <tr className="border-t hover:bg-black/[0.015] cursor-pointer"
                              style={{ borderColor: C.border }} onClick={() => onOpen(etp)}>
                              <td className="px-5 py-3">
                                <p className="font-medium truncate" style={{ color: C.navy }}>
                                  {etp.meta.titulo || "ETP sem título"}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: C.inkMuted }}>
                                  {sec?.sigla ? `${sec.sigla} · ` : ""}{etp.meta.setor || etp.meta.orgao || "Setor não informado"}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-xs" style={{ color: C.inkMuted }}>
                                {fmtDateRelativa(etp.updatedAt)}
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full"
                                  style={{ background: `${sit.cor}1A`, color: sit.cor }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sit.cor }} />
                                  {sit.rotulo}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <button onClick={e => { e.stopPropagation(); setPendAberta(pendAberta === etp.id ? null : (pendenciasList.length > 0 ? etp.id : null)); }}
                                  disabled={pendenciasList.length === 0}
                                  className="flex items-center gap-1 text-[11px] font-semibold"
                                  style={{ color: pendenciasList.length > 0 ? C.red : C.green }}>
                                  {pendenciasList.length > 0 ? (
                                    <>
                                      {pendenciasList.length} pend.
                                      <ChevronRight size={10} style={{ transform: pendAberta === etp.id ? "rotate(90deg)" : "none" }} />
                                    </>
                                  ) : "✓ conforme"}
                                </button>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1">
                                  {podeCriarDocumentos && (
                                    <button onClick={e => { e.stopPropagation(); onDuplicar(etp, e); }}
                                      className="p-1.5 rounded" style={{ color: C.inkMuted }} title="Duplicar">
                                      <Copy size={14} />
                                    </button>
                                  )}
                                  {permissoes.excluirDocumentos && (
                                    <button onClick={e => pedirExclusao(etp, e)}
                                      className="p-1.5 rounded" style={{ color: C.inkMuted }} title="Excluir">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {pendAberta === etp.id && pendenciasList.length > 0 && (
                              <tr style={{ borderTop: "none" }}>
                                <td colSpan={5} className="px-5 pb-3 pt-0">
                                  <div onClick={e => e.stopPropagation()}
                                    className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ background: "rgba(166,64,61,0.06)" }}>
                                    {pendenciasList.map((a, i) => (
                                      <p key={i} className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: C.ink }}>
                                        <AlertTriangle size={11} className="shrink-0 mt-0.5" style={{ color: C.red }} />
                                        {a.texto}
                                      </p>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ---------- Documentos suplementares: menores que o ETP, mas com referência própria ---------- */}
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {[
                  { tipo: "declaracoes", titulo: "Declarações de PCA", icone: ListChecks, lista: declaracoes,
                    vazio: "Nenhuma declaração criada ainda.", onNovo: onNovaDeclaracao },
                  { tipo: "justificativas", titulo: "Justificativas", icone: FileEdit, lista: justificativas,
                    vazio: "Nenhuma justificativa criada ainda.", onNovo: onNovaJustificativa },
                ].map(bloco => {
                  const recente = [...bloco.lista].sort((a, b) => b.updatedAt - a.updatedAt)[0];
                  return (
                    <button key={bloco.tipo} onClick={() => setAba(bloco.tipo)}
                      className="text-left rounded-xl border p-4 hover:bg-black/[0.015]"
                      style={{ borderColor: C.border, background: "white" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <bloco.icone size={15} style={{ color: C.brass }} />
                        <span className="text-sm font-semibold flex-1" style={{ color: C.navy }}>{bloco.titulo}</span>
                        <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{bloco.lista.length}</span>
                      </div>
                      {recente ? (
                        <p className="text-xs truncate" style={{ color: C.inkMuted }}>
                          Mais recente: <span style={{ color: C.ink }}>{recente.meta?.titulo || recente.objeto || recente.campos?.objeto || "Sem título"}</span>
                          {" "}· {fmtDateRelativa(recente.updatedAt)}
                        </p>
                      ) : (
                        <p className="text-xs" style={{ color: C.inkMuted }}>{bloco.vazio}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {aba === "etps" && (
            <>
              <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                <div>
                  <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Meus ETPs</h1>
                  <p className="text-sm" style={{ color: C.inkMuted }}>
                    {base.length} estudo(s){secAtiva ? ` em ${secAtiva.sigla || secAtiva.nome}` : ""}.
                  </p>
                </div>
                <button onClick={() => onNew({})}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm shrink-0"
                  style={{ background: C.navy, color: C.paper, display: podeCriarDocumentos ? "flex" : "none" }}>
                  <Plus size={16} /> Novo ETP
                </button>
              </div>

              <div className="relative mb-5 max-w-lg">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkMuted }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por título, órgão, nº de processo ou responsável..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: C.border, background: "white" }} />
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: C.inkMuted }}>Carregando...</p>
              ) : etps.length === 0 ? (
                <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
                  <FileText size={30} className="mx-auto mb-3" style={{ color: C.border }} />
                  <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
                    {search ? "Nenhum ETP encontrado" : "Nenhum ETP criado ainda"}
                  </p>
                  <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
                    {search ? "Tente outro termo de busca." : "Comece cadastrando os itens da contratação."}
                  </p>
                  {!search && podeCriarDocumentos && (
                    <button onClick={() => onNew({})}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm"
                      style={{ background: C.navy, color: C.paper }}>
                      <Plus size={16} /> Criar o primeiro ETP
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {etps.map(etp => {
                    const p = progress(etp);
                    const sit = situacaoEtp(etp);
                    const sec = secretariaDoDoc(etp, secretarias);
                    const qtdItens = (etp.itens || []).length;
                    const valorEtp = valorTotalEtp(etp);
                    const pendenciasList = verificarConformidade(etp).filter(a => a.nivel === "impeditivo");
                    const pendencias = pendenciasList.length;
                    const responsaveis = listaResponsaveis(etp);
                    const responsavel = responsaveis.length === 0 ? null
                      : responsaveis.length === 1 ? responsaveis[0].nome
                      : `${responsaveis[0].nome} e +${responsaveis.length - 1}`;
                    const previstosPca = etp.pca ? contarPrevistosNoPca(etp) : 0;
                    return (
                      <div key={etp.id} onClick={() => onOpen(etp)}
                        className="group relative p-5 rounded-xl border cursor-pointer hover:shadow-sm"
                        style={{ borderColor: C.border, background: "white" }}>
                        <div className="absolute top-4 right-4 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {podeCriarDocumentos && (
                            <button onClick={e => { e.stopPropagation(); onDuplicar(etp, e); }}
                              className="p-1.5 rounded-md" style={{ color: C.inkMuted }} title="Duplicar">
                              <Copy size={15} />
                            </button>
                          )}
                          {permissoes.excluirDocumentos && (
                            <button onClick={e => pedirExclusao(etp, e)}
                              className="p-1.5 rounded-md" style={{ color: C.inkMuted }} title="Excluir">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <h3 className="serif text-lg font-semibold pr-16 mb-1" style={{ color: C.navy }}>
                          {etp.meta.titulo || "ETP sem título"}
                        </h3>
                        <p className="text-xs mb-3 flex items-center gap-1.5 flex-wrap" style={{ color: C.inkMuted }}>
                          {secretariaAtiva === "todas" && sec?.sigla && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: C.paperDark, color: C.brass }}>{sec.sigla}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Building2 size={12} /> {etp.meta.orgao || "Órgão não informado"}
                            {etp.meta.processo && ` · Proc. ${etp.meta.processo}`}
                          </span>
                        </p>

                        {/* Números que ajudam a decidir se vale abrir */}
                        <div className="grid grid-cols-3 gap-2 mb-3 py-2 px-1 rounded-lg" style={{ background: C.paperDark }}>
                          <div className="text-center">
                            <p className="text-sm font-semibold leading-none" style={{ color: C.navy }}>{qtdItens}</p>
                            <p className="text-[9.5px] mt-1" style={{ color: C.inkMuted }}>
                              {qtdItens === 1 ? "item" : "itens"}
                            </p>
                          </div>
                          <div className="text-center border-x" style={{ borderColor: C.border }}>
                            <p className="text-sm font-semibold leading-none"
                              style={{ color: valorEtp > 0 ? C.navy : C.inkMuted }}>
                              {valorEtp > 0 ? brl(valorEtp) : "—"}
                            </p>
                            <p className="text-[9.5px] mt-1" style={{ color: C.inkMuted }}>estimado</p>
                          </div>
                          <button onClick={e => { e.stopPropagation(); setPendAberta(pendAberta === etp.id ? null : (pendencias > 0 ? etp.id : null)); }}
                            className="text-center" disabled={pendencias === 0} title={pendencias > 0 ? "Ver o que falta" : undefined}>
                            <p className="text-sm font-semibold leading-none"
                              style={{ color: pendencias > 0 ? C.red : C.green }}>
                              {pendencias > 0 ? pendencias : "✓"}
                            </p>
                            <p className="text-[9.5px] mt-1 flex items-center justify-center gap-0.5" style={{ color: C.inkMuted }}>
                              {pendencias > 0 ? "pendência(s)" : "conforme"}
                              {pendencias > 0 && <ChevronRight size={9} style={{ transform: pendAberta === etp.id ? "rotate(90deg)" : "none" }} />}
                            </p>
                          </button>
                        </div>

                        {pendAberta === etp.id && pendenciasList.length > 0 && (
                          <div onClick={e => e.stopPropagation()}
                            className="rounded-lg mb-3 px-3 py-2.5 space-y-1.5"
                            style={{ background: "rgba(166,64,61,0.06)" }}>
                            {pendenciasList.map((a, i) => (
                              <p key={i} className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: C.ink }}>
                                <AlertTriangle size={11} className="shrink-0 mt-0.5" style={{ color: C.red }} />
                                {a.texto}
                              </p>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-1.5 rounded-full" style={{ background: C.paperDark }}>
                            <div className="h-1.5 rounded-full" style={{ width: p.pct + "%", background: sit.cor }} />
                          </div>
                          <span className="text-[11px] shrink-0" style={{ color: C.inkMuted }}>
                            {p.filled}/{p.total} incisos
                          </span>
                        </div>

                        {/* Detalhes em linha, cada um só aparece se houver dado */}
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[10.5px] mb-2.5"
                          style={{ color: C.inkMuted }}>
                          {etp.meta.tipo && <span>{etp.meta.tipo}</span>}
                          {responsavel && <span>· {responsavel}</span>}
                          {etp.pca && (
                            <span>· PCA: {previstosPca}/{qtdItens}</span>
                          )}
                          <span>· criado {fmtDate(etp.createdAt)}</span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: `${sit.cor}1A`, color: sit.cor }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sit.cor }} />
                            {sit.rotulo}
                          </span>
                          <span style={{ color: C.inkMuted }}>editado {fmtDateRelativa(etp.updatedAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {aba === "declaracoes" && (
            <>
              <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Declarações de previsão no PCA</h1>
              <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
                Confere se os itens constam no Plano de Contratações Anual e gera o documento para o processo.
              </p>
              <ListaDocumentos titulo="Declarações" docs={declaracoes}
                onAbrir={onAbrirDeclaracao} onExcluir={onExcluirDeclaracao} onDuplicar={onDuplicarDeclaracao}
                onNovo={() => onNovaDeclaracao({})} icone={ListChecks} vazio="Nenhuma declaração criada ainda."
                secretarias={secretarias} mostrarSecretaria={secretariaAtiva === "todas"}
                podeCriar={podeCriarDocumentos} podeExcluir={permissoes.excluirDocumentos} />
            </>
          )}

          {aba === "admin" && (
            <AdminView
              secretarias={secretarias} onSalvarSecretaria={onSalvarSecretaria}
              onNovaSecretaria={onNovaSecretaria} onExcluirSecretaria={onExcluirSecretaria}
              municipios={municipios} onNovoMunicipio={onNovoMunicipio} onExcluirMunicipio={onExcluirMunicipio}
              feriados={feriados} onSalvarFeriado={onSalvarFeriado} onExcluirFeriado={onExcluirFeriado}
              termos={termos} onSalvarTermos={onSalvarTermos}
              usuarios={usuarios} emailUsuario={emailUsuario}
              onSalvarUsuario={onSalvarUsuario} onExcluirUsuario={onExcluirUsuario}
              etps={base} justificativas={justificativas} declaracoes={declaracoes} ofs={ofs}
              onRecarregar={onRecarregar}
            />
          )}

          {aba === "ordens_fornecimento" && (
            <GestaoOf ofs={ofs} fornecedores={fornecedores} secretarias={secretarias} municipios={municipios}
              secretariaId={secretariaAtiva !== "todas" ? secretariaAtiva : null}
              municipioId={secretariaAtiva !== "todas" ? (secAtiva?.municipioId || municipios[0]?.id || null) : null}
              onRecarregar={onRecarregarOfs} onSalvarFornecedor={onSalvarFornecedor} emailUsuario={emailUsuario} />
          )}

          {aba === "fornecedores" && (
            <FornecedoresView fornecedores={fornecedores} ofs={todasAsOfs}
              onSalvar={onSalvarFornecedor} onExcluir={onExcluirFornecedor} />
          )}

          {aba === "relatorios_of" && (
            <RelatoriosOf ofs={todasAsOfs} secretarias={secretarias} fornecedores={fornecedores} />
          )}

          {aba === "normativos" && (
            <NormativosView normativos={normativos} onUpload={onUploadNormativo} onExcluir={onExcluirNormativo} />
          )}

          {aba === "lixeira" && (
            <LixeiraView lixeira={lixeira} onRestaurar={onRestaurar} onApagar={onApagarDefinitivo}
              onEsvaziar={onEsvaziar} podeEsvaziar={permissoes.esvaziarLixeira} />
          )}

          {/* Backup agora é uma sub-aba de Admin, não mais uma aba solta */}

          {aba === "justificativas" && (
            <>
              <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Justificativas de aquisição</h1>
              <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
                Documento anterior à aquisição, com os dados do processo e o texto de justificativa.
              </p>
              <ListaDocumentos titulo="Justificativas" docs={justificativas}
                onAbrir={onAbrirJustificativa} onExcluir={onExcluirJustificativa} onDuplicar={onDuplicarJustificativa}
                onNovo={() => onNovaJustificativa({})} icone={FileEdit} vazio="Nenhuma justificativa criada ainda."
                secretarias={secretarias} mostrarSecretaria={secretariaAtiva === "todas"}
                podeCriar={podeCriarDocumentos} podeExcluir={permissoes.excluirDocumentos} />
            </>
          )}
          </>
          )}
        </main>

       <footer
  className="fixed bottom-0 left-64 right-0 h-12 px-7 border-t flex items-center gap-2 z-50"
  style={{
    borderColor: C.border,
    background: "white"
  }}
>
          <ClipboardList size={14} style={{ color: C.brass }} />
          <span className="text-xs" style={{ color: C.inkMuted }}>
            Hub Compras Públicas — Planejamento consistente para contratações públicas
          </span>
          <span className="ml-auto text-xs" style={{ color: C.inkMuted }}>
            Desenvolvido por Luís Eduardo Monteiro Lima
          </span>
        </footer>
      </div>

      {showGuia && <GuiaRapido onFechar={() => setShowGuia(false)} />}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Mover para a lixeira?"
          descricao={`"${aExcluir.meta?.titulo || "ETP sem título"}" ficará na lixeira por ${DIAS_NA_LIXEIRA} dias e poderá ser restaurado nesse período.`}
          textoBotao="Mover para a lixeira"
          onConfirmar={() => { onDelete(aExcluir.id, { stopPropagation() {} }); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  );
}

// ---------- Lista de documentos avulsos (declarações e justificativas) ----------
// Mesmo comportamento das duas listas: abrir, excluir com confirmação e criar novo.
export function ListaDocumentos({ titulo, docs, onAbrir, onExcluir, onDuplicar, onNovo, icone: Icone, vazio, secretarias, mostrarSecretaria }) {
  const [aExcluir, setAExcluir] = useState(null);
  const [busca, setBusca] = useState("");

  function pedirExclusao(doc, e) {
    e.stopPropagation();
    setAExcluir(doc);
  }

  const buscaLimpa = busca.trim().toLowerCase();
  const docsFiltrados = !buscaLimpa ? docs : docs.filter(doc => {
    const c = doc.campos || {};
    const responsaveis = (c.responsaveis || []).map(r => r.nome).join(" ");
    const alvo = [tituloDocumento(doc), c.orgao, c.processo, c.responsavel, responsaveis]
      .filter(Boolean).join(" ").toLowerCase();
    return alvo.includes(buscaLimpa);
  });

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          {titulo} {docs.length > 0 && `(${docs.length})`}
        </h2>
        <button onClick={onNovo} className="text-xs font-medium flex items-center gap-1" style={{ color: C.brass }}>
          <Plus size={12} /> Novo
        </button>
      </div>

      {docs.length > 0 && (
        <div className="relative mb-3 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.inkMuted }} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por título, órgão, processo ou responsável..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border, background: "white" }} />
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center" style={{ borderColor: C.border }}>
          <p className="text-xs" style={{ color: C.inkMuted }}>{vazio}</p>
        </div>
      ) : docsFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center" style={{ borderColor: C.border }}>
          <p className="text-xs" style={{ color: C.inkMuted }}>Nenhum resultado para essa busca.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {docsFiltrados.map((doc, idx) => {
            return (
              <div key={doc.id} onClick={() => onAbrir(doc)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-black/[0.02] group"
                style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : "none" }}>
                <Icone size={15} className="shrink-0" style={{ color: C.brass }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{tituloDocumento(doc)}</p>
                  <p className="text-xs flex items-center gap-1.5" style={{ color: C.inkMuted }}>
                    {mostrarSecretaria && secretariaDoDoc(doc, secretarias)?.sigla && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: C.paperDark, color: C.brass }}>
                        {secretariaDoDoc(doc, secretarias).sigla}
                      </span>
                    )}
                    editado {fmtDateRelativa(doc.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); onDuplicar(doc, e); }}
                    className="p-1" style={{ color: C.inkMuted }} title="Duplicar">
                    <Copy size={14} />
                  </button>
                  <button onClick={e => pedirExclusao(doc, e)}
                    className="p-1" style={{ color: C.inkMuted }} title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Mover para a lixeira?"
          descricao={`"${tituloDocumento(aExcluir)}" ficará na lixeira por ${DIAS_NA_LIXEIRA} dias e poderá ser restaurado nesse período.`}
          textoBotao="Mover para a lixeira"
          onConfirmar={() => { onExcluir(aExcluir.id, { stopPropagation() {} }); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  );
}
