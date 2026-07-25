/**
 * Painel principal: barra lateral, indicadores, ETPs recentes e as listas de
 * documentos. As abas trocam o conteúdo sem sair da tela.
 */

import React, { useState, useEffect } from "react";
import {
  ClipboardList, FileText, Plus, ListChecks, FileEdit, Building2, Users,
  Download, Trash2, Search, Copy, Info, Check, AlertCircle, TrendingUp, X,
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
import { UsuariosView } from "../admin/usuarios.jsx";
import { SecretariasView } from "../admin/entidades.jsx";
import { LixeiraView } from "./lixeira.jsx";
import { TelaBackup } from "./backup.jsx";
import { GuiaRapido, JanelaNovoDocumento } from "./janelas.jsx";


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
  usuarios, emailUsuario, usuarioAtual, permissoes, onSalvarUsuario, onExcluirUsuario,
  lixeira, onRestaurar, onApagarDefinitivo, onEsvaziar , podeVerTodasEntidades }) {

  const [aba, setAba] = useState("painel");
  const [showGuia, setShowGuia] = useState(false);
  const [novoDoc, setNovoDoc] = useState(null); // { tipo, tipoInicial }
  const [dica, setDica] = useState(0);
  const [frase] = useState(sortearFrase);
  const saudacao = saudacaoPorHora();
  const nome = primeiroNomeDe(usuarioAtual?.nomeCompleto);
  const [aExcluir, setAExcluir] = useState(null);   // ETP aguardando confirmação

  useEffect(() => {
    const t = setInterval(() => setDica(d => (d + 1) % DICAS.length), 9000);
    return () => clearInterval(t);
  }, []);

  function pedirExclusao(etp, e) {
    e.stopPropagation();
    setAExcluir(etp);
  }

  const base = todosEtps || etps;
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
    { id: "secretarias", rotulo: "Entidades", icone: Building2, contador: secretarias.length, somenteAdmin: true },
    { id: "usuarios", rotulo: "Usuários", icone: Users, contador: usuarios.length, somenteAdmin: true },
    { id: "lixeira", rotulo: "Lixeira", icone: Trash2, contador: lixeira.length },
    { id: "backup", rotulo: "Backup", icone: Download },
  ].filter(m => !m.somenteAdmin || permissoes.gerenciarEntidades);

  // ---- Blocos reutilizados ----
  const cartao = (conteudo, extra = "") => (
    <div className={`rounded-xl border p-5 ${extra}`} style={{ borderColor: C.border, background: "white" }}>
      {conteudo}
    </div>
  );

  const indicador = (valor, rotulo, nota, Icone, corIcone, fundoIcone) => (
    <div className="rounded-xl border p-4 flex items-center gap-3.5" style={{ borderColor: C.border, background: "white" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: fundoIcone }}>
        <Icone size={20} style={{ color: corIcone }} />
      </div>
      <div className="min-w-0">
        <p className="serif text-2xl font-semibold leading-none" style={{ color: C.navy }}>{valor}</p>
        <p className="text-xs mt-1 truncate" style={{ color: C.ink }}>{rotulo}</p>
        {nota && <p className="text-[10.5px] truncate" style={{ color: C.inkMuted }}>{nota}</p>}
      </div>
    </div>
  );

  // Rosca de progresso desenhada em SVG, sem biblioteca
  function Rosca() {
    const fatias = [
      { rotulo: "Concluídos", n: porSituacao.concluido.length, cor: C.green },
      { rotulo: "Em elaboração", n: porSituacao.elaboracao.length, cor: C.brass },
      { rotulo: "Rascunhos", n: porSituacao.rascunho.length, cor: C.border },
    ];
    const total = base.length || 1;
    const raio = 54, circ = 2 * Math.PI * raio;
    let offset = 0;
    return (
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative shrink-0" style={{ width: 132, height: 132 }}>
          <svg width="132" height="132" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="66" cy="66" r={raio} fill="none" stroke={C.paperDark} strokeWidth="14" />
            {fatias.map(f => {
              if (f.n === 0) return null;
              const comp = (f.n / total) * circ;
              const el = (
                <circle key={f.rotulo} cx="66" cy="66" r={raio} fill="none" stroke={f.cor} strokeWidth="14"
                  strokeDasharray={`${comp} ${circ - comp}`} strokeDashoffset={-offset} />
              );
              offset += comp;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="serif text-2xl font-semibold" style={{ color: C.navy }}>{pctConcluidos}%</span>
            <span className="text-[9.5px] text-center leading-tight" style={{ color: C.inkMuted }}>ETPs<br />concluídos</span>
          </div>
        </div>
        <div className="flex-1 min-w-[150px] space-y-2">
          {fatias.map(f => (
            <div key={f.rotulo} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.cor }} />
              <span className="flex-1" style={{ color: C.ink }}>{f.rotulo}</span>
              <span className="font-semibold" style={{ color: C.navy }}>
                {f.n} <span className="font-normal" style={{ color: C.inkMuted }}>
                  ({base.length ? Math.round((f.n / base.length) * 100) : 0}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const acaoRapida = (Icone, titulo, sub, onClick) => (
    <button onClick={onClick}
      className="flex items-start gap-2.5 p-3 rounded-lg border text-left hover:bg-black/[0.02]"
      style={{ borderColor: C.border, background: "white" }}>
      <Icone size={16} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
      <span className="min-w-0">
        <span className="block text-xs font-semibold" style={{ color: C.navy }}>{titulo}</span>
        <span className="block text-[10.5px] leading-snug" style={{ color: C.inkMuted }}>{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="flex min-h-screen" style={{ background: C.paperDark }}>

      {/* ---------- Barra lateral ---------- */}
      <aside className="w-60 shrink-0 flex flex-col sticky top-0 h-screen" style={{ background: C.navyDark }}>
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.brass }}>
            <ClipboardList size={20} style={{ color: C.navyDark }} />
          </div>
          <div className="min-w-0">
            <p className="serif text-base font-semibold leading-tight" style={{ color: C.paper }}>Gerador de ETP</p>
            <p className="text-[10px] leading-tight" style={{ color: "#8A93A3" }}>Estudo Técnico Preliminar</p>
          </div>
        </div>

        <nav className="px-3 mt-2 flex-1 overflow-y-auto etp-scroll">
          {menu.map(m => {
            const ativo = !m.acao && aba === m.id;
            return (
              <button key={m.id} onClick={() => (m.acao ? m.acao() : setAba(m.id))}
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

        <div className="m-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
          <p className="flex items-center gap-1.5 text-xs font-semibold mb-2" style={{ color: C.brassLight }}>
            <Info size={13} /> Dica do dia
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: "#B7C0CC" }}>{DICAS[dica]}</p>
          <div className="flex gap-1 mt-3">
            {DICAS.map((_, i) => (
              <button key={i} onClick={() => setDica(i)} className="h-1 rounded-full transition-all"
                style={{ width: i === dica ? 16 : 6, background: i === dica ? C.brass : "rgba(255,255,255,0.18)" }} />
            ))}
          </div>
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

        <main className="flex-1 px-7 py-6 overflow-y-auto etp-scroll">

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
              <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>
                {nome ? `${saudacao}, ${nome}. Seja bem-vindo!` : `${saudacao}. Seja bem-vindo!`}
              </h1>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: C.inkMuted }}>
                <span className="italic">“{FRASES[frase].texto}”</span>
                <span className="ml-1.5 whitespace-nowrap" style={{ color: C.brass }}>
                  — {FRASES[frase].autor}
                </span>
                {FRASES[frase].obra && (
                  <span className="text-[11px]" style={{ color: C.inkMuted }}> ({FRASES[frase].obra})</span>
                )}
              </p>

              <div className="grid lg:grid-cols-[1fr,320px] gap-5 items-start">
                <div className="min-w-0">
                  {/* Faixa de destaque */}
                  <div className="rounded-xl p-7 mb-5 relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyDark} 100%)` }}>
                    <div className="relative z-10 max-w-lg">
                      <h2 className="serif text-2xl font-bold leading-tight" style={{ color: C.paper }}>
                        Planeje melhor.{" "}
                        <span style={{ color: C.brassLight }}>Contrate com segurança.</span>
                      </h2>
                      <p className="text-sm mt-2 leading-relaxed" style={{ color: "#B7C0CC" }}>
                        O app organiza a elaboração do ETP conforme o art. 18 da Lei nº 14.133/2021,
                        aproveitando os dados que você já cadastrou.
                      </p>
                      <div className="flex gap-5 mt-5 flex-wrap">
                        {[
                          [ClipboardList, "13 incisos", "do art. 18"],
                          [Check, "Conformidade", "verificada antes de finalizar"],
                          [Download, "Exportação", "em Word e PDF"],
                        ].map(([Ic, t, sub], i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: "rgba(255,255,255,0.1)" }}>
                              <Ic size={15} style={{ color: C.brassLight }} />
                            </div>
                            <div className="leading-tight">
                              <p className="text-[11px] font-semibold" style={{ color: C.paper }}>{t}</p>
                              <p className="text-[10px]" style={{ color: "#8A93A3" }}>{sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-56 opacity-10 hidden md:block"
                      style={{ background: `radial-gradient(circle at 70% 50%, ${C.brassLight} 0%, transparent 70%)` }} />
                  </div>

                  {/* Indicadores */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
                    {indicador(base.length, "ETPs criados", null, FileText, C.navy, "rgba(28,46,74,0.08)")}
                    {indicador(porSituacao.concluido.length, "Concluídos", "obrigatórios preenchidos", Check, C.green, "rgba(76,124,89,0.1)")}
                    {indicador(porSituacao.elaboracao.length, "Em elaboração", "ainda faltam incisos", FileEdit, C.brass, "rgba(166,131,46,0.12)")}
                    {indicador(brl(valorTotal), "Valor estimado", "somado de todos os ETPs", TrendingUp, C.navy, "rgba(28,46,74,0.08)")}
                  </div>

                  {/* ETPs recentes */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
                    <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: C.border }}>
                      <h3 className="serif text-base font-semibold" style={{ color: C.navy }}>ETPs recentes</h3>
                      <button onClick={() => setAba("etps")} className="text-xs font-medium" style={{ color: C.brass }}>
                        Ver todos
                      </button>
                    </div>
                    {recentes.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <FileText size={28} className="mx-auto mb-2" style={{ color: C.border }} />
                        <p className="text-sm mb-3" style={{ color: C.inkMuted }}>Nenhum ETP criado ainda.</p>
                        <button onClick={() => setNovoDoc({ tipo: "etp" })}
                          className="px-4 py-2 rounded-lg text-sm font-medium"
                          style={{ background: C.navy, color: C.paper }}>
                          Criar o primeiro ETP
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto etp-scroll">
                        <table className="w-full text-sm" style={{ minWidth: "560px" }}>
                          <thead>
                            <tr style={{ background: C.paperDark }}>
                              <th className="text-left px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Título / Objeto</th>
                              <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-28" style={{ color: C.inkMuted }}>Atualizado</th>
                              <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-32" style={{ color: C.inkMuted }}>Situação</th>
                              <th className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide w-20" style={{ color: C.inkMuted }}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentes.map(etp => {
                              const sit = situacaoEtp(etp);
                              const sec = secretariaDoDoc(etp, secretarias);
                              return (
                                <tr key={etp.id} className="border-t hover:bg-black/[0.015] cursor-pointer"
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
                                    <div className="flex items-center gap-1">
                                      <button onClick={e => { e.stopPropagation(); onDuplicar(etp, e); }}
                                        className="p-1.5 rounded" style={{ color: C.inkMuted }} title="Duplicar">
                                        <Copy size={14} />
                                      </button>
                                      <button onClick={e => pedirExclusao(etp, e)}
                                        className="p-1.5 rounded" style={{ color: C.inkMuted }} title="Excluir">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna direita */}
                <div className="space-y-5">
                  {cartao(
                    <>
                      <h3 className="serif text-base font-semibold mb-4" style={{ color: C.navy }}>Progresso geral</h3>
                      {base.length === 0
                        ? <p className="text-xs" style={{ color: C.inkMuted }}>Sem ETPs para acompanhar ainda.</p>
                        : <Rosca />}
                    </>
                  )}

                  {cartao(
                    <>
                      <h3 className="serif text-base font-semibold mb-3" style={{ color: C.navy }}>Ações rápidas</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {acaoRapida(Plus, "Novo ETP", "Criar do zero", () => setNovoDoc({ tipo: "etp" }))}
                        {acaoRapida(ListChecks, "Declaração", "Verificar PCA", () => setNovoDoc({ tipo: "declaracao" }))}
                        {acaoRapida(FileEdit, "Justificativa", "De aquisição", () => setNovoDoc({ tipo: "justificativa" }))}
                        {acaoRapida(Building2, "Entidades", "Timbre e cadastro", () => setAba("secretarias"))}
                      </div>
                    </>
                  )}

                  {cartao(
                    <>
                      <h3 className="serif text-base font-semibold mb-1" style={{ color: C.navy }}>Começar por tipo</h3>
                      <p className="text-[11px] mb-3" style={{ color: C.inkMuted }}>
                        Cria um ETP já com o tipo de objeto definido — os textos-modelo se ajustam a ele.
                      </p>
                      <div className="space-y-1.5">
                        {TIPOS_OBJETO.map(t => (
                          <button key={t} onClick={() => setNovoDoc({ tipo: "etp", tipoObjeto: t })}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs hover:bg-black/[0.02]"
                            style={{ borderColor: C.border, color: C.ink }}>
                            <span>{t}</span>
                            <Plus size={13} style={{ color: C.brass }} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
                <button onClick={() => setNovoDoc({ tipo: "etp" })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm shrink-0"
                  style={{ background: C.navy, color: C.paper }}>
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
                  {!search && (
                    <button onClick={() => setNovoDoc({ tipo: "etp" })}
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
                    const pendencias = verificarConformidade(etp).filter(a => a.nivel === "impeditivo").length;
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
                          <button onClick={e => { e.stopPropagation(); onDuplicar(etp, e); }}
                            className="p-1.5 rounded-md" style={{ color: C.inkMuted }} title="Duplicar">
                            <Copy size={15} />
                          </button>
                          <button onClick={e => pedirExclusao(etp, e)}
                            className="p-1.5 rounded-md" style={{ color: C.inkMuted }} title="Excluir">
                            <Trash2 size={15} />
                          </button>
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
                          <div className="text-center">
                            <p className="text-sm font-semibold leading-none"
                              style={{ color: pendencias > 0 ? C.red : C.green }}>
                              {pendencias > 0 ? pendencias : "✓"}
                            </p>
                            <p className="text-[9.5px] mt-1" style={{ color: C.inkMuted }}>
                              {pendencias > 0 ? "pendência(s)" : "conforme"}
                            </p>
                          </div>
                        </div>

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
                onNovo={() => setNovoDoc({ tipo: "declaracao" })} icone={ListChecks} vazio="Nenhuma declaração criada ainda."
                secretarias={secretarias} mostrarSecretaria={secretariaAtiva === "todas"} />
            </>
          )}

          {aba === "usuarios" && (
            <UsuariosView usuarios={usuarios} secretarias={secretarias} emailAtual={emailUsuario}
              onSalvar={onSalvarUsuario} onNovo={onSalvarUsuario} onExcluir={onExcluirUsuario} />
          )}

          {aba === "secretarias" && (
            <SecretariasView secretarias={secretarias} onSalvar={onSalvarSecretaria}
              onNova={onNovaSecretaria} onExcluir={onExcluirSecretaria} />
          )}

          {aba === "lixeira" && (
            <LixeiraView lixeira={lixeira} onRestaurar={onRestaurar} onApagar={onApagarDefinitivo}
              onEsvaziar={onEsvaziar} podeEsvaziar={permissoes.esvaziarLixeira} />
          )}

          {aba === "backup" && <TelaBackup onRestaurado={onRecarregar} />}

          {aba === "justificativas" && (
            <>
              <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Justificativas de aquisição</h1>
              <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
                Documento anterior à aquisição, com os dados do processo e o texto de justificativa.
              </p>
              <ListaDocumentos titulo="Justificativas" docs={justificativas}
                onAbrir={onAbrirJustificativa} onExcluir={onExcluirJustificativa} onDuplicar={onDuplicarJustificativa}
                onNovo={() => setNovoDoc({ tipo: "justificativa" })} icone={FileEdit} vazio="Nenhuma justificativa criada ainda."
                secretarias={secretarias} mostrarSecretaria={secretariaAtiva === "todas"} />
            </>
          )}
        </main>

        <footer className="px-7 py-4 border-t flex items-center gap-2 flex-wrap"
          style={{ borderColor: C.border, background: "white" }}>
          <ClipboardList size={14} style={{ color: C.brass }} />
          <span className="text-xs" style={{ color: C.inkMuted }}>
            Gerador de ETP — Lei nº 14.133/2021, art. 18
          </span>
          <span className="ml-auto text-xs" style={{ color: C.inkMuted }}>
            Desenvolvido para a Administração Pública
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

      {novoDoc && (
        <JanelaNovoDocumento
          inicial={novoDoc}
          secretarias={secretarias}
          secretariaAtiva={secretariaAtiva}
          onFechar={() => setNovoDoc(null)}
          onCriar={dados => {
            setNovoDoc(null);
            if (dados.tipo === "etp") onNew(dados);
            else if (dados.tipo === "declaracao") onNovaDeclaracao(dados);
            else onNovaJustificativa(dados);
          }}
        />
      )}
    </div>
  );
}

// ---------- Lista de documentos avulsos (declarações e justificativas) ----------
// Mesmo comportamento das duas listas: abrir, excluir com confirmação e criar novo.
export function ListaDocumentos({ titulo, docs, onAbrir, onExcluir, onDuplicar, onNovo, icone: Icone, vazio, secretarias, mostrarSecretaria }) {
  const [aExcluir, setAExcluir] = useState(null);

  function pedirExclusao(doc, e) {
    e.stopPropagation();
    setAExcluir(doc);
  }

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

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-5 text-center" style={{ borderColor: C.border }}>
          <p className="text-xs" style={{ color: C.inkMuted }}>{vazio}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {docs.map((doc, idx) => {
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
