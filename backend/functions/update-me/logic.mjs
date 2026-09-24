export class ProfilePatchError extends Error {
    constructor(code, message) {
        super(message);
        this.statusCode = 400;
        this.code = code;
    }
}

export function isValidTimeZone(value) {
    if (typeof value !== "string" || value.length < 1 || value.length > 100) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
        return true;
    } catch {
        return false;
    }
}

export function validateProfilePatch(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new ProfilePatchError("VALIDATION_ERROR", "Request body must be a JSON object.");
    }
    const allowed = new Set(["displayName", "timeZone"]);
    const unsupported = Object.keys(body).filter((key) => !allowed.has(key));
    if (unsupported.length) {
        throw new ProfilePatchError("VALIDATION_ERROR", `Field cannot be updated: ${unsupported[0]}.`);
    }
    if (!Object.keys(body).length) {
        throw new ProfilePatchError("VALIDATION_ERROR", "At least one editable field is required.");
    }

    const patch = {};
    if (Object.hasOwn(body, "displayName")) {
        if (typeof body.displayName !== "string" || !body.displayName.trim() || body.displayName.trim().length > 100) {
            throw new ProfilePatchError("INVALID_DISPLAY_NAME", "displayName must be between 1 and 100 characters.");
        }
        patch.displayName = body.displayName.trim();
    }
    if (Object.hasOwn(body, "timeZone")) {
        if (!isValidTimeZone(body.timeZone)) {
            throw new ProfilePatchError("INVALID_TIME_ZONE", "timeZone must be a valid IANA time zone.");
        }
        patch.timeZone = body.timeZone;
    }
    return patch;
}
