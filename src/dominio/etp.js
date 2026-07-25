/**
 * Conceitos do próprio Estudo Técnico Preliminar: como se lê o objeto, quem
 * assina, como se descreve um prazo. São as perguntas que os textos-modelo
 * fazem ao documento antes de redigir cada inciso.
 */

import { num } from "./valores.js";
import { fmtDateExtenso, todayISO } from "./datas.js";

export function bemOuServicoDe(etp) {
  return etp.meta.tipo === "Serviços comuns" || etp.meta.tipo === "Serviços de TI" ? "serviços" : "bens";
}

export function verboDe(etp) {
  return bemOuServicoDe(etp) === "serviços" ? "contratação" : "aquisição";
}

// Helper comum: "bens" ou "serviços", conforme o tipo de objeto do ETP
// Formata um prazo com a unidade escolhida (dias/meses/anos), com plural correto — ex.: "1 mês", "12 meses"
export function formatarPrazo(valor, unidade) {
  const v = String(valor ?? "").trim();
  if (!v) return "";
  const n = num(v);
  const singular = { dias: "dia", meses: "mês", anos: "ano" }[unidade] || "dia";
  const plural = { dias: "dias", meses: "meses", anos: "anos" }[unidade] || "dias";
  return `${v} ${n === 1 ? singular : plural}`;
}

// Objeto completo do ETP: título resumido + órgão solicitante, usado no documento final
// Lista de responsáveis a exibir/assinar — usa o novo campo de múltiplos responsáveis;
// se estiver vazio, cai no campo antigo (responsavel/cargo), para ETPs criados antes desta mudança.
export function listaResponsaveis(etp) {
  if (etp.meta.responsaveis?.length > 0) return etp.meta.responsaveis;
  if (etp.meta.responsavel?.trim()) return [{ id: "legado", nome: etp.meta.responsavel, cargo: etp.meta.cargo || "" }];
  return [];
}

export function objetoCompleto(etp) {
  const titulo = etp.meta.titulo?.trim();
  const orgao = etp.meta.orgao?.trim();
  const setor = etp.meta.setor?.trim();
  if (!titulo) return "";
  const partes = [];
  if (setor) partes.push(`do(a) ${setor}`);
  if (orgao) partes.push(`da ${orgao}`);
  return partes.length > 0 ? `${titulo} para atender às necessidades ${partes.join(", ")}` : titulo;
}

// Linha de fechamento "Cidade - Estado, dia de mês de ano." usada na assinatura do ETP
export function linhaAssinaturaData(etp) {
  const local = etp.meta.local?.trim() || "[Cidade] - [Estado]";
  const data = fmtDateExtenso(etp.meta.data) || fmtDateExtenso(todayISO());
  return `${local}, ${data}.`;
}
