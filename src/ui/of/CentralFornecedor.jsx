/**
 * Central do fornecedor — acessada por CNPJ + e-mail cadastrado, sem login.
 *
 * Mostra todas as OFs de um fornecedor, agrupadas por ano e mês, com a
 * situação de cada uma. Quem ainda está aguardando confirmação pode
 * confirmar o recebimento direto daqui, sem precisar do link original
 * daquela OF específica.
 */

import React, { useState } from "react";
import { buscarOfsDoFornecedor, confirmarRecebimento, reportarDivergencia } from "../../of-servico.js";
import { calcularSituacao } from "../../dominio/of.js";
import { formatarCnpj } from "../../dominio/fornecedores.js";

const C = { ink: "#111827", inkMuted: "#6B7280", border: "#e5e7eb", green: "#0f5132", red: "#dc3545", brass: "#A6832E" };

export function CentralFornecedor() {
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null); // null = ainda não buscou; array = resultado (pode ser vazio)
  const [erro, setErro] = useState("");
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(null); // token da OF sendo confirmada/contestada agora

  async function buscar(e) {
    e.preventDefault();
    setBuscando(true);
    setErro("");
    try {
      const ofs = await buscarOfsDoFornecedor(cnpj, email);
      setResultado(ofs);
    } catch {
      setErro("Não foi possível buscar agora. Tente novamente em instantes.");
    }
    setBuscando(false);
  }

  async function confirmar(of) {
    setAcaoEmAndamento(of.token);
    try {
      const atualizado = await confirmarRecebimento(of.token, of);
      setResultado(prev => prev.map(o => (o.token === of.token ? atualizado : o)));
    } catch {
      setErro("Não foi possível confirmar agora.");
    }
    setAcaoEmAndamento(null);
  }

  const listaOrdenada = resultado ? [...resultado].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 760, margin: "40px auto", background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
        <div style={{ borderBottom: `2px solid ${C.border}`, paddingBottom: 16, marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: C.inkMuted, textTransform: "uppercase", letterSpacing: 1 }}>Central do Fornecedor</span>
          <h1 style={{ margin: "8px 0 0 0", color: C.ink }}>Suas Ordens de Fornecimento</h1>
        </div>

        {resultado === null && (
          <>
            <div style={{ background: "#fff3cd", border: "1px solid #ffecb5", color: "#664d03", padding: 14, borderRadius: 8, marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
              ⚠️ <b>Aviso:</b> qualquer pessoa que souber o CNPJ e o e-mail cadastrado desta empresa
              consegue ver as Ordens de Fornecimento dela aqui. Não compartilhe essas informações
              com quem não deveria ter acesso.
            </div>

            <form onSubmit={buscar}>
              <label style={{ display: "block", marginBottom: 12 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>CNPJ</span>
                <input value={cnpj} onChange={e => setCnpj(e.target.value)} required
                  placeholder="00.000.000/0000-00"
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 15 }} />
              </label>
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 4 }}>E-mail cadastrado</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="contato@suaempresa.com"
                  style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc", fontSize: 15 }} />
              </label>
              <button type="submit" disabled={buscando}
                style={{ width: "100%", background: "#2563eb", color: "#fff", border: "none", padding: 12, borderRadius: 6, fontSize: 15, fontWeight: "bold", cursor: "pointer" }}>
                {buscando ? "Buscando..." : "Ver minhas Ordens de Fornecimento"}
              </button>
            </form>
          </>
        )}

        {erro && <p style={{ background: "#f8d7da", color: "#842029", padding: 12, borderRadius: 8, fontSize: 13 }}>{erro}</p>}

        {resultado !== null && resultado.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <p style={{ color: C.inkMuted }}>Nenhuma Ordem de Fornecimento encontrada para este CNPJ e e-mail.</p>
            <button onClick={() => setResultado(null)} style={{ marginTop: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>
              ← Tentar outro CNPJ/e-mail
            </button>
          </div>
        )}

        {resultado !== null && resultado.length > 0 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setResultado(null)} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                ← Buscar outro CNPJ/e-mail
              </button>
            </div>
            {listaOrdenada.map(of_ => {
              const situacao = calcularSituacao(of_);
              const podeConfirmar = of_.status === "Aguardando Aceite";
              const linkDetalhes = `${window.location.origin}${window.location.pathname}?of=${of_.token}`;
              return (
                <div key={of_.token} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <b>OF nº {of_.numeroOf}</b>
                      <span style={{ marginLeft: 8, fontSize: 12, color: C.inkMuted }}>{formatarCnpj(of_.cnpj)}</span>
                      {of_.nomeEntidadeSnapshot && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: "bold", color: C.brass }}>{of_.nomeEntidadeSnapshot}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: "bold", padding: "3px 10px", borderRadius: 999,
                      background: situacao.naoEntregue || situacao.atrasado ? "#f8d7da" : situacao.chave === "em-dia" ? "#d1e7dd" : "#fff3cd",
                      color: situacao.naoEntregue || situacao.atrasado ? C.red : situacao.chave === "em-dia" ? C.green : "#664d03" }}>
                      {situacao.texto}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {podeConfirmar && (
                      <button onClick={() => confirmar(of_)} disabled={acaoEmAndamento === of_.token}
                        style={{ background: "#056535", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                        {acaoEmAndamento === of_.token ? "Confirmando..." : "✅ Confirmar recebimento"}
                      </button>
                    )}
                    <a href={linkDetalhes} style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6, fontSize: 13,
                      border: `1px solid ${C.border}`, color: C.ink, textDecoration: "none" }}>
                      Ver detalhes
                    </a>
                    {of_.pdfBase64 && (
                      <a href={of_.pdfBase64} download={`OF-${of_.numeroOf}.pdf`} style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6, fontSize: 13,
                        border: `1px solid ${C.border}`, color: C.ink, textDecoration: "none" }}>
                        📄 Baixar PDF da OF
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
