import { describe, expect, it } from "vitest";
import {
  REVIEW_PAGE, anvisaImportText, catalogImportText, countText, importErrorText, parseStatusView, releaseText, reviewNote
} from "./medications";

describe("countText", () => {
  it("formata em pt-BR e nulo vira travessão", () => {
    expect(countText(6778)).toBe("6.778");
    expect(countText(0)).toBe("0");
    expect(countText(null)).toBe("—");
    expect(countText(undefined)).toBe("—");
  });
});

describe("releaseText", () => {
  it("resume a versão atual", () => {
    expect(releaseText({ id: "r1", importedAt: "2026-10-09T12:00:00Z", itemsCount: 6778, hiddenCount: 312 }))
      .toBe("importado em 09/10/2026, 09:00 · 6.778 itens · 312 ocultos para revisão");
  });

  it("sem importação ainda: diz o que isso significa", () => {
    expect(releaseText(null)).toBe("nenhuma importação ainda — até a primeira, a receita só aceita texto livre");
    expect(releaseText(undefined)).toBe("nenhuma importação ainda — até a primeira, a receita só aceita texto livre");
  });
});

describe("parseStatusView", () => {
  it("ok, para revisar e desconhecido cru", () => {
    expect(parseStatusView("ok")).toEqual({ label: "entendido", tone: "ok" });
    expect(parseStatusView("review")).toEqual({ label: "para revisar", tone: "warn" });
    expect(parseStatusView("ambiguous")).toEqual({ label: "ambiguous", tone: "neutral" });
  });
});

describe("reviewNote", () => {
  it("aviso de lista truncada", () => {
    expect(REVIEW_PAGE).toBe(50);
    expect(reviewNote(50, 312)).toBe("mostrando 50 de 312 itens ocultos");
    expect(reviewNote(12, 12)).toBeNull();
    expect(reviewNote(0, 0)).toBeNull();
  });
});

describe("importErrorText", () => {
  it("erros da importação: conhecidos traduzidos, desconhecido cru", () => {
    expect(importErrorText([ { path: "catalog", message: "source_unavailable" } ]))
      .toBe("o Compras.gov não respondeu — nada mudou; tente de novo mais tarde");
    expect(importErrorText([ { message: "incomplete_source" } ]))
      .toBe("o Compras.gov devolveu menos itens do que anunciou — nada mudou; tente de novo mais tarde");
    expect(importErrorText([ { message: "suspicious_drop" } ]))
      .toBe("o CATMAT veio com menos da metade dos itens ativos — nada mudou; confira a fonte antes de importar de novo");
    expect(importErrorText([ { message: "invalid_file" } ])).toBe("um arquivo das listas da Anvisa está inválido — nada mudou");
    expect(importErrorText([ { message: "import_failed" } ])).toBe("a importação falhou — nada mudou");
    expect(importErrorText([ { message: "import_in_progress" } ])).toBe("já há uma importação em andamento — espere ela terminar");
    expect(importErrorText([ { message: "parser_crashed" } ])).toBe("parser_crashed");
    expect(importErrorText([ { message: "import_in_progress" }, { message: "outra coisa" } ]))
      .toBe("já há uma importação em andamento — espere ela terminar; outra coisa");
    expect(importErrorText([])).toBe("não foi possível concluir — tente de novo");
  });
});

describe("catalogImportText", () => {
  it("resultado do CATMAT: entraram, mudaram, saíram; com saída, explica", () => {
    expect(catalogImportText({ ok: true, releaseId: "r2", added: 40, changed: 7, removed: 0, errors: [] }))
      .toBe("Catálogo importado: 40 entraram, 7 mudaram, 0 saíram.");
    expect(catalogImportText({ ok: true, releaseId: "r2", added: 1203, changed: 0, removed: 12, errors: [] }))
      .toBe("Catálogo importado: 1.203 entraram, 0 mudaram, 12 saíram. Os que saíram deixam de aparecer na busca da receita; receitas já emitidas não mudam.");
  });

  it("contagem nula vira travessão; recusa diz o motivo", () => {
    expect(catalogImportText({ ok: true, releaseId: null, added: null, changed: null, removed: null, errors: [] }))
      .toBe("Catálogo importado: — entraram, — mudaram, — saíram.");
    expect(catalogImportText({ ok: false, errors: [ { message: "source_unavailable" } ] }))
      .toBe("o Compras.gov não respondeu — nada mudou; tente de novo mais tarde");
  });
});

describe("anvisaImportText", () => {
  it("diz quantos foram marcados, ou o motivo da recusa", () => {
    expect(anvisaImportText({ ok: true, antimicrobials: 118, controlled: 402, errors: [] }))
      .toBe("Listas da Anvisa importadas: 118 antimicrobianos (IN 360/2025) e 402 controlados (Portaria 344) marcados no catálogo.");
    expect(anvisaImportText({ ok: false, errors: [ { message: "invalid_file" } ] }))
      .toBe("um arquivo das listas da Anvisa está inválido — nada mudou");
  });
});
