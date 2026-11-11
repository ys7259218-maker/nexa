/**
 * Phase B B5 memory system contracts.
 *
 * These types are deliberately independent of any provider, network client,
 * or database driver. B5 memory services are deterministic contracts;
 * memory tables, consent flow, and retention/deletion are the durable
 * pieces. Nothing here calls a model provider, WhatsApp, OAuth, the
 * network, a browser, the filesystem, or any calendar API.
 */

export const MEMORY_LAYERS = ["M0", "M1", "M2", "M3", "M4", "M5"] as const;

export type MemoryLayer = (typeof MEMORY_LAYERS)[number];

export const MEMORY_CONSENT_TYPES = ["m3_persistent_memory"] as const;

export type MemoryConsentType = (typeof MEMORY_CONSENT_TYPES)[number];

export const MEMORY_TTL_MIN = 1;
export const MEMORY_TTL_MAX = 604_800; // 7 days in seconds

export type MemorySessionScratchpad = Readonly<{
  id: string;
  workspaceId: string;
  taskId: string;
  scratchpadKey: string;
  scratchpadValue: Record<string, unknown>;
  ttlSeconds: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type MemoryTaskMemory = Readonly<{
  id: string;
  workspaceId: string;
  taskId: string;
  stepSeq: number;
  outputKey: string;
  outputValueHash: string;
  artifactRef: string | null;
  evidenceLink: string | null;
  retentionWindowSeconds: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type MemoryUserApprovedFact = Readonly<{
  id: string;
  workspaceId: string;
  factKey: string;
  factValueHash: string;
  consentRecordId: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}>;

export type MemoryExternalDataRef = Readonly<{
  id: string;
  workspaceId: string;
  refKey: string;
  refUrl: string | null;
  refId: string | null;
  revalidationWindowSeconds: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type MemoryConsentRecord = Readonly<{
  id: string;
  workspaceId: string;
  userId: string;
  consentType: MemoryConsentType;
  granted: boolean;
  grantedAt: string;
  revokedAt: string | null;
  evidenceHash: string;
  createdAt: string;
}>;

export type MemoryEnvironment = Readonly<Record<string, string | undefined>>;

export type MemoryGateReason = "enabled" | "flag_off" | "production";

export type MemoryGate = {
  enabled: boolean;
  reason: MemoryGateReason;
};

export type MemoryServiceOptions = Readonly<{
  store: MemoryStore;
  gate: MemoryGate;
  /**
   * True when the workspace memory kill switch is paused for this
   * workspace. Memory service returns blocked for all operations when paused.
   */
  workspacePaused: boolean;
  /**
   * Tenant kill switch. When false, the entire memory system is dormant.
   */
  tenantKillSwitchEnabled: boolean;
  now?: () => Date;
  idFactory?: () => string;
}>;

export function isMemoryLayer(value: unknown): value is MemoryLayer {
  return MEMORY_LAYERS.includes(value as MemoryLayer);
}

export function isMemoryConsentType(value: unknown): value is MemoryConsentType {
  return MEMORY_CONSENT_TYPES.includes(value as MemoryConsentType);
}

export function isValidMemoryTtl(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MEMORY_TTL_MIN &&
    value <= MEMORY_TTL_MAX
  );
}

export const HASH_PATTERN = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && HASH_PATTERN.test(value);
}

export type StoreOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export type MemoryStore = Readonly<{
  upsertMemorySessionScratchpad(input: {
    workspaceId: string;
    taskId: string;
    scratchpadKey: string;
    scratchpadValue: Record<string, unknown>;
    ttlSeconds: number;
  }): Promise<StoreOutcome<{ scratchpadId: string }>>;
  deleteMemorySessionScratchpad(input: {
    workspaceId: string;
    taskId: string;
    scratchpadKey: string;
  }): Promise<StoreOutcome<{ scratchpadId: string }>>;
  getMemorySessionScratchpad(
    workspaceId: string,
    taskId: string,
    scratchpadKey: string,
  ): Promise<MemorySessionScratchpad | null>;
  listMemorySessionScratchpads(
    workspaceId: string,
    taskId?: string | null,
  ): Promise<MemorySessionScratchpad[]>;
  upsertMemoryTaskMemory(input: {
    workspaceId: string;
    taskId: string;
    stepSeq: number;
    outputKey: string;
    outputValueHash: string;
    artifactRef: string | null;
    evidenceLink: string | null;
    retentionWindowSeconds: number;
  }): Promise<StoreOutcome<{ memoryId: string }>>;
  deleteMemoryTaskMemory(input: {
    workspaceId: string;
    taskId: string;
    stepSeq: number;
    outputKey: string;
  }): Promise<StoreOutcome<{ memoryId: string }>>;
  getMemoryTaskMemory(
    workspaceId: string,
    taskId: string,
  ): Promise<MemoryTaskMemory[]>;
  upsertMemoryUserApprovedFact(input: {
    workspaceId: string;
    factKey: string;
    factValueHash: string;
    consentRecordId: string;
    expiresAt: string | null;
  }): Promise<StoreOutcome<{ factId: string }>>;
  deleteMemoryUserApprovedFact(input: {
    workspaceId: string;
    factKey: string;
  }): Promise<StoreOutcome<{ factId: string }>>;
  getMemoryUserApprovedFacts(
    workspaceId: string,
  ): Promise<MemoryUserApprovedFact[]>;
  upsertMemoryExternalDataRef(input: {
    workspaceId: string;
    refKey: string;
    refUrl: string | null;
    refId: string | null;
    revalidationWindowSeconds: number;
  }): Promise<StoreOutcome<{ refId: string }>>;
  deleteMemoryExternalDataRef(input: {
    workspaceId: string;
    refKey: string;
  }): Promise<StoreOutcome<{ refId: string }>>;
  getMemoryExternalDataRefs(
    workspaceId: string,
  ): Promise<MemoryExternalDataRef[]>;
  recordMemoryConsent(input: {
    workspaceId: string;
    userId: string;
    consentType: MemoryConsentType;
    granted: boolean;
    evidenceHash: string;
  }): Promise<StoreOutcome<{ consentId: string }>>;
  getMemoryConsentRecords(
    workspaceId: string,
    userId: string,
  ): Promise<MemoryConsentRecord[]>;
}>;
