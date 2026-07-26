/**
 * Dias Úteis: feriados nacionais (calculados, mas editáveis), feriados
 * municipais e pontos facultativos (cadastro manual, por município).
 *
 * Um registro só afeta prazo e aviso ao fornecedor se "semExpediente" for
 * verdadeiro — cadastrar uma data aqui não implica automaticamente que a
 * Secretaria fecha nesse dia; essa confirmação é um passo à parte, de
 * propósito, para nunca presumir.
 */

// ---------- Cálculo da Páscoa (algoritmo de Meeus/Jones/Butcher) ----------
// Necessário para os feriados móveis: Sexta-Feira Santa, Carnaval e Corpo de
// Cristo, todos contados a partir da data da Páscoa daquele ano.
export function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function paraISO(data) {
  const pad = n => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function somarDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

// ---------- Feriados nacionais, para um ano ----------
// Fixos (por lei, não dependem da Páscoa) + móveis (contados a partir dela).
// Carnaval e Corpo de Cristo são tradicionalmente PONTO FACULTATIVO federal
// (decretados ano a ano), não feriado obrigatório — por isso entram como
// sugestão com "semExpediente" já OFF, para o admin decidir se a Prefeitura
// dele fecha ou não nesses dias. Os demais entram como sugestão já ativa.
export function gerarFeriadosNacionais(ano) {
  const pascoa = calcularPascoa(ano);
  const fixos = [
    { data: `${ano}-01-01`, nome: "Confraternização Universal", obrigatorio: true },
    { data: `${ano}-04-21`, nome: "Tiradentes", obrigatorio: true },
    { data: `${ano}-05-01`, nome: "Dia do Trabalho", obrigatorio: true },
    { data: `${ano}-09-07`, nome: "Independência do Brasil", obrigatorio: true },
    { data: `${ano}-10-12`, nome: "Nossa Senhora Aparecida", obrigatorio: true },
    { data: `${ano}-11-02`, nome: "Finados", obrigatorio: true },
    { data: `${ano}-11-15`, nome: "Proclamação da República", obrigatorio: true },
    { data: `${ano}-11-20`, nome: "Dia Nacional de Zumbi e da Consciência Negra", obrigatorio: true },
    { data: `${ano}-12-25`, nome: "Natal", obrigatorio: true },
  ];
  const moveis = [
    // Quarta-feira de Cinzas é Páscoa - 46 dias; Carnaval é o dia (terça)
    // e a véspera (segunda) anteriores a ela.
    { data: paraISO(somarDias(pascoa, -48)), nome: "Carnaval (segunda-feira)", obrigatorio: false },
    { data: paraISO(somarDias(pascoa, -47)), nome: "Carnaval (terça-feira)", obrigatorio: false },
    { data: paraISO(somarDias(pascoa, -2)), nome: "Sexta-Feira Santa", obrigatorio: true },
    { data: paraISO(somarDias(pascoa, 60)), nome: "Corpo de Cristo", obrigatorio: false },
  ];
  return [...fixos, ...moveis].map(f => ({
    data: f.data,
    nome: f.nome,
    // Feriados obrigatórios já nascem confirmados como sem expediente; os
    // facultativos (Carnaval, Corpo de Cristo) nascem como sugestão, para o
    // admin decidir — refletindo que não são obrigatórios em todo lugar.
    semExpediente: f.obrigatorio,
  }));
}

// ---------- Modelo de um registro no calendário ----------
export function emptyFeriado({ data, nome, municipioId, tipo, semExpediente, observacao, emendaDe } = {}) {
  return {
    id: "feriado_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    data: data || "",
    nome: nome || "",
    tipo: tipo || "municipal", // "nacional" | "municipal" | "ponto-facultativo"
    municipioId: municipioId || null, // null = nacional, vale para todos
    semExpediente: semExpediente ?? true,
    observacao: observacao || "",
    ativo: true, // permite desativar uma sugestão nacional que este município não observa
    emendaDe: emendaDe || null, // id do feriado que originou esta emenda, se for o caso
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------- A pergunta de "emendar" ----------
// Terça pergunta se emenda a segunda anterior; quinta pergunta se emenda a
// sexta seguinte. Qualquer outro dia da semana não pergunta nada.
export function diaDaEmenda(dataISO) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const diaSemana = new Date(a, m - 1, d).getDay(); // 0=domingo ... 6=sábado
  if (diaSemana === 2) return paraISO(somarDias(new Date(a, m - 1, d), -1)); // terça -> segunda anterior
  if (diaSemana === 4) return paraISO(somarDias(new Date(a, m - 1, d), 1));  // quinta -> sexta seguinte
  return null;
}

export function criarEmenda(feriadoOriginal) {
  const dataEmenda = diaDaEmenda(feriadoOriginal.data);
  if (!dataEmenda) return null;
  return emptyFeriado({
    data: dataEmenda,
    nome: `Ponto facultativo (emenda de ${feriadoOriginal.nome})`,
    municipioId: feriadoOriginal.municipioId,
    tipo: "ponto-facultativo",
    semExpediente: feriadoOriginal.semExpediente,
    emendaDe: feriadoOriginal.id,
  });
}

// ---------- Consulta ao calendário ----------
// Um dia é útil se: não é fim de semana, e não há nenhum feriado ativo com
// semExpediente=true, nacional ou deste município, naquela data.
export function ehDiaUtil(dataISO, feriados, municipioId) {
  const [a, m, d] = dataISO.split("-").map(Number);
  const diaSemana = new Date(a, m - 1, d).getDay();
  if (diaSemana === 0 || diaSemana === 6) return false;

  const fechaNesseDia = (feriados || []).some(f =>
    f.ativo && f.semExpediente && f.data === dataISO &&
    (f.municipioId === null || f.municipioId === municipioId)
  );
  return !fechaNesseDia;
}

// Empurra a data para a frente até cair num dia útil — é a regra "dias
// corridos, ajusta só a data final" combinada para a Ordem de Fornecimento.
export function proximoDiaUtil(dataISO, feriados, municipioId) {
  let [a, m, d] = dataISO.split("-").map(Number);
  let data = new Date(a, m - 1, d);
  let tentativas = 0;
  while (!ehDiaUtil(paraISO(data), feriados, municipioId) && tentativas < 60) {
    data = somarDias(data, 1);
    tentativas++;
  }
  return paraISO(data);
}

// O feriado (ativo, com semExpediente) que explica por que uma data não é
// útil — usado para montar o aviso ao fornecedor ("não haverá expediente
// porque é [nome do feriado]").
export function motivoNaoUtil(dataISO, feriados, municipioId) {
  return (feriados || []).find(f =>
    f.ativo && f.semExpediente && f.data === dataISO &&
    (f.municipioId === null || f.municipioId === municipioId)
  ) || null;
}

// Todos os dias sem expediente dentro de um período (inclusive as pontas) —
// usado para avisar o fornecedor, na confirmação, de que não deve tentar
// entregar em determinada data dentro do prazo combinado.
export function diasFechadosNoPeriodo(dataInicioISO, dataFimISO, feriados, municipioId) {
  return (feriados || [])
    .filter(f =>
      f.ativo && f.semExpediente &&
      (f.municipioId === null || f.municipioId === municipioId) &&
      f.data >= dataInicioISO && f.data <= dataFimISO)
    .sort((a, b) => a.data.localeCompare(b.data));
}
