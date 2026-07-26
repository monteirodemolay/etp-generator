/**
 * Admin — reúne o que só quem administra pode ver: Entidades, Usuários,
 * Dias Úteis e Backup. Antes eram quatro itens soltos na lateral; juntar
 * aqui deixa o menu principal mais limpo e deixa claro que essas quatro
 * coisas são, todas, ferramentas administrativas.
 */

import React, { useState } from "react";
import { Building2, Users, CalendarDays, Download } from "lucide-react";
import { C } from "../tokens.js";
import { SecretariasView } from "./entidades.jsx";
import { UsuariosView } from "./usuarios.jsx";
import { DiasUteisView } from "./dias-uteis.jsx";
import { TelaBackup } from "../painel/backup.jsx";

const SUBABAS = [
  { id: "entidades", rotulo: "Entidades", icone: Building2 },
  { id: "usuarios", rotulo: "Usuários", icone: Users },
  { id: "dias-uteis", rotulo: "Dias Úteis", icone: CalendarDays },
  { id: "backup", rotulo: "Backup", icone: Download },
];

export function AdminView({
  secretarias, onSalvarSecretaria, onNovaSecretaria, onExcluirSecretaria,
  municipios, onNovoMunicipio, onExcluirMunicipio,
  usuarios, emailUsuario, onSalvarUsuario, onExcluirUsuario,
  etps, justificativas, declaracoes, ofs, onRecarregar,
}) {
  const [subaba, setSubaba] = useState("entidades");

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b" style={{ borderColor: C.border }}>
        {SUBABAS.map(s => {
          const ativo = subaba === s.id;
          const Icone = s.icone;
          return (
            <button key={s.id} onClick={() => setSubaba(s.id)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium -mb-px border-b-2"
              style={{
                borderColor: ativo ? C.brass : "transparent",
                color: ativo ? C.navy : C.inkMuted,
              }}>
              <Icone size={14} /> {s.rotulo}
            </button>
          );
        })}
      </div>

      {subaba === "entidades" && (
        <SecretariasView secretarias={secretarias} onSalvar={onSalvarSecretaria}
          etps={etps} justificativas={justificativas} declaracoes={declaracoes} ofs={ofs}
          onNova={onNovaSecretaria} onExcluir={onExcluirSecretaria}
          municipios={municipios} onNovoMunicipio={onNovoMunicipio} onExcluirMunicipio={onExcluirMunicipio} />
      )}

      {subaba === "usuarios" && (
        <UsuariosView usuarios={usuarios} secretarias={secretarias} emailAtual={emailUsuario}
          onSalvar={onSalvarUsuario} onNovo={onSalvarUsuario} onExcluir={onExcluirUsuario} />
      )}

      {subaba === "dias-uteis" && (
        <DiasUteisView municipios={municipios} />
      )}

      {subaba === "backup" && <TelaBackup onRestaurado={onRecarregar} />}
    </div>
  );
}
