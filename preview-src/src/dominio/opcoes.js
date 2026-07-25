/**
 * Listas fixas usadas nos formulários.
 *
 * Ficam juntas porque são vocabulário do domínio, não regra: mudar uma opção
 * aqui não altera nenhum comportamento, só o que aparece nas listas de escolha.
 */

export const TIPOS_OBJETO = ["Bens", "Serviços comuns", "Serviços de TI", "Obras e serviços de engenharia"];
export const FONTES_COTACAO = ["Banco de Preços", "Internet", "Outro"];

// Secretaria — unidade organizacional que agrupa os documentos (chave "sec:<id>").
// Cada uma pode ter timbre próprio; sem timbre, cai no timbre geral do app.
// Tipos de entidade que podem contratar — nem toda unidade é uma secretaria
export const TIPOS_ENTIDADE = [
  "Secretaria", "Fundo", "Autarquia", "Fundação",
  "Empresa Pública", "Consórcio Público", "Outro",
];
