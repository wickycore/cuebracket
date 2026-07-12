import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_#123047_0%,_#07111e_42%,_#020617_100%)] px-5 text-white">
      <div className="w-full max-w-md py-10">
        <Link href="/" className="font-black text-cyan-300">
          ← CueBracket Pro
        </Link>
        <p className="mt-10 text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
          Create organizer account
        </p>
        <h1 className="mt-3 text-4xl font-black">Take CueBracket online.</h1>
        <p className="mt-3 text-slate-400">
          Your tournaments will be protected, backed up and visible live.
        </p>
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
        <p className="mt-5 text-center text-sm text-slate-400">
          Already registered?{" "}
          <Link href="/auth/login" className="font-black text-cyan-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
