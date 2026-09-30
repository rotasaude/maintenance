import { describe, expect, it } from "vitest";
import {
  analyticsWindow, cellText, cityToday, fmtWeek, fmtWhen, indicatorGrid, INDICATOR_LABELS, INDICATORS,
  runStatusView, type IndicatorRow
} from "./analytics";

function row(weekStart: string, indicator: string, value: number | null, suppressed = false): IndicatorRow {
  return { weekStart, indicator, value, suppressed };
}

describe("cityToday", () => {
  it("é o dia de São Paulo, não o de UTC", () => {
    expect(cityToday(new Date("2026-10-05T02:30:00Z"))).toBe("2026-10-04");
    expect(cityToday(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-05");
  });
});

describe("analyticsWindow", () => {
  it("12 semanas fechadas, terminando no domingo passado", () => {
    const w = analyticsWindow(new Date("2026-09-30T15:00:00Z"));
    expect(w.from).toBe("2026-07-06");
    expect(w.to).toBe("2026-09-27");
    expect(w.weeks).toHaveLength(12);
    expect(w.weeks[0]).toBe("2026-07-06");
    expect(w.weeks[11]).toBe("2026-09-21");
  });

  it("domingo 23h30 em São Paulo ainda é a semana da cidade", () => {
    const w = analyticsWindow(new Date("2026-10-05T02:30:00Z"));
    expect(w.from).toBe("2026-07-06");
    expect(w.to).toBe("2026-09-27");
  });

  it("segunda de manhã em São Paulo fecha a semana anterior", () => {
    const w = analyticsWindow(new Date("2026-10-05T12:00:00Z"));
    expect(w.from).toBe("2026-07-13");
    expect(w.to).toBe("2026-10-04");
  });

  it("atravessa a virada de ano", () => {
    const w = analyticsWindow(new Date("2027-01-06T12:00:00Z"));
    expect(w.from).toBe("2026-10-12");
    expect(w.to).toBe("2027-01-03");
    expect(w.weeks[11]).toBe("2026-12-28");
  });
});

describe("indicatorGrid", () => {
  it("indexa por semana e indicador", () => {
    const g = indicatorGrid([ row("2026-09-21", "triages_started", 128), row("2026-09-14", "no_show_pct", 7) ]);
    expect(g["2026-09-21"].triages_started.value).toBe(128);
    expect(g["2026-09-14"].no_show_pct.value).toBe(7);
    expect(g["2026-09-14"].triages_started).toBeUndefined();
  });
});

describe("cellText", () => {
  it("contagem inteira com separador de milhar", () => {
    expect(cellText("triages_started", row("w", "triages_started", 1234))).toBe("1.234");
    expect(cellText("triages_started", row("w", "triages_started", 128.0))).toBe("128");
  });

  it("taxa com exatamente 1 casa", () => {
    expect(cellText("no_show_pct", row("w", "no_show_pct", 12.5))).toBe("12,5%");
    expect(cellText("no_show_pct", row("w", "no_show_pct", 12))).toBe("12,0%");
  });

  it("zero é valor", () => {
    expect(cellText("triages_started", row("w", "triages_started", 0))).toBe("0");
    expect(cellText("left_pct", row("w", "left_pct", 0))).toBe("0,0%");
  });

  it("suprimido é oculto", () => {
    expect(cellText("triages_started", row("w", "triages_started", null, true))).toBe("oculto");
  });

  it("sem linha, ou valor nulo sem supressão, é sem dado", () => {
    expect(cellText("triages_started", undefined)).toBe("sem dado");
    expect(cellText("triages_started", row("w", "triages_started", null))).toBe("sem dado");
  });
});

describe("rótulos", () => {
  it("tem rótulo para os seis indicadores", () => {
    expect(INDICATORS.map((i) => INDICATOR_LABELS[i])).toEqual([
      "Triagens iniciadas", "Triagens concluídas", "Atendimentos encerrados",
      "Espera até 30 min", "Faltas", "Saiu sem atendimento"
    ]);
  });
});

describe("datas", () => {
  it("semana formatada por texto, sem fuso", () => {
    expect(fmtWeek("2026-07-06")).toBe("06/07/2026");
  });

  it("instante em São Paulo; nulo vira travessão", () => {
    expect(fmtWhen("2026-09-28T05:02:11Z")).toBe("28/09/2026, 02:02");
    expect(fmtWhen(null)).toBe("—");
    expect(fmtWhen(undefined)).toBe("—");
  });
});

describe("runStatusView", () => {
  it("traduz o estado da última execução", () => {
    expect(runStatusView("succeeded")).toEqual({ label: "concluída", tone: "ok" });
    expect(runStatusView("running")).toEqual({ label: "em execução", tone: "info" });
    expect(runStatusView("failed")).toEqual({ label: "falhou", tone: "down" });
  });

  it("nulo é nunca rodou; estado desconhecido aparece cru, neutro", () => {
    expect(runStatusView(null)).toEqual({ label: "nunca rodou", tone: "neutral" });
    expect(runStatusView(undefined)).toEqual({ label: "nunca rodou", tone: "neutral" });
    expect(runStatusView("paused")).toEqual({ label: "paused", tone: "neutral" });
  });
});
