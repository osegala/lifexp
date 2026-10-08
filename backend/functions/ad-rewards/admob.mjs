import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes, randomUUID, verify } from "node:crypto";
import { ApiError } from "/opt/nodejs/http.mjs";
import { receiptKey } from "./verification.mjs";

const reject = () => new ApiError(403, "AD_COMPLETION_UNVERIFIED", "The rewarded ad completion could not be verified.");
const unavailable = () => new ApiError(503, "AD_PROVIDER_UNAVAILABLE", "Rewarded ads are unavailable.");
const GOOGLE_KEYS = "https://www.gstatic.com/admob/reward/verifier-keys.json";
export const transactionKey = id => ({ PK: { S: `AD_TRANSACTION#${createHash("sha256").update(id).digest("hex")}` }, SK: { S: "GRANTED" } });

export function admobVerifier(env, request = fetch) {
    const secret = Buffer.from(env.ADMOB_CLAIM_SECRET ?? "", "base64");
    const units = { IOS: env.ADMOB_IOS_REWARDED_UNIT_ID, ANDROID: env.ADMOB_ANDROID_REWARDED_UNIT_ID };
    const available = env.ADMOB_SSV_ENABLED === "true" && secret.length === 32
        && (env.ENVIRONMENT_NAME === "dev" || env.ADMOB_LIVE_ENABLED === "true")
        && Object.values(units).some(v => /^ca-app-pub-\d+\/\d+$/.test(v ?? ""));
    let keys = new Map(), fetchedAt = 0, fetching;
    const requireAvailable = () => { if (!available) throw unavailable(); };
    const decodeClaim = eventId => {
        requireAvailable();
        try {
            if (typeof eventId !== "string" || !/^adm:[A-Za-z0-9_-]{40,1000}$/.test(eventId)) throw reject();
            const bytes = Buffer.from(eventId.slice(4), "base64url");
            const decipher = createDecipheriv("aes-256-gcm", secret, bytes.subarray(0, 12));
            decipher.setAAD(Buffer.from("EVRENTHIA_ADMOB_COINS_V1"));
            decipher.setAuthTag(bytes.subarray(12, 28));
            const claim = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
            if (typeof claim.userId !== "string" || !claim.userId || typeof claim.binding !== "string"
                || !Number.isSafeInteger(claim.expires)) throw reject();
            return claim;
        } catch { throw reject(); }
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
        claim(userId, eventId, receipt, now) {
            const claim = decodeClaim(eventId);
            if (claim.userId !== userId || receipt?.PK?.S !== `USER#${userId}` || receipt?.providerEventId?.S !== eventId
                || receipt?.provider?.S !== "ADMOB" || receipt?.binding?.S !== claim.binding
                || !["READY", "GRANTED"].includes(receipt.status?.S)
                || (receipt.status.S !== "GRANTED" && (claim.expires <= now.getTime() || Date.parse(receipt.expiresAt?.S) <= now.getTime()))) throw reject();
            return receipt;
        },
        async verifyCallback(rawQuery, now) {
            requireAvailable();
            if (typeof rawQuery !== "string" || rawQuery.length > 5000) throw reject();
            // Google signs these original bytes, not URLSearchParams.toString() or a sorted/re-encoded query.
            const match = rawQuery.match(/^(.+)&signature=([A-Za-z0-9_%=-]+)&key_id=(\d+)$/);
            if (!match) throw reject();
            const parameters = new URLSearchParams(rawQuery);
            if ([...parameters.keys()].some((k, i, all) => all.indexOf(k) !== i)) throw reject();
            for (const field of ["ad_network", "ad_unit", "custom_data", "reward_amount", "reward_item", "timestamp", "transaction_id", "user_id"]) {
                if (!parameters.get(field)) throw reject();
            }
            const timestamp = Number(parameters.get("timestamp"));
            if (!Number.isSafeInteger(timestamp) || timestamp > now.getTime() + 60_000 || timestamp < now.getTime() - 10 * 60_000) throw reject();
            const keyId = match[3];
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
            if (!publicKey) throw reject();
            let valid = false;
            try { valid = verify("sha256", Buffer.from(match[1]), publicKey, Buffer.from(decodeURIComponent(match[2]), "base64url")); } catch { /* Invalid signature. */ }
            if (!valid) throw reject();
            const eventId = parameters.get("custom_data"), claim = decodeClaim(eventId);
            if (parameters.get("user_id") !== claim.binding || parameters.get("reward_amount") !== "10"
                || parameters.get("reward_item") !== "coins" || parameters.get("transaction_id").length > 200) throw reject();
            return { userId: claim.userId, eventId, adUnit: parameters.get("ad_unit"), transactionId: parameters.get("transaction_id") };
        }
    };
}
