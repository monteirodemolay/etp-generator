/**
 * Auditoria — log de eventos significativos praticados pela equipe.
 * Admin vê tudo; usuário padrão só vê os eventos das entidades atribuídas a
 * ele (o mesmo recorte já usado no resto do sistema).
 */

import React, { useState, useEffect } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { C } from "../tokens.js";
import { rotuloEvento } from "../../dominio/auditoria.js";
import { fmtDate } from "../../dominio/datas.js";
import { listarEventos } from "../../auditoria-servico.js";

const CORES_TIPO = {
  "documento.excluido": C.red, "documento.apagado_definitivo": C.red, "of.excluida": C.red,
  "usuario.excluido": C.red, "entidade.excluida": C.red, "of.entrega_desfeita": C.red,
  "documento.criado": C.green, "of.criada": C.green, "usuario.criado": C.green, "entidade.criada": C.green,
  "of.disparada": C.brass, "of.entrega_confirmada": C.brass, "of.notificacao_enviada": "#fd7e14",
};

export function Auditoria({ secretarias }) {
  const [eventos, setEventos] = useState(null); // null = carregando
  const [erro, setErro] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEntidade, setFiltroEntidade] = useState("");

  useEffect(() => {
    listarEventos()
      .then(setEventos)
      .catch(() => setErro("Não foi possível carregar o log de auditoria agora."));
  }, []);

  // "secretarias" aqui já chega filtrada pelo mesmo recorte usado no resto
  // do sistema: tudo, se for admin; só as atribuídas, se for usuário
  // padrão — não precisa de nenhuma regra nova aqui.
  const idsVisiveis = new Set(secretarias.map(s => s.id));
  const eventosVisiveis = (eventos || []).filter(e => !e.secretariaId || idsVisiveis.has(e.secretariaId));

  const eventosFiltrados = eventosVisiveis.filter(e =>
    (!filtroTipo || e.tipo === filtroTipo)
    && (!filtroEntidade || e.secretariaId === filtroEntidade)
  );

  const tiposPresentes = [...new Set(eventosVisiveis.map(e => e.tipo))];

  function nomeEntidade(id) {
    const s = secretarias.find(x => x.id === id);
    return s?.sigla || s?.nome || "—";
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
        <FileSearch size={15} />
        <span className="text-xs font-semibold tracking-widest uppercase">Compliance</span>
      </div>
      <h2 className="serif text-xl font-semibold mb-1" style={{ color: C.navy }}>Auditoria</h2>
      <p className="text-xs mb-5" style={{ color: C.inkMuted }}>
        Ações significativas praticadas pela equipe. Uma vez gravado, nenhum evento pode ser alterado
        ou apagado — nem pelo administrador.
      </p>

      {erro && <p className="text-xs mb-4" style={{ color: C.red }}>{erro}</p>}

      {eventos === null ? (
        <div className="flex items-center gap-2 py-10 justify-center" style={{ color: C.inkMuted }}>
          <Loader2 size={16} className="animate-spin" /> Carregando o log...
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              className="px-3 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
              <option value="">Todos os tipos de evento</option>
              {tiposPresentes.map(t => <option key={t} value={t}>{rotuloEvento(t)}</option>)}
            </select>
            {secretarias.length > 1 && (
              <select value={filtroEntidade} onChange={e => setFiltroEntidade(e.target.value)}
                className="px-3 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
                <option value="">Todas as entidades</option>
                {secretarias.map(s => <option key={s.id} value={s.id}>{s.sigla || s.nome}</option>)}
              </select>
            )}
          </div>

          {eventosFiltrados.length === 0 ? (
            <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
              <p className="text-sm" style={{ color: C.inkMuted }}>Nenhum evento registrado ainda.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.border, background: "white" }}>
              {eventosFiltrados.map((e, i) => (
                <div key={e.id} className="px-4 py-3 flex items-start gap-3"
                  style={{ borderTop: i > 0 ? `1px solid ${C.border}` : "none" }}>
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: CORES_TIPO[e.tipo] || C.inkMuted }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: C.ink }}>
                      <b style={{ color: C.navy }}>{e.usuarioEmail}</b> — {rotuloEvento(e.tipo)}
                      {e.alvo?.rotulo && <> · <span style={{ color: C.brass }}>{e.alvo.rotulo}</span></>}
                    </p>
                    {e.detalhes && <p className="text-xs mt-0.5" style={{ color: C.inkMuted }}>{e.detalhes}</p>}
                    <p className="text-[11px] mt-0.5" style={{ color: C.inkMuted }}>
                      {fmtDate(e.quando)}{e.secretariaId && ` · ${nomeEntidade(e.secretariaId)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
