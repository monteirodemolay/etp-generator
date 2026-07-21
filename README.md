# Gerador de ETP

Aplicativo web para elaboração de Estudos Técnicos Preliminares (ETP) em processos de contratação pública, desenvolvido com base nas exigências do art. 18 da Lei nº 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos).

O sistema foi criado para uso no âmbito da Secretaria Municipal de Assistência Social de Rio Verde/GO, no fluxo de compras e contratações do setor, com o objetivo de padronizar a elaboração dos ETPs, reduzir retrabalho e organizar em um único lugar as etapas que hoje ficam espalhadas entre planilhas, documentos avulsos e consultas manuais ao Plano de Contratações Anual (PCA) e a cotações de preços.

## Sobre o projeto

A elaboração de um ETP envolve levantar uma necessidade, reunir informações de fontes distintas, a relação de itens a adquirir, a verificação de que o objeto consta no PCA, a pesquisa de preços junto a fornecedores e o texto de cada um dos treze incisos exigidos pelo art. 18. Na prática, esse processo costuma ser feito manualmente, item por item, com alto risco de inconsistência entre o que foi levantado e o que efetivamente entra no documento final.

Este aplicativo organiza esse fluxo em etapas sequenciais e mantém os dados conectados entre si: o que é cadastrado na planilha de itens alimenta automaticamente o alinhamento ao PCA, o levantamento de preços e os textos-modelo dos incisos correspondentes, evitando digitação repetida e divergências entre as partes do documento.

## Funcionalidades

**1. Planilha de Itens**
Cadastro dos itens objeto da contratação, com importação direta de planilhas do Sistema Centi (mantendo os códigos de produto) e exportação de um modelo em branco para preenchimento offline.

**2. Alinhamento ao PCA**
Importação da planilha exportada do painel do PCA e cruzamento automático, por código de produto, com os itens cadastrados. O sistema identifica quais itens já constam previstos no plano e gera a planilha de requerimento de inclusão, no formato aceito pelo Centi, para os itens que ainda não constam.

**3. Dados do Processo**
Identificação do objeto, órgão, setor requisitante, responsável técnico, número de processo e demais dados que alimentam o cabeçalho do documento e os textos-modelo dos incisos — parcelamento, prazos de garantia e entrega, metodologia de cálculo de valor, metodologia de levantamento de quantidades, existência de contratações correlatas e de impactos ambientais relevantes.

**4. Levantamento de Preços**
Registro de cotações por item, com fonte (Banco de Preços, internet, fornecedor ou outra, de livre digitação), cálculo automático de média e mediana, e sinalização de valores fora de uma margem de aceitação configurável em torno da mediana — sem exclusão automática, a decisão de manter ou remover uma cotação é sempre do servidor responsável. O sistema também gera a planilha de cotação para envio a fornecedores e importa de volta os valores preenchidos.

**5. Editor dos treze incisos**
Cada inciso do art. 18 tem um modelo padrão de texto pré-configurado, preenchido automaticamente com os dados já cadastrados nas etapas anteriores — sem qualquer custo ou dependência de serviços externos. Um recurso complementar permite gerar rascunhos por inteligência artificial quando o servidor dispuser de uma chave de API própria; o uso é opcional e não é necessário para o funcionamento do restante do sistema. Os incisos V (Estimativa das Quantidades) e VI (Estimativa do Valor) contam com editor de texto formatado, com suporte a negrito, listas e tabelas.

**6. Timbre institucional**
O timbre da Secretaria é definido uma única vez e passa a constar automaticamente em todos os ETPs gerados, repetido em todas as páginas tanto na exportação em Word quanto na impressão em PDF.

**7. Exportação**
O documento final pode ser copiado como texto simples, impresso ou salvo em PDF pelo navegador, ou exportado como arquivo do Word, já formatado e pronto para tramitação.

## Fluxo de uso recomendado

1. Cadastrar os itens na Planilha de Itens (ou importar do Sistema Centi).
2. Conferir o Alinhamento ao PCA e, se necessário, gerar o requerimento de inclusão dos itens faltantes.
3. Preencher os Dados do Processo.
4. Registrar o Levantamento de Preços e definir o valor adotado por item.
5. Preencher os treze incisos, usando os modelos padrão como ponto de partida e ajustando conforme a especificidade do caso.
6. Revisar na Pré-visualização e exportar em Word ou PDF.

## Tecnologias utilizadas

- React 18 com Vite
- Tailwind CSS
- lucide-react (ícones)
- xlsx / SheetJS (leitura e geração de planilhas Excel)

Nenhuma dependência paga é exigida para o funcionamento do sistema. O recurso opcional de geração de texto por inteligência artificial utiliza outras plataformas do próprio usuário.

## Rodando no GitHub Pages

```bash
npm install
npm run dev
```

## Publicação

O repositório inclui um workflow do GitHub Actions (`.github/workflows/deploy.yml`) que publica o aplicativo no GitHub Pages a cada atualização da branch `main`. Basta habilitar, em Settings → Pages, a opção "GitHub Actions" como origem do site.

## Armazenamento dos dados

Os ETPs, o timbre e a chave de API (quando configurada) ficam salvos no `localStorage` do navegador utilizado, sem envio a servidores externos além da própria API da Anthropic, quando o recurso de IA é utilizado. Não há sincronização entre dispositivos. Recomenda-se exportar os ETPs concluídos (Word ou PDF) para guardar cópia fora do navegador.

## Fundamento legal

Lei nº 14.133/2021, art. 18 e correlatos (planejamento das contratações, Estudo Técnico Preliminar, Plano de Contratações Anual e pesquisa de preços).

## Autoria

Desenvolvido por **Luís Eduardo Monteiro Lima**, Administrative Analyst da Prefeitura Municipal de Rio Verde/GO, para uso no setor de compras da Secretaria Municipal de Assistência Social.
