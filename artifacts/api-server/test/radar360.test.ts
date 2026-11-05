import assert from "node:assert/strict";
import test from "node:test";
import type { Radar360Profile } from "@workspace/db";
import { canAccessRadar360Company } from "../src/lib/radar360-access";
import {
  evaluateAndLimitCandidates,
  parseRadar360Csv,
  renderRadar360Svg,
  renderRadar360Text,
  type Radar360Candidate,
} from "../src/lib/radar360-engine";

const profile: Radar360Profile = {
  id: 1,
  referenceKey: "company-10",
  companyId: 10,
  candidateCompanyId: null,
  displayName: "Empresa de Teste",
  aliases: [],
  focusAreas: ["engenharia"],
  declaredCapabilities: ["manutenção industrial"],
  verifiedCapabilities: ["manutenção industrial"],
  regions: ["Rio de Janeiro"],
  keywords: ["manutenção", "montagem"],
  exclusions: ["manutenção marítima"],
  exclusionsReviewed: true,
  profileStatus: "ready",
  reconciliationStatus: "linked",
  cadence: "manual",
  scheduleEnabled: false,
  createdBy: 1,
  updatedBy: 1,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function candidate(overrides: Partial<Radar360Candidate> = {}): Radar360Candidate {
  return {
    sourceKey: "source:1",
    sourceName: "Arquivo oficial fornecido pelo usuário",
    processNumber: "PROC-ABC",
    object: "Serviço de engenharia, montagem e manutenção industrial",
    contractor: "Contratante informado",
    deadlineText: "2026-11-30 12:00",
    timeZone: "America/Sao_Paulo",
    sourceUrl: "https://example.org/edital",
    sourceCheckedAt: "2026-11-05T12:00:00.000Z",
    sourceTimeKnown: true,
    sector: "Engenharia",
    region: "Rio de Janeiro",
    value: null,
    status: "aberta",
    ...overrides,
  };
}

test("CSV preview flags repeated process numbers and unsafe source links", () => {
  const csv = [
    "processo;objeto;contratante;prazo;fuso;url;consultado em;setor;regiao;valor",
    'PROC-1;"Serviço de engenharia";Contratante;2026-11-30 12:00;America/Sao_Paulo;javascript:alert(1);2026-11-05T12:00:00-03:00;Engenharia;RJ;1.250,00',
    'PROC-1;"Serviço de engenharia";Contratante;2026-11-30 12:00;America/Sao_Paulo;;2026-11-05T12:00:00-03:00;Engenharia;RJ;1.250,00',
  ].join("\n");
  const rows = parseRadar360Csv({
    csvText: csv,
    sourceName: "Edital enviado",
    now: new Date("2026-11-05T15:00:00Z"),
    existingKeys: new Set(),
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].action, "new");
  assert.equal(rows[1].action, "duplicate");
  assert.equal(rows[0].sourceUrl, null);
  assert.equal(rows[0].checkedAtKnown, true);
  assert.equal(rows[0].value, 1250);
  assert.ok(rows[0].missingFields.includes("link/documento da fonte"));
});

test("expired opportunities never enter the active Top 10", () => {
  const results = evaluateAndLimitCandidates(profile, [
    candidate({ sourceKey: "old", processNumber: "OLD-1", deadlineText: "2026-08-01" }),
    candidate({ sourceKey: "active", processNumber: "ACTIVE-1" }),
  ], "2026-11-05");
  const expired = results.find((item) => item.sourceKey === "old");
  const active = results.find((item) => item.sourceKey === "active");
  assert.ok(expired?.expired);
  assert.equal(expired?.category, "discarded");
  assert.ok(active && active.category !== "discarded");
  assert.equal(active?.fitScore, 100);
  assert.ok(active?.scoreBreakdown.some((line) => line.criterion === "Capacidade comprovada"));
});

test("score is transparent, not win probability, and text and SVG use the same candidate", () => {
  const items = evaluateAndLimitCandidates(profile, [candidate()], "2026-11-05");
  const coverage = [{
    kind: "client_import",
    label: "Lista importada",
    status: "success",
    checkedAt: "2026-11-05T12:00:00.000Z",
    sourceTimeKnown: true,
    recordCount: 1,
    limitations: ["Cobertura limitada ao arquivo."],
  }];
  const text = renderRadar360Text({ profile, baseDate: "2026-11-05", sourceCoverage: coverage, items, warnings: [] });
  const image = renderRadar360Svg({ profile, baseDate: "2026-11-05", sourceCoverage: coverage, items });
  assert.match(text, /não é probabilidade de vitória/i);
  assert.match(text, /PROC-ABC/);
  assert.match(text, /Situação: aberta/);
  assert.match(text, /consulta na fonte/);
  assert.match(image, /Empresa de Teste/);
  assert.match(image, /PROC-ABC/);
  assert.match(image, /Serviço de engenharia, montagem e manutenção industrial/);
  assert.match(image, /Situação: aberta/);
  assert.match(image, /Consulta: 2026-11-05T12:00:00.000Z/);
  assert.match(image, /ADERÊNCIA 100\/100/);
});

test("ranking caps active recommendations at ten without manufacturing entries", () => {
  const many = Array.from({ length: 13 }, (_, index) => candidate({
    sourceKey: `source:${index}`,
    processNumber: `PROC-${index}`,
  }));
  const results = evaluateAndLimitCandidates(profile, many, "2026-11-05");
  assert.equal(results.filter((item) => item.category !== "discarded").length, 10);
  assert.equal(results.filter((item) => item.justification.includes("limite de até 10")).length, 3);
  assert.equal(evaluateAndLimitCandidates(profile, [], "2026-11-05").length, 0);
});

test("company scope grants same-company and platform-admin access only", () => {
  assert.equal(canAccessRadar360Company(10, { role: "CLIENTE_ADMIN", companyId: 10 }), true);
  assert.equal(canAccessRadar360Company(10, { role: "USUARIO_CLIENTE", companyId: 11 }), false);
  assert.equal(canAccessRadar360Company(null, { role: "CLIENTE_ADMIN", companyId: 10 }), false);
  assert.equal(canAccessRadar360Company(99, { role: "ADMIN_PETRON", companyId: 1 }), true);
});
