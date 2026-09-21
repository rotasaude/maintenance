import { useState } from "react";
import { EnvBanner } from "./components/EnvBanner";
import { ErrorState } from "./components/ErrorState";
import { maintenanceEnv } from "./env";
import { useSession, type Me } from "./lib/session";
import { Invitation } from "./screens/Invitation";
import { Login } from "./screens/Login";
import { Shell } from "./screens/Shell";

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
//
// Task 6: o ramo "signedIn" troca o placeholder pelo shell de verdade —
// Shell lê `me` e `signOut` do próprio useSession(), não por prop.
export function App({ initialInvitationToken = null }: { initialInvitationToken?: string | null } = {}) {
  const { state, me, notice, signIn } = useSession();
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

  // I5: maintenanceEnv() agora falha alto (em vez de assumir "development")
  // quando um build de produção sobe sem VITE_MAINTENANCE_ENV — um deploy de
  // staging mal configurado é exatamente o caso que a faixa de ambiente
  // (spec F6) existe para prevenir. Sem este try/catch, o throw estouraria
  // durante o render e derrubaria a árvore inteira: tela em branco, sem
  // nenhum indício do que houve. Barato de evitar — mostra a mensagem em vez
  // de deixar a exceção subir.
  let env;
  try {
    env = maintenanceEnv();
  } catch (err) {
    return (
      <div style={{ maxWidth: 320, margin: "64px auto" }}>
        <ErrorState message={err instanceof Error ? err.message : "erro de configuração do ambiente"} />
      </div>
    );
  }

  return (
    <>
      <EnvBanner env={env} />
      {invitationToken ? (
        <Invitation token={invitationToken} onDone={finishInvitation} />
      ) : (
        <>
          {state === "loading" && <p>carregando…</p>}
          {state === "signedOut" && <Login onSignedIn={handleSignedIn} notice={invitationNotice ?? notice} />}
          {state === "signedIn" && me && <Shell />}
        </>
      )}
    </>
  );
}
