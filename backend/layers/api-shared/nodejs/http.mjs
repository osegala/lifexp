const JSON_HEADERS = Object.freeze({ "Content-Type": "application/json" });
const INLINE_SECRET = /((?:authorization|cookie|password|secret|token)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,}]+)/gi;

export function redactSensitiveText(value) {
    return String(value ?? "")
        .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
        .replace(/(?:Exponent|Expo)PushToken\[[^\]]+\]/gi, "[REDACTED_PUSH_TOKEN]")
        .replace(INLINE_SECRET, "$1[REDACTED]");
}

export function logUnexpectedError(message, error) {
    const record = {
        level: "ERROR",
        event: "UNEXPECTED_ERROR",
        function: process.env.AWS_LAMBDA_FUNCTION_NAME ?? "unknown",
        message: redactSensitiveText(message),
        errorName: typeof error?.name === "string" ? error.name : "Error"
    };
    console.error(record);
    return record;
}

export class ApiError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

export function jsonResponse(statusCode, body) {
    if (statusCode === 204) return { statusCode };
    return {
        statusCode,
        headers: JSON_HEADERS,
        body: JSON.stringify(body)
    };
}

export const ok = (body) => jsonResponse(200, body);
export const created = (body) => jsonResponse(201, body);
export const noContent = () => ({ statusCode: 204 });

export function errorResponse(statusCode, code, message, details) {
    const error = { code, message };
    if (details !== undefined) error.details = details;
    return jsonResponse(statusCode, { error });
}

export const badRequest = (code, message, details) => errorResponse(400, code, message, details);
export const unauthorized = (message = "Authentication is required.") =>
    errorResponse(401, "UNAUTHORIZED", message);
export const forbidden = (code = "FORBIDDEN", message = "This operation is not allowed.", details) =>
    errorResponse(403, code, message, details);
export const notFound = (code, message, details) => errorResponse(404, code, message, details);
export const conflict = (code, message, details) => errorResponse(409, code, message, details);
export const tooManyRequests = (message = "Too many requests.") =>
    errorResponse(429, "TOO_MANY_REQUESTS", message);

export function authSubject(event) {
    const subject = event?.requestContext?.authorizer?.jwt?.claims?.sub;
    return typeof subject === "string" && subject ? subject : null;
}

export function requireAuthSubject(event) {
    const subject = authSubject(event);
    if (!subject) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
    return subject;
}

export function parseJsonBody(event) {
    const raw = event?.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : event?.body;
    if (raw == null) return {};
    try {
        return JSON.parse(raw);
    } catch {
        throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
}

export function validationError(message, details) {
    return new ApiError(400, "VALIDATION_ERROR", message, details);
}

export function validateBodyFields(body, allowedFields) {
    if (!body || Array.isArray(body) || typeof body !== "object") {
        throw validationError("Request body must be a JSON object.");
    }
    const allowed = new Set(allowedFields);
    const unsupported = Object.keys(body).filter((field) => !allowed.has(field));
    if (unsupported.length) {
        throw validationError("Request contains unsupported fields.", unsupported.map((field) => ({
            field,
            code: "UNSUPPORTED_FIELD",
            message: `${field} is not supported.`
        })));
    }
    return body;
}

export function requiredString(body, field, maxLength = 128) {
    const value = typeof body?.[field] === "string" ? body[field].trim() : "";
    if (!value || value.length > maxLength) {
        throw validationError(`${field} is required and must be at most ${maxLength} characters.`, [{
            field,
            code: value ? "TOO_LONG" : "REQUIRED",
            message: `${field} is required and must be at most ${maxLength} characters.`
        }]);
    }
    return value;
}

export function apiErrorResponse(error) {
    return errorResponse(error.statusCode, error.code, error.message, error.details);
}

export function internalServerError(context, error) {
    logUnexpectedError(context, error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}

export function handleApiError(error, context) {
    return error instanceof ApiError
        ? apiErrorResponse(error)
        : internalServerError(context, error);
}
