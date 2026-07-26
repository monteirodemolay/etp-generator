/**
 * Dias Úteis — calendário de feriados e pontos facultativos, por município.
 *
 * Ainda em construção. Existe como aba desde já para que o menu não precise
 * ser reorganizado de novo quando o cadastro estiver pronto.
 */

import React, { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { C } from "../tokens.js";

export function DiasUteisView({ municipios = [] }) {
  const [municipioId, setMunicipioId] = useState(municipios[0]?.id || "");
  const municipioAtual = municipios.find(m => m.id === municipioId) || municipios[0];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 mb-1" style={{ color: C.brass }}>
            <CalendarDays size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Calendário</span>
          </div>
          <h2 className="serif text-xl font-semibold" style={{ color: C.navy }}>Dias Úteis</h2>
        </div>

        {municipios.length > 1 && (
          <label className="flex items-center gap-2">
            <MapPin size={13} style={{ color: C.inkMuted }} />
            <select value={municipioId} onChange={e => setMunicipioId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border text-sm bg-white" style={{ borderColor: C.border }}>
              {municipios.map(m => <option key={m.id} value={m.id}>{m.nome}{m.uf ? ` — ${m.uf}` : ""}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="text-center py-16 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
        <CalendarDays size={32} className="mx-auto mb-3" style={{ color: C.border }} />
        <p className="text-sm font-medium mb-1" style={{ color: C.navy }}>Em construção</p>
        <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: C.inkMuted }}>
          Aqui vai entrar o calendário de feriados nacionais (já pré-preenchidos, mas editáveis),
          feriados municipais e pontos facultativos — cada um específico
          {municipioAtual ? ` de ${municipioAtual.nome}` : " do município selecionado"}.
        </p>
      </div>
    </div>
  );
}
