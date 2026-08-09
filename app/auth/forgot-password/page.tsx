import Link from "next/link";

import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
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
          <p className="cb-kicker mt-12">Account recovery</p>
          <h1 className="mt-4 max-w-xl text-6xl font-black leading-[0.96] tracking-[-0.055em]">
            Get back to your control room.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            We will send a secure password reset link to the email connected to your organizer account.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md pt-1 sm:pt-8 lg:pt-0">
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-cyan-300"
          >
            ← Back to sign in
          </Link>

          <p className="cb-kicker mt-8 lg:mt-10">Password recovery</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
            Forgot your password?
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Enter your account email and CueBracket will send you a reset link.
          </p>

          <ForgotPasswordForm />

          <p className="mt-6 text-center text-sm text-slate-500">
            Remembered it?{" "}
            <Link href="/auth/login" className="font-black text-cyan-300">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
