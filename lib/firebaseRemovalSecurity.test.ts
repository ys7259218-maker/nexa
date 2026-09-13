import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("unused Firebase client SDK and browser credential surface stay removed", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { dependencies?: Record<string, string> };
  const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const firebaseModule = new URL("./firebase.ts", import.meta.url);

  assert.equal(packageJson.dependencies?.firebase, undefined);
  assert.equal(existsSync(firebaseModule), false);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_FIREBASE_/);
});
