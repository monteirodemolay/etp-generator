/**
 * Declaração de previsão no PCA — documento independente que demonstra o
 * alinhamento dos itens ao Plano de Contratações Anual.
 */

import { mesmoCodigo } from "../../dominio/pca.js";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Upload, Download, Trash2, FileText, Check, AlertCircle,
         Info, Loader2, ListChecks, ListX, X, Lock, Plus } from "lucide-react";
import { C } from "../tokens.js";
import { VinculoPca } from "../etp/formularios.jsx";
import { cruzarComPca, buscarNoPca } from "../../dominio/pca.js";
import * as XLSX from "xlsx";
import { parseCentiSheet, parsePCASheet, baixarModeloPlanilha,
         baixarPlanilhaInclusaoCenti } from "../../dominio/planilhas.js";
import { fmtDate } from "../../dominio/datas.js";
import { escapeHtml } from "../../dominio/texto.js";
import { gerarDocumentoPCAAvulso } from "../../docx/documentos.js";
import { resolverCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { chavePcaEntidade } from "../../dominio/entidades.js";
import storage from "../../storage.js";
import { lerPdfComPosicoes } from "../../pdf-posicoes-servico.js";
import { detectarFormatoPdfPca, extrairItensDfd, extrairItensPedido, combinarItensDeMultiplosArquivos } from "../../dominio/pdf-pca.js";

// ---------- Ferramenta avulsa: Verificar Itens no PCA ----------
// Independente de qualquer ETP — fica salva neste navegador para reutilização.
export function DeclaracaoView({ doc, secretarias, onSalvar, onBack, onGerarJustificativa, somenteLeitura = false, embutido = false }) {
  const itens = doc.itens || [];
  const objeto = doc.objeto || "";
  const orgao = doc.orgao || "";
  const manuais = doc.manuais || {};

  // A planilha do PCA é uma tabela de referência compartilhada entre todas as declarações —
  // fica numa chave própria para não duplicar milhares de linhas em cada documento.
  const [pca, setPca] = useState(null);
  const [timbreGlobal, setTimbreGlobal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFaltantes, setShowFaltantes] = useState(false);
  const cabecalho = resolverCabecalho(doc, secretarias, timbreGlobal);
  const timbre = cabecalho.tipo === "imagem" ? cabecalho.dataUrl : null;

  const fileItensRef = useRef(null);
  const filePcaRef = useRef(null);
  const [importingItens, setImportingItens] = useState(false);
  const filePdfRef = useRef(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");
  const [revisandoPdf, setRevisandoPdf] = useState(null); // array de itens extraídos, aguardando confirmação
  const [adicionandoManual, setAdicionandoManual] = useState(false);
  const [buscaManual, setBuscaManual] = useState("");
  const [novoItemManual, setNovoItemManual] = useState(null); // {idProduto, descricao, unidade, quantidade} depois de escolher/digitar
  const [importingPca, setImportingPca] = useState(false);
  const [errorItens, setErrorItens] = useState("");
  const [errorPca, setErrorPca] = useState("");

  useEffect(() => {
    Promise.all([
      storage.get("pca:planilha", false).catch(() => null),
      storage.get("timbre:padrao", false).then(r => r?.value || null).catch(() => null),
    ]).then(([pcaRes, timbre]) => {
      if (pcaRes?.value) setPca(JSON.parse(pcaRes.value));
      if (timbre) setTimbreGlobal(timbre);
    }).finally(() => setLoading(false));
  }, []);

  function atualizarItens(v) { onSalvar({ ...doc, itens: v }); }
  function atualizarObjeto(v) { onSalvar({ ...doc, objeto: v }); }
  function atualizarOrgao(v) { onSalvar({ ...doc, orgao: v }); }
  function atualizarPca(v) {
    setPca(v);
    storage.set("pca:planilha", JSON.stringify(v), false).catch(() => {});
  }
  function atualizarManual(itemId, campo, valor) {
    const atual = manuais[itemId] || { codigo: "", sequencial: "" };
    onSalvar({ ...doc, manuais: { ...manuais, [itemId]: { ...atual, [campo]: valor } } });
  }

  async function handleImportItens(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingItens(true);
    setErrorItens("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const result = parseCentiSheet(rows);
      if (result.itens.length === 0) throw new Error("Nenhum item encontrado nesta planilha.");
      atualizarItens(result.itens);
    } catch (err) {
      console.error(err);
      setErrorItens(err.message || "Não foi possível importar esta planilha.");
    }
    setImportingItens(false);
    e.target.value = "";
  }

  async function handleImportPdfs(e) {
    const arquivos = Array.from(e.target.files || []);
    if (arquivos.length === 0) return;
    setImportingPdf(true);
    setErrorPdf("");
    try {
      const resultadosPorArquivo = [];
      for (const arquivo of arquivos) {
        const { paginas, textoCompleto } = await lerPdfComPosicoes(arquivo);
        const formato = detectarFormatoPdfPca(textoCompleto);
        let itensDoArquivo = [];
        if (formato === "dfd") itensDoArquivo = extrairItensDfd(paginas);
        else if (formato === "pedido") itensDoArquivo = extrairItensPedido(paginas);
        else {
          setErrorPdf(prev => (prev ? prev + " " : "") + `"${arquivo.name}" não parece ser um Pedido nem um DFD — ignorado.`);
          continue;
        }
        resultadosPorArquivo.push({ nomeArquivo: arquivo.name, itens: itensDoArquivo });
      }
      const combinados = combinarItensDeMultiplosArquivos(resultadosPorArquivo);
      if (combinados.length === 0) {
        setErrorPdf(prev => prev || "Nenhum item foi encontrado nos arquivos selecionados.");
      } else {
        setRevisandoPdf(combinados);
      }
    } catch (err) {
      console.error(err);
      setErrorPdf("Não foi possível ler um dos PDFs: " + (err.message || err));
    }
    setImportingPdf(false);
    e.target.value = "";
  }

  function confirmarItensRevisados() {
    atualizarItens(revisandoPdf.map(it => ({
      id: "it_" + Math.random().toString(36).slice(2, 8),
      idProduto: it.idProduto, descricao: it.descricao, unidade: it.unidade || "UNIDADE",
      quantidade: it.quantidade, classificacao: "",
    })));
    setRevisandoPdf(null);
  }

  function atualizarItemRevisado(idx, campo, valor) {
    setRevisandoPdf(prev => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function removerItemRevisado(idx) {
    setRevisandoPdf(prev => prev.filter((_, i) => i !== idx));
  }

  const resultadosBuscaManual = pca ? buscarNoPca(pca, buscaManual, 8) : [];

  function selecionarResultadoBusca(linhaPca) {
    setNovoItemManual({
      idProduto: linhaPca.codigo || linhaPca.sequencial || "",
      descricao: linhaPca.produto || "",
      unidade: "UNIDADE",
      quantidade: linhaPca.quantidade || "",
    });
  }

  function atualizarNovoItemManual(campo, valor) {
    setNovoItemManual(prev => ({
      idProduto: prev?.idProduto ?? "", descricao: prev?.descricao ?? (pca ? "" : buscaManual),
      unidade: prev?.unidade ?? "UNIDADE", quantidade: prev?.quantidade ?? "",
      [campo]: valor,
    }));
  }

  function cancelarItemManual() {
    setAdicionandoManual(false);
    setBuscaManual("");
    setNovoItemManual(null);
  }

  function confirmarItemManual() {
    const descricao = (novoItemManual?.descricao ?? (pca ? "" : buscaManual)).trim();
    if (!descricao) return;
    atualizarItens([...itens, {
      id: "it_" + Math.random().toString(36).slice(2, 8),
      idProduto: (novoItemManual?.idProduto || "").trim(),
      descricao,
      unidade: (novoItemManual?.unidade || "UNIDADE").trim(),
      quantidade: (novoItemManual?.quantidade || "").trim(),
      classificacao: "",
    }]);
    cancelarItemManual();
  }

  async function handleImportPca(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingPca(true);
    setErrorPca("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const linhas = parsePCASheet(rows);
      atualizarPca({ nomeArquivo: file.name, importedAt: Date.now(), linhas });
    } catch (err) {
      console.error(err);
      setErrorPca(err.message || "Não foi possível importar esta planilha.");
    }
    setImportingPca(false);
    e.target.value = "";
  }

  const matches = cruzarComPca(itens, pca, manuais);
  const encontrados = matches.filter(m => m.previsto).length;
  const semPcaMatch = matches.filter(m => !m.pcaRow); // sem correspondência automática
  // Itens ainda pendentes que já têm uma sugestão por descrição — dá pra confirmar todos de uma vez
  const sugestoesPendentes = semPcaMatch.filter(m => m.sugestaoDescricao);
  function confirmarTodasSugestoes() {
    const novosManuais = { ...manuais };
    sugestoesPendentes.forEach(m => {
      novosManuais[m.item.id] = { codigoPca: m.sugestaoDescricao.codigo, sequencial: m.sugestaoDescricao.sequencial || "" };
    });
    onSalvar({ ...doc, manuais: novosManuais });
  }
  const itensFaltantes = matches.filter(m => !m.previsto).map(m => m.item); // ainda sem sequencial nenhum
  const totalmenteAlinhado = itens.length > 0 && pca && encontrados === itens.length;

  function baixarDocumento() {
    const linhasTabela = matches.filter(m => m.previsto).map((m, idx) => {
      // Quando o código do Pedido (Centi) é diferente do código sob o qual o item está
      // cadastrado no PCA, mostra os dois juntos — "5241938422 / 14157343" (o segundo, do
      // PCA, em negrito) — para comprovar que é o mesmo item, só sob outra numeração.
      const centi = (m.item.idProduto || "").trim();
      const pcaCodigo = (m.pcaRow?.codigo || "").trim();
      const idCelula = (centi && pcaCodigo && !mesmoCodigo(centi, pcaCodigo))
        ? `${escapeHtml(centi)} / <b>${escapeHtml(pcaCodigo)}</b>`
        : escapeHtml(m.codigo || "-");
      return `<tr><td>${idx + 1}</td><td>${idCelula}</td><td>${escapeHtml(m.item.descricao || "-")}</td><td>${escapeHtml(m.sequencial || "-")}</td></tr>`;
    }).join("");
    gerarDocumentoPCAAvulso({ objeto, orgao, cabecalho, linhasTabela }).catch(e => console.error(e));
  }

  function irParaJustificativa() {
    onGerarJustificativa({ objeto, orgao });
  }

  return (
    <div className={embutido ? "max-w-4xl mx-auto" : "max-w-4xl mx-auto px-6 py-10"}>
      {!embutido && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6" style={{ color: C.navy }}>
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
          <ListChecks size={16} />
          <span className="text-xs font-semibold tracking-widest uppercase">Declaração de previsão no PCA</span>
        </div>
        <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>
          {objeto.trim() || "Nova declaração"}
        </h1>
      </div>

      {somenteLeitura && (
        <p className="flex items-center gap-2 text-xs font-medium px-3 py-2.5 rounded-lg mb-5"
          style={{ background: "rgba(166,131,46,0.1)", color: C.ink }}>
          <Info size={13} style={{ color: C.brass }} /> Modo somente leitura — as alterações feitas aqui não serão salvas.
        </p>
      )}

      <div style={somenteLeitura ? { pointerEvents: "none", opacity: 0.75 } : undefined}>
        <div>
          {loading ? (
            <p className="text-sm" style={{ color: C.inkMuted }}>Carregando...</p>
          ) : (
            <>
              <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
                Confere se uma lista de itens já consta no Plano de Contratações Anual e gera o documento pronto
                para anexar ao processo. Cada declaração é salva separadamente — você pode ter várias, uma por
                contratação.
              </p>

              <div className="mb-5 p-4 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="text-sm font-semibold" style={{ color: C.navy }}>1. Planilha de Itens</span>
                  <span className="text-xs" style={{ color: C.inkMuted }}>{itens.length} item(ns)</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input ref={fileItensRef} type="file" accept=".xlsx,.xls" onChange={handleImportItens} className="hidden" />
                  <button onClick={() => fileItensRef.current?.click()} disabled={importingItens}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
                    style={{ background: C.navy, color: C.paper }}>
                    {importingItens ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {importingItens ? "Importando..." : "Importar do Sistema Centi"}
                  </button>
                  <input ref={filePdfRef} type="file" accept=".pdf" multiple onChange={handleImportPdfs} className="hidden" />
                  <button onClick={() => filePdfRef.current?.click()} disabled={importingPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
                    style={{ background: C.brass, color: C.navyDark }}>
                    {importingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    {importingPdf ? "Lendo PDFs..." : "Importar de PDF (Pedido ou DFD)"}
                  </button>
                  <button onClick={baixarModeloPlanilha}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                    style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}>
                    <FileText size={13} /> Baixar modelo em branco
                  </button>
                  {itens.length > 0 && (
                    <button onClick={() => atualizarItens([])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ color: C.red }}>
                      <Trash2 size={13} /> Limpar lista
                    </button>
                  )}
                </div>
                <p className="text-[11px] mt-2" style={{ color: C.inkMuted }}>
                  Pode selecionar vários PDFs de uma vez (de Pedidos diferentes) — os itens de todos são juntados
                  numa lista só, ordenada por código do produto, com uma revisão antes de confirmar.
                </p>
                {errorItens && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {errorItens}</p>}
                {errorPdf && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {errorPdf}</p>}

                <div className="mt-4 pt-4 border-t" style={{ borderColor: C.border }}>
                  {!adicionandoManual ? (
                    <button onClick={() => setAdicionandoManual(true)}
                      className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.brass }}>
                      <Plus size={13} /> Adicionar um item manualmente
                    </button>
                  ) : (
                    <div className="relative">
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkMuted }}>
                        Adicionar item manualmente
                      </p>
                      <label className="block mb-2">
                        <span className="text-[11px]" style={{ color: C.inkMuted }}>
                          Busque pelo código ou nome do produto {pca ? "no PCA já importado" : "(importe a planilha do PCA abaixo pra poder buscar)"}
                        </span>
                        <input value={buscaManual} onChange={e => { setBuscaManual(e.target.value); setNovoItemManual(null); }}
                          placeholder="Ex.: 5241938182 ou CADEIRA DE RODAS" disabled={!pca}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-sm disabled:opacity-50" style={{ borderColor: C.border }} />
                      </label>

                      {pca && buscaManual.trim().length >= 2 && !novoItemManual && (
                        resultadosBuscaManual.length > 0 ? (
                          <div className="mb-3 rounded-lg border divide-y max-h-48 overflow-y-auto etp-scroll" style={{ borderColor: C.border }}>
                            {resultadosBuscaManual.map((l, i) => (
                              <button key={i} onClick={() => selecionarResultadoBusca(l)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-black/[0.03]">
                                <span className="font-mono" style={{ color: C.brass }}>{l.codigo || l.sequencial}</span>
                                <span style={{ color: C.ink }}> — {l.produto}</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mb-3 rounded-lg border p-3 text-xs" style={{ borderColor: C.border, background: "#fff3cd", color: "#664d03" }}>
                            Não encontrado no PCA. Pode incluir mesmo assim, com o descritivo abaixo — serve de base
                            pra pedir a inclusão do item faltante.
                          </div>
                        )
                      )}

                      {(novoItemManual || (pca && buscaManual.trim().length >= 2 && resultadosBuscaManual.length === 0) || !pca) && (
                        <div className="grid sm:grid-cols-12 gap-2 mb-3">
                          <input value={novoItemManual?.idProduto ?? ""} onChange={e => atualizarNovoItemManual("idProduto", e.target.value)}
                            placeholder="Código (opcional)" className="sm:col-span-3 px-2.5 py-1.5 rounded-lg border text-xs font-mono" style={{ borderColor: C.border }} />
                          <input value={novoItemManual?.descricao ?? (pca ? "" : buscaManual)} onChange={e => atualizarNovoItemManual("descricao", e.target.value)}
                            placeholder="Descrição do produto" className="sm:col-span-6 px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border }} />
                          <input value={novoItemManual?.unidade ?? "UNIDADE"} onChange={e => atualizarNovoItemManual("unidade", e.target.value)}
                            placeholder="Unidade" className="sm:col-span-1 px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border }} />
                          <input value={novoItemManual?.quantidade ?? ""} onChange={e => atualizarNovoItemManual("quantidade", e.target.value)}
                            placeholder="Qtd." className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border }} />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={cancelarItemManual}
                          className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                          Cancelar
                        </button>
                        <button onClick={confirmarItemManual}
                          className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: C.navy, color: C.paper }}>
                          Adicionar à lista
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-5 p-4 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="text-sm font-semibold" style={{ color: C.navy }}>2. Planilha do PCA</span>
                  {pca && <span className="text-xs" style={{ color: C.inkMuted }}>{pca.nomeArquivo} · {pca.linhas.length} itens no painel · importada em {fmtDate(pca.importedAt)}</span>}
                </div>
                <input ref={filePcaRef} type="file" accept=".xlsx,.xls" onChange={handleImportPca} className="hidden" />
                <button onClick={() => filePcaRef.current?.click()} disabled={importingPca}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
                  style={{ background: C.navy, color: C.paper }}>
                  {importingPca ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {importingPca ? "Importando..." : pca ? "Atualizar planilha do PCA" : "Importar planilha do PCA"}
                </button>
                {errorPca && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {errorPca}</p>}
              </div>

              {itens.length > 0 && pca && (
                <div className="mb-5">
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: C.paperDark }}>
                          <th className="text-left px-3 py-2 text-xs font-semibold uppercase w-10" style={{ color: C.inkMuted }}>#</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
                          <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Consta no PCA?</th>
                          <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-24" style={{ color: C.inkMuted }}>Sequencial (PCA)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((m, idx) => (
                          <tr key={m.item.id} className="border-t align-top" style={{ borderColor: C.border }}>
                            <td className="px-3 py-2 text-xs" style={{ color: C.inkMuted }}>{idx + 1}</td>
                            <td className="px-3 py-2">{m.item.descricao || `Item ${idx + 1}`}</td>
                            <td className="px-2 py-2">
                              {m.previsto ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(76,124,89,0.12)", color: C.green }}>
                                  <Check size={11} /> Sim
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
                                  <AlertCircle size={11} /> Não
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-xs" style={{ color: m.previsto ? C.ink : C.inkMuted }}>
                              {m.sequencial || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 p-3 rounded-lg flex items-center gap-2 text-xs flex-wrap" style={{ background: totalmenteAlinhado ? "rgba(76,124,89,0.1)" : "rgba(166,131,46,0.1)", color: C.ink }}>
                    {totalmenteAlinhado ? <Check size={14} style={{ color: C.green }} /> : <Info size={14} style={{ color: C.brass }} />}
                    <span><b>{encontrados}</b> de <b>{itens.length}</b> itens localizados no PCA (inclui os que você completou manualmente).</span>
                  </div>

                  {semPcaMatch.length > 0 && (
                    <button onClick={() => setShowFaltantes(true)}
                      className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium"
                      style={{ background: itensFaltantes.length > 0 ? "rgba(166,64,61,0.1)" : "rgba(166,131,46,0.12)", color: itensFaltantes.length > 0 ? C.red : C.brass }}>
                      <ListX size={13} /> Itens sem previsão no PCA ({semPcaMatch.length}
                      {itensFaltantes.length !== semPcaMatch.length ? ` · ${itensFaltantes.length} pendente(s)` : ""})
                    </button>
                  )}
                </div>
              )}

              <div className="mt-5 p-4 rounded-lg flex items-center justify-between gap-3 flex-wrap" style={{ background: "rgba(28,46,74,0.06)", border: `1px solid ${C.border}` }}>
                <span className="text-sm" style={{ color: C.ink }}>
                  Criar uma <b>Justificativa de Aquisição</b> a partir desta declaração — ela nasce como documento
                  próprio, já com o objeto e o órgão preenchidos.
                </span>
                <button onClick={irParaJustificativa}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold shrink-0"
                  style={{ background: C.navy, color: C.paper }}>
                  Criar Justificativa →
                </button>
              </div>

              <div className="p-4 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
                <span className="text-sm font-semibold block mb-3" style={{ color: C.navy }}>3. Documento de demonstração no PCA</span>
                <label className="block mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Objeto (descrição resumida da aquisição)</span>
                  <input value={objeto} onChange={e => atualizarObjeto(e.target.value)}
                    placeholder="Ex.: aquisição de materiais de copa e cozinha"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
                </label>
                <label className="block mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Órgão / Secretaria</span>
                  <input value={orgao} onChange={e => atualizarOrgao(e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
                </label>
                <button onClick={baixarDocumento} disabled={encontrados === 0 || !objeto.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: C.navy, color: C.paper }}>
                  <Download size={15} /> Baixar documento (Word)
                </button>
                {(encontrados === 0 || !objeto.trim()) && (
                  <p className="text-xs mt-2" style={{ color: C.inkMuted }}>
                    Importe os itens e o PCA (com ao menos um item localizado) e preencha o Objeto para gerar o documento.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showFaltantes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
          onClick={e => { e.stopPropagation(); setShowFaltantes(false); }}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl z-10" style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Itens sem previsão no PCA</h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  {itensFaltantes.length} de {semPcaMatch.length} ainda pendente(s)
                </p>
              </div>
              <button onClick={() => setShowFaltantes(false)} className="shrink-0" style={{ color: C.inkMuted }}><X size={20} /></button>
            </div>

            {sugestoesPendentes.length > 0 && (
              <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: C.border, background: "rgba(166,131,46,0.06)" }}>
                <span className="text-xs flex-1" style={{ color: C.ink }}>
                  {sugestoesPendentes.length} item(ns) com sugestão de correspondência por descrição, ainda não confirmada.
                </span>
                <button onClick={confirmarTodasSugestoes}
                  className="shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: C.brass, color: C.navyDark }}>
                  Confirmar todas ({sugestoesPendentes.length})
                </button>
              </div>
            )}

            <div className="p-5">
              <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
                Estes itens não foram localizados automaticamente na planilha do PCA importada. Se algum já
                estiver previsto no PCA sob outro código, use a busca para localizar a linha correta — o app
                puxa o produto e o sequencial automaticamente. Os que ficarem sem vínculo podem ser baixados
                numa planilha para inclusão no Sistema Centi.
              </p>
              {itensFaltantes.some(it => !it.idProduto) && (
                <div className="flex items-start gap-2 mb-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: "rgba(166,64,61,0.08)", color: C.ink }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" style={{ color: C.red }} />
                  <span>
                    Algum(ns) item(ns) está(ão) sem código/ID original (provavelmente adicionado manualmente, e não
                    pela importação do Sistema Centi).
                  </span>
                </div>
              )}

              <div className="space-y-3 mb-5">
                {semPcaMatch.map((m, idx) => {
                  const it = m.item;
                  const dados = manuais[it.id] || { codigo: "", codigoPca: "", sequencial: "" };
                  const resolvido = !!(dados.codigoPca?.trim() || dados.sequencial?.trim());
                  return (
                    <div key={it.id} className="p-4 rounded-lg border-2" style={{ borderColor: resolvido ? "rgba(76,124,89,0.4)" : C.border, background: resolvido ? "rgba(76,124,89,0.04)" : "white" }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-xs font-semibold" style={{ color: C.inkMuted }}>Item {itens.indexOf(it) + 1}</span>
                          <p className="text-sm font-medium" style={{ color: C.navy }}>{it.descricao || `Item ${idx + 1}`}</p>
                        </div>
                        {resolvido ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(76,124,89,0.15)", color: C.green }}>
                            <Check size={12} /> Previsto
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
                            <AlertCircle size={12} /> Pendente
                          </span>
                        )}
                      </div>
                      <VinculoPca item={it} pca={pca} dados={dados} sugestao={m.sugestaoDescricao}
                        onAlterar={novos => onSalvar({ ...doc, manuais: { ...manuais, [it.id]: novos } })} />
                    </div>
                  );
                })}
              </div>

              {itensFaltantes.length > 0 && (
                <button onClick={() => baixarPlanilhaInclusaoCenti(itensFaltantes)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: C.navy, color: C.paper }}>
                  <Download size={14} /> Baixar planilha para inclusão no Centi ({itensFaltantes.length} pendente(s))
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {revisandoPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.65)" }}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
              Revisar itens extraídos ({revisandoPdf.length})
            </h2>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>
              Confira código, descrição e quantidade antes de confirmar — a leitura de PDF é melhor esforço,
              e pode errar em casos raros. Pode editar qualquer campo aqui, ou remover um item indevido.
            </p>
            <div className="space-y-2 mb-4">
              {revisandoPdf.map((it, idx) => (
                <div key={idx} className="rounded-lg border p-3 grid sm:grid-cols-12 gap-2 items-start" style={{ borderColor: C.border }}>
                  <input value={it.idProduto} onChange={e => atualizarItemRevisado(idx, "idProduto", e.target.value)}
                    placeholder="Código" className="sm:col-span-2 px-2 py-1.5 rounded border text-xs font-mono" style={{ borderColor: C.border }} />
                  <textarea value={it.descricao} onChange={e => atualizarItemRevisado(idx, "descricao", e.target.value)}
                    rows={2} placeholder="Descrição" className="sm:col-span-6 px-2 py-1.5 rounded border text-xs" style={{ borderColor: C.border }} />
                  <input value={it.unidade} onChange={e => atualizarItemRevisado(idx, "unidade", e.target.value)}
                    placeholder="Unidade" className="sm:col-span-2 px-2 py-1.5 rounded border text-xs" style={{ borderColor: C.border }} />
                  <input value={it.quantidade} onChange={e => atualizarItemRevisado(idx, "quantidade", e.target.value)}
                    placeholder="Qtd." className="sm:col-span-1 px-2 py-1.5 rounded border text-xs" style={{ borderColor: C.border }} />
                  <button onClick={() => removerItemRevisado(idx)} title="Remover este item"
                    className="sm:col-span-1 flex justify-center py-1.5" style={{ color: C.red }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRevisandoPdf(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={confirmarItensRevisados} disabled={revisandoPdf.length === 0}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.navy, color: C.paper }}>
                Confirmar e usar estes {revisandoPdf.length} item(ns)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
