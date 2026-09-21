import type { MaintenanceEnv } from "../env";

// Spec F6: com alcance total sobre as cidades, confundir staging com dev é o
// erro mais caro que a tela pode induzir. A faixa nunca sai do topo.
const LABEL: Record<MaintenanceEnv, string> = { development: "DEVELOPMENT", staging: "STAGING" };

export function EnvBanner({ env }: { env: MaintenanceEnv }) {
  return (
    <div role="status" className="env-banner" data-env={env}>
      {LABEL[env]}
    </div>
  );
}
