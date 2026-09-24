const DEVICE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const EXPO_TOKEN = /^(?:ExponentPushToken|ExpoPushToken)\[[^\]\s]{8,}\]$/;
const ALLOWED_FIELDS = new Set(["deviceId", "pushProvider", "pushToken", "platform"]);

export class DeviceError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.statusCode = 400;
    }
}

export function validateDeviceId(value) {
    return typeof value === "string" && DEVICE_ID.test(value);
}

export function validateRegistration(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new DeviceError("VALIDATION_ERROR", "Request body must be a JSON object.");
    }
    const invalid = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));
    if (invalid.length) throw new DeviceError("VALIDATION_ERROR", `Fields cannot be set by the client: ${invalid.join(", ")}.`);

    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!validateDeviceId(deviceId)) {
        throw new DeviceError("VALIDATION_ERROR", "deviceId must be a stable identifier between 8 and 128 characters.");
    }
    const pushProvider = typeof body.pushProvider === "string" ? body.pushProvider.toUpperCase() : "";
    if (pushProvider !== "EXPO") throw new DeviceError("VALIDATION_ERROR", "pushProvider must be EXPO.");

    const platform = typeof body.platform === "string" ? body.platform.toUpperCase() : "";
    if (!new Set(["IOS", "ANDROID"]).has(platform)) {
        throw new DeviceError("VALIDATION_ERROR", "platform must be IOS or ANDROID.");
    }
    const pushToken = typeof body.pushToken === "string" ? body.pushToken.trim() : "";
    if (!EXPO_TOKEN.test(pushToken) || pushToken.length > 512) {
        throw new DeviceError("INVALID_PUSH_TOKEN", "pushToken must be a valid Expo push token.");
    }

    return { deviceId, pushProvider, pushToken, platform };
}

export function deviceResponse(item) {
    return {
        deviceId: item.deviceId?.S ?? item.SK?.S?.slice("DEVICE#".length) ?? "",
        pushProvider: item.pushProvider?.S ?? "EXPO",
        platform: item.platform?.S ?? null,
        enabled: item.enabled?.BOOL === true,
        createdAt: item.createdAt?.S ?? null,
        updatedAt: item.updatedAt?.S ?? null,
        lastSeenAt: item.lastSeenAt?.S ?? null
    };
}

export function registerDeviceRequest(tableName, userId, registration, now) {
    return {
        TableName: tableName,
        Key: {
            PK: { S: `USER#${userId}` },
            SK: { S: `DEVICE#${registration.deviceId}` }
        },
        UpdateExpression: "SET #deviceId = :deviceId, #pushProvider = :pushProvider, #pushToken = :pushToken, #platform = :platform, #enabled = :true, #createdAt = if_not_exists(#createdAt, :now), #updatedAt = :now, #lastSeenAt = :now",
        ExpressionAttributeNames: {
            "#deviceId": "deviceId",
            "#pushProvider": "pushProvider",
            "#pushToken": "pushToken",
            "#platform": "platform",
            "#enabled": "enabled",
            "#createdAt": "createdAt",
            "#updatedAt": "updatedAt",
            "#lastSeenAt": "lastSeenAt"
        },
        ExpressionAttributeValues: {
            ":deviceId": { S: registration.deviceId },
            ":pushProvider": { S: registration.pushProvider },
            ":pushToken": { S: registration.pushToken },
            ":platform": { S: registration.platform },
            ":true": { BOOL: true },
            ":now": { S: now }
        },
        ReturnValues: "ALL_NEW"
    };
}

export function disableDeviceRequest(tableName, userId, deviceId, now) {
    return {
        TableName: tableName,
        Key: { PK: { S: `USER#${userId}` }, SK: { S: `DEVICE#${deviceId}` } },
        UpdateExpression: "SET #enabled = :false, #updatedAt = :now",
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        ExpressionAttributeNames: { "#enabled": "enabled", "#updatedAt": "updatedAt" },
        ExpressionAttributeValues: { ":false": { BOOL: false }, ":now": { S: now } }
    };
}
