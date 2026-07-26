/**
 * Dias Úteis — calendário de feriados e pontos facultativos, por município.
 *
 * Feriados nacionais vêm pré-calculados (inclusive os móveis, a partir da
 * Páscoa), mas editáveis: cada município decide se observa ou não, e cada
 * um tem sua própria cópia — desmarcar o Carnaval aqui não afeta nenhum
 * outro município. Feriados municipais e pontos facultativos são cadastro
 * manual, com a pergunta automática de "emendar" quando cai numa terça ou
 * quinta.
 */

import React, { useState } from "react";
import { CalendarDays, MapPin, Plus, Trash2, Info, Link2 } from "lucide-react";
import { C } from "../tokens.js";
import { ConfirmarExclusao } from "../comuns/index.jsx";
import { diaDaEmenda, criarEmenda, emptyFeriado } from "../../dominio/dias-uteis.js";
import { fmtDateISO } from "../../dominio/datas.js";

const NOMES_DIA_SEMANA = { 1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta" };

function diaDaSemana(dataISO) {
  const [a, m, d] = dataISO.split("-").map(Number);
  return new Date(a, m - 1, d).getDay();
}

export function DiasUteisView({ municipios = [], feriados = [], onSalvar, onExcluir }) {
  const [municipioId, setMunicipioId] = useState(municipios[0]?.id || "");
  const [formAberto, setFormAberto] = useState(false);
  const [novaData, setNovaData] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaObs, setNovaObs] = useState("");
  const [novoSemExpediente, setNovoSemExpediente] = useState(true);
  const [perguntaEmenda, setPerguntaEmenda] = useState(null); // feriado recém-criado, aguardando resposta
  const [aExcluir, setAExcluir] = useState(null);

  const municipioAtual = municipios.find(m => m.id === municipioId) || municipios[0];
  const doMunicipio = feriados.filter(f => (f.municipioId || municipios[0]?.id) === municipioAtual?.id);
  const nacionais = doMunicipio.filter(f => f.tipo === "nacional").sort((a, b) => a.data.localeCompare(b.data));
  const municipais = doMunicipio.filter(f => f.tipo !== "nacional").sort((a, b) => a.data.localeCompare(b.data));

  function limparForm() {
    setNovaData(""); setNovoNome(""); setNovaObs(""); setNovoSemExpediente(true); setFormAberto(false);
  }

  function criarFeriado() {
    if (!novaData || !novoNome.trim()) return;
    const feriado = emptyFeriado({
      data: novaData, nome: novoNome.trim(), observacao: novaObs.trim(),
      municipioId: municipioAtual.id, tipo: "municipal", semExpediente: novoSemExpediente,
    });
    onSalvar(feriado);
    limparForm();

    const dataEmenda = diaDaEmenda(novaData);
    if (dataEmenda) setPerguntaEmenda(feriado);
  }

  function confirmarEmenda(sim) {
    if (sim) {
      const emenda = criarEmenda(perguntaEmenda);
      if (emenda) onSalvar(emenda);
    }
    setPerguntaEmenda(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 mb-1" style={{ color: C.brass }}>
            <CalendarDays size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Calendário</span>
          </div>
          <h2 className="serif text-xl font-semibold" style={{ color: C.navy }}>Dias Úteis</h2>
        </div>

        <div className="flex items-center gap-2">
          {municipios.length > 1 && (
            <label className="flex items-center gap-2">
              <MapPin size={13} style={{ color: C.inkMuted }} />
              <select value={municipioId} onChange={e => setMunicipioId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
                {municipios.map(m => <option key={m.id} value={m.id}>{m.nome}{m.uf ? ` — ${m.uf}` : ""}</option>)}
              </select>
            </label>
          )}
          <button onClick={() => setFormAberto(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: C.navy, color: C.paper }}>
            <Plus size={14} /> Novo feriado
          </button>
        </div>
      </div>

      <p className="text-xs mb-6" style={{ color: C.inkMuted }}>
        Cadastrar uma data aqui não faz o prazo mudar sozinho — só quando a caixa
        "não haverá expediente" estiver marcada é que ela conta como dia fechado.
      </p>

      {/* ---------- Feriados nacionais ---------- */}
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkMuted }}>
        Feriados nacionais {municipioAtual ? `— ${municipioAtual.nome}` : ""}
      </h3>
      <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: C.border, background: "white" }}>
        {nacionais.length === 0 ? (
          <p className="text-xs p-4" style={{ color: C.inkMuted }}>Nenhum feriado nacional gerado ainda para este município.</p>
        ) : nacionais.map((f, i) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap"
            style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
            <span className="text-xs font-mono shrink-0" style={{ color: C.inkMuted, width: "80px" }}>
              {fmtDateISO(f.data)}
            </span>
            <span className="text-sm flex-1 min-w-[160px]" style={{ color: f.ativo ? C.ink : C.inkMuted }}>
              {f.nome}
            </span>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: C.inkMuted }}>
              <input type="checkbox" checked={f.ativo} onChange={e => onSalvar({ ...f, ativo: e.target.checked })} />
              Observado aqui
            </label>
            {f.ativo && (
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: C.inkMuted }}>
                <input type="checkbox" checked={f.semExpediente}
                  onChange={e => onSalvar({ ...f, semExpediente: e.target.checked })} />
                Sem expediente
              </label>
            )}
          </div>
        ))}
      </div>

      {/* ---------- Feriados municipais e pontos facultativos ---------- */}
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkMuted }}>
        Feriados municipais e pontos facultativos
      </h3>
      {municipais.length === 0 ? (
        <div className="text-center py-10 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <p className="text-xs" style={{ color: C.inkMuted }}>Nenhum cadastrado ainda para este município.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
          {municipais.map((f, i) => (
            <div key={f.id} className="px-4 py-3" style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono shrink-0" style={{ color: C.inkMuted, width: "80px" }}>
                  {fmtDateISO(f.data)} <span className="opacity-60">({NOMES_DIA_SEMANA[diaDaSemana(f.data)] || "-"})</span>
                </span>
                <span className="text-sm flex-1 min-w-[160px]" style={{ color: C.ink }}>
                  {f.emendaDe && <Link2 size={11} className="inline mr-1" style={{ color: C.brass }} />}
                  {f.nome}
                </span>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: C.inkMuted }}>
                  <input type="checkbox" checked={f.semExpediente}
                    onChange={e => onSalvar({ ...f, semExpediente: e.target.checked })} />
                  Sem expediente
                </label>
                <button onClick={() => setAExcluir(f)} style={{ color: C.red }} title="Excluir">
                  <Trash2 size={13} />
                </button>
              </div>
              <label className="block mt-2">
                <input value={f.observacao || ""} onChange={e => onSalvar({ ...f, observacao: e.target.value })}
                  placeholder="Observação (ex.: Decreto nº..., ou qualquer anotação)"
                  className="w-full px-2.5 py-1.5 rounded-lg border text-xs" style={{ borderColor: C.border, color: C.inkMuted }} />
              </label>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Novo feriado ---------- */}
      {formAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <h3 className="serif text-lg font-semibold mb-4" style={{ color: C.navy }}>Novo feriado</h3>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Data</span>
              <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Nome</span>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                placeholder="Ex.: Aniversário da Cidade"
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Observação (opcional)
              </span>
              <input value={novaObs} onChange={e => setNovaObs(e.target.value)}
                placeholder="Ex.: Decreto nº.../2026, ou qualquer anotação"
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={novoSemExpediente} onChange={e => setNovoSemExpediente(e.target.checked)} />
              <span className="text-sm" style={{ color: C.ink }}>Confirma que não haverá expediente neste dia</span>
            </label>
            <p className="text-[11px] mb-4 -mt-2" style={{ color: C.inkMuted }}>
              Sem essa confirmação, a data fica registrada mas não afeta prazo nem aviso ao fornecedor.
            </p>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={limparForm}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="button" onClick={criarFeriado}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Pergunta de emenda ---------- */}
      {perguntaEmenda && (() => {
        const dataEmenda = diaDaEmenda(perguntaEmenda.data);
        const diaSemana = diaDaSemana(perguntaEmenda.data) === 2 ? "terça" : "quinta";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
            <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-6 text-center">
              <Info size={22} className="mx-auto mb-3" style={{ color: C.brass }} />
              <p className="text-sm mb-4" style={{ color: C.ink }}>
                <strong>{perguntaEmenda.nome}</strong> cai numa {diaSemana}-feira ({fmtDateISO(perguntaEmenda.data)}).
                Deseja emendar {diaSemana === "terça" ? "a segunda-feira anterior" : "a sexta-feira seguinte"} ({fmtDateISO(dataEmenda)})
                como ponto facultativo?
              </p>
              <div className="flex justify-center gap-2">
                <button onClick={() => confirmarEmenda(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                  Não
                </button>
                <button onClick={() => confirmarEmenda(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                  Sim, emendar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Excluir este feriado?"
          descricao={`"${aExcluir.nome}" (${fmtDateISO(aExcluir.data)}) será removido do calendário.`}
          onConfirmar={() => { onExcluir(aExcluir.id); setAExcluir(null); }}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  );
}
