/**
 * Íntegra da notificação — tela pública, sem login, aberta pelo link enviado
 * por e-mail ou WhatsApp. Mostra o texto completo daquela notificação
 * específica (uma OF pode ter várias, o parâmetro "n" diz qual).
 */

import React, { useState, useEffect } from "react";
import { buscarOfPorToken } from "../../of-servico.js";

const C = { ink: "#111827", inkMuted: "#6B7280", border: "#e5e7eb", red: "#842029" };

export function NotificacaoOf({ token, numero }) {
  const [of, setOf] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    buscarOfPorToken(token)
      .then(r => { if (!r) setErro("Link inválido, ou esta Ordem de Fornecimento não existe mais."); setOf(r); })
      .catch(() => setErro("Não foi possível carregar agora. Tente novamente em instantes."))
      .finally(() => setCarregando(false));
  }, [token]);

  const notificacao = of?.notificacoes?.find(n => String(n.numero) === String(numero));

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 700, margin: "40px auto", background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <div style={{ borderBottom: `2px solid ${C.border}`, paddingBottom: 16, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 1 }}>Notificação Oficial</span>
          <h1 style={{ margin: "8px 0 0 0", color: C.ink }}>
            {of ? `Ordem de Fornecimento nº ${of.numeroOf}` : "Carregando..."}
          </h1>
        </div>

        {carregando && <p style={{ color: C.inkMuted, textAlign: "center" }}>Carregando...</p>}
        {erro && <p style={{ background: "#f8d7da", color: C.red, padding: 14, borderRadius: 8, fontSize: 14 }}>{erro}</p>}

        {of && !notificacao && !erro && (
          <p style={{ background: "#f8d7da", color: C.red, padding: 14, borderRadius: 8, fontSize: 14 }}>
            Esta notificação específica não foi encontrada.
          </p>
        )}

        {notificacao && (
          <>
            <div style={{ background: "#fff3cd", border: "1px solid #ffecb5", color: "#664d03", padding: 14, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
              ⚠️ Notificação nº {notificacao.numero} — enviada em {new Date(notificacao.enviadaEm).toLocaleString("pt-BR")}
            </div>

            <div style={{ background: "#f8f9fa", border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: C.ink }}>
              {notificacao.textoCompleto}
            </div>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <a href={window.location.origin + window.location.pathname} style={{ color: "#2563eb", textDecoration: "none", fontSize: 14 }}>
            ← Voltar à página inicial
          </a>
        </div>
      </div>
    </div>
  );
}
