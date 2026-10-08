import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "/opt/nodejs/http.mjs";

export const receiptKey = (userId, eventId) => ({ PK: { S: `USER#${userId}` },
    SK: { S: `AD_RECEIPT#${createHash("sha256").update(eventId).digest("hex")}` } });

/** Future provider adapter must verify a signed server callback, bound to this user/event.
 * Production has no verifier installed: neither DEV tickets nor client assertions are accepted.
 */
export function rewardVerifier(environmentName, devEnabled) {
    const available = environmentName === "dev" && devEnabled === "true";
    const requireAvailable = () => {
        if (!available) throw new ApiError(503, "AD_PROVIDER_UNAVAILABLE", "Rewarded ads are not available in this environment.");
    };
    return {
        available,
        prepare(userId, now) {
            requireAvailable();
            const eventId = `dev:${randomUUID()}`;
            return { eventId, item: { ...receiptKey(userId, eventId), providerEventId: { S: eventId },
                provider: { S: "DEV_TEST" }, status: { S: "READY" },
                expiresAt: { S: new Date(now.getTime() + 10 * 60_000).toISOString() } } };
        },
        verify({ userId, eventId, receipt, now }) {
            requireAvailable();
            if (!receipt || receipt.PK?.S !== `USER#${userId}` || receipt.providerEventId?.S !== eventId
                || receipt.provider?.S !== "DEV_TEST" || !eventId.startsWith("dev:")
                || !["READY", "GRANTED"].includes(receipt.status?.S)
                || (receipt.status.S !== "GRANTED" && !(Date.parse(receipt.expiresAt?.S) > now.getTime()))) {
                throw new ApiError(403, "AD_COMPLETION_UNVERIFIED", "The rewarded ad completion could not be verified.");
            }
            // This is explicitly a DEV simulation, not proof of a real video view.
            return receipt;
        }
    };
}
