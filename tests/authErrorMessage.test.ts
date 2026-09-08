import assert from "node:assert/strict";
import test from "node:test";

import { authErrorMessage } from "@/lib/auth/error-message";

test("email rate limits are explained without exposing Supabase's raw error", () => {
  const message = authErrorMessage({
    code: "over_email_send_rate_limit",
    message: "Email rate limit exceeded",
    status: 429,
  });

  assert.match(message, /confirmation-email limit/i);
  assert.match(message, /sign-up is not complete/i);
  assert.doesNotMatch(message, /rate limit exceeded/i);
});

test("other documented auth rate limits get actionable messages", () => {
  assert.match(
    authErrorMessage({ code: "over_request_rate_limit", status: 429 }),
    /few minutes/i,
  );
  assert.match(
    authErrorMessage({ code: "email_address_not_authorized", status: 422 }),
    /contact the organizer/i,
  );
});

test("unknown errors retain useful provider detail", () => {
  assert.equal(
    authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }),
    "Invalid login credentials",
  );
  assert.match(authErrorMessage({ status: 429 }), /few minutes/i);
  assert.match(authErrorMessage({}), /could not complete/i);
});
