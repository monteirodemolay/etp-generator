/**
 * O documento contínuo dos incisos: os treze numa página só, no formato do
 * documento final, com a barra de formatação fixa agindo sobre o inciso em
 * foco.
 */

import React, { useState, useEffect } from "react";
import { FileText, X, Copy } from "lucide-react";
import { C } from "../tokens.js";
import { BarraFormatacao, CampoFormatado } from "../comuns/index.jsx";
import { SECOES, ehObrigatorio } from "../../conteudo/incisos.js";
import { MODELOS_PADRAO, gerarModelo, temModelo } from "../../conteudo/modelos-padrao.js";
import { gerarPromptIA, gerarPromptGeralIA } from "../../conteudo/prompts.js";
import { numeracaoFinal } from "../../dominio/numeracao.js";
import { textoParaHtml } from "../../dominio/texto.js";
import { cruzarComPca } from "../../dominio/pca.js";
import { gerarRelatorioEstimativaHtml } from "../../dominio/estimativa.js";
import { listaResponsaveis, linhaAssinaturaData } from "../../dominio/etp.js";
import { resolverCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { SolucoesMercadoManager } from "./formularios.jsx";


// ---------- Documento contínuo dos incisos ----------
// Todos os 13 incisos numa página só, no formato do documento final. A barra de formatação
// fica fixa no topo e age sobre o inciso em foco, como no Word.
export function DocumentoIncisos({ etp, onSection, onSolucoesMercado, onExcluidos, secretarias }) {
  const [focado, setFocado] = useState(null);
  const [promptAberto, setPromptAberto] = useState(null); // { id, texto }
  const [copiado, setCopiado] = useState(false);
  const [timbreGlobal, setTimbreGlobal] = useState(TIMBRE_PADRAO);

  useEffect(() => {
    window.storage.get("timbre:padrao", false)
      .then(r => setTimbreGlobal(r?.value || TIMBRE_PADRAO))
      .catch(() => {});
  }, []);

  const excluidos = etp.incisosExcluidos || [];
  const numeros = numeracaoFinal(etp);
  const cabecalho = resolverCabecalho(etp, secretarias, timbreGlobal);

  function alternarExclusao(id, obrigatorio) {
    if (!excluidos.includes(id) && obrigatorio) {
      const ok = window.confirm(
        `O inciso ${id} é de preenchimento obrigatório pelo art. 18, §2º, da Lei nº 14.133/2021.\n\n` +
        `Os demais podem ser dispensados justificadamente, mas este exige fundamentação específica.\n\n` +
        `Deseja mesmo deixá-lo fora deste ETP?`);
      if (!ok) return;
    }
    onExcluidos(excluidos.includes(id) ? excluidos.filter(x => x !== id) : [...excluidos, id]);
  }

  function usarModelo(id) {
    const gerar = MODELOS_PADRAO[id];
    if (gerar) onSection(id, textoParaHtml(gerar(etp)));
  }

  function abrirPrompt(id) {
    setPromptAberto({ id, texto: gerarPromptIA(etp, id) });
    setCopiado(false);
  }

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(promptAberto.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) { console.error(e); }
  }

  const secaoFocada = SECOES.find(s => s.id === focado);
  const totalNoDoc = Object.keys(numeros).length;

  return (
    <div>
      {/* Barra de formatação fixa */}
      <div className="sticky top-0 z-20 border-b" style={{ background: "white", borderColor: C.border }}>
        <BarraFormatacao
          rotuloAlvo={secaoFocada ? `Editando: ${numeros[secaoFocada.id] || secaoFocada.id} — ${secaoFocada.titulo}` : "Clique num inciso para editar"} />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-7">
        {/* Resumo do documento */}
        <div className="flex items-center gap-2 mb-5 p-3 rounded-lg text-xs flex-wrap"
          style={{ background: C.paperDark, color: C.inkMuted }}>
          <FileText size={14} style={{ color: C.brass }} />
          <span><b style={{ color: C.navy }}>{totalNoDoc}</b> de 13 incisos entrarão no documento</span>
          {excluidos.length > 0 && <span>· {excluidos.length} deixado(s) de fora</span>}
          <button onClick={() => { setPromptAberto({ id: "todos", texto: gerarPromptGeralIA(etp) }); setCopiado(false); }}
            className="ml-auto px-2.5 py-1 rounded-md text-[10.5px] font-semibold"
            style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}
            title="Monta um único texto pedindo os 13 incisos de uma vez">
            ⧉ Texto para IA externa · todos
          </button>
        </div>

        {/* Folha do documento */}
        <div className="rounded-xl border p-10 shadow-sm" style={{ background: "white", borderColor: C.border }}>
          {cabecalho.tipo === "imagem" && cabecalho.dataUrl && (
            <div className="pb-4 mb-6 border-b text-center" style={{ borderColor: C.border }}>
              <img src={cabecalho.dataUrl} alt="Timbre" style={{ maxHeight: "70px", maxWidth: "100%", margin: "0 auto" }} />
            </div>
          )}
          {cabecalho.tipo === "texto" && cabecalho.html && (
            <div className="pb-4 mb-6 border-b text-center rich-content text-xs" style={{ borderColor: C.border, color: C.ink }}
              dangerouslySetInnerHTML={{ __html: cabecalho.html }} />
          )}

          <h2 className="serif text-xl font-semibold text-center mb-1" style={{ color: C.navy }}>
            ESTUDO TÉCNICO PRELIMINAR
          </h2>
          <p className="text-xs text-center italic mb-7" style={{ color: C.inkMuted }}>
            Lei nº 14.133/2021 · art. 18
          </p>

          {SECOES.map(s => {
            const fora = excluidos.includes(s.id);
            const numero = numeros[s.id];
            const mudou = numero && numero !== s.id;
            const preenchido = !!etp.sections[s.id]?.trim();
            const emFoco = focado === s.id;

            if (fora) {
              return (
                <div key={s.id} className="flex items-center gap-2 my-1.5 px-3 py-2 rounded-lg text-xs"
                  style={{ background: C.paperDark, color: C.inkMuted }}>
                  <X size={12} className="shrink-0" style={{ color: C.red }} />
                  <span><b style={{ color: C.ink }}>{s.id} — {s.titulo}</b> · fora deste ETP</span>
                  <button onClick={() => alternarExclusao(s.id, s.obrig)}
                    className="ml-auto px-2.5 py-1 rounded-md text-[10px] font-semibold shrink-0"
                    style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}>
                    Incluir de volta
                  </button>
                </div>
              );
            }

            return (
              <section key={s.id} id={`inciso-${s.id}`} className="group py-3 rounded-lg"
                style={{
                  background: emFoco ? "rgba(166,131,46,0.035)" : "transparent",
                  boxShadow: emFoco ? "-14px 0 0 rgba(166,131,46,0.035), 14px 0 0 rgba(166,131,46,0.035)" : "none",
                  scrollMarginTop: "110px",
                }}
                onClick={() => setFocado(s.id)}>

                <div className="flex items-baseline gap-2 justify-center flex-wrap mb-1">
                  <h3 className="serif text-sm font-bold uppercase tracking-wide" style={{ color: C.navy }}>
                    {numero || s.id} — {s.titulo}
                  </h3>
                  {s.obrig && (
                    <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>Obrigatório</span>
                  )}
                  {mudou && (
                    <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(166,131,46,0.15)", color: C.brass }}>
                      era {s.id} · sairá como {numero}
                    </span>
                  )}
                  {!preenchido && (
                    <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                      style={{ background: C.paperDark, color: C.inkMuted }}>vazio · não sairá</span>
                  )}
                </div>
                <p className="text-[11px] text-center italic mb-2" style={{ color: C.inkMuted }}>{s.ajuda}</p>

                <div className="flex items-center gap-1.5 justify-center mb-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ opacity: emFoco ? 1 : undefined }}>
                  {MODELOS_PADRAO[s.id] && (() => {
                    const semPca = s.id === "II" && (!etp.pca || (etp.itens || []).length === 0);
                    return (
                      <button onClick={e => { e.stopPropagation(); if (!semPca) usarModelo(s.id); }}
                        disabled={semPca}
                        className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold disabled:opacity-40"
                        style={{ background: C.brass, color: C.navyDark }}
                        title={semPca
                          ? 'Importe a planilha do PCA na etapa "2. Alinhamento ao PCA" primeiro'
                          : "Preenche com o texto-modelo do app — grátis, sem IA"}>
                        ✎ Modelo padrão
                      </button>
                    );
                  })()}
                  <button onClick={e => { e.stopPropagation(); abrirPrompt(s.id); }}
                    className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold"
                    style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}
                    title="Abre o texto pronto para você revisar e levar a uma IA gratuita">
                    ⧉ Texto para IA externa
                  </button>
                  <button onClick={e => { e.stopPropagation(); alternarExclusao(s.id, s.obrig); }}
                    className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold"
                    style={{ background: "white", color: C.red, border: "1px solid rgba(166,64,61,0.3)" }}
                    title="Deixa este inciso fora do documento final">
                    × Não incluir
                  </button>
                </div>

                {/* O seletor de soluções de mercado acompanha o inciso V — art. 18,
                    § 1º, V trata do levantamento de mercado. */}
                {s.id === "V" && (
                  <div onClick={e => e.stopPropagation()}>
                    <SolucoesMercadoManager solucoes={etp.solucoesMercado || []} onChange={onSolucoesMercado} />
                  </div>
                )}

                <CampoFormatado
                  value={etp.sections[s.id] || ""}
                  onChange={v => onSection(s.id, v)}
                  onFocus={() => setFocado(s.id)}
                  placeholder="Clique para escrever, ou use o Modelo padrão acima…"
                />

                <QuadrosAutomaticos etp={etp} secaoId={s.id} />
              </section>
            );
          })}

          <div className="mt-9 pt-5 border-t text-center text-xs" style={{ borderColor: C.border, color: C.ink }}>
            <p>{linhaAssinaturaData(etp)}</p>
            {listaResponsaveis(etp).map(r => (
              <div key={r.id} className="mt-7">
                <p>_______________________________________</p>
                <p className="font-semibold mt-1">{r.nome}</p>
                {r.cargo && <p style={{ color: C.inkMuted }}>{r.cargo}</p>}
              </div>
            ))}
            {listaResponsaveis(etp).length === 0 && (
              <div className="mt-7" style={{ color: C.inkMuted }}>
                <p>_______________________________________</p>
                <p className="mt-1 italic">Cadastre o responsável em "Dados do Processo"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pop-up do prompt — editável antes de copiar */}
      {promptAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(18,32,50,0.6)" }} onClick={() => setPromptAberto(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl"
              style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-lg font-semibold" style={{ color: C.navy }}>
                  {promptAberto.id === "todos" ? "Texto para IA externa — todos os incisos" : `Texto para IA externa — inciso ${promptAberto.id}`}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  Revise ou ajuste abaixo, copie e cole numa IA gratuita (ChatGPT, Gemini etc.).
                  Depois traga a resposta para o campo do inciso.
                </p>
              </div>
              <button onClick={() => setPromptAberto(null)} className="shrink-0" style={{ color: C.inkMuted }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <textarea value={promptAberto.texto}
                onChange={e => setPromptAberto({ ...promptAberto, texto: e.target.value })}
                rows={16}
                className="w-full px-3 py-2.5 rounded-lg border text-xs font-mono leading-relaxed resize-y"
                style={{ borderColor: C.border, background: C.paperDark, color: C.ink }} />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button onClick={() => setPromptAberto(null)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                  Fechar
                </button>
                <button onClick={copiarPrompt}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: C.navy, color: C.paper }}>
                  <Copy size={14} /> {copiado ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quadros que o app monta sozinho e que aparecem dentro dos incisos II, V e VI
export function QuadrosAutomaticos({ etp, secaoId }) {
  const marca = (titulo, conteudo, obs) => (
    <div className="mt-3 mb-1 rounded-lg p-3"
      style={{ border: `1px dashed ${C.brassLight}`, background: "rgba(166,131,46,0.045)" }}>
      <p className="text-[9px] font-bold uppercase tracking-wide mb-2" style={{ color: C.brass }}>
        ▦ Gerado automaticamente · {titulo}
      </p>
      {conteudo}
      {obs && <p className="text-[9.5px] mt-1.5 italic" style={{ color: C.inkMuted }}>{obs}</p>}
    </div>
  );

  if (secaoId === "II" && etp.pca && etp.itens?.length > 0) {
    return marca("Alinhamento ao PCA", (
      <table className="w-full text-[10.5px] border-collapse">
        <thead>
          <tr style={{ background: C.paperDark }}>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Item</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Descrição</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Consta?</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Sequencial</th>
          </tr>
        </thead>
        <tbody>
          {cruzarComPca(etp.itens, etp.pca, etp.manuaisPca).slice(0, 4).map((m, i) => (
            <tr key={m.item.id}>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{i + 1}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{m.item.descricao || "-"}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{m.previsto ? "Sim" : "Não"}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{m.sequencial || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ), etp.itens.length > 4
      ? `Mostrando 4 de ${etp.itens.length} itens — o documento final traz todos.`
      : "Vem da etapa 2 — Alinhamento ao PCA.");
  }

  // O quadro de quantitativos acompanha o inciso IV — art. 18, § 1º, IV.
  if (secaoId === "IV" && etp.itens?.length > 0) {
    return marca("Quadro de quantitativos", (
      <table className="w-full text-[10.5px] border-collapse">
        <thead>
          <tr style={{ background: C.paperDark }}>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Item</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Descrição</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Und.</th>
            <th className="text-left px-2 py-1 border" style={{ borderColor: C.border }}>Qtd.</th>
          </tr>
        </thead>
        <tbody>
          {etp.itens.slice(0, 4).map((it, i) => (
            <tr key={it.id}>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{i + 1}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{it.descricao || "-"}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{it.unidade || ""}</td>
              <td className="px-2 py-1 border" style={{ borderColor: C.border }}>{it.quantidade || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ), etp.itens.length > 4
      ? `Mostrando 4 de ${etp.itens.length} itens — o documento final traz todos.`
      : "Vem da etapa 1 — Planilha de Itens.");
  }

  if (secaoId === "VI") {
    const html = gerarRelatorioEstimativaHtml(etp);
    if (!html) return null;
    return marca("Comprobatório da estimativa de valor", (
      <div className="text-[10.5px] rich-content" style={{ color: C.ink }}
        dangerouslySetInnerHTML={{ __html: html }} />
    ), "Vem da etapa 4 — Levantamento de Preços.");
  }

  return null;
}
