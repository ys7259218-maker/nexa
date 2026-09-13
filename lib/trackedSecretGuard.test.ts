import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectTrackedFile,
  isAnonRawJwtToken,
  isFixturePath,
  isHighConfidenceToken,
  isPublishableSupabaseValue,
  isTrackedEnvFile,
  scanContentForSecrets,
} from "./trackedSecretGuard.ts";

function rawJwt(role: "anon" | "service_role" | "postgres") {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({ role }),
    "synthetic-signature",
  ].join(".");
}

test("tracked env files are detected by name while .env.example stays allowed", () => {
  assert.equal(isTrackedEnvFile(".env"), true);
  assert.equal(isTrackedEnvFile(".env.local"), true);
  assert.equal(isTrackedEnvFile(".env.production"), true);
  assert.equal(isTrackedEnvFile("config/.env.staging"), true);
  assert.equal(isTrackedEnvFile(".env.example"), false);
  assert.equal(isTrackedEnvFile("lib/environment.ts"), false);
});

test("test fixtures and their synthetic contents are never inspected", () => {
  assert.equal(isFixturePath("lib/deployPreflight.test.ts"), true);
  assert.equal(isFixturePath("tests/integration/rlsCrud.test.ts"), true);
  assert.equal(isFixturePath("lib/ai/mockProvider.test.ts"), true);
  assert.equal(isFixturePath("lib/outbound/whatsappSender.ts"), false);
});

test("Supabase publishable keys are not treated as secrets", () => {
  assert.equal(
    isPublishableSupabaseValue("sb_publishable_synthetic_public_test_key"),
    true,
  );
  assert.equal(isPublishableSupabaseValue("sb_secret_synthetic_value"), false);
  assert.equal(
    isHighConfidenceToken("sb_publishable_synthetic_public_test_key"),
    false,
  );
});

test("anon-role Supabase JWTs are publishable, service-role are not", () => {
  assert.equal(isAnonRawJwtToken(rawJwt("anon")), true);
  assert.equal(isAnonRawJwtToken(rawJwt("service_role")), false);
  assert.equal(isHighConfidenceToken(rawJwt("anon")), false);
  assert.equal(isHighConfidenceToken(rawJwt("service_role")), true);
  assert.equal(isHighConfidenceToken(rawJwt("postgres")), true);
});

test("high-confidence token prefixes are detected", () => {
  for (const token of [
    "sk-syntheticSecretForGuardTestingPurpose",
    "ghp_syntheticGithubTokenForGuardTesting",
    "github_pat_synthetic_token_value_for_guard",
    "xoxb-synthetic-slack-token-value",
    "AKIAZ67HHYBV2M7RTM2Y",
    "sb_secret_AbCdEfGhIjKlMnOpQrStUvWxYz",
  ]) {
    assert.equal(isHighConfidenceToken(token), true, token);
  }
});

test("placeholder and example values are ignored", () => {
  for (const token of [
    "your-anon-or-publishable-key",
    "choose-a-random-webhook-verification-token",
    "sk-placeholder-replace-me-now",
    "example",
  ]) {
    assert.equal(isHighConfidenceToken(token), false, token);
  }
});

test("scanContentForSecrets finds private key blocks and assigned tokens", () => {
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
  assert.deepEqual(scanContentForSecrets(pem), ["private-key"]);

  const assignment = "const TOKEN = \"sk-syntheticSecretForGuardTestingPurpose\";";
  assert.deepEqual(scanContentForSecrets(assignment), ["high-confidence-token"]);

  const publishable = "NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_synthetic_key";
  assert.deepEqual(scanContentForSecrets(publishable), []);
});

test("inspectTrackedFile flags committed env files without reading contents", () => {
  assert.deepEqual(inspectTrackedFile(".env.local", ""), [
    { file: ".env.local", kind: "tracked-env-file" },
  ]);
  assert.equal(inspectTrackedFile(".env.example", "").length, 0);
});

test("inspectTrackedFile skips fixture files and flags secrets in source", () => {
  const fixtureSecret = "const KEY = \"ghp_syntheticGithubTokenForGuardTesting\";";
  assert.deepEqual(inspectTrackedFile("lib/spec.test.ts", fixtureSecret), []);

  const sourceSecret = "export const KEY = \"ghp_syntheticGithubTokenForGuardTesting\";";
  assert.deepEqual(inspectTrackedFile("lib/source.ts", sourceSecret), [
    { file: "lib/source.ts", kind: "high-confidence-token" },
  ]);
});