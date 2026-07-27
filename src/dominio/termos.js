/**
 * Termos de Uso e Política de Privacidade — conteúdo editável, guardado no
 * banco (não mais fixo no código). Só o Administrador edita, dentro do
 * Admin; a tela pública (sem login) só lê.
 *
 * O aviso de que este é um rascunho para revisão jurídica fica FIXO no
 * componente da tela, de propósito — não é editável por aqui, para que
 * ninguém remova esse aviso sem perceber a implicação.
 */

export function emptySecaoTermos(titulo = "", corpo = "") {
  return {
    id: "secao_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
    titulo,
    corpo,
  };
}

// Conteúdo inicial — usado para "semear" o banco na primeira vez que a tela
// de edição (ou a tela pública) rodar e não encontrar nada salvo ainda.
// Depois disso, o que estiver no banco manda; isto aqui só serve de ponto
// de partida.
export function secoesPadrao() {
  return [
    emptySecaoTermos("1. O que é este sistema", `
      <p>O Gerador de ETP é uma ferramenta usada pela administração pública municipal para elaborar
      Estudos Técnicos Preliminares, Declarações, Justificativas e Ordens de Fornecimento, com base
      na Lei nº 14.133/2021 (Lei de Licitações e Contratos Administrativos). Ele é operado pelos
      municípios e órgãos cadastrados (Prefeituras, Câmaras Municipais, secretarias, fundos e
      autarquias vinculadas), cada um com seus próprios dados, separados entre si.</p>
    `),
    emptySecaoTermos("2. Quem usa o sistema, e o que cada um vê", `
      <p><b>Servidores e colaboradores cadastrados</b> acessam com login e senha. Cada conta tem um
      de dois perfis:</p>
      <ul>
        <li><b>Administrador</b>: acesso a todas as entidades e municípios cadastrados no sistema.</li>
        <li><b>Usuário padrão</b>: acesso apenas às entidades específicas atribuídas a ele, e às
        páginas e ações que o administrador liberou.</li>
      </ul>
      <p>Essa separação é feita pelo próprio sistema; a proteção de acesso definitiva depende também
      das Regras de Segurança configuradas no banco de dados, mantidas pelo administrador técnico.</p>
    `),
    emptySecaoTermos("3. Dados de fornecedores", `
      <p>Ao emitir uma Ordem de Fornecimento, o sistema registra razão social, CNPJ, e-mail e
      (quando informado) telefone do fornecedor. Esses dados ficam disponíveis para toda a
      administração que usa o sistema — não são exclusivos de uma entidade — porque o CNPJ é um
      identificador nacional único e não se altera entre contratações diferentes.</p>
      <p>O histórico de Ordens de Fornecimento de cada empresa também fica visível para a equipe,
      como forma de acompanhar o relacionamento com aquele fornecedor ao longo do tempo.</p>
    `),
    emptySecaoTermos("4. Telas acessadas sem login, pelo fornecedor", `
      <p>Três telas deste sistema não exigem cadastro nem senha, porque se destinam a quem não é
      servidor público:</p>
      <p><b>4.1. Confirmação de recebimento de uma OF.</b> Acessada por um link único, enviado por
      e-mail (ou repassado manualmente, inclusive por WhatsApp) a cada Ordem de Fornecimento. Quem
      tem esse link consegue confirmar o recebimento ou relatar uma divergência daquela OF
      específica.</p>
      <p><b>4.2. Conferência de autenticidade de um recibo.</b> Qualquer pessoa que tenha a chave de
      autenticidade de um recibo (por exemplo, impressa num comprovante) pode conferir, numa tela
      pública, se ele é válido.</p>
      <p><b>4.3. Central do Fornecedor.</b> Ao informar o CNPJ e o e-mail já cadastrado no sistema,
      o fornecedor visualiza todas as Ordens de Fornecimento emitidas para aquela empresa,
      organizadas por ano, mês e situação, podendo confirmar as que ainda estiverem pendentes.</p>
      <p><b>Atenção específica sobre a Central do Fornecedor:</b> qualquer pessoa que souber o CNPJ
      e o e-mail cadastrado de uma empresa consegue acessar o histórico de OFs dela — não há senha
      nem segundo fator de confirmação. Isso é informado explicitamente na própria tela de entrada
      da Central.</p>
    `),
    emptySecaoTermos("5. Por quanto tempo os dados ficam guardados", `
      <p>Documentos excluídos (ETPs, Justificativas, Declarações) permanecem recuperáveis por 30 dias
      na Lixeira do sistema, e são apagados definitivamente depois desse prazo, ou antes, se um
      administrador esvaziar a Lixeira manualmente. Cadastros de fornecedores e o histórico de
      Ordens de Fornecimento não têm exclusão automática.</p>
    `),
    emptySecaoTermos("6. Base legal para o tratamento dos dados", `
      <p>O tratamento de dados neste sistema tem por finalidade o cumprimento de obrigação legal e a
      execução de políticas públicas relacionadas a contratações administrativas (art. 7º, II e art.
      23 da Lei nº 13.709/2018), além do interesse legítimo da administração pública em manter o
      controle e a transparência de seus processos de compra.</p>
    `),
    emptySecaoTermos("7. Direitos de quem tem dados tratados pelo sistema", `
      <p>Nos termos da LGPD, é possível solicitar confirmação da existência de tratamento, acesso,
      correção de dados incompletos ou desatualizados, e esclarecimentos sobre o compartilhamento de
      dados, mediante requerimento ao órgão responsável pela entidade que emitiu o documento em
      questão.</p>
    `),
    emptySecaoTermos("8. Segurança", `
      <p>Os dados são armazenados na infraestrutura do Google Firebase/Firestore, com tráfego
      criptografado (HTTPS) e Regras de Segurança que restringem leitura e escrita conforme descrito
      nas seções anteriores. Qualquer suspeita de uso indevido deve ser reportada ao responsável
      técnico do sistema.</p>
    `),
    emptySecaoTermos("9. Uso aceitável", `
      <p>Este sistema deve ser usado exclusivamente para as finalidades de gestão de contratações
      públicas para as quais foi disponibilizado. É vedado o uso para fins alheios à administração
      pública, a tentativa de acessar dados de entidades ou municípios não autorizados, e o
      compartilhamento de credenciais de acesso com terceiros.</p>
    `),
    emptySecaoTermos("10. Alterações destes termos", `
      <p>Este documento pode ser atualizado conforme o sistema evoluir ou a legislação aplicável se
      altere. A data no topo desta página indica a versão vigente.</p>
    `),
    emptySecaoTermos("11. Contato", `
      <p>[A preencher pelo Município: nome e contato do responsável pelo tratamento de dados
      (encarregado/DPO) ou do setor a quem dirigir dúvidas e solicitações relacionadas a este
      sistema.]</p>
    `),
  ];
}

export function emptyTermos() {
  return {
    secoes: secoesPadrao(),
    atualizadoEm: Date.now(),
  };
}
