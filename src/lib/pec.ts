// src/lib/pec.ts
// Regras do quadro "Página do PEC (sistemas externos)" (módulo 20, F-20.1;
// spec §3 e §7; contrato §6). Por cidade, gravados só pelo maintenance:
// a ORIGEM do PEC (para o frame-ancestors da página) e a chave HMAC que o
// próprio PEC gera na configuração do sistema externo. A chave nunca volta
// do api e nunca aparece aqui: a tela só sabe se ela existe e quando mudou.
import type { Tone } from "../theme/tokens";
import { fmtWhen } from "./analytics";
import type { UserErrorView } from "./features";

export const PEC_EXTERNAL_KEY = "pec_external_view";
export const HMAC_KEY_MIN = 16;
export const HMAC_KEY_MAX = 512;

export const PEC_ORIGIN_HELP =
  "Endereço de onde a equipe abre o PEC no navegador (só a origem). Não é o endereço do LEDI, que o operador cadastra no console admin.";
export const PEC_KEY_ROTATE_WARNING =
  "Gravar uma chave nova invalida a anterior na hora: até o PEC da cidade ser configurado com a mesma chave, a página do Rota Saúde dentro do PEC recusa todas as aberturas.";

// Origem pura (esquema + host + porta): o frame-ancestors não aceita caminho.
// `https://host/` vira `https://host`; caminho, query, fragmento, credencial
// ou esquema que não seja http(s) → null.
export function normalizePecOrigin(text: string): string | null {
  const raw = text.trim();
  if (raw === "") return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;
  if (/[#?]/.test(raw)) return null;
  return url.origin;
}

export function pecOriginProblem(text: string): string | null {
  if (text.trim() === "") return "informe o endereço de origem do PEC";
  return normalizePecOrigin(text) ? null : "use só a origem do PEC, como https://pec.cidade.gov.br — sem caminho, sem # e sem ?";
}

// As pontas são aparadas (o colar costuma trazer quebra de linha); o resto
// vai como veio. Espelho do api (16–512 caracteres ASCII visíveis); quem
// decide é ele.
export function hmacKeyProblem(text: string): string | null {
  const key = text.trim();
  if (key === "") return "cole a chave de assinatura gerada pelo PEC";
  if (/\s/.test(key)) return "a chave não pode ter espaço no meio — confira o que foi colado";
  if (!/^[\x21-\x7E]+$/.test(key)) return "a chave só tem letras sem acento, números e símbolos — confira o que foi colado";
  if (key.length < HMAC_KEY_MIN) return `a chave tem de ter ao menos ${HMAC_KEY_MIN} caracteres`;
  if (key.length > HMAC_KEY_MAX) return `a chave tem de ter no máximo ${HMAC_KEY_MAX} caracteres`;
  return null;
}

export type PecConfigView = { pecOrigin?: string | null; hmacKeyConfigured: boolean; hmacKeyUpdatedAt?: string | null };

export function pecOriginText(c: PecConfigView): string {
  return c.pecOrigin ? c.pecOrigin : "não preenchido";
}

export function hmacKeyStatus(c: PecConfigView): { label: string; tone: Tone } {
  return c.hmacKeyConfigured
    ? { label: "chave configurada", tone: "ok" }
    : { label: "chave não gravada — o PEC não consegue abrir a página", tone: "warn" };
}

export function hmacKeyUpdatedText(c: PecConfigView): string {
  if (!c.hmacKeyConfigured) return "nunca gravada";
  return `trocada em ${c.hmacKeyUpdatedAt ? fmtWhen(c.hmacKeyUpdatedAt) : "—"}`;
}

// Cidade inexistente chega como { path: "citySlug", message: "cidade inexistente" }
// (já em português, aparece cru); cidade inalcançável é erro GraphQL CITY_UNREACHABLE,
// fora de `errors`.
const ERROR_LABELS: Record<string, string> = {
  invalid_origin: "o api recusou o endereço — use só a origem do PEC, como https://pec.cidade.gov.br",
  invalid_key: "o api recusou a chave — confira o que foi colado"
};

export function pecConfigErrorText(errors: UserErrorView[]): string {
  if (errors.length === 0) return "não foi possível concluir — tente de novo";
  return errors.map((e) => ERROR_LABELS[e.message] ?? e.message).join("; ");
}
