/**
 * Saudação do painel e dicas de uso.
 *
 * As citações têm autoria documentada. Frases célebres circulam muito
 * atribuídas a quem nunca as disse; num sistema usado por servidores todos os
 * dias, preferimos deixar de fora as de origem duvidosa.
 */


// Frases que giram abaixo da saudação. Sóbrias, ligadas ao sentido do trabalho —
// planejar bem uma contratação é o que garante que o recurso público chegue a quem precisa.
// Frases de pensadores, sorteadas a cada entrada no sistema.
// Só entram aqui citações com origem documentada — muitas frases célebres circulam
// atribuídas a quem nunca as disse, e num sistema público isso não fica bem.
export const FRASES = [
  // --- Antiguidade clássica ---
  { texto: "Não há vento favorável para quem não sabe para onde vai.",
    autor: "Sêneca", obra: "Cartas a Lucílio, 71" },
  { texto: "A saúde do povo deve ser a lei suprema.",
    autor: "Cícero", obra: "Das Leis, III" },
  { texto: "O todo é maior que a soma das partes.",
    autor: "Aristóteles", obra: "Metafísica" },
  { texto: "Uma jornada de mil milhas começa com um único passo.",
    autor: "Lao-Tsé", obra: "Tao Te Ching, 64" },
  { texto: "Nenhum homem entra duas vezes no mesmo rio, pois o rio já não é o mesmo, nem ele.",
    autor: "Heráclito" },
  { texto: "A justiça é a constante e perpétua vontade de dar a cada um o que é seu.",
    autor: "Ulpiano", obra: "Digesto, I" },
  { texto: "Enquanto adiamos, a vida passa.",
    autor: "Sêneca", obra: "Cartas a Lucílio, 1" },
  { texto: "O tempo descobre a verdade.",
    autor: "Sêneca", obra: "Sobre a Ira" },

  // --- Pensamento moderno ---
  { texto: "Saber não basta; é preciso aplicar. Querer não basta; é preciso fazer.",
    autor: "Goethe" },
  { texto: "Nada é mais difícil, e portanto mais precioso, do que ser capaz de decidir.",
    autor: "Napoleão Bonaparte" },
  { texto: "A dúvida é o princípio da sabedoria.",
    autor: "Descartes" },
  { texto: "Homem algum é uma ilha, completa em si mesma.",
    autor: "John Donne", obra: "Meditação XVII" },
  { texto: "Sabemos o que somos, mas não sabemos o que podemos ser.",
    autor: "Shakespeare", obra: "Hamlet" },
  { texto: "O preço da grandeza é a responsabilidade.",
    autor: "Winston Churchill" },
  { texto: "Aquilo que se faz por amor está sempre além do bem e do mal.",
    autor: "Nietzsche", obra: "Além do Bem e do Mal" },
  { texto: "A liberdade consiste em poder fazer tudo aquilo que não prejudique a outrem.",
    autor: "Declaração dos Direitos do Homem e do Cidadão", obra: "1789, art. 4º" },

  // --- Pensamento brasileiro ---
  { texto: "A pátria não é ninguém: são todos.",
    autor: "Rui Barbosa", obra: "Oração aos Moços" },
  { texto: "O ofício de escrever é um ofício de paciência.",
    autor: "Machado de Assis" },
  { texto: "A vida é uma ópera e uma grande ópera.",
    autor: "Machado de Assis", obra: "Dom Casmurro" },
  { texto: "Ninguém educa ninguém, ninguém educa a si mesmo: os homens se educam entre si.",
    autor: "Paulo Freire", obra: "Pedagogia do Oprimido" },
  { texto: "O correr da vida embrulha tudo. A vida é assim: esquenta e esfria, aperta e daí afrouxa.",
    autor: "Guimarães Rosa", obra: "Grande Sertão: Veredas" },

  // --- Trabalho, método e prudência ---
  { texto: "A perfeição é atingida não quando não há mais nada a acrescentar, mas quando não há mais nada a retirar.",
    autor: "Antoine de Saint-Exupéry", obra: "Terra dos Homens" },
  { texto: "Quem não sabe o que procura, não entende o que encontra.",
    autor: "Claude Bernard" },
  { texto: "Dê-me seis horas para derrubar uma árvore e passarei as quatro primeiras afiando o machado.",
    autor: "Abraham Lincoln" },
  { texto: "Tudo deveria ser feito da forma mais simples possível, mas não mais simples que isso.",
    autor: "Albert Einstein" },
  { texto: "O que é afirmado sem prova pode ser negado sem prova.",
    autor: "Euclides", obra: "atribuído" },
];

// Dicas curtas que giram no painel
export const DICAS = [
  "Cadastre o código do Sistema Centi nos itens — é por ele que o app localiza cada um no PCA.",
  "Use “Duplicar” numa contratação parecida do ano passado em vez de refazer o ETP do zero.",
  "Antes de finalizar, abra a Conformidade: ela aponta pendências que travam o processo.",
  "Incisos vazios não entram no documento. Para tirar um preenchido, use “Não incluir”.",
  "Cada Entidade pode ter timbre próprio — imagem, texto ou nenhum.",
  "Lance mais de uma cotação por item: a pesquisa de preços costuma exigir várias fontes.",
];

// Saudação conforme a hora do dia
export function saudacaoPorHora(agora = new Date()) {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

let ultimaFrase = -1;

// Primeiro nome, para a saudação não ficar cerimoniosa demais
export function primeiroNomeDe(nomeCompleto) {
  const limpo = String(nomeCompleto || "").trim();
  if (!limpo) return null;
  return limpo.split(/\s+/)[0];
}

export function sortearFrase() {
  if (FRASES.length <= 1) return 0;
  let i = Math.floor(Math.random() * FRASES.length);
  if (i === ultimaFrase) i = (i + 1) % FRASES.length;
  ultimaFrase = i;
  return i;
}
