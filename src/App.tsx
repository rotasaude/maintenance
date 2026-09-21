import { useState } from "react";
import { EnvBanner } from "./components/EnvBanner";
import { maintenanceEnv } from "./env";
import { useSession, type Me } from "./lib/session";
import { Invitation } from "./screens/Invitation";
import { Login } from "./screens/Login";

// Entrada mínima (Task 2) trocada pelo fluxo de sessão (Task 4): carregando,
// entrar ou entrado. A Task 6 troca o ramo "signedIn" pelo shell de verdade.
//
// Fix round 1 (Task 5, ruling P3): o convite NÃO é mais lido aqui dentro —
// `initialInvitationToken` chega pronto de src/main.tsx, lido UMA vez, no
// módulo, antes de createRoot. Um useState(() => readInvitationToken(...))
// aqui dentro parecia bastar, mas o StrictMode do React 18 chama o
// inicializador do useState DUAS VEZES de propósito (checagem de pureza) —
// e ler o fragmento + limpar a URL é impuro por natureza: a primeira
// chamada limpa a URL, a segunda já não acha mais nada. App só guarda o
// valor recebido; a tela de matrícula manda em cima de qualquer estado de
// sessão até onDone — quem chega pelo link ainda não entrou, e não faz
// sentido esperar a sessão carregar antes.
export function App({ initialInvitationToken = null }: { initialInvitationToken?: string | null } = {}) {
  const { state, me, notice, signIn, signOut } = useSession();
  const [ invitationToken, setInvitationToken ] = useState(initialInvitationToken);
  const [ invitationNotice, setInvitationNotice ] = useState<string | null>(null);

  function finishInvitation(message: string) {
    setInvitationToken(null);
    setInvitationNotice(message);
  }

  function handleSignedIn(next: Me) {
    setInvitationNotice(null);
    signIn(next);
  }

  return (
    <>
      <EnvBanner env={maintenanceEnv()} />
      {invitationToken ? (
        <Invitation token={invitationToken} onDone={finishInvitation} />
      ) : (
        <>
          {state === "loading" && <p>carregando…</p>}
          {state === "signedOut" && <Login onSignedIn={handleSignedIn} notice={invitationNotice ?? notice} />}
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
