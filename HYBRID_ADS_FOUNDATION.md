# Hybrid ads foundation — local implementation and review

2026-10-08. Existing Free/Premium and permanent cosmetic-ownership work was preserved. No AWS access, deployment, seeding, commit, push, live ads, real billing, SDK installation or dependency change.

## 1. Exact backend flow

One new handler reuses the existing JWT-authorized API, active-profile guard, API shared layer, effective entitlement normalizer, canonical `localDate` helper and single DynamoDB table.

- `GET /ads/reward`: authenticated FREE user's authoritative coins, reward amount, daily used/remaining, date, profile timezone and adapter availability.
- `POST /ads/reward/prepare` with `{}`: explicitly enabled DEV server creates a random `dev:<UUID>` receipt bound to the JWT subject, valid for ten minutes. It does not grant coins or consume allowance.
- `POST /ads/reward` with exactly `{providerEventId, rewardType: "COINS"}`: validates the existing server receipt, account and current FREE entitlement. Atomically awards exactly ten coins and consumes one allowance. Client amounts, extra body fields, fabricated receipts, another user's receipts and expired unclaimed receipts are rejected.

Incomplete onboarding is rejected; legacy profiles with a missing onboarding field retain the existing completed-user behavior. Premium is denied for status, prepare and claim. Deleted profiles cannot claim or be recreated by the reward transaction. No reward events or push tokens are logged.

## 2. DynamoDB and idempotency

All rows stay under `PK=USER#<JWT subject>`:

- `SK=AD_RECEIPT#<SHA-256(providerEventId)>`: server event ID, DEV_TEST provider, READY/GRANTED status, expiry and granted local date/time.
- `SK=AD_REWARDS#DAY#<YYYY-MM-DD>`: used count and updated time.
- Existing PROFILE: coins and updatedAt only. Existing ENTITLEMENTS is read/condition-checked, never modified.

The grant transaction has four operations: an entitlement-snapshot condition check; profile coin update conditional on existence, expected balance and unchanged timezone; daily counter conditional increment below three; and READY/unexpired receipt -> GRANTED. Either every operation commits or none does. This also prevents an intervening Premium activation, profile deletion, purchase/balance change or timezone edit from authorizing a stale grant.

Conditional/conflict failures re-read and retry up to three times. A GRANTED receipt returns `duplicate=true`, current authoritative balance/allowance and `originalGrantDate`, with no writes. GRANTED receipts remain durable after ten minutes and across day rollover. Duplicate simultaneous requests and ambiguous success-response retries cannot grant twice. The frontend retains the same receipt for a manual retry; it never substitutes a new event for an ambiguous claim.

Account deletion already removes all rows in the user partition, so no separate deletion mechanism was added. There is no new table/index, scheduler or worker.

## 3. Daily limit and timezone

Named server/client constants are `REWARDED_AD_COINS=10` and `REWARDED_AD_DAILY_LIMIT=3`: maximum 30 bonus coins per profile-local calendar date. The server's current time and stored profile IANA timezone select the bucket using the same helper as quests/scheduling; legacy missing timezone uses UTC. The client never calculates the reset from device time.

Local midnight selects another date bucket rather than resetting an old row. DST repeated hours remain in the same date; 23/25-hour days do not use a 24-hour timer. Timezone changes select the new local date, and returning to a previously used date reuses its counter. Limits are per local date, not a rolling 24-hour anti-timezone-travel rule.

Response: `{rewardCoins:10, coins, rewardedAdsUsedToday, rewardedAdsRemainingToday, date, timeZone, available}`; successful/replayed claims also include `duplicate`. A full allowance returns `429 AD_DAILY_LIMIT` with authoritative status details, never a coin grant.

Task XP/coins, quest rewards, World Points, levels, prices, equipment and permanent Premium ownership were not changed.

## 4. Frontend placements and behavior

- Home: retains one persistent DEV banner after Achievements at the bottom of dashboard content. No rewarded CTA is added to Home.
- Shop: retains one persistent DEV banner after all catalog rows, followed by the primary optional rewarded card. This avoids repeating the CTA beside task-completion controls or in both screens.

`useAds()` exposes `canShowPersistentAds`, `canUseRewardedAds`, `rewardedAdsRemainingToday`, `rewardedAdLoading`, `requestRewardedAd()`, and DEV complete/cancel/status-refresh actions. The existing BannerAdPlacement remains centralized; InterstitialAdPlacement remains inert.

AdProvider is inside the existing tabs' CompletionFeedbackProvider instead of above it, so request guards see the actual completion/achievement/building queues. Authentication/onboarding and non-tab routes have no ad provider. Within tabs, only Home/Shop can show persistent ads and only Shop enables rewarded requests. Task/appearance editors, notification/permission/account-deletion flows, World/Profile and Premium screens do not receive ads. Active or queued gameplay feedback suppresses UI and new requests.

Shop starts with an unconfirmed/disabled allowance, then reads it from the server. Status refreshes on entry, foreground resume and every 60 seconds while eligible/active; no device-local reset is invented. A tap prepares the DEV simulation; “Complete DEV rewarded ad” explicitly claims, while “Cancel DEV ad” awards nothing. In-flight buttons are disabled and synchronous phase guards block double taps. Errors retain a retryable receipt without claiming success. Exhausted status displays a disabled “Daily ad rewards claimed” button. A server-confirmed cap reached on another device also updates the exhausted state.

After a confirmed response, Shop **replaces** the displayed balance with `result.coins` and requests the existing profile refresh; it never adds ten locally. Replayed receipts likewise use the server total. Session/account changes discard late responses and pending state. Effect cleanup resets the controller safely for remount/Strict Mode.

The new card uses existing LifeCard/LifeButton primitives (48pt buttons, accessible names/disabled state), an alert for errors and polite announcement of confirmed rewards. No new motion, UI redesign or provider calls scattered across screens.

## 5. Premium and DEV/production configuration

Only confirmed, loaded FREE entitlement plus a completed authenticated profile is eligible. Premium, unconfirmed/loading/failure, logout and protected flows show neither banner nor rewarded CTA and initiate no new ad requests. Effective expired Premium can use FREE behavior, without affecting already-owned Premium cosmetics.

Frontend placeholder opt-in requires all three existing safeguards:

```sh
EXPO_PUBLIC_APP_ENV=dev EXPO_PUBLIC_ADS_MODE=placeholder npx expo start --web --clear
```

Run from `frontend`; `__DEV__` must also be true. Native uses the existing development build without `--web`. Default remains disabled. No env files were edited. This command is a testing instruction, not a command run against the configured AWS API in this pass.

Backend simulation additionally requires **both** `ENVIRONMENT_NAME=dev` and `DEV_REWARDED_ADS_ENABLED=true`. SAM parameter `DevRewardedAdsEnabled` defaults to string `"false"`. Local handler tests/harness opt in explicitly; no deployed setting was changed. With the server adapter disabled, allowance status reports `available=false` and the CTA stays disabled. An older API without these routes shows retryable/unconfirmed status, not fake rewards.

DEV mode is visibly labeled “Rewarded ad — DEV only.” The adapter calls only our authenticated API. The frontend adapter interface contains loadBanner/getRewardStatus/showRewarded/verifyRewardedCompletion; the backend verification factory is the trusted-provider replacement seam.

Production has **no real verifier**. It rejects DEV preparation/claims with `503 AD_PROVIDER_UNAVAILABLE`, even when someone sets the DEV flag true or supplies a stored DEV receipt. Arbitrary production clients cannot mint accepted successful ad views. The DEV button is a test simulation, not proof that a real video was watched.

## 6. Exact files changed in this hybrid pass

Backend:

- `backend/functions/ad-rewards/index.mjs` — new status/prepare/claim handler.
- `backend/functions/ad-rewards/logic.mjs` — new constants, accounting and transaction conditions.
- `backend/functions/ad-rewards/verification.mjs` — new fail-closed verifier and DEV receipt adapter.
- `backend/template.yaml` — one environment-scoped Lambda/log group, three JWT routes, existing-table item-scoped permissions, disabled-default DEV parameter; not deployed.
- `backend/tests/ad-rewards.test.mjs` — eleven new real-handler/SDK-mocked tests.
- `backend/tests/infrastructure.test.mjs` — registers the new handler/log group in existing contract checks.

Frontend:

- `frontend/src/ads/Ads.tsx` — extends existing shared provider/hook; new guarded reward card and lifecycle handling.
- `frontend/src/ads/adapter.ts` — new DEV API adapter/interface.
- `frontend/src/ads/rewarded.ts` — new session-scoped, duplicate-safe rewarded flow.
- `frontend/src/api/routes.ts` — status/claim and preparation paths.
- `frontend/app/(tabs)/shop.tsx` — footer reward card and authoritative balance callback.
- `frontend/app/(tabs)/_layout.tsx` — moves provider inside existing feedback context.
- `frontend/app/_layout.tsx` — removes the earlier root ad wrapper; existing route guards stay intact.
- `frontend/tests/rewarded-ads.test.mjs` — nine new controller/provider/CTA/adapter/Shop regression tests.
- `frontend/tests/entitlements-ads.test.mjs` — adapts existing mocks/footer assertions and excludes rewards from protected flows.
- `frontend/tests/frontend-api-contract.test.mjs` — verifies all three new methods against SAM.

Documentation: this report and a historical-report pointer in `MONETIZATION_FOUNDATION.md`. Earlier uncommitted monetization changes remain in the worktree; they are described separately in that foundation report. No avatar artwork/registry, economy/task logic, ownership/equip implementation, billing, dependencies or notification DRY_RUN changes in this pass.

## 7. Validation and local visual review

- Backend `node --test`: **259 passed, 0 failed** (11 added; previous foundation 248).
- Frontend `node --test`: **188 passed, 0 failed** (9 added; previous foundation 179).
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, **0 errors/0 warnings**. The only new hook warning was fixed by deriving a scalar userId outside the effect and depending on that scalar, not an omitted user object.
- `npm run validate:avatar-assets`: passed, **143 sprites**.
- `npm run audit:assets`: passed, **271 inventoried images/static references**.
- `git diff --check`: passed.

Backend tests cover three grants/fourth rejection, durable duplicate events across days, concurrent duplicate/distinct claims, lost committed responses, Premium/subscription races, disabled/prod verification, fabricated/malformed/expired/cross-account claims, local midnight, timezone changes, DST, auth/onboarding/deletion and SAM safeguards. Frontend tests cover explicit completion/cancel, allowance/cap, double taps, ambiguous retries, late-account responses, failure/malformed status, another-device cap, eligibility/no-request guards, actual DEV controls/accessibility, API bodies and server-total balance replacement.

Browser review used the real Home, Shop, TaskEditor, Onboarding, shared ad components and feedback queues, with offline local auth/API/environment/device/navigation fixtures. No actual AWS/SDK/provider/billing was used. Shop and reward controls inspected at **320, 390, 768, 1024 and 1440px**: readable wrapping, no horizontal clipping, normal scrolling for below-fold content. At 320px the long completion label wraps inside its existing button without clipping. Keyboard Tab reaches Cancel and Enter cancels correctly.

Observed: cancellation leaves 40 coins; explicit completion changes 40 -> 50 and remaining 3 -> 2; three completions reach 70/0 with the daily-limit action disabled. Premium, entitlement loading/unconfirmed failure, onboarding/task editor and active completion/building feedback show no ads. Clearing feedback restores eligible placements. Browser error log was empty. Existing shadow-style/Node TypeScript module warnings are unrelated to this feature.

Temporary screenshot evidence is outside the repo at `/private/tmp/evrenthia-entitlements-preview.d6dsZS/hybrid-reward-confirmed-390.jpg`, `hybrid-limit-390.jpg`, and `hybrid-ready-320.jpg`. The mock preview server was stopped, test tab closed and temporary viewport override reset. Harness/screenshots are optional QA artifacts, not runtime dependencies.

## 8. Caveats, real-provider gate and recommendation

**GO for local DEV review of the hybrid foundation.** Connected/live DEV API review still requires separately authorized deployment/configuration of the new routes and explicit DEV adapter opt-in; none was performed. **NO-GO for live ads or real billing.**

This pass validates handlers with an all-or-nothing conditional SDK mock, not a deployed DynamoDB/API stack or native device. Real provider, native lifecycle/VoiceOver/TalkBack and store/privacy QA remain. Status polling is bounded to eligible foreground Shop, but a request already in flight cannot be physically unsent after an entitlement/route change; guards prevent new requests and the server rechecks every grant. Pending receipts are not persisted by the client across reload: a lost response is safe to retry with the same event while this flow lives, and cannot double-grant later, but reload may discard its local retry UI.

Durable granted receipt/daily-counter rows have no TTL to preserve idempotency. Expired unclaimed DEV receipts are retained too; no automatic pruning job was added to this foundation. Production provider-event retention/cleanup, request rate limiting/abuse monitoring and any stricter timezone-change policy should be decided before live rollout.

Before real SDK integration: choose an Expo-compatible provider, implement and test signed server-side completion verification bound to this user/event, provider callback replay protection, test ad units, consent/age/privacy/store-policy gates before SDK initialization, ad lifecycle/error handling, native-device tests and observability without sensitive event/token logging. Replace the DEV verifier/adapter behind the existing boundaries; never enable production DEV receipts or client-asserted completion. Interstitials and real billing remain separate, disabled work.

Ponytail kept this scoped to existing API/table/ad boundaries without new dependencies/services; the frontend UI workflow kept the existing components, accessible controls and narrow-screen layout instead of redesigning the app.
