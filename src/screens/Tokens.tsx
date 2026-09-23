import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { ConfirmButton } from "../components/ConfirmButton";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { Panel } from "../components/Panel";
import { DataTable, type Column } from "../components/DataTable";
import { STEP_UP_CODE_HELP_TEXT, StepUpCodeError } from "../components/StepUpCode";

// Tokens de serviço (Task 8): lista + criação com step-up + revogação. O
// segredo (`secretOnce`) volta uma única vez, na resposta da criação, e é o
// dado mais sensível que esta app guarda — a consulta de lista (abaixo)
// nunca pede o campo, e a mutation de criação usa `gcTime: 0` e é limpa do
// cache (reset() + remoção explícita do MutationCache) assim que o segredo
// é copiado para o estado local do painel, no `onSuccess`. Ver
// TOKENS_SECRET_CACHE no relatório da task para a verificação.
const TokensQuery = graphql(`
  query MaintenanceTokens {
    maintenanceTokens { id name access citySlugs expiresAt revokedAt lastUsedAt }
  }
`);
const CitiesForTokenScopeQuery = graphql(`
  query CitiesForTokenScope { cities { slug name } }
`);
const CreateTokenMutation = graphql(`
  mutation CreateMaintenanceToken($name: String!, $access: String!, $citySlugs: [String!], $expiresAt: ISO8601DateTime!, $code: String!) {
    createMaintenanceToken(name: $name, access: $access, citySlugs: $citySlugs, expiresAt: $expiresAt, code: $code) {
      ok secretOnce errors { path message }
    }
  }
`);
const RevokeTokenMutation = graphql(`
  mutation RevokeMaintenanceToken($id: ID!) { revokeMaintenanceToken(id: $id) { ok errors { path message } } }
`);

type TokenRow = {
  id: string; name: string; access: string; citySlugs: string[];
  expiresAt: string; revokedAt: string | null; lastUsedAt: string | null;
};
type CityOption = { slug: string; name: string };
type FieldError = { path?: string | null; message: string };
type SecretPanelState = { name: string; secretOnce: string };

const ACCESS_LABELS: Record<string, string> = { read: "leitura", read_write: "leitura e escrita" };
const ACCESS_OPTIONS = [ "read", "read_write" ] as const;
const DEFAULT_VALIDITY_DAYS = 30;
const MIN_VALIDITY_DAYS = 1;
const MAX_VALIDITY_DAYS = 90;
const NO_SCOPE_WARNING = "sem cidades marcadas, o token alcança todas";
const SECRET_NOTICE = "Este segredo não será mostrado de novo.";
const GENERIC_ERROR = "não foi possível concluir — tente de novo";
const COPY_ERROR = "não foi possível copiar — copie manualmente";
const VALIDITY_RANGE_ERROR = `a validade deve ser de ${MIN_VALIDITY_DAYS} a ${MAX_VALIDITY_DAYS} dias`;

// A mutation de criação carrega o segredo pela viagem de volta — uma
// mutationKey própria deixa ela achável no MutationCache para remoção
// explícita, sem tocar em nenhuma outra mutation da app.
const CREATE_TOKEN_MUTATION_KEY = [ "createMaintenanceToken" ];

const FIELD_PATHS = [ "name", "access", "citySlugs", "expiresAt", "code" ];

function errorFor(errors: FieldError[], path: string): FieldError | undefined {
  return errors.find((e) => e.path === path);
}

function messageFor(err: unknown): string {
  return err instanceof Error ? err.message : GENERIC_ERROR;
}

function daysToExpiresAtIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function Tokens() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ "maintenanceTokens" ],
    queryFn: () => gql(TokensQuery),
    staleTime: Infinity
  });

  const citiesQuery = useQuery({
    queryKey: [ "cities", "tokenScope" ],
    queryFn: () => gql(CitiesForTokenScopeQuery),
    staleTime: Infinity
  });

  const [ name, setName ] = useState("");
  const [ access, setAccess ] = useState<string>("read");
  const [ selectedSlugs, setSelectedSlugs ] = useState<string[]>([]);
  const [ validityDays, setValidityDays ] = useState(String(DEFAULT_VALIDITY_DAYS));
  const [ code, setCode ] = useState("");
  const [ createFormError, setCreateFormError ] = useState<string | null>(null);
  const [ createFieldErrors, setCreateFieldErrors ] = useState<FieldError[]>([]);
  const [ secretPanel, setSecretPanel ] = useState<SecretPanelState | null>(null);
  const [ copyError, setCopyError ] = useState<string | null>(null);

  // O código do autenticador e o segredo do token NÃO passam pelo react-query:
  // o que entra em `variables` e o que sai de `mutationFn` é gravado no estado
  // da Mutation pelos dispatches de 'pending' e 'success', e quem assina o
  // MutationCache (devtools, por exemplo) é notificado desses dispatches mesmo
  // depois de a Mutation sair do cache. Os dois viajam por ref: a `mutationFn`
  // lê o código daqui e guarda o segredo aqui, devolvendo um payload sem ele.
  const codeRef = useRef("");
  const secretRef = useRef<string | null>(null);

  function toggleSlug(slug: string) {
    setSelectedSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [ ...prev, slug ]));
  }

  const createMutation = useMutation({
    mutationKey: CREATE_TOKEN_MUTATION_KEY,
    gcTime: 0,
    mutationFn: async (vars: { name: string; access: string; citySlugs: string[]; expiresAt: string }) => {
      const result = await gql(CreateTokenMutation, { ...vars, code: codeRef.current });
      const payload = result.data?.createMaintenanceToken;
      // O segredo sai do payload aqui, antes de qualquer dispatch.
      secretRef.current = payload?.secretOnce ?? null;
      return payload ? { ok: payload.ok, errors: payload.errors } : null;
    },
    onSuccess: (payload, vars) => {
      // I3/step_up!: o código é consumido uma vez — limpo em toda tentativa.
      setCode("");
      codeRef.current = "";
      const secretOnce = secretRef.current;
      secretRef.current = null;

      if (payload?.ok && secretOnce) {
        setSecretPanel({ name: vars.name, secretOnce });
        setCopyError(null);
        setCreateFormError(null);
        setCreateFieldErrors([]);
        setName("");
        setAccess("read");
        setSelectedSlugs([]);
        setValidityDays(String(DEFAULT_VALIDITY_DAYS));
        void queryClient.invalidateQueries({ queryKey: [ "maintenanceTokens" ] });
        createMutation.reset();
        return;
      }

      if (payload?.ok) {
        // ok sem secretOnce não é esperado, mas não deixa nada pendurado.
        setCreateFormError(null);
        setCreateFieldErrors([]);
        void queryClient.invalidateQueries({ queryKey: [ "maintenanceTokens" ] });
        createMutation.reset();
        return;
      }

      if (!payload) {
        setCreateFieldErrors([]);
        setCreateFormError(GENERIC_ERROR);
        createMutation.reset();
        return;
      }

      setCreateFieldErrors(payload.errors);
      const formLevel = payload.errors.filter((e) => !FIELD_PATHS.includes(e.path ?? ""));
      setCreateFormError(formLevel.length > 0 ? formLevel.map((e) => e.message).join(" ") : null);
      createMutation.reset();
    },
    onError: (err) => {
      setCode("");
      codeRef.current = "";
      secretRef.current = null;
      setCreateFieldErrors([]);
      setCreateFormError(messageFor(err));
      createMutation.reset();
    }
  });

  function submitCreate(event: FormEvent) {
    event.preventDefault();
    const days = Number(validityDays);
    if (!Number.isFinite(days) || days < MIN_VALIDITY_DAYS || days > MAX_VALIDITY_DAYS) {
      setCreateFieldErrors([]);
      setCreateFormError(VALIDITY_RANGE_ERROR);
      return;
    }
    setCreateFormError(null);
    codeRef.current = code;
    createMutation.mutate({
      name, access, citySlugs: selectedSlugs, expiresAt: daysToExpiresAtIso(days)
    });
  }

  function closeSecretPanel() {
    setSecretPanel(null);
    setCopyError(null);
  }

  // Clipboard: `navigator.clipboard` pode nem existir (contexto não
  // seguro, navegador antigo) e `writeText` pode rejeitar (permissão
  // negada) — os dois casos têm de avisar, nunca parecer que copiou.
  async function copySecret() {
    if (!secretPanel) return;
    setCopyError(null);
    try {
      if (!navigator.clipboard) throw new Error("clipboard indisponível");
      await navigator.clipboard.writeText(secretPanel.secretOnce);
    } catch {
      setCopyError(COPY_ERROR);
    }
  }

  const [ revokeErrors, setRevokeErrors ] = useState<Record<string, string>>({});
  const [ revokingId, setRevokingId ] = useState<string | null>(null);

  const revokeMutation = useMutation({
    mutationFn: (id: string) => gql(RevokeTokenMutation, { id }),
    onMutate: (id: string) => setRevokingId(id),
    onSuccess: (result, id) => {
      setRevokingId(null);
      const payload = result.data?.revokeMaintenanceToken;
      if (!payload) {
        setRevokeErrors((prev) => ({ ...prev, [id]: GENERIC_ERROR }));
        return;
      }
      if (payload.ok) {
        setRevokeErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        void queryClient.invalidateQueries({ queryKey: [ "maintenanceTokens" ] });
        return;
      }
      const message = payload.errors.map((e) => e.message).join(" ") || GENERIC_ERROR;
      setRevokeErrors((prev) => ({ ...prev, [id]: message }));
    },
    onError: (err, id) => {
      setRevokingId(null);
      setRevokeErrors((prev) => ({ ...prev, [id]: messageFor(err) }));
    }
  });

  const tokens = (query.data?.data?.maintenanceTokens ?? []) as TokenRow[];
  const cities = (citiesQuery.data?.data?.cities ?? []) as CityOption[];
  const nameError = errorFor(createFieldErrors, "name");
  const accessError = errorFor(createFieldErrors, "access");
  const citySlugsError = errorFor(createFieldErrors, "citySlugs");
  const expiresAtError = errorFor(createFieldErrors, "expiresAt");
  const codeError = errorFor(createFieldErrors, "code");

  const columns: Column<TokenRow>[] = [
    { key: "name", label: "Nome" },
    { key: "access", label: "Acesso", render: (row) => ACCESS_LABELS[row.access] ?? row.access },
    {
      key: "citySlugs",
      label: "Cidades",
      render: (row) => (row.citySlugs.length === 0 ? "todas" : row.citySlugs.join(", "))
    },
    { key: "expiresAt", label: "Validade" },
    { key: "lastUsedAt", label: "Último uso", render: (row) => row.lastUsedAt ?? "—" },
    { key: "status", label: "Status", render: (row) => (row.revokedAt ? "revogado" : "ativo") },
    {
      key: "actions",
      label: "",
      render: (row) => {
        if (row.revokedAt) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
            <ConfirmButton
              label="revogar"
              confirmLabel="confirmar revogação"
              busy={revokingId === row.id}
              onConfirm={() => revokeMutation.mutate(row.id)}
            />
            {revokeErrors[row.id] && <ErrorState message={revokeErrors[row.id]} />}
          </div>
        );
      }
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Tokens de serviço</h1>

      {query.isError && (
        <ErrorState message={query.error instanceof Error ? query.error.message : "erro inesperado"} />
      )}
      {query.isSuccess && (
        tokens.length === 0
          ? <EmptyState message="nenhum token" />
          : <DataTable columns={columns} rows={tokens} rowKey={(row) => row.id} />
      )}

      {secretPanel && (
        <Panel title={`Segredo do token "${secretPanel.name}"`}>
          <p style={{
            margin: 0,
            padding: "10px 12px",
            border: "1px solid var(--rule2)",
            borderRadius: 6,
            background: "var(--sunken)",
            fontFamily: "monospace",
            fontSize: 13,
            wordBreak: "break-all"
          }}>
            {secretPanel.secretOnce}
          </p>
          <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--down)" }}>{SECRET_NOTICE}</p>
          {copyError && <ErrorState message={copyError} />}
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => void copySecret()}>copiar</Button>
            <Button onClick={closeSecretPanel}>fechei</Button>
          </div>
        </Panel>
      )}

      <Panel title="Criar token">
        {createFormError && <ErrorState message={createFormError} />}
        <form onSubmit={submitCreate} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Field label="Nome" name="name" value={name} onChange={setName} />
            {nameError && <ErrorState message={nameError.message} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--ink2)" }}>
              <span>Acesso</span>
              <select
                value={access}
                onChange={(event) => setAccess(event.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--rule2)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)" }}
              >
                {ACCESS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{ACCESS_LABELS[option]}</option>
                ))}
              </select>
            </label>
            {accessError && <ErrorState message={accessError.message} />}
          </div>

          <fieldset style={{ display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--rule2)", borderRadius: 6, padding: 10 }}>
            <legend style={{ fontSize: 12, color: "var(--ink2)", padding: "0 4px" }}>Cidades</legend>
            {cities.map((city) => (
              <label key={city.slug} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={selectedSlugs.includes(city.slug)}
                  onChange={() => toggleSlug(city.slug)}
                />
                {city.name}
              </label>
            ))}
            {selectedSlugs.length === 0 && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--ink3)" }}>{NO_SCOPE_WARNING}</p>
            )}
            {citySlugsError && <ErrorState message={citySlugsError.message} />}
          </fieldset>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Field
              label="Validade (dias)"
              name="validityDays"
              type="number"
              value={validityDays}
              onChange={setValidityDays}
              helpText={`de ${MIN_VALIDITY_DAYS} a ${MAX_VALIDITY_DAYS} dias`}
            />
            {expiresAtError && <ErrorState message={expiresAtError.message} />}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Field
              label="Código"
              name="code"
              autoComplete="one-time-code"
              helpText={STEP_UP_CODE_HELP_TEXT}
              value={code}
              onChange={setCode}
            />
            {codeError && <StepUpCodeError message={codeError.message} />}
          </div>

          <Button type="submit" busy={createMutation.isPending}>criar token</Button>
        </form>
      </Panel>
    </div>
  );
}
