/**
 * Checklist de conformidade — a conferência antes de finalizar.
 */

import React from "react";
import { ClipboardList, X, Check, AlertCircle, Info } from "lucide-react";
import { C, COR_NIVEL } from "../tokens.js";
import { verificarConformidade } from "../../dominio/conformidade.js";
import { citarPorExtenso } from "../../normativo/referencia.js";


// ---------- Checklist de conformidade ----------
export function ChecklistConformidade({ etp, onIrPara, onFechar }) {
  const apontamentos = verificarConformidade(etp);
  const impeditivos = apontamentos.filter(a => a.nivel === "impeditivo");
  const atencoes = apontamentos.filter(a => a.nivel === "atencao");
  const oks = apontamentos.filter(a => a.nivel === "ok");
  const liberado = impeditivos.length === 0;

  const rotuloEtapa = {
    meta: "Dados do Processo", itens: "Planilha de Itens",
    pca: "Alinhamento ao PCA", cotacoes: "Levantamento de Preços",
    documento: "Documento",
  };

  const linha = (a, i, cor, icone) => (
    <button key={i} onClick={() => { onIrPara(a.onde); onFechar(); }}
      className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-black/[0.02]"
      style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
      <span className="shrink-0 mt-0.5" style={{ color: cor }}>{icone}</span>
      <span className="flex-1 text-xs leading-relaxed" style={{ color: C.ink }}>{a.texto}</span>
      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full"
        style={{ background: C.paperDark, color: C.inkMuted }}>
        {rotuloEtapa[a.onde] || a.onde}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
      onClick={onFechar}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">

        <div className="p-5 pb-4 border-b sticky top-0 bg-white rounded-t-xl z-10" style={{ borderColor: C.border }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
                <ClipboardList size={15} />
                <span className="text-xs font-semibold tracking-widest uppercase">Antes de finalizar</span>
              </div>
              <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Conformidade do ETP</h3>
            </div>
            <button onClick={onFechar} className="shrink-0" style={{ color: C.inkMuted }}><X size={20} /></button>
          </div>

          <div className="mt-3 p-3 rounded-lg flex items-center gap-2 text-sm"
            style={{ background: liberado ? "rgba(76,124,89,0.1)" : "rgba(166,64,61,0.08)" }}>
            {liberado ? <Check size={16} style={{ color: C.green }} /> : <AlertCircle size={16} style={{ color: C.red }} />}
            <span style={{ color: C.ink }}>
              {liberado
                ? <>Nenhuma pendência impeditiva{atencoes.length > 0 ? ` — mas há ${atencoes.length} ponto(s) de atenção.` : ". O ETP está pronto para finalizar."}</>
                : <><b>{impeditivos.length} pendência(s) impeditiva(s)</b> — revise antes de finalizar o documento.</>}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {impeditivos.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.red }}>
                Impeditivos ({impeditivos.length})
              </h4>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "rgba(166,64,61,0.3)" }}>
                {impeditivos.map((a, i) => linha(a, i, C.red, <AlertCircle size={13} />))}
              </div>
            </div>
          )}

          {atencoes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.brass }}>
                Pontos de atenção ({atencoes.length})
              </h4>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                {atencoes.map((a, i) => linha(a, i, C.brass, <Info size={13} />))}
              </div>
            </div>
          )}

          {oks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.green }}>
                Verificado ({oks.length})
              </h4>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                {oks.map((a, i) => linha(a, i, C.green, <Check size={13} />))}
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed" style={{ color: C.inkMuted }}>
            Esta conferência é um apoio ao seu trabalho, não um parecer jurídico. Ela verifica o preenchimento
            e a coerência interna do documento — a adequação de cada texto ao caso concreto continua sendo
            avaliação sua. Clique em qualquer linha para ir direto ao ponto.
          </p>
        </div>
      </div>
    </div>
  );
}
