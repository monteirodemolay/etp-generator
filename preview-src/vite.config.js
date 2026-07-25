import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Publicado numa subpasta do mesmo site — não é o app de produção, é a
// versão refatorada para teste, lado a lado com o que já está no ar.
export default defineConfig({
  plugins: [react()],
  base: "/etp-generator/preview/",
});
