/**
 * Phase B B3 credential broker contract.
 *
 * Typed contract with an injected secret source and deterministic mock only.
 * The broker serializes into tool-call envelopes at the execution edge only.
 * No plaintext secret crosses into the agent runtime; no plaintext secret is
 * stored in broker metadata. Secrets never appear in logs, audit rows,
 * events, or agent context.
 */

import { hashJsonSafe } from "./hash.ts";
import type { CredentialMetadata, ToolCall } from "./permissionTypes.ts";
import type { PermissionStore } from "./permissionStore.ts";

/**
 * Opaque serialized credential envelope consumed only at the tool execution
 * edge. The agent runtime never receives plaintext secret values.
 */
export type CredentialEnvelope = Readonly<{
  /**
   * Content-free reference into the server-only secret store. Never a
   * plaintext secret, never a raw token.
   */
  reference: string;
  /**
   * Content-free hash of the envelope for audit correlation.
   */
  envelopeHash: string;
  /**
   * ISO timestamp when the envelope was issued.
   */
  issuedAt: string;
  ttlSeconds: number | null;
}>;

export type CredentialBrokerEnvironment = Readonly<
  Record<string, string | undefined>
>;

/**
 * Secret source injected by the caller. Implementations read from server-only
 * stores (e.g. encrypted calendar OAuth connections) and return plaintext
 * only inside the envelope serialization boundary. The default mock returns
 * a deterministic placeholder.
 */
export type SecretSource = Readonly<{
  getSecret(workspaceId: string, credentialKey: string): Promise<string | null>;
}>;

/**
 * Credential broker. `brokerCredential` returns an opaque envelope; callers
 * pass the envelope to the tool adapter at execution time. The agent runtime
 * never sees plaintext.
 */
export type CredentialBroker = Readonly<{
  brokerCredential(
    toolCall: ToolCall,
    credentialKey: string,
  ): Promise<CredentialEnvelope | null>;
}>;

function isNonEmptyId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Default deterministic mock broker. Returns a content-free envelope with no
 * real secret. Used in tests and when no live secret source is configured.
 */
export function createMockCredentialBroker(
  options: {
    store?: PermissionStore;
    now?: () => Date;
  } = {},
): CredentialBroker {
  const now = options.now ?? (() => new Date());

  return {
    async brokerCredential(toolCall, credentialKey) {
      if (!isNonEmptyId(credentialKey)) return null;

      const issuedAt = now().toISOString();
      const reference = hashJsonSafe({
        workspaceId: toolCall.workspaceId,
        credentialKey,
        issuedAt,
      });
      const envelopeHash = hashJsonSafe({
        reference,
        issuedAt,
        toolFamily: toolCall.toolFamily,
      });

      return {
        reference,
        envelopeHash,
        issuedAt,
        ttlSeconds: null,
      };
    },
  };
}

/**
 * Broker backed by an injected secret source. Reads plaintext only inside
 * the envelope boundary and returns a content-free reference. The plaintext
 * secret never crosses into the agent runtime.
 */
export function createSecretSourceCredentialBroker(
  secretSource: SecretSource,
  options: {
    store?: PermissionStore;
    now?: () => Date;
  } = {},
): CredentialBroker {
  const now = options.now ?? (() => new Date());

  return {
    async brokerCredential(toolCall, credentialKey) {
      if (!isNonEmptyId(credentialKey)) return null;

      const secret = await secretSource.getSecret(
        toolCall.workspaceId,
        credentialKey,
      );
      if (secret === null) return null;

      const issuedAt = now().toISOString();
      // Content-free reference: hash of workspace + key + issued timestamp.
      // The plaintext secret is consumed only at the execution edge by the
      // caller and never stored in the reference.
      const reference = hashJsonSafe({
        workspaceId: toolCall.workspaceId,
        credentialKey,
        issuedAt,
      });
      const envelopeHash = hashJsonSafe({
        reference,
        issuedAt,
        toolFamily: toolCall.toolFamily,
      });

      return {
        reference,
        envelopeHash,
        issuedAt,
        ttlSeconds: null,
      };
    },
  };
}

/**
 * Validate that an envelope contains no raw secret material. The reference
 * must be a hash, never a plaintext token or key.
 */
export function validateEnvelope(envelope: CredentialEnvelope): boolean {
  const HASH_PATTERN = /^[0-9a-f]{64}$/;
  return (
    typeof envelope.reference === "string" &&
    HASH_PATTERN.test(envelope.reference) &&
    typeof envelope.envelopeHash === "string" &&
    HASH_PATTERN.test(envelope.envelopeHash) &&
    typeof envelope.issuedAt === "string" &&
    !isPlaintextSecret(envelope.reference)
  );
}

function isPlaintextSecret(value: string): boolean {
  // Reject anything that looks like a raw token/key pattern.
  const secretPatterns = [
    /^sk_/, /^rk_live_/, /^whsec_/, /^gh[pousr]_/, /^github_pat_/, /^xox[baprs]-/,
    /^AKIA/, /^sb_secret_/, /^eyJ/, // raw JWT
  ];
  return secretPatterns.some((pattern) => pattern.test(value));
}

export type { CredentialMetadata };
