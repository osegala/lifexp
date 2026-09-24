export type AuthAction = "signUp" | "confirm" | "signIn";

const fallback: Record<AuthAction, string> = {
  signUp: "Could not create that account. Try a different email or username.",
  confirm: "Could not confirm that account. Check the code and try again.",
  signIn: "Login failed. Check your email and password.",
};

export function authErrorMessage(error: unknown, action: AuthAction) {
  const name = error && typeof error === "object" && "name" in error
    ? String(error.name)
    : "";

  if (name === "UsernameExistsException") {
    return "An account with that email already exists. Try logging in.";
  }
  if (name === "CodeMismatchException" || name === "ExpiredCodeException") {
    return "That confirmation code is incorrect or expired. Check the latest code and try again.";
  }
  if (name === "UserNotConfirmedException") {
    return "Confirm your email before logging in.";
  }
  if (name === "NotAuthorizedException" && action === "signIn") {
    return fallback.signIn;
  }
  if (name === "NetworkError" || name === "TypeError") {
    return "Can't connect to LifeXP right now. Check your connection and try again.";
  }
  return fallback[action];
}
