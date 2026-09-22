import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import { actionsFor, type ProtocolAction } from "../lib/protocolActions";
import { Panel } from "../components/Panel";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { STEP_UP_CODE_HELP_TEXT, StepUpCodeError } from "../components/StepUpCode";

// Aba Protocolos (Plano 2 do frontend): ciclo de vida das versões de uma
// cidade. O mantenedor NUNCA assina (ADR-0016) — aqui ele só executa o ato
// quando as assinaturas dos revisores da cidade já existem. O que está
// habilitado é previsão (src/lib/protocolActions.ts); quem decide é a API.
const CityProtocolVersionsQuery = graphql(`
  query CityProtocolVersions($slug: String!) {
    city(slug: $slug) {
      slug
      protocolVersions {
        name version status
        publicationSignatures publicationMissing
        activationSignatures activationMissing
        eligibleReviewers revertible
      }
    }
  }
`);

const SubmitMutation = graphql(`
  mutation SubmitProtocolForReview($citySlug: String!, $name: String!, $version: Int!) {
    submitProtocolForReview(citySlug: $citySlug, name: $name, version: $version) { ok errors { path message } }
  }
`);
const PublishMutation = graphql(`
  mutation PublishProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {
    publishProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }
  }
`);
const ActivateMutation = graphql(`
  mutation ActivateProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {
    activateProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }
  }
`);
const RetireMutation = graphql(`
  mutation RetireProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {
    retireProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }
  }
`);
const RevertMutation = graphql(`
  mutation RevertProtocolActivation($citySlug: String!, $name: String!, $reason: String!, $code: String!) {
    revertProtocolActivation(citySlug: $citySlug, name: $name, reason: $reason, code: $code) { ok errors { path message } }
  }
`);

const STATUS_LABELS: Record<string, string> = {
  draft: "rascunho", in_review: "em revisão", published: "publicada", active: "ativa", retired: "aposentada"
};
const REVERT_NOTICE = "volta para a versão ativada antes desta, sem assinatura nova";
const GENERIC_ERROR = "não foi possível concluir — tente de novo";

type Row = {
  name: string; version: number; status: string;
  publicationSignatures: number; publicationMissing: number;
  activationSignatures: number; activationMissing: number;
  eligibleReviewers: number; revertible: boolean;
};
type Pending = { row: Row; action: ProtocolAction };
type FieldError = { path?: string | null; message: string };
type Payload = { ok: boolean; errors: FieldError[] };

// Uma função por ação: devolve o payload `{ ok, errors }` da mutation.
async function run(slug: string, { row, action }: Pending, code: string, reason: string): Promise<Payload | null> {
  const base = { citySlug: slug, name: row.name, version: row.version };
  switch (action.kind) {
    case "submit": return (await gql(SubmitMutation, base)).data?.submitProtocolForReview ?? null;
    case "publish": return (await gql(PublishMutation, { ...base, code })).data?.publishProtocol ?? null;
    case "activate": return (await gql(ActivateMutation, { ...base, code })).data?.activateProtocol ?? null;
    case "retire": return (await gql(RetireMutation, { ...base, code })).data?.retireProtocol ?? null;
    case "revert":
      return (await gql(RevertMutation, { citySlug: slug, name: row.name, reason, code })).data?.revertProtocolActivation ?? null;
  }
}

export function ProtocolsTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const queryKey = [ "city", slug, "protocols" ];
  const query = useQuery({ queryKey, queryFn: () => gql(CityProtocolVersionsQuery, { slug }), staleTime: Infinity });

  const [ pending, setPending ] = useState<Pending | null>(null);
  const [ code, setCode ] = useState("");
  const [ reason, setReason ] = useState("");
  const [ errors, setErrors ] = useState<FieldError[]>([]);
  const [ formError, setFormError ] = useState<string | null>(null);
  const [ done, setDone ] = useState<string | null>(null);

  function open(row: Row, action: ProtocolAction) {
    setPending({ row, action });
    setCode(""); setReason(""); setErrors([]); setFormError(null); setDone(null);
  }
  function close() { setPending(null); setCode(""); setReason(""); setErrors([]); setFormError(null); }

  // gcTime 0: o código TOTP vai nas variables — a mutation não fica no cache.
  const mutation = useMutation({
    gcTime: 0,
    mutationFn: (vars: { pending: Pending; code: string; reason: string }) => run(slug, vars.pending, vars.code, vars.reason),
    onSuccess: (payload, { pending: p }) => {
      setCode("");
      if (payload?.ok) {
        close();
        setDone(`${p.action.label} concluído: ${p.row.name} v${p.row.version}`);
        void queryClient.invalidateQueries({ queryKey });
        return;
      }
      const list = payload?.errors ?? [];
      setErrors(list);
      const general = list.filter((e) => e.path !== "code" && e.path !== "reason");
      setFormError(payload ? (general.map((e) => e.message).join(" ") || null) : GENERIC_ERROR);
    },
    onError: (err) => {
      setCode("");
      setErrors([]);
      setFormError(err instanceof GraphQLRefusal ? `${err.code} — ${err.message}` : err instanceof Error ? err.message : GENERIC_ERROR);
      // Pode ter comitado (CITY_UNREACHABLE depois do command): relê.
      void queryClient.invalidateQueries({ queryKey });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) mutation.mutate({ pending, code, reason });
  }

  const codeError = errors.find((e) => e.path === "code");
  const reasonError = errors.find((e) => e.path === "reason");
  const fieldError = query.data?.fieldErrors.find((r) => {
    const path = r.path ?? [];
    return path[0] === "city" && (path.length === 1 || path[1] === "protocolVersions");
  });
  const rows: Row[] = query.data?.data?.city?.protocolVersions ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><Button onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button></div>
      {query.isPending && <p>carregando…</p>}
      {query.isError && <ErrorState message={query.error instanceof Error ? query.error.message : "erro inesperado"} />}
      {fieldError && <ErrorState message={`${fieldError.code} — ${fieldError.message}`} />}
      {done && <p role="status" style={{ margin: 0, fontSize: 12.5 }}>{done}</p>}

      {query.isSuccess && !fieldError && rows.length === 0 && <EmptyState message="nenhum protocolo" />}
      {rows.length > 0 && (
        <DataTable
          rowKey={(row) => `${row.name}-${row.version}`}
          columns={[
            { key: "name", label: "Nome" },
            { key: "version", label: "Versão" },
            { key: "status", label: "Status", render: (row: Row) => <Tag>{STATUS_LABELS[row.status] ?? row.status}</Tag> },
            { key: "publication", label: "Publicação", render: (row: Row) => `${row.publicationSignatures}/2` },
            { key: "activation", label: "Ativação", render: (row: Row) => `${row.activationSignatures}/2` },
            { key: "eligibleReviewers", label: "Revisores" },
            {
              key: "actions", label: "Ações",
              render: (row: Row) => (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {actionsFor(row).map((action) => (
                    <div key={action.kind} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <Button onClick={() => open(row, action)} disabled={action.disabledReason !== null}>{action.label}</Button>
                      {action.disabledReason && <small style={{ fontSize: 11, color: "var(--ink3)" }}>{action.disabledReason}</small>}
                    </div>
                  ))}
                </div>
              )
            }
          ]}
          rows={rows}
        />
      )}

      {pending && (
        <Panel title={`Confirmar: ${pending.action.label} ${pending.row.name} v${pending.row.version}`}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.action.kind === "revert" && <p style={{ margin: 0, fontSize: 12.5 }}>{REVERT_NOTICE}</p>}
            {formError && <ErrorState message={formError} />}
            {pending.action.needsReason && (
              <>
                <Field label="Motivo" value={reason} onChange={setReason} />
                {reasonError && <ErrorState message={reasonError.message} />}
              </>
            )}
            {pending.action.stepUp && (
              <>
                <Field label="Código do autenticador" value={code} onChange={setCode}
                       autoComplete="one-time-code" helpText={STEP_UP_CODE_HELP_TEXT} />
                {codeError && <StepUpCodeError message={codeError.message} />}
              </>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="submit" busy={mutation.isPending}>Confirmar</Button>
              <Button onClick={close}>Cancelar</Button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
