# Free/Premium entitlements and ads foundation

Historical foundation/policy report. The subsequent hybrid-ad implementation, current file manifest, checks and integration gates are documented in [HYBRID_ADS_FOUNDATION.md](HYBRID_ADS_FOUNDATION.md); that report supersedes the ad-placement/provider and test-count descriptions below. Permanent Premium cosmetic ownership remains unchanged.

Local implementation/review, 2026-10-07; ownership policy and DEV ad visibility updated 2026-10-08. No AWS access, deployment, seeding, commit, push, live ads, or billing was performed.

## 1. Existing architecture

Reuses JWT-authenticated `GET /entitlements`, the active-player guard, and the existing strongly consistent DynamoDB read at `PK=USER#<JWT sub>`, `SK=ENTITLEMENTS`. Records already have `plan`, `subscriptionStatus`, `expiresAt`, `autoRenew`, and optional provider/transaction information. There is no trusted Apple/Google ingestion. The existing DEV entitlement script is dry-run by default and was not run.

AuthSession previously coupled profile and entitlement requests with Promise.all, used a permissive status check, and Shop fetched a second entitlement copy. The existing AuthContext now holds the one session-scoped entitlement source. Existing API shared layers and permissions already support the new reads; no infrastructure or table changes were necessary. No ad/IAP SDK was installed, and no dependency was added.

## 2. Canonical model

The effective response always contains `plan`, `premium`, `subscriptionStatus`, `adsEnabled`, `expiresAt`, `autoRenew`, and `source`.

| Condition (server time) | Effective plan | Premium | Ads eligible |
| --- | --- | --- | --- |
| Missing record / FREE / invalid plan or expiry / unsupported status | FREE | false | true |
| PREMIUM, ACTIVE or GRACE_PERIOD, unexpired | PREMIUM | true | false |
| PREMIUM, CANCELED, valid future expiry | PREMIUM | true | false |
| Expired premium date or EXPIRED status | FREE (EXPIRED status) | false | true |

ACTIVE/GRACE_PERIOD with null expiry remains supported for existing administrative records. CANCELED requires a future expiry and cannot auto-renew. Source is NONE, APPLE, GOOGLE, ADMIN, or TEST; existing DEVELOPMENT providers map to TEST. Unknown sources map to NONE. Expired/free responses use source NONE. Derived premium/ads booleans are not persisted or trusted from the record. Transaction IDs are not returned.

## 3. Authority and optional premium cosmetics

`readEntitlement`, `isPremium`, `shouldShowAds`, and `requirePremium` share the effective model. `requirePremium` reads the current user's record freshly and strongly consistently for each new premium purchase. Normal PATCH /me and purchase/equip bodies cannot set entitlement fields. No new public grant endpoint exists.

Catalog items may optionally store `requiresPremium: { BOOL: true }`. This controls **purchase eligibility only**, not ongoing ownership or use. Purchase-item checks the server catalog and normal purchase rules, then requires current Premium before creating a new premium ownership record in the existing coin/ownership transaction. An already-owned purchase retry retains the existing ITEM_ALREADY_OWNED conflict and cannot charge again. FREE items do not incur an extra entitlement read. No existing catalog item was changed to premium; no seed data changed.

Ownership is permanent: no subscription link or expiry/TTL is attached to inventory. Expiration neither deletes items nor auto-unequips equipment. Equip-item retains ownership, catalog/category and existing active-item validation, but performs no entitlement read or Premium check. FREE and expired users can equip, unequip and re-equip owned premium cosmetics. Account deletion still removes the account partition, including ownership. GET /inventory remains independent of entitlements. GET /shop reports owned premium items as OWNED with their premium requirement satisfied and no PREMIUM lock; unowned premium items still require Premium to buy. Resubscribing permits purchases of newly released premium items without replacing earlier ownership.

## 4. Billing integration seam

Future authenticated, verified Apple/Google ingestion must write the existing ENTITLEMENTS record, not create another entitlement table or accept client premium flags. Verify store events/transactions server-side, bind purchases to the authenticated account, make updates idempotent and resilient to out-of-order renewal/cancellation/refund events, and derive expiry/status from verified store data. Store transaction identifiers remain private. After a genuine purchase/restore, the client should call the existing shared `refresh()` hook and trust the resulting GET response. None of that ingestion is implemented or simulated here.

## 5. Ad abstraction and rules

`AdProvider`, `useAds`, `BannerAdPlacement`, and inactive `InterstitialAdPlacement` centralize presentation. Only disabled and development-placeholder modes exist; there is no live adapter or frequency policy.

Placeholders require all three: `EXPO_PUBLIC_ADS_MODE=placeholder`, the existing `dev` app environment (`EXPO_PUBLIC_APP_ENV=dev`), and `__DEV__`. The default is disabled, and a production build or production environment cannot activate placeholders. No environment file was changed to enable ads automatically. From the existing configured frontend directory, restart Metro after opting in:

```sh
cd /Users/owensegala/Productivity/productivity/frontend
EXPO_PUBLIC_APP_ENV=dev EXPO_PUBLIC_ADS_MODE=placeholder npx expo start --web --clear
```

For native testing, omit `--web` and open the existing local development build. Unset EXPO_PUBLIC_ADS_MODE or set it to disabled to hide the markers. This flag cannot grant FREE/PREMIUM status; only a confirmed FREE entitlement makes a marker eligible. Fully offline review uses the existing local mocked preview/test fixtures rather than contacting the configured DEV backend.

One HOME banner is the final child of Dashboard's ScrollView, after the Achievements card (below avatar/XP, quests/streak and World Points). One SHOP banner is the final child of Shop's ScrollView, after the Premium section and all catalog item rows. Both may require scrolling to the bottom. They now show a high-contrast, dashed accent border on the existing cardLight surface, a minimum 100pt height, the label “Ad placement — DEV only”, and a Home/Shop banner subtitle explicitly stating no ad network is connected. Text wraps on narrow screens; accessible labels identify the placement. There is no interactive ad or animation.

The component requires a confirmed FREE server entitlement with adsEnabled=true, a loaded authenticated completed-onboarding user, a matching route, and no active/queued completion or building feedback. It returns null for Premium, unknown/loading/failed status, logout, onboarding, authentication, Avatar/AppearanceEditor, tasks/editors, Profile/notification flows, World, or Premium. Interstitials always return null; none were added or activated. No task titles, profile content, identifiers, telemetry, or other private data are sent anywhere by the ad foundation.

Future SDK initialization, ad requests, privacy/consent policy, and consent revocation belong behind this provider boundary and must use the same eligibility guards before initialization/requesting, not merely before drawing a banner. No legal/consent behavior was invented.

## 6. Premium/Profile UX

Profile shows Free Plan + Upgrade to Premium, or Premium + Ad-free + View Premium from the shared server response. Shop has a View Premium entry point. The protected `/premium` route shows benefits, current/checking/unconfirmed status, a disabled Purchases unavailable button, a working entitlement-refresh control, and Back to Profile. Purchase and restore are explicitly unavailable until verified store integration exists. No fake purchase, local premium toggle, or Restore Purchases control exists in runtime code.

## 7. Loading, failure, logout and deletion

Entitlements load independently after authentication and refresh through existing foreground/online/profile refreshes and the Premium screen. Concurrent requests for one session revision deduplicate. Pending requests cannot hold up profile loading or onboarding routing. Loading or failure renders no ad. Failure resets entitlement UI privilege to FREE/unconfirmed, displays a recoverable error on Profile/Premium, and keeps the core account usable. No device-local expiry calculation grants or revokes server status.

Entitlements live only in AuthSession memory. Logout, auth expiry, and account deletion reset them; session revision guards reject late responses from signed-out/previous accounts. Existing server partition deletion already removes ENTITLEMENTS together with profile, tasks, ownership, and device rows. Ad state is derived from the current auth/entitlement state, with no separate user cache or network state to retain.

## 8. Local/test preview and visual review

The committed tests contain FREE/PREMIUM fixtures and mock every backend SDK operation; the local browser harness was outside the repository at `/private/tmp/evrenthia-entitlements-preview.d6dsZS`. Its plan buttons are test-only mocks, not production controls. API, auth, environment, permission/device, navigation, and icon adapters are local replacements; real Home, Shop, Profile, Premium, Onboarding, TaskEditor, ad components, and completion queues were rendered. No Cognito, AWS, ad network or store was contacted.

Reviewed FREE Home/Shop placeholders below content, FREE Profile and Premium navigation, PREMIUM Home/Shop without banners, PREMIUM Profile Ad-free, loading/failure states, onboarding and task creation without ads, completion feedback without banners, and queued-building-feedback suppression. Existing unit tests exercise actual building queue sequencing and reduced-motion presentation. Browser review also confirmed reduced-motion completion displays final values without ads and no new animation was introduced.

Responsive screenshots/layout checks covered 320px, 390px, 768px, 1024px, and 1440px. Premium retains a centered 680px maximum content width. Shop header copy and item rows were minimally allowed to wrap after real overflow was found on small widths. Keyboard Tab reaches Back to Profile from Refresh plan; new buttons retain existing 48pt targets/labels, Buy buttons now have explicit names/disabled state, errors have alert roles, and the placeholder is labeled development-only. Full native VoiceOver/TalkBack and device/store review remain for DEV testing. The mocked cosmetic previews use fallback icons, so this review does not claim new artwork validation.

The ownership/visibility pass re-reviewed the actual shared banner in the same offline harness: Home after Achievements and Shop after catalog at 390px, readable wrapping at 320px, and 100pt markers without overflow at 768/1024/1440px. Premium, loading and unconfirmed/failure states had no marker; queued building feedback suppressed it and clearing feedback restored it. Existing component/feedback tests also verify onboarding, task editor and completion suppression. Browser error logs were empty. Screenshot evidence is outside the repo at `dev-home-marker-390.jpg` and `dev-shop-marker-390.jpg` in the harness directory.

## 9. Validation

- Backend `node --test`: 248 passed, 0 failed (15 added to the pre-foundation baseline; this policy pass adds six lifecycle tests and removes the obsolete entitlement-on-equip test).
- Frontend `node --test`: 179 passed, 0 failed (14 added to the pre-foundation baseline; this pass adds explicit DEV marker/placement/safety coverage).
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, 0 errors/0 warnings.
- `npm run validate:avatar-assets`: passed, 143 registered sprites.
- `npm run audit:assets`: passed, 271 inventoried images and static runtime references.
- `git diff --check`: passed.

Node emits the existing MODULE_TYPELESS_PACKAGE_JSON warning when directly loading TypeScript tests; package module mode was not changed. Browser console has the existing React Native Web shadow-style deprecation, not a new runtime error.

## 10. Exact files changed

Backend (9):

- `backend/layers/api-shared/nodejs/entitlements.mjs` — shared existing-record normalization/read/guards (new).
- `backend/functions/get-entitlements/index.mjs` — shared effective read.
- `backend/functions/get-entitlements/logic.mjs` — compatibility re-export, removing duplicated logic.
- `backend/functions/get-shop/index.mjs` — optional catalog gate and server entitlement read.
- `backend/functions/get-shop/logic.mjs` — premium purchase-lock metadata, satisfied for permanent owned items.
- `backend/functions/purchase-item/index.mjs` — fresh gate and canonical error handling.
- `backend/functions/equip-item/index.mjs` — canonical error handling; removed the earlier entitlement gate, leaving ownership-based equip.
- `backend/tests/entitlements.test.mjs` — updated canonical response assertions.
- `backend/tests/premium-access.test.mjs` — real handler mocks, bypass/freshness/free-item/deletion and permanent ownership/expiry/re-equip/resubscription lifecycle tests (new).

Frontend (19):

- `frontend/src/entitlements/model.ts` — validates canonical/legacy server responses (new).
- `frontend/src/entitlements/useEntitlements.ts` — shared AuthSession hook (new).
- `frontend/src/ads/model.ts` — build/environment mode and route rules (new).
- `frontend/src/ads/Ads.tsx` — provider, clearly labeled/high-contrast DEV banner and inactive interstitial (new).
- `frontend/src/auth/session.ts` — independent deduplicated fetch, safe fallback, account isolation/reset.
- `frontend/src/context/AuthContext.tsx` — exposes refreshEntitlements.
- `frontend/src/context/CompletionFeedbackContext.tsx` — read-only feedback-active context for ad suppression; existing queue/reward behavior unchanged.
- `frontend/src/types/index.ts` — canonical entitlement and optional catalog types.
- `frontend/app/_layout.tsx` — AdProvider and authenticated/completed-onboarding Premium route.
- `frontend/app/premium.tsx` — safe unavailable-purchase screen (new).
- `frontend/app/(tabs)/dashboard.tsx` — one bottom banner.
- `frontend/app/(tabs)/shop.tsx` — shared entitlement state, premium entry/lock text, bottom banner, narrow-screen wrapping/accessibility fix.
- `frontend/app/(tabs)/profile.tsx` — plan section/entry point.
- `frontend/tsconfig.json` — allows the explicit .ts import needed for direct Node test resolution; noEmit validation retained.
- `frontend/tests/auth-session.test.mjs` — loading/failure/reset/late-response and non-blocking profile tests.
- `frontend/tests/entitlements-ads.test.mjs` — actual provider/screen fixtures, DEV marker visibility and guards (new).
- `frontend/tests/completion-feedback.test.mjs` — new import mock and completion/building suppression coverage.
- `frontend/tests/frontend-api-contract.test.mjs` — verifies shared hook rather than duplicate Shop fetch.
- `frontend/tests/onboarding.test.mjs` — provider mock and protected Premium-route coverage.

Documentation: `MONETIZATION_FOUNDATION.md` (this report). No PNG, avatar geometry, notification DRY_RUN, XP/quest reward, task functionality, building progression, catalog seed, environment pin, dependency, infrastructure, or unrelated route changes.

## 11. Caveats and next gates

GO for live DEV review of this foundation; NO-GO for selling subscriptions or enabling live ads.

Before real billing: implement trusted store verification, signed server notifications, account binding, replay/order protection, renewal/cancel/refund/grace handling, store configuration/products, native purchase/restore UI, sandbox-device tests and monitoring. Current server-written administrative/TEST records are not proof of store verification.

Before live ads: choose an Expo-compatible SDK and production provider adapter, define approved privacy/consent/age/store-policy handling, block SDK requests until consent and confirmed FREE eligibility, implement lifecycle cleanup/refresh, configure test ad units, and complete native QA. Any interstitial policy is separate future product work, not enabled by this foundation.

Premium cosmetic policy is now settled: Premium gates new purchases only; ownership and owned-item equip survive expiration permanently. Existing free cosmetics remain fully unchanged. Purchase checks use a fresh read at action time; future billing revocation-sensitive operations may need an atomic entitlement condition appropriate to their risk. Real billing and live ads are still unavailable.

This policy pass changes only purchase-item, equip-item, get-shop/logic, their existing premium test fixture, Ads.tsx, its existing tests, and this report. Inventory, unequip, account deletion, catalog records, dependencies, entitlement model, ad eligibility guards, screen placements and all avatar assets were not changed.

Temporary local harness/screenshots are optional QA artifacts outside the repo, not runtime dependencies. No automatic cleanup of existing artwork/script folders was performed.
