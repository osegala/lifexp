/** Only pass constructed metadata here, never events, records, query values or Error objects. */
export const devDiagnostics = environment => (event, fields = {}) => {
    if (environment === "dev") console.info({ event, ...fields });
};

const safeReasons = new Set([
    "UNAUTHORIZED", "ACCOUNT_NOT_FOUND", "ONBOARDING_REQUIRED", "REWARDED_AD_FREE_ONLY",
    "METHOD_NOT_ALLOWED", "VALIDATION_ERROR", "AD_PROVIDER_UNAVAILABLE", "AD_COMPLETION_UNVERIFIED",
    "AD_DAILY_LIMIT", "AD_REWARD_CONFLICT", "TransactionCanceledException", "TransactionConflictException",
    "ProvisionedThroughputExceededException", "ThrottlingException"
]);
export const diagnosticReason = error => safeReasons.has(error?.code) ? error.code
    : safeReasons.has(error?.name) ? error.name : "INTERNAL_ERROR";
