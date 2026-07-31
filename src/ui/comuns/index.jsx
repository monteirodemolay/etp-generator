/**
 * Componentes compartilhados por várias telas.
 *
 * A barra de formatação age sobre o campo em foco no momento, como no Word.
 * Por isso pode ser compartilhada por vários editores ao mesmo tempo: os
 * botões nunca roubam o foco (onMouseDown com preventDefault).
 */

import React, { useState, useEffect, useRef } from "react";
import { Table2 as TableIcon, AlertCircle, Upload } from "lucide-react";
import { C } from "../tokens.js";

// Área de upload por clique OU arrastar-e-soltar — usada em toda tela que
// pede pra escolher um ou mais arquivos. Um único lugar pra manter esse
// comportamento consistente em vez de reimplementar em cada tela.
export function AreaUpload({ onArquivos, accept, multiple = false, disabled = false, className, style, children }) {
  const [arrastandoSobre, setArrastandoSobre] = useState(false);
  const inputRef = useRef(null);

  function processarArquivos(lista) {
    const arquivos = Array.from(lista || []);
    if (arquivos.length > 0) onArquivos(multiple ? arquivos : [arquivos[0]]);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setArrastandoSobre(false);
    if (disabled) return;
    processarArquivos(e.dataTransfer?.files);
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setArrastandoSobre(true); }}
      onDragLeave={e => { e.preventDefault(); setArrastandoSobre(false); }}
      onDrop={handleDrop}
      className={className}
      style={{
        ...style,
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.15s, border-color 0.15s",
        ...(arrastandoSobre ? { background: "rgba(166,131,46,0.08)", borderColor: C.brass } : {}),
      }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} disabled={disabled} className="hidden"
        onChange={e => { processarArquivos(e.target.files); e.target.value = ""; }} />
      {children}
      {arrastandoSobre && (
        <p className="text-xs font-semibold mt-1" style={{ color: C.brass }}>Solte aqui para enviar</p>
      )}
    </div>
  );
}



export function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block mb-4">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
    </label>
  );
}

// ---------- Editor com formatação (negrito, listas, tabela) ----------
// Usa contentEditable + document.execCommand — simples, sem dependências externas.
// O conteúdo é guardado como HTML dentro de etp.sections[id].
// ---------- Barra de formatação ----------
// Age sobre o campo que estiver em foco no momento, como no Word. Por isso pode ser
// compartilhada por vários editores ao mesmo tempo — os botões nunca roubam o foco.
export function BarraFormatacao({ aoAlterar, rotuloAlvo }) {
  const [linhasTabela, setLinhasTabela] = useState(3);
  const [colunasTabela, setColunasTabela] = useState(3);
  const [showTabelaConfig, setShowTabelaConfig] = useState(false);

  function exec(cmd, arg = null) {
    document.execCommand(cmd, false, arg);
    aoAlterar?.();
  }

  function inserirTabela() {
    const linhas = Math.min(30, Math.max(1, Number(linhasTabela) || 3));
    const colunas = Math.min(12, Math.max(1, Number(colunasTabela) || 3));
    let html = '<table style="width:100%;border-collapse:collapse;margin:8px 0;"><tbody>';
    for (let r = 0; r < linhas; r++) {
      html += "<tr>";
      for (let c = 0; c < colunas; c++) {
        html += `<td style="border:1px solid #999;padding:6px 8px;min-width:50px;">&nbsp;</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br/></p>";
    document.execCommand("insertHTML", false, html);
    aoAlterar?.();
    setShowTabelaConfig(false);
  }

  const btn = (label, onClick, title) => (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={onClick} title={title}
      className="px-2.5 py-1.5 rounded text-xs font-medium hover:bg-black/5"
      style={{ color: C.navy }}>
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap">
      <select onMouseDown={e => e.stopPropagation()}
        onChange={e => { exec("formatBlock", e.target.value); e.target.value = ""; }}
        defaultValue="" className="px-2 py-1.5 rounded text-xs font-medium bg-white border mr-1"
        style={{ borderColor: C.border, color: C.navy }} title="Estilo do parágrafo">
        <option value="" disabled>Estilo</option>
        <option value="<p>">Parágrafo normal</option>
        <option value="<h4>">Título 1</option>
        <option value="<h5>">Título 2</option>
        <option value="<h6>">Título 3</option>
        <option value="<blockquote>">Citação</option>
      </select>
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn(<b>N</b>, () => exec("bold"), "Negrito")}
      {btn(<i>I</i>, () => exec("italic"), "Itálico")}
      {btn(<u>S</u>, () => exec("underline"), "Sublinhado")}
      {btn(<span style={{ textDecoration: "line-through" }}>T</span>, () => exec("strikeThrough"), "Tachado")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn("⯇", () => exec("justifyLeft"), "Alinhar à esquerda")}
      {btn("☰", () => exec("justifyCenter"), "Centralizar")}
      {btn("⯈", () => exec("justifyRight"), "Alinhar à direita")}
      {btn("☰☰", () => exec("justifyFull"), "Justificar")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn("• Lista", () => exec("insertUnorderedList"), "Lista com marcadores")}
      {btn("1. Lista", () => exec("insertOrderedList"), "Lista numerada")}
      {btn("⇥", () => exec("indent"), "Aumentar recuo")}
      {btn("⇤", () => exec("outdent"), "Diminuir recuo")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      <div className="relative">
        {btn(<span className="flex items-center gap-1"><TableIcon size={13} /> Tabela</span>,
          () => setShowTabelaConfig(v => !v), "Inserir tabela")}
        {showTabelaConfig && (
          <div className="absolute top-full left-0 mt-1 z-30 flex items-center gap-2 p-2.5 rounded-lg border shadow-lg"
            style={{ background: "white", borderColor: C.border }}>
            <label className="flex items-center gap-1 text-xs" style={{ color: C.inkMuted }}>
              Linhas
              <input type="number" min="1" max="30" value={linhasTabela} onChange={e => setLinhasTabela(e.target.value)}
                className="w-12 px-1 py-1 rounded border text-xs text-center" style={{ borderColor: C.border }} />
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: C.inkMuted }}>
              Colunas
              <input type="number" min="1" max="12" value={colunasTabela} onChange={e => setColunasTabela(e.target.value)}
                className="w-12 px-1 py-1 rounded border text-xs text-center" style={{ borderColor: C.border }} />
            </label>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={inserirTabela}
              className="px-2.5 py-1 rounded text-xs font-medium" style={{ background: C.navy, color: C.paper }}>
              Inserir
            </button>
          </div>
        )}
      </div>
      {btn("— Linha", () => exec("insertHorizontalRule"), "Inserir linha horizontal")}
      <span className="w-px h-4 mx-1" style={{ background: C.border }} />
      {btn("⌫", () => exec("removeFormat"), "Limpar formatação")}
      {btn("↶", () => exec("undo"), "Desfazer")}
      {btn("↷", () => exec("redo"), "Refazer")}
      {rotuloAlvo && (
        <span className="ml-auto text-[11px] px-2.5 py-1 rounded-full"
          style={{ background: C.paperDark, color: C.inkMuted }}>
          {rotuloAlvo}
        </span>
      )}
    </div>
  );
}

// ---------- Campo de texto formatado ----------
// Sincroniza o HTML só quando o valor muda de fora (ex.: "Usar modelo padrão"), para não
// atropelar o cursor enquanto se digita.
export function CampoFormatado({ value, onChange, onFocus, placeholder, minHeight = "70px" }) {
  const ref = useRef(null);
  const [vazio, setVazio] = useState(!value);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
      setVazio(!ref.current.textContent.trim());
    }
  }, [value]);

  function aoDigitar() {
    const html = ref.current?.innerHTML || "";
    setVazio(!ref.current?.textContent.trim());
    onChange(html);
  }

  return (
    <div className="relative">
      {vazio && placeholder && (
        <span className="absolute pointer-events-none px-2 py-1.5 text-sm italic"
          style={{ color: "#B9B4A6" }}>{placeholder}</span>
      )}
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={aoDigitar} onBlur={aoDigitar} onFocus={onFocus}
        className="px-2 py-1.5 text-sm leading-relaxed text-justify rounded-md"
        style={{ minHeight, outline: "none", border: "1px solid transparent" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.border; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; }} />
    </div>
  );
}

// Mantido para as telas que usam um editor isolado (timbre em texto da Secretaria)
export function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) ref.current.innerHTML = value || "";
  }, [value]);

  function sincronizar() {
    onChange(ref.current?.innerHTML || "");
    setVersao(v => v + 1);
  }

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
      <div className="border-b" style={{ borderColor: C.border, background: C.paperDark }}>
        <BarraFormatacao aoAlterar={sincronizar} />
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={sincronizar} onBlur={sincronizar}
        className="px-4 py-3 text-sm leading-relaxed"
        style={{ minHeight: "160px", background: "white", outline: "none" }} />
    </div>
  );
}

// ---------- Confirmação de exclusão ----------
// Substitui o clique duplo, que era fácil demais de disparar sem querer.
export function ConfirmarExclusao({ titulo, descricao, textoBotao = "Excluir", onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(18,32,50,0.6)" }} onClick={onCancelar}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(166,64,61,0.1)" }}>
            <AlertCircle size={19} style={{ color: C.red }} />
          </div>
          <div>
            <h3 className="serif text-lg font-semibold leading-tight" style={{ color: C.navy }}>{titulo}</h3>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: C.inkMuted }}>{descricao}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancelar}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}>
            Cancelar
          </button>
          <button onClick={onConfirmar}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: C.red, color: "white" }}>
            {textoBotao}
          </button>
        </div>
      </div>
    </div>
  );
}
