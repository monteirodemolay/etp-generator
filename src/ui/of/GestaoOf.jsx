/**
 * Gestão de Ordens de Fornecimento — tela dentro do painel autenticado.
 *
 * Importa o PDF (extração automática, best-effort) ou cria manualmente,
 * busca o fornecedor já cadastrado pelo CNPJ, e dispara a notificação por
 * e-mail com confirmação prévia — nunca envia direto ao clicar.
 */

import React, { useState, useRef } from "react";
import { Upload, Plus, Trash2, Mail, Printer, Download, Pencil, AlertCircle, Info, Loader2, PackageCheck } from "lucide-react";
import { C } from "../tokens.js";
import { ConfirmarExclusao } from "../comuns/index.jsx";
import { extrairDadosDoPdf, gerarNumeroOfSugerido, numeroOfDuplicado,
  calcularSituacao, emptyOf } from "../../dominio/of.js";
import { normalizarCnpj, formatarCnpj, cnpjValido,
  buscarFornecedorPorCnpj, upsertFornecedor, resumoHistoricoFornecedor } from "../../dominio/fornecedores.js";
import { lerPdfDeArquivo, salvarOf, excluirOf, dispararNotificacaoFornecedor, confirmarEntrega } from "../../of-servico.js";
import { todayISO, fmtDateISO } from "../../dominio/datas.js";

const COR_SITUACAO = {
  "rascunho": C.inkMuted, "aguardando": C.brass, "sem-resposta": "#fd7e14",
  "divergencia": "#b45309", "vencido": C.red, "em-dia": C.green, "atrasado": C.red,
  "aguardando-entrega": C.brass, "aguardando-confirmacao": "#fd7e14", "nao-entregue": C.red,
};

export function GestaoOf({ ofs, fornecedores, secretariaId, onRecarregar, onSalvarFornecedor, emailUsuario }) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(emptyOf());
  const [lendoPdf, setLendoPdf] = useState(false);
  const [aExcluir, setAExcluir] = useState(null);
  const [aDisparar, setADisparar] = useState(null); // OF aguardando confirmação de envio
  const [confirmandoEntregaDe, setConfirmandoEntregaDe] = useState(null); // OF cuja entrega está sendo confirmada
  const [dataEntregaForm, setDataEntregaForm] = useState(todayISO());
  const [naoEntregueForm, setNaoEntregueForm] = useState(false);
  const [salvandoEntrega, setSalvandoEntrega] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const inputRef = useRef(null);

  function abrirNova() {
    setEditando(emptyOf({ numeroOf: gerarNumeroOfSugerido(), secretariaId }));
    setErro("");
    setModalAberto(true);
  }

  async function handleImportarPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLendoPdf(true);
    setErro("");
    try {
      const { pdfBase64, textoCompleto } = await lerPdfDeArquivo(file);
      const extraido = extrairDadosDoPdf(textoCompleto);
      const fornecedor = extraido.cnpj ? buscarFornecedorPorCnpj(fornecedores, extraido.cnpj) : null;
      setEditando(emptyOf({
        numeroOf: extraido.numeroOf || gerarNumeroOfSugerido(),
        empresa: fornecedor?.razaoSocial || extraido.empresa,
        cnpj: extraido.cnpj,
        emailFornecedor: fornecedor?.email || "",
        telefoneFornecedor: fornecedor?.telefone || "",
        pdfBase64,
        secretariaId,
      }));
      setModalAberto(true);
    } catch (e2) {
      setErro("Não foi possível ler o PDF: " + (e2.message || e2));
    }
    setLendoPdf(false);
    e.target.value = "";
  }

  // Ao sair do campo CNPJ, busca no cadastro — se achar, preenche o resto.
  function aoSairDoCnpj() {
    const fornecedor = buscarFornecedorPorCnpj(fornecedores, editando.cnpj);
    if (fornecedor) {
      setEditando(prev => ({
        ...prev,
        empresa: prev.empresa || fornecedor.razaoSocial,
        emailFornecedor: prev.emailFornecedor || fornecedor.email,
        telefoneFornecedor: prev.telefoneFornecedor || fornecedor.telefone,
      }));
      setAviso(`Fornecedor já cadastrado: ${fornecedor.razaoSocial}`);
      setTimeout(() => setAviso(""), 4000);
    }
  }

  async function persistirFornecedor(of) {
    if (!cnpjValido(of.cnpj)) return;
    const atualizado = upsertFornecedor(fornecedores, {
      cnpj: of.cnpj, razaoSocial: of.empresa, email: of.emailFornecedor, telefone: of.telefoneFornecedor,
    });
    onSalvarFornecedor(atualizado);
  }

  async function handleSalvarRascunho(e) {
    e.preventDefault();
    if (numeroOfDuplicado(editando.numeroOf, ofs, editando.id)) {
      setErro(`Já existe outra OF com o número "${editando.numeroOf}". Confira antes de salvar.`);
      return;
    }
    try {
      await salvarOf(editando);
      await persistirFornecedor(editando);
      setModalAberto(false);
      onRecarregar();
    } catch (e2) {
      setErro("Erro ao salvar: " + (e2.message || e2));
    }
  }

  async function confirmarDisparo() {
    setEnviando(true);
    setErro("");
    try {
      await dispararNotificacaoFornecedor(aDisparar);
      await persistirFornecedor(aDisparar);
      setADisparar(null);
      setModalAberto(false);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível enviar: " + (e2.message || e2));
    }
    setEnviando(false);
  }

  function abrirConfirmacaoEntrega(item) {
    const jaTem = item.confirmacaoEntrega;
    setDataEntregaForm(jaTem?.dataEntregaReal || todayISO());
    setNaoEntregueForm(jaTem?.situacao === "nao-entregue");
    setConfirmandoEntregaDe(item);
    setErro("");
  }

  async function handleConfirmarEntrega() {
    setSalvandoEntrega(true);
    try {
      await confirmarEntrega(
        confirmandoEntregaDe.token,
        naoEntregueForm ? null : dataEntregaForm,
        emailUsuario
      );
      setConfirmandoEntregaDe(null);
      onRecarregar();
    } catch (e2) {
      setErro("Não foi possível registrar a entrega: " + (e2.message || e2));
    }
    setSalvandoEntrega(false);
  }

  async function handleExcluir(item) {
    try {
      await excluirOf(item.token);
      setAExcluir(null);
      onRecarregar();
    } catch (e2) {
      setErro("Erro ao excluir: " + (e2.message || e2));
    }
  }

  function imprimirRecibo(item) {
    const linkConferencia = `${window.location.origin}${window.location.pathname}?recibo=${item.reciboImutavel?.chave}`;
    const janela = window.open("", "_blank");
    janela.document.write(`
      <html><head><title>Comprovante - OF nº ${item.numeroOf}</title>
      <style>body{font-family:sans-serif;padding:40px;color:#111}
      .box{background:#f9f9f9;border:1px solid #ddd;padding:15px;border-radius:6px;margin-bottom:20px}
      .chave{font-family:monospace;background:#eee;padding:8px;display:block;font-size:13px;word-break:break-all}</style>
      </head><body>
      <h2>Prefeitura Municipal — Ordens de Fornecimento</h2>
      <h3>Comprovante de Recebimento e Aceite</h3>
      <div class="box">
        <p><strong>OF:</strong> ${item.numeroOf}</p>
        <p><strong>Empresa:</strong> ${item.empresa}</p>
        <p><strong>CNPJ:</strong> ${item.cnpj || "-"}</p>
        <p><strong>Confirmado em:</strong> ${item.dataAceite}</p>
        <p><strong>Prazo limite:</strong> ${item.prazoLimite} (${item.prazoDias} dias)</p>
      </div>
      <div class="box"><strong>Chave de autenticidade:</strong>
        <span class="chave">${item.reciboImutavel?.chave || "N/A"}</span><br/>
        <strong>Link de conferência:</strong><br/>${linkConferencia}
      </div>
      <p style="font-size:12px;color:#555">Documento gerado eletronicamente.</p>
      </body></html>`);
    janela.document.close();
    janela.print();
  }

  const linhas = ofs.map(item => ({ item, situacao: calcularSituacao(item) }));

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Mail size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Fornecedores</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Ordens de Fornecimento</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: C.paperDark, color: C.navy }}>
            {lendoPdf ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {lendoPdf ? "Lendo PDF..." : "Importar OF (PDF)"}
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
              onChange={handleImportarPdf} disabled={lendoPdf} />
          </label>
          <button onClick={abrirNova}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold"
            style={{ background: C.navy, color: C.paper }}>
            <Plus size={15} /> Nova OF manual
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>
          <AlertCircle size={13} className="inline mr-1.5" style={{ color: C.red }} />{erro}
        </div>
      )}

      {ofs.length === 0 ? (
        <div className="text-center py-14 rounded-xl border-2 border-dashed" style={{ borderColor: C.border }}>
          <Mail size={30} className="mx-auto mb-3" style={{ color: C.border }} />
          <p className="text-sm" style={{ color: C.inkMuted }}>Nenhuma Ordem de Fornecimento cadastrada nesta entidade.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-x-auto etp-scroll" style={{ borderColor: C.border, background: "white" }}>
          <table className="w-full text-sm" style={{ minWidth: "820px" }}>
            <thead>
              <tr style={{ background: C.paperDark }}>
                {["Nº OF", "Empresa / CNPJ", "Prazo limite", "Situação", "Ações"].map(t => (
                  <th key={t} className="text-left px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ item, situacao }) => (
                <tr key={item.token} className="border-t" style={{ borderColor: C.border }}>
                  <td className="px-3 py-3 font-semibold" style={{ color: C.navy }}>{item.numeroOf}</td>
                  <td className="px-3 py-3">
                    <p style={{ color: C.ink }}>{item.empresa || "Não informada"}</p>
                    <p className="text-[11px]" style={{ color: C.inkMuted }}>{formatarCnpj(item.cnpj) || "-"}</p>
                  </td>
                  <td className="px-3 py-3" style={{ color: situacao.vencido ? C.red : C.ink, fontWeight: situacao.vencido ? 600 : 400 }}>
                    {item.prazoLimite || "-"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: `${COR_SITUACAO[situacao.chave]}1A`, color: COR_SITUACAO[situacao.chave] }}>
                      {situacao.texto}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.reciboImutavel && item.pdfBase64 && (
                        <a href={item.pdfBase64} download={`OF-${item.numeroOf}.pdf`} title="Baixar PDF"
                          className="p-1.5 rounded" style={{ color: C.navy }}><Download size={14} /></a>
                      )}
                      {item.reciboImutavel && (
                        <button onClick={() => imprimirRecibo(item)} title="Imprimir recibo"
                          className="p-1.5 rounded" style={{ color: C.inkMuted }}><Printer size={14} /></button>
                      )}
                      {item.status === "Em Dia" && (
                        <button onClick={() => abrirConfirmacaoEntrega(item)}
                          title={item.confirmacaoEntrega ? "Alterar confirmação de entrega" : "Confirmar entrega do produto"}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold"
                          style={{ background: item.confirmacaoEntrega ? C.paperDark : C.green, color: item.confirmacaoEntrega ? C.navy : "white" }}>
                          <PackageCheck size={13} /> {item.confirmacaoEntrega ? "Entrega confirmada" : "Confirmar entrega"}
                        </button>
                      )}
                      <button onClick={() => setADisparar(item)} title={item.status === "Rascunho" ? "Disparar" : "Reenviar"}
                        className="px-2.5 py-1.5 rounded-md text-xs font-semibold"
                        style={{ background: situacao.precisaReenviar ? "#fd7e14" : C.navy, color: "white" }}>
                        {item.status === "Rascunho" ? "Disparar" : "Reenviar"}
                      </button>
                      <button onClick={() => { setEditando(item); setErro(""); setModalAberto(true); }} title="Editar"
                        className="p-1.5 rounded" style={{ color: C.inkMuted }}><Pencil size={14} /></button>
                      <button onClick={() => setAExcluir(item)} title="Excluir"
                        className="p-1.5 rounded" style={{ color: C.red }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <form onSubmit={handleSalvarRascunho}
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto etp-scroll rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-4" style={{ color: C.navy }}>
              {editando.id ? "Editar OF" : "Conferir / preencher OF"}
            </h2>

            {aviso && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(76,124,89,0.1)", color: C.ink }}>
                <Info size={12} className="inline mr-1" style={{ color: C.green }} />{aviso}
              </p>
            )}

            {[
              ["Nº da OF", "numeroOf", "text", true],
              ["CNPJ", "cnpj", "text", false],
              ["Razão social (empresa)", "empresa", "text", true],
              ["E-mail do fornecedor", "emailFornecedor", "email", false],
              ["Telefone do fornecedor", "telefoneFornecedor", "text", false],
            ].map(([label, campo, tipo, obrig]) => (
              <label key={campo} className="block mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>{label}</span>
                <input type={tipo} value={editando[campo] || ""} required={obrig}
                  onChange={e => setEditando({ ...editando, [campo]: e.target.value })}
                  onBlur={campo === "cnpj" ? aoSairDoCnpj : undefined}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
            ))}

            {editando.cnpj && cnpjValido(editando.cnpj) && (() => {
              const hist = resumoHistoricoFornecedor(editando.cnpj, ofs);
              return hist.total > 0 ? (
                <p className="text-[11px] mb-3" style={{ color: C.inkMuted }}>
                  Este fornecedor já teve {hist.total} OF(s): {hist.concluidas} concluída(s), {hist.comDivergencia} com divergência.
                </p>
              ) : null;
            })()}

            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Prazo de entrega (dias após a confirmação)
              </span>
              <input type="number" min="1" required value={editando.prazoDias}
                onChange={e => setEditando({ ...editando, prazoDias: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalAberto(false)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="submit"
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: C.paperDark, color: C.navy }}>
                Salvar rascunho
              </button>
              <button type="button" onClick={() => setADisparar(editando)}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                🚀 Disparar para o fornecedor
              </button>
            </div>
          </form>
        </div>
      )}

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Excluir esta Ordem de Fornecimento?"
          descricao={`"${aExcluir.numeroOf}" será apagada. O fornecedor perderá acesso ao link, se ainda não confirmou.`}
          onConfirmar={() => handleExcluir(aExcluir)}
          onCancelar={() => setAExcluir(null)}
        />
      )}

      {aDisparar && (
        <ConfirmarExclusao
          titulo={aDisparar.status === "Rascunho" ? "Enviar e-mail ao fornecedor?" : "Reenviar e-mail ao fornecedor?"}
          descricao={
            `Um e-mail real será enviado agora para "${aDisparar.emailFornecedor || "(nenhum e-mail informado)"}", ` +
            `com o link para confirmar o recebimento da OF nº ${aDisparar.numeroOf}. Isso não pode ser desfeito. ` +
            `"Enviado" aqui significa apenas que o pedido de envio foi aceito — não há confirmação de que o ` +
            `fornecedor efetivamente recebeu.`
          }
          textoBotao={enviando ? "Enviando..." : "Enviar e-mail"}
          onConfirmar={confirmarDisparo}
          onCancelar={() => setADisparar(null)}
        />
      )}

      {confirmandoEntregaDe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(18,32,50,0.6)" }}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <h2 className="serif text-lg font-semibold mb-1" style={{ color: C.navy }}>
              Confirmar entrega — OF nº {confirmandoEntregaDe.numeroOf}
            </h2>
            <p className="text-xs mb-4" style={{ color: C.inkMuted }}>
              O fornecedor já confirmou o recebimento da OF em {confirmandoEntregaDe.dataAceite}.
              Isto aqui é diferente: é a confirmação de que o produto chegou de verdade.
            </p>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={naoEntregueForm}
                onChange={e => setNaoEntregueForm(e.target.checked)} />
              <span className="text-sm" style={{ color: C.ink }}>O produto não foi entregue</span>
            </label>

            {!naoEntregueForm && (
              <label className="block mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                  Data em que o produto chegou
                </span>
                <input type="date" value={dataEntregaForm} max={todayISO()}
                  onChange={e => setDataEntregaForm(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
                <span className="block mt-1 text-[11px]" style={{ color: C.inkMuted }}>
                  Prazo combinado: até {confirmandoEntregaDe.prazoLimite}. O sistema calcula sozinho se
                  está dentro ou fora do prazo — não precisa avaliar isso.
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setConfirmandoEntregaDe(null)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium" style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmarEntrega} disabled={salvandoEntrega}
                className="px-3.5 py-2 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: C.paper }}>
                {salvandoEntrega ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
