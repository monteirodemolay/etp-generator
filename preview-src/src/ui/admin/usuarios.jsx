/**
 * Cadastro de usuários e permissões.
 *
 * As senhas NÃO ficam aqui — vivem no Firebase Authentication.
 */

import { ACOES_PADRAO, PAGINAS_PADRAO } from "../../dominio/permissoes.js";

import React, { useState } from "react";
import { Building2, Plus, Trash2, ChevronRight, Info, Lock } from "lucide-react";
import { C } from "../tokens.js";
import { PAPEIS, PAGINAS_CONFIGURAVEIS, ACOES_CONFIGURAVEIS,
         emptyUsuario, resumoEntidades } from "../../dominio/permissoes.js";

// ---------- Usuários e permissões ----------
export function UsuariosView({ usuarios, secretarias, emailAtual, onSalvar, onNovo, onExcluir }) {
  const [editando, setEditando] = useState(null);   // id em edição
  const [confirmId, setConfirmId] = useState(null);
  const [novoEmail, setNovoEmail] = useState("");
  const [erro, setErro] = useState("");

  function criar(e) {
    e.preventDefault();
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    if (usuarios.some(u => u.email === email)) {
      setErro("Já existe um cadastro com este e-mail.");
      return;
    }
    setErro("");
    const u = emptyUsuario(email);
    onNovo(u);
    setNovoEmail("");
    setEditando(u.id);
  }

  function alternarEntidade(u, entId) {
    const atuais = u.entidades || [];
    const novas = atuais.includes(entId) ? atuais.filter(x => x !== entId) : [...atuais, entId];
    const principal = novas.includes(u.entidadePrincipal) ? u.entidadePrincipal : (novas[0] || "");
    // Ao remover o acesso a uma entidade, ela também sai da lista de "somente leitura"
    const somenteLeitura = (u.entidadesSomenteLeitura || []).filter(x => novas.includes(x));
    onSalvar({ ...u, entidades: novas, entidadePrincipal: principal, entidadesSomenteLeitura: somenteLeitura });
  }

  function alternarSomenteLeitura(u, entId) {
    const atuais = u.entidadesSomenteLeitura || [];
    const novas = atuais.includes(entId) ? atuais.filter(x => x !== entId) : [...atuais, entId];
    onSalvar({ ...u, entidadesSomenteLeitura: novas });
  }

  function alternarPagina(u, paginaId) {
    const atuais = { ...PAGINAS_PADRAO, ...(u.paginas || {}) };
    onSalvar({ ...u, paginas: { ...atuais, [paginaId]: !atuais[paginaId] } });
  }

  function alternarAcao(u, acaoId) {
    const atuais = { ...ACOES_PADRAO, ...(u.acoes || {}) };
    onSalvar({ ...u, acoes: { ...atuais, [acaoId]: !atuais[acaoId] } });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Building2 size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Controle de acesso</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Usuários e permissões</h1>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg mb-5 text-xs leading-relaxed"
        style={{ background: "rgba(166,131,46,0.1)", color: C.ink }}>
        <Info size={14} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
        <span>
          <b>As senhas não ficam neste cadastro.</b> Elas são criadas e alteradas no Firebase
          Authentication — guardá-las aqui deixaria qualquer pessoa com acesso ao computador lê-las.
          Cadastre a pessoa lá primeiro (com o mesmo e-mail) e depois defina aqui o papel e as entidades.
        </span>
      </div>

      {/* Novo usuário */}
      <form onSubmit={criar} className="rounded-xl border p-4 mb-5" style={{ borderColor: C.border, background: "white" }}>
        <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
          Cadastrar pessoa
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
            placeholder="e-mail cadastrado no Firebase"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
          <button type="submit" disabled={!novoEmail.trim()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: C.navy, color: C.paper }}>
            <Plus size={15} /> Adicionar
          </button>
        </div>
        {erro && <p className="text-xs mt-2" style={{ color: C.red }}>{erro}</p>}
      </form>

      {usuarios.length === 0 ? (
        <div className="text-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Nenhum usuário cadastrado</p>
          <p className="text-sm max-w-md mx-auto" style={{ color: C.inkMuted }}>
            Enquanto não houver cadastro, quem entrar no sistema é tratado como administrador —
            o acesso já foi filtrado pelas Regras do Firebase.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {usuarios.map(u => {
            const aberto = editando === u.id;
            const souEu = u.email === String(emailAtual || "").toLowerCase();
            const p = PAPEIS[u.papel] || PAPEIS.padrao;
            return (
              <div key={u.id} className="rounded-xl border" style={{
                borderColor: aberto ? C.brass : C.border,
                background: u.ativo === false ? C.paperDark : "white",
              }}>
                {/* Linha resumida */}
                <button onClick={() => setEditando(aberto ? null : u.id)}
                  className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: u.papel === "admin" ? "rgba(166,131,46,0.15)" : C.paperDark }}>
                    <span className="serif text-xs font-bold"
                      style={{ color: u.papel === "admin" ? C.brass : C.inkMuted }}>
                      {(u.nomeCompleto || u.email).split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: C.navy }}>
                      {u.nomeCompleto || <span style={{ color: C.inkMuted, fontStyle: "italic" }}>Sem nome cadastrado</span>}
                      {souEu && <span className="ml-1.5 text-[10px] font-normal" style={{ color: C.inkMuted }}>(você)</span>}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: C.inkMuted }}>{u.email}</p>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        background: u.papel === "admin" ? "rgba(166,131,46,0.15)" : C.paperDark,
                        color: u.papel === "admin" ? C.brass : C.inkMuted,
                      }}>
                      {p.rotulo}
                    </span>
                    <p className="text-[11px] mt-1" style={{ color: C.inkMuted }}>
                      {resumoEntidades(u, secretarias)}
                    </p>
                  </div>
                  {u.ativo === false && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>Inativo</span>
                  )}
                  <ChevronRight size={16} className="shrink-0 transition-transform"
                    style={{ color: C.inkMuted, transform: aberto ? "rotate(90deg)" : "none" }} />
                </button>

                {/* Detalhes */}
                {aberto && (
                  <div className="px-4 pb-4 border-t pt-4" style={{ borderColor: C.border }}>
                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                          Nome completo
                        </span>
                        <input value={u.nomeCompleto} onChange={e => onSalvar({ ...u, nomeCompleto: e.target.value })}
                          placeholder="Ex.: Luís Eduardo Monteiro Lima"
                          className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                          Cargo
                        </span>
                        <input value={u.cargo || ""} onChange={e => onSalvar({ ...u, cargo: e.target.value })}
                          placeholder="Ex.: Analista Administrativo"
                          className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                      </label>
                    </div>

                    <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
                      Papel
                    </span>
                    <div className="grid sm:grid-cols-2 gap-2 mb-4">
                      {Object.entries(PAPEIS).map(([chave, info]) => (
                        <label key={chave} className="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer"
                          style={{
                            borderColor: u.papel === chave ? C.brass : C.border,
                            background: u.papel === chave ? "rgba(166,131,46,0.06)" : "white",
                          }}>
                          <input type="radio" name={`papel-${u.id}`} checked={u.papel === chave}
                            onChange={() => onSalvar({ ...u, papel: chave })}
                            className="mt-0.5" style={{ accentColor: C.brass }} />
                          <span>
                            <span className="block text-xs font-semibold" style={{ color: C.navy }}>{info.rotulo}</span>
                            <span className="block text-[11px] leading-snug mt-0.5" style={{ color: C.inkMuted }}>
                              {info.descricao}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>

                    {u.papel === "padrao" && (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: C.inkMuted }}>
                          Entidades a que tem acesso
                        </span>
                        <p className="text-[11px] mb-2" style={{ color: C.inkMuted }}>
                          Marque as entidades. A estrela indica qual abre por padrão ao entrar. "Só ver" impede
                          criar, editar ou excluir documentos daquela entidade — a pessoa só consulta.
                        </p>
                        <div className="space-y-1.5 mb-4">
                          {secretarias.map(sec => {
                            const marcada = (u.entidades || []).includes(sec.id);
                            const principal = u.entidadePrincipal === sec.id;
                            const apenasLeitura = (u.entidadesSomenteLeitura || []).includes(sec.id);
                            return (
                              <div key={sec.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border flex-wrap"
                                style={{ borderColor: marcada ? C.brass : C.border, background: marcada ? "rgba(166,131,46,0.05)" : "white" }}>
                                <input type="checkbox" checked={marcada}
                                  onChange={() => alternarEntidade(u, sec.id)}
                                  style={{ accentColor: C.brass }} className="w-4 h-4 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate" style={{ color: C.navy }}>
                                    {sec.sigla ? `${sec.sigla} — ${sec.nome}` : (sec.nome || "Entidade sem nome")}
                                  </p>
                                  {sec.tipoEntidade && (
                                    <p className="text-[10px]" style={{ color: C.inkMuted }}>{sec.tipoEntidade}</p>
                                  )}
                                </div>
                                {marcada && (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => alternarSomenteLeitura(u, sec.id)}
                                      className="text-[10px] font-semibold px-2 py-1 rounded"
                                      style={{
                                        background: apenasLeitura ? "rgba(166,64,61,0.12)" : C.paperDark,
                                        color: apenasLeitura ? C.red : C.inkMuted,
                                      }}
                                      title="Quando ativo, a pessoa só visualiza esta entidade — não grava nada">
                                      {apenasLeitura ? "👁 Só ver" : "✎ Pode gravar"}
                                    </button>
                                    <button onClick={() => onSalvar({ ...u, entidadePrincipal: sec.id })}
                                      className="text-[10px] font-semibold px-2 py-1 rounded"
                                      style={{
                                        background: principal ? C.brass : C.paperDark,
                                        color: principal ? C.navyDark : C.inkMuted,
                                      }}
                                      title="Definir como entidade principal">
                                      {principal ? "★ Principal" : "☆ Tornar principal"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] mb-4 px-3 py-2 rounded-lg" style={{ background: C.paperDark, color: C.inkMuted }}>
                          Resumo: <b style={{ color: C.ink }}>{resumoEntidades(u, secretarias)}</b>
                        </p>

                        <span className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: C.inkMuted }}>
                          Páginas visíveis
                        </span>
                        <p className="text-[11px] mb-2" style={{ color: C.inkMuted }}>
                          Desmarque para tirar a página inteira do menu desta pessoa. "Entidades" e "Usuários"
                          são sempre exclusivas do Administrador.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-1.5 mb-4">
                          {PAGINAS_CONFIGURAVEIS.map(pg => {
                            const ligada = (u.paginas || PAGINAS_PADRAO)[pg.id] !== false;
                            return (
                              <label key={pg.id} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs"
                                style={{ borderColor: ligada ? C.brass : C.border, background: ligada ? "rgba(166,131,46,0.05)" : "white", color: C.ink }}>
                                <input type="checkbox" checked={ligada} onChange={() => alternarPagina(u, pg.id)}
                                  style={{ accentColor: C.brass }} className="w-4 h-4 shrink-0" />
                                {pg.rotulo}
                              </label>
                            );
                          })}
                        </div>

                        <span className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: C.inkMuted }}>
                          Ações permitidas
                        </span>
                        <p className="text-[11px] mb-2" style={{ color: C.inkMuted }}>
                          Vale para todas as entidades marcadas como "Pode gravar" acima.
                        </p>
                        <div className="space-y-1.5 mb-4">
                          {ACOES_CONFIGURAVEIS.map(ac => {
                            const ligada = (u.acoes || ACOES_PADRAO)[ac.id] !== false;
                            return (
                              <label key={ac.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer"
                                style={{ borderColor: ligada ? C.brass : C.border, background: ligada ? "rgba(166,131,46,0.05)" : "white" }}>
                                <input type="checkbox" checked={ligada} onChange={() => alternarAcao(u, ac.id)}
                                  className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: C.brass }} />
                                <span>
                                  <span className="block text-xs font-semibold" style={{ color: C.navy }}>{ac.rotulo}</span>
                                  <span className="block text-[11px] leading-snug mt-0.5" style={{ color: C.inkMuted }}>
                                    {ac.descricao}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: C.border }}>
                      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: C.ink }}>
                        <input type="checkbox" checked={u.ativo !== false}
                          onChange={e => onSalvar({ ...u, ativo: e.target.checked })}
                          style={{ accentColor: C.green }} className="w-4 h-4" />
                        Acesso ativo
                      </label>

                      <div className="ml-auto">
                        {souEu ? (
                          <span className="text-[10px]" style={{ color: C.inkMuted }}>
                            Você não pode excluir o próprio cadastro
                          </span>
                        ) : confirmId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px]" style={{ color: C.red }}>Excluir cadastro?</span>
                            <button onClick={() => { onExcluir(u.id); setConfirmId(null); }}
                              className="px-2 py-1 rounded text-[10px] font-semibold"
                              style={{ background: C.red, color: "white" }}>Sim</button>
                            <button onClick={() => setConfirmId(null)}
                              className="px-2 py-1 rounded text-[10px] font-medium"
                              style={{ background: C.paperDark, color: C.inkMuted }}>Não</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmId(u.id)}
                            className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.red }}>
                            <Trash2 size={12} /> Excluir cadastro
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[10.5px] mt-3 leading-relaxed" style={{ color: C.inkMuted }}>
                      Excluir aqui remove as permissões, mas <b>não apaga a conta no Firebase</b> — para
                      bloquear o acesso de vez, desative ou exclua o usuário no console do Firebase.
                      Desmarcar "Acesso ativo" já impede o uso do sistema.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
