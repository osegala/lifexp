# Evrenthia Expo frontend

This Expo app uses AWS Amplify v6 for Cognito authentication and the Evrenthia SAM API for authenticated application data.

## Local development against DEV

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the ignored local environment file:

   ```bash
   cp .env.example .env.local
   ```

   `.env.example` contains the approved public DEV API and Cognito identifiers. Do not put passwords, tokens, AWS credentials, or test-user credentials in `.env.local`.

3. After installing a development build on the device, start Metro:

   ```bash
   npx expo start --dev-client
   ```

Expo Go is not supported for this project. AWS Amplify's React Native support and `expo-secure-store` use native modules, so use a development build.

For the first development build, run one of these commands separately. These commands contact EAS and are intentionally not part of normal local validation:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

An EAS-signed development build for a physical iPhone requires access to an Apple Developer Program team and registered device provisioning. The Android internal-distribution build can be downloaded and installed directly on a test device after allowing installation from that source.

Use a fresh test email address controlled by the developer for on-device Cognito signup and email confirmation. Never commit that address's password or confirmation code.

## Backend environments

All backend selection flows through `src/config/environment.ts`. The required client-visible values are:

- `EXPO_PUBLIC_APP_ENV` — `dev` or `prod`; omission selects `dev`, never production
- `EXPO_PUBLIC_AWS_REGION` — currently `us-east-2`
- `EXPO_PUBLIC_API_URL` — the HTTPS API Gateway base URL without a trailing path
- `EXPO_PUBLIC_COGNITO_USER_POOL_ID` — the matching user pool
- `EXPO_PUBLIC_COGNITO_CLIENT_ID` — the matching public app client

The local `.env.local` and EAS `development` profile use exactly:

- API: `https://yjt7uh5r62.execute-api.us-east-2.amazonaws.com`
- Region: `us-east-2`
- Cognito user pool: `us-east-2_GeLguitkg`
- Cognito app client: `2d934f22a9lvbppn6m9liistj`

The app fails fast if development uses any other API or if development and production resources are mixed. To test production locally, copy `.env.production.example` to `.env.local` and restart Expo with a cleared Metro cache. Production is selected only by `EXPO_PUBLIC_APP_ENV=prod`; its existing EAS profile and public identifiers are unchanged.

Every `EXPO_PUBLIC_` value is embedded in the client bundle and readable by app users. Never put passwords, Cognito tokens, authorization headers, AWS credentials, production smoke-test credentials, or other secrets in these variables or in the mobile repository.

The EAS `development` profile is an internal development-client build and contains the approved DEV public configuration. The `preview` profile also selects `dev` and may source its API URL from its EAS environment. The `production` profile contains only the approved public production identifiers and selects `prod`. Building, publishing, submitting, or updating production requires separate approval.

No Expo device-token registration currently exists in the frontend. It may later register devices through the production `/devices` API, but production notification delivery remains `DRY_RUN`. Enabling actual push delivery requires a separate approved backend change.

## Auth and API behavior

AWS Amplify v6 manages Cognito sessions and refresh tokens. Signup and confirmation use email and an emailed code. Authenticated API requests use the Cognito ID token as a bearer token; raw passwords are passed only to Cognito and are not stored by application code.

The active task, goals, achievements, world, shop, inventory, entitlement, and profile screens use the routes in `backend/template.yaml`. Weekly progress is read from `/goals`; rewards are granted by task completion and have no client-side claim action. Premium status is read-only through `/entitlements`, and no development entitlement setter is present.

Social, visiting another player's base, and building-interior customization are hidden or disabled because the SAM backend does not expose those contracts. Those screens make no network requests. Notification preferences, devices, reminders, history, and task editing are supported by SAM but do not yet have frontend screens.

Avatar body type is appearance-only state saved locally with SecureStore. It is not part of `PROFILE`, is not sent to Cognito, and is never included in `PATCH /me`; only `displayName` and `timeZone` are editable profile fields in the app. Owned cosmetics and equipped slots come from `/inventory`.

## Native configuration

The current native configuration uses iOS bundle identifier `com.osegssteam.owen` and Android package `com.osegssteam.owen`. No camera, location, or push-notification permission is requested by the current feature set. Do not change signing credentials as part of local development setup.
