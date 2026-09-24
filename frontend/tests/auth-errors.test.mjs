import assert from "node:assert/strict";
import test from "node:test";

import { authErrorMessage } from "../src/auth/errors.ts";

const namedError = (name, message = "internal details") => Object.assign(new Error(message), { name });

test("Cognito device-test failures use actionable, non-sensitive messages", () => {
  assert.match(authErrorMessage(namedError("UsernameExistsException"), "signUp"), /already exists/i);
  assert.match(authErrorMessage(namedError("CodeMismatchException"), "confirm"), /confirmation code/i);
  assert.match(authErrorMessage(namedError("ExpiredCodeException"), "confirm"), /expired/i);
  assert.match(authErrorMessage(namedError("UserNotConfirmedException"), "signIn"), /confirm your email/i);
  assert.match(authErrorMessage(namedError("NotAuthorizedException"), "signIn"), /email and password/i);
  assert.match(authErrorMessage(namedError("NetworkError"), "signIn"), /connect/i);
});

test("auth errors never expose exception details, credentials, or tokens", () => {
  const sensitive = "password=hunter2 token=header.payload.signature";
  for (const action of ["signUp", "confirm", "signIn"]) {
    const message = authErrorMessage(namedError("InternalErrorException", sensitive), action);
    assert.doesNotMatch(message, /hunter2|header\.payload|InternalErrorException/);
  }
});
