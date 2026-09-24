import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const read = path => readFileSync(`${frontend}/${path}`, "utf8");
const profile = read("app/(tabs)/profile.tsx");

function sourceFiles(directory) {
  return readdirSync(`${frontend}/${directory}`, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map(entry => readFileSync(`${entry.parentPath}/${entry.name}`, "utf8"))
    .join("\n");
}

test("profile exposes a destructive two-step account deletion action", () => {
  assert.match(profile, /title=\{deletingAccount \? "Deleting Account…" : "Delete Account"\}/);
  assert.match(profile, /onPress=\{confirmAccountDeletion\}/);
  assert.match(profile, /Alert\.alert\(\s*"Delete Account"[\s\S]*?This action cannot be undone/);
  assert.match(profile, /\{ text: "Cancel", style: "cancel" \}/);
  assert.match(profile, /\{ text: "Delete My Account", style: "destructive", onPress: \(\) => void deleteAccount\(\) \}/);
});

test("confirmed deletion uses the canonical API and blocks repeated submissions", () => {
  assert.match(profile, /if \(deletionPending\.current\) return;[\s\S]*?deletionPending\.current = true/);
  assert.match(profile, /await api\.delete\(apiRoutes\.me\)/);
  assert.match(profile, /disabled=\{deletingAccount \|\| loggingOut\}/);
});

test("successful deletion clears account-local data and session before returning to login", () => {
  const request = profile.indexOf("await api.delete(apiRoutes.me)");
  const localCleanup = profile.indexOf("clearLocalAccountData()", request);
  const sessionCleanup = profile.indexOf("clearDeletedAccountSession()", request);
  const navigation = profile.indexOf('router.replace({ pathname: "/login" })', request);
  assert.ok(request >= 0 && localCleanup > request && sessionCleanup > request && navigation > sessionCleanup);

  const cleanup = read("src/storage/localAccountData.ts");
  assert.match(cleanup, /clearLocalBodyType\(\)/);
  assert.match(cleanup, /SecureStore\.deleteItemAsync\(BASE_LAYOUT_STORAGE_KEY\)/);
  assert.match(cleanup, /localStorage\?\.removeItem\(BASE_LAYOUT_STORAGE_KEY\)/);
});

test("failed deletion keeps the session and displays a canonical safe error", () => {
  const request = profile.indexOf("await api.delete(apiRoutes.me)");
  const cleanup = profile.indexOf("clearDeletedAccountSession()", request);
  const error = profile.indexOf('apiError(error, "Could not delete your account. Please try again.")', request);
  assert.ok(request >= 0 && cleanup > request && error > cleanup);
  assert.match(profile, /Alert\.alert\("Account not deleted", apiError\(/);
});

test("frontend contains no Cognito admin deletion API", () => {
  const source = `${sourceFiles("src")}\n${sourceFiles("app")}`;
  assert.doesNotMatch(source, /AdminDeleteUser|CognitoIdentityProviderClient|cognito-idp:Admin/);
});
