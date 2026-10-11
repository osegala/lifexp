import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes, randomUUID, verify } from "node:crypto";
import { ApiError } from "/opt/nodejs/http.mjs";
import { receiptKey } from "./verification.mjs";
import { devDiagnostics } from "./diagnostics.mjs";

const reject = () => new ApiError(403, "AD_COMPLETION_UNVERIFIED", "The rewarded ad completion could not be verified.");
const unavailable = () => new ApiError(503, "AD_PROVIDER_UNAVAILABLE", "Rewarded ads are unavailable.");
const GOOGLE_KEYS = "https://www.gstatic.com/admob/reward/verifier-keys.json";
export const transactionKey = id => ({ PK: { S: `AD_TRANSACTION#${createHash("sha256").update(id).digest("hex")}` }, SK: { S: "GRANTED" } });

export function admobVerifier(env, request = fetch) {
    const log = devDiagnostics(env.ENVIRONMENT_NAME);
    const secret = Buffer.from(env.ADMOB_CLAIM_SECRET ?? "", "base64");
    const units = { IOS: env.ADMOB_IOS_REWARDED_UNIT_ID, ANDROID: env.ADMOB_ANDROID_REWARDED_UNIT_ID };
    const available = env.ADMOB_SSV_ENABLED === "true" && secret.length === 32
        && (env.ENVIRONMENT_NAME === "dev" || env.ADMOB_LIVE_ENABLED === "true")
        && Object.values(units).some(v => /^ca-app-pub-\d+\/\d+$/.test(v ?? ""));
    let keys = new Map(), fetchedAt = 0, fetching;
    const requireAvailable = () => { if (!available) throw unavailable(); };
    const decodeClaim = (eventId, callback = false) => {
        requireAvailable();
        let reason = "CLAIM_FORMAT_INVALID";
        try {
            if (typeof eventId !== "string" || !/^adm:[A-Za-z0-9_-]{40,1000}$/.test(eventId)) throw reject();
            reason = "CLAIM_AUTH_FAILED";
            const bytes = Buffer.from(eventId.slice(4), "base64url");
            const decipher = createDecipheriv("aes-256-gcm", secret, bytes.subarray(0, 12));
            decipher.setAAD(Buffer.from("EVRENTHIA_ADMOB_COINS_V1"));
            decipher.setAuthTag(bytes.subarray(12, 28));
            const plaintext = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString();
            reason = "CLAIM_JSON_INVALID";
            const claim = JSON.parse(plaintext);
            reason = "CLAIM_REQUIRED_FIELD_MISSING";
            const required = typeof claim?.userId === "string" && Boolean(claim.userId) && typeof claim?.binding === "string";
            if (!required) throw reject();
            reason = "CLAIM_TIMESTAMP_INVALID";
            if (!Number.isSafeInteger(claim.expires)) throw reject();
            return claim;
        } catch {
            if (callback) log("admob_ssv.claim_rejected", { stage: "decode", reason });
            throw reject();
        }
    };
    return {
        available,
        prepare(userId, now, platform) {
            requireAvailable();
            const unit = units[platform];
            if (!/^ca-app-pub-\d+\/\d+$/.test(unit ?? "")) throw unavailable();
            const expires = now.getTime() + 10 * 60_000, binding = randomUUID(), iv = randomBytes(12);
            const cipher = createCipheriv("aes-256-gcm", secret, iv);
            cipher.setAAD(Buffer.from("EVRENTHIA_ADMOB_COINS_V1"));
            const encrypted = Buffer.concat([cipher.update(JSON.stringify({ userId, binding, expires })), cipher.final()]);
            const eventId = `adm:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
            return { eventId, binding, adUnitId: unit, item: { ...receiptKey(userId, eventId), providerEventId: { S: eventId },
                provider: { S: "ADMOB" }, binding: { S: binding }, adUnitId: { S: unit }, status: { S: "READY" },
                expiresAt: { S: new Date(expires).toISOString() } } };
        },
        claim(userId, eventId, receipt, now, callbackAdUnit) {
            const claim = decodeClaim(eventId, callbackAdUnit !== undefined);
            const valid = !(claim.userId !== userId || receipt?.PK?.S !== `USER#${userId}` || receipt?.providerEventId?.S !== eventId
                || receipt?.provider?.S !== "ADMOB" || receipt?.binding?.S !== claim.binding
                || !["READY", "GRANTED"].includes(receipt.status?.S)
                || (receipt.status.S !== "GRANTED" && (claim.expires <= now.getTime() || Date.parse(receipt.expiresAt?.S) <= now.getTime())));
            if (!valid && callbackAdUnit !== undefined) {
                log("admob_ssv.claim_rejected", { stage: "receipt", reason:
                    claim.userId !== userId ? "CLAIM_USER_INVALID" : !receipt ? "CLAIM_RECEIPT_MISSING"
                    : receipt.PK?.S !== `USER#${userId}` ? "CLAIM_USER_INVALID"
                    : receipt.providerEventId?.S !== eventId ? "CLAIM_EVENT_INVALID"
                    : receipt.provider?.S !== "ADMOB" ? "CLAIM_PROVIDER_INVALID"
                    : receipt.binding?.S !== claim.binding ? "CLAIM_BINDING_INVALID"
                    : !["READY", "GRANTED"].includes(receipt.status?.S) ? "CLAIM_STATUS_INVALID" : "CLAIM_EXPIRED" });
            }
            if (!valid) throw reject();
            return receipt;
        },
        async verifyCallback(rawQuery, now) {
            let signatureVerified = false, reason = "PROVIDER_UNAVAILABLE";
            try {
                requireAvailable();
                reason = "CALLBACK_FORMAT_INVALID";
                if (typeof rawQuery !== "string" || rawQuery.length > 5000) throw reject();
                // Match Google's URI.getQuery(): percent-decode once, preserving order and literal '+'.
                let decodedQuery;
                try { decodedQuery = decodeURIComponent(rawQuery); } catch { throw reject(); }
                const signatureIndex = decodedQuery.indexOf("&signature=");
                if (signatureIndex <= 0) throw reject();
                const signedContent = Buffer.from(decodedQuery.slice(0, signatureIndex), "utf8");
                // The signature is already percent-decoded; signature/key_id must be the final two parameters.
                const match = decodedQuery.slice(signatureIndex + 1).match(/^signature=([A-Za-z0-9_=-]+)&key_id=(\d+)$/);
                if (!match) throw reject();
                const parameters = new URLSearchParams(rawQuery);
                reason = "DUPLICATE_PARAMETERS";
                if ([...parameters.keys()].some((k, i, all) => all.indexOf(k) !== i)) throw reject();
                reason = "MISSING_REWARD_FIELDS";
                for (const field of ["ad_network", "ad_unit", "reward_amount", "reward_item", "timestamp", "transaction_id"]) {
                    if (!parameters.get(field)) throw reject();
                }
                const timestamp = Number(parameters.get("timestamp"));
                reason = "TIMESTAMP_INVALID";
                if (!Number.isSafeInteger(timestamp) || timestamp > now.getTime() + 60_000 || timestamp < now.getTime() - 10 * 60_000) throw reject();
                const keyId = match[2];
                reason = "KEYS_UNAVAILABLE";
                if (now.getTime() - fetchedAt >= 6 * 60 * 60_000 || (!keys.has(keyId) && now.getTime() - fetchedAt > 60_000)) {
                    if (!fetching) fetching = (async () => {
                        try {
                            const response = await request(GOOGLE_KEYS, { signal: AbortSignal.timeout(4000), redirect: "error" });
                            if (!response.ok) throw unavailable();
                            const data = await response.json();
                            if (!Array.isArray(data.keys) || data.keys.length > 20) throw unavailable();
                            const updated = new Map();
                            for (const entry of data.keys) {
                                const key = createPublicKey(entry.pem);
                                if (key.asymmetricKeyType !== "ec") throw unavailable();
                                updated.set(String(entry.keyId), key);
                            }
                            keys = updated; fetchedAt = now.getTime();
                        } catch { throw unavailable(); }
                        finally { fetching = undefined; }
                    })();
                    await fetching;
                }
                const publicKey = keys.get(keyId);
                reason = "KEY_ID_UNKNOWN";
                if (!publicKey) throw reject();
                let valid = false;
                reason = "ECDSA_INVALID";
                try {
                    const signature = Buffer.from(match[1], "base64url");
                    valid = verify("sha256", signedContent, { key: publicKey, dsaEncoding: "der" }, signature);
                } catch { /* Invalid signature. */ }
                if (!valid) throw reject();
                signatureVerified = true;
                const eventId = parameters.get("custom_data");
                // Only absent/empty claim data is a signed probe; non-empty invalid claims still fail closed.
                if (eventId === null || eventId === "") return { probe: true };
                const claim = decodeClaim(eventId, true);
                const bindingValid = parameters.get("user_id") === claim.binding;
                const rewardAmountValid = parameters.get("reward_amount") === "10", rewardItemValid = parameters.get("reward_item") === "coins";
                const transactionIdValid = parameters.get("transaction_id").length <= 200;
                const claimReason = !bindingValid ? "CLAIM_BINDING_INVALID" : !rewardAmountValid ? "REWARD_AMOUNT_INVALID"
                    : !rewardItemValid ? "REWARD_ITEM_INVALID" : !transactionIdValid ? "TRANSACTION_ID_INVALID" : null;
                if (claimReason) {
                    log("admob_ssv.claim_rejected", { stage: "callback", reason: claimReason });
                    throw reject();
                }
                return { userId: claim.userId, eventId, adUnit: parameters.get("ad_unit"), transactionId: parameters.get("transaction_id") };
            } catch (error) {
                if (!signatureVerified) log("admob_ssv.signature_failed", { reason });
                throw error;
            }
        }
    };
}
