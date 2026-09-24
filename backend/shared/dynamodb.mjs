export function stringValue(value) {
    return { S: String(value) };
}

export function numberValue(value) {
    return { N: String(value) };
}

export function booleanValue(value) {
    return { BOOL: Boolean(value) };
}
