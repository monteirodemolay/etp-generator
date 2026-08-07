/**
 * Portal do lote — acessado por link, sem login, quando várias OFs da
 * mesma empresa foram disparadas juntas num único e-mail.
 *
 * Um clique confirma todas de uma vez (cada uma ganhando seu próprio
 * recibo e chave de autenticidade, por trás) — depois, cada OF continua
 * sendo controlada individualmente, com seu link próprio pro comprovante
 * completo e pra reportar alguma divergência específica.
 */

import React, { useState, useEffect } from "react";
import { buscarOfsPorLote, confirmarRecebimentoLote } from "../../of-servico.js";
import { calcularSituacao } from "../../dominio/of.js";

const C = {
  navy: "#1C2E4A", paper: "#FAF7F0", brass: "#A6832E",
  ink: "#111827", inkMuted: "#6B7280", border: "#e5e7eb",
  red: "#dc3545", green: "#0f5132",
};

export function PortalLote({ loteId }) {
  const [ofs, setOfs] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    buscarOfsPorLote(loteId)
      .then(lista => {
        if (lista.length === 0) setErro("Link inválido, ou este lote não existe mais.");
        setOfs(lista);
      })
      .catch(() => setErro("Não foi possível carregar este lote agora. Tente novamente em instantes."))
      .finally(() => setCarregando(false));
  }, [loteId]);

  async function handleConfirmarTudo() {
    setConfirmando(true);
    try {
      const atualizadas = await confirmarRecebimentoLote(ofs);
      setOfs(atualizadas);
    } catch (e) {
      setErro("Não foi possível confirmar agora: " + (e.message || e));
    }
    setConfirmando(false);
  }

  if (carregando) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: C.inkMuted }}>Carregando...</p>
      </div>
    );
  }

  if (erro && (!ofs || ofs.length === 0)) {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 480, textAlign: "center" }}>
          <p style={{ color: C.red }}>{erro}</p>
        </div>
      </div>
    );
  }

  const primeira = ofs[0];
  const todasConfirmadas = ofs.every(o => !!o.reciboImutavel);
  const algumasConfirmadas = ofs.some(o => !!o.reciboImutavel) && !todasConfirmadas;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 640, margin: "20px auto 60px", background: "#fff", borderRadius: 12, padding: "32px 36px", boxShadow: "0 4px 6px rgba(0,0,0,0.08)" }}>
        <p style={{ fontSize: 11, color: C.brass, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, margin: 0 }}>
          Portal do Fornecedor — Lote de Ordens de Fornecimento
        </p>
        <h1 style={{ margin: "6px 0 4px 0", color: C.navy, fontSize: 22 }}>{primeira.empresa}</h1>
        <p style={{ margin: "0 0 20px 0", color: C.inkMuted, fontSize: 13 }}>
          {ofs.length} Ordem(ns) de Fornecimento neste envio.
        </p>

        {erro && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{erro}</p>}

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
          {ofs.map((of_, i) => {
            const situacao = calcularSituacao(of_);
            return (
              <div key={of_.token} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                padding: "10px 14px", borderTop: i > 0 ? `1px solid ${C.border}` : "none",
              }}>
                <span style={{ fontSize: 14, color: C.ink }}><b>OF nº {of_.numeroOf}</b></span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: "bold", padding: "3px 10px", borderRadius: 999,
                    background: of_.reciboImutavel ? "#d1e7dd" : "#fff3cd",
                    color: of_.reciboImutavel ? C.green : "#664d03" }}>
                    {of_.reciboImutavel ? "Confirmada" : situacao.texto}
                  </span>
                  <a href={`${window.location.origin}${window.location.pathname}?of=${of_.token}`}
                    style={{ fontSize: 11, color: "#2563eb", whiteSpace: "nowrap" }}>
                    Ver esta OF
                  </a>
                </span>
              </div>
            );
          })}
        </div>

        {todasConfirmadas ? (
          <div style={{ background: "#d1e7dd", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: "bold", color: C.green }}>
              ✅ Recebimento confirmado para todas as {ofs.length} OF(s) deste lote.
            </p>
          </div>
        ) : (
          <>
            {algumasConfirmadas && (
              <p style={{ fontSize: 12, color: C.inkMuted, marginBottom: 10 }}>
                Algumas já foram confirmadas antes — só as pendentes serão confirmadas agora.
              </p>
            )}
            <button onClick={handleConfirmarTudo} disabled={confirmando}
              style={{ width: "100%", background: "#056535", color: "#fff", border: "none", padding: "12px 16px",
                borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              {confirmando ? "Confirmando..." : `✅ Confirmar recebimento de todas as ${ofs.length} OFs`}
            </button>
          </>
        )}

        <p style={{ fontSize: 12, color: C.inkMuted, marginTop: 20, textAlign: "center" }}>
          Precisa do comprovante completo de uma OF específica, baixar o PDF, ou relatar uma divergência? Clique
          em "Ver esta OF" na linha correspondente, acima.
        </p>
      </div>
    </div>
  );
}
