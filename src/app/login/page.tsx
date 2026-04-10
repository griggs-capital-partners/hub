"use client";

import { authClient } from "@/lib/auth-client";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, GitBranch, Users, Sparkles, BarChart3, LogIn, UserPlus, ArrowLeft, Mail } from "lucide-react";

const FEATURES = [
  { icon: GitBranch, label: "Connected Workflows", desc: "Bring your team into one shared space" },
  { icon: BarChart3, label: "Clear Visibility", desc: "Stay aligned on priorities and progress" },
  { icon: Users, label: "Team Collaboration", desc: "Keep people, plans, and updates together" },
  { icon: Sparkles, label: "Focused Execution", desc: "Start the day with clarity and momentum" },
];

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

    // Initial sign-up — redirecting to dashboard immediately.
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
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="w-full max-w-sm"
    >
      {/* Mobile logo */}
      <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
        <div className="w-10 h-10 rounded-xl overflow-hidden">
          <Image src="/logo.png" alt="Griggs Capital Partners" width={40} height={40} style={{ width: 40, height: 40 }} />
        </div>
        <div>
          <div className="text-xs font-bold text-[#F7941D] tracking-widest uppercase">Griggs Capital Partners</div>
          <div className="text-xl font-black text-[#F0F0F0]">Smart Hub</div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#F0F0F0] mb-2">Welcome</h1>
        <p className="text-[#9A9A9A] text-sm">Sign in or create your invited account</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-[#1A1A1A] rounded-xl border border-[rgba(255,255,255,0.06)]">
        {(["signin", "signup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setMode("signin");
              setError(null);
              setNotice(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${tab === t
                ? "bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D]"
                : "text-[#606060] hover:text-[#F0F0F0]"
              }`}
          >
            {t === "signin" ? <LogIn size={14} /> : <UserPlus size={14} />}
            {t === "signin" ? "Sign In" : "Join Team"}
          </button>
        ))}
      </div>

      {/* Errors */}
      {(oauthError || error) && (
        <motion.div
          key={error ?? oauthError}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-xl mb-4 text-sm text-[#EF4444]"
        >
          {error ?? oauthError}
        </motion.div>
      )}

      {(resetStatus === "success" || notice) && (
        <motion.div
          key={notice ?? resetStatus}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] rounded-xl mb-4 text-sm text-[#86EFAC]"
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
              <div className="p-3 bg-[rgba(247,148,29,0.08)] border border-[rgba(247,148,29,0.15)] rounded-xl text-xs text-[#9A9A9A]">
                Enter your email and we&apos;ll send you a password reset link.
              </div>
            )}
            <input
              type="email"
              placeholder={mode === "forgot" ? "Work email address" : "Email address"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D] transition-all"
            />
            {mode === "signin" && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D] transition-all"
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
                  className="inline-flex items-center gap-2 text-xs text-[#9A9A9A] hover:text-[#F0F0F0] transition-colors"
                >
                  <ArrowLeft size={13} />
                  Back to sign in
                </button>
              ) : (
                <span className="text-xs text-[#505050]">Use your team email and password</span>
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
                  className="text-xs font-medium text-[#F7941D] hover:text-[#FBBA00] transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <motion.button
              whileHover={{ scale: 1.01, boxShadow: "0 0 30px rgba(247,148,29,0.2)" }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D] font-bold py-3.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : mode === "forgot" ? <Mail size={18} /> : <LogIn size={18} />}
              {loading ? (mode === "forgot" ? "Sending email..." : "Signing in...") : mode === "forgot" ? "Send Reset Email" : "Sign In"}
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
                <div className="p-3 bg-[rgba(247,148,29,0.08)] border border-[rgba(247,148,29,0.15)] rounded-xl text-xs text-[#9A9A9A]">
                  Your email must be on the invite list. Contact an admin if you need access.
                </div>
                <input
                  type="email"
                  placeholder="Invited email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D] transition-all"
                />
                <motion.button
                  whileHover={{ scale: 1.01, boxShadow: "0 0 30px rgba(247,148,29,0.2)" }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D] font-bold py-3.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Continue"}
                </motion.button>
              </form>
            )}

            {signupStep === 2 && (
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSignupStep(1)}
                    className="text-xs text-[#606060] hover:text-[#F7941D] transition-colors"
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
                  className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D] transition-all"
                />
                <input
                  type="password"
                  placeholder="Choose a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D] transition-all"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D] transition-all"
                />
                <motion.button
                  whileHover={{ scale: 1.01, boxShadow: "0 0 30px rgba(247,148,29,0.2)" }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#F7941D] to-[#FBBA00] text-[#0D0D0D] font-bold py-3.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {loading ? "Creating account..." : "Join Team"}
                </motion.button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-xs text-[#404040] mt-6">
        © {new Date().getFullYear()} Griggs Capital Partners. Smart Hub.
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex overflow-hidden relative">
      {/* Ambient orbs */}
      {[
        { top: "10%", left: "5%", size: 300, color: "rgba(247,148,29,0.08)", delay: 0 },
        { top: "60%", right: "5%", size: 250, color: "rgba(251,186,0,0.06)", delay: 1.5 },
        { bottom: "10%", left: "30%", size: 200, color: "rgba(123,28,36,0.1)", delay: 0.8 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            top: (orb as { top?: string }).top,
            left: (orb as { left?: string }).left,
            right: (orb as { right?: string }).right,
            bottom: (orb as { bottom?: string }).bottom,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 6, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
        />
      ))}

      {/* Left — Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-16 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl overflow-hidden">
            <Image src="/logo.png" alt="Griggs Capital Partners" width={48} height={48} style={{ width: 48, height: 48 }} />
          </div>
          <div>
            <div className="text-xs font-bold text-[#F7941D] tracking-[0.3em] uppercase">Griggs Capital Partners</div>
            <div className="text-2xl font-black text-[#F0F0F0] tracking-tight">Smart Hub</div>
          </div>
        </motion.div>

        <div className="space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <h2 className="text-5xl font-black text-[#F0F0F0] leading-tight mb-4">
              Your team&apos;s
              <br />
              <span className="text-gradient-ssf">command center.</span>
            </h2>
            <p className="text-lg text-[#9A9A9A] leading-relaxed max-w-md">
              A central hub for planning, coordination, and staying aligned across the work that moves your team forward.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                className="p-4 bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-xl"
              >
                <feature.icon size={20} className="text-[#F7941D] mb-2" />
                <div className="text-sm font-semibold text-[#F0F0F0]">{feature.label}</div>
                <div className="text-xs text-[#606060] mt-0.5">{feature.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs text-[#404040]"
        >
          © {new Date().getFullYear()} Griggs Capital Partners. Smart Hub.
        </motion.p>
      </div>

      {/* Divider */}
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.06)] to-transparent my-16" />

      {/* Right — Login */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
