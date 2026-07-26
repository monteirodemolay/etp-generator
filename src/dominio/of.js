/**
 * Ordem de Fornecimento: extração automática de dados do PDF, cálculo de
 * status, geração de identificadores.
 *
 * Nada aqui toca em Firestore, EmailJS ou leitura de arquivo — isso fica em
 * of-servico.js, isolado, do mesmo jeito que o gerador de Word fica isolado
 * do resto do domínio. Aqui só tem lógica pura, testável sem navegador.
 */

// ---------- Extração de texto do PDF (heurística por regex) ----------
// É best-effort: o PDF de uma OF não tem estrutura garantida entre órgãos
// diferentes. O servidor sempre confere e ajusta antes de disparar — os
// campos abrem editáveis, nunca são usados direto sem revisão.
export function extrairDadosDoPdf(textoCompleto) {
  const matchOf =
    textoCompleto.match(/ORDEM\s+FORNECIMENTO\/SERVIÇOS\s+(\d+)/i) ||
    textoCompleto.match(/ORDEM\s+(?:DE\s+)?FORNECIMENTO(?:\/SERVIÇOS)?[\s:ºN°]*(\d+)/i) ||
    textoCompleto.match(/O\.?F\.?[:\s]+(\d+)/i);
  const numeroOf = matchOf ? matchOf[1] : null;

  const matchCnpjSupplier = textoCompleto.match(
    /(?:CPF\/CNPJ|CNPJ|CPF)[:\s]+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/i
  );
  let cnpj = "";
  if (matchCnpjSupplier) {
    cnpj = matchCnpjSupplier[1];
  } else {
    const todosCnpjs = textoCompleto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g);
    if (todosCnpjs?.length > 1) cnpj = todosCnpjs[1];
    else if (todosCnpjs) cnpj = todosCnpjs[0];
  }

  let empresa = "";
  const matchBloco = textoCompleto.match(
    /Fornecedor[:\s]+([\s\S]*?)(?=Dados bancários|CPF\/CNPJ|CPF|CNPJ|Telefone|Endereço|Dotação|$)/i
  );
  if (matchBloco?.[1]) {
    const linhas = matchBloco[1].trim().split(/\n|\r/).map(l => l.trim()).filter(Boolean);
    if (linhas.length > 0) empresa = linhas[0];
  }
  if (!empresa || empresa.length < 3) {
    const matchPadraoEmpresa = textoCompleto.match(
      /\b([A-Z0-9\s.&'-]{3,80}\s+(?:LTDA|S\/A|MEI|ME|EPP|SERVICOS|COMERCIO|EIRELI))\b/i
    );
    if (matchPadraoEmpresa) empresa = matchPadraoEmpresa[1].trim();
  }
  empresa = empresa
    .replace(/^Fornecedor[:\s]*/i, "")
    .replace(/^Dados do Fornecedor\s*/i, "")
    .replace(/^[\d\s\-_]+/, "")
    .trim();
  if (/^\d+$/.test(empresa) || /^\d{2}\.\d{3}\.\d{3}/.test(empresa)) empresa = "";

  return { numeroOf, cnpj, empresa };
}

// ---------- Identificadores ----------
export function gerarNumeroOfSugerido() {
  return `OF-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Confere se já existe outra OF com o mesmo número — o gerador aleatório
// (4 dígitos) tem colisão real depois de algumas dezenas de registros.
export function numeroOfDuplicado(numeroOf, ofs, idAtual = null) {
  const alvo = String(numeroOf || "").trim().toLowerCase();
  if (!alvo) return false;
  return (ofs || []).some(o => o.id !== idAtual && String(o.numeroOf).trim().toLowerCase() === alvo);
}

export function gerarToken() {
  return crypto.randomUUID();
}

export function gerarChaveRecibo(numeroOf) {
  return `REC-${numeroOf}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ---------- Situação de uma OF (para a tabela de gestão) ----------
// Nunca afirma "entregue" — só o que o próprio fluxo pode garantir: se o
// fornecedor confirmou, se está no prazo, se passou do prazo, se houve
// divergência relatada.
export function calcularSituacao(item) {
  if (item.status === "Rascunho") return { chave: "rascunho", texto: "Rascunho" };

  if (item.status === "Aguardando Aceite") {
    const vinteEQuatroHorasMs = 24 * 60 * 60 * 1000;
    const precisaReenviar = item.dataEnvioTimestamp && (Date.now() - item.dataEnvioTimestamp > vinteEQuatroHorasMs);
    return {
      chave: precisaReenviar ? "sem-resposta" : "aguardando",
      texto: precisaReenviar ? "Sem resposta há mais de 24h" : "Aguardando confirmação do fornecedor",
      precisaReenviar,
    };
  }

  if (item.status === "Divergência") return { chave: "divergencia", texto: "Divergência relatada pelo fornecedor" };

  if (item.prazoLimite) {
    const [d, m, a] = item.prazoLimite.split("/");
    const dataLimite = new Date(a, m - 1, d);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (hoje > dataLimite) return { chave: "vencido", texto: "Prazo de entrega vencido", vencido: true };
  }

  return { chave: "em-dia", texto: "Confirmado, dentro do prazo" };
}

// Calcula a data-limite (string pt-BR) a partir de agora + prazoDias.
export function calcularPrazoLimite(prazoDias, agora = new Date()) {
  const dataLimite = new Date(agora);
  dataLimite.setDate(dataLimite.getDate() + parseInt(prazoDias || 10, 10));
  return dataLimite.toLocaleDateString("pt-BR");
}

export function emptyOf(dadosIniciais = {}) {
  return {
    id: null,
    numeroOf: dadosIniciais.numeroOf || "",
    empresa: dadosIniciais.empresa || "",
    cnpj: dadosIniciais.cnpj || "",
    emailFornecedor: dadosIniciais.emailFornecedor || "",
    telefoneFornecedor: dadosIniciais.telefoneFornecedor || "",
    prazoDias: dadosIniciais.prazoDias ?? 10,
    status: "Rascunho",
    pdfBase64: dadosIniciais.pdfBase64 || "",
    processoOrigem: dadosIniciais.processoOrigem || "", // referência opcional a um ETP/processo
    secretariaId: dadosIniciais.secretariaId || null,
    envios: [], // log de cada disparo/reenvio: { data, timestamp }
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
