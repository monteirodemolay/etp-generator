/**
 * Comprovante de Recebimento e Aceite de uma Ordem de Fornecimento.
 *
 * Um único visual, usado nos dois lugares onde o comprovante aparece: a
 * tela do fornecedor (depois de confirmar) e a impressão feita pelo admin.
 * Antes eram dois visuais diferentes — o que gerava exatamente o tipo de
 * divergência que este componente existe para evitar.
 *
 * Estilo 100% inline, de propósito: a impressão do admin abre uma janela
 * em branco, sem o CSS do app carregado — só assim o mesmo componente
 * renderiza igual nos dois contextos.
 */

import React from "react";

const C = {
  navy: "#1C2E4A", brass: "#A6832E", ink: "#2A2A28", inkMuted: "#6B675E",
  border: "#DAD3C2", green: "#4C7C59", paperDark: "#F1ECDF",
};

export function ComprovanteOf({ of, cabecalho, qrCodeDataUrl, linkConferencia }) {
  const cabecalhoConteudo = cabecalho?.tipo === "imagem" && cabecalho.dataUrl ? (
    <img src={cabecalho.dataUrl} alt="Timbre"
      style={{ maxWidth: "100%", maxHeight: 90, display: "block", margin: "0 auto 12px auto" }} />
  ) : cabecalho?.tipo === "texto" && cabecalho.html ? (
    <div style={{ textAlign: "center", marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: cabecalho.html }} />
  ) : (
    <h2 style={{ textAlign: "center", margin: "0 0 4px 0", color: C.navy }}>Prefeitura Municipal</h2>
  );

  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 620, margin: "0 auto", color: C.ink }}>
      <div style={{ borderBottom: `2px solid ${C.navy}`, paddingBottom: 16, marginBottom: 20 }}>
        {cabecalhoConteudo}
        <p style={{ textAlign: "center", fontSize: 12, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
          Comprovante de Recebimento e Aceite — Ordem de Fornecimento
        </p>
      </div>

      <div style={{ background: C.paperDark, border: `1px solid ${C.border}`, padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <p style={{ margin: "4px 0" }}><b>OF nº:</b> {of.numeroOf}</p>
        <p style={{ margin: "4px 0" }}><b>Empresa:</b> {of.empresa}</p>
        <p style={{ margin: "4px 0" }}><b>CNPJ:</b> {of.cnpj || "-"}</p>
        <p style={{ margin: "4px 0" }}><b>Confirmado em:</b> {of.reciboImutavel?.dataConfirmacao || of.dataAceite || "-"}</p>
        <p style={{ margin: "4px 0" }}><b>Prazo limite:</b> {of.prazoLimite || "-"} ({of.prazoDias} dia(s))</p>
      </div>

      <div style={{ background: C.paperDark, border: `1px solid ${C.border}`, padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <b style={{ fontSize: 12 }}>Chave de autenticidade:</b>
        <span style={{
          display: "block", fontFamily: "monospace", background: "#fff", padding: 8, borderRadius: 4,
          border: `1px dashed ${C.brass}`, fontSize: 12, wordBreak: "break-all", marginTop: 4,
        }}>
          {of.reciboImutavel?.chave || "N/A"}
        </span>
      </div>

      {qrCodeDataUrl && (
        <div style={{ textAlign: "center", margin: "20px 0" }}>
          <img src={qrCodeDataUrl} alt="QR Code de conferência" style={{ width: 150, height: 150 }} />
          <p style={{ fontSize: 11, color: C.inkMuted, marginTop: 6 }}>
            Aponte a câmera para conferir a autenticidade deste comprovante
          </p>
        </div>
      )}

      {linkConferencia && (
        <p style={{ fontSize: 11, color: C.inkMuted, textAlign: "center", marginTop: 20 }}>
          Documento gerado eletronicamente. Link de conferência:<br />{linkConferencia}
        </p>
      )}
    </div>
  );
}
