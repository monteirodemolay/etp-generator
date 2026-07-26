/**
 * Cadastro de entidades: secretarias, fundos, autarquias, fundações.
 * Cada uma pode ter timbre próprio — imagem, texto ou nenhum.
 */

import React, { useState, useRef } from "react";
import { Building2, Plus, Trash2, Upload, Info, ArrowLeft, AlertCircle } from "lucide-react";
import { C } from "../tokens.js";
import { RichTextEditor, ConfirmarExclusao } from "../comuns/index.jsx";
import { TIPOS_ENTIDADE } from "../../dominio/opcoes.js";
import { redimensionarImagem } from "../../docx/timbre.js";
import { escapeHtml } from "../../dominio/texto.js";
import { contarDocumentosDaEntidade } from "../../dominio/entidades.js";


// ---------- Cadastro de Secretarias ----------
export function SecretariasView({ secretarias, onSalvar, onNova, onExcluir, onBack,
  etps = [], justificativas = [], declaracoes = [], ofs = [] }) {
  const [aExcluir, setAExcluir] = useState(null); // entidade aguardando confirmação
  // Quando usada como aba do painel não recebe onBack — o menu lateral já faz a navegação
  const fileRefs = useRef({});

  async function trocarTimbre(sec, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const redimensionado = await redimensionarImagem(dataUrl, 1200);
      onSalvar({ ...sec, timbre: redimensionado });
    } catch (err) { console.error(err); }
    e.target.value = "";
  }

  return (
    <div className={onBack ? "max-w-3xl mx-auto px-6 py-10" : "max-w-3xl"}>
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6" style={{ color: C.navy }}>
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.brass }}>
            <Building2 size={16} />
            <span className="text-xs font-semibold tracking-widest uppercase">Organização</span>
          </div>
          <h1 className="serif text-2xl font-semibold" style={{ color: C.navy }}>Entidades</h1>
        </div>
        <button onClick={onNova}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold shrink-0"
          style={{ background: C.navy, color: C.paper }}>
          <Plus size={15} /> Nova Entidade
        </button>
      </div>

      <p className="text-sm mb-6" style={{ color: C.inkMuted }}>
        Entidades são as unidades que contratam: secretarias, fundos, autarquias, fundações e afins.
        Cada documento pertence a uma delas. O nome cadastrado aqui já entra preenchido no campo
        "Órgão" dos documentos novos, e o timbre de cada uma é usado nos arquivos gerados.
      </p>

      <div className="space-y-3">
        {secretarias.map(sec => (
          <div key={sec.id} className="p-4 rounded-xl border" style={{ borderColor: C.border, background: "white" }}>
            <div className="grid sm:grid-cols-[1fr,120px] gap-3 mb-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Nome</span>
                <input value={sec.nome} onChange={e => onSalvar({ ...sec, nome: e.target.value })}
                  placeholder="Ex.: Fundo Municipal de Assistência Social"
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>Sigla</span>
                <input value={sec.sigla} onChange={e => onSalvar({ ...sec, sigla: e.target.value })}
                  placeholder="Ex.: FMAS"
                  className="mt-1 w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: C.border }} />
              </label>
            </div>

            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Natureza da entidade
              </span>
              <select value={sec.tipoEntidade || "Secretaria"}
                onChange={e => onSalvar({ ...sec, tipoEntidade: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: C.border, maxWidth: "260px" }}>
                {TIPOS_ENTIDADE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <div className="pt-3 border-t" style={{ borderColor: C.border }}>
              <span className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: C.inkMuted }}>
                Timbre desta entidade
              </span>

              <div className="inline-flex p-1 rounded-lg mb-3" style={{ background: C.paperDark }}>
                {[
                  { v: "imagem", r: "Imagem" },
                  { v: "texto", r: "Texto" },
                  { v: "nenhum", r: "Nenhum" },
                ].map(op => {
                  const ativo = (sec.tipoTimbre || "imagem") === op.v;
                  return (
                    <button key={op.v} onClick={() => onSalvar({ ...sec, tipoTimbre: op.v })}
                      className="px-3 py-1 rounded-md text-xs font-semibold"
                      style={{
                        background: ativo ? "white" : "transparent",
                        color: ativo ? C.navy : C.inkMuted,
                        boxShadow: ativo ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                      }}>
                      {op.r}
                    </button>
                  );
                })}
              </div>

              {(sec.tipoTimbre || "imagem") === "imagem" && (
                <div className="flex items-center gap-3 flex-wrap">
                  {sec.timbre ? (
                    <img src={sec.timbre} alt="Timbre" className="rounded border" style={{ maxHeight: "44px", borderColor: C.border }} />
                  ) : (
                    <span className="text-xs" style={{ color: C.inkMuted }}>Sem imagem própria — usará o timbre geral do app</span>
                  )}
                  <input type="file" accept="image/*" className="hidden"
                    ref={el => { fileRefs.current[sec.id] = el; }}
                    onChange={e => trocarTimbre(sec, e)} />
                  <button onClick={() => fileRefs.current[sec.id]?.click()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium"
                    style={{ background: C.paperDark, color: C.navy }}>
                    <Upload size={12} /> {sec.timbre ? "Trocar imagem" : "Enviar imagem"}
                  </button>
                  {sec.timbre && (
                    <button onClick={() => onSalvar({ ...sec, timbre: null })}
                      className="text-xs font-medium" style={{ color: C.red }}>Remover</button>
                  )}
                </div>
              )}

              {(sec.tipoTimbre || "imagem") === "texto" && (
                <div>
                  <RichTextEditor value={sec.timbreHtml || ""} onChange={v => onSalvar({ ...sec, timbreHtml: v })} />
                  <p className="text-[10px] mt-1.5" style={{ color: C.inkMuted }}>
                    Escreva o cabeçalho como texto formatado. Ele entra no cabeçalho de todas as páginas do
                    documento, centralizado e com uma linha embaixo.
                  </p>
                  {!sec.timbreHtml?.trim() && (
                    <button onClick={() => onSalvar({ ...sec, timbreHtml:
                      `<p style="text-align:center"><b>PREFEITURA MUNICIPAL DE RIO VERDE</b></p><p style="text-align:center">${escapeHtml(sec.nome || "[nome da secretaria]")}</p>` })}
                      className="mt-2 px-2.5 py-1.5 rounded-md text-xs font-medium"
                      style={{ background: C.brass, color: C.navyDark }}>
                      Usar modelo padrão
                    </button>
                  )}
                </div>
              )}

              {(sec.tipoTimbre || "imagem") === "nenhum" && (
                <p className="text-xs" style={{ color: C.inkMuted }}>
                  Os documentos desta secretaria sairão sem cabeçalho — útil quando o timbre é aplicado
                  depois, por outro sistema ou em papel timbrado impresso.
                </p>
              )}

              <div className="flex justify-end mt-3">
                {secretarias.length <= 1 ? (
                  <span className="text-[10px]" style={{ color: C.inkMuted }}>A última entidade não pode ser excluída</span>
                ) : (
                  <button onClick={() => setAExcluir(sec)} style={{ color: C.red }} title="Excluir entidade">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {aExcluir && (() => {
        const qtd = contarDocumentosDaEntidade(aExcluir.id, { etps, justificativas, declaracoes, ofs });
        const destino = secretarias.find(s => s.id !== aExcluir.id); // a próxima na lista, sempre a mais antiga
        return (
          <ConfirmarExclusao
            titulo="Excluir esta entidade?"
            descricao={
              qtd > 0
                ? `"${aExcluir.sigla || aExcluir.nome}" tem ${qtd} documento(s) vinculado(s) (ETPs, Justificativas, Declarações ou Ordens de Fornecimento). ` +
                  `Eles NÃO serão apagados — mas passarão a aparecer sob "${destino?.sigla || destino?.nome || "outra entidade"}", ` +
                  `pois deixarão de ter uma entidade própria à qual pertencer. Se isso não for o que você quer, cancele e reatribua ` +
                  `esses documentos a outra entidade antes de excluir.`
                : `"${aExcluir.sigla || aExcluir.nome}" não tem nenhum documento vinculado. A exclusão é definitiva.`
            }
            textoBotao="Excluir mesmo assim"
            onConfirmar={() => { onExcluir(aExcluir.id); setAExcluir(null); }}
            onCancelar={() => setAExcluir(null)}
          />
        );
      })()}

      <div className="mt-5 flex items-start gap-2 p-3 rounded-lg text-xs leading-relaxed" style={{ background: C.paperDark, color: C.inkMuted }}>
        <Info size={14} className="shrink-0 mt-0.5" style={{ color: C.brass }} />
        <span>
          Excluir uma entidade não apaga os documentos dela — eles passam a aparecer sob a primeira
          entidade da lista. As alterações desta tela são salvas automaticamente.
        </span>
      </div>
    </div>
  );
}
