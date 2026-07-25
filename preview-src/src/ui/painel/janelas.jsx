/**
 * Janelas do painel: o guia rápido e a criação de documentos.
 *
 * A janela de criação recolhe o essencial ANTES de criar — assim o documento
 * só nasce quando o servidor confirma, e não fica ETP em branco na lista.
 */

import React, { useState } from "react";
import { FileText, ListChecks, FileEdit, Plus, X } from "lucide-react";
import { C } from "../tokens.js";
import { TIPOS_OBJETO } from "../../dominio/opcoes.js";


// ---------- Guia rápido ----------
export function GuiaRapido({ onFechar }) {
  const passos = [
    ["1. Planilha de Itens", "Importe do Sistema Centi ou cadastre à mão. O código do produto é essencial: é por ele que o app localiza cada item no PCA."],
    ["2. Alinhamento ao PCA", "Importe a planilha do painel do PCA. O cruzamento é automático; para códigos divergentes, você vincula a linha certa pela busca."],
    ["3. Dados do Processo", "Objeto, setor, responsáveis, prazos e demais campos que alimentam os textos-modelo dos incisos."],
    ["4. Levantamento de Preços", "Lance as cotações por item e escolha a metodologia (média ou mediana). Daí sai a estimativa de valor."],
    ["5. Documento", "Os 13 incisos numa página só. Use o texto-modelo, escreva do seu jeito, ou leve o prompt a uma IA gratuita."],
    ["6. Conformidade e exportação", "Confira as pendências antes de finalizar e baixe em Word ou PDF."],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
      onClick={onFechar}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-xl max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl"
          style={{ borderColor: C.border }}>
          <div>
            <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
              <FileText size={15} />
              <span className="text-xs font-semibold tracking-widest uppercase">Como funciona</span>
            </div>
            <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Guia rápido</h3>
          </div>
          <button onClick={onFechar} className="shrink-0" style={{ color: C.inkMuted }}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {passos.map(([titulo, texto], i) => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center serif text-xs font-bold"
                style={{ background: C.paperDark, color: C.brass }}>{i + 1}</div>
              <div>
                <p className="text-sm font-semibold" style={{ color: C.navy }}>{titulo}</p>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: C.inkMuted }}>{texto}</p>
              </div>
            </div>
          ))}
          <p className="text-[11px] leading-relaxed pt-2 border-t" style={{ borderColor: C.border, color: C.inkMuted }}>
            As Declarações de PCA e as Justificativas de aquisição são documentos independentes — não precisam
            de um ETP aberto e ficam salvas em listas próprias.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------- Janela de novo documento ----------
// Recolhe o essencial antes de criar. Assim o documento só nasce quando você confirma —
// nada de ETP em branco aparecendo na lista por engano.
export function JanelaNovoDocumento({ inicial, secretarias, secretariaAtiva, onFechar, onCriar }) {
  const [tipo, setTipo] = useState(inicial.tipo || "etp");
  const [objeto, setObjeto] = useState("");
  const [tipoObjeto, setTipoObjeto] = useState(inicial.tipoObjeto || TIPOS_OBJETO[0]);
  const [processo, setProcesso] = useState("");
  const [secretariaId, setSecretariaId] = useState(
    secretariaAtiva !== "todas" ? secretariaAtiva : (secretarias[0]?.id || "")
  );

  const rotulos = {
    etp: { titulo: "Novo Estudo Técnico Preliminar", icone: FileText,
           ajuda: "O documento principal, com os 13 incisos do art. 18." },
    declaracao: { titulo: "Nova Declaração de previsão no PCA", icone: ListChecks,
                  ajuda: "Confere se os itens constam no Plano de Contratações Anual." },
    justificativa: { titulo: "Nova Justificativa de aquisição", icone: FileEdit,
                     ajuda: "Documento anterior à aquisição, com a motivação da compra." },
  };
  const r = rotulos[tipo];
  const Icone = r.icone;
  const secretaria = secretarias.find(x => x.id === secretariaId);

  function confirmar(e) {
    e.preventDefault();
    onCriar({
      tipo,
      objeto: objeto.trim(),
      tipoObjeto,
      processo: processo.trim(),
      secretariaId,
      orgao: secretaria?.nome || "",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(18,32,50,0.6)" }} onClick={onFechar}>
      <form onSubmit={confirmar} onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">

        <div className="flex items-start justify-between gap-3 p-5 pb-4 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(166,131,46,0.12)" }}>
              <Icone size={19} style={{ color: C.brass }} />
            </div>
            <div>
              <h3 className="serif text-lg font-semibold leading-tight" style={{ color: C.navy }}>{r.titulo}</h3>
              <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>{r.ajuda}</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} className="shrink-0" style={{ color: C.inkMuted }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          {/* Trocar o tipo sem fechar a janela */}
          <div className="inline-flex p-1 rounded-lg mb-4" style={{ background: C.paperDark }}>
            {[["etp", "ETP"], ["declaracao", "Declaração"], ["justificativa", "Justificativa"]].map(([v, rot]) => (
              <button key={v} type="button" onClick={() => setTipo(v)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold"
                style={{
                  background: tipo === v ? "white" : "transparent",
                  color: tipo === v ? C.navy : C.inkMuted,
                  boxShadow: tipo === v ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}>
                {rot}
              </button>
            ))}
          </div>

          <label className="block mb-4">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
              Objeto {tipo === "etp" ? "(o que será contratado)" : ""}
            </span>
            <input value={objeto} onChange={e => setObjeto(e.target.value)} autoFocus
              placeholder={tipo === "etp"
                ? "Ex.: Aquisição de material de copa e cozinha"
                : "Ex.: Aquisição de gás engarrafado P45"}
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm"
              style={{ borderColor: C.border }} />
            <span className="text-[10.5px] mt-1 block" style={{ color: C.inkMuted }}>
              Pode deixar em branco e preencher depois — mas ajuda a achar o documento na lista.
            </span>
          </label>

          {tipo === "etp" && (
            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Tipo de objeto
              </span>
              <select value={tipoObjeto} onChange={e => setTipoObjeto(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white"
                style={{ borderColor: C.border }}>
                {TIPOS_OBJETO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-[10.5px] mt-1 block" style={{ color: C.inkMuted }}>
                Os textos-modelo dos incisos se ajustam a esta escolha.
              </span>
            </label>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Entidade
              </span>
              <select value={secretariaId} onChange={e => setSecretariaId(e.target.value)}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white"
                style={{ borderColor: C.border }}>
                {secretarias.map(x => (
                  <option key={x.id} value={x.id}>{x.sigla || x.nome || "Sem nome"}</option>
                ))}
              </select>
            </label>

            {tipo !== "declaracao" && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                  Nº do processo
                </span>
                <input value={processo} onChange={e => setProcesso(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{ borderColor: C.border }} />
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onFechar}
              className="px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: C.navy, color: C.paper }}>
              <Plus size={15} /> Criar e abrir
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
