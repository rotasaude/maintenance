import { useState } from "react";
import { useSession } from "../lib/session";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { Cities } from "./Cities";
import { CityDetail } from "./CityDetail";

// Casca do mantenedor logado (Task 6): cabeçalho com e-mail e navegação,
// corpo com a tela ativa. Mantenedores/Tokens/Auditoria chegam nas Tasks
// 7-9 — até lá, "em breve".
export type Screen = "cities" | "maintainers" | "tokens" | "audit";

const NAV: { key: Screen; label: string }[] = [
  { key: "cities", label: "Cidades" },
  { key: "maintainers", label: "Mantenedores" },
  { key: "tokens", label: "Tokens" },
  { key: "audit", label: "Auditoria" }
];

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
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--rule)"
        }}
      >
        <nav style={{ display: "flex", gap: 8 }}>
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => goTo(item.key)}
              aria-current={screen === item.key ? "page" : undefined}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: screen === item.key ? "var(--accent)" : "var(--ink2)",
                background: screen === item.key ? "var(--accent-bg)" : "transparent"
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>{me?.emailAddress}</span>
          <Button onClick={() => void signOut()}>sair</Button>
        </div>
      </header>

      <main style={{ padding: 24 }}>
        {screen === "cities" && (
          openCity
            ? <CityDetail slug={openCity} onBack={() => setOpenCity(null)} />
            : <Cities onOpen={(slug) => setOpenCity(slug)} />
        )}
        {screen === "maintainers" && <EmptyState message="em breve" />}
        {screen === "tokens" && <EmptyState message="em breve" />}
        {screen === "audit" && <EmptyState message="em breve" />}
      </main>
    </div>
  );
}
