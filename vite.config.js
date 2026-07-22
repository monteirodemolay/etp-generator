import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" faz os caminhos dos arquivos gerados serem relativos, então o
// build funciona tanto no GitHub Pages (ex.: usuario.github.io/nome-do-repo/)
// quanto em qualquer outro lugar, sem precisar configurar o nome do repositório.
export default defineConfig({
  plugins: [react()],
  base: "/etp-generator/",
});
