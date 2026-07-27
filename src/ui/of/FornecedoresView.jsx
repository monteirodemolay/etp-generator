/**
 * Fornecedores — cadastro consultado e alimentado pelas Ordens de
 * Fornecimento, mas gerido aqui, separado do fluxo de criar/disparar uma OF.
 *
 * De propósito: nada aqui exige passar por esta tela para emitir uma OF —
 * o disparo continua tão simples quanto sempre foi (busca automática pelo
 * CNPJ). Esta tela é só um lugar organizado para ver e corrigir o cadastro.
 */

import React, { useState } from "react";
import { Users2, Search, Pencil, Trash2, Mail, Phone, Building2, X } from "lucide-react";
import { C } from "../tokens.js";
import { ConfirmarExclusao } from "../comuns/index.jsx";
import { formatarCnpj, cnpjValido, resumoHistoricoFornecedor } from "../../dominio/fornecedores.js";

export function FornecedoresView({ fornecedores = [], ofs = [], onSalvar, onExcluir }) {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null);
  const [aExcluir, setAExcluir] = useState(null);

  const buscaLimpa = busca.trim().toLowerCase();
  const filtrados = fornecedores.filter(f =>
    !buscaLimpa
    || f.razaoSocial?.toLowerCase().includes(buscaLimpa)
    || f.cnpj?.includes(buscaLimpa.replace(/\D/g, ""))
  ).sort((a, b) => (a.razaoSocial || "").localeCompare(b.razaoSocial || ""));

  function salvarEdicao(e) {
    e.preventDefault();
    if (!cnpjValido(editando.cnpj)) return;
    onSalvar(editando);
    setEditando(null);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Users2 size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Cadastro compartilhado</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Fornecedores</h1>
          <p className="text-xs mt-1" style={{ color: C.inkMuted }}>
            Alimentado automaticamente ao emitir uma Ordem de Fornecimento — o cadastro aqui é só para
            consultar e corrigir dados, não é preciso passar por esta tela para disparar uma OF.
          </p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.inkMuted }} />
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CNPJ..."
          className="w-full pl-8 pr-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
      </div>

      {fornecedores.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <Users2 size={30} className="mx-auto mb-3" style={{ color: C.border }} />
          <p className="text-sm" style={{ color: C.inkMuted }}>
            Nenhum fornecedor cadastrado ainda — o cadastro nasce sozinho na primeira OF de cada empresa.
          </p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-10 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <p className="text-sm" style={{ color: C.inkMuted }}>Nenhum fornecedor encontrado para essa busca.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto etp-scroll" style={{ borderColor: C.border, background: "white" }}>
          <table className="w-full text-sm" style={{ minWidth: "720px" }}>
            <thead>
              <tr style={{ background: C.paperDark }}>
                {["Razão social", "CNPJ", "Contato", "Ordens de Fornecimento", "Ações"].map(t => (
                  <th key={t} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(f => {
                const hist = resumoHistoricoFornecedor(f.cnpj, ofs);
                return (
                  <tr key={f.id} className="border-t" style={{ borderColor: C.border }}>
                    <td className="px-3 py-3 font-medium" style={{ color: C.navy }}>{f.razaoSocial || "—"}</td>
                    <td className="px-3 py-3" style={{ color: C.inkMuted }}>{formatarCnpj(f.cnpj)}</td>
                    <td className="px-3 py-3">
                      {f.email && <p className="flex items-center gap-1 text-xs" style={{ color: C.ink }}><Mail size={11} />{f.email}</p>}
                      {f.telefone && <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: C.inkMuted }}><Phone size={11} />{f.telefone}</p>}
                      {!f.email && !f.telefone && <span className="text-xs" style={{ color: C.inkMuted }}>Sem contato registrado</span>}
                    </td>
                    <td className="px-3 py-3">
                      {hist.total === 0 ? (
                        <span className="text-xs" style={{ color: C.inkMuted }}>Nenhuma ainda</span>
                      ) : (
                        <span className="text-xs">
                          <b style={{ color: C.navy }}>{hist.total}</b> ao todo
                          {hist.comDivergencia > 0 && <span style={{ color: C.red }}> · {hist.comDivergencia} com divergência</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditando({ ...f })} title="Editar" className="p-1.5 rounded" style={{ color: C.inkMuted }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setAExcluir(f)} title="Excluir" className="p-1.5 rounded" style={{ color: C.red }}>
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

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <form onSubmit={salvarEdicao} className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="serif text-lg font-semibold" style={{ color: C.navy }}>Editar fornecedor</h2>
              <button type="button" onClick={() => setEditando(null)} style={{ color: C.inkMuted }}><X size={18} /></button>
            </div>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>CNPJ</span>
              <input value={editando.cnpj} onChange={e => setEditando({ ...editando, cnpj: e.target.value })} required
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Razão social</span>
              <input value={editando.razaoSocial} onChange={e => setEditando({ ...editando, razaoSocial: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>E-mail</span>
              <input type="email" value={editando.email} onChange={e => setEditando({ ...editando, email: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Telefone</span>
              <input value={editando.telefone} onChange={e => setEditando({ ...editando, telefone: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="submit" className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Excluir este fornecedor?"
          descricao={`"${aExcluir.razaoSocial || formatarCnpj(aExcluir.cnpj)}" será removido do cadastro. As Ordens de Fornecimento já emitidas para ele não são afetadas — só o cadastro de contato desaparece.`}
          onConfirmar={() => { onExcluir(aExcluir.id); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </>
  );
}
