# Real monetization integration

Local implementation and validation, 2026-10-08. Nothing was deployed. No AWS, real store purchases, live ads, billing credentials, or customer data were accessed. Live ads and billing remain opt-in and unconfigured.

## 1. RevenueCat architecture and audit

The existing Cognito AuthSession, `GET /entitlements`, `USER#<sub>/ENTITLEMENTS`, Premium screen, cosmetic purchase gating and permanent inventory remain authoritative. RevenueCat supplies verified subscription facts to that record; its client CustomerInfo is never an authorization input. No new table, paywall SDK or parallel entitlement model was added.

Native dependency: `react-native-purchases` **10.12.1**. Ad dependency: `react-native-google-mobile-ads` **17.2.0**. Only those two direct dependencies were added, with exact versions and lockfile updates. Installed Expo **57.0.21**, React Native **0.86.3**, React **19.2.3** and existing expo-dev-client are preserved. The ad package requires RN 0.86+/new architecture; native compilation still needs device/build validation.

## 2. Exact entitlement lifecycle

Authenticated `POST /billing/sync` accepts an empty object only. The backend fetches RevenueCat REST v2 using a server secret, validates the configured project/internal entitlement ID with lookup key `premium`, exact customer ID, environment, subscription entitlement, allowlisted product/store, product app ID/type/store identifier, access flag and future expiry. Sandbox cannot authorize a non-DEV backend.

The existing canonical response remains `{plan, premium, adsEnabled, source, expiresAt, subscriptionStatus, autoRenew}`.

- Verified access + future expiry: PREMIUM/APPLE or GOOGLE; ads off; new Premium cosmetics purchasable.
- Canceled but paid through expiry: CANCELED/PREMIUM until that expiry.
- Grace period: GRACE_PERIOD only with provider access and a verified future active-entitlement expiry; missing/ambiguous grace expiry returns 503 rather than inventing access.
- Expired, revoked/refunded, no access or no eligible subscription: FREE. Existing GET also independently expires stale records by their saved expiry.
- Provider/configuration/network failure: 503; no new entitlement grant or guessed write. An already verified, unexpired record is not erased on a provider outage.

Billing events never delete inventory or auto-unequip items. Expired/Free users retain permanent ownership and may equip/re-equip already-owned Premium cosmetics; active Premium is required only for new Premium purchases. Purchase/equip handlers were not changed.

## 3. RevenueCat user identity mapping

RevenueCat appUserID is the **Cognito JWT `sub`**, the same identity used in `USER#<sub>` server keys. No email, display name or anonymous RC ID is canonical. Configure with that ID after profile/session restoration; switching accounts performs logout then login, clears cached packages and invalidates late operations. Logout/account deletion clear the billing controller and attempt SDK logout; API requests carry an expected-user guard before attaching a JWT. A late old-account purchase cannot sync against the newly signed-in account.

RC logout may create an anonymous SDK customer as normal SDK behavior. That customer cannot authorize this backend; webhooks mutate only existing Cognito-sub profiles. Configure RevenueCat restore/transfer policy intentionally and test shared-store-account behavior; restoring does not grant both accounts access locally.

## 4. Purchase flow

The existing screen loads the current offering's monthly/annual packages. Labels use `product.priceString`, not a hardcoded price. Subscribe is guarded against same-tick taps, unavailable packages, unknown server entitlement, identity initialization and pending verification.

`purchasePackage` → discard CustomerInfo → authenticated `POST /billing/sync {}` → existing `GET /entitlements` → only a confirmed server plan updates Premium/ad eligibility. Purchase cancellation, pending payment, store/network failure and unavailable offerings have safe UI messages. Pending payment or a completed purchase whose backend verification failed blocks another purchase and provides **Retry plan verification**, without calling the store purchase again. No secret/provider error payload is displayed or logged.

## 5. Restore and management

Restore Purchases invokes the native SDK, then follows the same backend sync/GET path. It can confirm Premium, report no active subscription, or remain retryable if verification fails. It never sets a Premium boolean locally.

Premium shows Manage Subscription: iOS RevenueCat's store management UI; Android the Google Play subscriptions URL. Store management, not Evrenthia, cancels billing. Both the Premium screen and account-deletion warning explain that deleting an account does **not** cancel its store subscription. Account deletion still deletes the existing user partition; late webhooks cannot recreate a missing profile.

## 6. Webhook flow

`POST /webhooks/revenuecat` bypasses Cognito but first verifies the exact configured Authorization header using a constant-time comparison (secret minimum 32 characters). Relevant purchase/renewal/cancel/expire/uncancel/billing-issue/product-change/refund/pause/temporary-grant/transfer events re-fetch authoritative provider state; event payloads do not directly grant access.

Transaction: existing-profile condition + optimistic `billingRevision` entitlement write + unique `USER#<sub>/BILLING_EVENT#<SHA256(event ID)>`. Duplicate events are no-ops; older `event_timestamp_ms` cannot overwrite a newer event. Transaction conflicts re-read both provider and database state. Transfers refresh both existing identities; TRANSFER may omit environment, but the provider query remains constrained to the configured environment. Anonymous IDs and deleted accounts are ignored. Logs contain neither webhook bodies nor secrets.

## 7. AdMob architecture

The existing AdProviderAdapter, AdProvider, BannerAdPlacement, RewardedAdButton, useAds, reward controller and server atomic grant are reused. Native calls live in the platform-specific adapter, never Home/Shop. Ordinary web imports only unavailable native stubs.

Modes: **disabled** (default), **placeholder** (DEV-only existing offline simulation), **test** (native DEV build only), **live** (production environment + non-DEV native build + explicit live flag + complete non-sample app/unit IDs). No configuration in this change enables live mode. No forced interstitial, app-open ad or task-completion ad was added.

## 8. Banner behavior

The existing Home placement remains below dashboard content; Shop remains after catalog content. Anchored adaptive banners are contained within the existing content flow, not over controls. Test mode uses official sample adaptive units; placeholder mode retains the visibly marked DEV-only cards. No-fill/provider errors hide the banner without blocking the screen.

Unknown/loading/failed entitlement, Premium, incomplete onboarding, login, editors, Premium/restore, permissions, deletion and active completion/achievement/building feedback are ineligible. The SDK is lazily imported/initialized only after known Free eligibility and consent. Account/eligibility changes invalidate pending loads. An ad already being displayed by a native SDK cannot be force-closed; suppression prevents subsequent loads/requests and client grants, and the server rejects a Premium reward race.

## 9. Rewarded SSV flow

Shop opt-in → authenticated server status → UMP/SDK ready → `POST /ads/reward/prepare {provider:"ADMOB", platform:"IOS"|"ANDROID"}` → SDK reward request with prepared opaque binding/custom data → ad displayed → earned callback records UI completion only → authenticated polling awaits verified server grant.

External `GET /webhooks/admob/reward` requires Google's ECDSA SHA-256 signature. Verification uses the **original raw query bytes before signature/key_id**, not sorted/re-encoded parameters. Fixed Google HTTPS public keys are cached for six hours, with bounded refresh/timeouts and fail-closed unknown/invalid keys. Duplicate/malformed query parameters, old/future timestamp, wrong unit, user binding, reward amount/type or claim are rejected before granting.

Verified callback invokes the existing atomic ten-coin transaction: optimistic current profile balance/timezone, Free entitlement condition, local-day counter below three, READY/unexpired receipt → GRANTED, plus unique global `AD_TRANSACTION#<SHA256(transaction ID)>/GRANTED`. Concurrent/duplicate callbacks grant once; the fourth grants zero. Date comes from server time and the profile timezone, never device time. No task/quest/World Point economy changes.

The client **never POSTs an AdMob coin claim**, adds coins locally or substitutes a client earned event for SSV. It polls the same receipt (up to about 24 seconds), displays Verifying reward, and allows retry of that same receipt after timeout. Delayed verification does not trigger another ad automatically.

## 10. Prepared claim design

The existing per-user `AD_RECEIPT#SHA256(claim)` record is reused. A ten-minute AES-256-GCM encrypted opaque token binds Cognito sub, a random UUID and expiry, using fixed authenticated context `EVRENTHIA_ADMOB_COINS_V1`. The backend additionally saves provider, binding, configured unit, READY status and expiry. Google receives only the encrypted token and random binding, not a readable sub/JWT/email.

Claims cannot be moved to another user or consumed twice. Granted receipts stay queryable for lost-response retries. Account deletion removes user-partition receipts; the global transaction hash tombstone contains no raw user identity and remains to prevent replay. Claim-secret rotation invalidates outstanding ungranted claims; coordinate it outside this change. No token/key values are logged.

## 11. Privacy / consent

Google UMP `gatherConsent` and `getConsentInfo().canRequestAds` gate initialization/inventory. Consent denial/error fails closed, not to personalized ads. Where UMP requires privacy options, banners expose **Ad privacy options** and re-check permission after changes. All native requests explicitly use **non-personalized-only**, including test mode. Non-personalized ads still require applicable consent.

No tracking-permission API or ATT usage-description string was added. Do not enable an automatic ATT message in the AdMob privacy dashboard. No task titles/descriptions, reminders, profile text, auth tokens or private productivity content are sent to AdMob. Device/provider metadata collected by SDKs still requires disclosure: complete App Store privacy labels, Google Play Data Safety, consent-region/age policies, privacy policy and required iOS SKAdNetwork entries before release. Child-directed/under-age policy is not inferred by this implementation; product/legal decisions and corresponding SDK configuration remain release prerequisites.

## 12. Frontend public variables

Variables are public build/client configuration, **not server credentials**. Existing API/Cognito/environment config is unchanged.

| Variable | Behavior |
| --- | --- |
| `EXPO_PUBLIC_BILLING_ENABLED` | Exact `true` plus correct platform public key enables native billing; unset disables it. |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat public iOS `appl_…` SDK key. |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat public Android `goog_…` SDK key. |
| `EXPO_PUBLIC_APP_ENV` | Existing dev/prod environment. Build config also accepts `APP_ENV`. |
| `EXPO_PUBLIC_ADS_MODE` | disabled / placeholder / test / live. |
| `EXPO_PUBLIC_LIVE_ADS_ENABLED` | Exact `true` required for live mode; leave unset/false during QA. |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | iOS build app ID (`~`), required only for explicitly configured live build. |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | Android build app ID (`~`), same rule. |
| `EXPO_PUBLIC_ADMOB_IOS_HOME_BANNER_UNIT_ID` | iOS live Home unit (`/`). |
| `EXPO_PUBLIC_ADMOB_IOS_SHOP_BANNER_UNIT_ID` | iOS live Shop unit. |
| `EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT_ID` | iOS live rewarded unit. |
| `EXPO_PUBLIC_ADMOB_ANDROID_HOME_BANNER_UNIT_ID` | Android live Home unit. |
| `EXPO_PUBLIC_ADMOB_ANDROID_SHOP_BANNER_UNIT_ID` | Android live Shop unit. |
| `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID` | Android live rewarded unit. |
| `EXPO_PUBLIC_ADMOB_TEST_REWARDED_UNIT_ID` | Optional dedicated **QA-only** SSV unit, never a production unit. Test mode only. |
| `EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS` | Comma-separated AdMob 32-hex test-device IDs; mandatory for a dedicated QA unit; also registers EMULATOR. |

Default build app IDs: Android `ca-app-pub-3940256099942544~3347511713`; iOS `ca-app-pub-3940256099942544~1458002511`. The SDK's official sample banner/rewarded IDs are used in test mode, not live variables.

**Important SSV limitation:** Google's shared sample rewarded units cannot be configured with your callback URL. They test presentation but must never receive simulated production rewards. For end-to-end QA, create a separate non-production AdMob QA rewarded unit, configure its SSV URL, register the physical device in AdMob as a test device, set the two TEST variables, and set the backend platform unit to match. The adapter rejects missing/malformed test-device IDs, a unit reused from live config, or a server/unit mismatch. Check the ad's visible **Test Ad** label before interaction; stop if absent. Never use a production unit during QA.

## 13. Backend secrets and configuration

SAM parameters (unconfigured safe defaults): RevenueCatSecretApiKey → `REVENUECAT_SECRET_API_KEY`; RevenueCatWebhookAuthorization → `REVENUECAT_WEBHOOK_AUTHORIZATION`; RevenueCatProjectId → `REVENUECAT_PROJECT_ID`; RevenueCatEntitlementId → `REVENUECAT_ENTITLEMENT_ID`; RevenueCatProducts → `REVENUECAT_PRODUCTS`; RevenueCatEnvironment → `REVENUECAT_ENVIRONMENT` (sandbox default, DEV only).

`REVENUECAT_PRODUCTS` is an explicit JSON list of `{id, appId, storeIdentifier, store}`. IDs are RC internal product/app IDs, storeIdentifier is the actual store product ID, store is `app_store` or `play_store`. EntitlementId is the **internal RC entitlement ID**, not the `premium` lookup key. Verify all IDs using the provider dashboard/API, not guesswork.

AdMobSsvEnabled → `ADMOB_SSV_ENABLED`; AdMobLiveEnabled → `ADMOB_LIVE_ENABLED`; AdMobClaimSecret → `ADMOB_CLAIM_SECRET` (base64 32-byte server encryption key); AdMobIosRewardedUnitId/AdMobAndroidRewardedUnitId → platform rewarded units. SSV/live/DEV simulation default **false**. Non-DEV SSV requires explicit live opt-in. PushDeliveryMode remains **DRY_RUN**.

Secrets are NoEcho server-only parameters. NoEcho is not a credential vault: use approved secret-manager/dynamic-reference configuration outside this task, avoid source files, shell history, logs and samconfig values, and restrict IAM access. The v2 secret needs customer/subscription/entitlement/product read permissions, not client SDK keys. API routes: Cognito on sync/status/prepare/DEV claim; dedicated secret on RC webhook; Google signature on AdMob webhook. IAM is table-scoped, no new scans or deletion privileges.

## 14. App Store Connect checklist

- Use the permanent iOS bundle identifier `com.osegssteam.evrenthia` when registering the app before the first store upload. The legacy app name `frontend`, slug `owen` and explicit scheme `frontend` remain unchanged. No Apple app record or signing credentials were created locally.
- Create monthly (optionally yearly) auto-renewable subscriptions in the intended subscription group; complete agreements, tax/banking, pricing, metadata, localization and review requirements.
- Connect the app/store credentials in RevenueCat securely; attach imported products to premium/current offering.
- Create/use an Apple sandbox tester and sandbox device/store account. Never use real customer billing. StoreKit-only local mocks do not prove server verification.
- Prepare signed development build provisioning and test on a physical iPhone; verify purchase, cancel, pending, restore, expiry/refund, management, logout/account switch and deletion warning.

## 15. RevenueCat setup checklist

- Create/confirm project and iOS/Android apps with the permanent identifier `com.osegssteam.evrenthia`; supply only platform public SDK keys to the app. RevenueCat App User IDs remain the authenticated Cognito `sub`, not the native bundle/package identifier.
- Create entitlement lookup key **premium**, current/default offering, monthly/optional annual packages; map all subscription products.
- Configure backend v2 secret, internal entitlement/product/app IDs, store IDs and sandbox environment. Choose intentional restore/transfer policy.
- Configure the future reachable `/webhooks/revenuecat` endpoint with a dedicated strong Authorization secret and sandbox environment filter. Test transfers, duplicate/out-of-order delivery and provider outages against an isolated backend.
- Do not create admin/test Premium from client state. Do not enable billing flags in existing production configuration yet.

## 16. Google Play checklist

- Use the permanent Android package `com.osegssteam.evrenthia` when preparing the Play listing and signing before the first upload. No Play app record or signing credentials were created locally.
- Create subscription/base plans and activate intended test products. Connect RevenueCat to Play using securely supplied service credentials and required permissions.
- Configure license testers/internal test access; install the appropriate signed build using the intended test Google account. Verify tester eligibility before purchase. No real payment.
- Test pending payment, cancellation, restore, renewal/expiry, account transfer and Play management separately from iOS.

## 17. AdMob checklist

- Create separate platform apps and QA units for the permanent store identity `com.osegssteam.evrenthia`; configure UMP privacy messages and test-device registration, without an automatic ATT request. Official sample IDs remain unchanged; production AdMob App IDs/ad units are separate provider identifiers, not bundle/package strings.
- Use official sample app/banner/rewarded IDs for display-only DEV testing. Use the guarded dedicated QA unit for SSV testing; never production units.
- Set SSV callback to the future reachable `/webhooks/admob/reward`, reward amount **10**, reward item **coins**; backend unit must exactly match the prepared platform unit. Preserve query bytes at gateways/proxies; do not log raw SSV query/custom data.
- Exercise valid/invalid signed callbacks, duplicate/concurrent receipts, claim expiry/user mismatch, Premium transition and fourth grant. Current local tests use generated ECDSA keys; they do not prove Google's actual callback delivery.
- Complete consent/privacy/age-policy/store-disclosure review before any live release.

## 18. EAS / native build requirements

These SDKs cannot run in Expo Go or be added by an OTA-only update. Build a new development client for each platform with the permanent bundle/package identifier `com.osegssteam.evrenthia`. Existing EAS development profile already has developmentClient/internal distribution; eas.json, EAS project ID and explicit URL scheme are unchanged. Review EAS credentials for the new app identity: iOS provisioning must match the new bundle ID; Android signing and FCM registration must be checked for the new package. Do not revoke shared certificates/APNs keys or assume old installations/push tokens migrate. Native targets must meet the installed package/Expo requirements (ad package iOS 15.1+ / Android minSDK 24+, new architecture).

Build-time AdMob IDs are supplied through the config plugin, which sets iOS GADApplicationIdentifier, Android APPLICATION_ID and delayed measurement initialization; no ATT prompt string. Local introspection confirms these entries. Check merged native manifests/pods, signing, store configuration and native build outputs before device testing.

Future authorized commands: `eas build --profile development --platform ios` or `android`, then `npx expo start --dev-client`. **Not run in this task.** EAS profiles currently point to real DEV/PROD APIs; do not launch them while operating under the no-AWS restriction. Provider callbacks require a reachable verified backend; offline mocks alone cannot test delivery.

## 19. DEV testing procedure and local evidence

1. Default/disabled: no SDK inventory or purchases; web Premium explains native availability. Placeholder: existing Free Home/Shop cards and DEV reward simulation, enabled only with the existing DEV server simulation flag.
2. Isolated mocks: check actual Premium UI at phone widths, localized package strings, cancellation/pending/no package, server verification failure/retry, Premium management, restore and logout/account switching. No local success may grant backend rights.
3. After external setup/build approval: DEV app environment, billing enabled with public app keys, sandbox backend configuration, ads test mode and live flag false. Sample IDs test presentation; guarded QA unit tests SSV. Confirm zero requests for Premium/loading/protected flows.
4. Verify all three grants, fourth rejection, profile-local midnight, duplicate/retry/concurrent callbacks and account deletion. Do not enable production billing/ads to get tests passing.

Local results:

- Backend `node --test`: **277 passed**, none failed.
- Frontend `node --test`: **204 passed**, none failed (final run recorded with the implementation).
- TypeScript, lint, avatar validation, asset audit and diff whitespace checks pass; 143 registered sprites and all 271 image assets resolve. No artwork or avatar code changed.
- Expo public config and native introspection pass. Real Expo web export passes (24 static routes); native SDKs do not break ordinary web bundling.
- Expo Doctor **20/21**: one check reports 11 existing Expo patch-version mismatches (Expo 57.0.21 vs expected 57.0.27, plus font/haptics/image/linking/router/secure-store/splash/symbols/system-ui/web-browser patches). No automatic upgrades performed.
- Read-only npm audit: **37** findings (12 moderate, 24 high, 1 critical). New SDK audit flags inherit the existing React Native/Expo dependency advisories; do not downgrade them to npm's suggested incompatible versions. Critical `shell-quote` and other toolchain findings need separate scoped review before release.
- Local visual review uses real Home/Shop/Premium components with offline auth/API/store mocks at 320px, 390px and 768px, not actual native billing/ad UI. No horizontal overflow; app buttons retain 48px touch targets. Verified Free Home/Shop placeholders, Premium/loading suppression, verification failure/blocked repurchase, retry and server-confirmed Premium management. Native UMP forms, store sheets, no-fill, physical-device layout and real provider delivery remain untested. Screenshot evidence is temporary, outside the repository: `/private/tmp/evrenthia-entitlements-preview.d6dsZS/real-monetization-premium-320.png`.

## 20. PROD release requirements and readiness

**GO for local mock/cryptographic review; NO-GO for provider-connected native DEV today** until app/provider products, public keys, server secrets/allowlist, reachable callback endpoints, QA device/unit setup and signed development builds exist. **NO-GO for production.** Resolve Doctor/audit findings and complete native/privacy/store/security review first. No secrets were supplied or verified, and no native build/purchase/ad callback was executed here.

Before a separately authorized release: verify production RC environment isolation and allowlists, webhook credential storage/rotation, log redaction at API Gateway/proxies, subscription disclosures/terms/privacy, store SDK/disclosure requirements, current SKAdNetwork list, QA evidence on both platforms, consent/age-policy decisions, sandbox-vs-production account separation, and explicit live configuration for both server and client. Keep DEV simulation impossible outside DEV. Do not broaden Premium ownership gating or the ad economy.

### Exact changed files

Backend:

- `backend/functions/billing/index.mjs`
- `backend/functions/billing/revenuecat.mjs`
- `backend/functions/ad-rewards/index.mjs`
- `backend/functions/ad-rewards/admob.mjs`
- `backend/template.yaml`
- `backend/test-support/ad-reward-fixture.mjs`
- `backend/tests/billing.test.mjs`
- `backend/tests/admob-ssv.test.mjs`
- `backend/tests/ad-rewards.test.mjs`
- `backend/tests/infrastructure.test.mjs`

Frontend:

- `frontend/package.json`, `frontend/package-lock.json`, `frontend/app.config.js`
- `frontend/app/premium.tsx`, `frontend/app/(tabs)/profile.tsx`, `frontend/app/(tabs)/shop.tsx` (replace obsolete unavailable-billing copy only)
- `frontend/src/billing/client.ts`, `frontend/src/billing/provider.ts`, `frontend/src/billing/provider.native.ts`
- `frontend/src/ads/Ads.tsx`, `frontend/src/ads/model.ts`, `frontend/src/ads/native.tsx`, `frontend/src/ads/native.native.tsx`
- `frontend/src/api/routes.ts`, `frontend/src/auth/session.ts`, `frontend/src/context/AuthContext.tsx`
- `frontend/tests/native-monetization.test.mjs`, `frontend/tests/auth-session.test.mjs`, `frontend/tests/entitlements-ads.test.mjs`, `frontend/tests/notifications.test.mjs`, `frontend/tests/rewarded-ads.test.mjs`

Root: this document. Backend tests share an extracted existing fixture rather than execute another test file twice. The notification logout assertion now includes billing cleanup between device cleanup and existing sign-out; notification behavior/DRY_RUN are unchanged. Ponytail kept the existing models/controllers/transactions and used Node crypto instead of new verification dependencies.

### Primary references

[RevenueCat Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo), [RevenueCat REST v2](https://www.revenuecat.com/docs/api-v2), [RevenueCat event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [Google SSV verification](https://developers.google.com/admob/android/ssv), [native ad package prerequisites](https://docs.page/invertase/react-native-google-mobile-ads/prerequisites), [Expo config plugin](https://docs.page/invertase/react-native-google-mobile-ads/config-plugin), [UMP consent](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent).
