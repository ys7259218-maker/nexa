import {
  isRetryableToolErrorClass,
  type ToolErrorClass,
  type ToolErrorShape,
} from "./types.ts";

const ERROR_CODE_PATTERN = /^[a-z][a-z0-9_]{1,60}$/;

/**
 * Typed adapter failure. The executor never trusts a raw exception message:
 * only the class, code, and retryability cross the boundary into the audit row.
 */
export class ToolError extends Error {
  readonly errorClass: ToolErrorClass;
  readonly code: string;
  readonly retryable: boolean;

  constructor(
    errorClass: ToolErrorClass,
    code: string,
    message = code,
    retryable = isRetryableToolErrorClass(errorClass),
  ) {
    super(message);
    this.name = "ToolError";
    this.errorClass = errorClass;
    this.code = ERROR_CODE_PATTERN.test(code) ? code : "tool_error";
    this.retryable = retryable;
  }
}

export function isToolError(value: unknown): value is ToolError {
  return value instanceof ToolError;
}

export function classifyToolError(error: unknown): ToolErrorShape {
  if (isToolError(error)) {
    return {
      errorClass: error.errorClass,
      code: error.code,
      retryable: error.retryable,
    };
  }

  return {
    errorClass: "INTERNAL",
    code: "unexpected_error",
    retryable: false,
  };
}
