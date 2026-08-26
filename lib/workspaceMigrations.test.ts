import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync(
  new URL("../docs/migrations/20260824_workspace_tenancy_foundation.sql", import.meta.url),
  "utf8",
);
const cutover = readFileSync(
  new URL("../docs/migrations/20260824_workspace_tenancy_cutover.sql", import.meta.url),
  "utf8",
);

test("workspace foundation enforces one immutable creator-owned personal workspace", () => {
  assert.match(foundation, /is_personal boolean not null default false/i);
  assert.match(foundation, /unique index[^;]+created_by[^;]+where is_personal/i);
  assert.match(foundation, /protect_personal_workspace_membership/i);
  assert.match(foundation, /role = any \(array\['owner','admin','operator','viewer'\]::text\[\]\)/i);
  assert.doesNotMatch(foundation, /min\s*\(\s*w\.id\s*\)/i);
});

test("workspace cutover maps legacy rows only through explicit personal identity", () => {
  assert.match(cutover, /w\.created_by\s*=\s*target\.user_id\s+and\s+w\.is_personal/i);
  assert.match(cutover, /mismatched_rows/i);
  assert.doesNotMatch(cutover, /order by created_at(?:\s+asc)?\s+limit 1/i);
  assert.doesNotMatch(cutover, /select workspace_id from public\.workspace_members\s+where user_id/i);
});
