/**
 * Materiais normativos: leis, decretos e instruções em PDF, disponíveis para
 * consulta por qualquer usuário do sistema.
 *
 * O PDF é lido como data URL e gravado inteiro numa única chave — o
 * armazenamento já fatia valores grandes automaticamente, então não é
 * preciso tratar isso aqui. Limite de 8 MB por arquivo, aplicado na tela.
 */

export const LIMITE_BYTES_NORMATIVO = 8 * 1024 * 1024;

export function formatarBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Monta o registro a partir do arquivo já lido como data URL — a leitura em
// si (FileReader) é E/S de navegador e fica na tela, não aqui.
export function criarRegistroNormativo({ file, descricao, dataUrl, enviadoPor }) {
  return {
    id: "norma_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    nome: file.name,
    descricao: descricao?.trim() || "",
    tamanhoBytes: file.size,
    enviadoEm: Date.now(),
    enviadoPor: enviadoPor || "",
    dataUrl,
  };
}
