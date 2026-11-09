/**
 * Phase B B3 risk scoring tests.
 *
 * Risk classification = data_sensitivity × side_effect × blast_radius.
 * The matrix elevates the effective tier but never lowers it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  riskBaseTier,
  scoreRisk,
  MAX_RISK_SCORE,
} from "./riskScoring.ts";
import { PERMISSION_TIERS, type PermissionTier } from "./permissionTypes.ts";

test("risk scoring rejects out-of-range dimensions", () => {
  for (const invalid of [0, 6, -1, 1.5, NaN, Infinity]) {
    assert.throws(
      () => scoreRisk("T0", invalid, 1, 1),
      `data_sensitivity ${invalid} should throw`,
    );
    assert.throws(
      () => scoreRisk("T0", 1, invalid, 1),
      `side_effect ${invalid} should throw`,
    );
    assert.throws(
      () => scoreRisk("T0", 1, 1, invalid),
      `blast_radius ${invalid} should throw`,
    );
  }
});

test("risk base tier matrix maps product scores", () => {
  // 1-3: minimal -> T0
  assert.equal(riskBaseTier(1, 1, 1), "T0"); // 1
  assert.equal(riskBaseTier(1, 1, 2), "T0"); // 2
  assert.equal(riskBaseTier(1, 1, 3), "T0"); // 3
  // 4-6: low -> T1
  assert.equal(riskBaseTier(1, 2, 2), "T1"); // 4
  assert.equal(riskBaseTier(1, 2, 3), "T1"); // 6
  // 7-9: medium -> T2
  assert.equal(riskBaseTier(1, 2, 4), "T2"); // 8
  assert.equal(riskBaseTier(3, 3, 1), "T2"); // 9
  // 10-12: high -> T3
  assert.equal(riskBaseTier(2, 2, 3), "T3"); // 12
  // 13-15: critical -> T4
  assert.equal(riskBaseTier(3, 5, 1), "T4"); // 15
  assert.equal(riskBaseTier(5, 3, 1), "T4"); // 15
});

test("max risk score is 125", () => {
  assert.equal(MAX_RISK_SCORE, 125);
});

test("scoreRisk clamps products above 15 to T4", () => {
  const result = scoreRisk("T0", 5, 5, 5); // 125 -> clamped to T4
  assert.equal(result.effectiveTier, "T4");
});

test("scoreRisk effective tier never lowers below declared tier", () => {
  // Declared T4 with minimal risk -> effective stays T4 (never drops to T0)
  const result = scoreRisk("T4", 1, 1, 1); // product 1 -> risk base T0
  assert.equal(result.effectiveTier, "T4");

  // Declared T2 with medium risk -> effective T2 (max of T2 and T2)
  const result2 = scoreRisk("T2", 3, 3, 1); // product 9 -> risk base T2
  assert.equal(result2.effectiveTier, "T2");

  // Declared T1 with high risk -> effective elevates to T3
  const result3 = scoreRisk("T1", 2, 2, 3); // product 12 -> risk base T3
  assert.equal(result3.effectiveTier, "T3");
});

test("scoreRisk preserves all dimension scores", () => {
  const result = scoreRisk("T2", 3, 4, 2);
  assert.equal(result.dataSensitivity, 3);
  assert.equal(result.sideEffect, 4);
  assert.equal(result.blastRadius, 2);
  // product 24 -> clamped to 15 -> T4, max(T2, T4) = T4
  assert.equal(result.effectiveTier, "T4");
});

test("all tiers are valid permission tiers", () => {
  for (const tier of PERMISSION_TIERS) {
    assert.ok(
      ["T0", "T1", "T2", "T3", "T4", "T5"].includes(tier),
      `${tier} should be a valid tier`,
    );
  }
});
