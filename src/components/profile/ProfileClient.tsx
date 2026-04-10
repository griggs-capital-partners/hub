"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import {
  User, Camera, Pencil, X, Check, Loader2,
  Mail, Shield, Globe, MapPin, Building2, KeyRound, LockKeyhole,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PushNotificationsCard } from "@/components/profile/PushNotificationsCard";

export interface ProfileData {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string;
  image: string | null;
  role: string | null;
}

interface Props {
  initialProfile: ProfileData;
  isOwnProfile: boolean;
  canEdit?: boolean;
  mode?: "member" | "invite";
  inviteCreatedAt?: string | null;
}

export function ProfileClient({
  initialProfile,
  isOwnProfile,
  canEdit = isOwnProfile,
  mode = "member",
  inviteCreatedAt = null,
}: Props) {
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(initialProfile.displayName ?? initialProfile.name ?? "");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveName = profile.displayName || profile.name || "Team Member";
  const effectiveImage = profile.image;
  const isInviteProfile = mode === "invite";

  const saveDisplayName = async () => {
    if (!canEdit) return;
    setSaving(true);
    setNameError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, userId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile((current) => ({ ...current, displayName: data.user.displayName }));
      setEditingName(false);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = useCallback(async (file: File) => {
    if (!canEdit) return;
    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file.");
      return;
    }
    if (file.size > 300_000) {
      setAvatarError("Image must be under 300 KB.");
      return;
    }
    setAvatarUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, userId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile((current) => ({ ...current, image: data.user.image }));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarUploading(false);
    }
  }, [canEdit, profile.id]);

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !isOwnProfile || isInviteProfile) return;

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);

    try {
      const result = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      });

      const data = await result.json().catch(() => null);
      if (!result.ok) {
        throw new Error(data?.message ?? data?.error ?? "Unable to update password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="mb-2">
        <h1 className="text-2xl font-black text-[#F0F0F0] flex items-center gap-3">
          <User size={22} className="text-[#F7941D]" />
          {isOwnProfile ? "Your Profile" : "Team Profile"}
        </h1>
        <p className="text-sm text-[#606060] mt-0.5">
          {isInviteProfile
            ? "Preview invited teammate details before they join the workspace"
            : isOwnProfile
              ? "Manage your identity and personal workspace settings"
              : "View team member identity and workspace details"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="overflow-hidden">
            <div className="h-24 bg-gradient-to-br from-[#F7941D] to-[#7B1C24]" />
            <CardBody className="relative pt-0 flex flex-col items-center">
              <div className="relative -mt-12 group">
                <Avatar
                  src={effectiveImage}
                  name={effectiveName}
                  size="lg"
                  className="w-24 h-24 border-4 border-[#111111] shadow-xl"
                />
                {canEdit && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                  >
                    {avatarUploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                  </button>
                )}
                {canEdit && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarFile(file);
                      e.target.value = "";
                    }}
                  />
                )}
              </div>

              <div className="mt-4 text-center">
                <h2 className="text-xl font-bold text-[#F0F0F0]">{effectiveName}</h2>
                <div className="text-sm text-[#9A9A9A] mt-1">{profile.email}</div>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-[rgba(247,148,29,0.1)] text-[#F7941D] rounded-full text-xs font-bold uppercase tracking-wider">
                  <Shield size={12} />
                  {isInviteProfile ? "Invited" : profile.role || "Member"}
                </div>
                {isInviteProfile && inviteCreatedAt && (
                  <div className="mt-3 text-xs text-[#606060]">
                    Invited {new Date(inviteCreatedAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              {avatarError && (
                <div className="mt-4 w-full p-2.5 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-lg text-xs text-[#EF4444] text-center">
                  {avatarError}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-bold text-[#606060] uppercase tracking-widest">Metadata</span>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Building2 size={16} className="text-[#404040]" />
                <span className="text-[#9A9A9A]">{isInviteProfile ? "Pending workspace member" : "Griggs Capital Partners"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={16} className="text-[#404040]" />
                <span className="text-[#9A9A9A]">Hybrid / Remote</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Globe size={16} className="text-[#404040]" />
                <span className="text-[#9A9A9A]">UTC -04:00</span>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center gap-2">
                <Pencil size={15} className="text-[#F7941D]" />
                <span className="text-sm font-bold text-[#F0F0F0]">Identity Settings</span>
              </div>
            </CardHeader>
            <CardBody className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#9A9A9A]">Display Name</label>
                  <div className="flex items-center gap-3">
                    <AnimatePresence mode="wait">
                      {canEdit && editingName ? (
                        <motion.div
                          key="editing"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="flex-1 flex items-center gap-2"
                        >
                          <input
                            autoFocus
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveDisplayName();
                              if (e.key === "Escape") {
                                setEditingName(false);
                                setDisplayName(profile.displayName ?? profile.name ?? "");
                              }
                            }}
                            className="flex-1 bg-[#1A1A1A] border border-[#F7941D] rounded-lg px-4 py-2 text-sm text-[#F0F0F0] focus:outline-none"
                            placeholder="Type name..."
                          />
                          <Button size="sm" variant="primary" loading={saving} onClick={saveDisplayName}>
                            Save Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingName(false);
                              setDisplayName(profile.displayName ?? profile.name ?? "");
                              setNameError(null);
                            }}
                          >
                            <X size={16} />
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="display"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex-1 flex items-center justify-between bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-2"
                        >
                          <span className="text-sm text-[#F0F0F0]">{effectiveName}</span>
                          <div className="flex items-center gap-2">
                            {canEdit && nameSaved && <Check size={14} className="text-[#22C55E]" />}
                            {canEdit ? (
                              <button
                                onClick={() => setEditingName(true)}
                                className="p-1 text-[#606060] hover:text-[#F7941D] transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                            ) : (
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#606060]">Read only</span>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {nameError && <p className="text-xs text-[#EF4444] mt-1">{nameError}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#9A9A9A]">Email Address</label>
                  <div className="flex items-center justify-between bg-[#1A1A1A] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-2 opacity-60">
                    <span className="text-sm text-[#F0F0F0]">{profile.email}</span>
                    <Mail size={14} className="text-[#606060]" />
                  </div>
                  <p className="text-[10px] text-[#606060]">Controlled by auth provider settings</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-[#F7941D]" />
                <span className="text-sm font-bold text-[#F0F0F0]">Security & Access</span>
              </div>
            </CardHeader>
            <CardBody className="p-6">
              <div className="space-y-4">
                <div className="p-4 bg-[rgba(247,148,29,0.03)] border border-[rgba(247,148,29,0.1)] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#F0F0F0]">GitHub Integration</p>
                      <p className="text-xs text-[#9A9A9A] mt-1">
                        {isInviteProfile ? "Status: Awaiting account creation" : isOwnProfile ? "Status: Connected" : "Private to account owner"}
                      </p>
                    </div>
                    {canEdit ? (
                      <Button variant="secondary" size="sm" onClick={() => { window.location.href = "/integrations"; }}>
                        Manage
                      </Button>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#606060]">Read only</span>
                    )}
                  </div>
                </div>
                {isOwnProfile && !isInviteProfile ? (
                  <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] p-4">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-[#F0F0F0]">
                          <LockKeyhole size={15} className="text-[#F7941D]" />
                          Change Password
                        </div>
                        <p className="mt-1 text-xs text-[#8A8A8A]">
                          Update your password here. Other active sessions will be signed out for safety.
                        </p>
                      </div>
                      {passwordSaved && <span className="text-xs font-semibold text-[#86EFAC]">Saved</span>}
                    </div>

                    <form onSubmit={handlePasswordChange} className="space-y-3">
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        placeholder="Current password"
                        required
                        className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D]"
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="New password"
                        required
                        minLength={8}
                        className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D]"
                      />
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        placeholder="Confirm new password"
                        required
                        minLength={8}
                        className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] placeholder:text-[#606060] focus:outline-none focus:border-[#F7941D]"
                      />
                      {passwordError && <p className="text-xs text-[#FCA5A5]">{passwordError}</p>}
                      {passwordSaved && <p className="text-xs text-[#86EFAC]">Your password was updated successfully.</p>}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-[11px] text-[#606060]">Minimum 8 characters. Traditional email/password only.</p>
                        <Button type="submit" size="sm" variant="primary" loading={passwordSaving} icon={!passwordSaving ? <KeyRound size={14} /> : undefined}>
                          Save Password
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <p className="text-xs text-[#606060]">
                    {isInviteProfile
                      ? "This invited teammate has not created their account yet, so these details are only a prefilled preview."
                      : "Authentication and security settings are only editable by the account owner."}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {isOwnProfile && !isInviteProfile && <PushNotificationsCard />}
        </div>
      </div>
    </div>
  );
}
