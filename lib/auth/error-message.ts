type AuthFailure = {
  code?: string;
  message?: string;
  status?: number;
};

const FALLBACK_MESSAGE = "We could not complete that request. Please try again.";

export function authErrorMessage(error: AuthFailure) {
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "CueBracket has reached its confirmation-email limit. Your sign-up is not complete yet. Please wait about one hour and try again.";
    case "over_request_rate_limit":
      return "Too many sign-up attempts were made from this device. Please wait a few minutes and try again.";
    case "email_address_not_authorized":
      return "CueBracket cannot send a confirmation email to this address yet. Please contact the organizer.";
    default:
      if (error.status === 429) {
        return "Too many requests were made right now. Please wait a few minutes and try again.";
      }

      return error.message?.trim() || FALLBACK_MESSAGE;
  }
}
