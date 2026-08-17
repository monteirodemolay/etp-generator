/**
 * O invólucro do editor de ETP: cabeçalho, índice lateral fixo e a área de
 * conteúdo que alterna entre as etapas de preparação e o documento.
 */

import { contarPrevistosNoPca } from "../../dominio/pca.js";

import React, { useState } from "react";
import { ArrowLeft, FileText, Check, AlertCircle, Lock, Info } from "lucide-react";
import { C, COR_SITUACAO } from "../tokens.js";
import { SECOES } from "../../conteudo/incisos.js";
import { numeracaoFinal } from "../../dominio/numeracao.js";
import { progress } from "../../dominio/modelos.js";
import { valorTotalEtp } from "../../dominio/valores.js";
import { verificarConformidade } from "../../dominio/conformidade.js";
import { MetaForm, ItemsForm, PCAForm, CotacoesForm } from "./formularios.jsx";
import { DocumentoIncisos } from "./documento.jsx";
import { ChecklistConformidade } from "./checklist.jsx";

export function EditorView({ etp, activeSection, setActiveSection, onMeta, onSection, onItens, onCotacoes,
  onValoresAdotados, onPca, onManuaisPca, onSolucoesMercado, onExcluidos, secretarias, saveState, onBack, onPreview,
  somenteLeitura = false }) {
  const p = progress(etp);
  const numeros = numeracaoFinal(etp);
  const excluidos = etp.incisosExcluidos || [];
  const [showChecklist, setShowChecklist] = useState(false);
  const pendencias = verificarConformidade(etp).filter(a => a.nivel === "impeditivo").length;

  // Leva o documento até o inciso escolhido, em vez de trocar de tela
  function irParaInciso(id) {
    setActiveSection("documento");
    requestAnimationFrame(() => {
      const alvo = document.getElementById(`inciso-${id}`);
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const etapas = [
    { id: "itens", rotulo: "1. Planilha de Itens", pronto: (etp.itens || []).length > 0 },
    { id: "pca", rotulo: "2. Alinhamento ao PCA", pronto: !!etp.pca && (etp.itens || []).length > 0 && contarPrevistosNoPca(etp) === etp.itens.length },
    { id: "meta", rotulo: "3. Dados do Processo", pronto: !!etp.meta.titulo?.trim() },
    { id: "cotacoes", rotulo: "4. Levantamento de Preços", pronto: valorTotalEtp(etp) > 0 },
  ];

  const itemMenu = (ativo, conteudo, aoClicar, chave) => (
    <button key={chave} onClick={aoClicar}
      className="w-full text-left px-4 py-2.5 text-xs border-l-4 flex items-center gap-2"
      style={{
        borderColor: ativo ? C.brass : "transparent",
        background: ativo ? "rgba(166,131,46,0.15)" : "transparent",
        color: ativo ? C.brassLight : "#B7C0CC",
      }}>
      {conteudo}
    </button>
  );

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      <header className="no-print flex items-center justify-between px-6 py-3 border-b shrink-0 z-30"
        style={{ background: C.navy, borderColor: C.navyDark }}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-1.5 rounded-md hover:bg-white/10 shrink-0" style={{ color: C.paper }}>
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <span className="serif text-sm font-medium block truncate" style={{ color: C.paper }}>
              {etp.meta.titulo || "Novo ETP"}
            </span>
            {etp.meta.processo && (
              <span className="text-[10px]" style={{ color: "#B7C0CC" }}>Proc. {etp.meta.processo}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {somenteLeitura ? (
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md"
              style={{ background: "rgba(255,255,255,0.12)", color: C.paper }}>
              <Info size={13} /> Somente leitura
            </span>
          ) : (
            <span className="text-xs" style={{ color: saveState === "saving" ? C.brassLight : "#9FE0B0" }}>
              {saveState === "saving" ? "Salvando..." : "● Salvo"}
            </span>
          )}
          <button onClick={() => setShowChecklist(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{
              background: pendencias > 0 ? "rgba(166,64,61,0.9)" : "rgba(255,255,255,0.12)",
              color: C.paper,
            }}
            title="Confere o preenchimento e a coerência do ETP antes de finalizar">
            {pendencias > 0 ? <AlertCircle size={14} /> : <Check size={14} />}
            {pendencias > 0 ? `${pendencias} pendência(s)` : "Conformidade"}
          </button>
          <button onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.brass, color: C.navyDark }}>
            <FileText size={14} /> Pré-visualizar
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Índice lateral — fixo, rola por conta própria e fica sempre visível. Continua navegável
            mesmo em modo somente leitura, pois só serve para ler/mudar de seção, não para gravar. */}
        <nav className="no-print w-60 shrink-0 overflow-y-auto etp-scroll" style={{ background: C.navyDark }}>
          <div className="px-4 pt-4 pb-1 text-[9.5px] font-bold tracking-widest uppercase" style={{ color: C.brass }}>
            Preparação
          </div>
          {etapas.map(et => itemMenu(activeSection === et.id, (
            <>
              <span className="flex-1">{et.rotulo}</span>
              {et.pronto && <Check size={12} className="shrink-0" style={{ color: C.green }} />}
            </>
          ), () => setActiveSection(et.id), et.id))}

          <div className="px-4 pt-4 pb-1 text-[9.5px] font-bold tracking-widest uppercase" style={{ color: C.brass }}>
            Documento — art. 18
          </div>
          {itemMenu(activeSection === "documento", (
            <span className="flex-1 font-semibold">Abrir documento completo</span>
          ), () => setActiveSection("documento"), "documento")}

          {SECOES.map(s => {
            const fora = excluidos.includes(s.id);
            const preenchido = !!etp.sections[s.id]?.trim();
            return (
              <button key={s.id} onClick={() => irParaInciso(s.id)}
                className="w-full text-left pl-6 pr-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-white/5"
                style={{ color: fora ? "#5C6675" : "#B7C0CC", textDecoration: fora ? "line-through" : "none" }}>
                <span className="serif font-bold w-7 shrink-0"
                  style={{ color: fora ? "#5C6675" : (preenchido ? C.brassLight : "#8A93A3") }}>
                  {numeros[s.id] || s.id}
                </span>
                <span className="flex-1 leading-tight truncate">{s.titulo}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: fora ? "transparent" : preenchido ? C.green : (s.obrig ? C.red : "#4A5568") }} />
              </button>
            );
          })}

          <div className="px-4 py-3 mt-2 text-[11px]" style={{ color: "#8A93A3" }}>
            {Object.keys(numeros).length}/13 no documento
            {excluidos.length > 0 && ` · ${excluidos.length} fora`}
            <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full" style={{
                width: `${Math.round((p.reqFilled / p.reqTotal) * 100)}%`,
                background: p.reqFilled === p.reqTotal ? C.green : C.brass,
              }} />
            </div>
            <div className="mt-1" style={{ color: p.reqFilled === p.reqTotal ? C.green : C.brassLight }}>
              {p.reqFilled}/{p.reqTotal} obrigatórios
            </div>
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto etp-scroll relative" style={{ background: C.paper }}>
          {somenteLeitura && (
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 text-xs font-medium"
              style={{ background: "rgba(166,131,46,0.12)", color: C.ink }}>
              <Info size={13} style={{ color: C.brass }} /> Modo somente leitura — as alterações feitas aqui não serão salvas.
            </div>
          )}
          <div style={somenteLeitura ? { pointerEvents: "none", opacity: 0.75 } : undefined}>
          {activeSection === "documento" ? (
            <DocumentoIncisos etp={etp} onSection={onSection} onSolucoesMercado={onSolucoesMercado}
              onExcluidos={onExcluidos} secretarias={secretarias} />
          ) : (
            <div className="max-w-3xl mx-auto px-8 py-10">
              {activeSection === "meta" ? (
                <MetaForm etp={etp} onMeta={onMeta} />
              ) : activeSection === "itens" ? (
                <ItemsForm etp={etp} onItens={onItens} onMeta={onMeta} />
              ) : activeSection === "pca" ? (
                <PCAForm etp={etp} onPca={onPca} onManuaisPca={onManuaisPca} secretarias={secretarias} />
              ) : (
                <CotacoesForm etp={etp} onValoresAdotados={onValoresAdotados} onCotacoes={onCotacoes} onMeta={onMeta} />
              )}
            </div>
          )}
          </div>
        </main>
      </div>

      {showChecklist && (
        <ChecklistConformidade etp={etp}
          onIrPara={destino => setActiveSection(destino)}
          onFechar={() => setShowChecklist(false)} />
      )}
    </div>
  );
}
