import { Amplify } from "aws-amplify";
import {
  confirmSignUp,
  fetchAuthSession,
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
  const idToken = session.tokens?.idToken;
  if (!idToken || typeof idToken.payload.sub !== "string" || !idToken.payload.sub) return null;

  // Amplify restores/refreshes the token. Its subject is the same account ID
  // getCurrentUser uses; fetching attributes would add a network gate to startup.
  return { token: idToken.toString(), userId: idToken.payload.sub,
    email: typeof idToken.payload.email === "string" ? idToken.payload.email : "" };
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
