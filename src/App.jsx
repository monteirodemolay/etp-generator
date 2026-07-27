/**
 * Orquestração do aplicativo.
 *
 * Este arquivo cuida apenas de estado, navegação e gravação. Toda regra de
 * negócio vive em src/dominio, todo texto em src/conteudo, toda tela em
 * src/ui — se algo aqui começar a decidir COMO uma coisa é feita, e não
 * QUANDO, é sinal de que está no lugar errado.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import storage from "./storage.js";

// telas
import { ListView } from "./ui/painel/index.jsx";
import { EditorView } from "./ui/etp/editor.jsx";
import { PreviewView } from "./ui/etp/previsualizacao.jsx";
import { DeclaracaoView } from "./ui/documentos/declaracao.jsx";
import { JustificativaView } from "./ui/documentos/justificativa.jsx";

// domínio
import { C } from "./ui/tokens.js";
import { emptyEtp, emptyJustificativa, emptyDeclaracao, duplicarDocumento } from "./dominio/modelos.js";
import { emptySecretaria, secretariaDoDoc } from "./dominio/entidades.js";
import { usuarioPorEmail, permissoesDe, entidadesVisiveis, emptyUsuario,
         podeVerTodasEntidades, entidadeInicial, entidadeEhSomenteLeitura } from "./dominio/permissoes.js";
import { criarRegistroNormativo } from "./dominio/normativos.js";
import { listarOfs } from "./of-servico.js";
import { moverParaLixeira, restaurarDaLixeira, excluirDefinitivo,
         limparLixeiraVencida, PREFIXO_LIXO } from "./dominio/lixeira.js";
import { aplicar as migrarPcaPorEntidade } from "./migracoes/002-separa-pca-por-entidade.js";
import { aplicar as migrarIncisosIVeV } from "./migracoes/001-corrige-incisos-iv-v.js";
import { aplicar as migrarMunicipios } from "./migracoes/003-separa-entidades-por-municipio.js";
import { contarEntidadesDoMunicipio } from "./dominio/municipios.js";
import { gerarFeriadosNacionais, emptyFeriado } from "./dominio/dias-uteis.js";
import { listaResponsaveis } from "./dominio/etp.js";
import { TIPOS_OBJETO } from "./dominio/opcoes.js";

export default function App({ emailUsuario = null }) {
  const [view, setView] = useState("list"); // list | editor | preview | justificativa | declaracao
  const [etps, setEtps] = useState([]);
  const [justificativas, setJustificativas] = useState([]);
  const [declaracoes, setDeclaracoes] = useState([]);
  const [secretarias, setSecretarias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [normativos, setNormativos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [ofs, setOfs] = useState([]);
  const [lixeira, setLixeira] = useState([]);
  const [secretariaAtiva, setSecretariaAtiva] = useState("todas"); // "todas" | id
  const [currentJust, setCurrentJust] = useState(null);
  const [currentDecl, setCurrentDecl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [activeSection, setActiveSection] = useState("itens");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [search, setSearch] = useState("");
  const saveTimer = useRef(null);

  // Carrega uma coleção inteira a partir do prefixo da chave (mesmo mecanismo dos ETPs)
  const carregarColecao = useCallback(async (prefixo) => {
    const itens = [];
    try {
      const keys = await storage.list(prefixo, false);
      if (keys?.keys?.length) {
        for (const k of keys.keys) {
          try {
            const r = await storage.get(k, false);
            if (r?.value) itens.push(JSON.parse(r.value));
          } catch (e) { /* registro ausente, ignora */ }
        }
      }
    } catch (e) {
      console.error("Erro ao carregar " + prefixo, e);
    }
    itens.sort((a, b) => b.updatedAt - a.updatedAt);
    return itens;
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    const [listaEtps, listaJust, listaDecl, listaSec, listaUsr, listaNormas, listaFornecedores, listaMunicipios, listaFeriados, listaLixo] = await Promise.all([
      carregarColecao("etp:"),
      carregarColecao("just:"),
      carregarColecao("decl:"),
      carregarColecao("sec:"),
      carregarColecao("usr:"),
      carregarColecao("norma:"),
      carregarColecao("fornecedor:"),
      carregarColecao("municipio:"),
      carregarColecao("feriado:"),
      carregarColecao(PREFIXO_LIXO),
    ]);
    // As Ordens de Fornecimento vivem numa coleção própria do Firestore (não
    // na nossa base "dados"), porque o fornecedor precisa lê-las e alterá-las
    // sem estar logado — ver src/of-servico.js e firestore.rules.
    const listaOfs = await listarOfs().catch(e => { console.error("Erro ao listar OFs", e); return []; });

    // Primeiro acesso: cria a secretaria padrão para que todo documento tenha onde se apoiar.
    // Documentos antigos, sem secretariaId, passam a pertencer a ela automaticamente.
    let secretariasFinais = listaSec.sort((a, b) => a.createdAt - b.createdAt);
    if (secretariasFinais.length === 0) {
      const padrao = emptySecretaria("Secretaria Municipal de Assistência Social", "SEMAS");
      try {
        await storage.set("sec:" + padrao.id, JSON.stringify(padrao), false);
        secretariasFinais = [padrao];
      } catch (e) { console.error("Erro ao criar secretaria padrão", e); }
    }

    // Cria o primeiro Município (assim que existir mais de uma Prefeitura
    // usando o sistema, cada entidade passa a apontar para o seu) e liga a
    // ele as entidades que ainda não têm município definido.
    let municipiosFinais = listaMunicipios.sort((a, b) => a.createdAt - b.createdAt);
    try {
      const resultado = await migrarMunicipios(secretariasFinais, municipiosFinais,
        (chave, valor) => storage.set(chave, valor, false));
      if (resultado.criouMunicipio) {
        const criado = await storage.get("municipio:" + resultado.municipioPadraoId, false).catch(() => null);
        if (criado?.value) municipiosFinais = [JSON.parse(criado.value)];
      }
      if (resultado.entidadesAtualizadas > 0) {
        secretariasFinais = secretariasFinais.map(s =>
          s.municipioId ? s : { ...s, municipioId: resultado.municipioPadraoId });
      }
    } catch (e) { console.error("Migração 003 (entidades por município)", e); }

    // Garante que os feriados nacionais do ano corrente já existam, gerados
    // e editáveis, PARA CADA MUNICÍPIO — cada um recebe sua própria cópia,
    // de propósito: se um dia um município decidir que não observa o
    // Carnaval, por exemplo, essa escolha não pode afetar os demais.
    let feriadosFinais = listaFeriados;
    try {
      const anoAtual = new Date().getFullYear();
      const faltantes = [];
      for (const mun of municipiosFinais) {
        const jaTem = feriadosFinais.some(f =>
          f.tipo === "nacional" && f.municipioId === mun.id && f.data.startsWith(String(anoAtual)));
        if (!jaTem) {
          const novos = gerarFeriadosNacionais(anoAtual).map(f =>
            emptyFeriado({ ...f, tipo: "nacional", municipioId: mun.id }));
          faltantes.push(...novos);
        }
      }
      if (faltantes.length > 0) {
        await Promise.all(faltantes.map(f => storage.set("feriado:" + f.id, JSON.stringify(f), false)));
        feriadosFinais = [...feriadosFinais, ...faltantes];
      }
    } catch (e) { console.error("Erro ao gerar feriados nacionais", e); }

    // Migra o PCA compartilhado (esquema antigo) para a primeira entidade,
    // uma única vez — a própria migração marca o que já rodou.
    await migrarPcaPorEntidade(storage, secretariasFinais).catch(e =>
      console.error("Migração 002 (PCA por entidade)", e));

    // Corrige a inversão histórica dos incisos IV e V, se houver ETP antigo
    // que ainda não passou por isso. Em base nova, não encontra nada a fazer.
    await migrarIncisosIVeV(listaEtps, (chave, valor) => storage.set(chave, valor, false))
      .catch(e => console.error("Migração 001 (incisos IV/V)", e));

    setEtps(listaEtps);
    setJustificativas(listaJust);
    setDeclaracoes(listaDecl);
    setSecretarias(secretariasFinais);
    setUsuarios(listaUsr.sort((a, b) => (a.nomeCompleto || a.email).localeCompare(b.nomeCompleto || b.email)));
    setNormativos(listaNormas.sort((a, b) => b.enviadoEm - a.enviadoEm));
    setFornecedores(listaFornecedores);
    setMunicipios(municipiosFinais);
    setFeriados(feriadosFinais.sort((a, b) => a.data.localeCompare(b.data)));
    setOfs(listaOfs);
    // O que passou de 30 dias sai da lixeira sozinho
    const lixoValido = await limparLixeiraVencida(storage, listaLixo);
    setLixeira(lixoValido.sort((a, b) => b.excluidoEm - a.excluidoEm));
    setLoading(false);
  }, [carregarColecao]);

  useEffect(() => { loadList(); }, [loadList]);

  const persist = useCallback((etp) => {
    if (somenteLeituraPara(etp)) return; // trava de segurança: a tela já bloqueia a edição, isto é reforço
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await storage.set("etp:" + etp.id, JSON.stringify(etp), false);
        setSaveState("saved");
      } catch (e) {
        console.error("Erro ao salvar", e);
        setSaveState("idle");
      }
    }, 600);
  }, []);

  function openEtp(etp) {
    setCurrent(etp);
    setCurrentId(etp.id);
    setActiveSection("itens");
    setView("editor");
  }

  // Secretaria que um documento novo deve receber: a que está selecionada no painel,
  // ou a primeira cadastrada quando o filtro está em "todas".
  function secretariaParaNovoDoc() {
    if (secretariaAtiva !== "todas") return secretarias.find(s => s.id === secretariaAtiva) || secretarias[0];
    return secretarias[0];
  }

  // Recebe o que foi preenchido na janela de criação: objeto, tipo, processo e secretaria
  function newEtp(dados = {}) {
    const etp = emptyEtp();
    const sec = secretarias.find(x => x.id === dados.secretariaId) || secretariaParaNovoDoc();
    if (sec) {
      etp.secretariaId = sec.id;
      etp.meta.orgao = sec.nome; // evita redigitar o órgão a cada novo documento
    }
    if (dados.objeto) etp.meta.titulo = dados.objeto;
    if (dados.processo) etp.meta.processo = dados.processo;
    if (dados.tipoObjeto && TIPOS_OBJETO.includes(dados.tipoObjeto)) etp.meta.tipo = dados.tipoObjeto;
    setCurrent(etp);
    setCurrentId(etp.id);
    setActiveSection("itens");
    setView("editor");
    setEtps(prev => [etp, ...prev]);
    storage.set("etp:" + etp.id, JSON.stringify(etp), false).catch(() => {});
  }

  async function deleteEtp(id, e) {
    e?.stopPropagation?.();
    const doc = etps.find(x => x.id === id);
    if (!doc) return;
    try {
      const reg = await moverParaLixeira(storage, "etp:", id, doc);
      setEtps(prev => prev.filter(x => x.id !== id));
      setLixeira(prev => [reg, ...prev]);
    } catch (err) { console.error(err); }
  }

  function duplicarEtp(etp, e) {
    e?.stopPropagation();
    const copia = duplicarDocumento(etp, "etp");
    setEtps(prev => [copia, ...prev]);
    storage.set("etp:" + copia.id, JSON.stringify(copia), false).catch(() => {});
  }

  // ----- Fornecedores -----
  function salvarFornecedor(f) {
    const atualizado = { ...f, updatedAt: Date.now() };
    setFornecedores(prev => {
      const existe = prev.some(x => x.id === atualizado.id);
      return existe ? prev.map(x => (x.id === atualizado.id ? atualizado : x)) : [...prev, atualizado];
    });
    storage.set("fornecedor:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }

  async function excluirFornecedor(id) {
    try {
      await storage.delete("fornecedor:" + id, false);
      setFornecedores(prev => prev.filter(f => f.id !== id));
    } catch (err) { console.error(err); }
  }

  // ----- Usuários -----
  function salvarUsuario(u) {
    const atualizado = { ...u, updatedAt: Date.now() };
    setUsuarios(prev => {
      const existe = prev.some(x => x.id === atualizado.id);
      return existe ? prev.map(x => (x.id === atualizado.id ? atualizado : x)) : [...prev, atualizado];
    });
    storage.set("usr:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }

  async function excluirUsuario(id) {
    try {
      await storage.delete("usr:" + id, false);
      setUsuarios(prev => prev.filter(x => x.id !== id));
    } catch (err) { console.error(err); }
  }

  // ----- Materiais Normativos -----
  // Lê o PDF como data URL e grava o registro inteiro (metadados + conteúdo) numa única chave;
  // o storage.js já fatia automaticamente valores grandes, então não é preciso tratar isso aqui.
  async function uploadNormativo(file, descricao) {
    const dataUrl = await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Falha ao ler o arquivo"));
      leitor.readAsDataURL(file);
    });
    const registro = criarRegistroNormativo({
      file, descricao, dataUrl,
      enviadoPor: usuarioAtual?.nomeCompleto?.trim() || emailUsuario || "",
    });
    await storage.set("norma:" + registro.id, JSON.stringify(registro), false);
    setNormativos(prev => [registro, ...prev]);
  }

  async function excluirNormativo(id) {
    try {
      await storage.delete("norma:" + id, false);
      setNormativos(prev => prev.filter(x => x.id !== id));
    } catch (err) { console.error(err); }
  }

  // ----- Secretarias -----
  function salvarSecretaria(sec) {
    const atualizada = { ...sec, updatedAt: Date.now() };
    setSecretarias(prev => {
      const existe = prev.some(s => s.id === atualizada.id);
      return existe ? prev.map(s => (s.id === atualizada.id ? atualizada : s)) : [...prev, atualizada];
    });
    storage.set("sec:" + atualizada.id, JSON.stringify(atualizada), false).catch(() => {});
  }

  function novaSecretaria() {
    // A nova entidade nasce no mesmo município que já está sendo visualizado
    // (quando há um selecionado); senão, no primeiro município cadastrado.
    const secAtivaAtual = secretarias.find(s => s.id === secretariaAtiva);
    const municipioContexto = secAtivaAtual?.municipioId || municipios[0]?.id || null;
    salvarSecretaria({ ...emptySecretaria("", ""), municipioId: municipioContexto });
  }

  // ----- Municípios -----
  async function salvarMunicipio(m) {
    const ehNovo = !municipios.some(x => x.id === m.id);
    const atualizado = { ...m, updatedAt: Date.now() };
    setMunicipios(prev => {
      const existe = prev.some(x => x.id === atualizado.id);
      return existe ? prev.map(x => (x.id === atualizado.id ? atualizado : x)) : [...prev, atualizado];
    });
    storage.set("municipio:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});

    // Um município recém-criado ainda não tem feriado nenhum — sem isto,
    // ele só ganharia os feriados nacionais na próxima vez que a página
    // fosse recarregada do zero, não na hora em que é criado.
    if (ehNovo) {
      try {
        const anoAtual = new Date().getFullYear();
        const novos = gerarFeriadosNacionais(anoAtual).map(f =>
          emptyFeriado({ ...f, tipo: "nacional", municipioId: atualizado.id }));
        await Promise.all(novos.map(f => storage.set("feriado:" + f.id, JSON.stringify(f), false)));
        setFeriados(prev => [...prev, ...novos].sort((a, b) => a.data.localeCompare(b.data)));
      } catch (e) { console.error("Erro ao gerar feriados nacionais para o novo município", e); }
    }
  }

  // ----- Dias Úteis -----
  function salvarFeriado(f) {
    const atualizado = { ...f, updatedAt: Date.now() };
    setFeriados(prev => {
      const existe = prev.some(x => x.id === atualizado.id);
      const lista = existe ? prev.map(x => (x.id === atualizado.id ? atualizado : x)) : [...prev, atualizado];
      return lista.sort((a, b) => a.data.localeCompare(b.data));
    });
    storage.set("feriado:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }

  async function excluirFeriado(id) {
    try {
      await storage.delete("feriado:" + id, false);
      setFeriados(prev => prev.filter(f => f.id !== id));
    } catch (err) { console.error(err); }
  }

  async function excluirMunicipio(id) {
    // Não deixa excluir o município se ainda houver entidade apontando pra ele —
    // mesma cautela já usada para não deixar entidade "órfã" em silêncio.
    if (contarEntidadesDoMunicipio(id, secretarias) > 0 || municipios.length <= 1) return;
    try {
      await storage.delete("municipio:" + id, false);
      setMunicipios(prev => prev.filter(m => m.id !== id));
    } catch (err) { console.error(err); }
  }

  async function excluirSecretaria(id) {
    // A última secretaria não pode ser removida — todo documento precisa de uma referência
    if (secretarias.length <= 1) return;
    try {
      await storage.delete("sec:" + id, false);
      setSecretarias(prev => prev.filter(s => s.id !== id));
      if (secretariaAtiva === id) setSecretariaAtiva("todas");
    } catch (err) { console.error(err); }
  }

  // ----- Justificativas de Aquisição -----
  function abrirJustificativa(doc) {
    setCurrentJust(doc);
    setView("justificativa");
  }
  function novaJustificativa(dadosIniciais) {
    const doc = emptyJustificativa();
    const sec = secretarias.find(x => x.id === dadosIniciais?.secretariaId) || secretariaParaNovoDoc();
    if (sec) {
      doc.secretariaId = sec.id;
      doc.campos.orgao = sec.nome;
    }
    if (dadosIniciais?.objeto) doc.campos.objeto = dadosIniciais.objeto;
    if (dadosIniciais?.processo) doc.campos.processo = dadosIniciais.processo;
    if (dadosIniciais?.orgao) doc.campos.orgao = dadosIniciais.orgao;
    if (dadosIniciais?.secretariaId) doc.secretariaId = dadosIniciais.secretariaId;
    storage.set("just:" + doc.id, JSON.stringify(doc), false).catch(() => {});
    setJustificativas(prev => [doc, ...prev]);
    abrirJustificativa(doc);
  }

  function duplicarJustificativa(doc, e) {
    e?.stopPropagation();
    const copia = duplicarDocumento(doc, "just");
    setJustificativas(prev => [copia, ...prev]);
    storage.set("just:" + copia.id, JSON.stringify(copia), false).catch(() => {});
  }
  function salvarJustificativa(doc) {
    if (somenteLeituraPara(doc)) return; // trava de segurança: a tela já bloqueia a edição
    const atualizado = { ...doc, updatedAt: Date.now() };
    setCurrentJust(atualizado);
    setJustificativas(prev => prev.map(d => (d.id === atualizado.id ? atualizado : d)));
    storage.set("just:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }
  async function excluirJustificativa(id, e) {
    e?.stopPropagation?.();
    const doc = justificativas.find(x => x.id === id);
    if (!doc) return;
    try {
      const reg = await moverParaLixeira(storage, "just:", id, doc);
      setJustificativas(prev => prev.filter(x => x.id !== id));
      setLixeira(prev => [reg, ...prev]);
    } catch (err) { console.error(err); }
  }

  // ----- Declarações de previsão no PCA -----
  function abrirDeclaracao(doc) {
    setCurrentDecl(doc);
    setView("declaracao");
  }
  function novaDeclaracao(dados = {}) {
    const doc = emptyDeclaracao();
    const sec = secretarias.find(x => x.id === dados.secretariaId) || secretariaParaNovoDoc();
    if (sec) {
      doc.secretariaId = sec.id;
      doc.orgao = sec.nome;
    }
    if (dados.objeto) doc.objeto = dados.objeto;
    storage.set("decl:" + doc.id, JSON.stringify(doc), false).catch(() => {});
    setDeclaracoes(prev => [doc, ...prev]);
    abrirDeclaracao(doc);
  }

  function duplicarDeclaracao(doc, e) {
    e?.stopPropagation();
    const copia = duplicarDocumento(doc, "decl");
    setDeclaracoes(prev => [copia, ...prev]);
    storage.set("decl:" + copia.id, JSON.stringify(copia), false).catch(() => {});
  }
  function salvarDeclaracao(doc) {
    if (somenteLeituraPara(doc)) return; // trava de segurança: a tela já bloqueia a edição
    const atualizado = { ...doc, updatedAt: Date.now() };
    setCurrentDecl(atualizado);
    setDeclaracoes(prev => prev.map(d => (d.id === atualizado.id ? atualizado : d)));
    storage.set("decl:" + atualizado.id, JSON.stringify(atualizado), false).catch(() => {});
  }
  async function excluirDeclaracao(id, e) {
    e?.stopPropagation?.();
    const doc = declaracoes.find(x => x.id === id);
    if (!doc) return;
    try {
      const reg = await moverParaLixeira(storage, "decl:", id, doc);
      setDeclaracoes(prev => prev.filter(x => x.id !== id));
      setLixeira(prev => [reg, ...prev]);
    } catch (err) { console.error(err); }
  }

  // ----- Lixeira -----
  async function restaurarDocumento(registro) {
    try {
      await restaurarDaLixeira(storage, registro);
      setLixeira(prev => prev.filter(r => r.id !== registro.id));
      await loadList();
    } catch (err) { console.error(err); }
  }

  async function apagarDefinitivo(registro) {
    try {
      await excluirDefinitivo(storage, registro);
      setLixeira(prev => prev.filter(r => r.id !== registro.id));
    } catch (err) { console.error(err); }
  }

  async function esvaziarLixeira() {
    try {
      for (const r of lixeira) await excluirDefinitivo(storage, r).catch(() => {});
      setLixeira([]);
    } catch (err) { console.error(err); }
  }

  function updateMeta(field, value) {
    setCurrent(prev => {
      const next = { ...prev, meta: { ...prev.meta, [field]: value }, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateSection(id, value) {
    setCurrent(prev => {
      const next = { ...prev, sections: { ...prev.sections, [id]: value }, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateItens(itens) {
    setCurrent(prev => {
      const next = { ...prev, itens, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateManuaisPca(manuaisPca) {
    setCurrent(prev => {
      const next = { ...prev, manuaisPca, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateExcluidos(incisosExcluidos) {
    setCurrent(prev => {
      const next = { ...prev, incisosExcluidos, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateSolucoesMercado(solucoesMercado) {
    setCurrent(prev => {
      const next = { ...prev, solucoesMercado, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateCotacoes(cotacoes) {
    setCurrent(prev => {
      const next = { ...prev, cotacoes, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updateValoresAdotados(valoresAdotados) {
    setCurrent(prev => {
      const next = { ...prev, valoresAdotados, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function updatePca(pca) {
    setCurrent(prev => {
      const next = { ...prev, pca, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }

  function backToList() {
    loadList();
    setView("list");
  }

  // Quem está usando o sistema e o que pode fazer
  const usuarioAtual = usuarioPorEmail(usuarios, emailUsuario);
  const permissoes = permissoesDe(usuarioAtual);
  const secretariasVisiveis = entidadesVisiveis(usuarioAtual, secretarias);
  const podeTodas = podeVerTodasEntidades(usuarioAtual);

  // Se a entidade do documento aberto foi marcada como "somente leitura" para este usuário,
  // ou se a conta não tem permissão geral de edição, a tela abre travada para consulta.
  function somenteLeituraPara(doc) {
    if (!doc) return false;
    if (!permissoes.editarDocumentos) return true;
    return entidadeEhSomenteLeitura(usuarioAtual, doc.secretariaId);
  }

  // O usuário padrão trabalha numa entidade por vez. Assim que o cadastro
  // carrega, posiciona na entidade principal dele — nunca em "todas".
  useEffect(() => {
    if (loading || podeTodas) return;
    const valida = secretariasVisiveis.some(s => s.id === secretariaAtiva);
    if (!valida) setSecretariaAtiva(entidadeInicial(usuarioAtual, secretarias) || "");
  }, [loading, podeTodas, secretariaAtiva, secretariasVisiveis.length, usuarioAtual?.id]);

  // Filtro por secretaria — vale para as três coleções. Documentos antigos (sem secretariaId)
  // pertencem à primeira secretaria cadastrada, conforme secretariaDoDoc.
  function pertenceASecretariaAtiva(doc) {
    if (secretariaAtiva === "todas") return true;
    const sec = secretariaDoDoc(doc, secretarias);
    return sec?.id === secretariaAtiva;
  }

  const etpsDaSecretaria = etps.filter(pertenceASecretariaAtiva);
  const justificativasDaSecretaria = justificativas.filter(pertenceASecretariaAtiva);
  const declaracoesDaSecretaria = declaracoes.filter(pertenceASecretariaAtiva);
  const ofsDaSecretaria = ofs.filter(pertenceASecretariaAtiva);

  const filteredEtps = etpsDaSecretaria.filter(e => {
    const nomesResponsaveis = listaResponsaveis(e).map(r => r.nome).join(" ");
    return (e.meta.titulo + " " + e.meta.orgao + " " + e.meta.processo + " " + nomesResponsaveis)
      .toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ background: C.paperDark, height: "100%", minHeight: 0, fontFamily: "'Inter', system-ui, sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap');
        html, body, #root { height: 100%; }
        .serif { font-family: 'Source Serif 4', Georgia, serif; }
        .etp-scroll::-webkit-scrollbar { width: 8px; }
        .etp-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        textarea:focus, input:focus, select:focus { outline: 2px solid ${C.brass}; outline-offset: 1px; }
        [contenteditable]:focus { outline: 2px solid ${C.brass}; outline-offset: -2px; }
        .rich-content table, [contenteditable] table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .rich-content td, .rich-content th, [contenteditable] td, [contenteditable] th { border: 1px solid ${C.border}; padding: 6px 8px; }
        .rich-content ul, [contenteditable] ul { list-style: disc; padding-left: 1.4em; }
        .rich-content ol, [contenteditable] ol { list-style: decimal; padding-left: 1.4em; }
        .rich-content p, [contenteditable] p { margin: 0 0 8px; }
        .rich-content h4, [contenteditable] h4 { font-size: 1.05em; font-weight: 700; margin: 10px 0 4px; }
        .rich-content h5, [contenteditable] h5 { font-size: 1em; font-weight: 700; font-style: italic; margin: 8px 0 4px; }
        .rich-content h6, [contenteditable] h6 { font-size: 0.95em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin: 8px 0 4px; }
        .rich-content blockquote, [contenteditable] blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid ${C.brass}; font-style: italic; color: ${C.inkMuted}; }
        .rich-content hr, [contenteditable] hr { border: none; border-top: 1px solid ${C.border}; margin: 12px 0; }
        @media print {
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; margin: 0 !important; }
          .print-area, .print-area * { color: #000 !important; }
          .print-area blockquote { border-left-color: #000 !important; }
          .print-area table, .print-area td, .print-area th { border-color: #000 !important; }
          .print-area th { background: #eeeeee !important; }
          .print-area tr:nth-child(even) td { background: transparent !important; }
          .timbre-inline-print { display: none !important; }
          .timbre-fixed-print {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            text-align: center;
            padding: 6px 0 10px;
            background: white;
          }
          .print-area { padding-top: 110px !important; line-height: 1.5; }
          .print-area .titulo-inciso { text-transform: uppercase; letter-spacing: 0.3px; }
        }
        .timbre-fixed-print { display: none; }
      `}</style>

      {(view === "list" || (view === "justificativa" && currentJust) || (view === "declaracao" && currentDecl)) && (
        <ListView
          etps={filteredEtps} todosEtps={etpsDaSecretaria}
          justificativas={justificativasDaSecretaria} declaracoes={declaracoesDaSecretaria}
          ofs={ofsDaSecretaria} fornecedores={fornecedores} onSalvarFornecedor={salvarFornecedor}
          onExcluirFornecedor={excluirFornecedor} todasAsOfs={ofs}
          onRecarregarOfs={loadList}
          secretarias={secretariasVisiveis} secretariaAtiva={secretariaAtiva} setSecretariaAtiva={setSecretariaAtiva}
          loading={loading} search={search} setSearch={setSearch}
          onOpen={openEtp} onNew={newEtp} onDelete={deleteEtp} onDuplicar={duplicarEtp}
          onAbrirDeclaracao={abrirDeclaracao} onNovaDeclaracao={novaDeclaracao}
          onExcluirDeclaracao={excluirDeclaracao} onDuplicarDeclaracao={duplicarDeclaracao}
          onAbrirJustificativa={abrirJustificativa} onNovaJustificativa={novaJustificativa}
          onExcluirJustificativa={excluirJustificativa} onDuplicarJustificativa={duplicarJustificativa}
          onSalvarSecretaria={salvarSecretaria} onNovaSecretaria={novaSecretaria}
          onExcluirSecretaria={excluirSecretaria}
          municipios={municipios} onNovoMunicipio={salvarMunicipio} onExcluirMunicipio={excluirMunicipio}
          feriados={feriados} onSalvarFeriado={salvarFeriado} onExcluirFeriado={excluirFeriado}
          onRecarregar={loadList}
          usuarios={usuarios} emailUsuario={emailUsuario} usuarioAtual={usuarioAtual} permissoes={permissoes}
          podeVerTodasEntidades={podeTodas}
          onSalvarUsuario={salvarUsuario} onExcluirUsuario={excluirUsuario}
          normativos={normativos} onUploadNormativo={uploadNormativo} onExcluirNormativo={excluirNormativo}
          lixeira={lixeira} onRestaurar={restaurarDocumento}
          onApagarDefinitivo={apagarDefinitivo} onEsvaziar={esvaziarLixeira}
          viewAtual={view} onFecharDocumento={backToList}
          documentoAberto={
            view === "justificativa" && currentJust ? (
              <JustificativaView doc={currentJust} secretarias={secretarias}
                onSalvar={salvarJustificativa} onBack={backToList}
                somenteLeitura={somenteLeituraPara(currentJust)} embutido />
            ) : view === "declaracao" && currentDecl ? (
              <DeclaracaoView doc={currentDecl} secretarias={secretarias}
                onSalvar={salvarDeclaracao} onBack={backToList}
                onGerarJustificativa={(dados) => novaJustificativa(dados)}
                somenteLeitura={somenteLeituraPara(currentDecl)} embutido />
            ) : null
          }
        />
      )}

      {view === "editor" && current && (
        <EditorView
          etp={current} activeSection={activeSection} setActiveSection={setActiveSection}
          onMeta={updateMeta} onSection={updateSection} onItens={updateItens} onCotacoes={updateCotacoes}
          onSolucoesMercado={updateSolucoesMercado} onExcluidos={updateExcluidos} secretarias={secretarias}
          onManuaisPca={updateManuaisPca}
          onValoresAdotados={updateValoresAdotados} onPca={updatePca}
          saveState={saveState} onBack={backToList} onPreview={() => setView("preview")}
          somenteLeitura={somenteLeituraPara(current)}
        />
      )}

      {view === "preview" && current && (
        <PreviewView etp={current} secretarias={secretarias} onBack={() => setView("editor")} />
      )}
    </div>
  );
}
