// Porta de entrada do app: sem sessão iniciada, nada é exibido.
//
// A proteção real não está aqui — está nas Regras de Segurança do Firestore. Esta tela
// é a porta; a fechadura fica no servidor. Mesmo que alguém contorne esta tela, o banco
// recusa qualquer leitura sem um usuário autorizado.

import React, { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";
import nuvem from "./storage";
import local from "./storage-local";

const C = {
  navy: "#1C2E4A", navyDark: "#122032", paper: "#FAF7F0", paperDark: "#F1ECDF",
  brass: "#A6832E", brassLight: "#C9A94F", ink: "#2A2A28", inkMuted: "#6B675E",
  border: "#DAD3C2", red: "#A6403D", green: "#4C7C59",
};

// Mensagens do Firebase em linguagem de gente
function traduzirErro(codigo) {
  const mapa = {
    "auth/invalid-email": "E-mail em formato inválido.",
    "auth/user-disabled": "Esta conta foi desativada. Procure o administrador.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos.",
    "auth/network-request-failed": "Sem conexão com a internet.",
    "auth/operation-not-allowed": "O login por e-mail e senha não está ativado no Firebase.",
  };
  return mapa[codigo] || "Não foi possível entrar. Tente novamente.";
}

// ---------- Migração dos dados que já estavam neste navegador ----------
const CHAVES_PREFIXO = ["etp:", "just:", "decl:", "sec:"];
const CHAVES_SOLTAS = ["pca:planilha", "timbre:padrao", "diretorio:responsaveis"];
const MARCA_MIGRACAO = "etpgen:migrado-para-nuvem";

async function haDadosLocais() {
  if (localStorage.getItem(MARCA_MIGRACAO)) return 0;
  let total = 0;
  for (const p of CHAVES_PREFIXO) {
    const r = await local.list(p).catch(() => null);
    total += r?.keys?.length || 0;
  }
  for (const k of CHAVES_SOLTAS) {
    const r = await local.get(k).catch(() => null);
    if (r?.value) total++;
  }
  return total;
}

async function migrarParaNuvem(aoProgredir) {
  const paraEnviar = [];
  for (const p of CHAVES_PREFIXO) {
    const r = await local.list(p).catch(() => null);
    for (const k of r?.keys || []) {
      const v = await local.get(k).catch(() => null);
      if (v?.value) paraEnviar.push([k, v.value]);
    }
  }
  for (const k of CHAVES_SOLTAS) {
    const v = await local.get(k).catch(() => null);
    if (v?.value) paraEnviar.push([k, v.value]);
  }

  let feitos = 0;
  for (const [k, v] of paraEnviar) {
    await nuvem.set(k, v);
    feitos++;
    aoProgredir?.(feitos, paraEnviar.length);
  }
  localStorage.setItem(MARCA_MIGRACAO, new Date().toISOString());
  return feitos;
}

// ---------- Componente ----------
export default function PortaDeEntrada({ children }) {
  const [usuario, setUsuario] = useState(undefined); // undefined = ainda verificando
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [aviso, setAviso] = useState("");

  const [pendentes, setPendentes] = useState(0);
  const [migrando, setMigrando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });

  useEffect(() => onAuthStateChanged(auth, u => setUsuario(u)), []);

  useEffect(() => {
    if (usuario) haDadosLocais().then(setPendentes).catch(() => {});
  }, [usuario]);

  async function entrar(e) {
    e.preventDefault();
    setEntrando(true);
    setErro("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (err) {
      setErro(traduzirErro(err.code));
    }
    setEntrando(false);
  }

  async function recuperarSenha() {
    if (!email.trim()) { setErro("Digite seu e-mail para receber o link de redefinição."); return; }
    setRecuperando(true);
    setErro("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAviso("Enviamos um link de redefinição para o seu e-mail.");
      setTimeout(() => setAviso(""), 8000);
    } catch (err) {
      setErro(traduzirErro(err.code));
    }
    setRecuperando(false);
  }

  async function executarMigracao() {
    setMigrando(true);
    try {
      await migrarParaNuvem((feitos, total) => setProgresso({ feitos, total }));
      setPendentes(0);
      window.location.reload();
    } catch (e) {
      console.error(e);
      setErro("Falha ao enviar os dados. Nada foi perdido no navegador — tente de novo.");
      setMigrando(false);
    }
  }

  // ----- Ainda verificando a sessão -----
  if (usuario === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.paperDark }}>
        <p className="text-sm" style={{ color: C.inkMuted, fontFamily: "Inter, system-ui, sans-serif" }}>
          Carregando...
        </p>
      </div>
    );
  }

  // ----- Sem sessão: tela de entrada -----
  if (!usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: C.paperDark, fontFamily: "Inter, system-ui, sans-serif" }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: C.navy }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.brassLight}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
            </div>
            <h1 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 24, fontWeight: 600, color: C.navy }}>
              Gerador de ETP
            </h1>
            <p className="text-xs mt-1" style={{ color: C.inkMuted }}>
              Estudos Técnicos Preliminares · Lei nº 14.133/2021
            </p>
          </div>

          <form onSubmit={entrar} className="rounded-xl border p-6"
            style={{ borderColor: C.border, background: "white" }}>
            <label className="block mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                E-mail
              </span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="username" required
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: C.border }} />
            </label>

            <label className="block mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkMuted }}>
                Senha
              </span>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                autoComplete="current-password" required
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border text-sm"
                style={{ borderColor: C.border }} />
            </label>

            {erro && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg"
                style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>{erro}</p>
            )}
            {aviso && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg"
                style={{ background: "rgba(76,124,89,0.1)", color: C.ink }}>{aviso}</p>
            )}

            <button type="submit" disabled={entrando}
              className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              style={{ background: C.navy, color: C.paper }}>
              {entrando ? "Entrando..." : "Entrar"}
            </button>

            <button type="button" onClick={recuperarSenha} disabled={recuperando}
              className="w-full mt-2 py-2 text-xs font-medium" style={{ color: C.brass }}>
              {recuperando ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </form>

          <p className="text-[11px] text-center mt-4 leading-relaxed" style={{ color: C.inkMuted }}>
            O acesso é criado pelo administrador. Se você não tem conta, procure o responsável
            pelo sistema no seu setor.
          </p>
        </div>
      </div>
    );
  }

  // ----- Com sessão, mas há dados no navegador ainda não enviados -----
  if (pendentes > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: C.paperDark, fontFamily: "Inter, system-ui, sans-serif" }}>
        <div className="w-full max-w-md rounded-xl border p-6" style={{ borderColor: C.border, background: "white" }}>
          <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 20, fontWeight: 600, color: C.navy }}>
            Enviar seus documentos para a nuvem
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: C.inkMuted }}>
            Encontramos <b style={{ color: C.ink }}>{pendentes} registro(s)</b> gravados apenas neste
            navegador. Vamos enviá-los para a sua área na nuvem, para que fiquem acessíveis de
            qualquer computador.
          </p>

          <div className="mt-4 p-3 rounded-lg text-xs leading-relaxed"
            style={{ background: C.paperDark, color: C.inkMuted }}>
            Nada é apagado do navegador neste processo. Se algo der errado, seus dados continuam aqui.
          </div>

          {migrando ? (
            <div className="mt-5">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.paperDark }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: progresso.total ? `${(progresso.feitos / progresso.total) * 100}%` : "0%",
                  background: C.brass,
                }} />
              </div>
              <p className="text-xs mt-2 text-center" style={{ color: C.inkMuted }}>
                Enviando {progresso.feitos} de {progresso.total}...
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-5">
              <button onClick={() => signOut(auth)}
                className="px-3.5 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "white", color: C.inkMuted, border: `1px solid ${C.border}` }}>
                Sair
              </button>
              <button onClick={executarMigracao}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: C.navy, color: C.paper }}>
                Enviar para a nuvem
              </button>
            </div>
          )}

          {erro && (
            <p className="text-xs mt-3 px-3 py-2 rounded-lg"
              style={{ background: "rgba(166,64,61,0.1)", color: C.ink }}>{erro}</p>
          )}
        </div>
      </div>
    );
  }

  // ----- Tudo certo: mostra o app, com uma faixa de identificação no topo -----
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-1.5 text-xs"
        style={{ background: C.navyDark, color: "#B7C0CC", fontFamily: "Inter, system-ui, sans-serif" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
        <span className="truncate">{usuario.email}</span>
        <button onClick={() => signOut(auth)} className="ml-auto font-medium shrink-0"
          style={{ color: C.brassLight }}>
          Sair
        </button>
      </div>
      {children}
    </>
  );
}
