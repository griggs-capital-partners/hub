"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wifi, WifiOff, RefreshCw, ChevronRight, Settings2,
  Plus, Trash2, Save, Loader2, Copy, Check, MapPin, Shield,
  Database, Zap, AlertCircle, ChevronDown, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusData {
  mqtt: { connected: boolean };
  databases: Record<string, { connected: boolean; error?: string; label: string }>;
}

interface BrokerClient {
  username: string;
  clientid: string | null;
  roles: Array<{ rolename: string }>;
  groups: Array<{ groupname: string }>;
  disabled: boolean;
  matchedDatabase: string | null;
  matchedUser: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
  error?: string;
}

interface DbUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface CustomerDb {
  users: DbUser[];
  error: string | null;
  label: string;
}

interface DbConfig {
  name: string;
  label: string;
  host: string;
  dbName: string;
  user: string;
  pass: string;
}

interface PortalConfig {
  id?: string;
  mqttUrl: string;
  mqttUser: string;
  mqttPass: string;
  databases: DbConfig[];
}

// ─── Status Badges ────────────────────────────────────────────────────────────

function StatusBadges({ status }: { status: StatusData | null }) {
  if (!status) {
    return (
      <div className="flex items-center gap-2">
        <StatusBadge label="API" connected={false} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <StatusBadge label="MQTT" connected={status.mqtt.connected} />
      {Object.entries(status.databases).map(([, info]) => (
        <StatusBadge key={info.label} label={info.label} connected={info.connected} />
      ))}
    </div>
  );
}

function StatusBadge({ label, connected }: { label: string; connected: boolean }) {
  return (
    <span className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      connected
        ? "bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.2)] text-[#22C55E]"
        : "bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[#EF4444]"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        connected ? "bg-[#22C55E]" : "bg-[#EF4444]"
      )} />
      {label}
    </span>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ onConnected }: { onConnected: () => void }) {
  const [config, setConfig] = useState<PortalConfig>({
    mqttUrl: "", mqttUser: "", mqttPass: "", databases: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/mqtt-portal/config")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mqtt-portal/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save configuration");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      // Save first, then connect
      const saveRes = await fetch("/api/mqtt-portal/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!saveRes.ok) throw new Error("Failed to save configuration");

      const res = await fetch("/api/mqtt-portal/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      onConnected();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  function addDb() {
    setConfig((c) => ({
      ...c,
      databases: [...c.databases, { name: "", label: "", host: "", dbName: "", user: "", pass: "" }],
    }));
  }

  function removeDb(i: number) {
    setConfig((c) => ({ ...c, databases: c.databases.filter((_, idx) => idx !== i) }));
  }

  function updateDb(i: number, field: keyof DbConfig, value: string) {
    setConfig((c) => {
      const dbs = [...c.databases];
      dbs[i] = { ...dbs[i], [field]: value };
      return { ...c, databases: dbs };
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[#606060]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings2 size={16} className="text-[#F7941D]" />
        <h2 className="text-sm font-bold text-[#F0F0F0]">MQTT Portal Configuration</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-xl text-[#EF4444] text-sm">
          <AlertCircle size={14} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* MQTT Broker */}
      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
          <Zap size={14} className="text-[#F7941D]" />
          <span className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wider">MQTT Broker</span>
        </div>
        <ConfigField
          label="Broker URL"
          placeholder="mqtts://broker.example.com:8883"
          value={config.mqttUrl}
          onChange={(v) => setConfig((c) => ({ ...c, mqttUrl: v }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <ConfigField
            label="Username"
            placeholder="admin"
            value={config.mqttUser}
            onChange={(v) => setConfig((c) => ({ ...c, mqttUser: v }))}
          />
          <ConfigField
            label="Password"
            placeholder="••••••••"
            type="password"
            value={config.mqttPass}
            onChange={(v) => setConfig((c) => ({ ...c, mqttPass: v }))}
          />
        </div>
      </div>

      {/* Customer Databases */}
      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-[#F7941D]" />
            <span className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wider">Customer Databases</span>
          </div>
          <button
            onClick={addDb}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[rgba(247,148,29,0.1)] text-[#F7941D] hover:bg-[rgba(247,148,29,0.18)] transition-colors"
          >
            <Plus size={12} />
            Add Database
          </button>
        </div>

        {config.databases.length === 0 && (
          <p className="text-xs text-[#606060] text-center py-4">
            No customer databases configured. Add one above.
          </p>
        )}

        {config.databases.map((db, i) => (
          <div key={i} className="bg-[#111111] rounded-xl p-4 space-y-3 border border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#9A9A9A]">Database {i + 1}</span>
              <button
                onClick={() => removeDb(i)}
                className="p-1 text-[#606060] hover:text-[#EF4444] transition-colors rounded"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ConfigField label="Internal name" placeholder="martin" value={db.name}
                onChange={(v) => updateDb(i, "name", v)} />
              <ConfigField label="Display label" placeholder="Martin" value={db.label}
                onChange={(v) => updateDb(i, "label", v)} />
            </div>
            <ConfigField label="Host" placeholder="db.example.com" value={db.host}
              onChange={(v) => updateDb(i, "host", v)} />
            <ConfigField label="Database name" placeholder="mydb" value={db.dbName}
              onChange={(v) => updateDb(i, "dbName", v)} />
            <div className="grid grid-cols-2 gap-3">
              <ConfigField label="Username" placeholder="postgres" value={db.user}
                onChange={(v) => updateDb(i, "user", v)} />
              <ConfigField label="Password" placeholder="••••••••" type="password" value={db.pass}
                onChange={(v) => updateDb(i, "pass", v)} />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            "border border-[rgba(255,255,255,0.1)] text-[#9A9A9A] hover:text-[#F0F0F0] hover:border-[rgba(255,255,255,0.2)]",
            saving && "opacity-50 cursor-not-allowed"
          )}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} className="text-[#22C55E]" /> : <Save size={14} />}
          {saved ? "Saved!" : "Save"}
        </button>
        <button
          onClick={handleConnect}
          disabled={connecting || !config.mqttUrl}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all",
            "bg-[#F7941D] text-[#0D0D0D] hover:bg-[#e8830a]",
            (connecting || !config.mqttUrl) && "opacity-50 cursor-not-allowed"
          )}
        >
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
          {connecting ? "Connecting…" : "Save & Connect"}
        </button>
      </div>
    </div>
  );
}

function ConfigField({
  label, placeholder, value, onChange, type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#606060]">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0D0D0D] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#404040] focus:outline-none focus:border-[rgba(247,148,29,0.4)] transition-colors"
      />
    </div>
  );
}

// ─── Broker Clients Tab ───────────────────────────────────────────────────────

function BrokerClientsTab() {
  const [clients, setClients] = useState<BrokerClient[]>([]);
  const [filtered, setFiltered] = useState<BrokerClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchClients = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/mqtt-portal/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load clients");
      setClients(data.clients || []);
      setFiltered(data.clients || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(clients); return; }
    const q = search.toLowerCase();
    setFiltered(clients.filter((c) => {
      const searchable = [
        c.username, c.clientid, c.matchedDatabase,
        c.matchedUser?.email, c.matchedUser?.first_name, c.matchedUser?.last_name,
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(q);
    }));
  }, [search, clients]);

  function handleRefresh() {
    setRefreshing(true);
    setLoading(true);
    fetchClients();
  }

  if (loading) return <LoadingState text="Loading broker clients…" />;
  if (error) return <ErrorState message={error} onRetry={handleRefresh} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#606060]" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-lg pl-9 pr-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#404040] focus:outline-none focus:border-[rgba(247,148,29,0.3)] transition-colors"
          />
        </div>
        <span className="text-xs text-[#606060] whitespace-nowrap">{filtered.length} clients</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-[#606060] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-all"
        >
          <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
        </button>
      </div>

      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                {["Username", "Client ID", "Status", "Roles", "Database", "Matched User"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#606060] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#606060] text-sm">
                    No clients found
                  </td>
                </tr>
              ) : filtered.map((c) => (
                <tr key={c.username} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#F0F0F0]">{c.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#9A9A9A]">
                    {c.clientid ?? <span className="text-[#404040]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.error ? (
                      <span className="px-2 py-0.5 bg-[rgba(239,68,68,0.1)] text-[#EF4444] rounded-full text-xs">Error</span>
                    ) : c.disabled ? (
                      <span className="px-2 py-0.5 bg-[rgba(255,255,255,0.06)] text-[#606060] rounded-full text-xs">Disabled</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[rgba(34,197,94,0.1)] text-[#22C55E] rounded-full text-xs">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.roles.length === 0 ? <span className="text-[#404040]">—</span> : c.roles.map((r) => (
                        <span key={r.rolename} className="px-1.5 py-0.5 bg-[rgba(99,102,241,0.12)] text-[#818CF8] rounded text-xs font-mono">
                          {r.rolename}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.matchedDatabase ? (
                      <span className="px-2 py-0.5 bg-[rgba(247,148,29,0.1)] text-[#F7941D] rounded-full text-xs capitalize">
                        {c.matchedDatabase}
                      </span>
                    ) : (
                      <span className="text-[#404040] text-xs">No match</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.matchedUser ? (
                      <div>
                        <div className="text-xs text-[#F0F0F0]">
                          {[c.matchedUser.first_name, c.matchedUser.last_name].filter(Boolean).join(" ") || c.matchedUser.id}
                        </div>
                        {c.matchedUser.email && (
                          <div className="text-xs text-[#606060]">{c.matchedUser.email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#404040]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── User Roles Tab ───────────────────────────────────────────────────────────

function UserRolesTab() {
  const [usersByDb, setUsersByDb] = useState<Record<string, CustomerDb>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<(DbUser & { _db: string }) | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/mqtt-portal/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsersByDb(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleRefresh() {
    setRefreshing(true);
    setLoading(true);
    setSelectedUser(null);
    fetchUsers();
  }

  if (loading) return <LoadingState text="Loading users…" />;
  if (error) return <ErrorState message={error} onRetry={handleRefresh} />;

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[400px]">
      {/* Left: User List */}
      <div className="w-64 flex-shrink-0 bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <span className="text-xs font-semibold text-[#9A9A9A]">
            {Object.values(usersByDb).reduce((s, d) => s + d.users.length, 0)} users
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 text-[#606060] hover:text-[#F0F0F0] rounded transition-colors"
          >
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {Object.entries(usersByDb).map(([dbName, data]) => (
            <div key={dbName}>
              <div className="px-4 py-2 flex items-center justify-between bg-[#111111] sticky top-0">
                <span className="text-xs font-bold text-[#F7941D]">{data.label || dbName}</span>
                <span className="text-xs text-[#606060]">{data.users.length}</span>
              </div>
              {data.error ? (
                <p className="px-4 py-2 text-xs text-[#EF4444]">Connection error</p>
              ) : data.users.map((u) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.id;
                const isSelected = selectedUser?.id === u.id && selectedUser?._db === dbName;
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser({ ...u, _db: dbName })}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                        : "text-[#9A9A9A] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F0F0F0]"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                      isSelected ? "bg-[rgba(247,148,29,0.2)] text-[#F7941D]" : "bg-[#222222] text-[#606060]"
                    )}>
                      {((u.first_name?.[0] ?? "") + (u.last_name?.[0] ?? "")).toUpperCase() || u.email?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{name}</div>
                      {u.email && <div className="text-xs text-[#606060] truncate">{u.email}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right: User Detail */}
      <div className="flex-1 min-w-0">
        {!selectedUser ? (
          <div className="h-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#111111] flex items-center justify-center">
              <Shield size={20} className="text-[#404040]" />
            </div>
            <p className="text-sm text-[#606060]">Select a user to view their role</p>
          </div>
        ) : (
          <UserDetail user={selectedUser} />
        )}
      </div>
    </div>
  );
}

function UserDetail({ user }: { user: DbUser & { _db: string } }) {
  const [locations, setLocations] = useState<Record<string, unknown>[]>([]);
  const [locLoading, setLocLoading] = useState(true);
  const [roleResponse, setRoleResponse] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.id;

  useEffect(() => {
    setLocations([]);
    setLocLoading(true);
    setRoleResponse(null);
    fetch(`/api/mqtt-portal/user-locations/${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => setLocations(data.locations || []))
      .finally(() => setLocLoading(false));
  }, [user.id]);

  async function handleGetRole() {
    setRoleLoading(true);
    try {
      const res = await fetch("/api/mqtt-portal/get-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      setRoleResponse(JSON.stringify(data, null, 2));
    } finally {
      setRoleLoading(false);
    }
  }

  async function handleCopy() {
    if (!roleResponse) return;
    await navigator.clipboard.writeText(roleResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[rgba(247,148,29,0.12)] flex items-center justify-center text-[#F7941D] font-bold text-lg flex-shrink-0">
          {((user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "")).toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#F0F0F0]">{name}</div>
          {user.email && <div className="text-xs text-[#9A9A9A]">{user.email}</div>}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 bg-[rgba(247,148,29,0.1)] text-[#F7941D] rounded-full capitalize">{user._db}</span>
            <code className="text-xs text-[#606060] font-mono">{user.id}</code>
          </div>
        </div>
      </div>

      {/* Assigned Sites */}
      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={13} className="text-[#F7941D]" />
          <span className="text-xs font-bold text-[#F0F0F0]">Assigned Sites</span>
        </div>
        {locLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#606060]">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : locations.length === 0 ? (
          <p className="text-xs text-[#606060]">No assigned sites found.</p>
        ) : (
          <ul className="space-y-2">
            {locations.map((loc, i) => {
              const locName = (loc.location_name ?? loc.display_name ?? loc.name) as string | undefined;
              const locId = (loc.location_id ?? loc.id) as string | undefined;
              return (
                <li key={i} className="flex items-center gap-2 text-xs text-[#F0F0F0]">
                  <MapPin size={11} className="text-[#606060] flex-shrink-0" />
                  <span>{locName || locId}</span>
                  {!locName && locId && <code className="text-[#606060] font-mono">{locId}</code>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Client Role */}
      <div className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-[#F7941D]" />
            <span className="text-xs font-bold text-[#F0F0F0]">Client Role</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs px-2 py-1 bg-[#111111] text-[#9A9A9A] rounded font-mono">
              {user.id}_role
            </code>
            <button
              onClick={handleGetRole}
              disabled={roleLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#F7941D] text-[#0D0D0D] font-semibold hover:bg-[#e8830a] transition-colors disabled:opacity-50"
            >
              {roleLoading ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={11} />}
              Get Role
            </button>
          </div>
        </div>

        <AnimatePresence>
          {roleResponse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#606060] font-medium">Broker Response</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-[#606060] hover:text-[#F0F0F0] transition-colors"
                >
                  {copied ? <Check size={12} className="text-[#22C55E]" /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="bg-[#0D0D0D] border border-[rgba(255,255,255,0.06)] rounded-lg p-3 text-xs text-[#9A9A9A] font-mono overflow-x-auto whitespace-pre-wrap">
                {roleResponse}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function LoadingState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 size={20} className="animate-spin text-[#606060]" />
      <p className="text-sm text-[#606060]">{text}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertCircle size={20} className="text-[#EF4444]" />
      <p className="text-sm text-[#EF4444]">{message}</p>
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#9A9A9A] hover:text-[#F0F0F0] transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "clients" | "roles" | "config";

export function MqttPortalClient() {
  const [tab, setTab] = useState<Tab>("clients");
  const [status, setStatus] = useState<StatusData | null>(null);
  const [connected, setConnected] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/mqtt-portal/status");
      const data: StatusData = await res.json();
      setStatus(data);
      setConnected(data.mqtt.connected);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  function handleConnected() {
    fetchStatus();
    setTab("clients");
  }

  async function handleDisconnect() {
    await fetch("/api/mqtt-portal/connect", { method: "DELETE" });
    setConnected(false);
    setStatus(null);
    setShowDisconnect(false);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "clients", label: "Broker Clients" },
    { id: "roles", label: "User Roles" },
    { id: "config", label: "Configuration" },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <StatusBadges status={status} />
        </div>

        <div className="flex items-center gap-2">
          {connected && (
            <button
              onClick={() => setShowDisconnect(!showDisconnect)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-[#606060] hover:text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)] transition-all border border-transparent hover:border-[rgba(239,68,68,0.2)]"
            >
              <WifiOff size={12} />
              Disconnect
            </button>
          )}
          {!connected && tab !== "config" && (
            <button
              onClick={() => setTab("config")}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#F7941D] text-[#0D0D0D] font-semibold hover:bg-[#e8830a] transition-colors"
            >
              <Settings2 size={12} />
              Configure & Connect
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-[rgba(255,255,255,0.06)] flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              tab === t.id
                ? "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                : "text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[rgba(255,255,255,0.04)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "config" && <ConfigPanel onConnected={handleConnected} />}
        {tab === "clients" && (connected ? <BrokerClientsTab /> : <NotConnectedState onConfigure={() => setTab("config")} />)}
        {tab === "roles" && (connected ? <UserRolesTab /> : <NotConnectedState onConfigure={() => setTab("config")} />)}
      </div>

      {/* Disconnect confirm */}
      <AnimatePresence>
        {showDisconnect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDisconnect(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1A1A1A] border border-[rgba(255,255,255,0.1)] rounded-xl p-6 space-y-4 max-w-sm w-full mx-4"
            >
              <p className="text-sm text-[#F0F0F0] font-medium">Disconnect from MQTT broker?</p>
              <p className="text-xs text-[#606060]">This will close the broker connection. You can reconnect at any time from the Configuration tab.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowDisconnect(false)} className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[#9A9A9A] hover:text-[#F0F0F0] transition-colors">Cancel</button>
                <button onClick={handleDisconnect} className="text-xs px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.25)] transition-colors font-medium">Disconnect</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotConnectedState({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[rgba(255,255,255,0.07)] flex items-center justify-center">
        <WifiOff size={22} className="text-[#404040]" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[#F0F0F0]">Not connected</p>
        <p className="text-xs text-[#606060] mt-1">Configure your MQTT broker to get started</p>
      </div>
      <button
        onClick={onConfigure}
        className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[#F7941D] text-[#0D0D0D] font-bold hover:bg-[#e8830a] transition-colors"
      >
        <Settings2 size={14} />
        Configure & Connect
      </button>
    </div>
  );
}
