export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export function apiError(error: unknown, fallback: string): ApiErrorBody {
  const body = (error as { response?: { data?: { error?: unknown } } })
    ?.response?.data?.error;

  if (
    body &&
    typeof body === "object" &&
    typeof (body as ApiErrorBody).code === "string" &&
    typeof (body as ApiErrorBody).message === "string"
  ) {
    return body as ApiErrorBody;
  }

  return { code: "REQUEST_FAILED", message: fallback };
}
