import { isAxiosError, isCancel } from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import type { EntitlementResponse, User } from "../types";
import { FREE_ENTITLEMENTS, isPremium, normalizeEntitlements } from "../entitlements/model.ts";
import type { CognitoAuth, CognitoIdentity, RegistrationStep } from "./cognito";

type SessionState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  sessionNotice: string | null;
  entitlements: EntitlementResponse;
  entitlementsLoading: boolean;
  entitlementsConfirmed: boolean;
  entitlementsError: string | null;
};

type ProfileResponse = {
  onboardingCompleted: boolean;
  displayName: string;
  timeZone: string;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
  coins: number;
};

type ApiErrorResponse = { error?: { code?: string } };
type SessionRequest = InternalAxiosRequestConfig & { sessionRevision?: number };
const AUTH_TIMEOUT = 15_000;
const emptyEntitlements = () => ({ entitlements: FREE_ENTITLEMENTS, entitlementsLoading: false,
  entitlementsConfirmed: false, entitlementsError: null });

function isAccountNotFound(error: unknown) {
  return isAxiosError<ApiErrorResponse>(error)
    && error.response?.status === 403
    && error.response.data?.error?.code === "ACCOUNT_NOT_FOUND";
}

export function userFromProfile(
  profile: ProfileResponse,
  identity: CognitoIdentity,
  entitlement: Partial<EntitlementResponse> = FREE_ENTITLEMENTS,
): User {
  if (typeof profile.onboardingCompleted !== "boolean") {
    throw new Error("The server did not return onboarding status.");
  }
  return {
    onboardingCompleted: profile.onboardingCompleted,
    id: identity.userId,
    username: profile.displayName,
    email: identity.email,
    timeZone: profile.timeZone ?? "UTC",
    totalXp: profile.xp,
    level: profile.level,
    xpIntoLevel: profile.xpIntoLevel,
    xpForNextLevel: profile.xpForNextLevel,
    xpToNextLevel: profile.xpToNextLevel,
    progressPercent: profile.xpForNextLevel > 0
      ? Math.floor((profile.xpIntoLevel / profile.xpForNextLevel) * 100)
      : 0,
    currentStreak: 0,
    longestStreak: 0,
    coins: profile.coins,
    premiumActive: isPremium(normalizeEntitlements(entitlement)),
  };
}

/** Owns Cognito and API session transitions independently of React renders. */
export class AuthSession {
  private state: SessionState = {
    token: null, user: null, loading: true, sessionError: null, sessionNotice: null,
    ...emptyEntitlements(),
  };
  private revision = 0;
  private listeners = new Set<() => void>();
  private refresh: { revision: number; promise: Promise<boolean> } | null = null;
  private entitlementRefresh: { revision: number; promise: Promise<boolean> } | null = null;
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
      const expected = (config as typeof config & { expectedUserId?: string }).expectedUserId;
      if (expected && String(this.state.user?.id) !== expected) throw new Error("Account changed before monetization request");
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
      ...emptyEntitlements(),
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
        this.update({ token: null, user: null, ...emptyEntitlements() });
        return false;
      }
      this.update({ token: identity.token, user: null, ...emptyEntitlements() });
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
      // Plan availability must not hold up the core profile or onboarding route.
      void this.loadEntitlements(revision);
      const profile = await this.client.get<ProfileResponse>("/me", { timeout: AUTH_TIMEOUT });
      if (revision !== this.revision) return false;
      this.update({
        user: userFromProfile(profile.data, identity, this.state.entitlements),
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

  refreshEntitlements = () => this.state.token ? this.loadEntitlements(this.revision) : Promise.resolve(false);

  private loadEntitlements(revision: number): Promise<boolean> {
    if (this.entitlementRefresh?.revision === revision) return this.entitlementRefresh.promise;
    this.update({ entitlementsLoading: true, entitlementsError: null });
    const promise = (async () => {
      try {
        const response = await this.client.get("/entitlements", { timeout: AUTH_TIMEOUT });
        if (revision !== this.revision) return false;
        const entitlements = normalizeEntitlements(response.data);
        this.update({ entitlements, entitlementsConfirmed: true,
          user: this.state.user ? { ...this.state.user, premiumActive: isPremium(entitlements) } : null });
        return true;
      } catch {
        if (revision === this.revision) this.update({ ...emptyEntitlements(), entitlementsLoading: true,
          entitlementsError: "Could not check your plan. Your core features remain available.",
          user: this.state.user ? { ...this.state.user, premiumActive: false } : null });
        return false;
      } finally {
        if (revision === this.revision) this.update({ entitlementsLoading: false });
      }
    })();
    this.entitlementRefresh = { revision, promise };
    void promise.finally(() => { if (this.entitlementRefresh?.promise === promise) this.entitlementRefresh = null; });
    return promise;
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
      sessionError: null, sessionNotice: null, ...emptyEntitlements(),
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
    this.update({ token: null, user: null, loading: false, sessionError: null, sessionNotice: null, ...emptyEntitlements() });
  };

  clearDeletedAccountSession = async () => {
    try {
      await this.signOutFromCognito();
    } catch {
      // The server has already deleted the identity; local UI must still be cleared.
    }
    this.revision++;
    this.refresh = null;
    this.update({ token: null, user: null, loading: false, sessionError: null, sessionNotice: null, ...emptyEntitlements() });
  };

  retrySession = () => this.state.token ? this.refreshUser() : this.restore();
}
