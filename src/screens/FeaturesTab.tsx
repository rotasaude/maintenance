import { useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import { fmtWhen } from "../lib/analytics";
import {
  doneText, featureStatus, ibgeCodeText, missingSummary, recordModeText, setFeatureErrorText
} from "../lib/features";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { ConfirmButton } from "../components/ConfirmButton";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";

// Aba Funcionalidades (módulo 16, F-16.1; ADR 0028; contratos §3): os
// interruptores da cidade e o liga/desliga. Só o maintenance escreve
// interruptor. Modo de prontuário e código IBGE são do operador (console
// admin) e aqui são só leitura; o IBGE é o do perfil da cidade
// (`profile.ibgeCode`, fonte única — contratos §3).
//
// Consulta PRÓPRIA, fora do CityHeader: contra um api sem o módulo 16, a
// validação recusa o documento inteiro, e só esta aba pode cair. Cidade
// inalcançável NÃO derruba a aba: `features` degrada (`usable: false`,
// `missing: ["city_unreachable"]`) e o liga/desliga continua; só `profile`
// (anulável) vem nulo com o erro no caminho ["city", "profile"].
const CityFeaturesQuery = graphql(`
  query CityFeatures($slug: String!) {
    city(slug: $slug) {
      slug
      recordMode
      profile { ibgeCode }
      features { key description enabled usable missing changedAt changedBy }
    }
  }
`);

const SetCityFeatureMutation = graphql(`
  mutation SetCityFeature($citySlug: String!, $key: String!, $enabled: Boolean!) {
    setCityFeature(citySlug: $citySlug, key: $key, enabled: $enabled) {
      ok
      errors { path message }
      feature { key description enabled usable missing changedAt changedBy }
    }
  }
`);

const dlStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  columnGap: 12,
  rowGap: 6,
  margin: 0,
  fontSize: 12.5
};

// Códigos da validação do graphql-ruby que um api sem o módulo 16 devolve.
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem os interruptores — o api do módulo 16 precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

function fieldError(fieldErrors: GraphQLRefusal[], field: string): GraphQLRefusal | undefined {
  return fieldErrors.find((refusal) => {
    const path = refusal.path ?? [];
    return path[0] === "city" && (path.length === 1 || path[1] === field);
  });
}

type Feature = {
  key: string; description: string; enabled: boolean; usable: boolean; missing: string[];
  changedAt?: string | null; changedBy?: string | null;
};

export function FeaturesTab({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const queryKey = [ "city", slug, "features" ];
  const query = useQuery({ queryKey, queryFn: () => gql(CityFeaturesQuery, { slug }), staleTime: Infinity });

  const [ done, setDone ] = useState<string | null>(null);
  const [ failure, setFailure ] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { key: string; enabled: boolean }) =>
      gql(SetCityFeatureMutation, { citySlug: slug, key: vars.key, enabled: vars.enabled }),
    onMutate: () => { setDone(null); setFailure(null); },
    onSuccess: ({ data, fieldErrors }) => {
      const payload = data?.setCityFeature ?? null;
      if (payload === null) {
        // Recusa do envelope (CITY_OUT_OF_SCOPE, CITY_BUDGET_EXCEEDED…):
        // `data.setCityFeature` nulo e o motivo em `errors`.
        const refusal = fieldErrors[0];
        setFailure(refusal ? `${refusal.code} — ${refusal.message}` : setFeatureErrorText([]));
        return;
      }
      if (!payload.ok) {
        setFailure(setFeatureErrorText(payload.errors));
        return;
      }
      if (payload.feature) setDone(doneText(payload.feature));
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setFailure(err instanceof Error ? err.message : "erro inesperado")
  });

  const city = query.data?.data?.city ?? null;
  const err = query.data ? fieldError(query.data.fieldErrors, "features") : undefined;
  const profileErr = query.data ? fieldError(query.data.fieldErrors, "profile") : undefined;
  const ibge = profileErr ? `indisponível (${profileErr.code})` : ibgeCodeText(city?.profile?.ibgeCode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <Button onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>
      </div>

      {query.isPending && <p>carregando…</p>}
      {query.isError && <ErrorState message={requestErrorText(query.error)} />}
      {err && <ErrorState message={`${err.code} — ${err.message}`} />}

      {city && (
        <>
          <Panel title="Prontuário e exportação">
            <dl style={dlStyle}>
              <dt>Modo de prontuário</dt><dd>{recordModeText(city.recordMode)}</dd>
              <dt>Código IBGE</dt><dd>{ibge}</dd>
            </dl>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink3)" }}>
              Modo, código IBGE e endereço do PEC são do operador, no console de plataforma (admin).
            </p>
          </Panel>

          <Panel title="Funcionalidades">
            {done && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ok)" }}>{done}</p>}
            {failure && <ErrorState message={failure} />}
            {city.features.length === 0 ? <EmptyState message="nenhuma funcionalidade no catálogo" /> : (
              <DataTable<Feature>
                columns={[
                  { key: "key", label: "Chave" },
                  { key: "description", label: "Descrição" },
                  {
                    key: "state", label: "Estado",
                    render: (f) => {
                      const s = featureStatus(f);
                      return <Tag tone={s.tone}>{s.label}</Tag>;
                    }
                  },
                  { key: "missing", label: "O que falta", render: (f) => missingSummary(f.missing) },
                  {
                    key: "changed", label: "Última mudança",
                    render: (f) => f.changedAt ? `${fmtWhen(f.changedAt)} — ${f.changedBy ?? "—"}` : "nunca alterada"
                  },
                  {
                    key: "action", label: "",
                    render: (f) => (
                      <ConfirmButton
                        label={f.enabled ? "desligar" : "ligar"}
                        confirmLabel={f.enabled ? `confirmar: desligar ${f.key}` : `confirmar: ligar ${f.key}`}
                        busy={mutation.isPending && mutation.variables?.key === f.key}
                        disabled={mutation.isPending}
                        onConfirm={() => mutation.mutate({ key: f.key, enabled: !f.enabled })}
                      />
                    )
                  }
                ]}
                rows={city.features}
                rowKey={(f) => f.key}
              />
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
