import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PortaDeEntrada from "./PortaDeEntrada.jsx";
import LimiteDeErro from "./LimiteDeErro.jsx";
import { PortalFornecedor } from "./ui/of/PortalFornecedor.jsx";
import { ConferenciaChave } from "./ui/of/ConferenciaChave.jsx";

// As duas páginas da Ordem de Fornecimento abertas por link (o fornecedor
// confirmando o recebimento, e a conferência pública de um recibo) ficam
// FORA do login de propósito — quem recebe o link não tem conta no sistema
// e não deveria precisar de uma só para confirmar ou conferir.
const params = new URLSearchParams(window.location.search);
const tokenOf = params.get("of");
const chaveRecibo = params.get("recibo");

function Raiz() {
  if (tokenOf) return <PortalFornecedor token={tokenOf} />;
  if (chaveRecibo !== null) return <ConferenciaChave chaveInicial={chaveRecibo} />;

  return (
    <PortaDeEntrada>
      {usuario => <App emailUsuario={usuario?.email || null} />}
    </PortaDeEntrada>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LimiteDeErro>
      <Raiz />
    </LimiteDeErro>
  </React.StrictMode>
);
