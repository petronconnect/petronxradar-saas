import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePetronectPublicCsv } from "../src/lib/petronect-public-csv";

const headers = "Número;Objeto;Sub-status;Empresa;Abrangência;Data início;Data fim;Tipo";
test("parses official-style semicolon CSV and calendar dates without timezone shifts", () => {
  const [row] = parsePetronectPublicCsv(`${headers}\n7001234567;"Manutenção, offshore";Recebimento de Propostas;Petrobras;Nacional;05/11/2026;06/12/2026;Pregão`);
  assert.equal(row?.petronectId, "7001234567");
  assert.equal(row?.title, "Manutenção, offshore");
  assert.equal(row?.startDate, "2026-11-05");
  assert.equal(row?.endDate, "2026-12-06");
  assert.equal(row?.error, null);
});
test("marks duplicate identifiers and invalid dates instead of silently overwriting", () => {
  const rows = parsePetronectPublicCsv(`${headers}\n7001234567;Serviço;A;P;Nacional;31/02/2026;;Pregão\n7001234567;Serviço B;A;P;Nacional;01/03/2026;;Pregão`);
  assert.equal(rows[0]?.error, "Data de início inválida.");
  assert.equal(rows[1]?.error, "Número repetido neste arquivo.");
});
test("rejects missing headers, unterminated quotes, oversized files and unsupported dates", () => {
  assert.throws(() => parsePetronectPublicCsv("foo,bar\n1,2"), /colunas obrigatórias/i);
  assert.throws(() => parsePetronectPublicCsv(`${headers}\n7000000000;"unfinished`), /aspas sem fechamento/i);
  assert.throws(() => parsePetronectPublicCsv("x".repeat(5_000_001)), /5 MB/i);
  assert.throws(() => parsePetronectPublicCsv(headers), /não contém linhas/i);
});
