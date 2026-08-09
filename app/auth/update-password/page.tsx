import Link from "next/link";
import { Suspense } from "react";

import { UpdatePasswordForm } from "@/components/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="min-h-dvh overflow-x-clip bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_28rem),radial-gradient(circle_at_90%_30%,rgba(59,130,246,0.12),transparent_30rem)]" />
      <div className="cb-safe-top cb-safe-bottom relative mx-auto grid min-h-dvh max-w-6xl items-start gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1fr_.92fr] lg:items-center lg:px-8">
        <section className="hidden lg:block">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-black text-cyan-300"
          >
            ← CueBracket Pro
          </Link>
          <p className="cb-kicker mt-12">Secure account recovery</p>
          <h1 className="mt-4 max-w-xl text-6xl font-black leading-[0.96] tracking-[-0.055em]">
            Choose a new password.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Finish recovering your organizer account, then continue managing your tournaments.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md pt-1 sm:pt-8 lg:pt-0">
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-cyan-300"
          >
            ← Back to sign in
          </Link>

          <p className="cb-kicker mt-8 lg:mt-10">Reset password</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Create a new password.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Enter your new password twice to secure your CueBracket account.
          </p>

          <Suspense fallback={<div className="mt-7 h-80 animate-pulse rounded-[2rem] bg-white/[0.04]" />}>
            <UpdatePasswordForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-slate-500">
            Need another reset link?{" "}
            <Link href="/auth/forgot-password" className="font-black text-cyan-300">
              Send a new one
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
