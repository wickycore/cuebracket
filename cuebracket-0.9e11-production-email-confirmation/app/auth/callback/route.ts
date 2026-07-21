import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function getRedirectOrigin(request: Request, requestOrigin: string) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?.trim()
    .replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production" && configuredSiteUrl) {
    return configuredSiteUrl;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";

  if (process.env.NODE_ENV === "production" && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return requestOrigin;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const redirectOrigin = getRedirectOrigin(request, origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${redirectOrigin}/auth/login?error=${encodeURIComponent(
      "Unable to confirm your account. Please request a new confirmation email.",
    )}`,
  );
}
