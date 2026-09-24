export type AppEnvironment = "dev" | "prod";

export type PublicEnvironment = {
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_AWS_REGION?: string;
  EXPO_PUBLIC_COGNITO_USER_POOL_ID?: string;
  EXPO_PUBLIC_COGNITO_CLIENT_ID?: string;
};

export type EnvironmentConfig = {
  environment: AppEnvironment;
  awsRegion: string;
  apiUrl: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
};

export const AWS_REGION = "us-east-2";
export const DEV_API_URL = "https://yjt7uh5r62.execute-api.us-east-2.amazonaws.com";
export const DEV_COGNITO_USER_POOL_ID = "us-east-2_GeLguitkg";
export const DEV_COGNITO_CLIENT_ID = "2d934f22a9lvbppn6m9liistj";
export const PROD_API_URL = "https://ifzeath0p5.execute-api.us-east-2.amazonaws.com";
export const PROD_COGNITO_USER_POOL_ID = "us-east-2_oYWYSCv0W";
export const PROD_COGNITO_CLIENT_ID = "6pnoum6ishq8fcp4cn09jjj68m";

function required(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

export function resolveEnvironment(values: PublicEnvironment): EnvironmentConfig {
  const environment = (values.EXPO_PUBLIC_APP_ENV?.trim() || "dev") as AppEnvironment;
  if (environment !== "dev" && environment !== "prod") {
    throw new Error("EXPO_PUBLIC_APP_ENV must be dev or prod.");
  }

  const awsRegion = required(values.EXPO_PUBLIC_AWS_REGION, "EXPO_PUBLIC_AWS_REGION");
  if (awsRegion !== AWS_REGION) {
    throw new Error(`EXPO_PUBLIC_AWS_REGION must be ${AWS_REGION}.`);
  }

  const rawApiUrl = required(values.EXPO_PUBLIC_API_URL, "EXPO_PUBLIC_API_URL");
  let apiUrl: URL;
  try {
    apiUrl = new URL(rawApiUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid HTTPS URL.");
  }
  if (apiUrl.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_API_URL must use HTTPS.");
  }
  const apiHostname = new RegExp(`^[a-z0-9]+\\.execute-api\\.${AWS_REGION}\\.amazonaws\\.com$`);
  if (!apiHostname.test(apiUrl.hostname)) {
    throw new Error(`EXPO_PUBLIC_API_URL must be an API Gateway URL in ${AWS_REGION}.`);
  }
  if (apiUrl.pathname !== "/" || apiUrl.search || apiUrl.hash || apiUrl.username || apiUrl.password) {
    throw new Error("EXPO_PUBLIC_API_URL must not include a path, credentials, query, or fragment.");
  }
  const normalizedApiUrl = apiUrl.origin;

  const cognitoUserPoolId = required(
    values.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
    "EXPO_PUBLIC_COGNITO_USER_POOL_ID",
  );
  if (!/^us-east-2_[A-Za-z0-9]+$/.test(cognitoUserPoolId)) {
    throw new Error("EXPO_PUBLIC_COGNITO_USER_POOL_ID must be a us-east-2 user pool ID.");
  }
  const cognitoClientId = required(
    values.EXPO_PUBLIC_COGNITO_CLIENT_ID,
    "EXPO_PUBLIC_COGNITO_CLIENT_ID",
  );
  if (!/^[a-z0-9]+$/.test(cognitoClientId)) {
    throw new Error("EXPO_PUBLIC_COGNITO_CLIENT_ID must be a non-empty Cognito client ID.");
  }

  if (environment === "prod") {
    if (
      normalizedApiUrl !== PROD_API_URL ||
      cognitoUserPoolId !== PROD_COGNITO_USER_POOL_ID ||
      cognitoClientId !== PROD_COGNITO_CLIENT_ID
    ) {
      throw new Error("Production frontend configuration does not match the production backend.");
    }
  } else if (
    normalizedApiUrl !== DEV_API_URL ||
    cognitoUserPoolId !== DEV_COGNITO_USER_POOL_ID ||
    cognitoClientId !== DEV_COGNITO_CLIENT_ID
  ) {
    throw new Error("Development frontend configuration is missing or cross-wired to production.");
  }

  return {
    environment,
    awsRegion,
    apiUrl: normalizedApiUrl,
    cognitoUserPoolId,
    cognitoClientId,
  };
}
