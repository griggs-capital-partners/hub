"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Users, UserPlus, Trash2, Loader2, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { timeAgo } from "@/lib/utils";

interface TeamInvite {
  id: string;
  email: string;
  createdAt: string;
  usedAt: string | null;
}

export default function TeamSettingsPage() {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invite")
      .then((r) => r.json())
      .then((d) => setInvites(d.invites ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInvites((prev) => [data.invite, ...prev]);
      setEmail("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add invite");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    await fetch("/api/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  const pendingCount = invites.filter((i) => !i.usedAt).length;
  const usedCount = invites.filter((i) => i.usedAt).length;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-bold text-[#F0F0F0] flex items-center gap-2.5">
          <Users size={17} className="text-[#F7941D]" />
          Team
        </h2>
        <p className="text-sm text-[#505050] mt-1">
          Manage who can join your SmartHub workspace.
        </p>
      </div>

      {/* Invites section */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-[#111111] border-b border-[rgba(255,255,255,0.05)]">
          <div>
            <div className="flex items-center gap-2">
              <UserPlus size={14} className="text-[#F7941D]" />
              <span className="text-sm font-semibold text-[#D0D0D0]">Pre-authorized Emails</span>
            </div>
            <p className="text-xs text-[#505050] mt-0.5">
              Only emails on this list can create an account.
            </p>
          </div>
          <Button
            size="sm"
            variant={showForm ? "secondary" : "primary"}
            icon={showForm ? <ChevronUp size={13} /> : <UserPlus size={13} />}
            onClick={() => { setShowForm(!showForm); setError(null); }}
            className="flex-shrink-0"
          >
            {showForm ? "Cancel" : "Add Email"}
          </Button>
        </div>

        {/* Add form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <form
                onSubmit={handleInvite}
                className="px-5 py-4 bg-[#0F0F0F] border-b border-[rgba(255,255,255,0.05)] space-y-3"
              >
                <p className="text-xs font-semibold text-[#F7941D] uppercase tracking-wider">
                  Invite a teammate
                </p>
                <p className="text-xs text-[#505050]">
                  They&apos;ll visit the login page, open the &quot;Create Account&quot; tab, and sign up
                  with this email.
                </p>
                {error && (
                  <p className="text-xs text-[#EF4444] bg-[rgba(239,68,68,0.08)] px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label="Email address"
                      type="email"
                      placeholder="teammate@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={creating}
                    type="submit"
                    icon={<UserPlus size={13} />}
                    className="mb-0.5"
                  >
                    Add
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        {!loading && invites.length > 0 && (
          <div className="flex gap-6 px-5 py-3 bg-[#0D0D0D] border-b border-[rgba(255,255,255,0.04)]">
            <div>
              <span className="text-[11px] text-[#404040] uppercase tracking-wider">Pending</span>
              <span className="ml-2 text-sm font-semibold text-[#D0D0D0]">{pendingCount}</span>
            </div>
            <div>
              <span className="text-[11px] text-[#404040] uppercase tracking-wider">Signed up</span>
              <span className="ml-2 text-sm font-semibold text-[#22C55E]">{usedCount}</span>
            </div>
          </div>
        )}

        {/* Invite list */}
        <div className="bg-[#0D0D0D]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-[#404040]" />
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-10 px-5">
              <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center mx-auto mb-3">
                <UserPlus size={16} className="text-[#404040]" />
              </div>
              <p className="text-sm text-[#404040]">No invites yet</p>
              <p className="text-xs text-[#303030] mt-1">
                Add an email above to allow someone to sign up.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.03)]">
              {invites.map((invite, i) => (
                <motion.div
                  key={invite.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgba(255,255,255,0.015)] transition-colors group"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      invite.usedAt ? "bg-[rgba(34,197,94,0.1)]" : "bg-[#1A1A1A]"
                    }`}
                  >
                    <UserPlus
                      size={12}
                      className={invite.usedAt ? "text-[#22C55E]" : "text-[#505050]"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#D0D0D0] truncate">{invite.email}</div>
                    <div className="text-xs text-[#404040]">
                      Added {timeAgo(new Date(invite.createdAt))}
                    </div>
                  </div>
                  {invite.usedAt ? (
                    <span className="text-xs px-2 py-0.5 bg-[rgba(34,197,94,0.1)] text-[#22C55E] rounded-full font-medium flex-shrink-0">
                      Signed up
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-[rgba(255,255,255,0.04)] text-[#505050] rounded-full font-medium flex-shrink-0">
                      Pending
                    </span>
                  )}
                  <button
                    onClick={() => handleRevoke(invite.id)}
                    className="p-1.5 text-[#404040] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] rounded-lg transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                    title="Revoke invite"
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
