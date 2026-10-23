import { isAxiosError, isCancel } from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import type { EntitlementResponse, User } from "../types";
import { FREE_ENTITLEMENTS, isPremium, normalizeEntitlements } from "../entitlements/model.ts";
import type { CognitoAuth, CognitoIdentity, RegistrationStep } from "./cognito";
import { getDeviceTimeZone, normalizeTimeZone } from "../utils/timeZone.ts";
import type { AvatarAppearance } from "../avatar/appearance.ts";
import type { PlayerCache } from "../cache/PlayerCache.ts";

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

export type ProfileResponse = Partial<AvatarAppearance> & {
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
  private readDeviceTimeZone: () => string | null;
  private cache?: PlayerCache;
  private accountId: string | null = null;
  private prepareDisplay?: (userId: string) => Promise<unknown>;

  constructor(client: AxiosInstance, auth: CognitoAuth, readDeviceTimeZone = getDeviceTimeZone, cache?: PlayerCache,
    prepareDisplay?: (userId: string) => Promise<unknown>) {
    this.client = client;
    this.auth = auth;
    this.readDeviceTimeZone = readDeviceTimeZone;
    this.cache = cache;
    this.prepareDisplay = prepareDisplay;
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

  private async prepareAccountDisplay(userId: string) {
    try { await this.prepareDisplay?.(userId); }
    catch { /* Asset warm-up is best effort; it cannot invalidate saved account data. */ }
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
    if (this.accountId) void this.cache?.clearUser(this.accountId);
    this.accountId = null;
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
        if (this.accountId) void this.cache?.clearUser(this.accountId);
        this.accountId = null;
        this.update({ token: null, user: null, ...emptyEntitlements() });
        return false;
      }
      if (this.accountId && this.accountId !== identity.userId) void this.cache?.clearUser(this.accountId);
      this.accountId = identity.userId;
      this.update({ token: identity.token, user: null, ...emptyEntitlements() });
      await this.cache?.hydrateUser(identity.userId);
      if (revision !== this.revision) return false;
      await this.prepareAccountDisplay(identity.userId);
      if (revision !== this.revision) return false;
      const cached = this.cache?.peek(identity.userId, "profile");
      // A restored Cognito identity may display its last completed profile while
      // /me revalidates. First-time/incomplete onboarding still waits for /me.
      // No cached field supplies credentials or Premium authorization.
      if (cached?.onboardingCompleted) this.update({ user: userFromProfile(cached, identity), loading: false });
      const promise = this.fetchUser(revision, identity);
      this.refresh = { revision, promise };
      void promise.finally(() => { if (this.refresh?.promise === promise) this.refresh = null; });
      return await promise;
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
      if (identity.userId !== this.accountId) return this.restore();
      this.update({ token: identity.token });
      return await this.fetchUser(revision, identity);
    } catch {
      if (revision === this.revision) {
        this.update({ sessionError: "Couldn't refresh your account. Your sign-in is saved. Please try again." });
      }
      return false;
    }
  }

  private async fetchUser(revision: number, identity: CognitoIdentity): Promise<boolean> {
    try {
      // Plan availability must not hold up the core profile or onboarding route.
      void this.loadEntitlements(revision);
      const hydration = this.cache?.hydrateUser(identity.userId);
      const cacheCurrent = this.cache?.checkpoint(identity.userId, "profile");
      const profile = await this.client.get<ProfileResponse>("/me", { timeout: AUTH_TIMEOUT });
      if (revision !== this.revision) return false;
      // Startup, sign-in and every account refresh (including foreground/online)
      // share the profile update path, which also wakes all notification schedules.
      const detected = normalizeTimeZone(this.readDeviceTimeZone());
      const timeZone = detected ?? normalizeTimeZone(profile.data.timeZone);
      let timeZoneError: string | null = detected ? null
        : "Couldn't detect your device time zone. Reminders use your last saved time zone. Try again after checking your device settings.";
      if (timeZone && timeZone !== profile.data.timeZone) {
        try {
          const saved = await this.client.patch<{ timeZone: string }>("/me", { timeZone }, { timeout: AUTH_TIMEOUT });
          if (revision !== this.revision) return false;
          if (saved.data.timeZone !== timeZone) throw new Error("Time zone update was not confirmed");
          profile.data = { ...profile.data, timeZone };
        } catch (error) {
          if (revision !== this.revision) return false;
          if (isAxiosError(error) && error.response?.status === 401) throw error;
          timeZoneError = "Couldn't confirm your device time zone update. Showing the last confirmed time zone. Reconnect and try again.";
        }
      }
      await hydration;
      if (revision !== this.revision) return false;
      // A concurrent mutation/newer read superseded this GET. Ask the server
      // again; a stale GET must not undo a confirmed profile mutation.
      if (cacheCurrent && !cacheCurrent()) return this.fetchUser(revision, identity);
      if (cacheCurrent?.()) this.cache?.set(identity.userId, "profile", profile.data);
      const displayCurrent = this.cache?.checkpoint(identity.userId, "profile");
      await this.prepareAccountDisplay(identity.userId);
      if (revision !== this.revision) return false;
      if (displayCurrent && !displayCurrent()) return this.fetchUser(revision, identity);
      this.update({
        user: userFromProfile(profile.data, identity, this.state.entitlements),
        sessionError: timeZoneError,
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
    if (this.accountId && this.accountId !== identity.userId) void this.cache?.clearUser(this.accountId);
    this.accountId = identity.userId;
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
    if (this.accountId) void this.cache?.clearUser(this.accountId);
    this.accountId = null;
    this.revision++;
    this.update({ token: null, user: null, loading: false, sessionError: null, sessionNotice: null, ...emptyEntitlements() });
  };

  clearDeletedAccountSession = async () => {
    if (this.accountId) void this.cache?.clearUser(this.accountId);
    this.accountId = null;
    this.revision++;
    this.refresh = null;
    this.update({ token: null, user: null, loading: false, sessionError: null, sessionNotice: null, ...emptyEntitlements() });
    try {
      await this.signOutFromCognito();
    } catch {
      // The server has already deleted the identity; local UI must still be cleared.
    }
  };

  retrySession = () => this.state.token ? this.refreshUser() : this.restore();
}
