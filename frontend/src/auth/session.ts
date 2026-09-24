import { isAxiosError, isCancel } from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import type { User } from "../types";
import type { CognitoAuth, CognitoIdentity, RegistrationStep } from "./cognito";

type SessionState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  sessionNotice: string | null;
};

type ProfileResponse = {
  displayName: string;
  timeZone: string;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  coins: number;
};

type EntitlementResponse = { plan?: string; subscriptionStatus?: string };
type ApiErrorResponse = { error?: { code?: string } };
type SessionRequest = InternalAxiosRequestConfig & { sessionRevision?: number };
const AUTH_TIMEOUT = 15_000;

function isAccountNotFound(error: unknown) {
  return isAxiosError<ApiErrorResponse>(error)
    && error.response?.status === 403
    && error.response.data?.error?.code === "ACCOUNT_NOT_FOUND";
}

export function userFromProfile(
  profile: ProfileResponse,
  identity: CognitoIdentity,
  entitlement: EntitlementResponse = {},
): User {
  return {
    id: identity.userId,
    username: profile.displayName,
    email: identity.email,
    timeZone: profile.timeZone ?? "UTC",
    totalXp: profile.xp,
    level: profile.level,
    xpToNextLevel: profile.xpToNextLevel,
    progressPercent: profile.xpForNextLevel > 0
      ? Math.floor((profile.xpIntoLevel / profile.xpForNextLevel) * 100)
      : 0,
    currentStreak: 0,
    longestStreak: 0,
    coins: profile.coins,
    premiumActive: entitlement.plan === "PREMIUM" && entitlement.subscriptionStatus !== "EXPIRED",
  };
}

/** Owns Cognito and API session transitions independently of React renders. */
export class AuthSession {
  private state: SessionState = {
    token: null, user: null, loading: true, sessionError: null, sessionNotice: null,
  };
  private revision = 0;
  private listeners = new Set<() => void>();
  private refresh: { revision: number; promise: Promise<boolean> } | null = null;
  private signOutPending: Promise<void> = Promise.resolve();
  private client: AxiosInstance;
  private auth: CognitoAuth;

  constructor(client: AxiosInstance, auth: CognitoAuth) {
    this.client = client;
    this.auth = auth;
  }

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<SessionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }

  private signOutFromCognito() {
    const request = this.signOutPending.then(() => this.auth.signOut());
    this.signOutPending = request.catch(() => {});
    return request;
  }

  start = () => {
    const requestId = this.client.interceptors.request.use(config => {
      (config as SessionRequest).sessionRevision = this.revision;
      if (this.state.token) {
        config.headers.set("Authorization", `Bearer ${this.state.token}`);
      } else {
        config.headers.delete("Authorization");
      }
      return config;
    });
    const responseId = this.client.interceptors.response.use(response => response, error => {
      const accountNotFound = isAccountNotFound(error);
      if ((isAxiosError(error) && error.response?.status === 401) || accountNotFound) {
        this.expire(
          (error.config as SessionRequest | undefined)?.sessionRevision,
          accountNotFound ? "This account no longer exists. Please sign in again." : undefined,
        );
      }
      return Promise.reject(error);
    });
    void this.restore();
    return () => {
      this.client.interceptors.request.eject(requestId);
      this.client.interceptors.response.eject(responseId);
      this.revision++;
      this.refresh = null;
    };
  };

  private expire(
    revision: number | undefined,
    notice = "Your session has expired. Please sign in again.",
  ) {
    if (revision !== this.revision || !this.state.token) return;
    this.revision++;
    this.update({
      token: null, user: null, loading: false, sessionError: null,
      sessionNotice: notice,
    });
    void this.signOutFromCognito().catch(() => {});
  }

  restore = async () => {
    const revision = ++this.revision;
    this.update({ loading: true, sessionError: null });
    try {
      const identity = await this.auth.getSession();
      if (revision !== this.revision) return false;
      if (!identity) {
        this.update({ token: null, user: null });
        return false;
      }
      this.update({ token: identity.token, user: null });
      return await this.fetchUser(revision, identity);
    } catch {
      if (revision === this.revision) {
        this.update({ sessionError: "Couldn't restore your saved sign-in. Please try again." });
      }
      return false;
    } finally {
      if (revision === this.revision) this.update({ loading: false });
    }
  };

  refreshUser = (): Promise<boolean> => {
    if (!this.state.token) return Promise.resolve(false);
    const revision = this.revision;
    if (this.refresh?.revision === revision) return this.refresh.promise;

    const promise = this.refreshSession(revision);
    this.refresh = { revision, promise };
    void promise.finally(() => {
      if (this.refresh?.promise === promise) this.refresh = null;
    });
    return promise;
  };

  private async refreshSession(revision: number) {
    try {
      const identity = await this.auth.getSession(true);
      if (revision !== this.revision) return false;
      if (!identity) {
        this.expire(revision);
        return false;
      }
      this.update({ token: identity.token });
      return await this.fetchUser(revision, identity);
    } catch {
      if (revision === this.revision) {
        this.update({ sessionError: "Couldn't refresh your account. Your sign-in is saved. Please try again." });
      }
      return false;
    }
  }

  private async fetchUser(revision: number, identity: CognitoIdentity) {
    try {
      const [profile, entitlement] = await Promise.all([
        this.client.get<ProfileResponse>("/me", { timeout: AUTH_TIMEOUT }),
        this.client.get<EntitlementResponse>("/entitlements", { timeout: AUTH_TIMEOUT }),
      ]);
      if (revision !== this.revision) return false;
      this.update({
        user: userFromProfile(profile.data, identity, entitlement.data),
        sessionError: null,
        sessionNotice: null,
      });
      return true;
    } catch (error) {
      if (revision !== this.revision) return false;
      if (isAxiosError(error) && error.response?.status === 401) {
        this.expire(revision);
      } else if (!isCancel(error)) {
        this.update({ sessionError: "Couldn't refresh your account. Your sign-in is saved. Please try again." });
      }
      return false;
    }
  }

  login = async (email: string, password: string) => {
    await this.signOutPending;
    const expectedRevision = this.revision;
    const identity = await this.auth.signIn(email, password);
    if (expectedRevision !== this.revision) {
      await this.signOutFromCognito();
      throw new Error("The sign-in attempt is no longer current.");
    }
    const revision = ++this.revision;
    this.update({
      token: identity.token, user: null, loading: true,
      sessionError: null, sessionNotice: null,
    });
    try {
      if (!await this.fetchUser(revision, identity)) {
        throw new Error("The account profile could not be loaded.");
      }
    } finally {
      if (revision === this.revision) this.update({ loading: false });
    }
  };

  register = (
    displayName: string,
    email: string,
    password: string,
    _bodyType: "BOY" | "GIRL",
  ): Promise<RegistrationStep> => this.auth.signUp(displayName, email, password);

  confirmRegistration = async (email: string, confirmationCode: string, password: string) => {
    await this.auth.confirmSignUp(email, confirmationCode);
    await this.login(email, password);
  };

  logout = async () => {
    await this.signOutFromCognito();
    this.revision++;
    this.update({ token: null, user: null, loading: false, sessionError: null, sessionNotice: null });
  };

  clearDeletedAccountSession = async () => {
    try {
      await this.signOutFromCognito();
    } catch {
      // The server has already deleted the identity; local UI must still be cleared.
    }
    this.revision++;
    this.refresh = null;
    this.update({ token: null, user: null, loading: false, sessionError: null, sessionNotice: null });
  };

  retrySession = () => this.state.token ? this.refreshUser() : this.restore();
}
