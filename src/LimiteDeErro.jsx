import React from "react";

// Sem isto, um erro em qualquer render some por completo — a tela fica em
// branco e nem o navegador dá pista alguma, especialmente no celular, onde
// não dá para abrir o console. Com o limite, o erro aparece escrito na tela,
// pronto para ser lido e reportado.
export default class LimiteDeErro extends React.Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, info: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro capturado pelo LimiteDeErro:", erro, info);
    this.setState({ info });
  }

  render() {
    if (!this.state.erro) return this.props.children;

    const C = { navy: "#1C2E4A", paper: "#FAF7F0", red: "#A6403D", inkMuted: "#6B675E", border: "#DAD3C2" };
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, background: C.paper, fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ maxWidth: 560, width: "100%" }}>
          <h1 style={{ color: C.navy, fontSize: 20, marginBottom: 8 }}>
            Algo quebrou ao carregar a tela
          </h1>
          <p style={{ color: C.inkMuted, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Copie o texto abaixo e envie para quem está dando manutenção no sistema —
            ele mostra exatamente o que causou o erro.
          </p>
          <pre style={{
            background: "white", border: `1px solid ${C.border}`, borderRadius: 8,
            padding: 14, fontSize: 12, color: C.red, overflowX: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {String(this.state.erro?.stack || this.state.erro?.message || this.state.erro)}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{
              marginTop: 16, padding: "10px 18px", borderRadius: 8, border: "none",
              background: C.navy, color: C.paper, fontSize: 14, fontWeight: 600,
            }}>
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}
