/**
 * Importar várias Ordens de Fornecimento de uma vez — um PDF por OF.
 *
 * Cada arquivo vira uma linha numa tabela de revisão (não um modal por
 * arquivo): número extraído, fornecedor batido pelo CNPJ, e-mail. Linhas com
 * problema (e-mail faltando, número repetido — contra o banco e entre os
 * próprios arquivos do lote) ficam sinalizadas e não entram no disparo.
 *
 * Disparar em lote continua exigindo confirmação explícita, com a lista de
 * destinatários visível antes do envio — igual ao disparo de uma OF só.
 */

import React, { useState } from "react";
import { X, Upload, AlertCircle, Loader2, Mail, ChevronDown, Settings2 } from "lucide-react";
import { C } from "../tokens.js";
import { AreaUpload } from "../comuns/index.jsx";
import { extrairDadosDoPdf, gerarNumeroOfSugerido, emptyOf, recalcularErrosLote } from "../../dominio/of.js";
import { buscarFornecedorPorCnpj, upsertFornecedor, cnpjValido, normalizarCnpj } from "../../dominio/fornecedores.js";
import { lerPdfDeArquivo, salvarOf, dispararNotificacaoFornecedor, dispararLote } from "../../of-servico.js";
import { resolverCabecalho, prepararCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { resolverCredenciaisEmailJs } from "../../dominio/emailjs-config.js";
import { reparticoesDaEntidade } from "../../dominio/reparticoes.js";

export function ImportarLoteModal({ ofsExistentes, fornecedores, secretarias, secretariaId, municipioId, emailUsuario, reparticoes = [], onFechar, onSalvarFornecedor, onConcluido }) {
  const [itens, setItens] = useState([]); // { idLocal, arquivo, numeroOf, empresa, cnpj, emailFornecedor, pdfBase64, marcado, prazoDias, tipoContagemPrazo, reparticaoId, personalizado }
  const [processando, setProcessando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [resultado, setResultado] = useState(null); // { sucesso: [], falhas: [] }
  const [erro, setErro] = useState("");
  const [itemExpandidoId, setItemExpandidoId] = useState(null);

  // Padrão aplicado a todas as OFs do lote, de uma vez -- qualquer item que
  // não tenha sido personalizado individualmente usa isso. Mudar aqui
  // atualiza todo mundo que ainda está no padrão; quem já foi personalizado
  // (ver "personalizado" por item) não é mais tocado por essa mudança.
  const [prazoDiasPadrao, setPrazoDiasPadrao] = useState(10);
  const [tipoContagemPadrao, setTipoContagemPadrao] = useState("corridos");
  const [reparticaoIdPadrao, setReparticaoIdPadrao] = useState("");
  const reparticoesDaEntidadeAtiva = reparticoesDaEntidade(secretariaId, reparticoes);

  function recalcularErros(lista) {
    return recalcularErrosLote(lista, ofsExistentes);
  }

  // O que vale de verdade pra um item: o próprio valor, se foi
  // personalizado, senão o padrão do lote inteiro.
  function valoresEfetivos(item) {
    return {
      prazoDias: item.personalizado ? item.prazoDias : prazoDiasPadrao,
      tipoContagemPrazo: item.personalizado ? item.tipoContagemPrazo : tipoContagemPadrao,
      reparticaoId: item.personalizado ? item.reparticaoId : (reparticaoIdPadrao || null),
    };
  }

  async function processarArquivos(fileList) {
    const arquivos = Array.from(fileList || []);
    if (arquivos.length === 0) return;
    setProcessando(true);
    setErro("");
    const novosItens = [];
    for (const file of arquivos) {
      try {
        const { pdfBase64, textoCompleto } = await lerPdfDeArquivo(file);
        const extraido = extrairDadosDoPdf(textoCompleto);
        const cnpjNormalizado = normalizarCnpj(extraido.cnpj);
        const fornecedor = cnpjNormalizado ? buscarFornecedorPorCnpj(fornecedores, cnpjNormalizado) : null;
        novosItens.push({
          idLocal: "lote_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          arquivo: file.name,
          numeroOf: extraido.numeroOf || gerarNumeroOfSugerido(),
          empresa: fornecedor?.razaoSocial || extraido.empresa || "",
          cnpj: cnpjNormalizado,
          emailFornecedor: fornecedor?.email || "",
          telefoneFornecedor: fornecedor?.telefone || "",
          pdfBase64,
          jaCadastrado: !!fornecedor,
          marcado: true,
          personalizado: false, prazoDias: null, tipoContagemPrazo: null, reparticaoId: null,
        });
      } catch (e2) {
        novosItens.push({
          idLocal: "lote_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
          arquivo: file.name, numeroOf: "", empresa: "", cnpj: "", emailFornecedor: "",
          pdfBase64: "", marcado: false, erroLeitura: "Não foi possível ler este PDF.",
        });
      }
    }
    setItens(prev => recalcularErros([...prev, ...novosItens]));
    setProcessando(false);
  }

  function atualizarItem(idLocal, campos) {
    setItens(prev => recalcularErros(prev.map(i => (i.idLocal === idLocal ? { ...i, ...campos } : i))));
  }

  function removerItem(idLocal) {
    setItens(prev => recalcularErros(prev.filter(i => i.idLocal !== idLocal)));
  }

  const prontos = itens.filter(i => i.marcado && !i.erro && !i.erroLeitura);
  const comProblema = itens.filter(i => i.erro || i.erroLeitura);

  async function handleSalvarRascunhos() {
    setDisparando(true);
    // Mesmo timbre pra todas as OFs do lote -- todas são da mesma entidade.
    const timbreSnapshot = await prepararCabecalho(resolverCabecalho({ secretariaId }, secretarias, TIMBRE_PADRAO));
    const secretariaDoLote = secretarias?.find(s => s.id === secretariaId);
    const emailJsSnapshot = resolverCredenciaisEmailJs(secretariaDoLote);
    const nomeEntidadeSnapshot = secretariaDoLote?.sigla || secretariaDoLote?.nome || null;
    const sucesso = []; const falhas = [];
    let fornecedoresAcumulados = fornecedores; // atualizado a cada volta, pra reconhecer o mesmo CNPJ dentro do próprio lote
    for (const item of itens.filter(i => !i.erroLeitura && i.erro !== "Número de OF repetido")) {
      try {
        const efetivos = valoresEfetivos(item);
        await salvarOf(emptyOf({
          numeroOf: item.numeroOf, empresa: item.empresa, cnpj: item.cnpj,
          emailFornecedor: item.emailFornecedor, telefoneFornecedor: item.telefoneFornecedor, pdfBase64: item.pdfBase64, secretariaId, municipioId,
          timbreSnapshot, emailJsSnapshot, nomeEntidadeSnapshot, ...efetivos,
        }));
        if (cnpjValido(item.cnpj)) {
          const atualizado = upsertFornecedor(fornecedoresAcumulados, {
            cnpj: item.cnpj, razaoSocial: item.empresa, email: item.emailFornecedor, telefone: item.telefoneFornecedor,
          });
          onSalvarFornecedor(atualizado);
          fornecedoresAcumulados = [...fornecedoresAcumulados.filter(f => f.id !== atualizado.id), atualizado];
        }
        sucesso.push(item);
      } catch (e2) { falhas.push({ item, motivo: e2.message || String(e2) }); }
    }
    setResultado({ sucesso, falhas, modo: "rascunho" });
    setDisparando(false);
  }

  async function handleDispararSelecionadas() {
    setDisparando(true);
    setConfirmando(false);
    const timbreSnapshot = await prepararCabecalho(resolverCabecalho({ secretariaId }, secretarias, TIMBRE_PADRAO));
    const secretariaDoLote = secretarias?.find(s => s.id === secretariaId);
    const emailJsSnapshot = resolverCredenciaisEmailJs(secretariaDoLote);
    const nomeEntidadeSnapshot = secretariaDoLote?.sigla || secretariaDoLote?.nome || null;
    const sucesso = []; const falhas = [];
    let fornecedoresAcumulados = fornecedores; // atualizado a cada volta, pra reconhecer o mesmo CNPJ dentro do próprio lote

    // Junta as OFs do mesmo CNPJ num grupo só -- viram um único e-mail (ver
    // dispararLote), em vez de um e-mail por OF pra mesma empresa. Sem CNPJ
    // válido, cada item fica isolado no seu próprio grupo (não dá pra saber
    // se são da mesma empresa sem o CNPJ).
    const gruposPorCnpj = new Map();
    for (const item of prontos) {
      const chave = cnpjValido(item.cnpj) ? normalizarCnpj(item.cnpj) : `_isolado_${item.idLocal}`;
      if (!gruposPorCnpj.has(chave)) gruposPorCnpj.set(chave, []);
      gruposPorCnpj.get(chave).push(item);
    }

    for (const grupo of gruposPorCnpj.values()) {
      try {
        if (grupo.length === 1) {
          const item = grupo[0];
          const efetivos = valoresEfetivos(item);
          const salva = await salvarOf(emptyOf({
            numeroOf: item.numeroOf, empresa: item.empresa, cnpj: item.cnpj,
            emailFornecedor: item.emailFornecedor, telefoneFornecedor: item.telefoneFornecedor, pdfBase64: item.pdfBase64, secretariaId, municipioId,
            timbreSnapshot, emailJsSnapshot, nomeEntidadeSnapshot, ...efetivos,
          }));
          await dispararNotificacaoFornecedor(salva, emailUsuario);
        } else {
          const payloads = grupo.map(item => emptyOf({
            numeroOf: item.numeroOf, empresa: item.empresa, cnpj: item.cnpj,
            emailFornecedor: item.emailFornecedor, telefoneFornecedor: item.telefoneFornecedor, pdfBase64: item.pdfBase64, secretariaId, municipioId,
            timbreSnapshot, emailJsSnapshot, nomeEntidadeSnapshot, ...valoresEfetivos(item),
          }));
          await dispararLote(payloads, secretariaId, emailUsuario);
        }
        for (const item of grupo) {
          if (cnpjValido(item.cnpj)) {
            const atualizado = upsertFornecedor(fornecedoresAcumulados, {
              cnpj: item.cnpj, razaoSocial: item.empresa, email: item.emailFornecedor, telefone: item.telefoneFornecedor,
            });
            onSalvarFornecedor(atualizado);
            fornecedoresAcumulados = [...fornecedoresAcumulados.filter(f => f.id !== atualizado.id), atualizado];
          }
          sucesso.push(item);
        }
      } catch (e2) {
        for (const item of grupo) falhas.push({ item, motivo: e2.message || String(e2) });
      }
    }
    setResultado({ sucesso, falhas, modo: "disparo" });
    setDisparando(false);
  }

  function fecharTudo() {
    if (resultado) onConcluido?.();
    onFechar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(18,32,50,0.65)" }}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-white border-b z-10" style={{ borderColor: C.border }}>
          <div>
            <h2 className="serif text-lg font-semibold" style={{ color: C.navy }}>Importar várias Ordens de Fornecimento</h2>
            <p className="text-xs" style={{ color: C.inkMuted }}>Um PDF por OF — revise tudo aqui antes de disparar.</p>
          </div>
          <button onClick={fecharTudo} style={{ color: C.inkMuted }}><X size={18} /></button>
        </div>

        <div className="p-5">
          {resultado ? (
            <div>
              <div className="p-4 rounded-lg mb-4" style={{ background: "rgba(76,124,89,0.1)" }}>
                <p className="text-sm font-semibold" style={{ color: C.green }}>
                  {resultado.sucesso.length} {resultado.modo === "disparo" ? "disparada(s) com sucesso" : "salva(s) como rascunho"}
                </p>
              </div>
              {resultado.falhas.length > 0 && (
                <div className="p-4 rounded-lg mb-4" style={{ background: "rgba(166,64,61,0.1)" }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: C.red }}>{resultado.falhas.length} com falha:</p>
                  {resultado.falhas.map(f => (
                    <p key={f.item.idLocal} className="text-xs" style={{ color: C.ink }}>
                      {f.item.arquivo} ({f.item.numeroOf}): {f.motivo}
                    </p>
                  ))}
                </div>
              )}
              <button onClick={fecharTudo} className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: C.navy, color: C.paper }}>
                Concluir
              </button>
            </div>
          ) : (
            <>
              <AreaUpload onArquivos={processarArquivos} accept="application/pdf" multiple disabled={processando}
                className="block border-2 border-dashed rounded-xl p-6 text-center text-sm mb-4"
                style={{ borderColor: C.border, color: C.inkMuted }}>
                {processando ? <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: C.brass }} />
                  : <Upload size={20} className="mx-auto mb-2" style={{ color: C.brass }} />}
                {processando ? "Lendo os arquivos..." : (
                  <>Clique ou arraste os PDFs aqui — <b style={{ color: C.navy }}>pode soltar vários de uma vez</b></>
                )}
              </AreaUpload>

              {erro && (
                <div className="mb-4 p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.red }} />{erro}
                </div>
              )}

              {itens.length > 0 && (
                <>
                  <div className="rounded-xl border p-3.5 mb-4" style={{ borderColor: C.border, background: C.paperDark }}>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Settings2 size={13} style={{ color: C.brass }} />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                        Configurações padrão do lote
                      </span>
                    </div>
                    <p className="text-[11px] mb-3" style={{ color: C.inkMuted }}>
                      Vale pra todas as OFs abaixo, exceto as que você personalizar individualmente (clique em
                      "Personalizar" na linha dela).
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <label className="block">
                        <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Prazo de entrega (dias)</span>
                        <input type="number" min="1" value={prazoDiasPadrao} onChange={e => setPrazoDiasPadrao(e.target.value)}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }} />
                      </label>
                      <label className="block">
                        <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Como contar o prazo</span>
                        <select value={tipoContagemPadrao} onChange={e => setTipoContagemPadrao(e.target.value)}
                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
                          <option value="corridos">Dias corridos</option>
                          <option value="uteis">Dias úteis</option>
                        </select>
                      </label>
                      {reparticoesDaEntidadeAtiva.length > 0 && (
                        <label className="block">
                          <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Repartição (opcional)</span>
                          <select value={reparticaoIdPadrao} onChange={e => setReparticaoIdPadrao(e.target.value)}
                            className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
                            <option value="">Nenhuma específica</option>
                            {reparticoesDaEntidadeAtiva.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border overflow-x-auto etp-scroll mb-4" style={{ borderColor: C.border }}>
                    <table className="w-full text-xs" style={{ minWidth: "680px" }}>
                      <thead>
                        <tr style={{ background: C.paperDark }}>
                          {["", "Arquivo", "Nº OF", "Empresa", "E-mail", "Prazo", "Situação", ""].map(t => (
                            <th key={t} className="text-left px-2.5 py-2 font-semibold uppercase text-[10px]" style={{ color: C.inkMuted }}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map(item => {
                          const expandido = itemExpandidoId === item.idLocal;
                          const efetivos = valoresEfetivos(item);
                          return (
                            <React.Fragment key={item.idLocal}>
                              <tr className="border-t" style={{ borderColor: C.border }}>
                                <td className="px-2.5 py-2">
                                  <input type="checkbox" checked={item.marcado} disabled={!!item.erro || !!item.erroLeitura}
                                    onChange={e => atualizarItem(item.idLocal, { marcado: e.target.checked })} />
                                </td>
                                <td className="px-2.5 py-2" style={{ color: C.inkMuted, maxWidth: 120 }}>
                                  <span className="block truncate" title={item.arquivo}>{item.arquivo}</span>
                                </td>
                                <td className="px-2.5 py-2">
                                  <input value={item.numeroOf} onChange={e => atualizarItem(item.idLocal, { numeroOf: e.target.value })}
                                    className="w-24 px-1.5 py-1 rounded border text-xs" style={{ borderColor: C.border }} />
                                </td>
                                <td className="px-2.5 py-2">
                                  <input value={item.empresa} onChange={e => atualizarItem(item.idLocal, { empresa: e.target.value })}
                                    className="w-32 px-1.5 py-1 rounded border text-xs" style={{ borderColor: C.border }} />
                                  {item.jaCadastrado && <span className="block text-[10px]" style={{ color: C.green }}>já cadastrado</span>}
                                </td>
                                <td className="px-2.5 py-2">
                                  <input value={item.emailFornecedor} onChange={e => atualizarItem(item.idLocal, { emailFornecedor: e.target.value })}
                                    className="w-36 px-1.5 py-1 rounded border text-xs mb-1" style={{ borderColor: C.border }} />
                                  <input value={item.telefoneFornecedor} onChange={e => atualizarItem(item.idLocal, { telefoneFornecedor: e.target.value })}
                                    placeholder="Telefone (opcional)"
                                    className="w-36 px-1.5 py-1 rounded border text-xs" style={{ borderColor: C.border }} />
                                </td>
                                <td className="px-2.5 py-2">
                                  <button onClick={() => setItemExpandidoId(expandido ? null : item.idLocal)}
                                    className="flex items-center gap-1 text-[11px] whitespace-nowrap"
                                    style={{ color: item.personalizado ? C.brass : C.inkMuted, fontWeight: item.personalizado ? 600 : 400 }}>
                                    {efetivos.prazoDias} dia(s){item.personalizado ? " *" : ""}
                                    <ChevronDown size={11} style={{ transform: expandido ? "rotate(180deg)" : "none" }} />
                                  </button>
                                </td>
                                <td className="px-2.5 py-2">
                                  {item.erroLeitura ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(166,64,61,0.14)", color: C.red }}>{item.erroLeitura}</span>
                                  ) : item.erro ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(166,64,61,0.14)", color: C.red }}>{item.erro}</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(76,124,89,0.14)", color: C.green }}>Pronta</span>
                                  )}
                                </td>
                                <td className="px-2.5 py-2">
                                  <button onClick={() => removerItem(item.idLocal)} style={{ color: C.red }}><X size={13} /></button>
                                </td>
                              </tr>
                              {expandido && (
                                <tr style={{ background: C.paperDark }}>
                                  <td colSpan={8} className="px-4 py-3">
                                    <p className="text-[10.5px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.inkMuted }}>
                                      Personalizar só esta OF (nº {item.numeroOf || "—"})
                                    </p>
                                    <div className="grid sm:grid-cols-3 gap-3 mb-2">
                                      <label className="block">
                                        <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Prazo de entrega (dias)</span>
                                        <input type="number" min="1" value={item.personalizado ? (item.prazoDias ?? prazoDiasPadrao) : prazoDiasPadrao}
                                          onChange={e => atualizarItem(item.idLocal, { personalizado: true, prazoDias: e.target.value, tipoContagemPrazo: item.tipoContagemPrazo ?? tipoContagemPadrao, reparticaoId: item.reparticaoId ?? (reparticaoIdPadrao || null) })}
                                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }} />
                                      </label>
                                      <label className="block">
                                        <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Como contar o prazo</span>
                                        <select value={item.personalizado ? (item.tipoContagemPrazo ?? tipoContagemPadrao) : tipoContagemPadrao}
                                          onChange={e => atualizarItem(item.idLocal, { personalizado: true, tipoContagemPrazo: e.target.value, prazoDias: item.prazoDias ?? prazoDiasPadrao, reparticaoId: item.reparticaoId ?? (reparticaoIdPadrao || null) })}
                                          className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
                                          <option value="corridos">Dias corridos</option>
                                          <option value="uteis">Dias úteis</option>
                                        </select>
                                      </label>
                                      {reparticoesDaEntidadeAtiva.length > 0 && (
                                        <label className="block">
                                          <span className="text-[10.5px]" style={{ color: C.inkMuted }}>Repartição (opcional)</span>
                                          <select value={item.personalizado ? (item.reparticaoId ?? reparticaoIdPadrao ?? "") : reparticaoIdPadrao}
                                            onChange={e => atualizarItem(item.idLocal, { personalizado: true, reparticaoId: e.target.value || null, prazoDias: item.prazoDias ?? prazoDiasPadrao, tipoContagemPrazo: item.tipoContagemPrazo ?? tipoContagemPadrao })}
                                            className="mt-1 w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white" style={{ borderColor: C.border }}>
                                            <option value="">Nenhuma específica</option>
                                            {reparticoesDaEntidadeAtiva.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                          </select>
                                        </label>
                                      )}
                                    </div>
                                    {item.personalizado && (
                                      <button onClick={() => atualizarItem(item.idLocal, { personalizado: false, prazoDias: null, tipoContagemPrazo: null, reparticaoId: null })}
                                        className="text-[11px] font-medium underline" style={{ color: C.inkMuted }}>
                                        Voltar a usar o padrão do lote
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs" style={{ color: C.inkMuted }}>
                      <b style={{ color: C.navy }}>{prontos.length} de {itens.length}</b> prontas para disparar
                      {comProblema.length > 0 && ` · ${comProblema.length} precisam de atenção`}
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={handleSalvarRascunhos} disabled={disparando}
                        className="px-3.5 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                        style={{ background: "white", color: C.navy, border: `1px solid ${C.border}` }}>
                        Salvar todas como rascunho
                      </button>
                      <button onClick={() => setConfirmando(true)} disabled={disparando || prontos.length === 0}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: C.navy, color: C.paper }}>
                        <Mail size={14} /> Disparar as {prontos.length} selecionadas
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {confirmando && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <h3 className="serif text-lg font-semibold mb-2" style={{ color: C.navy }}>Disparar {prontos.length} e-mail(s) reais?</h3>
            <p className="text-xs mb-3" style={{ color: C.inkMuted }}>
              Isso não pode ser desfeito. Um e-mail será enviado agora para cada um destes fornecedores:
            </p>
            <ul className="text-xs mb-4 max-h-40 overflow-y-auto etp-scroll list-disc pl-4" style={{ color: C.ink }}>
              {prontos.map(i => <li key={i.idLocal}>{i.empresa || "(sem nome)"} — {i.emailFornecedor}</li>)}
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmando(false)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button onClick={handleDispararSelecionadas} disabled={disparando}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: C.navy, color: C.paper }}>
                {disparando ? "Enviando..." : "Confirmar e enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
