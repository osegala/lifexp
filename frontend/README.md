# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   cp .env.example .env.local
   # Replace EXPO_PUBLIC_API_URL with the evrenthia-dev DevApiUrl output.
   npx expo start
   ```

The app defaults to the `dev` environment and fails fast when its public backend configuration is missing, malformed, or mixes development and production resources. Local `.env` files are gitignored; only public examples are committed.

## Backend environments

All backend selection flows through `src/config/environment.ts`. The required client-visible values are:

- `EXPO_PUBLIC_APP_ENV` — `dev` or `prod`; omission selects `dev`, never production
- `EXPO_PUBLIC_AWS_REGION` — currently `us-east-2`
- `EXPO_PUBLIC_API_URL` — the HTTPS API Gateway base URL without a trailing path
- `EXPO_PUBLIC_COGNITO_USER_POOL_ID` — the matching user pool
- `EXPO_PUBLIC_COGNITO_CLIENT_ID` — the matching public app client

To run locally against development, copy `.env.example` to `.env.local`, replace its API placeholder with the `DevApiUrl` output from `evrenthia-dev`, and start Expo. To test production locally, copy `.env.production.example` to `.env.local` and restart Expo with a cleared Metro cache. Production is selected only by `EXPO_PUBLIC_APP_ENV=prod`, and the app rejects any production/dev cross-wiring.

Every `EXPO_PUBLIC_` value is embedded in the client bundle and readable by app users. Never put passwords, Cognito tokens, authorization headers, AWS credentials, production smoke-test credentials, or other secrets in these variables or in the mobile repository.

The EAS `development` and `preview` profiles explicitly select `dev`; their deployed dev API URL must be configured in the corresponding EAS environment before a future build. The `production` profile contains only the approved public production identifiers and selects `prod`. It is ready to consume that configuration during a later, separately approved production build; this repository change does not build, publish, submit, or update the app.

No Expo device-token registration currently exists in the frontend. It may later register devices through the production `/devices` API, but production notification delivery currently remains `DRY_RUN`. Enabling actual push delivery requires a separate approved backend change.

AWS Amplify v6 manages Cognito sessions and refresh tokens. Its native React Native support requires a development build rather than Expo Go.

The shared API client now targets the SAM base URL, but some existing screens still call legacy routes that the SAM backend does not expose, including social, weekly-quest, subscription-development, and older avatar/base endpoints. Migrate or deliberately hide those screens before approving a production app build; environment selection does not invent replacement contracts.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
