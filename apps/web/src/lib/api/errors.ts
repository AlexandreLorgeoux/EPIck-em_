// Body the API sends with an error (NestJS, plus `errors` per field on 400,
// and a `code` with its `reason` for some conflicts, like a locked
// prediction)
interface ErrorBody {
  message?: string | string[];
  errors?: Record<string, string[]>;
  code?: string;
  reason?: string;
}

export class ApiError extends Error {
  constructor(
    // HTTP status, 0 when the server could not be reached
    readonly status: number,
    readonly messages: string[],
    // Validation messages by field name, for forms
    readonly fieldErrors: Record<string, string[]> = {},
    // Machine-readable kind of error, when the API gives one
    readonly code?: string,
    readonly reason?: string,
  ) {
    super(messages[0] ?? `The request failed (status ${status})`);
    this.name = "ApiError";
  }

  // First message for a form field, to show next to its input
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    let body: ErrorBody = {};
    try {
      body = (await res.json()) as ErrorBody;
    } catch {
      // Not JSON (a proxy error page, for example): keep the status only
    }
    const messages = Array.isArray(body.message)
      ? body.message
      : body.message
        ? [body.message]
        : [];
    return new ApiError(
      res.status,
      messages,
      body.errors ?? {},
      body.code,
      body.reason,
    );
  }

  static network(): ApiError {
    return new ApiError(0, [
      "Cannot reach the server: check your connection and try again",
    ]);
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;
