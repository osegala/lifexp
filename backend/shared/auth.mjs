export function cognitoSub(event) {
    return event?.requestContext?.authorizer?.jwt?.claims?.sub ?? null;
}
