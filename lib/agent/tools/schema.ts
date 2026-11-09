import { hashJson } from "./hash.ts";
import {
  TOOL_RISK_TIERS,
  TOOL_TIMEOUT_POLICY,
  isToolTimeoutClass,
  type ToolManifest,
  type ToolRiskTier,
} from "./types.ts";

/**
 * Strict JSON-schema subset used by tool manifests. There is intentionally no
 * coercion, no default application, and no best-effort validation:
 *
 * - object schemas must set `additionalProperties: false`;
 * - unknown schema keywords are invalid;
 * - unknown input/output fields are rejected;
 * - recursion is bounded.
 */

const MAX_SCHEMA_DEPTH = 8;
const MAX_PATTERN_LENGTH = 200;

const JSON_SCHEMA_TYPES = [
  "object",
  "array",
  "string",
  "integer",
  "number",
  "boolean",
  "null",
] as const;

type JsonSchemaType = (typeof JSON_SCHEMA_TYPES)[number];

const COMMON_KEYWORDS = new Set(["type", "enum", "const"]);

const TYPE_KEYWORDS: Readonly<Record<JsonSchemaType, ReadonlySet<string>>> = {
  object: new Set(["properties", "required", "additionalProperties"]),
  array: new Set(["items", "minItems", "maxItems"]),
  string: new Set(["minLength", "maxLength", "pattern", "format"]),
  integer: new Set(["minimum", "maximum"]),
  number: new Set(["minimum", "maximum"]),
  boolean: new Set(),
  null: new Set(),
};

const STRING_FORMATS = new Set(["date-time", "uuid", "uri"]);

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*){1,3}$/;
const TOOL_VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const MANIFEST_KEYS = new Set([
  "name",
  "version",
  "description",
  "timeoutClass",
  "maxAttempts",
  "riskTier",
  "inputSchema",
  "outputSchema",
]);

export type SchemaValidationError = {
  path: string;
  message: string;
};

export type ManifestValidationResult =
  | { ok: true; manifest: ToolManifest; hash: string }
  | { ok: false; errors: SchemaValidationError[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonPrimitive(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function valueMatchesType(value: unknown, type: JsonSchemaType): boolean {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
  }
}

function error(
  errors: SchemaValidationError[],
  path: string,
  message: string,
): void {
  errors.push({ path, message });
}

function validateStringFormat(
  value: string,
  format: unknown,
  path: string,
  errors: SchemaValidationError[],
): void {
  if (format === undefined) return;
  if (typeof format !== "string" || !STRING_FORMATS.has(format)) {
    error(errors, `${path}.format`, "format is not in the reviewed set");
    return;
  }

  if (format === "date-time") {
    if (!DATE_TIME_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
      error(errors, path, "value is not a UTC ISO date-time");
    }
    return;
  }

  if (format === "uuid") {
    if (!UUID_PATTERN.test(value)) {
      error(errors, path, "value is not a UUID");
    }
    return;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      error(errors, path, "URI must use https");
    }
  } catch {
    error(errors, path, "value is not a valid URI");
  }
}

function validateSchemaDefinition(
  schema: unknown,
  path: string,
  depth: number,
  errors: SchemaValidationError[],
): void {
  if (depth > MAX_SCHEMA_DEPTH) {
    error(errors, path, `schema nesting exceeds ${MAX_SCHEMA_DEPTH}`);
    return;
  }

  if (!isPlainObject(schema)) {
    error(errors, path, "schema must be an object");
    return;
  }

  const type = schema.type;
  if (typeof type !== "string" || !JSON_SCHEMA_TYPES.includes(type as JsonSchemaType)) {
    error(errors, path, "schema.type is missing or unsupported");
    return;
  }
  const schemaType = type as JsonSchemaType;
  const allowed = new Set([...COMMON_KEYWORDS, ...TYPE_KEYWORDS[schemaType]]);

  for (const key of Object.keys(schema)) {
    if (!allowed.has(key)) {
      error(errors, `${path}.${key}`, "unknown schema keyword");
    }
  }

  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length === 0) {
      error(errors, `${path}.enum`, "enum must be a non-empty array");
    } else {
      const seen = new Set<string>();
      for (const [index, entry] of schema.enum.entries()) {
        if (!isJsonPrimitive(entry)) {
          error(errors, `${path}.enum[${index}]`, "enum values must be JSON primitives");
          continue;
        }
        if (!valueMatchesType(entry, schemaType)) {
          error(errors, `${path}.enum[${index}]`, "enum value does not match schema type");
        }
        const marker = JSON.stringify(entry);
        if (seen.has(marker)) {
          error(errors, `${path}.enum[${index}]`, "enum values must be unique");
        }
        seen.add(marker);
      }
    }
  }

  if (schema.const !== undefined) {
    if (!isJsonPrimitive(schema.const)) {
      error(errors, `${path}.const`, "const must be a JSON primitive");
    } else if (!valueMatchesType(schema.const, schemaType)) {
      error(errors, `${path}.const`, "const does not match schema type");
    }
  }

  switch (schemaType) {
    case "object": {
      if (schema.additionalProperties !== false) {
        error(
          errors,
          `${path}.additionalProperties`,
          "object schemas must set additionalProperties false",
        );
      }

      const properties = schema.properties;
      if (properties !== undefined && !isPlainObject(properties)) {
        error(errors, `${path}.properties`, "properties must be an object");
      } else if (isPlainObject(properties)) {
        for (const [key, child] of Object.entries(properties)) {
          validateSchemaDefinition(
            child,
            `${path}.properties.${key}`,
            depth + 1,
            errors,
          );
        }
      }

      if (schema.required !== undefined) {
        if (!Array.isArray(schema.required)) {
          error(errors, `${path}.required`, "required must be an array");
        } else {
          const seen = new Set<string>();
          for (const [index, key] of schema.required.entries()) {
            if (typeof key !== "string" || key.length === 0) {
              error(errors, `${path}.required[${index}]`, "required keys must be non-empty strings");
              continue;
            }
            if (seen.has(key)) {
              error(errors, `${path}.required[${index}]`, "required keys must be unique");
            }
            seen.add(key);
            if (!isPlainObject(properties) || !(key in properties)) {
              error(
                errors,
                `${path}.required[${index}]`,
                "required key is not declared in properties",
              );
            }
          }
        }
      }
      break;
    }

    case "array": {
      if (schema.items === undefined) {
        error(errors, `${path}.items`, "array schemas must declare items");
      } else {
        validateSchemaDefinition(schema.items, `${path}.items`, depth + 1, errors);
      }
      validateIntegerBound(schema.minItems, `${path}.minItems`, 0, errors);
      validateIntegerBound(schema.maxItems, `${path}.maxItems`, 0, errors);
      validateBoundOrder(schema.minItems, schema.maxItems, path, errors);
      break;
    }

    case "string": {
      validateIntegerBound(schema.minLength, `${path}.minLength`, 0, errors);
      validateIntegerBound(schema.maxLength, `${path}.maxLength`, 0, errors);
      validateBoundOrder(schema.minLength, schema.maxLength, path, errors);

      if (schema.pattern !== undefined) {
        if (
          typeof schema.pattern !== "string" ||
          schema.pattern.length === 0 ||
          schema.pattern.length > MAX_PATTERN_LENGTH
        ) {
          error(errors, `${path}.pattern`, "pattern is empty or too long");
        } else {
          try {
            new RegExp(schema.pattern);
          } catch {
            error(errors, `${path}.pattern`, "pattern is not a valid regular expression");
          }
        }
      }

      if (
        schema.format !== undefined &&
        (typeof schema.format !== "string" || !STRING_FORMATS.has(schema.format))
      ) {
        error(errors, `${path}.format`, "format is not in the reviewed set");
      }
      break;
    }

    case "integer":
    case "number": {
      validateNumberBound(schema.minimum, `${path}.minimum`, errors);
      validateNumberBound(schema.maximum, `${path}.maximum`, errors);
      validateBoundOrder(schema.minimum, schema.maximum, path, errors);
      break;
    }

    case "boolean":
    case "null":
      break;
  }
}

function validateIntegerBound(
  value: unknown,
  path: string,
  minimum: number,
  errors: SchemaValidationError[],
): void {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    error(errors, path, `value must be an integer >= ${minimum}`);
  }
}

function validateNumberBound(
  value: unknown,
  path: string,
  errors: SchemaValidationError[],
): void {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    error(errors, path, "value must be a finite number");
  }
}

function validateBoundOrder(
  lower: unknown,
  upper: unknown,
  path: string,
  errors: SchemaValidationError[],
): void {
  if (typeof lower === "number" && typeof upper === "number" && lower > upper) {
    error(errors, path, "minimum bound is greater than maximum bound");
  }
}

function validateValue(
  schema: unknown,
  value: unknown,
  path: string,
  errors: SchemaValidationError[],
): void {
  if (!isPlainObject(schema)) {
    error(errors, path, "schema is not an object");
    return;
  }

  const type = schema.type;
  if (typeof type !== "string" || !JSON_SCHEMA_TYPES.includes(type as JsonSchemaType)) {
    error(errors, path, "schema type is missing or unsupported");
    return;
  }
  const schemaType = type as JsonSchemaType;

  if (schema.const !== undefined && value !== schema.const) {
    error(errors, path, "value does not match const");
    return;
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((entry) => entry === value)) {
      error(errors, path, "value is not in enum");
      return;
    }
  }

  if (!valueMatchesType(value, schemaType)) {
    error(errors, path, `value must be ${schemaType}`);
    return;
  }

  switch (schemaType) {
    case "object": {
      const record = value as Record<string, unknown>;
      const properties = isPlainObject(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required) ? schema.required : [];

      for (const key of required) {
        if (typeof key === "string" && !(key in record)) {
          error(errors, `${path}.${key}`, "required field is missing");
        }
      }

      for (const [key, childValue] of Object.entries(record)) {
        if (!(key in properties)) {
          error(errors, `${path}.${key}`, "unknown field");
          continue;
        }
        validateValue(properties[key], childValue, `${path}.${key}`, errors);
      }
      break;
    }

    case "array": {
      const entries = value as unknown[];
      if (typeof schema.minItems === "number" && entries.length < schema.minItems) {
        error(errors, path, "array has fewer items than minItems");
      }
      if (typeof schema.maxItems === "number" && entries.length > schema.maxItems) {
        error(errors, path, "array has more items than maxItems");
      }
      for (const [index, entry] of entries.entries()) {
        validateValue(schema.items, entry, `${path}[${index}]`, errors);
      }
      break;
    }

    case "string": {
      const text = value as string;
      if (typeof schema.minLength === "number" && text.length < schema.minLength) {
        error(errors, path, "string is shorter than minLength");
      }
      if (typeof schema.maxLength === "number" && text.length > schema.maxLength) {
        error(errors, path, "string is longer than maxLength");
      }
      if (typeof schema.pattern === "string") {
        try {
          if (!new RegExp(schema.pattern).test(text)) {
            error(errors, path, "string does not match pattern");
          }
        } catch {
          error(errors, path, "schema pattern is invalid");
        }
      }
      validateStringFormat(text, schema.format, path, errors);
      break;
    }

    case "integer":
    case "number": {
      const numeric = value as number;
      if (typeof schema.minimum === "number" && numeric < schema.minimum) {
        error(errors, path, "number is below minimum");
      }
      if (typeof schema.maximum === "number" && numeric > schema.maximum) {
        error(errors, path, "number is above maximum");
      }
      break;
    }

    case "boolean":
    case "null":
      break;
  }
}

export function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: SchemaValidationError[] = [];

  if (!isPlainObject(manifest)) {
    return {
      ok: false,
      errors: [{ path: "manifest", message: "manifest must be an object" }],
    };
  }

  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_KEYS.has(key)) {
      error(errors, `manifest.${key}`, "unknown manifest field");
    }
  }

  if (typeof manifest.name !== "string" || !TOOL_NAME_PATTERN.test(manifest.name)) {
    error(errors, "manifest.name", "name is not a reviewed tool name");
  }
  if (
    typeof manifest.version !== "string" ||
    !TOOL_VERSION_PATTERN.test(manifest.version)
  ) {
    error(errors, "manifest.version", "version is not semantic x.y.z");
  }
  if (
    typeof manifest.description !== "string" ||
    manifest.description.trim().length < 1 ||
    manifest.description.length > 500
  ) {
    error(errors, "manifest.description", "description must be 1-500 characters");
  }
  if (!isToolTimeoutClass(manifest.timeoutClass)) {
    error(errors, "manifest.timeoutClass", "timeoutClass is not reviewed");
  }
  if (
    typeof manifest.maxAttempts !== "number" ||
    !Number.isInteger(manifest.maxAttempts) ||
    manifest.maxAttempts < 1 ||
    manifest.maxAttempts > 3
  ) {
    error(errors, "manifest.maxAttempts", "maxAttempts must be an integer 1-3");
  } else if (isToolTimeoutClass(manifest.timeoutClass)) {
    const classCap = TOOL_TIMEOUT_POLICY[manifest.timeoutClass].maxAttempts;
    if (manifest.maxAttempts > classCap) {
      error(
        errors,
        "manifest.maxAttempts",
        `maxAttempts exceeds the ${manifest.timeoutClass} class cap`,
      );
    }
  }
  if (!TOOL_RISK_TIERS.includes(manifest.riskTier as ToolRiskTier)) {
    error(errors, "manifest.riskTier", "riskTier is not reviewed");
  }

  if (
    !isPlainObject(manifest.inputSchema) ||
    manifest.inputSchema.type !== "object"
  ) {
    error(errors, "manifest.inputSchema", "inputSchema must be an object schema");
  } else {
    validateSchemaDefinition(manifest.inputSchema, "manifest.inputSchema", 0, errors);
  }

  if (
    !isPlainObject(manifest.outputSchema) ||
    manifest.outputSchema.type !== "object"
  ) {
    error(errors, "manifest.outputSchema", "outputSchema must be an object schema");
  } else {
    validateSchemaDefinition(manifest.outputSchema, "manifest.outputSchema", 0, errors);
  }

  if (errors.length > 0) return { ok: false, errors };

  try {
    return {
      ok: true,
      manifest: manifest as ToolManifest,
      hash: hashJson(manifest),
    };
  } catch {
    return {
      ok: false,
      errors: [{ path: "manifest", message: "manifest cannot be canonicalized" }],
    };
  }
}

export function validateToolInput(
  manifest: ToolManifest,
  input: unknown,
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  validateValue(manifest.inputSchema, input, "input", errors);
  return errors;
}

export function validateToolOutput(
  manifest: ToolManifest,
  output: unknown,
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  validateValue(manifest.outputSchema, output, "output", errors);
  return errors;
}

export function formatSchemaErrors(errors: readonly SchemaValidationError[]): string {
  return errors.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
}
