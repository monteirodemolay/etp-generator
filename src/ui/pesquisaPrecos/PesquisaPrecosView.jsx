/**
 * Pesquisa de Preços — tela única de criar/editar. Diferente do ETP (que é
 * um assistente em várias etapas), aqui cabe tudo numa tela só: dados do
 * processo, itens, cotações por item (por fonte, na ordem da IN 65/2021),
 * metodologia de cálculo, e exportação em Word.
 */

import React, { useState } from "react";
import {
  ArrowLeft, Plus, Trash2, Download, Upload, AlertCircle, Check, X, Info, ChevronDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { C } from "../tokens.js";
import {
  FONTES_PESQUISA_PRECOS, rotuloFonte, calcularEstatisticasCotacoes, valorPelaMetodologia,
  foraDoPadrao, totalGeralPesquisa, itensSemCotacao, parseItensTabela,
} from "../../dominio/pesquisa-precos.js";
import { lerTabelaDeWord } from "../../dominio/word-leitura.js";
import { lerPdfComPosicoes } from "../../pdf-posicoes-servico.js";
import { detectarFormatoPdfPca, extrairItensDfd, extrairItensPedido } from "../../dominio/pdf-pca.js";
import { gerarDocumentoPesquisaPrecos } from "../../docx/documentos.js";
import { resolverCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { brl, num } from "../../dominio/valores.js";
import { AreaUpload } from "../comuns/index.jsx";

export function PesquisaPrecosView({ doc, secretarias, onSalvar, onBack, somenteLeitura = false }) {
  const [itemExpandidoId, setItemExpandidoId] = useState(doc.itens?.[0]?.id || null);
  const [margem, setMargem] = useState(doc.margemExclusao ?? 25);
  const [novaFonteId, setNovaFonteId] = useState(FONTES_PESQUISA_PRECOS[0].id);
  const [novaOrigem, setNovaOrigem] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);
  const [revisandoImport, setRevisandoImport] = useState(null); // itens candidatos, aguardando confirmação

  async function handleImportarArquivos(arquivos) {
    setImportando(true);
    setErro("");
    try {
      const todosItens = [];
      for (const arquivo of arquivos) {
        const nomeMin = arquivo.name.toLowerCase();
        if (nomeMin.endsWith(".xlsx") || nomeMin.endsWith(".xls")) {
          const buffer = await arquivo.arrayBuffer();
          const wb = XLSX.read(buffer, { type: "array" });
          const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
          todosItens.push(...parseItensTabela(linhas));
        } else if (nomeMin.endsWith(".docx")) {
          const linhas = await lerTabelaDeWord(arquivo);
          todosItens.push(...parseItensTabela(linhas));
        } else if (nomeMin.endsWith(".pdf")) {
          const { paginas, textoCompleto } = await lerPdfComPosicoes(arquivo);
          const formato = detectarFormatoPdfPca(textoCompleto);
          if (formato === "dfd") todosItens.push(...extrairItensDfd(paginas).map(mapearItemPca));
          else if (formato === "pedido") todosItens.push(...extrairItensPedido(paginas).map(mapearItemPca));
          else setErro(prev => (prev ? prev + " " : "") + `"${arquivo.name}" não é um PDF de DFD nem de Pedido (os únicos formatos de PDF reconhecidos) — ignorado.`);
        } else {
          setErro(prev => (prev ? prev + " " : "") + `"${arquivo.name}": formato não reconhecido (use .xlsx, .docx ou .pdf).`);
        }
      }
      if (todosItens.length === 0) {
        setErro(prev => prev || "Nenhum item foi reconhecido nos arquivos selecionados.");
      } else {
        setRevisandoImport(todosItens);
      }
    } catch (e) {
      setErro("Não foi possível ler um dos arquivos: " + (e.message || e));
    }
    setImportando(false);
  }

  function mapearItemPca(it) {
    return { id: "item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      codigo: it.idProduto || "", descricao: it.descricao || "", unidade: it.unidade || "UNIDADE", quantidade: it.quantidade || "1" };
  }

  function confirmarImportacao() {
    atualizar({ itens: [...(doc.itens || []), ...revisandoImport] });
    setItemExpandidoId(revisandoImport[0]?.id || itemExpandidoId);
    setRevisandoImport(null);
  }

  function atualizarItemRevisado(idx, campo, valor) {
    setRevisandoImport(prev => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  }

  function removerItemRevisado(idx) {
    setRevisandoImport(prev => prev.filter((_, i) => i !== idx));
  }

  function atualizar(campos) {
    onSalvar({ ...doc, ...campos });
  }

  function adicionarItem() {
    const item = { id: "item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), codigo: "", descricao: "", unidade: "UNIDADE", quantidade: "1" };
    atualizar({ itens: [...(doc.itens || []), item] });
    setItemExpandidoId(item.id); // abre já pronto pra preencher, sem precisar clicar de novo
  }

  function atualizarCampoItem(itemId, campo, valor) {
    const itens = (doc.itens || []).map(i => (i.id === itemId ? { ...i, [campo]: valor } : i));
    atualizar({ itens });
  }

  function removerItem(itemId) {
    const itens = (doc.itens || []).filter(i => i.id !== itemId);
    const cotacoes = { ...doc.cotacoes }; delete cotacoes[itemId];
    const valoresAdotados = { ...doc.valoresAdotados }; delete valoresAdotados[itemId];
    atualizar({ itens, cotacoes, valoresAdotados });
    if (itemExpandidoId === itemId) setItemExpandidoId(null);
  }

  function adicionarCotacao(itemId) {
    if (!novoValor.trim()) return;
    const lista = doc.cotacoes?.[itemId] || [];
    const nova = { id: "cot_" + Math.random().toString(36).slice(2, 8), fonteId: novaFonteId, origem: novaOrigem.trim(), valor: novoValor.trim(), excluida: false, justificativaExclusao: "" };
    atualizar({ cotacoes: { ...doc.cotacoes, [itemId]: [...lista, nova] } });
    setNovaOrigem("");
    setNovoValor("");
  }

  function removerCotacao(itemId, cotacaoId) {
    const lista = (doc.cotacoes?.[itemId] || []).filter(c => c.id !== cotacaoId);
    atualizar({ cotacoes: { ...doc.cotacoes, [itemId]: lista } });
  }

  function alternarExclusao(itemId, cotacaoId, justificativa) {
    const lista = (doc.cotacoes?.[itemId] || []).map(c =>
      c.id === cotacaoId ? { ...c, excluida: !c.excluida, justificativaExclusao: !c.excluida ? justificativa : "" } : c);
    atualizar({ cotacoes: { ...doc.cotacoes, [itemId]: lista } });
  }

  function usarValorSugerido(itemId, valor) {
    atualizar({ valoresAdotados: { ...doc.valoresAdotados, [itemId]: String(Math.round(valor * 100) / 100) } });
  }

  async function handleExportar() {
    setGerando(true);
    setErro("");
    try {
      const cabecalho = resolverCabecalho(doc, secretarias, TIMBRE_PADRAO);
      await gerarDocumentoPesquisaPrecos(doc, cabecalho);
    } catch (e) {
      setErro("Não foi possível gerar o documento: " + (e.message || e));
    }
    setGerando(false);
  }

  const faltando = itensSemCotacao(doc);

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium mb-4" style={{ color: C.inkMuted }}>
        <ArrowLeft size={14} /> Voltar
      </button>

      <h1 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Pesquisa de Preços</h1>
      <p className="text-sm mb-5" style={{ color: C.inkMuted }}>
        Registre os itens pesquisados, as cotações por fonte e a metodologia adotada — art. 23 da Lei nº 14.133/2021.
      </p>

      {erro && (
        <div className="mb-4 p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.red }} />{erro}
        </div>
      )}

      <div className={somenteLeitura ? "pointer-events-none opacity-75" : ""}>
        <div className="rounded-xl border p-5 mb-5" style={{ borderColor: C.border, background: "white" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.inkMuted }}>1. Identificação</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs" style={{ color: C.inkMuted }}>Objeto da pesquisa</span>
              <input value={doc.objeto || ""} onChange={e => atualizar({ objeto: e.target.value })}
                placeholder="Ex.: Aquisição de material de expediente"
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: C.inkMuted }}>Órgão</span>
              <input value={doc.orgao || ""} onChange={e => atualizar({ orgao: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: C.inkMuted }}>Nº do processo</span>
              <input value={doc.numeroProcesso || ""} onChange={e => atualizar({ numeroProcesso: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: C.inkMuted }}>Responsável técnico</span>
              <input value={doc.responsavelNome || ""} onChange={e => atualizar({ responsavelNome: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block">
              <span className="text-xs" style={{ color: C.inkMuted }}>Cargo</span>
              <input value={doc.responsavelCargo || ""} onChange={e => atualizar({ responsavelCargo: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
          </div>
        </div>

        <div className="rounded-xl border p-5 mb-5" style={{ borderColor: C.border, background: "white" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.inkMuted }}>2. Itens pesquisados</p>

          <AreaUpload onArquivos={handleImportarArquivos} accept=".xlsx,.xls,.docx,.pdf" multiple disabled={importando}
            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-3 mb-4 text-xs"
            style={{ borderColor: C.border, color: C.inkMuted }}>
            <Upload size={14} style={{ color: C.brass }} />
            {importando ? "Lendo arquivo(s)..." : (<>Clique ou arraste pra importar itens — <b style={{ color: C.navy }}>Excel, Word ou PDF (DFD/Pedido)</b></>)}
          </AreaUpload>

          <div className="space-y-2 mb-3">
            {(doc.itens || []).map((item, idx) => {
              const expandido = itemExpandidoId === item.id;
              const cotacoesDoItem = doc.cotacoes?.[item.id] || [];
              const stats = calcularEstatisticasCotacoes(cotacoesDoItem);
              const sugerido = valorPelaMetodologia(stats, doc.metodologia);

              return (
                <div key={item.id} className="rounded-lg border overflow-hidden" style={{ borderColor: expandido ? C.navy : C.border }}>
                  <button onClick={() => setItemExpandidoId(expandido ? null : item.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    style={{ background: expandido ? C.paperDark : "white" }}>
                    <span className="text-xs font-mono shrink-0" style={{ color: C.inkMuted }}>{idx + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate" style={{ color: C.navy }}>
                        {item.descricao || <i style={{ color: C.inkMuted }}>Item sem descrição — clique pra preencher</i>}
                      </span>
                      <span className="block text-[11px]" style={{ color: C.inkMuted }}>
                        {item.unidade}, qtd. {item.quantidade}
                        {stats.n > 0 ? ` · ${stats.n} cotação(ões) · mediana ${brl(stats.mediana)}` : ""}
                      </span>
                    </span>
                    {stats.n === 0 && (
                      <span className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "#fff3cd", color: "#664d03" }}>
                        <AlertCircle size={10} /> sem cotação
                      </span>
                    )}
                    <ChevronDown size={16} className="shrink-0" style={{ color: C.inkMuted, transform: expandido ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  </button>

                  {expandido && (
                    <div className="p-4 border-t" style={{ borderColor: C.border }}>
                      <div className="grid sm:grid-cols-12 gap-2 mb-4">
                        <input value={item.codigo} onChange={e => atualizarCampoItem(item.id, "codigo", e.target.value)}
                          placeholder="Código (opcional)" className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border text-xs font-mono" style={{ borderColor: C.border }} />
                        <input value={item.descricao} onChange={e => atualizarCampoItem(item.id, "descricao", e.target.value)}
                          placeholder="Descrição do item" className="sm:col-span-6 px-2.5 py-1.5 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                        <input value={item.unidade} onChange={e => atualizarCampoItem(item.id, "unidade", e.target.value)}
                          placeholder="Unidade" className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                        <input type="number" min="1" value={item.quantidade} onChange={e => atualizarCampoItem(item.id, "quantidade", e.target.value)}
                          placeholder="Qtd." className="sm:col-span-2 px-2.5 py-1.5 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                      </div>

                      {cotacoesDoItem.length === 0 ? (
                        <p className="text-xs mb-3" style={{ color: C.inkMuted }}>Nenhuma cotação registrada ainda para este item.</p>
                      ) : (
                        <div className="space-y-1.5 mb-3">
                          {cotacoesDoItem.map(c => {
                            const fora = !c.excluida && foraDoPadrao(c.valor, stats.mediana, margem);
                            return (
                              <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                                style={{ background: c.excluida ? "#f3f4f6" : fora ? "#fff3cd" : C.paperDark,
                                  textDecoration: c.excluida ? "line-through" : "none", color: c.excluida ? C.inkMuted : C.ink }}>
                                <span className="flex-1">
                                  <b>{rotuloFonte(c.fonteId)}</b>{c.origem ? ` — ${c.origem}` : ""}
                                </span>
                                <span className="font-semibold">{brl(num(c.valor))}</span>
                                {fora && <span title="Valor fora da margem da mediana" style={{ color: "#b45309" }}><AlertCircle size={13} /></span>}
                                <button onClick={() => {
                                  const justificativa = c.excluida ? "" : (window.prompt("Por que este valor está sendo excluído (inexequível/excessivo)?") || "Sem justificativa registrada");
                                  if (!c.excluida && justificativa === null) return;
                                  alternarExclusao(item.id, c.id, justificativa);
                                }} title={c.excluida ? "Reincluir" : "Excluir (registrar justificativa)"} style={{ color: c.excluida ? C.green : C.brass }}>
                                  {c.excluida ? <Check size={13} /> : <X size={13} />}
                                </button>
                                <button onClick={() => removerCotacao(item.id, c.id)} title="Apagar cotação" style={{ color: C.red }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {stats.n > 0 && (
                        <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: C.inkMuted }}>
                          <span>{stats.n} cotação(ões) válida(s) · Mediana {brl(stats.mediana)} · Média {brl(stats.media)}</span>
                          <button onClick={() => usarValorSugerido(item.id, sugerido)}
                            className="font-semibold underline" style={{ color: C.brass }}>
                            usar {doc.metodologia === "media" ? "média" : doc.metodologia === "menor-valor" ? "menor valor" : "mediana"} ({brl(sugerido)})
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 items-end p-3 rounded-lg mb-2" style={{ background: C.paperDark }}>
                        <label className="block">
                          <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Fonte</span>
                          <select value={novaFonteId} onChange={e => setNovaFonteId(e.target.value)}
                            className="mt-1 px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
                            {FONTES_PESQUISA_PRECOS.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                          </select>
                        </label>
                        <label className="block flex-1 min-w-[140px]">
                          <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Origem / empresa (opcional)</span>
                          <input value={novaOrigem} onChange={e => setNovaOrigem(e.target.value)}
                            className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border }} />
                        </label>
                        <label className="block w-32">
                          <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Valor (R$)</span>
                          <input value={novoValor} onChange={e => setNovoValor(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarCotacao(item.id); } }}
                            placeholder="0,00" className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border }} />
                        </label>
                        <button onClick={() => adicionarCotacao(item.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.navy, color: C.paper }}>
                          Adicionar cotação
                        </button>
                      </div>
                      <p className="text-[10.5px] mb-3" style={{ color: C.inkMuted }}>
                        <Info size={10} className="inline mr-1" />
                        {FONTES_PESQUISA_PRECOS.find(f => f.id === novaFonteId)?.ajuda}
                      </p>

                      <button onClick={() => removerItem(item.id)}
                        className="flex items-center gap-1.5 text-xs font-medium" style={{ color: C.red }}>
                        <Trash2 size={12} /> Remover este item
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={adicionarItem}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold w-full justify-center border-2 border-dashed"
            style={{ borderColor: C.border, color: C.navy }}>
            <Plus size={14} /> Adicionar item
          </button>
        </div>

        <div className="rounded-xl border p-5 mb-5" style={{ borderColor: C.border, background: "white" }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.inkMuted }}>3. Metodologia de cálculo</p>
          <div className="flex gap-2 mb-3">
            {[["mediana", "Mediana"], ["media", "Média"], ["menor-valor", "Menor valor"]].map(([id, rotulo]) => (
              <button key={id} onClick={() => atualizar({ metodologia: id })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: doc.metodologia === id ? C.navy : C.border,
                  background: doc.metodologia === id ? C.navy : "white", color: doc.metodologia === id ? "white" : C.ink }}>
                {rotulo}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1.5 text-xs" style={{ color: C.inkMuted }}>
              Margem p/ sinalizar valor fora do padrão:
              <input type="number" min="1" value={margem}
                onChange={e => { setMargem(e.target.value); atualizar({ margemExclusao: e.target.value }); }}
                className="w-14 px-1.5 py-1 rounded border text-xs" style={{ borderColor: C.border }} />%
            </label>
          </div>
          <textarea rows={2} value={doc.justificativaMetodologia || ""} onChange={e => atualizar({ justificativaMetodologia: e.target.value })}
            placeholder="Justificativa da metodologia escolhida (opcional, mas recomendado)"
            className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
        </div>

        <div className="rounded-xl border p-5 mb-5" style={{ borderColor: C.border, background: "white" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: C.navy }}>Valor total estimado</span>
            <span className="text-xl font-bold" style={{ color: C.navy }}>{brl(totalGeralPesquisa(doc))}</span>
          </div>
          {faltando.length > 0 && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: "#b45309" }}>
              <AlertCircle size={12} /> {faltando.length} item(ns) ainda sem nenhuma cotação registrada.
            </p>
          )}
        </div>
      </div>

      <button onClick={handleExportar} disabled={gerando || (doc.itens || []).length === 0}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: C.brass, color: C.navyDark }}>
        <Download size={15} /> {gerando ? "Gerando..." : "Exportar em Word"}
      </button>

      {revisandoImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.65)" }}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
              Revisar itens importados ({revisandoImport.length})
            </h2>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>
              Confira antes de confirmar — a leitura automática é melhor esforço. Pode editar qualquer campo, ou remover um item indevido.
            </p>
            <div className="space-y-2 mb-4">
              {revisandoImport.map((it, idx) => (
                <div key={idx} className="rounded-lg border p-3 grid sm:grid-cols-12 gap-2 items-start" style={{ borderColor: C.border }}>
                  <input value={it.codigo} onChange={e => atualizarItemRevisado(idx, "codigo", e.target.value)}
                    placeholder="Código" className="sm:col-span-2 px-2 py-1.5 rounded border text-xs font-mono" style={{ borderColor: C.border }} />
                  <input value={it.descricao} onChange={e => atualizarItemRevisado(idx, "descricao", e.target.value)}
                    placeholder="Descrição" className="sm:col-span-6 px-2 py-1.5 rounded border text-xs" style={{ borderColor: C.border }} />
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
              <button onClick={() => setRevisandoImport(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={confirmarImportacao} disabled={revisandoImport.length === 0}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: C.navy, color: C.paper }}>
                Adicionar estes {revisandoImport.length} item(ns)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
