import { useState } from "react";
import { EnvBanner } from "./components/EnvBanner";
import { maintenanceEnv } from "./env";
import { readInvitationToken } from "./lib/invitation";
import { useSession } from "./lib/session";
import { Invitation } from "./screens/Invitation";
import { Login } from "./screens/Login";

// Entrada mínima (Task 2) trocada pelo fluxo de sessão (Task 4): carregando,
// entrar ou entrado. A Task 6 troca o ramo "signedIn" pelo shell de verdade.
//
// O convite (Task 5) é lido UMA vez, com o inicializador preguiçoso do
// useState — nunca a cada render — e a tela de matrícula manda em cima de
// qualquer estado de sessão até onDone: quem chega pelo link ainda não
// entrou, e não faz sentido esperar a sessão carregar antes.
export function App() {
  const { state, me, notice, signIn, signOut } = useSession();
  const [ invitationToken, setInvitationToken ] = useState(() => readInvitationToken(window.location, window.history));

  return (
    <>
      <EnvBanner env={maintenanceEnv()} />
      {invitationToken ? (
        <Invitation token={invitationToken} onDone={() => setInvitationToken(null)} />
      ) : (
        <>
          {state === "loading" && <p>carregando…</p>}
          {state === "signedOut" && <Login onSignedIn={signIn} notice={notice} />}
          {state === "signedIn" && me && (
            <p>
              Olá, {me.emailAddress}{" "}
              <button onClick={() => void signOut()}>sair</button>
            </p>
          )}
        </>
      )}
    </>
  );
}
