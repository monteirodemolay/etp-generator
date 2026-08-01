/**
 * Exportação e importação do acervo — total ou de uma entidade específica.
 *
 * Mesmo com os dados na nuvem, um arquivo guardado em pasta sincronizada
 * continua sendo a proteção mais barata contra exclusão acidental.
 *
 * Recebe o armazenamento como argumento, para não depender de onde os dados
 * estão — o mesmo código serve para o navegador e para a nuvem.
 */

import { todayISO } from "./datas.js";

// ---------- Backup: exportar e importar ----------
// Enquanto os dados vivem só no navegador, este é o único caminho de recuperação
// caso a máquina seja formatada, o perfil corrompa ou alguém limpe os dados do site.
// O PCA é uma coleção (um arquivo por entidade, chave "pca:<entidadeId>"),
// não mais uma chave única compartilhada entre todas.
export const CHAVES_COLECAO = ["etp:", "just:", "decl:", "sec:", "pca:"];
export const CHAVES_UNICAS = ["timbre:padrao", "diretorio:responsaveis"];

// Coleções cuja CHAVE já identifica a entidade diretamente (chave = prefixo + id
// da entidade) — filtra comparando a própria chave, sem precisar ler o conteúdo.
const COLECOES_POR_CHAVE_DA_ENTIDADE = ["sec:", "pca:"];

/**
 * @param {object} storage
 * @param {{ secretariaId?: string }} opcoes - se secretariaId for informado,
 *   monta um backup só daquela entidade, não do sistema inteiro.
 */
export async function montarBackup(storage, opcoes = {}) {
  const { secretariaId } = opcoes;

  const pacote = {
    formato: "gerador-etp-backup",
    versao: 1,
    geradoEm: new Date().toISOString(),
    escopo: secretariaId ? { tipo: "entidade", secretariaId } : { tipo: "total" },
    colecoes: {},
    unicos: {},
  };

  for (const prefixo of CHAVES_COLECAO) {
    pacote.colecoes[prefixo] = [];
    try {
      const chaves = await storage.list(prefixo, false);
      for (const k of chaves?.keys || []) {
        try {
          const r = await storage.get(k, false);
          if (!r?.value) continue;

          if (secretariaId) {
            if (COLECOES_POR_CHAVE_DA_ENTIDADE.includes(prefixo)) {
              // sec:/pca: — a própria chave já diz de qual entidade é
              if (k !== prefixo + secretariaId) continue;
            } else {
              // etp:/just:/decl: — o documento tem o campo secretariaId
              let doc;
              try { doc = JSON.parse(r.value); } catch { continue; }
              if (doc.secretariaId !== secretariaId) continue;
            }
          }

          pacote.colecoes[prefixo].push({ chave: k, valor: r.value });
        } catch (e) { /* registro ausente */ }
      }
    } catch (e) { console.error("backup: " + prefixo, e); }
  }

  // O timbre padrão e o diretório de responsáveis são do sistema inteiro,
  // nunca de uma entidade só — por isso ficam de fora do backup por entidade.
  if (!secretariaId) {
    for (const k of CHAVES_UNICAS) {
      try {
        const r = await storage.get(k, false);
        if (r?.value) pacote.unicos[k] = r.value;
      } catch (e) { /* pode não existir */ }
    }
  }

  return pacote;
}

export function baixarBackup(pacote, nomeEntidade) {
  const texto = JSON.stringify(pacote, null, 2);
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const sufixoEntidade = nomeEntidade ? `_${nomeEntidade.replace(/[^\w-]+/g, "-")}` : "";
  a.download = `backup_gerador_etp${sufixoEntidade}_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Lê o arquivo e confere se é mesmo um backup deste app, antes de qualquer gravação
export function lerBackup(texto) {
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    throw new Error("O arquivo não é um JSON válido.");
  }
  if (dados?.formato !== "gerador-etp-backup") {
    throw new Error("Este arquivo não é um backup do Hub Compras Públicas.");
  }
  if (!dados.colecoes || !dados.unicos) {
    throw new Error("O backup está incompleto ou corrompido.");
  }
  return dados;
}

// Quantos itens de cada tipo o arquivo contém — mostrado antes de confirmar
export function resumirBackup(pacote) {
  return {
    etps: pacote.colecoes["etp:"]?.length || 0,
    justificativas: pacote.colecoes["just:"]?.length || 0,
    declaracoes: pacote.colecoes["decl:"]?.length || 0,
    secretarias: pacote.colecoes["sec:"]?.length || 0,
    pcasPorEntidade: pacote.colecoes["pca:"]?.length || 0,
    temTimbre: !!pacote.unicos["timbre:padrao"],
    geradoEm: pacote.geradoEm,
    escopo: pacote.escopo || { tipo: "total" }, // backups antigos, sem este campo, tratam-se como "total"
  };
}

// Grava o backup. Em "substituir", apaga o que existe hoje nas mesmas coleções antes de
// restaurar; em "mesclar", mantém o que há e sobrescreve apenas documentos de mesmo id.
//
// Quando o pacote é de UMA ENTIDADE (pacote.escopo.tipo === "entidade"), o modo
// "substituir" NUNCA apaga o sistema inteiro — só o que já era daquela mesma
// entidade. Sem essa distinção, restaurar um backup parcial em modo substituir
// apagaria os dados de TODAS as outras entidades por engano.
export async function restaurarBackup(storage, pacote, modo = "mesclar") {
  let gravados = 0;
  const escopoEntidade = pacote.escopo?.tipo === "entidade" ? pacote.escopo.secretariaId : null;

  if (modo === "substituir") {
    for (const prefixo of CHAVES_COLECAO) {
      try {
        const chaves = await storage.list(prefixo, false);
        for (const k of chaves?.keys || []) {
          if (escopoEntidade) {
            if (COLECOES_POR_CHAVE_DA_ENTIDADE.includes(prefixo)) {
              if (k !== prefixo + escopoEntidade) continue;
            } else {
              const atual = await storage.get(k, false).catch(() => null);
              if (!atual?.value) continue;
              let doc;
              try { doc = JSON.parse(atual.value); } catch { continue; }
              if (doc.secretariaId !== escopoEntidade) continue;
            }
          }
          await storage.delete(k, false).catch(() => {});
        }
      } catch (e) { /* nada a apagar */ }
    }
  }

  for (const prefixo of CHAVES_COLECAO) {
    for (const reg of pacote.colecoes[prefixo] || []) {
      await storage.set(reg.chave, reg.valor, false);
      gravados++;
    }
  }
  for (const [k, v] of Object.entries(pacote.unicos || {})) {
    await storage.set(k, v, false);
    gravados++;
  }
  return gravados;
}
