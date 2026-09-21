import { print } from "graphql";
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { apiBase } from "../env";
import { AuthRequired, GraphQLRefusal, InvalidCredentials, NetworkError, RateLimited, RequestRejected } from "./errors";

// O ÚNICO lugar que fala HTTP com a API de manutenção (spec §5).
//
// Toda chamada leva X-Rota-Maintenance: 1 — a API falha fechado sem ele — e
// credentials: "include", porque em staging a API é outro host do mesmo site.
// Nada vai na URL além do caminho: token, senha e código só no corpo.
// I1: TODO 401 que /session e /session/challenge podem devolver (ver
// app/controllers/maintenance/sessions_controller.rb no api) — não só
// invalid_credentials/invalid_session. invalid_code (TOTP errado, ainda sob
// o limite) e too_many_attempts (TOTP errado estourando o limite, ou conta
// já bloqueada) também são recusas de credencial, nunca sessão expirada: um
// código que falta aqui vira AuthRequired e dispara o listener de
// onAuthRequired à toa, silenciando o Login (I1).
const LOGIN_FAILURES = new Set([ "invalid_credentials", "invalid_session", "invalid_code", "too_many_attempts" ]);
const listeners = new Set<() => void>();

export function onAuthRequired(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function send(method: string, path: string, body?: object): Promise<Response> {
  try {
    return await fetch(`${apiBase()}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "X-Rota-Maintenance": "1" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new NetworkError();
  }
}

async function failure(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  const code = payload.error ?? `http_${response.status}`;

  if (response.status === 401 && LOGIN_FAILURES.has(code)) return new InvalidCredentials();
  if (response.status === 401) {
    listeners.forEach((listener) => listener());
    return new AuthRequired();
  }
  if (response.status === 429) return new RateLimited();
  return new RequestRejected(code, response.status);
}

export async function rest<T>(method: "GET" | "POST" | "DELETE", path: string, body?: object): Promise<T> {
  const response = await send(method, path, body);
  if (!response.ok) throw await failure(response);
  if (response.status === 204) return undefined as T;
  return await response.json().catch(() => undefined) as T;
}

type GraphQLError = { message: string; path?: (string | number)[]; extensions?: { code?: string } };

export async function gql<TResult, TVars>(
  document: TypedDocumentNode<TResult, TVars>,
  variables?: TVars
): Promise<{ data: TResult | null; fieldErrors: GraphQLRefusal[] }> {
  const response = await send("POST", "/graphql", { query: print(document), variables: variables ?? {} });
  if (!response.ok) throw await failure(response);

  const payload = await response.json() as { data?: TResult | null; errors?: GraphQLError[] };
  const errors = (payload.errors ?? []).map(
    (e) => new GraphQLRefusal(e.message, e.extensions?.code ?? "UNKNOWN", e.path)
  );

  if (payload.data == null) throw errors[0] ?? new GraphQLRefusal("resposta vazia", "EMPTY");
  return { data: payload.data, fieldErrors: errors };
}
