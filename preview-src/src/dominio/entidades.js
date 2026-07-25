/**
 * Entidades: as unidades que contratam — secretarias, fundos, autarquias,
 * fundações, empresas públicas, consórcios.
 *
 * Documentos criados antes deste cadastro não têm o campo de entidade; nesses
 * casos pertencem à primeira cadastrada, sem precisar reescrever nada no
 * armazenamento.
 */


export function emptySecretaria(nome, sigla, tipo) {
  return {
    id: "sec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    nome: nome || "",
    sigla: sigla || "",
    tipoEntidade: tipo || "Secretaria",
    tipoTimbre: "imagem", // "imagem" | "texto" | "nenhum"
    timbre: null,         // imagem, quando tipoTimbre = "imagem"
    timbreHtml: "",       // texto formatado, quando tipoTimbre = "texto"
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Chave de armazenamento do PCA de uma entidade. Cada entidade tem o seu
// próprio arquivo — o PCA da FMAS não é o mesmo da SEMAS, e importar um não
// pode sobrescrever o outro.
export function chavePcaEntidade(secretariaId) {
  return "pca:" + (secretariaId || "sem-entidade");
}

export function secretariaDoDoc(doc, secretarias) {
  if (!secretarias?.length) return null;
  return secretarias.find(s => s.id === doc.secretariaId) || secretarias[0];
}
