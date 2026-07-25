/**
 * Tela de Materiais Normativos: leis, decretos e instruções em PDF.
 */

import React, { useState, useRef } from "react";
import { Upload, Download, Trash2, Scale } from "lucide-react";
import { C } from "../tokens.js";
import { ConfirmarExclusao } from "../comuns/index.jsx";
import { formatarBytes, LIMITE_BYTES_NORMATIVO } from "../../dominio/normativos.js";
import { fmtDateRelativa } from "../../dominio/datas.js";

// ---------- Materiais Normativos ----------
// Biblioteca de referência: leis, decretos e normativas locais em PDF, para consulta rápida
// durante a elaboração do ETP. Cada registro guarda o PDF já em base64 (o storage.js cuida de
// fatiar automaticamente arquivos grandes) — não há servidor de arquivos separado a manter.
export function NormativosView({ normativos, onUpload, onExcluir }) {
  const fileRef = useRef(null);
  const [pendente, setPendente] = useState(null); // { file } aguardando descrição antes de enviar
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aExcluir, setAExcluir] = useState(null);

  function selecionarArquivo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setErro("Envie apenas arquivos em PDF."); return; }
    if (file.size > LIMITE_BYTES_NORMATIVO) { setErro("Arquivo maior que 8 MB — reduza o PDF antes de enviar."); return; }
    setErro("");
    setDescricao("");
    setPendente({ file });
  }

  async function confirmarEnvio() {
    if (!pendente) return;
    setEnviando(true);
    try {
      await onUpload(pendente.file, descricao);
      setPendente(null);
    } catch {
      setErro("Não foi possível enviar o arquivo. Tente novamente.");
    }
    setEnviando(false);
  }

  const ordenados = [...normativos].sort((a, b) => b.enviadoEm - a.enviadoEm);

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Materiais Normativos</h1>
          <p className="text-sm max-w-xl leading-relaxed" style={{ color: C.inkMuted }}>
            Leis, decretos e normativas locais sobre a elaboração do ETP, disponíveis para consulta
            por qualquer usuário do sistema.
          </p>
        </div>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm shrink-0"
          style={{ background: C.navy, color: C.paper }}>
          <Upload size={16} /> Enviar PDF
        </button>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={selecionarArquivo} />
      </div>

      {erro && (
        <p className="text-xs mb-4 px-3 py-2.5 rounded-lg" style={{ background: "rgba(166,64,61,0.09)", color: C.ink }}>
          {erro}
        </p>
      )}

      {ordenados.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <Scale size={30} className="mx-auto mb-3" style={{ color: C.border }} />
          <p className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Nenhum material enviado ainda</p>
          <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
            Envie a Lei nº 14.133/2021, decretos municipais ou instruções normativas em PDF.
          </p>
          <button onClick={() => fileRef.current?.click()}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: C.navy, color: C.paper }}>
            Enviar o primeiro PDF
          </button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {ordenados.map((n, i) => (
            <div key={n.id} className="flex items-start gap-3 px-5 py-3.5"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
              <Scale size={17} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{n.nome}</p>
                {n.descricao && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: C.ink }}>{n.descricao}</p>
                )}
                <p className="text-[11px] mt-0.5" style={{ color: C.inkMuted }}>
                  {formatarBytes(n.tamanhoBytes)} · enviado {fmtDateRelativa(n.enviadoEm)}
                  {n.enviadoPor ? ` por ${n.enviadoPor}` : ""}
                </p>
              </div>
              <a href={n.dataUrl} download={n.nome}
                className="p-2 rounded-lg shrink-0" style={{ color: C.inkMuted }} title="Baixar">
                <Download size={15} />
              </a>
              <button onClick={() => setAExcluir(n)}
                className="p-2 rounded-lg shrink-0" style={{ color: C.inkMuted }} title="Excluir">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {pendente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.5)" }}>
          <div className="w-full max-w-md rounded-xl p-6" style={{ background: "white" }}>
            <h3 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>Sobre o que é este arquivo?</h3>
            <p className="text-xs mb-4 truncate" style={{ color: C.inkMuted }}>{pendente.file.name}</p>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} autoFocus rows={3}
              placeholder="Ex.: Decreto municipal nº 123/2024 — regulamenta o procedimento de pesquisa de preços."
              className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none"
              style={{ borderColor: C.border }} />
            <p className="text-[11px] mt-1.5" style={{ color: C.inkMuted }}>
              Ajuda quem for consultar depois a entender do que se trata sem precisar abrir o PDF.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button onClick={() => setPendente(null)} disabled={enviando}
                className="px-3.5 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={confirmarEnvio} disabled={enviando}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                style={{ background: C.navy, color: C.paper }}>
                {enviando ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Excluir material normativo?"
          descricao={`"${aExcluir.nome}" será apagado de vez e deixará de aparecer para todos os usuários. Esta ação não pode ser desfeita.`}
          onConfirmar={() => { onExcluir(aExcluir.id); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </>
  );
}
