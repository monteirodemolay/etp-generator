/**
 * Termos de Uso e Política de Privacidade.
 *
 * Conteúdo organizado em seções específicas — cada uma cobre um bloco do
 * sistema (usuários internos, fornecedores, portais públicos), pra ficar
 * fácil de editar uma parte sem mexer nas demais.
 *
 * ATENÇÃO: isto é um rascunho para revisão jurídica, não um documento
 * validado pela Procuradoria. Ver o aviso no topo da própria tela.
 */

import React from "react";

const C = {
  navy: "#1C2E4A", paper: "#FAF7F0", paperDark: "#F1ECDF", brass: "#A6832E",
  ink: "#2A2A28", inkMuted: "#6B675E", border: "#DAD3C2", red: "#A6403D",
};

function Secao({ titulo, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, color: C.navy, borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 12 }}>
        {titulo}
      </h2>
      <div style={{ fontSize: 13.5, lineHeight: 1.7, color: C.ink }}>{children}</div>
    </section>
  );
}

export function TermosPrivacidade() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 780, margin: "20px auto 60px", background: "#fff", borderRadius: 12, padding: "32px 36px", boxShadow: "0 4px 6px rgba(0,0,0,0.08)" }}>

        <div style={{ borderBottom: `2px solid ${C.border}`, paddingBottom: 16, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.brass, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
            Gerador de ETP
          </span>
          <h1 style={{ margin: "6px 0 0 0", color: C.navy, fontSize: 22 }}>Termos de Uso e Política de Privacidade</h1>
          <p style={{ margin: "6px 0 0 0", fontSize: 12, color: C.inkMuted }}>Última atualização: julho de 2026</p>
        </div>

        <div style={{ background: "#fff3cd", border: "1px solid #ffecb5", color: "#664d03", padding: 14, borderRadius: 8, margin: "18px 0 26px", fontSize: 12.5, lineHeight: 1.6 }}>
          <b>Aviso importante:</b> este documento é um rascunho, redigido para orientar o funcionamento
          do sistema e ajudar numa eventual revisão jurídica — não substitui a análise da Procuradoria
          do Município nem qualquer outro instrumento formal exigido pela legislação aplicável,
          especialmente a Lei nº 13.709/2018 (LGPD), em particular os artigos 23 a 30, que tratam do
          tratamento de dados pelo Poder Público.
        </div>

        <Secao titulo="1. O que é este sistema">
          <p>
            O Gerador de ETP é uma ferramenta usada pela administração pública municipal para elaborar
            Estudos Técnicos Preliminares, Declarações, Justificativas e Ordens de Fornecimento, com
            base na Lei nº 14.133/2021 (Lei de Licitações e Contratos Administrativos). Ele é operado
            pelos municípios e órgãos cadastrados (Prefeituras, Câmaras Municipais, secretarias, fundos
            e autarquias vinculadas), cada um com seus próprios dados, separados entre si.
          </p>
        </Secao>

        <Secao titulo="2. Quem usa o sistema, e o que cada um vê">
          <p><b>Servidores e colaboradores cadastrados</b> acessam com login e senha. Cada conta tem um
            de dois perfis:</p>
          <ul style={{ paddingLeft: 20, marginTop: 6 }}>
            <li><b>Administrador</b>: acesso a todas as entidades e municípios cadastrados no sistema.</li>
            <li><b>Usuário padrão</b>: acesso apenas às entidades específicas atribuídas a ele, e às
              páginas e ações que o administrador liberou (criar, editar, excluir documentos, entre
              outras).</li>
          </ul>
          <p>
            Essa separação é feita pelo próprio sistema; ainda assim, a proteção de acesso definitiva
            depende também das Regras de Segurança configuradas no banco de dados, mantidas pelo
            administrador técnico do sistema.
          </p>
        </Secao>

        <Secao titulo="3. Dados de fornecedores">
          <p>
            Ao emitir uma Ordem de Fornecimento, o sistema registra razão social, CNPJ, e-mail e
            (quando informado) telefone do fornecedor. Esses dados ficam disponíveis para toda a
            administração que usa o sistema — não são exclusivos de uma entidade — porque o CNPJ é
            um identificador nacional único e não se altera entre contratações diferentes.
          </p>
          <p>
            O histórico de Ordens de Fornecimento de cada empresa (quantas recebeu, quantas confirmou,
            quantas com divergência) também fica visível para a equipe, como forma de acompanhar o
            relacionamento com aquele fornecedor ao longo do tempo.
          </p>
        </Secao>

        <Secao titulo="4. Telas acessadas sem login, pelo fornecedor">
          <p>Três telas deste sistema não exigem cadastro nem senha, porque se destinam a quem não é
            servidor público. Cada uma tem um nível de exposição diferente, explicado abaixo:</p>

          <p style={{ marginTop: 10 }}><b>4.1. Confirmação de recebimento de uma OF.</b> Acessada por um
            link único, enviado por e-mail (ou repassado manualmente, inclusive por WhatsApp) a cada
            Ordem de Fornecimento. Quem tem esse link consegue confirmar o recebimento ou relatar uma
            divergência daquela OF específica.</p>

          <p style={{ marginTop: 10 }}><b>4.2. Conferência de autenticidade de um recibo.</b> Uma vez
            confirmado o recebimento, é gerada uma chave de autenticidade. Qualquer pessoa que tenha
            essa chave (por exemplo, impressa num comprovante) pode conferir, numa tela pública, se o
            recibo é válido.</p>

          <p style={{ marginTop: 10 }}><b>4.3. Central do Fornecedor.</b> Ao informar o CNPJ e o e-mail
            já cadastrado no sistema, o fornecedor visualiza todas as Ordens de Fornecimento emitidas
            para aquela empresa, organizadas por ano, mês e situação, podendo confirmar as que ainda
            estiverem pendentes.
          </p>
          <p style={{ background: C.paperDark, padding: "10px 12px", borderRadius: 8, marginTop: 10 }}>
            <b>Atenção específica sobre a Central do Fornecedor:</b> qualquer pessoa que souber o CNPJ
            e o e-mail cadastrado de uma empresa consegue acessar o histórico de OFs dela — não há
            senha nem segundo fator de confirmação. Isso é informado explicitamente na própria tela de
            entrada da Central, no momento em que a consulta é feita.
          </p>
        </Secao>

        <Secao titulo="5. Por quanto tempo os dados ficam guardados">
          <p>
            Documentos excluídos (ETPs, Justificativas, Declarações) permanecem recuperáveis por 30
            dias na Lixeira do sistema, e são apagados definitivamente depois desse prazo, ou antes,
            se um administrador esvaziar a Lixeira manualmente. Cadastros de fornecedores e o histórico
            de Ordens de Fornecimento não têm exclusão automática — permanecem enquanto o sistema for
            utilizado pela administração, servindo de registro histórico das contratações.
          </p>
        </Secao>

        <Secao titulo="6. Base legal para o tratamento dos dados">
          <p>
            O tratamento de dados neste sistema tem por finalidade o cumprimento de obrigação legal e
            a execução de políticas públicas relacionadas a contratações administrativas (art. 7º, II
            e art. 23 da Lei nº 13.709/2018), além do interesse legítimo da administração pública em
            manter o controle e a transparência de seus processos de compra.
          </p>
        </Secao>

        <Secao titulo="7. Direitos de quem tem dados tratados pelo sistema">
          <p>
            Nos termos da LGPD, é possível solicitar confirmação da existência de tratamento, acesso,
            correção de dados incompletos ou desatualizados, e esclarecimentos sobre o compartilhamento
            de dados, mediante requerimento ao órgão responsável pela entidade que emitiu o documento
            em questão.
          </p>
        </Secao>

        <Secao titulo="8. Segurança">
          <p>
            Os dados são armazenados na infraestrutura do Google Firebase/Firestore, com tráfego
            criptografado (HTTPS) e Regras de Segurança que restringem leitura e escrita conforme
            descrito nas seções anteriores. Nenhum sistema é infalível; qualquer suspeita de uso
            indevido deve ser reportada ao responsável técnico do sistema.
          </p>
        </Secao>

        <Secao titulo="9. Uso aceitável">
          <p>
            Este sistema deve ser usado exclusivamente para as finalidades de gestão de contratações
            públicas para as quais foi disponibilizado. É vedado o uso para fins alheios à
            administração pública, a tentativa de acessar dados de entidades ou municípios não
            autorizados, e o compartilhamento de credenciais de acesso com terceiros.
          </p>
        </Secao>

        <Secao titulo="10. Alterações destes termos">
          <p>
            Este documento pode ser atualizado conforme o sistema evoluir ou a legislação aplicável se
            altere. A data no topo desta página indica a versão vigente.
          </p>
        </Secao>

        <Secao titulo="11. Contato">
          <p style={{ color: C.inkMuted }}>
            [A preencher pelo Município: nome e contato do responsável pelo tratamento de dados
            (encarregado/DPO) ou do setor a quem dirigir dúvidas e solicitações relacionadas a este
            sistema.]
          </p>
        </Secao>

        <div style={{ textAlign: "center", marginTop: 30 }}>
          <a href={`${window.location.origin}${window.location.pathname}`} style={{ color: "#2563eb", fontSize: 12, textDecoration: "underline" }}>
            ← Voltar
          </a>
        </div>
      </div>
    </div>
  );
}
