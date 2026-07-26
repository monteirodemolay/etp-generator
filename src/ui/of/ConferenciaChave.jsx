/**
 * Conferência pública de autenticidade — qualquer pessoa pode colar a chave
 * de um recibo e verificar se é válida, sem precisar de login.
 */

import React, { useState, useEffect } from "react";
import { buscarReciboPorChave } from "../../of-servico.js";

const C = { ink: "#111827", inkMuted: "#6B7280", border: "#e5e7eb" };

export function ConferenciaChave({ chaveInicial }) {
  const [chave, setChave] = useState(chaveInicial || "");
  const [resultado, setResultado] = useState(null); // undefined = ainda não buscou; null = não achou; objeto = achou
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (chaveInicial) buscar(chaveInicial);
  }, [chaveInicial]);

  async function buscar(valor) {
    const alvo = (valor ?? chave).trim();
    if (!alvo) return;
    setBuscando(true);
    try {
      const r = await buscarReciboPorChave(alvo);
      setResultado(r || false);
    } catch {
      setResultado(false);
    }
    setBuscando(false);
  }

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 700, margin: "40px auto", background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <div style={{ borderBottom: `2px solid ${C.border}`, paddingBottom: 16, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 1 }}>
            Portal de Auditoria
          </span>
          <h1 style={{ margin: "8px 0 0 0", color: C.ink }}>Conferência de Chave de Recibo</h1>
        </div>

        <form onSubmit={e => { e.preventDefault(); buscar(); }} style={{ marginBottom: 24, display: "flex", gap: 8 }}>
          <input type="text" value={chave} onChange={e => setChave(e.target.value)}
            placeholder="Cole aqui a chave de autenticidade..." required
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc", fontFamily: "monospace" }} />
          <button type="submit" disabled={buscando}
            style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>
            {buscando ? "Buscando..." : "Verificar"}
          </button>
        </form>

        {resultado === null ? (
          <p style={{ color: C.inkMuted, textAlign: "center" }}>Insira uma chave acima para verificar a autenticidade.</p>
        ) : resultado === false ? (
          <div style={{ background: "#f8d7da", border: "1px solid #f5c2c7", color: "#842029", padding: 20, borderRadius: 8 }}>
            <h3 style={{ margin: "0 0 8px 0" }}>❌ Chave não encontrada</h3>
            <p style={{ margin: 0 }}>Nenhum recibo corresponde exatamente a esta chave.</p>
          </div>
        ) : resultado ? (
          <div style={{ background: "#d1e7dd", border: "1px solid #badbcc", color: "#0f5132", padding: 20, borderRadius: 8 }}>
            <h3 style={{ margin: "0 0 12px 0" }}>✅ Recibo válido e autêntico</h3>
            <p style={{ margin: "6px 0" }}><strong>Ordem de Fornecimento nº:</strong> {resultado.numeroOf}</p>
            <p style={{ margin: "6px 0" }}><strong>Empresa:</strong> {resultado.empresa}</p>
            <p style={{ margin: "6px 0" }}><strong>CNPJ:</strong> {resultado.cnpj || "-"}</p>
            <p style={{ margin: "6px 0" }}><strong>Data do aceite:</strong> {resultado.dataAceite}</p>
            <p style={{ margin: "6px 0" }}><strong>Prazo de entrega:</strong> {resultado.prazoDias} dia(s) (limite: {resultado.prazoLimite})</p>
            <div style={{ marginTop: 12, padding: 8, background: "#fff", borderRadius: 4, border: "1px dashed #0f5132", fontSize: 12, wordBreak: "break-all" }}>
              <strong>Chave registrada:</strong><br /><code>{resultado.reciboImutavel?.chave}</code>
            </div>
            {resultado.pdfBase64 && (
              <a href={resultado.pdfBase64} download={`OF-${resultado.numeroOf}.pdf`}
                style={{ display: "block", textAlign: "center", background: "#0f5132", color: "#fff", textDecoration: "none", padding: 10, borderRadius: 6, fontWeight: "bold", marginTop: 16 }}>
                📥 Baixar OF em PDF
              </a>
            )}
          </div>
        ) : null}

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <a href={window.location.origin + window.location.pathname} style={{ color: "#2563eb", textDecoration: "none", fontSize: 14 }}>
            ← Voltar à página inicial
          </a>
        </div>
      </div>
    </div>
  );
}
