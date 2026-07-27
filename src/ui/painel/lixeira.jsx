/**
 * Tela da lixeira: o que foi excluído, quanto tempo resta e como restaurar.
 */

import React, { useState } from "react";
import { Trash2, X, Search } from "lucide-react";
import { C } from "../tokens.js";
import { ConfirmarExclusao } from "../comuns/index.jsx";
import { DIAS_NA_LIXEIRA, TIPOS_DOC, diasRestantes, tituloNaLixeira } from "../../dominio/lixeira.js";
import { fmtDateRelativa } from "../../dominio/datas.js";


// ---------- Lixeira ----------
export function LixeiraView({ lixeira, onRestaurar, onApagar, onEsvaziar, podeEsvaziar }) {
  const [confirmando, setConfirmando] = useState(null);   // registro a apagar de vez
  const [confirmandoTudo, setConfirmandoTudo] = useState(false);
  const [busca, setBusca] = useState("");

  const buscaLimpa = busca.trim().toLowerCase();
  const lixeiraFiltrada = !buscaLimpa ? lixeira
    : lixeira.filter(r => tituloNaLixeira(r).toLowerCase().includes(buscaLimpa)
        || (TIPOS_DOC[r.prefixoOriginal]?.rotulo || "").toLowerCase().includes(buscaLimpa));

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Trash2 size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Recuperação</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Lixeira</h1>
        </div>
        {lixeira.length > 0 && podeEsvaziar && (
          <button onClick={() => setConfirmandoTudo(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium shrink-0"
            style={{ background: "white", color: C.red, border: `1px solid rgba(166,64,61,0.3)` }}>
            <Trash2 size={14} /> Esvaziar lixeira
          </button>
        )}
      </div>

      <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
        Documentos excluídos ficam aqui por <b>{DIAS_NA_LIXEIRA} dias</b> e depois somem sozinhos.
        Até lá, dá para restaurar a qualquer momento.
      </p>

      {lixeira.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.inkMuted }} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por título ou tipo..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border, background: "white" }} />
        </div>
      )}

      {lixeira.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <Trash2 size={30} className="mx-auto mb-3" style={{ color: C.border }} />
          <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Lixeira vazia</p>
          <p className="text-sm" style={{ color: C.inkMuted }}>Nada foi excluído nos últimos {DIAS_NA_LIXEIRA} dias.</p>
        </div>
      ) : lixeiraFiltrada.length === 0 ? (
        <div className="text-center py-10 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <p className="text-sm" style={{ color: C.inkMuted }}>Nenhum resultado para essa busca.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {lixeiraFiltrada.map((r, idx) => {
            const dias = diasRestantes(r.excluidoEm);
            const tipo = TIPOS_DOC[r.prefixoOriginal]?.rotulo || "Documento";
            const urgente = dias <= 5;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : "none" }}>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{tituloNaLixeira(r)}</p>
                  <p className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: C.inkMuted }}>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: C.paperDark, color: C.inkMuted }}>{tipo}</span>
                    excluído {fmtDateRelativa(r.excluidoEm)}
                  </p>
                </div>

                <span className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
                  style={{
                    background: urgente ? "rgba(166,64,61,0.1)" : C.paperDark,
                    color: urgente ? C.red : C.inkMuted,
                  }}>
                  {dias === 1 ? "resta 1 dia" : `restam ${dias} dias`}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => onRestaurar(r)}
                    className="px-2.5 py-1.5 rounded-md text-xs font-semibold"
                    style={{ background: C.navy, color: C.paper }}>
                    Restaurar
                  </button>
                  <button onClick={() => setConfirmando(r)}
                    className="p-1.5 rounded-md" style={{ color: C.red }} title="Excluir definitivamente">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmando && (
        <ConfirmarExclusao
          titulo="Excluir definitivamente?"
          descricao={`"${tituloNaLixeira(confirmando)}" será apagado de vez. Esta ação não pode ser desfeita.`}
          textoBotao="Excluir de vez"
          onConfirmar={() => { onApagar(confirmando); setConfirmando(null); }}
          onCancelar={() => setConfirmando(null)}
        />
      )}

      {confirmandoTudo && (
        <ConfirmarExclusao
          titulo="Esvaziar a lixeira?"
          descricao={`Os ${lixeira.length} documento(s) da lixeira serão apagados de vez. Esta ação não pode ser desfeita.`}
          textoBotao="Esvaziar"
          onConfirmar={() => { onEsvaziar(); setConfirmandoTudo(false); }}
          onCancelar={() => setConfirmandoTudo(false)}
        />
      )}
    </>
  );
}
