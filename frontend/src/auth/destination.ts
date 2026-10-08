import type { User } from "../types";

/** Never infer a profile's completion from a token or a failed profile read. */
export function authDestination(token: string | null, user: Pick<User, "onboardingCompleted"> | null) {
  if (!token) return "/login" as const;
  if (user?.onboardingCompleted === false) return "/onboarding" as const;
  if (user?.onboardingCompleted === true) return "/(tabs)/dashboard" as const;
  return null;
}
