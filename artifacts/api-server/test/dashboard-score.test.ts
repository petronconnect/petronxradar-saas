import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateRadarScore } from "../src/lib/radar-score";

test("Radar Score applies classified-sector coverage to diversity points", () => {
  assert.equal(
    calculateRadarScore({
      totalOpportunities: 307,
      opportunitiesThisMonth: 287,
      classifiedOpportunities: 20,
      classifiedSectors: 16,
    }),
    72,
  );
});

test("unclassified opportunities cannot earn sector-diversity points", () => {
  assert.equal(
    calculateRadarScore({
      totalOpportunities: 300,
      opportunitiesThisMonth: 100,
      classifiedOpportunities: 0,
      classifiedSectors: 10,
    }),
    70,
  );
});

test("a fully classified, high-activity portfolio can reach 100", () => {
  assert.equal(
    calculateRadarScore({
      totalOpportunities: 300,
      opportunitiesThisMonth: 80,
      classifiedOpportunities: 300,
      classifiedSectors: 10,
    }),
    100,
  );
});

test("empty or invalid negative inputs do not produce a negative score", () => {
  assert.equal(
    calculateRadarScore({
      totalOpportunities: 0,
      opportunitiesThisMonth: 0,
      classifiedOpportunities: 0,
      classifiedSectors: 0,
    }),
    0,
  );
  assert.equal(
    calculateRadarScore({
      totalOpportunities: -5,
      opportunitiesThisMonth: -2,
      classifiedOpportunities: -3,
      classifiedSectors: -1,
    }),
    0,
  );
});
