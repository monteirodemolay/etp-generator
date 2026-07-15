# Gerador de ETP

Aplicativo para elaborar Estudos Técnicos Preliminares (ETP) nos termos do art. 18 da Lei nº 14.133/2021 —
planilha de itens, alinhamento ao PCA, levantamento de preços, rascunhos por IA e exportação em Word/PDF.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Publicando no GitHub Pages

Este repositório já vem com um workflow do GitHub Actions (`.github/workflows/deploy.yml`) que publica o app
automaticamente a cada `git push` na branch `main`. Só falta habilitar o Pages uma vez:

1. No GitHub, vá em **Settings → Pages**.
2. Em **Source**, escolha **GitHub Actions**.
3. Dê um `git push` (ou rode o workflow manualmente em **Actions → Deploy no GitHub Pages → Run workflow**).
4. Depois de alguns minutos, o link aparece em **Settings → Pages** (formato
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`).

## Como subir este código pela primeira vez

Se você baixou esta pasta e ainda não tem um repositório no GitHub:

```bash
cd etp-generator
git init
git add .
git commit -m "Primeira versão do Gerador de ETP"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPOSITORIO.git
git push -u origin main
```

Ou, sem usar linha de comando: crie o repositório vazio no site do GitHub, entre nele, clique em
**Add file → Upload files**, arraste todos os arquivos desta pasta (mantendo a estrutura de pastas) e confirme
o commit. O workflow do Pages roda sozinho depois disso.

## Chave de API da Anthropic (para os botões de IA)

Diferente de quando este app roda dentro do Claude, aqui fora ele precisa de uma chave de API sua para os botões
"Gerar rascunho com IA" e "Gerar objeto com IA" funcionarem:

1. Crie uma chave em [console.anthropic.com](https://console.anthropic.com) → **API Keys**.
2. Dentro do app, clique no ícone de engrenagem (Configurações) e cole a chave lá.

A chave fica salva só no `localStorage` do seu navegador — nunca é enviada para nenhum servidor além da própria
Anthropic. Isso também significa: se várias pessoas usam o mesmo computador com essa chave salva, qualquer uma
delas com acesso às ferramentas de desenvolvedor do navegador poderia lê-la. Para uso individual (um servidor,
um navegador) isso é seguro; para uso compartilhado, tenha isso em mente.

## Onde ficam os dados dos ETPs

Todos os ETPs, o timbre e a chave de API ficam salvos no `localStorage` deste navegador/computador — não existe
sincronização entre dispositivos nem backup automático na nuvem. Trocar de navegador ou computador, ou limpar os
dados do site, apaga o que estiver salvo. Para não perder trabalho, use os botões de exportação (Word/PDF/cópia
de texto) para guardar cada ETP fora do app também.

## Tecnologias

React + Vite, Tailwind (via CDN), lucide-react (ícones), xlsx/SheetJS (planilhas Excel).
