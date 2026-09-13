import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  hasReviewedReadinessSignal,
  inspectProductionBuild,
  isStagingSupabaseUrl,
  isVercelProductionBuild,
  PRODUCTION_READINESS_VARIABLE,
  REVIEWED_READINESS_SIGNAL,
} from "./productionGuard.ts";
import type { DeployEnvironment } from "./deployPreflight.ts";

const STAGING_REF = "vbizuxx";
const STAGING_URL = `https://${STAGING_REF}abc123.supabase.co`;

const productionReady = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://prod-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_synthetic_public_test_key",
  AI_PROVIDER: "mock",
  WHATSAPP_OUTBOUND_ENABLED: "false",
  WHATSAPP_CHANNEL_ASSIGNMENT_ENABLED: "false",
  EMPLOYEE_LIFECYCLE_ENABLED: "false",
  AUDIT_LOG_ENABLED: "false",
  WORKSPACE_SAFETY_ENABLED: "false",
  TEAM_MANAGEMENT_ENABLED: "false",
  EMPLOYEE_VERSION_HISTORY_ENABLED: "false",
  KNOWLEDGE_V0_ENABLED: "false",
  KNOWLEDGE_SOURCE_REGISTRY_ENABLED: "false",
  CONVERSATION_SAFETY_ENABLED: "false",
  ISSUE_REPORTING_ENABLED: "false",
  INBOUND_DRAFT_ASSIST_ENABLED: "false",
} satisfies DeployEnvironment;

function approve(environment: DeployEnvironment): DeployEnvironment {
  return { ...environment, [PRODUCTION_READINESS_VARIABLE]: REVIEWED_READINESS_SIGNAL };
}

test("VERCEL_ENV=production is the only context treating builds as production", () => {
  assert.equal(isVercelProductionBuild({ VERCEL_ENV: "production" }), true);
  assert.equal(isVercelProductionBuild({ VERCEL_ENV: "preview" }), false);
  assert.equal(isVercelProductionBuild({ VERCEL_ENV: "development" }), false);
  assert.equal(isVercelProductionBuild({ CI: "true" }), false);
  assert.equal(isVercelProductionBuild({}), false);
});

test("only the exact documented reviewed readiness signal counts", () => {
  assert.equal(hasReviewedReadinessSignal({ [PRODUCTION_READINESS_VARIABLE]: REVIEWED_READINESS_SIGNAL }), true);
  assert.equal(hasReviewedReadinessSignal({ [PRODUCTION_READINESS_VARIABLE]: "yes" }), false);
  assert.equal(hasReviewedReadinessSignal({ [PRODUCTION_READINESS_VARIABLE]: "" }), false);
  assert.equal(hasReviewedReadinessSignal({}), false);
});

test("staging Supabase project URLs are recognized by reference prefix", () => {
  assert.equal(isStagingSupabaseUrl(`https://${STAGING_REF}abc123.supabase.co`), true);
  assert.equal(isStagingSupabaseUrl("https://prod-ref.supabase.co"), false);
  assert.equal(isStagingSupabaseUrl(""), false);
  assert.equal(isStagingSupabaseUrl("not a url"), false);
});

test("production build is blocked when the reviewed-readiness approval is missing", () => {
  const issues = inspectProductionBuild(productionReady);
  assert.ok(issues.some((issue) => issue.startsWith(PRODUCTION_READINESS_VARIABLE)));
  assert.equal(issues.join(" ").includes(REVIEWED_READINESS_SIGNAL), false);
});

test("staging Supabase is rejected for production even with approval present", () => {
  const environment = approve({ ...productionReady, NEXT_PUBLIC_SUPABASE_URL: STAGING_URL });
  const issues = inspectProductionBuild(environment);
  assert.ok(issues.some((issue) => issue.startsWith("NEXT_PUBLIC_SUPABASE_URL")));
  assert.equal(issues.join(" ").includes(STAGING_URL), false);
});

test("preview builds stay usable with staging values and no approval", () => {
  const issues = inspectProductionBuild({
    ...approve({ ...productionReady, NEXT_PUBLIC_SUPABASE_URL: STAGING_URL }),
    VERCEL_ENV: "preview",
    [PRODUCTION_READINESS_VARIABLE]: undefined,
  });
  assert.deepEqual(issues, []);
});

test("CI and local builds stay usable without production context", () => {
  assert.deepEqual(inspectProductionBuild({ CI: "true" }), []);
  assert.deepEqual(inspectProductionBuild({}), []);
});

test("approval alone does not weaken WHATSAPP_OUTBOUND_ENABLED=false", () => {
  const environment = approve({
    ...productionReady,
    WHATSAPP_OUTBOUND_ENABLED: "true",
  });
  const issues = inspectProductionBuild(environment);
  assert.ok(issues.some((issue) => issue.startsWith("WHATSAPP_OUTBOUND_ENABLED")));
});

test("approved production build with safe values passes", () => {
  assert.deepEqual(inspectProductionBuild(approve(productionReady)), []);
});

test("the production build itself is gated by the same check", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /inspectProductionBuild/);
  assert.match(config, /production-readiness guard/);
});