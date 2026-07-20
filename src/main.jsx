import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PortaDeEntrada from "./PortaDeEntrada.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PortaDeEntrada>
      {usuario => <App emailUsuario={usuario?.email || null} />}
    </PortaDeEntrada>
  </React.StrictMode>
);
