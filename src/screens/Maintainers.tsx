import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { useSession } from "../lib/session";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { ConfirmButton } from "../components/ConfirmButton";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { Panel } from "../components/Panel";
import { DataTable, type Column } from "../components/DataTable";
import { STEP_UP_CODE_HELP_TEXT, StepUpCodeError } from "../components/StepUpCode";

// Mantenedores (Task 7): lista + convite + desativação. O convite não abre
// sessão nova nem entrega link nenhum — quem entrega é o `rake
// maintainer:invite` rodado no servidor (Ruling #2/#4 do global-constraints);
// esta tela só registra o convite e diz isso.
const MaintainersQuery = graphql(`
  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }
`);
const InviteMutation = graphql(`
  mutation InviteMaintainer($emailAddress: String!, $code: String!) {
    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }
  }
`);
const DeactivateMutation = graphql(`
  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }
`);

type MaintainerRow = { id: string; emailAddress: string; active: boolean; enrolled: boolean; createdAt: string };
type FieldError = { path?: string | null; message: string };

const INVITE_OK_MESSAGE = "Convite registrado. O link é entregue pelo `rake maintainer:invite` no servidor.";
const GENERIC_ERROR = "não foi possível concluir — tente de novo";

function errorFor(errors: FieldError[], path: string): FieldError | undefined {
  return errors.find((e) => e.path === path);
}

function messageFor(err: unknown): string {
  return err instanceof Error ? err.message : GENERIC_ERROR;
}

export function Maintainers() {
  const { me } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ "maintainers" ],
    queryFn: () => gql(MaintainersQuery),
    staleTime: Infinity
  });

  const [ emailAddress, setEmailAddress ] = useState("");
  const [ code, setCode ] = useState("");
  const [ inviteNotice, setInviteNotice ] = useState<string | null>(null);
  const [ inviteFormError, setInviteFormError ] = useState<string | null>(null);
  const [ inviteFieldErrors, setInviteFieldErrors ] = useState<FieldError[]>([]);

  const inviteMutation = useMutation({
    mutationFn: () => gql(InviteMutation, { emailAddress, code }),
    onSuccess: (result) => {
      // I3/step_up!: cada código é consumido uma vez — um consumido ou
      // recusado nunca serve de novo, então o campo é limpo em toda tentativa.
      setCode("");
      const payload = result.data?.inviteMaintainer;
      if (!payload) {
        setInviteNotice(null);
        setInviteFieldErrors([]);
        setInviteFormError(GENERIC_ERROR);
        return;
      }
      if (payload.ok) {
        setInviteNotice(INVITE_OK_MESSAGE);
        setInviteFormError(null);
        setInviteFieldErrors([]);
        setEmailAddress("");
        void queryClient.invalidateQueries({ queryKey: [ "maintainers" ] });
        return;
      }
      setInviteNotice(null);
      setInviteFieldErrors(payload.errors);
      const formLevel = payload.errors.filter((e) => e.path !== "emailAddress" && e.path !== "code");
      setInviteFormError(formLevel.length > 0 ? formLevel.map((e) => e.message).join(" ") : null);
    },
    onError: (err) => {
      setCode("");
      setInviteNotice(null);
      setInviteFieldErrors([]);
      setInviteFormError(messageFor(err));
    }
  });

  function submitInvite(event: FormEvent) {
    event.preventDefault();
    inviteMutation.mutate();
  }

  const [ deactivateErrors, setDeactivateErrors ] = useState<Record<string, string>>({});
  const [ deactivatingId, setDeactivatingId ] = useState<string | null>(null);

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => gql(DeactivateMutation, { id }),
    onMutate: (id: string) => setDeactivatingId(id),
    onSuccess: (result, id) => {
      setDeactivatingId(null);
      const payload = result.data?.deactivateMaintainer;
      if (!payload) {
        setDeactivateErrors((prev) => ({ ...prev, [id]: GENERIC_ERROR }));
        return;
      }
      if (payload.ok) {
        setDeactivateErrors((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        void queryClient.invalidateQueries({ queryKey: [ "maintainers" ] });
        return;
      }
      const message = payload.errors.map((e) => e.message).join(" ") || GENERIC_ERROR;
      setDeactivateErrors((prev) => ({ ...prev, [id]: message }));
    },
    onError: (err, id) => {
      setDeactivatingId(null);
      setDeactivateErrors((prev) => ({ ...prev, [id]: messageFor(err) }));
    }
  });

  const maintainers = (query.data?.data?.maintainers ?? []) as MaintainerRow[];
  const emailError = errorFor(inviteFieldErrors, "emailAddress");
  const codeError = errorFor(inviteFieldErrors, "code");

  const columns: Column<MaintainerRow>[] = [
    { key: "emailAddress", label: "E-mail" },
    { key: "active", label: "Status", render: (row) => (row.active ? "ativo" : "desativado") },
    { key: "enrolled", label: "Matrícula", render: (row) => (row.enrolled ? "matriculado" : "convite pendente") },
    {
      key: "actions",
      label: "",
      render: (row) => {
        // Ninguém desativa a si mesmo (mesma regra do resolver) — a própria
        // linha do mantenedor logado não ganha o botão.
        if (row.id === me?.id) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
            <ConfirmButton
              label="desativar"
              confirmLabel="confirmar desativação"
              busy={deactivatingId === row.id}
              onConfirm={() => deactivateMutation.mutate(row.id)}
            />
            {deactivateErrors[row.id] && <ErrorState message={deactivateErrors[row.id]} />}
          </div>
        );
      }
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Mantenedores</h1>

      {query.isError && (
        <ErrorState message={query.error instanceof Error ? query.error.message : "erro inesperado"} />
      )}
      {query.isSuccess && (
        maintainers.length === 0
          ? <EmptyState message="nenhum mantenedor" />
          : <DataTable columns={columns} rows={maintainers} rowKey={(row) => row.id} />
      )}

      <Panel title="Convidar mantenedor">
        {inviteNotice && (
          <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ok)" }}>{inviteNotice}</p>
        )}
        {inviteFormError && <ErrorState message={inviteFormError} />}
        <form onSubmit={submitInvite} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Field label="E-mail" name="emailAddress" value={emailAddress} onChange={setEmailAddress} />
            {emailError && <ErrorState message={emailError.message} />}
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
          <Button type="submit" busy={inviteMutation.isPending}>convidar</Button>
        </form>
      </Panel>
    </div>
  );
}
