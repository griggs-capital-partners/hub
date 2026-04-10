"use client";

import { authClient } from "@/lib/auth-client";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ArrowLeft,
  ChartNoAxesColumn,
  Compass,
  Loader2,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

const PILLARS = [
  {
    icon: ShieldCheck,
    label: "Patient Capital",
    desc: "Built for disciplined decisions, aligned incentives, and long-term value creation.",
  },
  {
    icon: Compass,
    label: "Operator Perspective",
    desc: "A partner portal shaped around execution, clarity, and owner-operator realities.",
  },
  {
    icon: ChartNoAxesColumn,
    label: "Enduring Cash Flows",
    desc: "One place to keep priorities, reporting, and partnership communication in motion.",
  },
];

const fieldClassName =
  "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-[#F7F3EB] placeholder:text-[#9D9385] outline-none transition duration-200 focus:border-[#DCA24C] focus:bg-white/[0.06]";

function LoginForm() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const resetStatus = searchParams.get("reset");
  const oauthError = urlError ? "Sign in failed. Please try again." : null;

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        throw new Error((result.error as { message?: string }).message ?? "Unable to send reset email.");
      }

      setNotice("If that email is in our system, a password reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError("Incorrect email or password.");
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleEmailCheck(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/invite/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (data.allowed) {
        setSignupStep(2);
      } else {
        setError(data.error || "Email not on the invite list.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    const result = await authClient.signUp.email({ email, password, name });

    if (result.error) {
      const msg = (result.error as { message?: string }).message ?? "";
      if (msg.includes("invite list") || msg.includes("not on")) {
        setError(msg);
      } else if (msg.toLowerCase().includes("already")) {
        setError("An account with that email already exists. Try signing in.");
      } else {
        setError(msg || "Could not create account. Please try again.");
      }
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="w-full max-w-[520px]"
    >
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(25,22,19,0.96),rgba(15,13,12,0.96))] p-5 shadow-[0_32px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full border border-[#DCA24C]/25 bg-[#DCA24C]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E3B261]">
              Partner Portal
            </div>
            <h1 className="text-4xl leading-none font-black tracking-tight text-[#F7F3EB] sm:text-5xl">
              Access Griggs Hub
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#B7AC9B]">
              Secure sign-in for partners, operators, and invited team members working across the Griggs Capital ecosystem.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-3">
            <Image src="/logo.png" alt="Griggs Capital Partners" width={42} height={42} priority className="h-9 w-9 sm:h-[42px] sm:w-[42px]" />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-black/20 p-1">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setMode("signin");
                setError(null);
                setNotice(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${tab === t
                  ? "bg-[linear-gradient(135deg,#E0B35C_0%,#C8862A_100%)] text-[#17120E] shadow-[0_10px_30px_rgba(220,162,76,0.25)]"
                  : "text-[#A79D8F] hover:text-[#F7F3EB]"
                }`}
            >
              {t === "signin" ? <LogIn size={16} /> : <UserPlus size={16} />}
              {t === "signin" ? "Sign In" : "Request Access"}
            </button>
          ))}
        </div>

        {(oauthError || error) && (
          <motion.div
            key={error ?? oauthError}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-[#A64D45]/30 bg-[#A64D45]/10 p-3 text-sm text-[#F0B3AC]"
          >
            {error ?? oauthError}
          </motion.div>
        )}

        {(resetStatus === "success" || notice) && (
          <motion.div
            key={notice ?? resetStatus}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl border border-[#7C9A67]/30 bg-[#7C9A67]/10 p-3 text-sm text-[#CDE4B5]"
          >
            {notice ?? "Your password has been updated. Please sign in with your new password."}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {tab === "signin" ? (
            <motion.form
              key="signin"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              onSubmit={mode === "forgot" ? handleForgotPassword : handleSignIn}
              className="space-y-3"
            >
              {mode === "forgot" && (
                <div className="rounded-2xl border border-[#DCA24C]/20 bg-[#DCA24C]/10 p-3 text-xs leading-5 text-[#CBBCA7]">
                  Enter your email and we&apos;ll send a reset link to restore portal access.
                </div>
              )}

              <input
                type="email"
                placeholder={mode === "forgot" ? "Work email address" : "Email address"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={fieldClassName}
              />

              {mode === "signin" && (
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={fieldClassName}
                />
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                {mode === "forgot" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                      setNotice(null);
                    }}
                    className="inline-flex items-center gap-2 text-xs text-[#B7AC9B] transition-colors hover:text-[#F7F3EB]"
                  >
                    <ArrowLeft size={13} />
                    Back to sign in
                  </button>
                ) : (
                  <span className="text-xs text-[#8D8478]">Use your invited work email and password</span>
                )}

                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setPassword("");
                      setError(null);
                      setNotice(null);
                    }}
                    className="text-xs font-semibold text-[#E0B35C] transition-colors hover:text-[#F0C878]"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#E0B35C_0%,#C8862A_100%)] px-4 py-3.5 text-sm font-bold text-[#17120E] shadow-[0_16px_40px_rgba(200,134,42,0.2)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : mode === "forgot" ? <Mail size={18} /> : <LogIn size={18} />}
                {loading ? (mode === "forgot" ? "Sending email..." : "Signing in...") : mode === "forgot" ? "Send Reset Email" : "Enter Hub"}
              </motion.button>
            </motion.form>
          ) : (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {signupStep === 1 && (
                <form onSubmit={handleEmailCheck} className="space-y-3">
                  <div className="rounded-2xl border border-[#DCA24C]/20 bg-[#DCA24C]/10 p-3 text-xs leading-5 text-[#CBBCA7]">
                    Access is invitation-based. Confirm your email to continue with account setup.
                  </div>
                  <input
                    type="email"
                    placeholder="Invited email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={fieldClassName}
                  />
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-[#F7F3EB] transition-all duration-200 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Checking invitation..." : "Continue"}
                  </motion.button>
                </form>
              )}

              {signupStep === 2 && (
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSignupStep(1)}
                      className="text-xs text-[#B7AC9B] transition-colors hover:text-[#F0C878]"
                    >
                      ← {email}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={fieldClassName}
                  />
                  <input
                    type="password"
                    placeholder="Choose a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={fieldClassName}
                  />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className={fieldClassName}
                  />
                  <motion.button
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#E0B35C_0%,#C8862A_100%)] px-4 py-3.5 text-sm font-bold text-[#17120E] shadow-[0_16px_40px_rgba(200,134,42,0.2)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                    {loading ? "Creating account..." : "Create Portal Account"}
                  </motion.button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/8 pt-4 text-xs text-[#8D8478]">
          <span>Private access for invited partners and operators.</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#0B0908] text-[#F7F3EB]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,134,42,0.18),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(111,40,25,0.22),transparent_22%),linear-gradient(180deg,#15110E_0%,#0B0908_100%)]" />
      <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
      <div className="absolute inset-y-0 left-[58%] hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent xl:block" />

      <div className="relative z-10 flex min-h-screen items-center justify-center lg:grid lg:min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden overflow-hidden px-10 pb-10 pt-10 lg:flex lg:flex-col lg:justify-between lg:px-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4"
          >
            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
              <Image src="/logo.png" alt="Griggs Capital Partners" width={52} height={52} priority />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.38em] text-[#D7A24B]">Griggs Capital Partners</div>
              <div className="text-3xl font-black leading-none tracking-tight text-[#F7F3EB]">Griggs Hub</div>
            </div>
          </motion.div>

          <div className="py-6 lg:py-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.15 }}
              className="max-w-2xl"
            >
              <div className="mb-5 inline-flex items-center rounded-full border border-[#DCA24C]/25 bg-[#DCA24C]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E3B261]">
                Built for disciplined partnership
              </div>
              <h2 className="max-w-3xl text-5xl font-black leading-[0.92] tracking-tight text-[#F7F3EB] sm:text-6xl xl:text-[68px]">
                Built for
                <br />
                focused execution.
              </h2>

            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.28 }}
              className="mt-8 grid gap-4 md:grid-cols-3"
            >
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.label}
                  className="group rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-[#DCA24C]/25"
                >
                  <pillar.icon className="mb-4 text-[#D7A24B]" size={22} />
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#F7F3EB]">{pillar.label}</div>
                  <p className="mt-3 text-sm leading-6 text-[#AA9F91]">{pillar.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col gap-2 border-t border-white/8 pt-5 text-xs text-[#8D8478] sm:flex-row sm:items-center sm:justify-between"
          >
            <span>Private access for Griggs Capital Partners and invited collaborators.</span>
            <span className="hidden sm:inline">Real estate, energy, and public markets.</span>
          </motion.div>
        </section>

        <section className="flex min-h-screen w-full items-center justify-center px-4 py-6 sm:px-6 lg:min-h-0 lg:px-10 lg:py-8 xl:px-12">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
