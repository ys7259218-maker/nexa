export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body exceeds the allowed size");
    this.name = "RequestBodyTooLargeError";
  }
}

export async function readRequestTextWithLimit(
  request: Request,
  maxBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }

  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const declaredBytes = Number(contentLength);

    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}
