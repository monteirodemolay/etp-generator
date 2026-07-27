/**
 * Termos de Uso e Política de Privacidade — tela pública, sem login.
 *
 * O conteúdo (as seções) vem do banco, editável pelo Administrador dentro
 * do Admin. O aviso de rascunho/revisão jurídica é fixo aqui, de propósito
 * — não é editável, para que ninguém o remova sem perceber a implicação.
 */

import React, { useState, useEffect } from "react";
import storage from "../../storage.js";
import { secoesPadrao } from "../../dominio/termos.js";
import { fmtDate } from "../../dominio/datas.js";

const C = {
  navy: "#1C2E4A", paper: "#FAF7F0", paperDark: "#F1ECDF", brass: "#A6832E",
  ink: "#2A2A28", inkMuted: "#6B675E", border: "#DAD3C2",
};

function Secao({ titulo, corpo }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, color: C.navy, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 12 }}>
        {titulo}
      </h2>
      <div style={{ fontSize: 13.5, lineHeight: 1.7, color: C.ink }} dangerouslySetInnerHTML={{ __html: corpo }} />
    </section>
  );
}

export function TermosPrivacidade() {
  const [conteudo, setConteudo] = useState(null); // null = carregando

  useEffect(() => {
    storage.get("termos:conteudo", false)
      .then(r => setConteudo(r?.value ? JSON.parse(r.value) : { secoes: secoesPadrao(), atualizadoEm: null }))
      .catch(() => setConteudo({ secoes: secoesPadrao(), atualizadoEm: null }));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 780, margin: "20px auto 60px", background: "#fff", borderRadius: 12, padding: "32px 36px", boxShadow: "0 4px 6px rgba(0,0,0,0.08)" }}>

        <div style={{ borderBottom: `2px solid ${C.border}`, paddingBottom: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.brass, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
            Gerador de ETP
          </span>
          <h1 style={{ margin: "6px 0 0 0", color: C.navy, fontSize: 22 }}>Termos de Uso e Política de Privacidade</h1>
          {conteudo?.atualizadoEm && (
            <p style={{ margin: "6px 0 0 0", fontSize: 12, color: C.inkMuted }}>
              Última atualização: {fmtDate(conteudo.atualizadoEm)}
            </p>
          )}
        </div>

        <div style={{ background: "#fff3cd", border: "1px solid #ffecb5", color: "#664d03", padding: 14, borderRadius: 8, margin: "18px 0 26px", fontSize: 12.5, lineHeight: 1.6 }}>
          <b>Aviso importante:</b> este documento é um rascunho, redigido para orientar o funcionamento
          do sistema e ajudar numa eventual revisão jurídica — não substitui a análise da Procuradoria
          do Município nem qualquer outro instrumento formal exigido pela legislação aplicável,
          especialmente a Lei nº 13.709/2018 (LGPD), em particular os artigos 23 a 30, que tratam do
          tratamento de dados pelo Poder Público.
        </div>

        {conteudo === null ? (
          <p style={{ color: C.inkMuted, textAlign: "center", padding: "20px 0" }}>Carregando...</p>
        ) : (
          conteudo.secoes.map(s => <Secao key={s.id} titulo={s.titulo} corpo={s.corpo} />)
        )}

        <div style={{ textAlign: "center", marginTop: 30 }}>
          <a href={`${window.location.origin}${window.location.pathname}`} style={{ color: "#2563eb", fontSize: 12, textDecoration: "underline" }}>
            ← Voltar
          </a>
        </div>
      </div>
    </div>
  );
}
