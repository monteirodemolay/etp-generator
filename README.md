# ETP Inteligente

Plataforma web para planejamento, elaboração, gestão e acompanhamento das contratações públicas, desenvolvida com fundamento na Lei nº 14.133/2021 (Lei de Licitações e Contratos Administrativos).

O ETP Inteligente centraliza em um único ambiente as principais etapas do planejamento das contratações, permitindo que órgãos públicos elaborem Estudos Técnicos Preliminares (ETP), Declarações, Justificativas, Ordens de Fornecimento, gerenciem fornecedores, acompanhem entregas e mantenham uma base normativa organizada, reduzindo retrabalho, aumentando a padronização documental e proporcionando maior controle sobre todo o processo administrativo.

O sistema foi inicialmente desenvolvido para atender à Secretaria Municipal de Assistência Social de Rio Verde/GO, sendo posteriormente expandido para suportar múltiplos Municípios, Secretarias, Fundos, Autarquias e demais entidades públicas, mantendo isolamento dos dados entre as organizações cadastradas.

---

# Objetivo

O ETP Inteligente tem como objetivo transformar um conjunto de procedimentos normalmente executados de forma manual e dispersa em uma plataforma integrada, capaz de organizar todo o ciclo de planejamento das contratações públicas.

A plataforma busca:

- padronizar documentos técnicos;
- reduzir retrabalho;
- eliminar duplicidade de informações;
- manter rastreabilidade das decisões administrativas;
- facilitar o acompanhamento das Ordens de Fornecimento;
- organizar bases normativas;
- apoiar servidores públicos durante todas as fases do planejamento da contratação.

---

# Funcionalidades

## Estudos Técnicos Preliminares (ETP)

- elaboração completa dos treze incisos do art. 18 da Lei nº 14.133/2021;
- modelos automáticos de preenchimento;
- edição rica dos textos;
- exportação em Word e PDF.

---

## Declarações

Elaboração padronizada de declarações administrativas vinculadas aos processos de contratação.

---

## Justificativas Técnicas

Criação de justificativas com modelos parametrizados, reduzindo inconsistências entre documentos.

---

## Planilha de Itens

- cadastro manual;
- importação do Sistema Centi;
- exportação para Excel;
- manutenção dos códigos de produtos.

---

## Plano de Contratações Anual (PCA)

- importação do PCA;
- cruzamento automático entre itens e plano;
- identificação de itens não previstos;
- geração automática da planilha de solicitação de inclusão.

---

## Dados do Processo

Cadastro de:

- objeto;
- órgão;
- secretaria;
- responsável técnico;
- número do processo;
- metodologia de cálculo;
- metodologia das quantidades;
- garantias;
- parcelamento;
- impactos ambientais;
- contratações correlatas.

---

## Levantamento de Preços

- registro de múltiplas cotações;
- cálculo de média;
- cálculo de mediana;
- identificação de valores discrepantes;
- geração de planilhas para fornecedores;
- importação das respostas.

---

## Ordens de Fornecimento

O sistema permite:

- emissão de Ordens de Fornecimento;
- confirmação eletrônica de recebimento;
- acompanhamento dos prazos;
- histórico completo das OF;
- consulta pública mediante chave segura;
- geração de recibos de entrega.

---

## Gerenciamento de Fornecedores

Cadastro centralizado de fornecedores contendo:

- razão social;
- CNPJ;
- e-mail;
- telefone;
- histórico das Ordens de Fornecimento.

O cadastro de fornecedores é compartilhado entre todas as entidades cadastradas, utilizando o CNPJ como identificador único nacional, evitando duplicidade cadastral e preservando o histórico administrativo.

---

## Relatórios

Geração de relatórios administrativos relacionados às Ordens de Fornecimento, fornecedores e acompanhamento das contratações.

---

## Materiais Normativos

Base normativa integrada destinada ao armazenamento e consulta de:

- Leis;
- Decretos;
- Instruções Normativas;
- Portarias;
- Acórdãos;
- Pareceres;
- demais documentos técnicos.

---

## Lixeira

Os documentos excluídos permanecem disponíveis para recuperação durante 30 dias.

Após esse período poderão ser removidos definitivamente.

---

## Administração do Sistema

O módulo administrativo permite:

- gerenciamento de usuários;
- gerenciamento de entidades;
- gerenciamento de permissões;
- gerenciamento de fornecedores;
- configuração institucional;
- administração geral da plataforma.

---

## Apoio por Inteligência Artificial

O sistema **não utiliza APIs de Inteligência Artificial**.

Como recurso opcional, gera prompts estruturados para utilização em ferramentas externas como ChatGPT, Claude, Gemini ou similares.

Todo envio de informações para essas plataformas ocorre exclusivamente por iniciativa do usuário.

Nenhuma chave de API é armazenada.

Nenhuma informação é enviada automaticamente.

---

# Fluxo recomendado

1. Cadastro dos itens.
2. Importação e conferência do PCA.
3. Preenchimento dos dados do processo.
4. Levantamento de preços.
5. Elaboração do ETP.
6. Emissão das Declarações.
7. Emissão das Justificativas.
8. Exportação dos documentos.
9. Emissão da Ordem de Fornecimento.
10. Acompanhamento da entrega.
11. Geração dos relatórios.

---

# Segurança

O sistema adota mecanismos destinados à proteção das informações tratadas.

Entre eles:

- autenticação por e-mail e senha;
- comunicação criptografada (HTTPS/TLS);
- Firebase Authentication;
- Cloud Firestore;
- controle de acesso baseado em perfis;
- segregação lógica dos dados por Município e Entidade;
- cache seguro para funcionamento offline;
- sincronização automática quando a conexão retorna;
- recuperação de documentos por meio da Lixeira;
- regras de segurança do Firestore.

Cada entidade acessa exclusivamente seus próprios documentos.

O único cadastro compartilhado entre todas as entidades é a base de fornecedores, identificada pelo CNPJ.

---

# Privacidade e LGPD

O ETP Inteligente foi concebido observando os princípios da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).

Os dados tratados destinam-se exclusivamente ao apoio das atividades administrativas relacionadas às contratações públicas.

O sistema:

- não comercializa dados;
- não compartilha informações institucionais entre entidades;
- não utiliza os dados para publicidade;
- não envia informações automaticamente para serviços externos de Inteligência Artificial.

Os dados permanecem protegidos pelas Regras de Segurança do Firestore e pelos mecanismos de autenticação da plataforma.

---

# Tecnologias utilizadas

- React 18
- Vite
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- SheetJS (xlsx)
- Lucide React

---

# Execução local

```bash
npm install
npm run dev
```

---

# Publicação

O projeto utiliza GitHub Actions para implantação automática.

Após cada atualização da branch `main`, o sistema pode ser publicado automaticamente no GitHub Pages, conforme configuração disponível em:

```
Settings → Pages → GitHub Actions
```

---

# Fundamentação Legal

- Constituição Federal de 1988
- Lei nº 14.133/2021
- Lei nº 13.709/2018 (LGPD)
- Lei nº 12.527/2011 (Lei de Acesso à Informação)
- Normas complementares aplicáveis às contratações públicas.

---

# Autor

**Luís Eduardo Monteiro Lima**

Analista Administrativo

Prefeitura Municipal de Rio Verde – GO

---

# Licença

Este projeto foi desenvolvido para utilização pela Administração Pública, podendo ser adaptado conforme as necessidades de cada órgão ou entidade pública, observada a legislação vigente.
