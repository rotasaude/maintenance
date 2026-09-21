// Onde o app está e para onde ele fala (spec §4). Uma função só decide o
// endereço da API: em dev, relativo (o proxy do Vite troca o host); em
// staging, absoluto, outro host no mesmo site, com o CORS que o api já tem.
export type MaintenanceEnv = "development" | "staging";

// I5: em dev/test, uma variável ausente cai em "development" — conveniente
// para rodar sem .env. Mas num BUILD DE PRODUÇÃO (import.meta.env.PROD;
// staging é servido a partir de um build assim, `vite build`), o mesmo
// default silencioso rotularia um deploy de staging como development e
// esconderia a faixa de aviso (spec F6, EnvBanner) — o erro mais caro que
// esta tela pode induzir. Falha alto em vez de assumir. `isProd` é
// parâmetro, não leitura direta de import.meta.env.PROD, para o teste
// poder injetar os dois casos sem depender do modo real do Vitest.
export function maintenanceEnv(
  value: string | undefined = import.meta.env.VITE_MAINTENANCE_ENV,
  isProd: boolean = import.meta.env.PROD
): MaintenanceEnv {
  if (value === undefined || value === "") {
    if (isProd) throw new Error("VITE_MAINTENANCE_ENV é obrigatória em build de produção");
    return "development";
  }
  if (value === "development" || value === "staging") return value;
  throw new Error(`VITE_MAINTENANCE_ENV desconhecido: ${value}`);
}

export function apiBase(
  env: MaintenanceEnv = maintenanceEnv(),
  url: string | undefined = import.meta.env.VITE_MAINTENANCE_API_URL
): string {
  if (env === "development") return "";
  if (!url) throw new Error("VITE_MAINTENANCE_API_URL é obrigatória em staging");
  return url.replace(/\/+$/, "");
}
