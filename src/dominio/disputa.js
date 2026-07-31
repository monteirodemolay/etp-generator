/**
 * Modo Disputa — uma conversa registrada e limitada entre a equipe e o
 * fornecedor, pra resolver um problema (divergência reportada, ou atraso
 * notificado) sem virar um vaivém infinito que atrasa a entrega.
 *
 * Sequência fixa, no máximo 5 passos:
 *   1. Abertura (automática — motivo já registrado)
 *   2. Fornecedor aponta o problema
 *   3. Equipe responde
 *   4. Fornecedor responde de novo (réplica final)
 *   5. Equipe dá a solução final — encerra, decide se acata um novo prazo
 *      proposto pelo fornecedor (útil quando é falta de material no
 *      mercado, por exemplo) ou mantém o prazo original.
 *
 * Depois da solução final, a disputa fecha — vira só histórico.
 */

export function emptyDisputa(motivoAbertura, origem) {
  return {
    aberta: true,
    abertaEm: Date.now(),
    motivoAbertura: motivoAbertura || "",
    origem: origem || "manual", // "divergencia" | "notificacao" | "manual"
    mensagens: [], // { autor: "equipe" | "fornecedor", texto, quando, nome, prazoPropostoISO? }
    resolucao: null, // { decisao: "manter_prazo" | "novo_prazo", novoPrazoISO?, texto, quando, decididoPor }
  };
}

export function novaMensagemDisputa(autor, texto, nome, prazoPropostoISO) {
  return {
    autor, texto: texto || "", nome: nome || "",
    quando: Date.now(),
    ...(prazoPropostoISO ? { prazoPropostoISO } : {}),
  };
}

// De quem é a vez de escrever agora — ou se a disputa já foi encerrada, ou
// se chegou a hora da equipe decidir a solução final (não é mais só
// "responder", é encerrar de vez).
export function proximoTurno(disputa) {
  if (!disputa || !disputa.aberta || disputa.resolucao) return "encerrada";
  const n = disputa.mensagens.length;
  if (n === 0) return "fornecedor"; // aponta o problema
  if (n === 1) return "equipe";     // responde
  if (n === 2) return "fornecedor"; // réplica final
  return "equipe_decidir";          // hora da solução final
}

// Quantas horas desde a última mensagem, só faz sentido perguntar quando a
// vez é do fornecedor (é o único lado que pode demorar sem a equipe saber).
export function horasSemResposta(disputa) {
  if (!disputa) return 0;
  const ultima = disputa.mensagens.length > 0
    ? disputa.mensagens[disputa.mensagens.length - 1].quando
    : disputa.abertaEm;
  return (Date.now() - ultima) / (1000 * 60 * 60);
}

export function precisaAvisoSemResposta(disputa, limiteHoras = 48) {
  return proximoTurno(disputa) === "fornecedor" && horasSemResposta(disputa) > limiteHoras;
}

// Uma OF tem, no máximo, UMA disputa em andamento por vez: "disputaAtual"
// (null quando não há nenhuma). Ao encerrar, ela vai para "disputasEncerradas"
// (histórico, só a equipe grava) e "disputaAtual" volta a null. Esse desenho
// simples é o que permite a regra do Firestore validar com segurança que o
// fornecedor só está adicionando UMA mensagem, na hora certa — sem poder
// mexer em mais nada.
export function disputaAtiva(of) {
  return of.disputaAtual || null;
}
