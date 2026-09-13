import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectEntry,
  isAnonRawJwtToken,
  isHighConfidenceToken,
  isPlaceholderValue,
  isPublishableSupabaseValue,
  isSymbolicEntry,
  isTrackedEnvFile,
  scanContentForSecrets,
  type ReadBlob,
  type TrackedEntry,
} from "./trackedSecretGuard.ts";

// This file is itself scanned by the guard on the real repository, so every
// secret-looking string in the tests below is built at runtime from fragments.
// The source text therefore never contains a contiguous high-confidence token,
// a "=?token" assignment, or a contiguous PEM block.

function rawJwt(role: "anon" | "service_role" | "postgres") {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({ role }),
    "synthetic-signature",
  ].join(".");
}

function entry(path: string, sha = "abc"): TrackedEntry {
  return { mode: "100644", sha, path };
}

test("tracked env files are detected by name while .env.example stays allowed", () => {
  assert.equal(isTrackedEnvFile(".env"), true);
  assert.equal(isTrackedEnvFile(".env.local"), true);
  assert.equal(isTrackedEnvFile(".env.production"), true);
  assert.equal(isTrackedEnvFile("config/.env.staging"), true);
  assert.equal(isTrackedEnvFile(".env.example"), false);
  assert.equal(isTrackedEnvFile("lib/environment.ts"), false);
});

test("symbolic index entries are recognized", () => {
  assert.equal(isSymbolicEntry({ ...entry("some/link"), mode: "120000" }), true);
  assert.equal(isSymbolicEntry({ ...entry("submodule"), mode: "160000" }), true);
  assert.equal(isSymbolicEntry(entry("lib/source.ts")), false);
});

test("exact placeholder and synthetic forms are ignored", () => {
  for (const value of [
    "your-anon-or-publishable-key",
    "your-meta-app-secret",
    "choose-a-random-webhook-verification-token",
    "synthetic-fixture-key",
    "example-key",
    "sample_secret",
    "placeholder_value",
    "to-change-me",
    "example",
    "dummy",
    "lorem",
    "test",
  ]) {
    assert.equal(isPlaceholderValue(value), true, value);
    assert.equal(isHighConfidenceToken(value), false, value);
  }
});

test("placeholder words inside a real-looking token do not hide it", () => {
  const realLookingTokens = [
    "sk_live_" + "example123456789012345",
    "whsec_" + "exampleDummyTokenVal789",
    "ghp_" + "exampleGithubTokenLooksReal",
    "sk-placeholder-replace-me-now",
  ];
  for (const token of realLookingTokens) {
    assert.equal(isPlaceholderValue(token), false, token);
    assert.equal(isHighConfidenceToken(token), true, token);
  }
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
  const secretTokens = [
    "sk-" + "syntheticSecretForGuardTestingPurpose",
    "sk_live_" + "syntheticSecretForGuardTesting",
    "rk_live_" + "syntheticTokenValueForGuardTest",
    "whsec_" + "exampleDummyTokenVal789",
    "ghp_" + "syntheticGithubTokenForGuardTesting",
    "gho_" + "syntheticOrgTokenForGuardTesting",
    "github_pat_" + "synthetic_token_value_for_guard",
    "xoxb-" + "synthetic-slack-token-value",
    "AKIA" + "Z67HHYBV2M7RTM2Y",
    "sb_secret_" + "AbCdEfGhIjKlMnOpQrStUvWxYz",
  ];
  for (const token of secretTokens) {
    assert.equal(isHighConfidenceToken(token), true, token);
  }
});

test("scanContentForSecrets finds private key blocks and assigned tokens", () => {
  const pem =
    "-----BEGIN " +
    "RSA PRIVATE KEY" +
    "-----\nMIIEowIBAAKCAQEA\n-----END " +
    "RSA PRIVATE KEY" +
    "-----";
  assert.deepEqual(scanContentForSecrets(pem), ["private-key"]);

  const cart = "sk-" + "syntheticSecretForGuardTestingPurpose";
  const assigned = 'const TOKEN = "' + cart + '";';
  assert.deepEqual(scanContentForSecrets(assigned), ["high-confidence-token"]);

  const publishable = "NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_synthetic_key";
  assert.deepEqual(scanContentForSecrets(publishable), []);

  const anonJwt = "NEXT_PUBLIC_SUPABASE_ANON_KEY=" + rawJwt("anon");
  assert.deepEqual(scanContentForSecrets(anonJwt), []);
});

test("inspectEntry flags committed env files without reading contents", () => {
  const readBlob: ReadBlob = () => {
    throw new Error("env file contents must never be read");
  };
  assert.deepEqual(inspectEntry(entry(".env.local"), readBlob), [
    { file: ".env.local", kind: "tracked-env-file" },
  ]);
});

test("inspectEntry never reads symbolic entries", () => {
  const readBlob: ReadBlob = () => {
    throw new Error("symbolic targets must never be read");
  };
  assert.deepEqual(inspectEntry({ ...entry("some/link"), mode: "120000" }, readBlob), []);
  assert.deepEqual(inspectEntry({ ...entry("submodule"), mode: "160000" }, readBlob), []);
});

test("inspectEntry scans .env.example contents and ignores its placeholders", () => {
  const readBlob: ReadBlob = () =>
    "WHATSAPP_APP_SECRET=your-meta-app-secret\n" +
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key\n";
  assert.deepEqual(inspectEntry(entry(".env.example"), readBlob), []);
});

test("inspectEntry still flags a real token inside an allowed env example", () => {
  const liveStripe = "sk_live_" + "example123456789012345";
  const readBlob: ReadBlob = () => "OPENAI_API_KEY=" + liveStripe + "\n";
  assert.deepEqual(inspectEntry(entry(".env.example"), readBlob), [
    { file: ".env.example", kind: "high-confidence-token" },
  ]);
});

test("inspectEntry scans test and fixture files fully", () => {
  const cart = "ghp_" + "syntheticGithubTokenForGuardTesting";
  const fixtureContent = 'const KEY = "' + cart + '";';
  for (const path of [
    "lib/spec.test.ts",
    "lib/spec.spec.tsx",
    "tests/integration/rlsCrud.test.ts",
    "__fixtures__/webhook-payload.ts",
  ]) {
    assert.deepEqual(inspectEntry({ ...entry(path), sha: "feed" }, () => fixtureContent), [
      { file: path, kind: "high-confidence-token" },
    ]);
  }
});

test("inspectEntry fails closed when a blob cannot be read", () => {
  const readBlob: ReadBlob = (sha) => {
    throw new Error("corrupt blob " + sha);
  };
  assert.throws(
    () => inspectEntry(entry("lib/source.ts", "deadbeef"), readBlob),
    /corrupt blob/,
  );
});