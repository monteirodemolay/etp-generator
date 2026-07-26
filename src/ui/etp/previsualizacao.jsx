/**
 * Pré-visualização do ETP no formato do documento final, com timbre e
 * gerenciamento do timbre geral do aplicativo.
 */

import storage from "../../storage.js";

import { statsFor } from "../../dominio/valores.js";

import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Printer, Copy, Download, Upload, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { C } from "../tokens.js";
import { secoesParaRelatorio } from "../../dominio/numeracao.js";
import { cruzarComPca } from "../../dominio/pca.js";
import { gerarRelatorioEstimativaHtml } from "../../dominio/estimativa.js";
import { listaResponsaveis, objetoCompleto, linhaAssinaturaData } from "../../dominio/etp.js";
import { brl, num } from "../../dominio/valores.js";
import { fmtDate, fmtDateISO } from "../../dominio/datas.js";
import { gerarDocumentoWord } from "../../docx/documentos.js";
import { resolverCabecalho, redimensionarImagem } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { secretariaDoDoc } from "../../dominio/entidades.js";


// ---------- Preview View ----------
export function PreviewView({ etp, secretarias, onBack }) {
  const [copied, setCopied] = useState(false);
  const [timbreGlobal, setTimbre] = useState(TIMBRE_PADRAO);
  const [timbreLoading, setTimbreLoading] = useState(true);
  const [timbreError, setTimbreError] = useState("");
  const timbreFileRef = useRef(null);
  // O timbre da secretaria do ETP tem prioridade; o gerenciado nesta tela é o timbre geral
  const secretariaDoEtp = secretariaDoDoc(etp, secretarias);
  const cabecalho = resolverCabecalho(etp, secretarias, timbreGlobal);
  const timbre = cabecalho.tipo === "imagem" ? cabecalho.dataUrl : null;

  useEffect(() => {
    storage.get("timbre:padrao", false)
      .then(r => setTimbre(r?.value || TIMBRE_PADRAO))
      .catch(() => {
        // Nenhum timbre salvo ainda — usa o padrão extraído do modelo enviado e já o grava para as próximas vezes
        setTimbre(TIMBRE_PADRAO);
        storage.set("timbre:padrao", TIMBRE_PADRAO, false).catch(() => {});
      })
      .finally(() => setTimbreLoading(false));
  }, []);

  async function handleTimbreUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTimbreLoading(true);
    setTimbreError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const resized = await redimensionarImagem(dataUrl, 900);
      await storage.set("timbre:padrao", resized, false);
      setTimbre(resized);
    } catch (err) {
      console.error(err);
      setTimbreError("Não foi possível salvar o timbre.");
    }
    setTimbreLoading(false);
    e.target.value = "";
  }

  async function handleTimbreRemove() {
    try {
      await storage.delete("timbre:padrao", false);
    } catch (err) { /* já não existe */ }
    setTimbre(null);
  }

  function fullText() {
    let t = `ESTUDO TÉCNICO PRELIMINAR (ETP)\n`;
    t += `Fundamento: art. 18 da Lei nº 14.133/2021\n\n`;
    t += `Objeto: ${objetoCompleto(etp) || "-"}\n`;
    t += `Órgão/Secretaria: ${etp.meta.orgao || "-"}\n`;
    t += `Setor requisitante: ${etp.meta.setor || "-"}\n`;
    const responsaveis = listaResponsaveis(etp);
    t += `Responsável técnico: ${responsaveis.length > 0 ? responsaveis.map(r => r.nome + (r.cargo ? ` (${r.cargo})` : "")).join("; ") : "-"}\n`;
    t += `Processo nº: ${etp.meta.processo || "-"}\n`;
    t += `Tipo de objeto: ${etp.meta.tipo}\n\n`;
    if (etp.meta.introducao?.trim()) t += `INTRODUÇÃO\n${etp.meta.introducao.trim()}\n\n`;
    secoesParaRelatorio(etp).forEach(s => {
      const conteudo = (etp.sections[s.id] || "").replace(/<li[^>]*>/g, "\n• ").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim();
      t += `${s.numero} — ${s.titulo.toUpperCase()}\n${conteudo}\n`;
      if (s.id === "II" && etp.pca && etp.itens?.length > 0) {
        t += `\nQuadro de alinhamento ao PCA:\n`;
        etp.itens.forEach(it => {
          const m = cruzarComPca([it], etp.pca, etp.manuaisPca)[0];
          t += `• ${it.descricao || "-"} — ${m.previsto ? `consta (seq. ${m.sequencial || "-"})` : "não consta"}\n`;
        });
      }
      // Quadro de quantitativos — art. 18, § 1º, IV.
      if (s.id === "IV" && etp.itens?.length > 0) {
        t += `\nQuadro de quantitativos:\n`;
        etp.itens.forEach(it => {
          t += `• ${it.descricao || "-"} — ${it.unidade || ""} — qtd. ${it.quantidade || "-"}\n`;
        });
      }
      if (s.id === "VI") {
        const valoresAdotados = etp.valoresAdotados || {};
        const cotacoes = etp.cotacoes || {};
        const temAlgumDado = etp.itens.some(it => (cotacoes[it.id] || []).length > 0 || valoresAdotados[it.id]);
        if (temAlgumDado) {
          const usaMedia = etp.meta.metodologiaCalculo === "media";
          const metodologia = usaMedia ? "média aritmética simples" : "mediana";
          const labelReferencia = usaMedia ? "Média" : "Mediana";
          t += `\nQuadro comprobatório da estimativa de valor (metodologia adotada: ${metodologia}):\n`;
          let totalGeral = 0;
          etp.itens.forEach(it => {
            const quotes = cotacoes[it.id] || [];
            const stats = statsFor(quotes);
            const valorReferencia = usaMedia ? stats.media : stats.mediana;
            const totalItem = stats.n > 0 ? num(it.quantidade) * valorReferencia : 0;
            if (stats.n > 0) totalGeral += totalItem;
            t += `\n${it.descricao || "-"} (qtd. ${it.quantidade || "-"} ${it.unidade || ""})\n`;
            if (quotes.length > 0) {
              quotes.forEach(q => {
                t += `  • ${q.fonte || "-"}${q.empresa ? ` (${q.empresa})` : ""}: ${brl(num(q.valor))}\n`;
              });
              t += `  ${labelReferencia}: ${brl(valorReferencia)} · Total do item: ${brl(totalItem)}\n`;
            }
          });
          t += `\nValor total estimado da contratação: ${brl(totalGeral)}\n`;
        }
      }
      t += `\n`;
    });
    t += `${linhaAssinaturaData(etp)}\n`;
    const responsaveisAssinatura = listaResponsaveis(etp);
    if (responsaveisAssinatura.length > 0) {
      responsaveisAssinatura.forEach(r => {
        t += `\n_______________________________________\n${r.nome}\n${r.cargo || ""}\n`;
      });
    }
    return t;
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(fullText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { console.error(e); }
  }

  return (
    <div>
      <header className="no-print flex items-center justify-between px-6 py-3 border-b sticky top-0 z-10"
        style={{ background: C.navy, borderColor: C.navyDark }}>
        <button onClick={onBack} className="flex items-center gap-2 text-sm p-1.5 rounded-md hover:bg-white/10" style={{ color: C.paper }}>
          <ArrowLeft size={18} /> Voltar à edição
        </button>
        <div className="flex items-center gap-2">
          <button onClick={copyText} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.paperDark, color: C.navy }}>
            <Copy size={13} /> {copied ? "Copiado!" : "Copiar texto"}
          </button>
          <button onClick={() => gerarDocumentoWord(etp, cabecalho).catch(e => console.error(e))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.paperDark, color: C.navy }}>
            <Download size={13} /> Baixar Word (.doc)
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: C.brass, color: C.navyDark }}>
            <Printer size={13} /> Imprimir / Salvar PDF
          </button>
        </div>
      </header>

      <div className="no-print max-w-3xl mx-auto pt-6 px-4">
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg" style={{ background: "white", border: `1px solid ${C.border}` }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Timbre da Secretaria:</span>
          {timbreLoading ? (
            <span className="text-xs" style={{ color: C.inkMuted }}>Carregando...</span>
          ) : timbre ? (
            <>
              <img src={timbre} alt="Timbre" style={{ maxHeight: "36px" }} />
              <button onClick={() => timbreFileRef.current?.click()}
                className="text-xs font-medium" style={{ color: C.navy }}>Trocar</button>
              <button onClick={handleTimbreRemove}
                className="text-xs font-medium" style={{ color: C.red }}>Remover</button>
            </>
          ) : (
            <button onClick={() => timbreFileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
              style={{ background: C.navy, color: C.paper }}>
              <Upload size={13} /> Enviar timbre (imagem)
            </button>
          )}
          <input ref={timbreFileRef} type="file" accept="image/*" onChange={handleTimbreUpload} className="hidden" />
          {timbreError && <span className="text-xs" style={{ color: C.red }}>{timbreError}</span>}
          <span className="text-xs w-full" style={{ color: C.inkMuted }}>
            Enviado uma vez, fica salvo e aparece automaticamente em todos os seus ETPs — na pré-visualização, no
            PDF impresso e no arquivo Word exportado.
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-6 px-4">
        <div className="print-area bg-white shadow-sm rounded-lg p-10" style={{ border: `1px solid ${C.border}` }}>
          {timbre && (
            <div className="timbre-fixed-print">
              <img src={timbre} alt="Timbre da Secretaria" style={{ maxHeight: "90px", maxWidth: "90%" }} />
            </div>
          )}
          {timbre && (
            <div className="mb-6 flex justify-center timbre-inline-print">
              <img src={timbre} alt="Timbre da Secretaria" style={{ maxHeight: "110px", maxWidth: "100%" }} />
            </div>
          )}
          <div className="text-center mb-8 pb-6 border-b" style={{ borderColor: C.border }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.brass }}>Lei nº 14.133/2021 · art. 18</p>
            <h1 className="serif text-2xl font-bold" style={{ color: C.navy }}>Estudo Técnico Preliminar</h1>
            <p className="serif text-lg mt-1" style={{ color: C.ink }}>{objetoCompleto(etp) || "(objeto não informado)"}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-8">
            <p><b style={{ color: C.inkMuted }}>Órgão:</b> {etp.meta.orgao || "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Setor:</b> {etp.meta.setor || "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Responsável:</b> {listaResponsaveis(etp).length > 0 ? listaResponsaveis(etp).map(r => r.nome + (r.cargo ? ` — ${r.cargo}` : "")).join("; ") : "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Processo:</b> {etp.meta.processo || "-"}</p>
            <p><b style={{ color: C.inkMuted }}>Tipo:</b> {etp.meta.tipo}</p>
            <p><b style={{ color: C.inkMuted }}>Data:</b> {fmtDateISO(etp.meta.data) || fmtDate(etp.updatedAt)}</p>
          </div>

          {etp.meta.introducao?.trim() && (
            <div className="mb-6">
              <h3 className="serif text-base font-bold mb-1.5 text-center" style={{ color: C.navy }}>Introdução</h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-justify">{etp.meta.introducao}</p>
            </div>
          )}

          {secoesParaRelatorio(etp).map(s => (
            <div key={s.id} className="mb-6">
              <h3 className="serif text-base font-bold mb-1.5 text-center titulo-inciso" style={{ color: C.navy }}>
                {s.numero} — {s.titulo}
              </h3>
              <div className="text-sm leading-relaxed rich-content text-justify" style={{ color: C.ink }}
                dangerouslySetInnerHTML={{ __html: etp.sections[s.id] }} />
              {s.id === "II" && etp.pca && etp.itens?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.inkMuted }}>
                    Quadro de alinhamento ao PCA
                  </p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: C.paperDark }}>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Item</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Descrição</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Consta no PCA?</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Sequencial</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cruzarComPca(etp.itens, etp.pca, etp.manuaisPca).map((m, idx) => (
                        <tr key={m.item.id}>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{idx + 1}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{m.item.descricao || `Item ${idx + 1}`}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border, color: m.previsto ? C.green : C.red }}>{m.previsto ? "Sim" : "Não"}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{m.sequencial || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] mt-1" style={{ color: C.inkMuted }}>
                    Fonte: planilha "{etp.pca.nomeArquivo}", importada em {fmtDate(etp.pca.importedAt)}.
                  </p>
                </div>
              )}
              {/* Quadro de quantitativos — art. 18, § 1º, IV */}
              {s.id === "IV" && etp.itens?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.inkMuted }}>
                    Quadro de quantitativos
                  </p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: C.paperDark }}>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Item</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Descrição</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Und.</th>
                        <th className="text-left px-2 py-1.5 border" style={{ borderColor: C.border }}>Qtd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etp.itens.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{idx + 1}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{it.descricao || "-"}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{it.unidade}</td>
                          <td className="px-2 py-1.5 border" style={{ borderColor: C.border }}>{it.quantidade || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {s.id === "VI" && gerarRelatorioEstimativaHtml(etp) && (
                <div className="mt-3 rich-content text-sm" style={{ color: C.ink }}
                  dangerouslySetInnerHTML={{ __html: gerarRelatorioEstimativaHtml(etp) }} />
              )}
            </div>
          ))}

          <div className="mt-12 text-sm text-center" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            <p>{linhaAssinaturaData(etp)}</p>
            {listaResponsaveis(etp).length > 0 ? (
              listaResponsaveis(etp).map(r => (
                <div key={r.id} className="mt-10">
                  <p>_______________________________________</p>
                  <p className="mt-1 font-semibold">{r.nome}</p>
                  {r.cargo && <p>{r.cargo}</p>}
                </div>
              ))
            ) : (
              <div className="mt-10">
                <p>_______________________________________</p>
                <p className="mt-1 font-semibold">[Responsável técnico]</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
