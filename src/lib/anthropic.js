// Helper para chamar a API da Anthropic diretamente do navegador, usando uma
// chave de API que o próprio usuário informa e que fica salva só no
// localStorage deste navegador (nunca é enviada a nenhum servidor além da
// própria Anthropic).
//
// Fora do ambiente do Claude não existe intermediação automática de chave —
// por isso essa etapa de configuração é necessária para os botões de "Gerar
// com IA" funcionarem no app publicado.

const KEY_STORAGE = "etpgen:anthropic_key";

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE) || "";
}

export function setApiKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}

export async function callClaude(prompt, maxTokens = 1000) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Configure sua chave de API da Anthropic em "Configurações" antes de usar a geração por IA.');
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json())?.error?.message || ""; } catch { /* ignore */ }
    throw new Error(`Erro na API da Anthropic (${response.status}): ${detail || "verifique sua chave de API."}`);
  }

  const data = await response.json();
  const text = (data?.content || []).map(b => b.text || "").join("\n").trim();
  if (!text) throw new Error("Resposta vazia da IA.");
  return text;
}
