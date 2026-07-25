import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PortaDeEntrada from "./PortaDeEntrada.jsx";
import LimiteDeErro from "./LimiteDeErro.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LimiteDeErro>
      <PortaDeEntrada>
        {usuario => <App emailUsuario={usuario?.email || null} />}
      </PortaDeEntrada>
    </LimiteDeErro>
  </React.StrictMode>
);
