/**
 * Portal do fornecedor — acessado por link, sem login.
 *
 * O fornecedor confirma o recebimento da OF ou relata uma divergência. Ao
 * confirmar, um recibo com chave de autenticidade é gerado, e o PDF (se
 * houver) e o comprovante ficam liberados para download.
 */

import React, { useState, useEffect } from "react";
import { buscarOfPorToken, confirmarRecebimento, reportarDivergencia } from "../../of-servico.js";
import { fmtDateISO } from "../../dominio/datas.js";
import { gerarQrCodeDataUrl } from "../../qrcode-servico.js";

const C = {
  navy: "#1C2E4A", paper: "#FAF7F0", brass: "#A6832E",
  ink: "#111827", inkMuted: "#6B7280", border: "#e5e7eb",
  red: "#dc3545", green: "#0f5132",
};

export function PortalFornecedor({ token }) {
  const [of, setOf] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [divergencia, setDivergencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    buscarOfPorToken(token)
      .then(r => { if (!r) setErro("Link inválido, ou esta Ordem de Fornecimento não existe mais."); setOf(r); })
      .catch(() => setErro("Não foi possível carregar esta Ordem de Fornecimento agora. Tente novamente em instantes."))
      .finally(() => setCarregando(false));
  }, [token]);

  // Gera o QR Code do link de conferência assim que o recibo existir —
  // útil pra quem quiser guardar ou imprimir o comprovante direto daqui.
  useEffect(() => {
    if (!of?.reciboImutavel?.chave) { setQrCode(null); return; }
    const link = `${window.location.origin}${window.location.pathname}?recibo=${of.reciboImutavel.chave}`;
    gerarQrCodeDataUrl(link).then(setQrCode).catch(() => setQrCode(null));
  }, [of?.reciboImutavel?.chave]);

  async function handleConfirmar() {
    setConfirmando(true);
    try {
      const atualizado = await confirmarRecebimento(token, of);
      setOf(atualizado);
    } catch (e) {
      setErro("Não foi possível confirmar agora: " + (e.message || e));
    }
    setConfirmando(false);
  }

  async function handleDivergencia() {
    if (!divergencia.trim()) { setErro("Descreva o motivo da divergência antes de enviar."); return; }
    setEnviando(true);
    try {
      await reportarDivergencia(token, divergencia.trim());
      setOf({ ...of, status: "Divergência", motivoDivergencia: divergencia.trim() });
    } catch (e) {
      setErro("Não foi possível registrar agora: " + (e.message || e));
    }
    setEnviando(false);
  }

  const linkConferencia = of?.reciboImutavel?.chave
    ? `${window.location.origin}${window.location.pathname}?recibo=${of.reciboImutavel.chave}` : null;

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 700, margin: "40px auto", background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <div style={{ borderBottom: `2px solid ${C.border}`, paddingBottom: 16, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 1 }}>
            Portal do Fornecedor
          </span>
          <h1 style={{ margin: "8px 0 0 0", color: C.ink }}>
            {of ? `Ordem de Fornecimento nº ${of.numeroOf}` : "Ordem de Fornecimento"}
          </h1>
        </div>

        {carregando && <p>Carregando...</p>}
        {erro && !carregando && (
          <p style={{ background: "#f8d7da", color: "#842029", padding: 16, borderRadius: 8 }}>{erro}</p>
        )}

        {of && !carregando && (
          <>
            {of.reciboImutavel ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                <div style={{ background: "#d1e7dd", border: "1px solid #badbcc", color: C.green, padding: 20, borderRadius: 8 }}>
                  <h3 style={{ margin: "0 0 8px 0" }}>✅ Recebimento confirmado</h3>
                  <p style={{ margin: "4px 0" }}><strong>Confirmado em:</strong> {of.reciboImutavel.dataConfirmacao}</p>
                  <p style={{ margin: "4px 0" }}><strong>Prazo de entrega:</strong> {of.prazoDias} dia(s), até {of.prazoLimite}</p>
                  <div style={{ marginTop: 12, padding: 8, background: "#fff", borderRadius: 4, border: "1px dashed " + C.green, fontSize: 12, wordBreak: "break-all" }}>
                    <strong>Chave de autenticidade do recibo:</strong><br /><code>{of.reciboImutavel.chave}</code>
                  </div>
                  {qrCode && (
                    <div style={{ textAlign: "center", marginTop: 12 }}>
                      <img src={qrCode} alt="QR Code de conferência" style={{ width: 130, height: 130 }} />
                      <p style={{ fontSize: 11, color: C.inkMuted, marginTop: 4 }}>Aponte a câmera para conferir</p>
                    </div>
                  )}
                  {linkConferencia && (
                    <p style={{ marginTop: 8, fontSize: 12 }}>
                      <strong>Link para conferência pública:</strong><br />
                      <a href={linkConferencia} style={{ color: C.green }}>{linkConferencia}</a>
                    </p>
                  )}
                </div>
                {of.diasFechados?.length > 0 && (
                  <div style={{ background: "#fff3cd", border: "1px solid #ffecb5", color: "#664d03", padding: 16, borderRadius: 8 }}>
                    <p style={{ margin: "0 0 6px 0", fontWeight: "bold" }}>⚠️ Atenção ao prazo</p>
                    <p style={{ margin: "0 0 6px 0", fontSize: 13 }}>
                      Não haverá expediente {of.diasFechados.length > 1 ? "nestas datas, dentro do seu prazo" : "nesta data, dentro do seu prazo"}:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                      {of.diasFechados.map(d => (
                        <li key={d.id}>{fmtDateISO(d.data)} — {d.nome}</li>
                      ))}
                    </ul>
                    <p style={{ margin: "8px 0 0 0", fontSize: 12 }}>Evite programar a entrega para essas datas.</p>
                  </div>
                )}
                {of.pdfBase64 && (
                  <a href={of.pdfBase64} download={`OF-${of.numeroOf}.pdf`}
                    style={{ display: "block", textAlign: "center", background: "#2563eb", color: "#fff", textDecoration: "none", padding: 12, borderRadius: 6, fontWeight: "bold" }}>
                    📥 Baixar OF em PDF
                  </a>
                )}
              </div>
            ) : of.status === "Divergência" ? (
              <div style={{ background: "#fff3cd", border: "1px solid #ffecb5", color: "#664d03", padding: 20, borderRadius: 8, marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 8px 0" }}>⚠️ Divergência informada</h3>
                <p style={{ margin: 0 }}>Sua observação foi registrada. A equipe responsável vai entrar em contato.</p>
              </div>
            ) : (
              <div style={{ background: "#e2e8f0", padding: 16, borderRadius: 8, marginBottom: 24, textAlign: "center", color: "#334155" }}>
                🔒 O documento e o comprovante ficam disponíveis após a confirmação do recebimento, abaixo.
              </div>
            )}

            <div style={{ background: "#f9fafb", padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <p style={{ margin: "6px 0" }}><strong>Empresa:</strong> {of.empresa || "-"}</p>
              <p style={{ margin: "6px 0" }}><strong>CNPJ:</strong> {of.cnpj || "-"}</p>
              <p style={{ margin: "6px 0" }}><strong>Prazo acordado:</strong> {of.prazoDias} dia(s) após a confirmação</p>
            </div>

            {of.notificacoes?.length > 0 && (
              <div style={{ background: "#f8d7da", border: "1px solid #f5c2c7", padding: 16, borderRadius: 8, marginBottom: 24 }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#842029" }}>
                  ⚠️ {of.notificacoes.length > 1 ? `${of.notificacoes.length} notificações formais recebidas` : "Notificação formal recebida"}
                </h4>
                <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#842029" }}>
                  Antes de confirmar ou reportar algo, veja o conteúdo — pode haver prazo ou providência exigida.
                </p>
                {of.notificacoes.map(n => (
                  <p key={n.numero} style={{ margin: "4px 0", fontSize: 13 }}>
                    <a href={`${window.location.origin}${window.location.pathname}?notificacao=${token}&n=${n.numero}`}
                      target="_blank" rel="noreferrer" style={{ color: "#842029", fontWeight: "bold", textDecoration: "underline" }}>
                      📄 Ver Notificação nº {n.numero}
                    </a>
                    <span style={{ color: "#6B7280" }}> — enviada em {new Date(n.enviadaEm).toLocaleDateString("pt-BR")}</span>
                  </p>
                ))}
              </div>
            )}

            {!of.reciboImutavel && of.status !== "Divergência" && (
              <button onClick={handleConfirmar} disabled={confirmando}
                style={{ width: "100%", background: "#056535", color: "#fff", border: "none", padding: 14, borderRadius: 6, fontSize: 16, fontWeight: "bold", cursor: "pointer", marginBottom: 16 }}>
                {confirmando ? "Confirmando..." : "✅ Confirmar recebimento"}
              </button>
            )}

            {of.status !== "Divergência" && (
              <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <h4 style={{ margin: "0 0 8px 0", color: C.red }}>Encontrou alguma divergência?</h4>
                {of.reciboImutavel && (
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 8px 0" }}>
                    Mesmo já tendo confirmado o recebimento, você ainda pode relatar um problema percebido depois.
                  </p>
                )}
                <textarea rows="3" value={divergencia} onChange={e => setDivergencia(e.target.value)}
                  placeholder="Descreva o que não confere — itens, prazos, valores..."
                  style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #ccc", marginBottom: 8 }} />
                <button onClick={handleDivergencia} disabled={enviando}
                  style={{ background: C.red, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}>
                  {enviando ? "Enviando..." : "Reportar divergência"}
                </button>
              </div>
            )}
          </>
        )}

        {of && (
          <div style={{ marginTop: 20, textAlign: "center" }}>
            <a href={`${window.location.origin}${window.location.pathname}?central=`} style={{ color: "#2563eb", fontSize: 12, textDecoration: "underline" }}>
              Ver todas as minhas Ordens de Fornecimento
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
