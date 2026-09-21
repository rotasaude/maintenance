import { EnvBanner } from "./components/EnvBanner";
import { maintenanceEnv } from "./env";

// Entrada mínima (Task 2). A Task 4 troca isto pelo fluxo de sessão
// (login, TOTP, convite) sobre o que fica abaixo da faixa de ambiente.
export function App() {
  return (
    <>
      <EnvBanner env={maintenanceEnv()} />
      <h1>Manutenção</h1>
    </>
  );
}
