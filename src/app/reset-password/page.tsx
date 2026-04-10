"use client";

import { authClient } from "@/lib/auth-client";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, LockKeyhole } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasToken = useMemo(() => typeof token === "string" && token.trim().length > 0, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!hasToken) {
      setError("This password reset link is missing its token. Please request a new email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token: token ?? undefined,
      });

      if (result.error) {
        throw new Error((result.error as { message?: string }).message ?? "Unable to reset password.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45 }}
      className="w-full max-w-md"
    >
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="h-11 w-11 overflow-hidden rounded-2xl">
          <Image src="/logo.png" alt="Griggs Capital Partners" width={44} height={44} style={{ width: 44, height: 44 }} />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#F7941D]">Griggs Capital Partners</div>
          <div className="text-xl font-black text-[#F0F0F0]">Reset Password</div>
        </div>
      </div>

      <div className="rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(17,17,17,0.92)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mb-6">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.12)] text-[#F7941D]">
            <LockKeyhole size={22} />
          </div>
          <h1 className="text-2xl font-black text-[#F0F0F0]">Choose a new password</h1>
          <p className="mt-2 text-sm leading-6 text-[#9A9A9A]">
            Keep it simple and secure. Once it&apos;s saved, you&apos;ll head back to sign in.
          </p>
        </div>

        {!hasToken && (
          <div className="mb-4 rounded-2xl border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-[#FCA5A5]">
            This reset link is incomplete or expired. Please return to login and request a fresh email.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] p-4 text-sm text-[#FCA5A5]">
            {error}
          </div>
        )}

        {success ? (
          <div className="rounded-2xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.08)] p-5 text-sm text-[#86EFAC]">
            <div className="flex items-center gap-3 font-semibold text-[#DCFCE7]">
              <CheckCircle2 size={18} />
              Password updated
            </div>
            <p className="mt-2 text-[#86EFAC]">Redirecting you back to login now.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#707070]">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a new password"
                minLength={8}
                required
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] outline-none transition-all focus:border-[#F7941D]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[#707070]">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your new password"
                minLength={8}
                required
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#151515] px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] outline-none transition-all focus:border-[#F7941D]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !hasToken}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#F7941D] to-[#FBBA00] px-4 py-3.5 text-sm font-bold text-[#0D0D0D] transition-all disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
              {loading ? "Updating password..." : "Save New Password"}
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-5">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-[#9A9A9A] transition-colors hover:text-[#F0F0F0]">
            <ArrowLeft size={15} />
            Back to login
          </Link>
          <span className="text-xs text-[#505050]">Internal use only</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0D0D0D] px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(247,148,29,0.1)_0%,transparent_70%)]" />
        <div className="absolute bottom-[10%] right-[8%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(123,28,36,0.14)_0%,transparent_70%)]" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(251,186,0,0.05)_0%,transparent_68%)]" />
      </div>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
