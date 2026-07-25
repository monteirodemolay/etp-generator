// Timbre padrão do app (Prefeitura de Rio Verde), servido como arquivo estático.
//
// A imagem fica em src/assets e o Vite a publica como asset com hash de conteúdo,
// em vez de embutida em base64 dentro do JavaScript — isso evita que todo usuário
// baixe ~127 KB de texto extra no primeiro carregamento, mesmo quem nunca usa
// esse timbre específico (por ter o da própria entidade).
import timbrePadraoUrl from "../assets/timbre-padrao.png";
export const TIMBRE_PADRAO = timbrePadraoUrl;
