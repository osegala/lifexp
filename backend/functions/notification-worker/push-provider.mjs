const EXPO_URL = "https://exp.host/--/api/v2/push/send";

export function deliveryMode(environment = process.env) {
    return environment.PUSH_DELIVERY_MODE === "LIVE" ? "LIVE" : "DRY_RUN";
}

export function createExpoProvider({
    mode = deliveryMode(),
    fetchImpl = globalThis.fetch
} = {}) {
    return {
        mode,
        async send({ token, title, body, data }) {
            if (mode !== "LIVE") return { status: "PREPARED", errorCode: null };

            try {
                const response = await fetchImpl(EXPO_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({ to: token, title, body, data })
                });
                if (!response.ok) return { status: "FAILED", errorCode: `HTTP_${response.status}` };
                const result = await response.json();
                const ticket = Array.isArray(result.data) ? result.data[0] : result.data;
                if (ticket?.status === "error") {
                    return {
                        status: "FAILED",
                        errorCode: String(ticket.details?.error ?? "EXPO_ERROR").slice(0, 100)
                    };
                }
                return { status: "SENT", errorCode: null };
            } catch {
                return { status: "FAILED", errorCode: "NETWORK_ERROR" };
            }
        }
    };
}
