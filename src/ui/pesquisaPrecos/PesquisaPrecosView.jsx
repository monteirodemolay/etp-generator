/**
 * Pesquisa de Preços — tela única de criar/editar. Diferente do ETP (que é
 * um assistente em várias etapas), aqui cabe tudo numa tela só: dados do
 * processo, itens, cotações por item (por fonte, na ordem da IN 65/2021),
 * metodologia de cálculo, e exportação em Word.
 */

import React, { useState } from "react";
import {
  ArrowLeft, Plus, Trash2, Download, AlertCircle, Check, X, Info,
} from "lucide-react";
import { C } from "../tokens.js";
import {
  FONTES_PESQUISA_PRECOS, rotuloFonte, calcularEstatisticasCotacoes, valorPelaMetodologia,
  foraDoPadrao, totalGeralPesquisa, itensSemCotacao,
} from "../../dominio/pesquisa-precos.js";
import { gerarDocumentoPesquisaPrecos } from "../../docx/documentos.js";
import { resolverCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { brl, num } from "../../dominio/valores.js";

export function PesquisaPrecosView({ doc, secretarias, onSalvar, onBack, somenteLeitura = false }) {
  const [activeItemId, setActiveItemId] = useState(doc.itens?.[0]?.id || null);
  const [margem, setMargem] = useState(doc.margemExclusao ?? 25);
  const [novoItemDescricao, setNovoItemDescricao] = useState("");
  const [novoItemUnidade, setNovoItemUnidade] = useState("UNIDADE");
  const [novoItemQtd, setNovoItemQtd] = useState("1");
  const [novaFonteId, setNovaFonteId] = useState(FONTES_PESQUISA_PRECOS[0].id);
  const [novaOrigem, setNovaOrigem] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  function atualizar(campos) {
    onSalvar({ ...doc, ...campos });
  }

  function adicionarItem() {
    if (!novoItemDescricao.trim()) return;
    const item = { id: "item_" + Math.random().toString(36).slice(2, 8), descricao: novoItemDescricao.trim(), unidade: novoItemUnidade.trim() || "UNIDADE", quantidade: novoItemQtd };
    const itens = [...(doc.itens || []), item];
    atualizar({ itens });
    setActiveItemId(item.id);
    setNovoItemDescricao("");
    setNovoItemQtd("1");
  }

  function removerItem(itemId) {
    const itens = (doc.itens || []).filter(i => i.id !== itemId);
    const cotacoes = { ...doc.cotacoes }; delete cotacoes[itemId];
    const valoresAdotados = { ...doc.valoresAdotados }; delete valoresAdotados[itemId];
    atualizar({ itens, cotacoes, valoresAdotados });
    if (activeItemId === itemId) setActiveItemId(itens[0]?.id || null);
  }

  function adicionarCotacao() {
    if (!activeItemId || !novoValor.trim()) return;
    const lista = doc.cotacoes?.[activeItemId] || [];
    const nova = { id: "cot_" + Math.random().toString(36).slice(2, 8), fonteId: novaFonteId, origem: novaOrigem.trim(), valor: novoValor.trim(), excluida: false, justificativaExclusao: "" };
    atualizar({ cotacoes: { ...doc.cotacoes, [activeItemId]: [...lista, nova] } });
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

  const itemAtivo = (doc.itens || []).find(i => i.id === activeItemId) || null;
  const cotacoesDoAtivo = itemAtivo ? (doc.cotacoes?.[itemAtivo.id] || []) : [];
  const statsAtivo = calcularEstatisticasCotacoes(cotacoesDoAtivo);
  const sugeridoAtivo = valorPelaMetodologia(statsAtivo, doc.metodologia);
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

          <div className="flex flex-wrap gap-2 mb-4">
            {(doc.itens || []).map(item => {
              const stats = calcularEstatisticasCotacoes(doc.cotacoes?.[item.id]);
              return (
                <button key={item.id} onClick={() => setActiveItemId(item.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5"
                  style={{ borderColor: activeItemId === item.id ? C.navy : C.border,
                    background: activeItemId === item.id ? C.navy : "white",
                    color: activeItemId === item.id ? "white" : C.ink }}>
                  {item.descricao || "Sem descrição"}
                  {stats.n === 0 && <AlertCircle size={11} style={{ color: activeItemId === item.id ? "#fca5a5" : C.red }} />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 items-end mb-5 p-3 rounded-lg" style={{ background: C.paperDark }}>
            <label className="block flex-1 min-w-[200px]">
              <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Descrição do item</span>
              <input value={novoItemDescricao} onChange={e => setNovoItemDescricao(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarItem(); } }}
                className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block w-28">
              <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Unidade</span>
              <input value={novoItemUnidade} onChange={e => setNovoItemUnidade(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <label className="block w-24">
              <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Quantidade</span>
              <input type="number" min="1" value={novoItemQtd} onChange={e => setNovoItemQtd(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>
            <button onClick={adicionarItem} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
              style={{ background: C.navy, color: C.paper }}>
              <Plus size={13} /> Adicionar item
            </button>
          </div>

          {itemAtivo ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" style={{ color: C.navy }}>
                  {itemAtivo.descricao} <span className="font-normal" style={{ color: C.inkMuted }}>({itemAtivo.unidade}, qtd. {itemAtivo.quantidade})</span>
                </h3>
                <button onClick={() => removerItem(itemAtivo.id)} title="Remover este item" style={{ color: C.red }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {cotacoesDoAtivo.length === 0 ? (
                <p className="text-xs mb-3" style={{ color: C.inkMuted }}>Nenhuma cotação registrada ainda para este item.</p>
              ) : (
                <div className="space-y-1.5 mb-3">
                  {cotacoesDoAtivo.map(c => {
                    const fora = !c.excluida && foraDoPadrao(c.valor, statsAtivo.mediana, margem);
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
                          alternarExclusao(itemAtivo.id, c.id, justificativa);
                        }} title={c.excluida ? "Reincluir" : "Excluir (registrar justificativa)"} style={{ color: c.excluida ? C.green : C.brass }}>
                          {c.excluida ? <Check size={13} /> : <X size={13} />}
                        </button>
                        <button onClick={() => removerCotacao(itemAtivo.id, c.id)} title="Apagar cotação" style={{ color: C.red }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {statsAtivo.n > 0 && (
                <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: C.inkMuted }}>
                  <span>{statsAtivo.n} cotação(ões) válida(s) · Mediana {brl(statsAtivo.mediana)} · Média {brl(statsAtivo.media)}</span>
                  <button onClick={() => usarValorSugerido(itemAtivo.id, sugeridoAtivo)}
                    className="font-semibold underline" style={{ color: C.brass }}>
                    usar {doc.metodologia === "media" ? "média" : doc.metodologia === "menor-valor" ? "menor valor" : "mediana"} ({brl(sugeridoAtivo)})
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-end p-3 rounded-lg" style={{ background: C.paperDark }}>
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
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarCotacao(); } }}
                    placeholder="0,00" className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border }} />
                </label>
                <button onClick={adicionarCotacao} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.navy, color: C.paper }}>
                  Adicionar cotação
                </button>
              </div>
              <p className="text-[10.5px] mt-2" style={{ color: C.inkMuted }}>
                <Info size={10} className="inline mr-1" />
                {FONTES_PESQUISA_PRECOS.find(f => f.id === novaFonteId)?.ajuda}
              </p>
            </div>
          ) : (
            <p className="text-xs" style={{ color: C.inkMuted }}>Adicione um item acima para começar a registrar cotações.</p>
          )}
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
    </div>
  );
}
