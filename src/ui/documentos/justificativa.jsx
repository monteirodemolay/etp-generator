/**
 * Justificativa de aquisição — documento anterior à contratação, com a
 * motivação da compra.
 */

import React, { useState, useEffect } from "react";
import { ArrowLeft, FileEdit, Download, Lock, Info } from "lucide-react";
import { C } from "../tokens.js";
import { Field, RichTextEditor } from "../comuns/index.jsx";
import { gerarTextoPadraoJustificativa } from "../../conteudo/justificativa.js";
import { gerarDocumentoJustificativaWord } from "../../docx/documentos.js";
import { resolverCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import storage from "../../storage.js";

// ---------- Justificativa de Aquisição (ferramenta avulsa) ----------
export function JustificativaView({ doc, secretarias, onSalvar, onBack, somenteLeitura = false, embutido = false }) {
  const campos = doc.campos;
  const conteudo = doc.conteudo || "";
  const [timbreGlobal, setTimbreGlobal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modoPreview, setModoPreview] = useState(false);
  const cabecalho = resolverCabecalho(doc, secretarias, timbreGlobal);
  const timbre = cabecalho.tipo === "imagem" ? cabecalho.dataUrl : null;

  useEffect(() => {
    storage.get("timbre:padrao", false)
      .then(r => setTimbreGlobal(r?.value || TIMBRE_PADRAO))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function atualizarCampo(campo, valor) {
    onSalvar({ ...doc, campos: { ...campos, [campo]: valor } });
  }
  function atualizarConteudo(html) {
    onSalvar({ ...doc, conteudo: html });
  }

  function gerarPadrao() {
    atualizarConteudo(gerarTextoPadraoJustificativa(campos));
  }

  function baixarDocumento() {
    gerarDocumentoJustificativaWord({ conteudoHtml: conteudo, cabecalho }).catch(e => console.error(e));
  }

  const camposPreenchidos = Object.values(campos).filter(v => v?.trim?.()).length;

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-10"><p className="text-sm" style={{ color: C.inkMuted }}>Carregando...</p></div>;
  }

  return (
    <div className={embutido ? "max-w-3xl mx-auto" : "max-w-3xl mx-auto px-6 py-10"}>
      {!embutido && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6" style={{ color: C.navy }}>
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
          <FileEdit size={16} />
          <span className="text-xs font-semibold tracking-widest uppercase">Justificativa de aquisição</span>
        </div>
        <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>
          {campos.objeto?.trim() || "Nova justificativa"}
        </h1>
      </div>

      <p className="text-sm mb-6" style={{ color: C.inkMuted }}>
        Preencha os dados abaixo e gere o texto padrão automaticamente (sem IA), ou escreva a justificativa do seu
        jeito no editor formatado. As alterações são salvas automaticamente.
      </p>

      {somenteLeitura && (
        <p className="flex items-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg mb-5"
          style={{ background: "rgba(166,131,46,0.1)", color: C.ink }}>
          <Info size={13} style={{ color: C.brass }} /> Modo somente leitura — as alterações feitas aqui não serão salvas.
        </p>
      )}

      <div className="inline-flex p-1 rounded-lg mb-5" style={{ background: C.paperDark }}>
        <button onClick={() => setModoPreview(false)}
          className="px-3.5 py-1.5 rounded-md text-xs font-semibold"
          style={{ background: !modoPreview ? "white" : "transparent", color: !modoPreview ? C.navy : C.inkMuted, boxShadow: !modoPreview ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Dados e texto
        </button>
        <button onClick={() => setModoPreview(true)}
          className="px-3.5 py-1.5 rounded-md text-xs font-semibold"
          style={{ background: modoPreview ? "white" : "transparent", color: modoPreview ? C.navy : C.inkMuted, boxShadow: modoPreview ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>
          Pré-visualizar
        </button>
      </div>

      {!modoPreview ? (
        <div style={somenteLeitura ? { pointerEvents: "none", opacity: 0.75 } : undefined}>
          <div className="p-4 rounded-lg border mb-5" style={{ borderColor: C.border, background: "white" }}>
            <span className="text-xs font-semibold uppercase tracking-wide block mb-3" style={{ color: C.inkMuted }}>
              Dados da aquisição ({camposPreenchidos}/8 preenchidos)
            </span>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Objeto (o que está sendo adquirido)" value={campos.objeto} onChange={v => atualizarCampo("objeto", v)}
                placeholder="Ex.: Material de Consumo (Gás engarrafado P45kg)" />
              <Field label="Nº do Processo" value={campos.processo} onChange={v => atualizarCampo("processo", v)}
                placeholder="Ex.: 136187/2025" />
              <Field label="Órgão / Secretaria" value={campos.orgao} onChange={v => atualizarCampo("orgao", v)} />
              <Field label="Unidade/programa beneficiado" value={campos.unidadeBeneficiada} onChange={v => atualizarCampo("unidadeBeneficiada", v)}
                placeholder="Ex.: Unidade de Produção FABRIS e dos Programas vinculados ao FMAS" />
              <Field label="Local de entrega" value={campos.localEntrega} onChange={v => atualizarCampo("localEntrega", v)}
                placeholder="Ex.: sede da Secretaria Municipal de Assistência Social" />
              <Field label="Horário de entrega" value={campos.horarioEntrega} onChange={v => atualizarCampo("horarioEntrega", v)}
                placeholder="Ex.: 08:00 às 11:00 e 13:00 às 17:00, de segunda a sexta-feira" />
              <Field label="Prazo de pagamento (dias)" value={campos.prazoPagamentoDias} onChange={v => atualizarCampo("prazoPagamentoDias", v)}
                placeholder="Ex.: 10" />
            </div>
            <label className="block mt-1">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Programas/unidades beneficiados (um por linha)
              </span>
              <textarea value={campos.programas} onChange={e => atualizarCampo("programas", e.target.value)} rows={2}
                placeholder={"Ex.: Unidades de Produção Fabris\nCentro de Convivência Municipal"}
                className="mt-1.5 w-full px-3 py-2 rounded-lg border text-sm leading-relaxed resize-y"
                style={{ borderColor: C.border, background: "white" }} />
            </label>
            <p className="text-[10px] mt-2" style={{ color: C.inkMuted }}>
              Esta justificativa é anterior à aquisição — por isso não pede empresa, CNPJ nem nº de pregão, que
              ainda não existem nesta etapa.
            </p>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={gerarPadrao}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
              style={{ background: C.brass, color: C.navyDark }}
              title="Preenche com o texto-modelo salvo no app — grátis, sem IA e sem API">
              <FileEdit size={13} /> Gerar justificativa padrão (sem IA)
            </button>
          </div>
          <RichTextEditor value={conteudo} onChange={atualizarConteudo} />
        </div>
      ) : (
        <div className="rounded-lg border p-8 bg-white" style={{ borderColor: C.border }}>
          {timbre && (
            <div className="mb-6 flex justify-center">
              <img src={timbre} alt="Timbre" style={{ maxHeight: "110px", maxWidth: "100%" }} />
            </div>
          )}
          <h2 className="serif text-lg font-semibold text-center mb-4 uppercase" style={{ color: C.navy }}>Justificativa</h2>
          {conteudo ? (
            <div className="text-sm leading-relaxed rich-content text-justify" style={{ color: C.ink }}
              dangerouslySetInnerHTML={{ __html: conteudo }} />
          ) : (
            <p className="text-sm" style={{ color: C.inkMuted }}>Nenhum texto ainda — volte em "Dados e texto" e gere ou escreva a justificativa.</p>
          )}
          <p className="text-sm text-center mt-10 italic" style={{ color: C.ink }}>Atenciosamente,</p>
          <p className="text-sm text-center mt-16 italic" style={{ color: C.ink }}>[DATADO E ASSINADO DIGITALMENTE]</p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-5">
        <button onClick={baixarDocumento} disabled={!conteudo.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{ background: C.navy, color: C.paper }}>
          <Download size={15} /> Baixar documento (Word)
        </button>
      </div>
    </div>
  );
}
