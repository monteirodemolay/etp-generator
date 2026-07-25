/**
 * Tela de backup: exportar e importar todo o acervo.
 */

import React, { useState, useEffect, useRef } from "react";
import { Download, Upload, Check, AlertCircle, Info, Loader2 } from "lucide-react";
import { C } from "../tokens.js";
import { montarBackup, baixarBackup, lerBackup, resumirBackup, restaurarBackup } from "../../dominio/backup.js";
import { fmtDate } from "../../dominio/datas.js";
import storage from "../../storage.js";


// ---------- Backup ----------
export function TelaBackup({ onRestaurado }) {
  const [exportando, setExportando] = useState(false);
  const [resumoAtual, setResumoAtual] = useState(null);
  const [arquivo, setArquivo] = useState(null);   // { pacote, resumo }
  const [modo, setModo] = useState("mesclar");
  const [erro, setErro] = useState("");
  const [restaurando, setRestaurando] = useState(false);
  const [feito, setFeito] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    montarBackup().then(p => setResumoAtual(resumirBackup(p))).catch(() => {});
  }, []);

  async function exportar() {
    setExportando(true);
    setErro("");
    try {
      const pacote = await montarBackup();
      baixarBackup(pacote);
      setFeito("Backup baixado. Guarde o arquivo num lugar seguro — de preferência numa pasta sincronizada.");
      setTimeout(() => setFeito(""), 6000);
    } catch (e) {
      console.error(e);
      setErro("Não foi possível gerar o backup.");
    }
    setExportando(false);
  }

  async function escolherArquivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro("");
    setArquivo(null);
    try {
      const texto = await f.text();
      const pacote = lerBackup(texto);
      setArquivo({ pacote, resumo: resumirBackup(pacote), nome: f.name });
    } catch (err) {
      setErro(err.message || "Arquivo inválido.");
    }
    e.target.value = "";
  }

  async function confirmarRestauracao() {
    setRestaurando(true);
    setErro("");
    try {
      await restaurarBackup(arquivo.pacote, modo);
      setArquivo(null);
      setFeito("Backup restaurado.");
      onRestaurado?.();
    } catch (e) {
      console.error(e);
      setErro("Falha ao restaurar. Nada foi perdido — tente novamente.");
    }
    setRestaurando(false);
  }

  const linhaResumo = (r) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
      {[["ETPs", r.etps], ["Justificativas", r.justificativas], ["Declarações", r.declaracoes], ["Secretarias", r.secretarias]]
        .map(([rot, n]) => (
          <div key={rot} className="px-2 py-2.5 rounded-lg" style={{ background: C.paperDark }}>
            <p className="serif text-xl font-semibold leading-none" style={{ color: C.navy }}>{n}</p>
            <p className="text-[10.5px] mt-1" style={{ color: C.inkMuted }}>{rot}</p>
          </div>
        ))}
    </div>
  );

  return (
    <>
      <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Backup</h1>
      <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
        Seus documentos ficam gravados apenas neste navegador. Baixe uma cópia de tempos em tempos — é o
        que permite recuperar tudo se a máquina for formatada ou os dados do site forem limpos.
      </p>

      {feito && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2 text-xs"
          style={{ background: "rgba(76,124,89,0.1)", color: C.ink }}>
          <Check size={14} className="shrink-0 mt-0.5" style={{ color: C.green }} /> {feito}
        </div>
      )}
      {erro && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-2 text-xs"
          style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: C.red }} /> {erro}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Exportar */}
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Download size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Salvar cópia</span>
          </div>
          <h3 className="serif text-lg font-semibold mb-3" style={{ color: C.navy }}>Exportar tudo</h3>

          {resumoAtual ? (
            <>
              {linhaResumo(resumoAtual)}
              <p className="text-[11px] mt-3" style={{ color: C.inkMuted }}>
                Inclui também {resumoAtual.pcasPorEntidade > 0 ? `${resumoAtual.pcasPorEntidade} planilha(s) de PCA importada(s), ` : ""}
                {resumoAtual.temTimbre ? "o timbre geral " : ""}e o diretório de responsáveis.
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: C.inkMuted }}>Levantando o que há para salvar...</p>
          )}

          <button onClick={exportar} disabled={exportando}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: C.navy, color: C.paper }}>
            {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {exportando ? "Preparando..." : "Baixar backup (.json)"}
          </button>

          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
            style={{ background: C.paperDark, color: C.inkMuted }}>
            <Info size={13} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
            <span>
              Salve numa pasta do OneDrive, Google Drive ou na rede da Prefeitura: assim o arquivo sobe
              sozinho para a nuvem e você fica protegido mesmo se perder o computador.
            </span>
          </div>
        </div>

        {/* Importar */}
        <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Upload size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Recuperar</span>
          </div>
          <h3 className="serif text-lg font-semibold mb-3" style={{ color: C.navy }}>Importar backup</h3>

          {!arquivo ? (
            <>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: C.inkMuted }}>
                Escolha um arquivo gerado por este app. Antes de gravar qualquer coisa, você verá o que ele
                contém e escolherá como restaurar.
              </p>
              <input ref={inputRef} type="file" accept=".json,application/json" onChange={escolherArquivo} className="hidden" />
              <button onClick={() => inputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border"
                style={{ borderColor: C.border, color: C.navy, background: "white" }}>
                <Upload size={15} /> Escolher arquivo
              </button>
            </>
          ) : (
            <>
              <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
                <b style={{ color: C.navy }}>{arquivo.nome}</b>
                {arquivo.resumo.geradoEm && ` · gerado em ${fmtDate(new Date(arquivo.resumo.geradoEm).getTime())}`}
              </p>
              {linhaResumo(arquivo.resumo)}

              <div className="mt-4 space-y-2">
                {[
                  ["mesclar", "Mesclar com o que já existe", "Mantém seus documentos atuais. Documentos de mesmo identificador são substituídos pela versão do arquivo."],
                  ["substituir", "Substituir tudo", "Apaga os documentos atuais e deixa apenas os do arquivo."],
                ].map(([v, titulo, desc]) => (
                  <label key={v} className="flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer"
                    style={{
                      borderColor: modo === v ? C.brass : C.border,
                      background: modo === v ? "rgba(166,131,46,0.06)" : "white",
                    }}>
                    <input type="radio" name="modo-restauracao" checked={modo === v} onChange={() => setModo(v)}
                      className="mt-0.5" style={{ accentColor: C.brass }} />
                    <span>
                      <span className="block text-xs font-semibold" style={{ color: C.navy }}>{titulo}</span>
                      <span className="block text-[11px] leading-snug mt-0.5" style={{ color: C.inkMuted }}>{desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              {modo === "substituir" && (
                <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
                  style={{ background: "rgba(166,64,61,0.08)", color: C.ink }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.red }} />
                  <span>
                    Seus {resumoAtual?.etps || 0} ETP(s), {resumoAtual?.justificativas || 0} justificativa(s) e{" "}
                    {resumoAtual?.declaracoes || 0} declaração(ões) atuais serão apagados. Se ainda não baixou um
                    backup do estado de hoje, faça isso antes.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <button onClick={() => setArquivo(null)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                  Cancelar
                </button>
                <button onClick={confirmarRestauracao} disabled={restaurando}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                  style={{ background: modo === "substituir" ? C.red : C.navy, color: "white" }}>
                  {restaurando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {restaurando ? "Restaurando..." : modo === "substituir" ? "Substituir tudo" : "Mesclar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
