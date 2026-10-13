import { useState, type ReactNode } from "react";
import { useSession } from "../lib/session";
import { Button } from "../components/Button";
import { Cities } from "./Cities";
import { CityDetail } from "./CityDetail";
import { Maintainers } from "./Maintainers";
import { Tokens } from "./Tokens";
import { Audit } from "./Audit";
import { MedicationCatalog } from "./MedicationCatalog";

// Casca do mantenedor logado (Task 6): topo com a marca, o selo
// "Manutenção", o e-mail e "sair"; trilho rotulado com as telas à esquerda;
// corpo com a tela ativa. Mantenedores (Task 7), Tokens (Task 8) e
// Auditoria (Task 9) já existem. Módulo 19c: Medicamentos, o catálogo da
// plataforma (vale para todas as cidades do ambiente).
export type Screen = "cities" | "medications" | "maintainers" | "tokens" | "audit";

const NAV: { key: Screen; label: string }[] = [
  { key: "cities", label: "Cidades" },
  { key: "medications", label: "Medicamentos" },
  { key: "maintainers", label: "Mantenedores" },
  { key: "tokens", label: "Tokens" },
  { key: "audit", label: "Auditoria" }
];

// Ícones do trilho: decorativos (aria-hidden), o nome do botão é o rótulo.
const svg = (d: string) => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ICON: Record<Screen, ReactNode> = {
  cities: svg("M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"),
  medications: svg("M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7"),
  maintainers: svg("M9 7a4 4 0 1 0 0 .01M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85"),
  tokens: svg("M15 7a4 4 0 1 1-3.87 5H8v3H5v-3H3v-3h8.13A4 4 0 0 1 15 7z"),
  audit: svg("M12 8v4l3 3M3.05 11a9 9 0 1 1 .5 4M3 4v5h5")
};

export function Shell() {
  const { me, signOut } = useSession();
  const [ screen, setScreen ] = useState<Screen>("cities");
  const [ openCity, setOpenCity ] = useState<string | null>(null);

  // Ir para "Cidades" pela navegação sempre volta ao catálogo — só o botão
  // "voltar" dentro do detalhe é quem fecha uma cidade sem trocar de tela.
  function goTo(next: Screen) {
    setScreen(next);
    if (next === "cities") setOpenCity(null);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          background: "var(--ink)",
          color: "var(--panel)"
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 28, height: 28, borderRadius: 6, display: "inline-flex", alignItems: "center",
            justifyContent: "center", background: "var(--accent)", color: "var(--on-accent)"
          }}
        >
          {svg("M4 12h4l3-6 4 12 3-6h2")}
        </span>
        <strong style={{ fontSize: 15 }}>Rota Saúde</strong>
        <span
          style={{
            padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            background: "var(--accent-bg)", color: "var(--accent)"
          }}
        >
          Manutenção
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12.5 }}>{me?.emailAddress}</span>
          <Button variant="secondary" onClick={() => void signOut()}>sair</Button>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <nav
          aria-label="Telas"
          style={{
            width: 92, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4,
            padding: "10px 6px", background: "var(--panel)", borderRight: "1px solid var(--rule)"
          }}
        >
          {NAV.map((item) => {
            const active = screen === item.key;
            return (
              <button
                key={item.key}
                onClick={() => goTo(item.key)}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minHeight: 56,
                  padding: "8px 2px", borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? "var(--accent)" : "var(--ink2)",
                  background: active ? "var(--accent-bg)" : "transparent"
                }}
              >
                {ICON[item.key]}
                {item.label}
              </button>
            );
          })}
        </nav>

        <main style={{ padding: 24, flex: 1, minWidth: 0 }}>
          {screen === "cities" && (
            openCity
              ? <CityDetail slug={openCity} onBack={() => setOpenCity(null)} />
              : <Cities onOpen={(slug) => setOpenCity(slug)} />
          )}
          {screen === "medications" && <MedicationCatalog />}
          {screen === "maintainers" && <Maintainers />}
          {screen === "tokens" && <Tokens />}
          {screen === "audit" && <Audit />}
        </main>
      </div>
    </div>
  );
}
