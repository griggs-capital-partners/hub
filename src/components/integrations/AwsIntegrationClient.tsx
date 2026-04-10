"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Trash2,
  ExternalLink,
  X,
  Check,
  AlertCircle,
  Cloud,
  Server,
  Eye,
  Globe,
  Database,
  Zap,
  Box,
  HelpCircle,
  Layers,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AwsLink {
  id: string;
  repoId: string;
  service: string;
  resourceId: string;
  label: string;
  region: string | null;
}

export interface RepoWithLinks {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  awsLinks: AwsLink[];
}

interface Props {
  awsAccount: {
    accessKeyId: string; // masked: "AKIA...WXYZ"
    region: string;
  } | null;
  repos: RepoWithLinks[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU (Ireland)" },
  { value: "eu-west-2", label: "EU (London)" },
  { value: "eu-central-1", label: "EU (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
];

const AWS_SERVICES = [
  { value: "ec2", label: "EC2 Instance", placeholder: "i-0abc123def456" },
  { value: "amplify", label: "Amplify App", placeholder: "d1abc123xyz" },
  { value: "ecs", label: "ECS Cluster", placeholder: "arn:aws:ecs:us-east-2:123456789:cluster/my-cluster" },
  { value: "ecs_instance", label: "ECS Instance", placeholder: "arn:aws:ecs:us-east-2:123456789:container-instance/my-cluster/abc123def456" },
  { value: "cloudwatch", label: "CloudWatch", placeholder: "/aws/lambda/my-function" },
  { value: "route53", label: "Route 53", placeholder: "Z1ABC23DEFGHIJ" },
  { value: "s3", label: "S3 Bucket", placeholder: "my-bucket-name" },
  { value: "rds", label: "RDS Database", placeholder: "my-db-instance" },
  { value: "lambda", label: "Lambda Function", placeholder: "my-function-name" },
  { value: "other", label: "Other", placeholder: "ARN or resource ID" },
];

// ─── Service badge ────────────────────────────────────────────────────────────

const SERVICE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  ec2:         { icon: <Server size={11} />,   color: "text-[#60A5FA]",  bg: "bg-[rgba(96,165,250,0.1)]" },
  amplify:     { icon: <Zap size={11} />,      color: "text-[#FF9900]",  bg: "bg-[rgba(255,153,0,0.1)]" },
  ecs:         { icon: <Layers size={11} />,   color: "text-[#38BDF8]",  bg: "bg-[rgba(56,189,248,0.1)]" },
  ecs_instance:{ icon: <Server size={11} />,   color: "text-[#7DD3FC]",  bg: "bg-[rgba(125,211,252,0.1)]" },
  cloudwatch:  { icon: <Eye size={11} />,      color: "text-[#A78BFA]",  bg: "bg-[rgba(167,139,250,0.1)]" },
  route53:     { icon: <Globe size={11} />,    color: "text-[#34D399]",  bg: "bg-[rgba(52,211,153,0.1)]" },
  s3:          { icon: <Box size={11} />,      color: "text-[#4ADE80]",  bg: "bg-[rgba(74,222,128,0.1)]" },
  rds:         { icon: <Database size={11} />, color: "text-[#818CF8]",  bg: "bg-[rgba(129,140,248,0.1)]" },
  lambda:      { icon: <Zap size={11} />,      color: "text-[#FBBF24]",  bg: "bg-[rgba(251,191,36,0.1)]" },
  other:       { icon: <Cloud size={11} />,    color: "text-[#9CA3AF]",  bg: "bg-[rgba(156,163,175,0.1)]" },
};

function ServiceBadge({ service }: { service: string }) {
  const meta = SERVICE_META[service] ?? SERVICE_META.other;
  const svc = AWS_SERVICES.find((s) => s.value === service);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${meta.color} ${meta.bg}`}>
      {meta.icon}
      {svc?.label ?? service}
    </span>
  );
}

// ─── Link form modal ──────────────────────────────────────────────────────────

interface LinkFormState {
  repoId: string;
  repoName: string;
  service: string;
  resourceId: string;
  label: string;
  region: string;
}

function AddLinkModal({
  state,
  accountRegion,
  onClose,
  onSave,
}: {
  state: LinkFormState;
  accountRegion: string;
  onClose: () => void;
  onSave: (data: Omit<LinkFormState, "repoName">) => Promise<void>;
}) {
  const [form, setForm] = useState(state);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = AWS_SERVICES.find((s) => s.value === form.service);

  async function handleSave() {
    if (!form.label.trim() || !form.resourceId.trim()) {
      setError("Label and Resource ID are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        repoId: form.repoId,
        service: form.service,
        resourceId: form.resourceId,
        label: form.label,
        region: form.region,
      });
      onClose();
    } catch {
      setError("Failed to save link. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-[#161616] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <div>
            <h3 className="font-semibold text-[#F0F0F0] text-sm">Link AWS Resource</h3>
            <p className="text-xs text-[#606060] mt-0.5">{form.repoName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Service */}
          <div>
            <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">AWS Service</label>
            <div className="grid grid-cols-4 gap-1.5">
              {AWS_SERVICES.map((svc) => {
                const meta = SERVICE_META[svc.value] ?? SERVICE_META.other;
                const active = form.service === svc.value;
                return (
                  <button
                    key={svc.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, service: svc.value }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[10px] font-medium transition-all ${
                      active
                        ? `${meta.bg} ${meta.color} border-current border-opacity-40`
                        : "border-[rgba(255,255,255,0.06)] text-[#606060] hover:border-[rgba(255,255,255,0.12)] hover:text-[#9A9A9A]"
                    }`}
                  >
                    <span className={active ? meta.color : ""}>{meta.icon && <span className="scale-125 inline-block">{meta.icon}</span>}</span>
                    {svc.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder={`e.g. Production ${selectedService?.label ?? "Resource"}`}
              className="w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#404040] focus:outline-none focus:border-[rgba(255,153,0,0.4)] transition-colors"
            />
          </div>

          {/* Resource ID */}
          <div>
            <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">Resource ID / ARN</label>
            <input
              type="text"
              value={form.resourceId}
              onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))}
              placeholder={selectedService?.placeholder ?? "Resource ID or ARN"}
              className="w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#404040] font-mono focus:outline-none focus:border-[rgba(255,153,0,0.4)] transition-colors"
            />
          </div>

          {/* Region override */}
          <div>
            <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">
              Region <span className="text-[#404040] font-normal">(optional override)</span>
            </label>
            <select
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              className="w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(255,153,0,0.4)] transition-colors"
            >
              <option value="">Account default ({accountRegion})</option>
              {AWS_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label} — {r.value}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-[#EF4444] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] px-3 py-2 rounded-lg">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[rgba(255,255,255,0.06)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#9A9A9A] hover:text-[#F0F0F0] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#FF9900] text-black rounded-lg hover:bg-[#FFB347] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Save Link
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AwsIntegrationClient({ awsAccount: initialAccount, repos: initialRepos }: Props) {
  const [account, setAccount] = useState(initialAccount);
  const [repos, setRepos] = useState(initialRepos);

  // Connect form
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [connectForm, setConnectForm] = useState({ accessKeyId: "", secretAccessKey: "", region: "us-east-1" });
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Disconnect
  const [disconnecting, setDisconnecting] = useState(false);

  // Add link modal
  const [linkModal, setLinkModal] = useState<LinkFormState | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  // ── Connect ──────────────────────────────────────────────────────────────

  async function handleConnect() {
    if (!connectForm.accessKeyId.trim() || !connectForm.secretAccessKey.trim()) {
      setConnectError("Access Key ID and Secret Access Key are required.");
      return;
    }
    setConnecting(true);
    setConnectError(null);

    const res = await fetch("/api/aws/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connectForm),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setConnectError(data.error ?? "Failed to save credentials.");
      setConnecting(false);
      return;
    }

    // Mask the key for display
    const id = connectForm.accessKeyId.trim();
    const masked = id.length > 8 ? `${id.slice(0, 4)}...${id.slice(-4)}` : `${id.slice(0, 2)}...`;
    setAccount({ accessKeyId: masked, region: connectForm.region });
    setConnectForm({ accessKeyId: "", secretAccessKey: "", region: "us-east-1" });
    setShowConnectForm(false);
    setConnecting(false);
  }

  // ── Disconnect ───────────────────────────────────────────────────────────

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/aws/disconnect", { method: "DELETE" });
    setAccount(null);
    setDisconnecting(false);
  }

  // ── Add link ─────────────────────────────────────────────────────────────

  async function handleSaveLink(data: Omit<LinkFormState, "repoName">) {
    const res = await fetch("/api/aws/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save link");
    const newLink: AwsLink = await res.json();
    setRepos((prev) =>
      prev.map((p) =>
        p.id === data.repoId ? { ...p, awsLinks: [...p.awsLinks, newLink] } : p
      )
    );
  }

  // ── Delete link ──────────────────────────────────────────────────────────

  async function handleDeleteLink(linkId: string, repoId: string) {
    setDeletingLinkId(linkId);
    await fetch(`/api/aws/links/${linkId}`, { method: "DELETE" });
    setRepos((prev) =>
      prev.map((p) =>
        p.id === repoId ? { ...p, awsLinks: p.awsLinks.filter((l) => l.id !== linkId) } : p
      )
    );
    setDeletingLinkId(null);
  }

  const totalLinks = repos.reduce((sum, p) => sum + p.awsLinks.length, 0);
  const linkedProjectCount = repos.filter((p) => p.awsLinks.length > 0).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back nav */}
      <Link
        href="/integrations"
        className="inline-flex items-center gap-1.5 text-xs text-[#606060] hover:text-[#F0F0F0] transition-colors"
      >
        <ChevronLeft size={14} />
        Integrations
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#1A1208] border border-[rgba(255,153,0,0.15)] flex items-center justify-center flex-shrink-0">
          <AwsLogo className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-black text-[#F0F0F0]">Amazon Web Services</h2>
          <p className="text-sm text-[#606060] mt-0.5">
            Connect your AWS account to link projects to their deployed infrastructure — EC2, Amplify, CloudWatch, and more.
          </p>
        </div>
      </div>

      {/* ── Connection panel ─────────────────────────────────────────── */}
      <div className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${account ? "bg-emerald-400" : "bg-[#404040]"}`} />
            <div>
              <div className="text-sm font-semibold text-[#F0F0F0]">
                {account ? "Account Connected" : "Not Connected"}
              </div>
              {account ? (
                <div className="text-xs text-[#606060] mt-0.5 font-mono">
                  {account.accessKeyId} · {account.region}
                </div>
              ) : (
                <div className="text-xs text-[#606060] mt-0.5">
                  Connect with an IAM access key to enable AWS features
                </div>
              )}
            </div>
          </div>

          {account ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConnectForm(true)}
                className="text-xs px-3 py-1.5 rounded-lg text-[#9A9A9A] border border-[rgba(255,255,255,0.08)] hover:text-[#F0F0F0] transition-all"
              >
                Rotate keys
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs px-3 py-1.5 rounded-lg text-[#EF4444] border border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.08)] disabled:opacity-50 transition-all"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConnectForm(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold bg-[#FF9900] text-black hover:bg-[#FFB347] transition-all"
            >
              <Plus size={13} />
              Connect
            </button>
          )}
        </div>

        {/* Connect form */}
        {showConnectForm && (
          <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-5 space-y-4">
            <div className="flex items-start gap-2 text-xs text-[#9A9A9A] bg-[rgba(255,153,0,0.06)] border border-[rgba(255,153,0,0.12)] rounded-xl px-3 py-2.5">
              <HelpCircle size={13} className="text-[#FF9900] flex-shrink-0 mt-0.5" />
              <span>
                Create a read-only IAM user with policies for EC2, Amplify, CloudWatch, Route53, S3, and RDS.
                Credentials are stored in your workspace and never shared.
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">Access Key ID</label>
                <input
                  type="text"
                  value={connectForm.accessKeyId}
                  onChange={(e) => setConnectForm((f) => ({ ...f, accessKeyId: e.target.value }))}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#404040] font-mono focus:outline-none focus:border-[rgba(255,153,0,0.4)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">Default Region</label>
                <select
                  value={connectForm.region}
                  onChange={(e) => setConnectForm((f) => ({ ...f, region: e.target.value }))}
                  className="w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] focus:outline-none focus:border-[rgba(255,153,0,0.4)] transition-colors"
                >
                  {AWS_REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label} — {r.value}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9A9A9A] mb-1.5">Secret Access Key</label>
              <input
                type="password"
                value={connectForm.secretAccessKey}
                onChange={(e) => setConnectForm((f) => ({ ...f, secretAccessKey: e.target.value }))}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                className="w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#404040] font-mono focus:outline-none focus:border-[rgba(255,153,0,0.4)] transition-colors"
              />
            </div>

            {connectError && (
              <div className="flex items-center gap-2 text-xs text-[#EF4444] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] px-3 py-2 rounded-lg">
                <AlertCircle size={13} />
                {connectError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowConnectForm(false); setConnectError(null); }}
                className="px-4 py-2 text-sm text-[#9A9A9A] hover:text-[#F0F0F0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#FF9900] text-black rounded-lg hover:bg-[#FFB347] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {connecting ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save Credentials
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Repo links section ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#F0F0F0]">Repo Deployments</h3>
            <p className="text-xs text-[#606060] mt-0.5">
              {totalLinks > 0
                ? `${totalLinks} linked resource${totalLinks !== 1 ? "s" : ""} across ${linkedProjectCount} repo${linkedProjectCount !== 1 ? "s" : ""}`
                : "Link repos to their AWS resources to track deployments from one place"}
            </p>
          </div>
        </div>

        {repos.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[rgba(255,255,255,0.06)] rounded-2xl">
            <Cloud size={28} className="text-[#404040] mx-auto mb-2" />
            <p className="text-sm text-[#606060]">No repos in workspace yet.</p>
            <Link href="/integrations/github" className="text-xs text-[#FF9900] hover:underline mt-1 inline-block">
              Sync repos via GitHub →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="bg-[#161616] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden"
              >
                {/* Repo header */}
                <div className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                      <ExternalLink size={13} className="text-[#606060]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#F0F0F0] truncate">{repo.name}</div>
                      <div className="text-xs text-[#404040] truncate font-mono">{repo.fullName}</div>
                    </div>
                  </div>
                  {account && (
                    <button
                      onClick={() =>
                        setLinkModal({
                          repoId: repo.id,
                          repoName: repo.name,
                          service: "ec2",
                          resourceId: "",
                          label: "",
                          region: "",
                        })
                      }
                      className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-[#FF9900] border border-[rgba(255,153,0,0.2)] hover:bg-[rgba(255,153,0,0.08)] transition-all"
                    >
                      <Plus size={12} />
                      Link resource
                    </button>
                  )}
                </div>

                {/* Linked resources */}
                {repo.awsLinks.length > 0 && (
                  <div className="border-t border-[rgba(255,255,255,0.04)] px-4 py-3 space-y-2">
                    {repo.awsLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ServiceBadge service={link.service} />
                          <span className="text-xs font-medium text-[#D0D0D0] truncate">{link.label}</span>
                          <span className="text-xs text-[#404040] font-mono truncate hidden sm:block">{link.resourceId}</span>
                          {link.region && (
                            <span className="text-[10px] text-[#404040] flex-shrink-0">{link.region}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteLink(link.id, repo.id)}
                          disabled={deletingLinkId === link.id}
                          className="flex-shrink-0 p-1 rounded text-[#606060] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all"
                          title="Remove link"
                        >
                          {deletingLinkId === link.id ? (
                            <span className="inline-block w-3 h-3 border border-[#606060] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {repo.awsLinks.length === 0 && (
                  <div className="border-t border-[rgba(255,255,255,0.04)] px-4 py-3">
                    <span className="text-xs text-[#404040]">No resources linked yet</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add link modal */}
      {linkModal && (
        <AddLinkModal
          state={linkModal}
          accountRegion={account?.region ?? "us-east-1"}
          onClose={() => setLinkModal(null)}
          onSave={handleSaveLink}
        />
      )}
    </div>
  );
}

// ─── AWS Logo SVG ─────────────────────────────────────────────────────────────

function AwsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 48" fill="none" className={className} aria-label="AWS">
      {/* Amazon Web Services simplified wordmark / smile logo */}
      <path
        d="M22.4 19.2c0 .8.1 1.4.2 1.9.2.4.4.9.7 1.4.1.2.2.4.2.5 0 .2-.1.4-.4.7l-1.3.9c-.2.1-.4.2-.5.2-.2 0-.4-.1-.6-.3-.3-.3-.5-.6-.7-1-.2-.4-.4-.8-.6-1.4-1.4 1.7-3.2 2.5-5.3 2.5-1.5 0-2.7-.4-3.6-1.3-.9-.9-1.3-2-1.3-3.4 0-1.5.5-2.7 1.6-3.7 1.1-.9 2.5-1.4 4.3-1.4.6 0 1.2.1 1.8.2.7.1 1.3.3 2 .5v-1.3c0-1.3-.3-2.3-.8-2.8-.6-.5-1.5-.8-2.9-.8-.6 0-1.3.1-1.9.3-.7.2-1.3.4-1.9.7-.3.1-.5.2-.6.2-.2 0-.3-.2-.3-.5V11c0-.3 0-.5.1-.6.1-.1.3-.3.6-.4.6-.3 1.3-.6 2.2-.8.9-.2 1.8-.3 2.8-.3 2.1 0 3.7.5 4.6 1.5.9 1 1.4 2.5 1.4 4.5v5.8zm-7.3 2.7c.6 0 1.2-.1 1.8-.4.6-.3 1.1-.7 1.5-1.4.3-.4.4-.9.5-1.4.1-.5.1-1 .1-1.7v-.8c-.5-.1-1-.2-1.6-.3-.5-.1-1-.1-1.5-.1-1.1 0-1.9.2-2.4.7-.5.4-.8 1.1-.8 1.9 0 .8.2 1.4.6 1.8.4.4 1 .7 1.8.7zm12.8 1.7c-.3 0-.5-.1-.7-.2-.1-.1-.3-.4-.4-.8l-4-13.2c-.1-.4-.2-.7-.2-.8 0-.3.2-.5.5-.5h2c.3 0 .6.1.7.2.2.1.3.4.4.8l2.9 11.3 2.7-11.3c.1-.4.2-.7.4-.8.2-.1.4-.2.8-.2h1.6c.3 0 .6.1.8.2.2.1.3.4.4.8l2.7 11.4 3-11.4c.1-.4.3-.7.4-.8.2-.1.4-.2.7-.2h1.9c.3 0 .5.2.5.5 0 .1 0 .2-.1.4 0 .2-.1.3-.2.5l-4.1 13.2c-.1.4-.3.7-.4.8-.2.1-.4.2-.7.2h-1.7c-.3 0-.6-.1-.8-.2-.2-.1-.3-.4-.4-.8L34 12.9l-2.6 10.7c-.1.4-.2.7-.4.8-.2.1-.4.2-.8.2h-2.3zM53 24c-.7 0-1.4-.1-2.1-.3-.7-.2-1.2-.4-1.6-.6-.2-.1-.4-.3-.4-.5V21c0-.3.1-.5.4-.5.1 0 .2 0 .3.1l.5.2c.6.3 1.2.5 1.9.6.7.1 1.3.2 1.9.2 1 0 1.8-.2 2.3-.5.5-.4.8-.9.8-1.5 0-.4-.1-.8-.4-1.1-.3-.3-.9-.6-1.7-.9l-2.4-.8c-1.2-.4-2.1-.9-2.7-1.7-.6-.7-.9-1.6-.9-2.5 0-.7.2-1.4.5-1.9.3-.6.8-1.1 1.4-1.5.6-.4 1.2-.7 2-.9.7-.2 1.5-.3 2.3-.3.4 0 .8 0 1.3.1.4.1.8.2 1.2.3.4.1.7.2.9.4.3.1.5.3.6.4.1.2.2.4.2.6v1.5c0 .3-.1.5-.4.5-.1 0-.3-.1-.6-.2-1-.5-2.1-.7-3.3-.7-.9 0-1.7.2-2.1.5-.5.3-.7.8-.7 1.4 0 .4.2.8.5 1.1.3.3.9.6 1.9.9l2.3.8c1.2.4 2 .9 2.6 1.6.6.7.8 1.5.8 2.4 0 .7-.1 1.4-.4 2-.3.6-.7 1.1-1.3 1.5-.6.4-1.2.7-2 .9-.8.2-1.7.3-2.6.3z"
        fill="#FF9900"
      />
      {/* Smile arrow */}
      <path
        d="M52.5 32.1c-7.5 5.5-18.3 8.5-27.6 8.5-13.1 0-24.8-4.8-33.7-12.8-.7-.6-.1-1.5.8-1 9.6 5.6 21.4 8.9 33.6 8.9 8.2 0 17.3-1.7 25.6-5.2 1.3-.5 2.3.8 1.3 1.6z"
        fill="#FF9900"
      />
      <path
        d="M55.7 28.5c-.9-1.2-6.2-.6-8.6-.3-.7.1-.8-.5-.2-.9 4.2-2.9 11.1-2.1 11.9-1.1.8 1-.2 7.9-4.1 11.2-.6.5-1.2.2-.9-.4.9-2.1 2.9-7.3 1.9-8.5z"
        fill="#FF9900"
      />
    </svg>
  );
}
