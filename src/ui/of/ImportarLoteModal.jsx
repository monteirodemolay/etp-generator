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
import { X, Upload, AlertCircle, Loader2, Mail } from "lucide-react";
import { C } from "../tokens.js";
import { extrairDadosDoPdf, gerarNumeroOfSugerido, emptyOf, recalcularErrosLote } from "../../dominio/of.js";
import { buscarFornecedorPorCnpj, upsertFornecedor, cnpjValido, normalizarCnpj } from "../../dominio/fornecedores.js";
import { lerPdfDeArquivo, salvarOf, dispararNotificacaoFornecedor } from "../../of-servico.js";
import { resolverCabecalho, prepararCabecalho } from "../../docx/timbre.js";
import { TIMBRE_PADRAO } from "../../docx/timbre-padrao.js";
import { resolverCredenciaisEmailJs } from "../../dominio/emailjs-config.js";

export function ImportarLoteModal({ ofsExistentes, fornecedores, secretarias, secretariaId, municipioId, onFechar, onSalvarFornecedor, onConcluido }) {
  const [itens, setItens] = useState([]); // { idLocal, arquivo, numeroOf, empresa, cnpj, emailFornecedor, pdfBase64, marcado }
  const [processando, setProcessando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [resultado, setResultado] = useState(null); // { sucesso: [], falhas: [] }
  const [erro, setErro] = useState("");

  function recalcularErros(lista) {
    return recalcularErrosLote(lista, ofsExistentes);
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
          pdfBase64,
          jaCadastrado: !!fornecedor,
          marcado: true,
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
    for (const item of itens.filter(i => !i.erroLeitura && i.erro !== "Número de OF repetido")) {
      try {
        await salvarOf(emptyOf({
          numeroOf: item.numeroOf, empresa: item.empresa, cnpj: item.cnpj,
          emailFornecedor: item.emailFornecedor, pdfBase64: item.pdfBase64, secretariaId, municipioId,
          timbreSnapshot, emailJsSnapshot, nomeEntidadeSnapshot,
        }));
        if (cnpjValido(item.cnpj)) {
          onSalvarFornecedor(upsertFornecedor(fornecedores, {
            cnpj: item.cnpj, razaoSocial: item.empresa, email: item.emailFornecedor,
          }));
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
    for (const item of prontos) {
      try {
        const salva = await salvarOf(emptyOf({
          numeroOf: item.numeroOf, empresa: item.empresa, cnpj: item.cnpj,
          emailFornecedor: item.emailFornecedor, pdfBase64: item.pdfBase64, secretariaId, municipioId,
          timbreSnapshot, emailJsSnapshot, nomeEntidadeSnapshot,
        }));
        await dispararNotificacaoFornecedor(salva);
        if (cnpjValido(item.cnpj)) {
          onSalvarFornecedor(upsertFornecedor(fornecedores, {
            cnpj: item.cnpj, razaoSocial: item.empresa, email: item.emailFornecedor,
          }));
        }
        sucesso.push(item);
      } catch (e2) { falhas.push({ item, motivo: e2.message || String(e2) }); }
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
              <label className="block border-2 border-dashed rounded-xl p-6 text-center text-sm mb-4 cursor-pointer"
                style={{ borderColor: C.border, color: C.inkMuted }}>
                {processando ? <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: C.brass }} />
                  : <Upload size={20} className="mx-auto mb-2" style={{ color: C.brass }} />}
                {processando ? "Lendo os arquivos..." : (
                  <>Clique para escolher os PDFs — <b style={{ color: C.navy }}>pode selecionar vários de uma vez</b></>
                )}
                <input type="file" accept="application/pdf" multiple className="hidden" disabled={processando}
                  onChange={e => { processarArquivos(e.target.files); e.target.value = ""; }} />
              </label>

              {erro && (
                <div className="mb-4 p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: C.red }} />{erro}
                </div>
              )}

              {itens.length > 0 && (
                <>
                  <div className="rounded-xl border overflow-x-auto etp-scroll mb-4" style={{ borderColor: C.border }}>
                    <table className="w-full text-xs" style={{ minWidth: "680px" }}>
                      <thead>
                        <tr style={{ background: C.paperDark }}>
                          {["", "Arquivo", "Nº OF", "Empresa", "E-mail", "Situação", ""].map(t => (
                            <th key={t} className="text-left px-2.5 py-2 font-semibold uppercase text-[10px]" style={{ color: C.inkMuted }}>{t}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map(item => (
                          <tr key={item.idLocal} className="border-t" style={{ borderColor: C.border }}>
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
                                className="w-36 px-1.5 py-1 rounded border text-xs" style={{ borderColor: C.border }} />
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
                        ))}
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
