# Hub Compras Públicas

> Plataforma completa para planejamento, gestão e acompanhamento das contratações públicas, desenvolvida em conformidade com a Lei nº 14.133/2021.

O **Hub Compras Públicas** é uma plataforma web desenvolvida para modernizar, padronizar e integrar as atividades relacionadas às contratações públicas, reunindo em um único ambiente todas as etapas do planejamento da contratação até o acompanhamento da execução.

Inicialmente concebido como **ETP Inteligente**, o projeto evoluiu para um ecossistema mais amplo, passando por um processo de **Rebranding** e tornando-se o **Hub Compras Públicas**, refletindo sua abrangência e capacidade de atender todo o ciclo das compras governamentais.

A plataforma foi desenvolvida para utilização por **Municípios, Câmaras Municipais, Secretarias, Fundos, Autarquias, Consórcios e demais órgãos da Administração Pública**, mantendo isolamento lógico entre as entidades cadastradas e compartilhando apenas a base nacional de fornecedores.

---

# Objetivos

O Hub Compras Públicas tem como objetivo:

- Padronizar documentos técnicos;
- Reduzir retrabalho;
- Eliminar duplicidade de informações;
- Aumentar a segurança jurídica dos processos;
- Organizar todas as etapas das contratações públicas;
- Facilitar o trabalho dos servidores públicos;
- Garantir maior rastreabilidade das decisões administrativas;
- Centralizar informações em uma única plataforma.

---

# Principais Módulos

## 📑 ETP Inteligente

Módulo responsável pela elaboração dos Estudos Técnicos Preliminares, contendo:

- elaboração dos treze incisos previstos na Lei nº 14.133/2021;
- modelos parametrizados;
- preenchimento assistido;
- editor de textos;
- exportação em Word e PDF.

---

## 📄 Declarações

Emissão padronizada de declarações administrativas vinculadas aos processos de contratação.

---

## 📝 Justificativas Técnicas

Criação de justificativas técnicas utilizando modelos configuráveis e padronizados.

---

## 📦 Plano de Contratações Anual (PCA)

Permite:

- importação do PCA;
- cruzamento automático entre itens;
- identificação de itens não previstos;
- geração de solicitações de inclusão.

---

## 📊 Planilha de Itens

Gerenciamento completo dos itens da contratação:

- cadastro manual;
- importação de sistemas externos;
- exportação para Excel;
- manutenção de códigos dos produtos.

---

## 💰 Levantamento de Preços

Controle das pesquisas de mercado:

- múltiplas cotações;
- média;
- mediana;
- identificação de preços discrepantes;
- geração de planilhas para fornecedores;
- importação das respostas.

---

## 📬 Ordens de Fornecimento

Permite:

- emissão de OF;
- confirmação eletrônica de recebimento;
- acompanhamento dos prazos;
- histórico completo;
- geração de recibos;
- consulta pública por chave de autenticação.

---

## 🏢 Gestão de Fornecedores

Cadastro único nacional utilizando o CNPJ como identificador.

Armazena:

- razão social;
- CNPJ;
- contatos;
- histórico das Ordens de Fornecimento.

O cadastro é compartilhado entre todas as entidades cadastradas, evitando duplicidade de registros.

---

## 📚 Base Normativa

Repositório centralizado para consulta de:

- Constituição Federal;
- Leis;
- Decretos;
- Portarias;
- Instruções Normativas;
- Acórdãos;
- Pareceres;
- demais atos normativos.

---

## 📈 Relatórios

Emissão de relatórios administrativos relacionados às contratações públicas, fornecedores e Ordens de Fornecimento.

---

## 🗑️ Lixeira

Documentos excluídos permanecem disponíveis para recuperação durante 30 dias.

---

## ⚙️ Administração

Gerenciamento completo da plataforma:

- usuários;
- entidades;
- permissões;
- fornecedores;
- configurações institucionais;
- parâmetros gerais.

---

# Inteligência Artificial

O Hub Compras Públicas não utiliza APIs de Inteligência Artificial.

Como funcionalidade opcional, alguns módulos podem gerar **prompts estruturados**, destinados ao uso em ferramentas externas como:

- ChatGPT;
- Claude;
- Gemini;
- Microsoft Copilot;
- outras plataformas similares.

Nenhuma informação é enviada automaticamente.

Toda utilização ocorre exclusivamente por iniciativa do usuário.

---

# Segurança

A plataforma adota diversas medidas de segurança, incluindo:

- autenticação por e-mail e senha;
- Firebase Authentication;
- Cloud Firestore;
- comunicação criptografada (HTTPS/TLS);
- segregação lógica dos dados por entidade;
- controle de acesso baseado em perfis;
- cache seguro para funcionamento offline;
- sincronização automática dos dados;
- recuperação de documentos;
- regras de segurança do Firestore.

Cada entidade possui acesso apenas às suas próprias informações.

A única base compartilhada é o cadastro nacional de fornecedores.

---

# Conformidade com a LGPD

O Hub Compras Públicas foi concebido observando os princípios da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).

A plataforma:

- não comercializa dados;
- não utiliza informações para publicidade;
- não compartilha documentos entre entidades distintas;
- não envia informações automaticamente para plataformas de Inteligência Artificial.

Cada órgão público permanece como Controlador dos Dados sob sua responsabilidade.

---

# Fluxo de Trabalho

O fluxo recomendado de utilização é:

1. Cadastro da entidade.
2. Cadastro dos usuários.
3. Cadastro dos fornecedores.
4. Cadastro dos itens.
5. Importação do PCA.
6. Levantamento de preços.
7. Elaboração do ETP.
8. Emissão das Declarações.
9. Emissão das Justificativas.
10. Exportação dos documentos.
11. Emissão da Ordem de Fornecimento.
12. Confirmação eletrônica pelo fornecedor.
13. Acompanhamento das entregas.
14. Emissão dos relatórios.

---

# Tecnologias Utilizadas

- React 18
- Vite
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- GitHub Actions
- SheetJS
- Lucide React
- CloudFlare

---

# Estrutura da Plataforma

```
Hub Compras Públicas
│
├── Dashboard
├── ETP Inteligente
├── Declarações
├── Justificativas
├── PCA
├── Planilha de Itens
├── Levantamento de Preços
├── Ordens de Fornecimento
├── Gestão de Fornecedores
├── Base Normativa
├── Relatórios
├── Lixeira
└── Administração
```

---

# Fundamentação Legal

- Constituição Federal de 1988
- Lei nº 14.133/2021
- Lei nº 13.709/2018 (LGPD)
- Lei nº 12.527/2011 (Lei de Acesso à Informação)
- Decreto Federal nº 10.947/2022 (Plano de Contratações Anual)
- Demais normas federais, estaduais e municipais aplicáveis às contratações públicas.

---

# Público-Alvo

O Hub Compras Públicas foi desenvolvido para utilização por:

- Prefeituras Municipais;
- Secretarias Municipais;
- Câmaras Municipais;
- Fundos Municipais;
- Autarquias;
- Consórcios Públicos;
- Fundações;
- Empresas Públicas;
- demais órgãos da Administração Pública.

---

# Histórico

O projeto teve início com o nome **ETP Inteligente**, focado exclusivamente na elaboração de Estudos Técnicos Preliminares.

Com sua evolução funcional e a incorporação de novos módulos voltados ao planejamento, gestão e acompanhamento das contratações públicas, passou por um processo de **Rebranding**, adotando o nome **Hub Compras Públicas**, refletindo sua atuação como uma plataforma integrada para todo o ciclo das compras governamentais.

---

# Desenvolvedor

**Luís Eduardo Monteiro Lima**

Analista Administrativo

Especialista em Compras Públicas, Planejamento das Contratações e Transformação Digital na Administração Pública.

---

# Licença

Este projeto foi desenvolvido para apoiar a transformação digital da Administração Pública e poderá ser adaptado às necessidades de cada órgão ou entidade pública, observadas a legislação vigente, as normas locais e as boas práticas de governança, segurança da informação e proteção de dados.
