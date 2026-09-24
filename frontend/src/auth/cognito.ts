import { Amplify } from "aws-amplify";
import {
  confirmSignUp,
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";
import { environment } from "../config/environment";

export type CognitoIdentity = {
  token: string;
  userId: string;
  email: string;
};

export type RegistrationStep = "CONFIRM_SIGN_UP" | "DONE";

export type CognitoAuth = {
  getSession: (forceRefresh?: boolean) => Promise<CognitoIdentity | null>;
  signIn: (email: string, password: string) => Promise<CognitoIdentity>;
  signUp: (displayName: string, email: string, password: string) => Promise<RegistrationStep>;
  confirmSignUp: (email: string, confirmationCode: string) => Promise<void>;
  signOut: () => Promise<void>;
};

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: environment.cognitoUserPoolId,
      userPoolClientId: environment.cognitoClientId,
      loginWith: { email: true },
      signUpVerificationMethod: "code",
    },
  },
});

async function getSession(forceRefresh = false): Promise<CognitoIdentity | null> {
  const session = await fetchAuthSession({ forceRefresh });
  const token = session.tokens?.idToken?.toString();
  if (!token) return null;

  const [user, attributes] = await Promise.all([getCurrentUser(), fetchUserAttributes()]);
  return { token, userId: user.userId, email: attributes.email ?? "" };
}

export const cognitoAuth: CognitoAuth = {
  getSession,
  async signIn(email, password) {
    const result = await signIn({ username: email, password });
    if (!result.isSignedIn) {
      throw new Error(`Cognito sign-in requires unsupported step: ${result.nextStep.signInStep}.`);
    }
    const identity = await getSession();
    if (!identity) throw new Error("Cognito sign-in completed without an ID token.");
    return identity;
  },
  async signUp(displayName, email, password) {
    const result = await signUp({
      username: email,
      password,
      options: { userAttributes: { email, name: displayName } },
    });
    const step = result.nextStep.signUpStep;
    if (step !== "CONFIRM_SIGN_UP" && step !== "DONE") {
      throw new Error(`Cognito sign-up requires unsupported step: ${step}.`);
    }
    return step;
  },
  async confirmSignUp(email, confirmationCode) {
    const result = await confirmSignUp({ username: email, confirmationCode });
    if (!result.isSignUpComplete) {
      throw new Error(`Cognito confirmation requires unsupported step: ${result.nextStep.signUpStep}.`);
    }
  },
  async signOut() {
    await signOut();
  },
};
