/**
 * Relatórios de Ordens de Fornecimento — sintético (números agregados) e
 * analítico (linha a linha), com filtros combináveis (nenhum obrigatório) e
 * impressão/exportação com o timbre oficial da entidade filtrada.
 */

import React, { useState } from "react";
import { BarChart3, Printer, Filter } from "lucide-react";
import { C } from "../tokens.js";
import { filtrarOfsParaRelatorio, anosDisponiveis, montarSintese, montarAnalitico } from "../../dominio/relatorio-of.js";
import { GRUPOS_SITUACAO_OF } from "../../dominio/of.js";
import { fmtDate } from "../../dominio/datas.js";
import { resolverCabecalho, prepararCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";

const CORES_GRUPO = {
  "rascunho": C.inkMuted, "aguardando-fornecedor": C.brass, "aguardando-entrega": "#fd7e14",
  "entregues": C.green, "nao-entregues": C.red, "divergencias": "#b45309",
};

function grupoDaSituacaoLocal(chave) {
  if (chave === "rascunho") return "rascunho";
  if (chave === "aguardando" || chave === "sem-resposta") return "aguardando-fornecedor";
  if (chave === "aguardando-entrega" || chave === "aguardando-confirmacao" || chave === "vencido") return "aguardando-entrega";
  if (chave === "em-dia" || chave === "atrasado") return "entregues";
  if (chave === "nao-entregue") return "nao-entregues";
  if (chave === "divergencia") return "divergencias";
  return "rascunho";
}

function Barra({ label, valor, total, cor }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between text-xs mb-1">
        <span style={{ color: C.ink }}>{label}</span>
        <span style={{ color: C.inkMuted }}>{valor} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: C.paperDark }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  );
}

export function RelatoriosOf({ ofs, secretarias, fornecedores }) {
  const [modo, setModo] = useState("sintetico"); // "sintetico" | "analitico"
  const [ano, setAno] = useState("");
  const [secretariaId, setSecretariaId] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [grupoSituacao, setGrupoSituacao] = useState("");
  const [imprimindo, setImprimindo] = useState(false);

  const filtros = {
    ano: ano || undefined,
    secretariaId: secretariaId || undefined,
    cnpj: cnpj || undefined,
    grupoSituacao: grupoSituacao || undefined,
  };
  const filtradas = filtrarOfsParaRelatorio(ofs, filtros);
  const anos = anosDisponiveis(ofs);
  const sintese = montarSintese(filtradas);
  const analitico = montarAnalitico(filtradas);

  const nomeEntidade = secretarias.find(s => s.id === secretariaId);
  const nomeEmpresa = fornecedores.find(f => f.cnpj === cnpj)?.razaoSocial;
  const rotuloGrupo = GRUPOS_SITUACAO_OF.find(g => g.id === grupoSituacao)?.rotulo;

  function limparFiltros() {
    setAno(""); setSecretariaId(""); setCnpj(""); setGrupoSituacao("");
  }

  async function imprimir() {
    setImprimindo(true);
    const janela = window.open("", "_blank");
    janela.document.write("<p style='font-family:sans-serif;padding:40px;'>Preparando o relatório...</p>");

    const cabecalho = await prepararCabecalho(
      resolverCabecalho({ secretariaId: secretariaId || secretarias[0]?.id }, secretarias, TIMBRE_PADRAO)
    );
    const htmlCabecalho = cabecalho?.tipo === "imagem" && cabecalho.dataUrl
      ? `<img src="${cabecalho.dataUrl}" style="max-width:100%; max-height:90px; display:block; margin:0 auto 12px;" />`
      : cabecalho?.tipo === "texto" && cabecalho.html
        ? `<div style="text-align:center; margin-bottom:12px;">${cabecalho.html}</div>`
        : `<h2 style="text-align:center; margin-bottom:4px;">Prefeitura Municipal</h2>`;

    const filtrosAplicados = [
      ano && `Ano: ${ano}`,
      nomeEntidade && `Entidade: ${nomeEntidade.sigla || nomeEntidade.nome}`,
      nomeEmpresa && `Empresa: ${nomeEmpresa}`,
      rotuloGrupo && `Status: ${rotuloGrupo}`,
    ].filter(Boolean).join(" · ") || "Nenhum filtro aplicado — todas as Ordens de Fornecimento";

    const corpoSintetico = `
      <div class="box">
        <h3>Resumo</h3>
        <p><b>Total de Ordens de Fornecimento:</b> ${sintese.total}</p>
        ${GRUPOS_SITUACAO_OF.filter(g => g.id !== "todas").map(g => `<p>${g.rotulo}: <b>${sintese.porGrupo[g.id] || 0}</b></p>`).join("")}
        ${sintese.percentualNoPrazo !== null ? `<p><b>Entregas no prazo:</b> ${sintese.percentualNoPrazo}% (${sintese.entreguesNoPrazo} de ${sintese.entreguesNoPrazo + sintese.entreguesForaDoPrazo})</p>` : ""}
        ${sintese.tempoMedioConfirmacaoDias !== null ? `<p><b>Tempo médio até o fornecedor confirmar:</b> ${sintese.tempoMedioConfirmacaoDias} dia(s)</p>` : ""}
      </div>
    `;

    const corpoAnalitico = `
      <table>
        <thead><tr><th>Nº OF</th><th>Empresa</th><th>CNPJ</th><th>Emitida em</th><th>Situação</th></tr></thead>
        <tbody>
          ${analitico.map(({ of: o, situacao }) => `
            <tr>
              <td>${o.numeroOf}</td>
              <td>${o.empresa || "-"}</td>
              <td>${o.cnpj || "-"}</td>
              <td>${fmtDate(o.createdAt)}</td>
              <td>${situacao.texto}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    janela.document.open();
    janela.document.write(`
      <html><head><title>Relatório de Ordens de Fornecimento</title>
      <style>
        body{font-family:sans-serif;padding:40px;color:#111;max-width:760px;margin:0 auto}
        .cabecalho{border-bottom:2px solid #1C2E4A;padding-bottom:16px;margin-bottom:20px}
        h3{color:#1C2E4A;font-size:14px;border-bottom:1px solid #DAD3C2;padding-bottom:6px}
        .box{background:#F1ECDF;border:1px solid #DAD3C2;padding:16px;border-radius:8px;margin-bottom:16px}
        .filtros{font-size:12px;color:#6B675E;margin-bottom:20px;font-style:italic}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
        th{background:#F1ECDF;text-align:left;padding:8px;border-bottom:2px solid #DAD3C2}
        td{padding:8px;border-bottom:1px solid #DAD3C2}
        .rodape{font-size:11px;color:#6B675E;text-align:center;margin-top:24px}
      </style>
      </head><body>
      <div class="cabecalho">
        ${htmlCabecalho}
        <h2 style="text-align:center;margin:8px 0 0;">Relatório de Ordens de Fornecimento</h2>
        <p style="text-align:center;font-size:12px;color:#6B675E;margin:4px 0 0;">
          ${modo === "sintetico" ? "Relatório Sintético" : "Relatório Analítico"} — gerado em ${fmtDate(Date.now())}
        </p>
      </div>
      <p class="filtros"><b>Filtros:</b> ${filtrosAplicados}</p>
      ${modo === "sintetico" ? corpoSintetico : corpoAnalitico}
      <p class="rodape">Documento gerado eletronicamente pelo Gerador de ETP.</p>
      </body></html>`);
    janela.document.close();
    janela.print();
    setImprimindo(false);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <BarChart3 size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Ordens de Fornecimento</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Relatórios</h1>
        </div>
        <button onClick={imprimir} disabled={imprimindo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          style={{ background: C.navy, color: C.paper }}>
          <Printer size={15} /> {imprimindo ? "Preparando..." : "Imprimir / Exportar PDF"}
        </button>
      </div>

      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: C.border }}>
        {[["sintetico", "Sintético"], ["analitico", "Analítico"]].map(([id, rotulo]) => (
          <button key={id} onClick={() => setModo(id)}
            className="px-4 py-2 text-sm font-medium -mb-px border-b-2"
            style={{ borderColor: modo === id ? C.brass : "transparent", color: modo === id ? C.navy : C.inkMuted }}>
            {rotulo}
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-4 mb-6" style={{ borderColor: C.border, background: "white" }}>
        <div className="flex items-center gap-1.5 mb-3" style={{ color: C.inkMuted }}>
          <Filter size={13} /> <span className="text-xs font-semibold uppercase tracking-wide">Filtros (opcionais)</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select value={ano} onChange={e => setAno(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
            <option value="">Todos os anos</option>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={secretariaId} onChange={e => setSecretariaId(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
            <option value="">Todas as entidades</option>
            {secretarias.map(s => <option key={s.id} value={s.id}>{s.sigla || s.nome}</option>)}
          </select>

          <select value={cnpj} onChange={e => setCnpj(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
            <option value="">Todas as empresas</option>
            {fornecedores.map(f => <option key={f.id} value={f.cnpj}>{f.razaoSocial || f.cnpj}</option>)}
          </select>

          <select value={grupoSituacao} onChange={e => setGrupoSituacao(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
            <option value="">Todos os status</option>
            {GRUPOS_SITUACAO_OF.filter(g => g.id !== "todas").map(g => <option key={g.id} value={g.id}>{g.rotulo}</option>)}
          </select>
        </div>
        {(ano || secretariaId || cnpj || grupoSituacao) && (
          <button onClick={limparFiltros} className="mt-3 text-xs font-medium underline" style={{ color: C.brass }}>
            Limpar filtros
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <p className="text-sm" style={{ color: C.inkMuted }}>Nenhuma Ordem de Fornecimento encontrada para estes filtros.</p>
        </div>
      ) : modo === "sintetico" ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
            <p className="serif text-3xl font-semibold mb-1" style={{ color: C.navy }}>{sintese.total}</p>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>Ordens de Fornecimento no total</p>

            {GRUPOS_SITUACAO_OF.filter(g => g.id !== "todas").map(g => (
              <Barra key={g.id} label={g.rotulo} valor={sintese.porGrupo[g.id] || 0} total={sintese.total} cor={CORES_GRUPO[g.id]} />
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.inkMuted }}>Desempenho de entrega</p>
              {sintese.percentualNoPrazo === null ? (
                <p className="text-xs" style={{ color: C.inkMuted }}>Ainda não há entregas confirmadas para calcular.</p>
              ) : (
                <>
                  <p className="serif text-3xl font-semibold mb-1" style={{ color: sintese.percentualNoPrazo >= 80 ? C.green : sintese.percentualNoPrazo >= 50 ? "#fd7e14" : C.red }}>
                    {sintese.percentualNoPrazo}%
                  </p>
                  <p className="text-xs mb-3" style={{ color: C.inkMuted }}>
                    entregues no prazo ({sintese.entreguesNoPrazo} de {sintese.entreguesNoPrazo + sintese.entreguesForaDoPrazo})
                  </p>
                </>
              )}
              {sintese.tempoMedioConfirmacaoDias !== null && (
                <p className="text-xs mt-2" style={{ color: C.ink }}>
                  Tempo médio até o fornecedor confirmar: <b>{sintese.tempoMedioConfirmacaoDias} dia(s)</b>
                </p>
              )}
            </div>

            <div className="rounded-xl border p-5" style={{ borderColor: C.border, background: "white" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.inkMuted }}>Por mês</p>
              {sintese.porMes.map(({ mes, qtd }) => (
                <Barra key={mes} label={mes} valor={qtd} total={sintese.total} cor={C.brass} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto etp-scroll" style={{ borderColor: C.border, background: "white" }}>
          <table className="w-full text-sm" style={{ minWidth: "680px" }}>
            <thead>
              <tr style={{ background: C.paperDark }}>
                {["Nº OF", "Empresa", "CNPJ", "Emitida em", "Situação"].map(t => (
                  <th key={t} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analitico.map(({ of: o, situacao }) => (
                <tr key={o.token} className="border-t" style={{ borderColor: C.border }}>
                  <td className="px-3 py-2.5 font-medium" style={{ color: C.navy }}>{o.numeroOf}</td>
                  <td className="px-3 py-2.5">{o.empresa || "-"}</td>
                  <td className="px-3 py-2.5" style={{ color: C.inkMuted }}>{o.cnpj || "-"}</td>
                  <td className="px-3 py-2.5" style={{ color: C.inkMuted }}>{fmtDate(o.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${CORES_GRUPO[grupoDaSituacaoLocal(situacao.chave)]}22`, color: CORES_GRUPO[grupoDaSituacaoLocal(situacao.chave)] }}>
                      {situacao.texto}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
