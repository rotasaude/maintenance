// Página do PEC (sistemas externos) por cidade (módulo 20, F-20.1; spec §3,
// §7 e §8; contrato §6; ADR 0035). Gravados só aqui: a ORIGEM do PEC
// (frame-ancestors da página) e a chave HMAC que o próprio PEC gera. A chave
// nunca volta do api e nunca aparece na tela: o campo é de senha, as escritas
// chamam `gql` direto (sem useMutation, para a chave e o código do autenticador
// não ficarem no cache de mutations) e os dois campos ficam vazios depois.
//
// Trocar a chave exige o TOTP do momento (step-up, decisão M4): a recusa vem
// como em Tokens.tsx — `{ ok: false, errors: [{ path: "code", ... }] }` — e o
// código é consumido a cada tentativa, então o campo esvazia sempre.
//
// Consulta PRÓPRIA, como o SncrPlatformPanel do 19d: contra um api sem o
// módulo 20 a validação recusa o documento inteiro, e só este quadro cai.
// Cidade inexistente: a leitura devolve null sem erro; as escritas, o erro
// `{ path: "citySlug", message: "cidade inexistente" }`. Cidade inalcançável:
// erro GraphQL CITY_UNREACHABLE, mostrado com o código.
import { useEffect, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import {
  PEC_KEY_ROTATE_WARNING, PEC_ORIGIN_HELP, hmacKeyProblem, hmacKeyStatus, hmacKeyUpdatedText, normalizePecOrigin,
  pecConfigErrorText, pecOriginProblem, pecOriginText
} from "../lib/pec";
import { Panel } from "../components/Panel";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { ConfirmButton } from "../components/ConfirmButton";
import { Tag } from "../components/Tag";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { STEP_UP_CODE_HELP_TEXT, StepUpCodeError } from "../components/StepUpCode";

const CityPecConfigQuery = graphql(`
  query CityPecConfig($slug: String!) {
    cityPecConfig(citySlug: $slug) { pecOrigin hmacKeyConfigured hmacKeyUpdatedAt }
  }
`);

// `pecOrigin` é obrigatório e anulável no api: a tela SEMPRE manda o
// argumento, e null apaga.
const SetCityPecOriginMutation = graphql(`
  mutation SetCityPecOrigin($citySlug: String!, $pecOrigin: String) {
    setCityPecOrigin(citySlug: $citySlug, pecOrigin: $pecOrigin) { ok errors { path message } }
  }
`);

const RotateCityPecHmacKeyMutation = graphql(`
  mutation RotateCityPecHmacKey($citySlug: String!, $key: String!, $code: String!) {
    rotateCityPecHmacKey(citySlug: $citySlug, key: $key, code: $code) { ok errors { path message } }
  }
`);

const TITLE = "Página do PEC (sistemas externos)";
const OLD_API_CODES = new Set([ "undefinedField" ]);
const STEP_UP_CODE = /^\d{6}$/;

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem a página do PEC — o api do módulo 20 precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

type UserError = { path?: string | null; message: string };
type Payload = { ok: boolean; errors: UserError[] } | null | undefined;

// Recusa do envelope (CITY_UNREACHABLE, CITY_OUT_OF_SCOPE…): payload nulo e o
// motivo em `errors`, com o código.
function envelopeFailure(fieldErrors: GraphQLRefusal[]): string {
  const refusal = fieldErrors[0];
  return refusal ? `${refusal.code} — ${refusal.message}` : pecConfigErrorText([]);
}

function payloadFailure(payload: Payload, fieldErrors: GraphQLRefusal[]): string | null {
  if (payload == null) return envelopeFailure(fieldErrors);
  return payload.ok ? null : pecConfigErrorText(payload.errors);
}

export function PecConfigPanel({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const queryKey = [ "city", slug, "pec" ];
  const query = useQuery({ queryKey, queryFn: () => gql(CityPecConfigQuery, { slug }), staleTime: Infinity });
  const config = query.data?.data?.cityPecConfig ?? null;
  const fieldError = query.data?.fieldErrors[0];

  const [ originText, setOriginText ] = useState("");
  const [ originTouched, setOriginTouched ] = useState(false);
  const [ keyText, setKeyText ] = useState("");
  const [ code, setCode ] = useState("");
  const [ codeError, setCodeError ] = useState<string | null>(null);
  const [ busy, setBusy ] = useState<"origin" | "key" | null>(null);
  const [ done, setDone ] = useState<string | null>(null);
  const [ failure, setFailure ] = useState<string | null>(null);

  // O campo começa com o valor gravado; depois de mexer, o que vale é o digitado.
  useEffect(() => {
    if (!originTouched) setOriginText(config?.pecOrigin ?? "");
  }, [ config?.pecOrigin, originTouched ]);

  const keyProblem = keyText === "" ? null : hmacKeyProblem(keyText);
  const configured = config?.hmacKeyConfigured ?? false;

  function resetMessages() {
    setDone(null); setFailure(null); setCodeError(null);
  }

  async function saveOrigin() {
    resetMessages();
    // Campo vazio apaga (null); preenchido, vai a origem normalizada, nunca o texto cru.
    const cleared = originText.trim() === "";
    const origin = cleared ? null : normalizePecOrigin(originText);
    if (!cleared && origin === null) { setFailure(pecOriginProblem(originText)); return; }
    setBusy("origin");
    try {
      const { data, fieldErrors } = await gql(SetCityPecOriginMutation, { citySlug: slug, pecOrigin: origin });
      const fail = payloadFailure(data?.setCityPecOrigin, fieldErrors);
      if (fail) { setFailure(fail); return; }
      setOriginTouched(false);
      setDone(cleared ? "Endereço de origem do PEC apagado." : "Endereço de origem do PEC salvo.");
      void queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "erro inesperado");
    } finally {
      setBusy(null);
    }
  }

  async function rotateKey() {
    resetMessages();
    const key = keyText.trim();
    const stepUpCode = code.trim();
    if (hmacKeyProblem(key) || !STEP_UP_CODE.test(stepUpCode)) return;
    setBusy("key");
    try {
      const { data, fieldErrors } = await gql(RotateCityPecHmacKeyMutation, { citySlug: slug, key, code: stepUpCode });
      const payload = data?.rotateCityPecHmacKey;
      if (payload == null) { setFailure(envelopeFailure(fieldErrors)); return; }
      if (!payload.ok) {
        // Recusa do step-up (código inválido, conta bloqueada) fica no campo
        // do código, com o aviso de bloqueio; o resto, no quadro.
        const codeErrors = payload.errors.filter((e) => e.path === "code");
        const others = payload.errors.filter((e) => e.path !== "code");
        if (codeErrors.length > 0) setCodeError(codeErrors.map((e) => e.message).join(" "));
        if (others.length > 0 || codeErrors.length === 0) setFailure(pecConfigErrorText(others));
        return;
      }
      setKeyText("");
      setDone("Chave gravada. Configure a mesma chave no PEC da cidade, se ainda não estiver lá.");
      void queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "erro inesperado");
    } finally {
      // O código é consumido a cada tentativa (step_up!): esvazia sempre.
      setCode("");
      setBusy(null);
    }
  }

  const status = config ? hmacKeyStatus(config) : null;
  const notFound = query.isSuccess && !config && !fieldError;

  return (
    <section aria-label={TITLE}>
      <Panel title={TITLE} actions={<Button onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>}>
        <p style={note}>{PEC_ORIGIN_HELP}</p>
        {query.isPending && <p>carregando…</p>}
        {query.isError && <ErrorState message={requestErrorText(query.error)} />}
        {fieldError && <ErrorState message={`${fieldError.code} — ${fieldError.message}`} />}
        {notFound && <EmptyState message="cidade não encontrada" />}
        {config && status && (
          <>
            <div role="group" aria-label="configuração do PEC" style={column}>
              <div style={row}>
                <strong style={{ fontSize: 12.5 }}>Origem</strong>
                <span>{pecOriginText(config)}</span>
              </div>
              <div style={row}>
                <strong style={{ fontSize: 12.5 }}>Chave HMAC</strong>
                <Tag tone={status.tone}>{status.label}</Tag>
                <span style={note}>{hmacKeyUpdatedText(config)}</span>
              </div>
            </div>

            {done && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ok)" }}>{done}</p>}
            {failure && <ErrorState message={failure} />}

            <div style={column}>
              <Field label="Endereço de origem do PEC" value={originText} autoComplete="off"
                onChange={(v) => { setOriginTouched(true); setOriginText(v); }}
                helpText="Ex.: https://pec.curitiba.pr.gov.br — deixe vazio e salve para apagar." />
              <div><Button onClick={() => void saveOrigin()} busy={busy === "origin"} disabled={busy !== null}>salvar endereço</Button></div>
            </div>

            <div style={column}>
              <Field label="Chave de assinatura do PEC" type="password" name="pec-hmac-key" autoComplete="off" value={keyText}
                onChange={setKeyText} helpText="Cole a chave que o PEC gerou na configuração do sistema externo. Ela não aparece de novo." />
              {keyProblem && <p style={{ margin: 0, fontSize: 11.5, color: "var(--down)" }}>{keyProblem}</p>}
              <Field label="Código do autenticador" name="code" autoComplete="one-time-code" value={code}
                onChange={setCode} helpText={STEP_UP_CODE_HELP_TEXT} />
              {codeError && <StepUpCodeError message={codeError} />}
              <p role="note" aria-label="aviso da troca da chave" style={warnNote}>{PEC_KEY_ROTATE_WARNING}</p>
              <div>
                <ConfirmButton
                  label={configured ? "trocar a chave" : "gravar a chave"}
                  confirmLabel={configured ? "confirmar: trocar a chave HMAC" : "confirmar: gravar a chave HMAC"}
                  busy={busy === "key"}
                  disabled={busy !== null || keyText.trim() === "" || keyProblem !== null || !STEP_UP_CODE.test(code.trim())}
                  onConfirm={() => void rotateKey()}
                />
              </div>
            </div>
          </>
        )}
      </Panel>
    </section>
  );
}

const note: CSSProperties = { margin: 0, fontSize: 11.5, color: "var(--ink3)" };
const warnNote: CSSProperties = { margin: 0, fontSize: 12, fontWeight: 600, color: "var(--warn)" };
const row: CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const column: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
