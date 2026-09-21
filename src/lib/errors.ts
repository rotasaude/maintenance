// Erros que as telas tratam (spec §5). Nenhuma tela lê status HTTP: o
// cliente traduz aqui, num lugar só.
export class AuthRequired extends Error { constructor() { super("sessão expirada"); } }
export class InvalidCredentials extends Error { constructor() { super("e-mail, senha ou código inválidos"); } }
export class RateLimited extends Error { constructor() { super("muitas tentativas, aguarde"); } }
export class NetworkError extends Error { constructor() { super("sem conexão com a API"); } }

// I3: `.message` é SEMPRE uma frase genérica em português — nunca o código
// cru (`http_500`, `weak_password`...). `.code`/`.status` continuam aqui
// para quem precisa tratar por código (Invitation.tsx já faz isso); toda
// outra tela só lê `.message` e não pode nunca mostrar a palavra de máquina.
export class RequestRejected extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super("a API recusou a requisição");
  }
}

export class GraphQLRefusal extends Error {
  constructor(message: string, public readonly code: string, public readonly path?: (string | number)[]) {
    super(message);
  }
}

export const CITY_FIELD_CODES = [ "CITY_UNREACHABLE", "CITY_ARCHIVED", "CITY_READ_FAILED", "CITY_OUT_OF_SCOPE" ] as const;
