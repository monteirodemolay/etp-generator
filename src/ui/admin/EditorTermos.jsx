/**
 * Editor dos Termos de Uso e Política de Privacidade.
 *
 * Só aparece dentro do Admin — quem consegue chegar aqui já passou pelo
 * controle de acesso de "gerenciar entidades" (o mesmo que restringe as
 * demais sub-abas do Admin).
 *
 * O aviso de rascunho/revisão jurídica NÃO é editável por aqui — fica fixo
 * no componente da tela pública, de propósito, para que ninguém o remova
 * sem perceber a implicação.
 */

import React, { useState, useEffect } from "react";
import { FileText, Plus, Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";
import { C } from "../tokens.js";
import { RichTextEditor, ConfirmarExclusao } from "../comuns/index.jsx";
import { emptySecaoTermos } from "../../dominio/termos.js";
import { fmtDate } from "../../dominio/datas.js";

export function EditorTermos({ termos, onSalvar }) {
  const [secoes, setSecoes] = useState(termos?.secoes || []);
  const [aExcluir, setAExcluir] = useState(null); // índice da seção aguardando confirmação
  const [salvo, setSalvo] = useState(false);

  // termos chega de forma assíncrona (carregado do banco no início do app) —
  // se ainda não tinha chegado quando este componente montou, sincroniza
  // assim que chegar. Depois disso, quem manda é a edição local do usuário.
  useEffect(() => {
    if (termos?.secoes && secoes.length === 0) setSecoes(termos.secoes);
  }, [termos]);

  function atualizarTitulo(id, titulo) {
    setSecoes(prev => prev.map(s => (s.id === id ? { ...s, titulo } : s)));
  }
  function atualizarCorpo(id, corpo) {
    setSecoes(prev => prev.map(s => (s.id === id ? { ...s, corpo } : s)));
  }
  function adicionarSecao() {
    setSecoes(prev => [...prev, emptySecaoTermos("Nova seção", "<p>Escreva aqui...</p>")]);
  }
  function excluirSecao(id) {
    setSecoes(prev => prev.filter(s => s.id !== id));
    setAExcluir(null);
  }
  function mover(index, direcao) {
    setSecoes(prev => {
      const nova = [...prev];
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= nova.length) return prev;
      [nova[index], nova[alvo]] = [nova[alvo], nova[index]];
      return nova;
    });
  }
  function salvar() {
    onSalvar({ secoes });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 mb-1" style={{ color: C.brass }}>
            <FileText size={15} />
            <span className="text-xs font-semibold tracking-widest uppercase">Compliance</span>
          </div>
          <h2 className="serif text-xl font-semibold" style={{ color: C.navy }}>Termos de Uso e Privacidade</h2>
        </div>
        <button onClick={salvar}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: salvo ? "#4C7C59" : C.navy, color: C.paper }}>
          {salvo ? <Check size={15} /> : null} {salvo ? "Salvo!" : "Salvar alterações"}
        </button>
      </div>

      <p className="text-xs mb-1" style={{ color: C.inkMuted }}>
        O texto aqui é o que aparece na tela pública (<code>?termos=</code>), acessível sem login e
        linkada na tela de entrada e no rodapé do sistema. O aviso de que este documento é um
        rascunho para revisão jurídica é fixo e não muda por aqui.
      </p>
      {termos?.atualizadoEm && (
        <p className="text-[11px] mb-5" style={{ color: C.inkMuted }}>
          Última alteração: {fmtDate(termos.atualizadoEm)}
        </p>
      )}

      <div className="space-y-4">
        {secoes.map((secao, i) => (
          <div key={secao.id} className="rounded-xl border p-4" style={{ borderColor: C.border, background: "white" }}>
            <div className="flex items-center gap-2 mb-2">
              <input value={secao.titulo} onChange={e => atualizarTitulo(secao.id, e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border text-sm font-semibold" style={{ borderColor: C.border, color: C.navy }} />
              <button onClick={() => mover(i, -1)} disabled={i === 0} title="Mover para cima"
                className="p-1.5 rounded disabled:opacity-30" style={{ color: C.inkMuted }}><ChevronUp size={15} /></button>
              <button onClick={() => mover(i, 1)} disabled={i === secoes.length - 1} title="Mover para baixo"
                className="p-1.5 rounded disabled:opacity-30" style={{ color: C.inkMuted }}><ChevronDown size={15} /></button>
              <button onClick={() => setAExcluir(secao)} title="Excluir seção" className="p-1.5 rounded" style={{ color: C.red }}>
                <Trash2 size={15} />
              </button>
            </div>
            <RichTextEditor value={secao.corpo} onChange={corpo => atualizarCorpo(secao.id, corpo)} />
          </div>
        ))}
      </div>

      <button onClick={adicionarSecao}
        className="mt-4 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium"
        style={{ background: C.paperDark, color: C.navy }}>
        <Plus size={14} /> Nova seção
      </button>

      {aExcluir && (
        <ConfirmarExclusao
          titulo="Excluir esta seção?"
          descricao={`"${aExcluir.titulo}" será removida do documento. Isso só terá efeito depois de clicar em "Salvar alterações".`}
          onConfirmar={() => excluirSecao(aExcluir.id)}
          onCancelar={() => setAExcluir(null)}
        />
      )}
    </div>
  );
}
