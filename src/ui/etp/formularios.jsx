/**
 * As quatro etapas de preparação do ETP: itens, PCA, dados do processo e
 * levantamento de preços. São formulários e tabelas — o texto dos incisos
 * fica em documento.jsx.
 */

import * as XLSX from "xlsx";
import storage from "../../storage.js";

import { todayISO } from "../../dominio/datas.js";
import { objetoCompleto } from "../../dominio/etp.js";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Upload, Download, Trash2, Plus, Check, AlertCircle, Info, Loader2,
  FileText, FileEdit, X, ListX, Search, Copy, RefreshCw,
} from "lucide-react";
import { C } from "../tokens.js";
import { Field } from "../comuns/index.jsx";
import { num, brl, formatarParaCampo, statsFor } from "../../dominio/valores.js";
import { fmtDate } from "../../dominio/datas.js";
import { newItem, parseCentiSheet, parsePCASheet, baixarModeloPlanilha,
         baixarPlanilhaInclusaoCenti, gerarPlanilhaCotacaoFornecedor,
         parseCotacaoFornecedorSheet } from "../../dominio/planilhas.js";
import { cruzarComPca, linhaPcaPorCodigo, buscarNoPca, mesmoCodigo } from "../../dominio/pca.js";
import { buscarPcaOnline } from "../../dominio/pca-online.js";
import { secretariaDoDoc } from "../../dominio/entidades.js";
import { TIPOS_OBJETO, FONTES_COTACAO } from "../../dominio/opcoes.js";
import { listaResponsaveis } from "../../dominio/etp.js";


export function MetaForm({ etp, onMeta }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Preenche a data automaticamente com o dia atual, caso o ETP ainda não tenha uma (ex.: registros antigos)
  useEffect(() => {
    if (!etp.meta.data) onMeta("data", todayISO());
  }, [etp.id]);

  // Sugere o título a partir das classificações dos itens já cadastrados, sem depender de IA
  function handleSugerirObjeto() {
    setError("");
    const itens = etp.itens || [];
    if (itens.length === 0) {
      setError('Cadastre os itens na etapa "1. Planilha de Itens" primeiro.');
      return;
    }
    const verbo = etp.meta.tipo === "Serviços comuns" || etp.meta.tipo === "Serviços de TI"
      ? "Contratação de" : "Aquisição de";

    // Agrupa pelas classificações mais frequentes da planilha
    const contagem = {};
    itens.forEach(i => {
      const c = (i.classificacao || "").trim();
      if (c) contagem[c] = (contagem[c] || 0) + 1;
    });
    const principais = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c.toLowerCase());

    if (principais.length === 0) {
      setError("Os itens não têm classificação preenchida — escreva o objeto manualmente.");
      return;
    }
    const lista = principais.length === 1
      ? principais[0]
      : principais.slice(0, -1).join(", ") + " e " + principais[principais.length - 1];
    onMeta("titulo", `${verbo} ${lista}`);
  }

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>Dados do Processo</h2>
      <p className="text-sm mb-6" style={{ color: C.inkMuted }}>Identificação do objeto e do processo administrativo.</p>

      <label className="block mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Título do objeto (resumido)</span>
      </label>
      <div className="flex gap-2 mb-1.5">
        <input value={etp.meta.titulo} onChange={e => onMeta("titulo", e.target.value)}
          placeholder="Ex.: Aquisição de brinquedos e materiais recreativos"
          className="flex-1 px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
        <button onClick={handleSugerirObjeto}
          title="Monta o título a partir das classificações da Planilha de Itens"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium shrink-0"
          style={{ background: C.brass, color: C.navyDark }}>
          <FileEdit size={13} /> Sugerir
        </button>
      </div>
      <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
        O botão "Sugerir" monta o título a partir das classificações dos itens já cadastrados. O setor e o
        órgão entram depois, automaticamente, no objeto completo do documento.
      </p>
      {etp.meta.titulo?.trim() && (
        <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed" style={{ background: C.paperDark, color: C.ink }}>
          <span className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: C.inkMuted }}>Objeto completo no ETP:</span>
          <br />"{objetoCompleto(etp)}"
        </div>
      )}
      {error && <p className="text-xs mb-4" style={{ color: C.red }}>{error}</p>}

      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Setor requisitante" value={etp.meta.setor} onChange={v => onMeta("setor", v)}
          placeholder="Ex.: Divisão de Proteção Social Básica" />
        <Field label="Órgão / Secretaria" value={etp.meta.orgao} onChange={v => onMeta("orgao", v)}
          placeholder="Ex.: Secretaria Municipal de Assistência Social" />
        <Field label="Nº do processo" value={etp.meta.processo} onChange={v => onMeta("processo", v)}
          placeholder="Ex.: 2026.001.000123" />
      </div>

      <ResponsaveisManager responsaveis={etp.meta.responsaveis} onChange={v => onMeta("responsaveis", v)} />

      <div className="grid sm:grid-cols-3 gap-x-4">
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Tipo de objeto</span>
          <select value={etp.meta.tipo} onChange={e => onMeta("tipo", e.target.value)}
            className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
            {TIPOS_OBJETO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <Field label="Local (para assinatura)" value={etp.meta.local} onChange={v => onMeta("local", v)}
          placeholder="Ex.: Rio Verde – Goiás" />
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Data</span>
          <input type="date" value={etp.meta.data || todayISO()} onChange={e => onMeta("data", e.target.value)}
            className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
        </label>
      </div>
      <label className="block mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Introdução (opcional)</span>
        <textarea value={etp.meta.introducao} onChange={e => onMeta("introducao", e.target.value)} rows={4}
          placeholder="Parágrafo de abertura situando o documento — ex.: convênio, emenda parlamentar ou programa vinculado."
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm leading-relaxed resize-y"
          style={{ borderColor: C.border, background: "white" }} />
      </label>
      <label className="block mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Fonte de recurso (opcional)</span>
        <input value={etp.meta.fonteRecurso || ""} onChange={e => onMeta("fonteRecurso", e.target.value)}
          placeholder="Ex.: Emenda Parlamentar nº ... / Programação nº ... – GND 4 – Investimento"
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
        <span className="text-xs mt-1 block" style={{ color: C.inkMuted }}>
          Se preenchido, entra automaticamente no modelo padrão do inciso VI (Estimativa do Valor).
        </span>
      </label>

      <div className="mt-8 mb-3">
        <h3 className="serif text-lg font-semibold" style={{ color: C.navy }}>Detalhes para os modelos padrão</h3>
        <p className="text-xs" style={{ color: C.inkMuted }}>
          Opcional, mas quanto mais preenchido aqui, menos colchete <code>[complete aqui]</code> sobra nos
          modelos padrão (sem IA) dos incisos III, VI, VII, VIII, XI e XII.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-4">
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Prazo de garantia</span>
          <div className="mt-1.5 flex gap-2">
            <input value={etp.meta.prazoGarantiaDias} onChange={e => onMeta("prazoGarantiaDias", e.target.value)}
              placeholder="Ex.: 12" className="flex-1 px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
            <select value={etp.meta.prazoGarantiaUnidade || "meses"} onChange={e => onMeta("prazoGarantiaUnidade", e.target.value)}
              className="px-2 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
              <option value="dias">dias</option>
              <option value="meses">meses</option>
              <option value="anos">anos</option>
            </select>
          </div>
        </label>
        <label className="block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Prazo de entrega/execução</span>
          <div className="mt-1.5 flex gap-2">
            <input value={etp.meta.prazoEntregaDias} onChange={e => onMeta("prazoEntregaDias", e.target.value)}
              placeholder="Ex.: 30" className="flex-1 px-3 py-2.5 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
            <select value={etp.meta.prazoEntregaUnidade || "dias"} onChange={e => onMeta("prazoEntregaUnidade", e.target.value)}
              className="px-2 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
              <option value="dias">dias</option>
              <option value="meses">meses</option>
              <option value="anos">anos</option>
            </select>
          </div>
        </label>
      </div>

      <label className="block mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Parcelamento (inciso VIII)
        </span>
        <select value={etp.meta.parcelamento || ""} onChange={e => onMeta("parcelamento", e.target.value)}
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border, maxWidth: "360px" }}>
          <option value="">Não definido</option>
          <option value="nao">Não será parcelada (lote único)</option>
          <option value="sim">Será parcelada em itens/lotes</option>
        </select>
      </label>

      <label className="flex items-start gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={!!etp.meta.manutencaoContinuada}
          onChange={e => onMeta("manutencaoContinuada", e.target.checked)}
          className="mt-0.5" style={{ accentColor: C.brass }} />
        <span className="text-sm" style={{ color: C.ink }}>
          Esta contratação exige manutenção, assistência técnica ou fornecimento continuado de peças (inciso VII)
        </span>
      </label>

      <label className="flex items-start gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={!!etp.meta.correlataExiste}
          onChange={e => onMeta("correlataExiste", e.target.checked)}
          className="mt-0.5" style={{ accentColor: C.brass }} />
        <span className="text-sm" style={{ color: C.ink }}>
          Há contratação correlata ou interdependente (inciso XI)
        </span>
      </label>
      {etp.meta.correlataExiste && (
        <input value={etp.meta.correlataDescricao || ""} onChange={e => onMeta("correlataDescricao", e.target.value)}
          placeholder="Descreva brevemente a contratação relacionada e a natureza da dependência"
          className="w-full mb-4 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
      )}

      <label className="flex items-start gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={!!etp.meta.impactoAmbientalRelevante}
          onChange={e => onMeta("impactoAmbientalRelevante", e.target.checked)}
          className="mt-0.5" style={{ accentColor: C.brass }} />
        <span className="text-sm" style={{ color: C.ink }}>
          Há impacto ambiental relevante a considerar (inciso XII)
        </span>
      </label>
      {etp.meta.impactoAmbientalRelevante && (
        <input value={etp.meta.impactoAmbientalDescricao || ""} onChange={e => onMeta("impactoAmbientalDescricao", e.target.value)}
          placeholder="Descreva brevemente o impacto e a medida de mitigação prevista"
          className="w-full mb-4 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border, background: "white" }} />
      )}

      <label className="block mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Como as quantidades foram levantadas (inciso V)
        </span>
        <select value={etp.meta.metodologiaQuantidades || ""} onChange={e => onMeta("metodologiaQuantidades", e.target.value)}
          className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
          <option value="">Não definido</option>
          <option value="historico">Histórico de consumo/utilização</option>
          <option value="beneficiarios">Número de beneficiários/atendimentos</option>
          <option value="parametro">Parâmetro técnico ou normativo</option>
          <option value="substituicao">Substituição de itens por fim de vida útil</option>
          <option value="comparacao">Comparação com unidades/órgãos similares</option>
          <option value="outro">Outro (descrever)</option>
        </select>
      </label>
      {etp.meta.metodologiaQuantidades && (
        <label className="block mb-4">
          <span className="text-xs" style={{ color: C.inkMuted }}>
            {({
              historico: "Detalhe o período analisado e o consumo médio observado (ex.: \"últimos 12 meses, consumo médio de 40 unidades/mês\").",
              beneficiarios: "Informe o número de beneficiários/atendimentos e o parâmetro de consumo por pessoa (ex.: \"120 assistidos, 1 kit por pessoa/semestre\").",
              parametro: "Cite a norma, portaria ou parâmetro técnico utilizado como referência.",
              substituicao: "Informe quantos itens serão substituídos e a condição que motiva a troca (ex.: \"8 equipamentos com mais de 10 anos de uso, fora de garantia\").",
              comparacao: "Cite a unidade/órgão comparado e os números levantados.",
              outro: "Descreva livremente a metodologia utilizada — este texto entra direto no modelo padrão do inciso V.",
            })[etp.meta.metodologiaQuantidades]}
          </span>
          <textarea value={etp.meta.detalhamentoQuantidades || ""} onChange={e => onMeta("detalhamentoQuantidades", e.target.value)}
            rows={2} placeholder="Digite os números e/ou a referência concreta que embasou o levantamento..."
            className="mt-1.5 w-full px-3 py-2 rounded-lg border text-sm leading-relaxed resize-y"
            style={{ borderColor: C.border, background: "white" }} />
        </label>
      )}

      <div className="mt-6 p-4 rounded-lg text-xs leading-relaxed" style={{ background: C.paperDark, color: C.inkMuted }}>
        Os incisos marcados com <b style={{ color: C.brass }}>*</b> na barra lateral (I, IV, VI, VIII e XIII) são de
        preenchimento obrigatório conforme o art. 18, §2º da Lei nº 14.133/2021 — os demais podem ser
        justificadamente dispensados conforme as particularidades do caso concreto.
      </div>
    </div>
  );
}

// ---------- Planilha de Itens ----------
export function ItemsForm({ etp, onItens, onMeta }) {
  const itens = etp.itens || [];
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);

  function update(idx, field, val) {
    const next = itens.map((it, i) => (i === idx ? { ...it, [field]: val } : it));
    onItens(next);
  }
  function add() { onItens([...itens, newItem()]); }
  function remove(idx) {
    const id = itens[idx]?.id;
    onItens(itens.filter((_, i) => i !== idx));
    if (id) setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  function toggleOne(id) {
    setConfirmBulk(false);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setConfirmBulk(false);
    setSelected(prev => (prev.size === itens.length ? new Set() : new Set(itens.map(it => it.id))));
  }
  function removeSelected() {
    if (selected.size === 0) return;
    onItens(itens.filter(it => !selected.has(it.id)));
    setSelected(new Set());
    setConfirmBulk(false);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const result = parseCentiSheet(rows);
      if (result.itens.length === 0) throw new Error("Nenhum item encontrado nesta planilha.");
      if (itens.length > 0) {
        setPendingImport(result); // pede confirmação inline antes de substituir
      } else {
        applyImport(result);
      }
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Não foi possível importar esta planilha.");
    }
    setImporting(false);
    e.target.value = "";
  }

  function applyImport(result) {
    onItens(result.itens);
    setSelected(new Set());
    setConfirmBulk(false);
    if (result.codigo && !etp.meta.processo) onMeta("processo", "Pedido " + result.codigo);
    if (result.municipio && !etp.meta.orgao) onMeta("orgao", result.municipio);
    setImportMsg(`${result.itens.length} itens importados.`);
    setPendingImport(null);
  }

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>1. Planilha de Itens</h2>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        Primeiro passo: o que será comprado. Só a relação de itens — sem valores. A estimativa de valor vem depois,
        na etapa de Levantamento de Preços, com base nas cotações do Banco de Preços.
      </p>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: C.navy, color: C.paper }}>
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {importing ? "Importando..." : "Importar planilha do Sistema Centi"}
        </button>
        <button onClick={baixarModeloPlanilha}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: C.paperDark, color: C.navy }}>
          <FileText size={13} /> Baixar modelo em branco
        </button>
        {importMsg && <span className="text-xs" style={{ color: C.green }}>{importMsg}</span>}
        {selected.size > 0 && !confirmBulk && (
          <button onClick={() => setConfirmBulk(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
            <Trash2 size={13} /> Excluir selecionados ({selected.size})
          </button>
        )}
      </div>

      {confirmBulk && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "rgba(166,64,61,0.08)" }}>
          <AlertCircle size={15} className="shrink-0" style={{ color: C.red }} />
          <span className="text-xs flex-1" style={{ color: C.ink }}>
            {selected.size === itens.length
              ? `Confirma a exclusão de todos os ${itens.length} itens?`
              : `Confirma a exclusão dos ${selected.size} itens selecionados?`}
          </span>
          <button onClick={removeSelected}
            className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: C.red, color: "white" }}>
            Confirmar exclusão
          </button>
          <button onClick={() => setConfirmBulk(false)}
            className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
            Cancelar
          </button>
        </div>
      )}
      {pendingImport && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: "rgba(166,131,46,0.1)" }}>
          <AlertCircle size={15} className="shrink-0" style={{ color: C.brass }} />
          <span className="text-xs flex-1" style={{ color: C.ink }}>
            Substituir os {itens.length} itens atuais pelos {pendingImport.itens.length} itens importados?
          </span>
          <button onClick={() => applyImport(pendingImport)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold" style={{ background: C.brass, color: C.navyDark }}>
            Confirmar substituição
          </button>
          <button onClick={() => setPendingImport(null)}
            className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
            Cancelar
          </button>
        </div>
      )}

      {importError && (
        <p className="text-xs mb-3 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {importError}</p>
      )}

      <div className="rounded-lg border overflow-x-auto etp-scroll" style={{ borderColor: C.border }}>
        <table className="w-full text-sm" style={{ minWidth: "760px" }}>
          <thead>
            <tr style={{ background: C.paperDark }}>
              <th className="px-3 py-2 w-8">
                {itens.length > 0 && (
                  <input type="checkbox" checked={selected.size === itens.length} onChange={toggleAll}
                    style={{ accentColor: C.brass }} className="w-3.5 h-3.5" />
                )}
              </th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-8" style={{ color: C.inkMuted }}>#</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-32" style={{ color: C.inkMuted }}>
                Código
              </th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-24" style={{ color: C.inkMuted }}>Unid.</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-16" style={{ color: C.inkMuted }}>Qtd.</th>
              <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-40" style={{ color: C.inkMuted }}>Classificação</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, idx) => (
              <tr key={it.id} className="border-t align-top" style={{ borderColor: C.border, background: selected.has(it.id) ? "rgba(166,131,46,0.06)" : "transparent" }}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleOne(it.id)}
                    style={{ accentColor: C.brass }} className="w-3.5 h-3.5" />
                </td>
                <td className="px-2 py-2 text-xs" style={{ color: C.inkMuted }}>{idx + 1}</td>
                <td className="px-2 py-2">
                  {(() => {
                    const noPca = linhaPcaPorCodigo(etp.pca, it.idProduto);
                    return (
                      <>
                        <input value={it.idProduto || ""} onChange={e => update(idx, "idProduto", e.target.value)}
                          placeholder="Cód. Centi"
                          className="w-full px-2 py-1.5 rounded border text-sm font-mono"
                          style={{ borderColor: noPca ? C.green : (it.idProduto?.trim() ? C.border : C.brassLight) }}
                          title="Código do produto no Sistema Centi — é por ele que o app cruza o item com o PCA" />
                        {noPca && (
                          <p className="text-[9.5px] mt-1 leading-snug flex items-start gap-1" style={{ color: C.green }}>
                            <Check size={9} className="shrink-0 mt-0.5" />
                            <span>seq. {noPca.sequencial || "—"}</span>
                          </p>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="px-2 py-2">
                  {(() => {
                    const noPca = linhaPcaPorCodigo(etp.pca, it.idProduto);
                    return (
                      <>
                        <input value={it.descricao} onChange={e => update(idx, "descricao", e.target.value)}
                          placeholder="Descrição do item" className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                        {noPca && noPca.produto && (
                          <p className="text-[9.5px] mt-1 leading-snug px-1" style={{ color: C.inkMuted }}>
                            No PCA: {noPca.produto}
                            {!it.descricao?.trim() && (
                              <button onClick={() => update(idx, "descricao", noPca.produto)}
                                className="ml-1.5 font-semibold" style={{ color: C.brass }}>usar</button>
                            )}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td className="px-2 py-2">
                  <input value={it.unidade} onChange={e => update(idx, "unidade", e.target.value)}
                    className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                </td>
                <td className="px-2 py-2">
                  <input value={it.quantidade} onChange={e => update(idx, "quantidade", e.target.value)}
                    className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                </td>
                <td className="px-2 py-2">
                  <input list="classificacoes-usadas" value={it.classificacao || ""}
                    onChange={e => update(idx, "classificacao", e.target.value)}
                    placeholder="Ex.: MATERIAL DE COPA"
                    className="w-full px-2 py-1.5 rounded border text-sm" style={{ borderColor: C.border }} />
                </td>
                <td className="px-2 py-2">
                  <button onClick={() => remove(idx)} style={{ color: C.red }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="classificacoes-usadas">
          {[...new Set(itens.map(i => i.classificacao).filter(Boolean))].map(c => <option key={c} value={c} />)}
        </datalist>
        {itens.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: C.inkMuted }}>Nenhum item adicionado ainda. Importe uma planilha ou adicione manualmente.</p>
        )}
      </div>

      <button onClick={add} className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium"
        style={{ background: C.paperDark, color: C.navy }}>
        <Plus size={13} /> Adicionar item
      </button>

      {itens.length > 0 && (() => {
        const semCodigo = itens.filter(i => !i.idProduto?.trim()).length;
        return (
          <>
            <div className="mt-4 p-3 rounded-lg flex items-center gap-2 text-xs" style={{ background: C.paperDark, color: C.inkMuted }}>
              <Info size={13} className="shrink-0" style={{ color: C.brass }} />
              {itens.length} item(ns) cadastrado(s). Os valores serão levantados na etapa "4. Levantamento de Preços".
            </div>
            {semCodigo > 0 && (
              <div className="mt-2 p-3 rounded-lg flex items-start gap-2 text-xs leading-relaxed"
                style={{ background: "rgba(166,131,46,0.1)", color: C.ink }}>
                <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
                <span>
                  <b>{semCodigo} item(ns) sem código.</b> O cruzamento com o PCA é feito pelo código do produto —
                  sem ele, o item não será localizado automaticamente na etapa 2 e você terá de informar o
                  sequencial à mão. Se possível, preencha o código do Sistema Centi.
                </span>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ---------- Alinhamento ao PCA ----------
// ---------- Alinhamento ao PCA ----------
export function PCAForm({ etp, onPca, onManuaisPca, secretarias }) {
  const itens = etp.itens || [];
  const pca = etp.pca;
  const manuais = etp.manuaisPca || {};
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [showFaltantes, setShowFaltantes] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [buscaError, setBuscaError] = useState("");
  const [mostrarImportarArquivo, setMostrarImportarArquivo] = useState(false);
  const entidade = secretariaDoDoc(etp, secretarias);
  const jaTentouAutoRef = useRef(null);

  // Padrão: assim que a entidade é conhecida, busca o PCA dela direto do painel da Prefeitura
  // de Rio Verde sozinho — sem exigir clique. Só não faz isso se já houver um PCA carregado
  // (buscado ou importado à mão) ou se já tiver tentado para esta entidade nesta sessão.
  useEffect(() => {
    if (!entidade?.sigla || pca || jaTentouAutoRef.current === entidade.sigla) return;
    jaTentouAutoRef.current = entidade.sigla;
    handleBuscarOnline();
  }, [entidade?.sigla, pca]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const linhas = parsePCASheet(rows);
      onPca({ nomeArquivo: file.name, importedAt: Date.now(), linhas });
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Não foi possível importar esta planilha.");
    }
    setImporting(false);
    e.target.value = "";
  }

  async function handleBuscarOnline() {
    setBuscando(true);
    setBuscaError("");
    try {
      const linhas = await buscarPcaOnline(entidade?.sigla);
      onPca({ nomeArquivo: `Painel do PCA — ${entidade.sigla}`, importedAt: Date.now(), linhas, origem: "online" });
    } catch (err) {
      console.error(err);
      setBuscaError(err.message || "Não foi possível buscar o PCA agora.");
    }
    setBuscando(false);
  }

  function atualizarManual(itemId, campo, valor) {
    const atual = manuais[itemId] || { codigo: "", sequencial: "" };
    onManuaisPca({ ...manuais, [itemId]: { ...atual, [campo]: valor } });
  }

  const matches = cruzarComPca(itens, pca, manuais);
  const encontrados = matches.filter(m => m.previsto).length;
  const semMatchAutomatico = matches.filter(m => !m.pcaRow);
  // Itens ainda pendentes que já têm uma sugestão por descrição — dá pra confirmar todos de uma vez
  const sugestoesPendentes = semMatchAutomatico.filter(m => m.sugestaoDescricao);
  function confirmarTodasSugestoes() {
    const novosManuais = { ...manuais };
    sugestoesPendentes.forEach(m => {
      novosManuais[m.item.id] = { codigoPca: m.sugestaoDescricao.codigo, sequencial: m.sugestaoDescricao.sequencial || "" };
    });
    onManuaisPca(novosManuais);
  }
  const itensFaltantes = matches.filter(m => !m.previsto).map(m => m.item);
  const totalmenteAlinhado = itens.length > 0 && pca && encontrados === itens.length;

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>2. Alinhamento ao PCA</h2>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        O app busca o PCA direto do painel da Prefeitura de Rio Verde, pela sigla da entidade — sem precisar
        exportar nada. O cruzamento com os itens é automático, pelo código do produto.
      </p>

      <div className="mb-5 p-4 rounded-lg border" style={{ borderColor: C.border, background: "white" }}>
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <span className="text-sm font-semibold" style={{ color: C.navy }}>PCA de {entidade?.sigla || entidade?.nome || "—"}</span>
          <button onClick={handleBuscarOnline} disabled={buscando || !entidade?.sigla}
            title={!entidade?.sigla ? "Esta entidade não tem sigla cadastrada" : "Atualizar do painel do PCA"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-60"
            style={{ color: C.navy }}>
            {buscando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {buscando ? "Buscando..." : "Atualizar"}
          </button>
        </div>
        {pca ? (
          <p className="text-xs" style={{ color: C.inkMuted }}>
            {pca.linhas.length} itens no painel · {pca.origem === "online" ? "buscado" : "importado de arquivo"} em {fmtDate(pca.importedAt)}
          </p>
        ) : !buscando && (
          <p className="text-xs" style={{ color: C.inkMuted }}>Ainda não buscado.</p>
        )}
        {buscaError && (
          <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}>
            <AlertCircle size={12} /> {buscaError}
          </p>
        )}

        <div className="mt-3 pt-3 border-t" style={{ borderColor: C.border }}>
          {!mostrarImportarArquivo ? (
            <button onClick={() => setMostrarImportarArquivo(true)}
              className="text-xs font-medium underline" style={{ color: C.inkMuted }}>
              Prefere importar um arquivo em vez de buscar do painel?
            </button>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => fileRef.current?.click()} disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60 border"
                  style={{ borderColor: C.border, color: C.ink }}>
                  {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {importing ? "Importando..." : "Importar planilha (.xlsx)"}
                </button>
                <button onClick={() => setMostrarImportarArquivo(false)}
                  className="text-xs font-medium" style={{ color: C.inkMuted }}>
                  Cancelar
                </button>
              </div>
              {importError && (
                <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.red }}>
                  <AlertCircle size={12} /> {importError}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="text-sm" style={{ color: C.inkMuted }}>
          Cadastre os itens na etapa "1. Planilha de Itens" primeiro.
        </p>
      ) : !pca ? (
        <p className="text-sm" style={{ color: C.inkMuted }}>
          Aguardando a busca do PCA acima para ver o cruzamento.
        </p>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.paperDark }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase w-10" style={{ color: C.inkMuted }}>#</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Consta no PCA?</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Sequencial</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, idx) => (
                  <tr key={m.item.id} className="border-t align-top" style={{ borderColor: C.border }}>
                    <td className="px-3 py-2 text-xs" style={{ color: C.inkMuted }}>{idx + 1}</td>
                    <td className="px-3 py-2">{m.item.descricao || `Item ${idx + 1}`}</td>
                    <td className="px-2 py-2">
                      {m.previsto ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(76,124,89,0.12)", color: C.green }}>
                          <Check size={11} /> Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
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

          <div className="mt-3 p-3 rounded-lg flex items-center gap-2 text-xs flex-wrap"
            style={{ background: totalmenteAlinhado ? "rgba(76,124,89,0.1)" : "rgba(166,131,46,0.1)", color: C.ink }}>
            {totalmenteAlinhado ? <Check size={14} style={{ color: C.green }} /> : <Info size={14} style={{ color: C.brass }} />}
            <span><b>{encontrados}</b> de <b>{itens.length}</b> itens previstos no PCA (inclui os informados à mão).</span>
          </div>

          {semMatchAutomatico.length > 0 && (
            <button onClick={() => setShowFaltantes(true)}
              className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-md text-xs font-medium"
              style={{
                background: itensFaltantes.length > 0 ? "rgba(166,64,61,0.1)" : "rgba(166,131,46,0.12)",
                color: itensFaltantes.length > 0 ? C.red : C.brass,
              }}>
              <ListX size={13} /> Itens não localizados automaticamente ({semMatchAutomatico.length}
              {itensFaltantes.length !== semMatchAutomatico.length ? ` · ${itensFaltantes.length} pendente(s)` : ""})
            </button>
          )}
        </>
      )}

      {showFaltantes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}
          onClick={() => setShowFaltantes(false)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl z-10"
              style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-xl font-semibold" style={{ color: C.navy }}>Itens sem previsão no PCA</h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  {itensFaltantes.length} de {semMatchAutomatico.length} ainda pendente(s)
                </p>
              </div>
              <button onClick={() => setShowFaltantes(false)} className="shrink-0" style={{ color: C.inkMuted }}>
                <X size={20} />
              </button>
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
                Estes itens não foram localizados automaticamente na planilha importada. Se algum já estiver
                previsto no PCA sob outro código, use a busca para localizar a linha correta — o app puxa o
                produto e o sequencial automaticamente. Os que ficarem sem preenchimento
                podem ser baixados numa planilha para inclusão no Sistema Centi.
              </p>

              <div className="space-y-3 mb-5">
                {semMatchAutomatico.map((m, idx) => {
                  const it = m.item;
                  const dados = manuais[it.id] || { codigo: "", codigoPca: "", sequencial: "" };
                  const resolvido = !!(dados.codigoPca?.trim() || dados.sequencial?.trim());
                  return (
                    <div key={it.id} className="p-4 rounded-lg border-2"
                      style={{
                        borderColor: resolvido ? "rgba(76,124,89,0.4)" : C.border,
                        background: resolvido ? "rgba(76,124,89,0.04)" : "white",
                      }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="text-xs font-semibold" style={{ color: C.inkMuted }}>
                            Item {itens.indexOf(it) + 1}
                          </span>
                          <p className="text-sm font-medium" style={{ color: C.navy }}>
                            {it.descricao || `Item ${idx + 1}`}
                          </p>
                        </div>
                        {resolvido ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: "rgba(76,124,89,0.15)", color: C.green }}>
                            <Check size={12} /> Previsto
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: "rgba(166,64,61,0.1)", color: C.red }}>
                            <AlertCircle size={12} /> Pendente
                          </span>
                        )}
                      </div>
                      <VinculoPca item={it} pca={pca} dados={dados} sugestao={m.sugestaoDescricao}
                        onAlterar={novos => onManuaisPca({ ...manuais, [it.id]: novos })} />
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
    </div>
  );
}

// ---------- Vínculo de um item a uma linha do PCA ----------
// Resolve o caso em que o código do item no Centi é diferente do código no PCA: o servidor
// busca a linha certa (por código, sequencial ou descrição) e vincula manualmente.
// ---------- Vínculo de um item a uma linha do PCA ----------
// Resolve o caso em que o código do item no Centi é diferente do código no PCA: o servidor
// busca a linha certa (por código, sequencial ou descrição) e vincula manualmente.
export function VinculoPca({ item, pca, dados, onAlterar, sugestao }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [sugestaoDispensada, setSugestaoDispensada] = useState(false);
  const vinculada = dados?.codigoPca ? linhaPcaPorCodigo(pca, dados.codigoPca) : null;
  const resultados = buscarNoPca(pca, busca);

  function vincular(linha) {
    onAlterar({ ...dados, codigoPca: linha.codigo, sequencial: linha.sequencial || "" });
    setBusca("");
    setAberto(false);
  }

  function desvincular() {
    onAlterar({ ...dados, codigoPca: "", sequencial: "" });
  }

  if (vinculada) {
    return (
      <div className="p-2.5 rounded-lg" style={{ background: "rgba(76,124,89,0.08)", border: "1px solid rgba(76,124,89,0.35)" }}>
        <div className="flex items-start gap-2">
          <Check size={13} className="shrink-0 mt-0.5" style={{ color: C.green }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: C.navy }}>
              Vinculado ao PCA · sequencial {vinculada.sequencial || "—"}
            </p>
            <p className="text-[11px] leading-snug mt-0.5" style={{ color: C.inkMuted }}>
              Código no PCA: <b style={{ color: C.ink }}>{vinculada.codigo}</b>
              {item.idProduto && item.idProduto !== vinculada.codigo && (
                <> · no Centi: <b style={{ color: C.ink }}>{item.idProduto}</b></>
              )}
            </p>
            <p className="text-[11px] leading-snug" style={{ color: C.inkMuted }}>{vinculada.produto}</p>
          </div>
          <button onClick={desvincular} className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded"
            style={{ color: C.red }}>Desfazer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {item.idProduto && (
        <p className="text-[11px] mb-1.5" style={{ color: C.inkMuted }}>
          Código deste item no Centi: <b style={{ color: C.ink }}>{item.idProduto}</b> — não localizado no PCA.
        </p>
      )}

      {sugestao && !sugestaoDispensada && (
        <div className="p-3 rounded-lg mb-3" style={{ background: "rgba(166,131,46,0.08)", border: `1px solid ${C.brass}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.brass }}>
            Possível correspondência por descrição
          </p>
          <p className="text-xs leading-snug mb-2" style={{ color: C.ink }}>{sugestao.produto}</p>
          <div className="flex items-center gap-3 flex-wrap mb-2.5 text-[11px]" style={{ color: C.inkMuted }}>
            <span>Código no PCA: <b style={{ color: C.ink }}>{sugestao.codigo || "—"}</b></span>
            <span>Código no Centi: <b style={{ color: C.ink }}>{item.idProduto || "—"}</b></span>
            <span>Sequencial: <b style={{ color: C.ink }}>{sugestao.sequencial || "—"}</b></span>
          </div>
          <p className="text-[10.5px] leading-snug mb-2.5" style={{ color: C.inkMuted }}>
            A descrição bate, mas o código é diferente — provavelmente o mesmo item, cadastrado sob outra
            numeração no PCA. Confirmando, os dois códigos ficam registrados aqui como comprovação.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => vincular(sugestao)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold"
              style={{ background: C.brass, color: C.navyDark }}>
              Confirmar correspondência
            </button>
            <button onClick={() => setSugestaoDispensada(true)}
              className="px-3 py-1.5 rounded-md text-xs font-medium" style={{ color: C.inkMuted }}>
              Não é este
            </button>
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Localizar no PCA
        </span>
        <input value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          placeholder="Código do PCA, sequencial ou parte da descrição…"
          className="mt-1 w-full px-2.5 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
      </label>

      {aberto && busca.trim().length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden max-h-56 overflow-y-auto etp-scroll"
          style={{ background: "white", borderColor: C.border }}>
          {resultados.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-xs font-medium mb-1" style={{ color: C.ink }}>
                Nada encontrado no PCA para "{busca}".
              </p>
              {mesmoCodigo(busca, item.idProduto) ? (
                <p className="text-[11px] leading-relaxed" style={{ color: C.inkMuted }}>
                  Este é o código do item no Centi — e ele não consta na planilha do PCA importada.
                  É justamente esse o caso em que o código do PCA é <b>outro</b>: procure pelo{" "}
                  <b>nome do produto</b> ou pelo <b>sequencial</b>. Se o item realmente não estiver no
                  plano, deixe em branco e use a planilha de inclusão no Centi.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed" style={{ color: C.inkMuted }}>
                  Tente pelo nome do produto ou pelo sequencial. A planilha importada tem{" "}
                  {pca?.linhas?.length || 0} linha(s).
                </p>
              )}
            </div>
          ) : resultados.map((l, i) => (
            <button key={`${l.codigo}-${l.sequencial}-${i}`} onClick={() => vincular(l)}
              className="w-full text-left px-3 py-2 hover:bg-black/[0.03]"
              style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
              <p className="text-xs font-medium leading-snug" style={{ color: C.navy }}>{l.produto || "(sem descrição)"}</p>
              <p className="text-[10.5px] mt-0.5" style={{ color: C.inkMuted }}>
                cód. no PCA <b>{l.codigo || "—"}</b> · seq. <b>{l.sequencial || "—"}</b>
                {item.idProduto && item.idProduto !== l.codigo && (
                  <> · <span style={{ color: C.brass }}>no Centi: <b>{item.idProduto}</b></span></>
                )}
                {l.local ? ` · ${l.local}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] mt-1.5" style={{ color: C.inkMuted }}>
        Use quando o código do item no Centi for diferente do código no PCA. Se preferir, informe o
        sequencial direto no campo abaixo.
      </p>
      <label className="block mt-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
          Ou informe o sequencial à mão
        </span>
        <input value={dados?.sequencial || ""}
          onChange={e => onAlterar({ ...dados, sequencial: e.target.value, codigoPca: "" })}
          placeholder="Ex.: 10808"
          className="mt-1 w-full px-2.5 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
      </label>
    </div>
  );
}

export function CotacoesForm({ etp, onCotacoes, onValoresAdotados, onMeta }) {
  const itens = etp.itens || [];
  const cotacoes = etp.cotacoes || {};
  const valoresAdotados = etp.valoresAdotados || {};
  const metodologia = etp.meta.metodologiaCalculo === "media" ? "media" : "mediana";
  const labelMetodologia = metodologia === "media" ? "média" : "mediana";
  const totalGeral = itens.reduce((sum, it) => sum + num(it.quantidade) * num(valoresAdotados[it.id]), 0);

  function valorMetodologia(stats) {
    return metodologia === "media" ? stats.media : stats.mediana;
  }

  const [activeItemId, setActiveItemId] = useState(null);
  const [margem, setMargem] = useState(25);
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportNome, setExportNome] = useState("");
  const [exportCnpj, setExportCnpj] = useState("");
  const [novaFonte, setNovaFonte] = useState(FONTES_COTACAO[0]);
  const [novaEmpresa, setNovaEmpresa] = useState("");
  const [novoValor, setNovoValor] = useState("");

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importMsg, setImportMsg] = useState("");

  // Fontes já usadas neste ETP + as sugestões padrão — cresce conforme o servidor digita novas
  const fontesConhecidas = [...new Set([
    ...FONTES_COTACAO,
    ...Object.values(cotacoes).flat().map(q => q.fonte).filter(Boolean),
  ])];

  function forDoPadrao(valor, mediana) {
    const v = num(valor);
    if (!v || !mediana) return false;
    return Math.abs(v - mediana) / mediana > margem / 100;
  }

  function abrirPopup(itemId) {
    setActiveItemId(itemId);
    setNovaFonte(FONTES_COTACAO[0]);
    setNovaEmpresa("");
    setNovoValor("");
  }

  function salvarNovaCotacao() {
    if (!activeItemId || !novoValor.trim()) return;
    const list = cotacoes[activeItemId] || [];
    onCotacoes({
      ...cotacoes,
      [activeItemId]: [...list, {
        id: "q_" + Math.random().toString(36).slice(2, 8),
        fonte: novaFonte?.trim() || FONTES_COTACAO[0], empresa: novaEmpresa.trim(), valor: novoValor.trim(),
      }],
    });
    setNovaFonte(FONTES_COTACAO[0]);
    setNovaEmpresa("");
    setNovoValor("");
  }
  function removeQuote(itemId, qid) {
    onCotacoes({ ...cotacoes, [itemId]: (cotacoes[itemId] || []).filter(q => q.id !== qid) });
  }
  function setAdotado(itemId, val) {
    onValoresAdotados({ ...valoresAdotados, [itemId]: val });
  }

  function handleExport() {
    gerarPlanilhaCotacaoFornecedor({ etp, nomeEmpresa: exportNome, cnpj: exportCnpj });
    setShowExportForm(false);
    setExportNome("");
    setExportCnpj("");
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    setImportMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const result = parseCotacaoFornecedorSheet(rows);
      if (result.valores.length === 0) throw new Error("Nenhum valor preenchido foi encontrado nesta planilha.");

      const next = { ...cotacoes };
      let matched = 0;
      result.valores.forEach(v => {
        let itemId = v.itemId && itens.some(it => it.id === v.itemId) ? v.itemId : null;
        if (!itemId && v.descricao) {
          const found = itens.find(it => it.descricao.trim().toLowerCase() === v.descricao.trim().toLowerCase());
          itemId = found ? found.id : null;
        }
        if (!itemId) return;
        matched++;
        const list = next[itemId] || [];
        next[itemId] = [...list, {
          id: "q_" + Math.random().toString(36).slice(2, 8),
          fonte: "Fornecedor", empresa: result.nomeEmpresa, cnpj: result.cnpj, valor: v.valor,
        }];
      });
      onCotacoes(next);
      setImportMsg(`${matched} cotação(ões) importada(s)${result.nomeEmpresa ? ` de ${result.nomeEmpresa}` : ""}.`);
    } catch (err) {
      console.error(err);
      setImportError(err.message || "Não foi possível importar esta planilha.");
    }
    setImporting(false);
    e.target.value = "";
  }

  const itemAtivo = activeItemId ? itens.find(i => i.id === activeItemId) : null;
  const quotesAtivo = itemAtivo ? (cotacoes[itemAtivo.id] || []) : [];
  const statsAtivo = statsFor(quotesAtivo);
  const adotadoAtivo = itemAtivo ? (valoresAdotados[itemAtivo.id] || "") : "";

  return (
    <div>
      <h2 className="serif text-2xl font-semibold mb-1" style={{ color: C.navy }}>4. Levantamento de Preços</h2>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        Registre as cotações por item (Banco de Preços, Internet, fornecedores) para compor a estimativa de
        valor exigida pelo art. 23, §1º, da Lei nº 14.133/2021.
      </p>

      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg flex-wrap" style={{ background: C.paperDark }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Metodologia de cálculo:</span>
        <select value={metodologia} onChange={e => onMeta("metodologiaCalculo", e.target.value)}
          className="px-2 py-1.5 rounded border text-sm bg-white" style={{ borderColor: C.border }}>
          <option value="mediana">Mediana</option>
          <option value="media">Média aritmética simples</option>
        </select>
        <span className="text-xs" style={{ color: C.inkMuted }}>
          Uma única escolha vale para todos os itens — usada no botão "usar {labelMetodologia}" e no texto padrão do inciso VI.
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button onClick={() => setShowExportForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ background: C.paperDark, color: C.navy }}>
          <Download size={13} /> Exportar planilha para fornecedor
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ background: C.navy, color: C.paper }}>
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {importing ? "Importando..." : "Importar cotação preenchida"}
        </button>
        {importMsg && <span className="text-xs" style={{ color: C.green }}>{importMsg}</span>}
      </div>
      {importError && (
        <p className="text-xs mb-3 flex items-center gap-1" style={{ color: C.red }}><AlertCircle size={12} /> {importError}</p>
      )}

      {showExportForm && (
        <div className="flex items-end gap-2 mb-5 p-3 rounded-lg flex-wrap" style={{ background: C.paperDark }}>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Nome da empresa</span>
            <input value={exportNome} onChange={e => setExportNome(e.target.value)} placeholder="Ex.: Fornecedor XYZ Ltda"
              className="mt-1 px-2 py-1.5 rounded border text-sm bg-white" style={{ borderColor: C.border, width: "220px" }} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>CNPJ</span>
            <input value={exportCnpj} onChange={e => setExportCnpj(e.target.value)} placeholder="00.000.000/0000-00"
              className="mt-1 px-2 py-1.5 rounded border text-sm bg-white" style={{ borderColor: C.border, width: "160px" }} />
          </label>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: C.brass, color: C.navyDark }}>
            <Download size={13} /> Gerar planilha
          </button>
          <span className="text-xs w-full" style={{ color: C.inkMuted }}>
            Gera um .xlsx com a lista de itens e a coluna "Valor Unitário" em branco, pronta para enviar ao fornecedor.
          </span>
        </div>
      )}

      {itens.length === 0 ? (
        <p className="text-sm" style={{ color: C.inkMuted }}>Cadastre itens na etapa "1. Planilha de Itens" primeiro.</p>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: C.paperDark }}>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.inkMuted }}>Descrição</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-20" style={{ color: C.inkMuted }}>Qtd.</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-52" style={{ color: C.inkMuted }}>Cotações</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-32" style={{ color: C.inkMuted }}>Valor Adotado (R$)</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase w-28" style={{ color: C.inkMuted }}>Total do Item</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, idx) => {
                  const quotes = cotacoes[it.id] || [];
                  const s = statsFor(quotes);
                  const adotado = valoresAdotados[it.id] || "";
                  const temForaDoPadrao = quotes.some(q => forDoPadrao(q.valor, s.mediana));
                  return (
                    <tr key={it.id} className="border-t align-top" style={{ borderColor: C.border }}>
                      <td className="px-3 py-2">
                        <p className="text-sm" style={{ color: C.navy }}>{it.descricao || `Item ${idx + 1}`}</p>
                        {it.classificacao && <p className="text-[10px]" style={{ color: C.inkMuted }}>{it.classificacao}</p>}
                      </td>
                      <td className="px-2 py-2 text-xs" style={{ color: C.inkMuted }}>{it.quantidade || "?"} {it.unidade}</td>
                      <td className="px-2 py-2 text-xs" style={{ color: C.inkMuted }}>
                        <button onClick={() => abrirPopup(it.id)}
                          className="text-left px-2 py-1.5 rounded-md border w-full" style={{ borderColor: C.border }}>
                          {s.n > 0 ? (
                            <>
                              {s.n} cotação(ões) · {labelMetodologia === "média" ? "Média" : "Mediana"} <b style={{ color: C.navy }}>{brl(valorMetodologia(s))}</b>
                              {temForaDoPadrao && (
                                <span className="flex items-center gap-1 mt-0.5" style={{ color: C.red }}>
                                  <AlertCircle size={11} /> valor fora do padrão
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: C.brass }}>+ adicionar cotação</span>
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: C.border }}>
                          <span className="px-1.5 py-1.5 text-xs font-semibold shrink-0"
                            style={{ background: C.paperDark, color: C.inkMuted }}>R$</span>
                          <input value={adotado} onChange={e => setAdotado(it.id, e.target.value)}
                            placeholder="0,0000" className="w-full px-2 py-1.5 text-sm"
                            style={{ border: "none", outline: "none" }}
                            title="Aceita 1.234,56 · 1234,56 · 1234.56 · com ou sem R$" />
                        </div>
                        {s.n > 0 && (
                          <button onClick={() => setAdotado(it.id, formatarParaCampo(valorMetodologia(s)))}
                            className="text-[10px] mt-1" style={{ color: C.brass }}>usar {labelMetodologia}</button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs font-medium" style={{ color: C.navy }}>
                        {adotado ? brl(num(it.quantidade) * num(adotado)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 rounded-lg flex items-center justify-between" style={{ background: C.navy }}>
            <span className="text-sm" style={{ color: C.paper }}>Valor total estimado da contratação</span>
            <span className="serif text-lg font-bold" style={{ color: C.brassLight }}>{brl(totalGeral)}</span>
          </div>
        </>
      )}

      {itemAtivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.55)" }}
          onClick={() => setActiveItemId(null)}>
          <div onClick={e => e.stopPropagation()}
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b sticky top-0 bg-white rounded-t-xl" style={{ borderColor: C.border }}>
              <div>
                <h3 className="serif text-lg font-semibold" style={{ color: C.navy }}>Cotações do item</h3>
                <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>
                  {itemAtivo.descricao} · {itemAtivo.quantidade || "?"} {itemAtivo.unidade}
                </p>
              </div>
              <button onClick={() => setActiveItemId(null)} className="shrink-0" style={{ color: C.inkMuted }}><X size={18} /></button>
            </div>

            <div className="p-5">
              {statsAtivo.n > 0 && (
                <div className="flex items-center gap-4 text-xs mb-4 p-3 rounded-lg flex-wrap" style={{ background: C.paperDark, color: C.inkMuted }}>
                  <span className="font-semibold" style={{ color: C.navy }}>{statsAtivo.n} cotação(ões) registrada(s)</span>
                  <span>Média: <b style={{ color: C.navy }}>{brl(statsAtivo.media)}</b></span>
                  <span>Mediana: <b style={{ color: C.navy }}>{brl(statsAtivo.mediana)}</b></span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase" style={{ background: "rgba(166,131,46,0.15)", color: C.brass }}>
                    metodologia: {labelMetodologia}
                  </span>
                </div>
              )}

              <div className="mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Cotações registradas</span>
              </div>
              {quotesAtivo.length === 0 ? (
                <p className="text-sm mb-4" style={{ color: C.inkMuted }}>Nenhuma cotação registrada ainda — adicione a primeira abaixo.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {quotesAtivo.map(q => {
                    const flagged = forDoPadrao(q.valor, statsAtivo.mediana);
                    return (
                      <div key={q.id} className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: flagged ? C.red : C.border, background: flagged ? "rgba(166,64,61,0.05)" : "white" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: C.navy }}>
                            {q.fonte}{q.empresa ? ` — ${q.empresa}` : ""}
                          </p>
                          {flagged && (
                            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: C.red }}>
                              <AlertCircle size={11} className="shrink-0" />
                              Fora da margem de {margem}% em torno da mediana — considere revisar ou excluir.
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-semibold shrink-0" style={{ color: C.navy }}>{brl(num(q.valor))}</span>
                        <button onClick={() => removeQuote(itemAtivo.id, q.id)} title="Remover cotação" className="shrink-0" style={{ color: C.red }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3.5 rounded-lg border-2 border-dashed mb-4" style={{ borderColor: C.border }}>
                <span className="text-xs font-semibold uppercase tracking-wide mb-2 block" style={{ color: C.inkMuted }}>Nova cotação</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <input list="fontes-cotacao-datalist" value={novaFonte} onChange={e => setNovaFonte(e.target.value)}
                    placeholder="Fonte" className="px-2 py-2 rounded-lg border text-sm" style={{ borderColor: C.border, width: "150px" }} />
                  <input value={novaEmpresa} onChange={e => setNovaEmpresa(e.target.value)}
                    placeholder="Fornecedor (opcional)" className="px-2 py-2 rounded-lg border text-sm flex-1 min-w-[130px]" style={{ borderColor: C.border }} />
                  <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
                    <span className="px-2 py-2 text-xs font-semibold shrink-0"
                      style={{ background: C.paperDark, color: C.inkMuted }}>R$</span>
                    <input value={novoValor} onChange={e => setNovoValor(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && salvarNovaCotacao()}
                      placeholder="0,0000" className="px-2 py-2 text-sm w-24"
                      style={{ border: "none", outline: "none" }}
                      title="Aceita 1.234,56 · 1234,56 · 1234.56 · com ou sem R$" />
                  </div>
                  <button onClick={salvarNovaCotacao} disabled={!novoValor.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: C.navy, color: C.paper }}>
                    <Check size={14} /> Salvar cotação
                  </button>
                </div>
              </div>
              <datalist id="fontes-cotacao-datalist">
                {fontesConhecidas.map(f => <option key={f} value={f} />)}
              </datalist>

              <div className="flex items-center gap-2 flex-wrap mb-3 p-2.5 rounded-lg text-xs" style={{ background: C.paperDark, color: C.inkMuted }}>
                <Info size={13} className="shrink-0" style={{ color: C.brass }} />
                <span>Margem de aceitação em torno da mediana:</span>
                <input type="number" min="0" value={margem}
                  onChange={e => setMargem(Math.max(0, Number(e.target.value) || 0))}
                  className="w-14 px-1.5 py-1 rounded border text-xs text-center bg-white" style={{ borderColor: C.border }} />
                <span>%. Cotações fora dessa faixa ficam sinalizadas — a exclusão é sempre uma escolha sua.</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t flex-wrap" style={{ borderColor: C.border }}>
                <span className="text-xs font-medium" style={{ color: C.inkMuted }}>Valor unitário adotado:</span>
                <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: C.border }}>
                  <span className="px-2 py-1.5 text-xs font-semibold shrink-0"
                    style={{ background: C.paperDark, color: C.inkMuted }}>R$</span>
                  <input value={adotadoAtivo} onChange={e => setAdotado(itemAtivo.id, e.target.value)}
                    placeholder="0,0000" className="w-28 px-2 py-1.5 text-sm"
                    style={{ border: "none", outline: "none" }}
                    title="Aceita 1.234,56 · 1234,56 · 1234.56 · com ou sem R$" />
                </div>
                {statsAtivo.n > 0 && (
                  <button onClick={() => setAdotado(itemAtivo.id, formatarParaCampo(valorMetodologia(statsAtivo)))}
                    className="text-xs font-medium" style={{ color: C.brass }}>usar {labelMetodologia}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Responsáveis técnicos (múltiplos, com diretório salvo entre ETPs) ----------
export function ResponsaveisManager({ responsaveis, onChange }) {
  const [diretorio, setDiretorio] = useState([]); // [{nome, cargo}] — pessoas já usadas em qualquer ETP
  const [novoNome, setNovoNome] = useState("");
  const [novoCargo, setNovoCargo] = useState("");

  useEffect(() => {
    storage.get("diretorio:responsaveis", false)
      .then(r => setDiretorio(r?.value ? JSON.parse(r.value) : []))
      .catch(() => setDiretorio([]));
  }, []);

  function salvarNoDiretorio(nome, cargo) {
    setDiretorio(prev => {
      const semDuplicata = prev.filter(p => p.nome.toLowerCase() !== nome.toLowerCase());
      const atualizado = [...semDuplicata, { nome, cargo }];
      storage.set("diretorio:responsaveis", JSON.stringify(atualizado), false).catch(() => {});
      return atualizado;
    });
  }

  function preencherPeloDiretorio(nome) {
    const encontrado = diretorio.find(p => p.nome === nome);
    if (encontrado) setNovoCargo(encontrado.cargo || "");
  }

  function adicionar() {
    if (!novoNome.trim()) return;
    const novo = { id: "resp_" + Math.random().toString(36).slice(2, 8), nome: novoNome.trim(), cargo: novoCargo.trim() };
    onChange([...(responsaveis || []), novo]);
    salvarNoDiretorio(novo.nome, novo.cargo);
    setNovoNome("");
    setNovoCargo("");
  }

  function remover(id) {
    onChange((responsaveis || []).filter(r => r.id !== id));
  }

  return (
    <div className="mb-4 p-3.5 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
      <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
        Responsáveis técnicos (assinatura)
      </span>

      {(!responsaveis || responsaveis.length === 0) ? (
        <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
          Nenhum responsável adicionado ainda. Pode incluir mais de um — todos assinam o documento final.
        </p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {responsaveis.map(r => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: C.border, background: "white" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{r.nome}</p>
                {r.cargo && <p className="text-xs truncate" style={{ color: C.inkMuted }}>{r.cargo}</p>}
              </div>
              <button onClick={() => remover(r.id)} className="shrink-0" style={{ color: C.red }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input list="diretorio-nomes" value={novoNome}
          onChange={e => { setNovoNome(e.target.value); preencherPeloDiretorio(e.target.value); }}
          placeholder="Nome do responsável" className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
        <input list="diretorio-cargos" value={novoCargo} onChange={e => setNovoCargo(e.target.value)}
          placeholder="Cargo (opcional)" className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
        <button onClick={adicionar} disabled={!novoNome.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: C.navy, color: C.paper }}>
          <Plus size={13} /> Adicionar
        </button>
      </div>
      <datalist id="diretorio-nomes">
        {diretorio.map(p => <option key={p.nome} value={p.nome} />)}
      </datalist>
      <datalist id="diretorio-cargos">
        {[...new Set(diretorio.map(p => p.cargo).filter(Boolean))].map(c => <option key={c} value={c} />)}
      </datalist>
      <p className="text-[10px] mt-2" style={{ color: C.inkMuted }}>
        Nomes já usados em qualquer ETP aparecem como sugestão automática — fica salvo neste navegador, entre ETPs.
      </p>
    </div>
  );
}

// ---------- Soluções de mercado pesquisadas (inciso IV) ----------
export function SolucoesMercadoManager({ solucoes, onChange }) {
  const [novaSolucao, setNovaSolucao] = useState("");

  function adicionar() {
    if (!novaSolucao.trim()) return;
    onChange([...solucoes, { id: "sol_" + Math.random().toString(36).slice(2, 8), nome: novaSolucao.trim(), selecionada: solucoes.length === 0 }]);
    setNovaSolucao("");
  }
  function remover(id) {
    onChange(solucoes.filter(s => s.id !== id));
  }
  function selecionar(id) {
    onChange(solucoes.map(s => ({ ...s, selecionada: s.id === id })));
  }

  return (
    <div className="mb-4 p-3.5 rounded-lg border" style={{ borderColor: C.border, background: C.paperDark }}>
      <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
        Soluções de mercado pesquisadas
      </span>

      {solucoes.length === 0 ? (
        <p className="text-xs mb-2" style={{ color: C.inkMuted }}>
          Nenhuma solução cadastrada ainda. Adicione todas as opções encontradas na pesquisa (podem ser 3, 4, 5 ou mais) e marque a escolhida.
        </p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {solucoes.map(s => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: s.selecionada ? C.brass : C.border, background: "white" }}>
              <span className="text-sm flex-1">{s.nome}</span>
              {s.selecionada ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: "rgba(166,131,46,0.15)", color: C.brass }}>
                  <Check size={12} /> Escolhida
                </span>
              ) : (
                <button onClick={() => selecionar(s.id)}
                  className="text-xs font-medium px-2 py-1 rounded-full shrink-0" style={{ color: C.navy, border: `1px solid ${C.border}` }}>
                  Selecionar esta
                </button>
              )}
              <button onClick={() => remover(s.id)} className="shrink-0" style={{ color: C.red }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input value={novaSolucao} onChange={e => setNovaSolucao(e.target.value)}
          onKeyDown={e => e.key === "Enter" && adicionar()}
          placeholder="Ex.: Aquisição direta de equipamento novo"
          className="flex-1 px-2 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }} />
        <button onClick={adicionar} disabled={!novaSolucao.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
          style={{ background: C.navy, color: C.paper }}>
          <Plus size={13} /> Adicionar
        </button>
      </div>
      <p className="text-[10px] mt-2" style={{ color: C.inkMuted }}>
        Essas opções entram automaticamente no "Usar modelo padrão" abaixo, junto com a que foi escolhida.
      </p>
    </div>
  );
}
