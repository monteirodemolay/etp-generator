// Porta de entrada do app: sem sessão iniciada, nada é exibido.
//
// A proteção real não está aqui — está nas Regras de Segurança do Firestore. Esta tela
// é a porta; a fechadura fica no servidor. Mesmo que alguém contorne esta tela, o banco
// recusa qualquer leitura sem um usuário autorizado.

import React, { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from "firebase/auth";
import { auth } from "./firebase";
import nuvem from "./storage";
import local from "./storage-local";

const VERSAO = "2.0";

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
    "auth/admin-restricted-operation": "Esta conta não está cadastrada. Peça ao administrador para criá-la.",
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
  const [verSenha, setVerSenha] = useState(false);
  const [lembrar, setLembrar] = useState(true);

  const [pendentes, setPendentes] = useState(0);
  const [migrando, setMigrando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });

  const [mostrarAvisoSessao, setMostrarAvisoSessao] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(120);

  const timerSessao = useRef(null);
  const timerContagem = useRef(null);
  const avisoSessaoAberto = useRef(false);
  
  const TEMPO_AVISO = 1000;

function abrirAvisoSessao() {
    avisoSessaoAberto.current = true;
  
    clearInterval(timerContagem.current);

    setMostrarAvisoSessao(true);
    setSegundosRestantes(120);

    timerContagem.current = setInterval(() => {

        setSegundosRestantes(valor => {

            if (valor <= 1) {
                sairAgora();
                return 0;
            }

            return valor - 1;
        });

    }, 1000);
}

function renovarSessao() {
    if (avisoSessaoAberto.current) return;
  
    clearTimeout(timerSessao.current);
    clearInterval(timerContagem.current);

    timerSessao.current = setTimeout(
        abrirAvisoSessao,
        TEMPO_AVISO
    );
}

function continuarSessao() {
    avisoSessaoAberto.current = false;
  
    clearInterval(timerContagem.current);
    setMostrarAvisoSessao(false);
    
    renovarSessao();
}

async function sairAgora() {
    avisoSessaoAberto.current = false
    
    clearTimeout(timerSessao.current);
    clearInterval(timerContagem.current);
    
    await signOut(auth);
}
  
  useEffect(() => onAuthStateChanged(auth, u => setUsuario(u)), []);

  useEffect(() => {
    if (usuario) haDadosLocais().then(setPendentes).catch(() => {});
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;

    const eventos = [
        "mousemove",
        "mousedown",
        "click",
        "keydown",
        "keypress",
        "scroll",
        "touchstart"
    ];

    eventos.forEach(e =>
        window.addEventListener(e, renovarSessao)
    );

    renovarSessao();

    return () => {
        clearTimeout(timerSessao.current);
        clearInterval(timerContagem.current);

        eventos.forEach(e =>
            window.removeEventListener(e, renovarSessao)
        );
    };
}, [usuario]);

  // "Lembrar-me" define se a sessão sobrevive ao fechar o navegador
  async function aplicarPersistencia() {
    try {
      await setPersistence(auth, lembrar ? browserLocalPersistence : browserSessionPersistence);
    } catch (e) { /* se falhar, segue com o padrão */ }
  }

  async function entrar(e) {
    e.preventDefault();
    setEntrando(true);
    setErro("");
    try {
      await aplicarPersistencia();
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
      <div className="min-h-screen flex" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

        {/* ---------- Lado esquerdo: apresentação ---------- */}
        <div className="hidden lg:flex flex-col justify-center relative overflow-hidden px-14 py-12"
          style={{ width: "56%", background: `linear-gradient(140deg, ${C.navy} 0%, ${C.navyDark} 55%, #0C1622 100%)` }}>

          {/* Malha geométrica de fundo */}
          <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.16 }} aria-hidden="true">
            <defs>
              <pattern id="grade" width="46" height="46" patternUnits="userSpaceOnUse">
                <path d="M46 0H0V46" fill="none" stroke={C.brassLight} strokeWidth="0.4" />
              </pattern>
              <radialGradient id="brilho" cx="30%" cy="35%" r="65%">
                <stop offset="0%" stopColor={C.brassLight} stopOpacity="0.28" />
                <stop offset="100%" stopColor={C.brassLight} stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grade)" />
            <rect width="100%" height="100%" fill="url(#brilho)" />
          </svg>

          <div className="relative z-10">
            {/* Marca */}
            <div className="flex items-center gap-4 mb-9">
              <svg width="60" height="66" viewBox="0 0 60 66" fill="none" aria-hidden="true">
                <path d="M30 2 L56 17 L56 49 L30 64 L4 49 L4 17 Z"
                  stroke={C.brass} strokeWidth="2.5" fill="none" />
                <rect x="19" y="18" width="23" height="30" rx="2.5" fill={C.paper} opacity="0.95" />
                <path d="M24 26h13M24 32h13M24 38h9" stroke={C.navy} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 38, fontWeight: 700,
                  color: C.paper, lineHeight: 1, letterSpacing: "-0.5px" }}>ETP</p>
                <p style={{ fontSize: 13, letterSpacing: "6px", color: C.brassLight,
                  marginTop: 4, fontWeight: 500 }}>INTELIGENTE</p>
              </div>
            </div>

            <div style={{ width: 52, height: 3, background: C.brass, marginBottom: 26, borderRadius: 2 }} />

            <h1 style={{ fontSize: 36, fontWeight: 700, color: C.paper, lineHeight: 1.22, letterSpacing: "-0.5px" }}>
              Planejamento consistente<br />para contratações públicas.
            </h1>

            <p className="mt-4 text-base leading-relaxed" style={{ color: "#A9B4C4", maxWidth: 520 }}>
              Elaboração, organização e padronização da fase preparatória, conforme a{" "}
              <span style={{ color: C.brassLight, fontWeight: 500 }}>Lei nº 14.133/2021</span>.
            </p>

            {/* Recursos */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-10" style={{ maxWidth: 620 }}>
              {[
                { rotulo: "Estudos Técnicos\nPreliminares", d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 14l2 2 4-4" },
                { rotulo: "Declaração de\nprevisão no PCA", d: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" },
                { rotulo: "Justificativa\nde aquisição", d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" },
                { rotulo: "Pesquisa\nde preços", d: "M18 20V10M12 20V4M6 20v-6" },
              ].map((r, i) => (
                <div key={i} className="rounded-xl px-4 py-4 flex flex-col items-center text-center"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,169,79,0.22)" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.brassLight}
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mb-2.5">
                    <path d={r.d} />
                  </svg>
                  <p className="text-[11.5px] leading-snug whitespace-pre-line" style={{ color: "#C3CCD9" }}>
                    {r.rotulo}
                  </p>
                  <div style={{ width: 22, height: 2, background: C.brass, marginTop: 10, borderRadius: 1 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Lado direito: formulário ---------- */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-10"
          style={{ background: "white" }}>
          <div className="w-full max-w-sm mx-auto">

            {/* Marca compacta, só quando o lado esquerdo está oculto */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <svg width="42" height="46" viewBox="0 0 60 66" fill="none" aria-hidden="true">
                <path d="M30 2 L56 17 L56 49 L30 64 L4 49 L4 17 Z" stroke={C.brass} strokeWidth="2.5" fill="none" />
                <rect x="19" y="18" width="23" height="30" rx="2.5" fill={C.navy} opacity="0.9" />
                <path d="M24 26h13M24 32h13M24 38h9" stroke={C.paper} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div>
                <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 24,
                  fontWeight: 700, color: C.navy, lineHeight: 1 }}>ETP</p>
                <p style={{ fontSize: 9.5, letterSpacing: "4px", color: C.brass, marginTop: 2 }}>INTELIGENTE</p>
              </div>
            </div>

            <h2 style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: 30,
              fontWeight: 600, color: C.navy, lineHeight: 1.2 }}>
              Bem-vindo(a)!
            </h2>
            <p className="text-sm mt-1.5 mb-7" style={{ color: C.inkMuted }}>
              Faça login para acessar sua área.
            </p>

            <form onSubmit={entrar}>
              <label className="block mb-4">
                <span className="text-xs font-semibold" style={{ color: C.ink }}>E-mail</span>
                <div className="mt-1.5 flex items-center rounded-lg border overflow-hidden focus-within:ring-2"
                  style={{ borderColor: C.border }}>
                  <span className="pl-3 shrink-0" style={{ color: C.inkMuted }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-10 5L2 7" />
                    </svg>
                  </span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    autoComplete="username" required placeholder="Digite seu e-mail"
                    className="w-full px-3 py-3 text-sm"
                    style={{ border: "none", outline: "none" }} />
                </div>
              </label>

              <label className="block mb-3">
                <span className="text-xs font-semibold" style={{ color: C.ink }}>Senha</span>
                <div className="mt-1.5 flex items-center rounded-lg border overflow-hidden"
                  style={{ borderColor: C.border }}>
                  <span className="pl-3 shrink-0" style={{ color: C.inkMuted }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input type={verSenha ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)}
                    autoComplete="current-password" required placeholder="Digite sua senha"
                    className="w-full px-3 py-3 text-sm"
                    style={{ border: "none", outline: "none" }} />
                  <button type="button" onClick={() => setVerSenha(v => !v)}
                    className="px-3 shrink-0" style={{ color: C.inkMuted }}
                    title={verSenha ? "Ocultar senha" : "Mostrar senha"}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {verSenha
                        ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>
                        : <><path d="M9.9 4.24A9 9 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2.6 3.8M6.6 6.6A18 18 0 0 0 2 12s3.5 7 10 7a9 9 0 0 0 3.6-.75" /><path d="m2 2 20 20" /></>}
                    </svg>
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: C.ink }}>
                  <input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)}
                    className="w-4 h-4" style={{ accentColor: C.navy }} />
                  Lembrar-me
                </label>
                <button type="button" onClick={recuperarSenha} disabled={recuperando}
                  className="text-xs font-medium underline" style={{ color: C.navy }}>
                  {recuperando ? "Enviando..." : "Esqueci minha senha"}
                </button>
              </div>

              {erro && (
                <p className="text-xs mb-4 px-3 py-2.5 rounded-lg flex items-start gap-2"
                  style={{ background: "rgba(166,64,61,0.09)", color: C.ink }}>
                  <span style={{ color: C.red }}>●</span> {erro}
                </p>
              )}
              {aviso && (
                <p className="text-xs mb-4 px-3 py-2.5 rounded-lg flex items-start gap-2"
                  style={{ background: "rgba(76,124,89,0.1)", color: C.ink }}>
                  <span style={{ color: C.green }}>●</span> {aviso}
                </p>
              )}

              <button type="submit" disabled={entrando}
                className="w-full py-3.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: C.navy, color: C.paper }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
                {entrando ? "Entrando..." : "Entrar no sistema"}
              </button>
            </form>

            <p className="text-[11px] text-center mt-6 leading-relaxed" style={{ color: C.inkMuted }}>
              O acesso é criado pelo administrador. Se você ainda não tem conta,
              procure o responsável pelo sistema no seu setor.
            </p>
          </div>

          {/* Rodapé */}
          <div className="w-full max-w-sm mx-auto mt-10 pt-5 border-t" style={{ borderColor: C.border }}>
            <div className="flex items-start gap-2.5">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={C.navy}
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <p className="text-[11px] leading-relaxed" style={{ color: C.inkMuted }}>
                Segurança, padronização e conformidade<br />para uma gestão pública mais eficiente.
              </p>
            </div>
            <p className="text-[10.5px] text-center mt-4" style={{ color: C.inkMuted }}>
              ETP Inteligente · versão {VERSAO}
            </p>
          </div>
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
              <button onClick={sairAgora}>
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
      {mostrarAvisoSessao && (
<div
    style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999
    }}
>

<div
    style={{
        width: 420,
        background: "white",
        borderRadius: 12,
        padding: 28,
        boxShadow: "0 20px 60px rgba(0,0,0,.25)"
    }}
>

<h2
    style={{
        fontSize: 22,
        fontWeight: 700,
        marginBottom: 12
    }}
>
Sessão expirando
</h2>

<p style={{marginBottom:20}}>

Sua sessão será encerrada por segurança devido à inatividade.

</p>

<div
    style={{
        fontSize: 42,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 20
    }}
>
{Math.floor(segundosRestantes / 60)}
:
{String(segundosRestantes % 60).padStart(2,"0")}
</div>

<div
    style={{
        display:"flex",
        gap:12
    }}
>

<button
onClick={sairAgora}
style={{
    flex:1,
    padding:12,
    borderRadius:8
}}
>
Sair
</button>

<button
onClick={continuarSessao}
style={{
    flex:1,
    padding:12,
    borderRadius:8,
    background:"#1C2E4A",
    color:"white"
}}
>
Continuar trabalhando
</button>

</div>

</div>

</div>
)}
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="flex items-center gap-3 px-4 py-1.5 text-xs shrink-0"
        style={{ background: C.navyDark, color: "#B7C0CC", fontFamily: "Inter, system-ui, sans-serif" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
        <span className="truncate">{usuario.email}</span>
    <button
        onClick={sairAgora}
        className="ml-auto font-medium shrink-0"
        style={{ color: C.brassLight }}
>
        Sair
      </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {typeof children === "function" ? children(usuario) : children}
      </div>
    </div>
  </>
  );
}
