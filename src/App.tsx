import { EnvBanner } from "./components/EnvBanner";
import { maintenanceEnv } from "./env";
import { useSession } from "./lib/session";
import { Login } from "./screens/Login";

// Entrada mínima (Task 2) trocada pelo fluxo de sessão (Task 4): carregando,
// entrar ou entrado. A Task 6 troca o ramo "signedIn" pelo shell de verdade.
export function App() {
  const { state, me, notice, signIn, signOut } = useSession();

  return (
    <>
      <EnvBanner env={maintenanceEnv()} />
      {state === "loading" && <p>carregando…</p>}
      {state === "signedOut" && <Login onSignedIn={signIn} notice={notice} />}
      {state === "signedIn" && me && (
        <p>
          Olá, {me.emailAddress}{" "}
          <button onClick={() => void signOut()}>sair</button>
        </p>
      )}
    </>
  );
}
