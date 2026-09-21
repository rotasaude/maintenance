// Onde o app está e para onde ele fala (spec §4). Uma função só decide o
// endereço da API: em dev, relativo (o proxy do Vite troca o host); em
// staging, absoluto, outro host no mesmo site, com o CORS que o api já tem.
export type MaintenanceEnv = "development" | "staging";

export function maintenanceEnv(value: string | undefined = import.meta.env.VITE_MAINTENANCE_ENV): MaintenanceEnv {
  if (value === undefined || value === "") return "development";
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
