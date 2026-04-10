import { Pool } from "pg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerDbConfig {
  name: string;   // internal key e.g. "martin"
  label: string;  // display name e.g. "Martin"
  host: string;
  dbName: string;
  user: string;
  pass: string;
}

export interface DatabaseUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface UserLocation {
  location_id?: string;
  location_name?: string;
  display_name?: string;
  name?: string;
  [key: string]: unknown;
}

// ─── Singleton pool registry ──────────────────────────────────────────────────

const globalForDb = globalThis as unknown as {
  _mqttDbPools: Map<string, Pool> | null;
  _mqttDbConfigs: CustomerDbConfig[] | null;
};

if (!globalForDb._mqttDbPools) {
  globalForDb._mqttDbPools = null;
  globalForDb._mqttDbConfigs = null;
}

export function initCustomerDatabases(configs: CustomerDbConfig[]): void {
  // Drain existing pools if reinitializing
  if (globalForDb._mqttDbPools) {
    for (const pool of globalForDb._mqttDbPools.values()) {
      pool.end().catch(() => {});
    }
  }

  const pools = new Map<string, Pool>();
  for (const cfg of configs) {
    pools.set(
      cfg.name,
      new Pool({
        host: cfg.host,
        database: cfg.dbName,
        user: cfg.user,
        password: cfg.pass,
        port: 5432,
        ssl: { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 10000,
      })
    );
  }

  globalForDb._mqttDbPools = pools;
  globalForDb._mqttDbConfigs = configs;
}

export function getCustomerDbConfigs(): CustomerDbConfig[] | null {
  return globalForDb._mqttDbConfigs;
}

function getPools(): Map<string, Pool> {
  if (!globalForDb._mqttDbPools) throw new Error("Customer databases not configured");
  return globalForDb._mqttDbPools;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const USER_QUERY = `
  SELECT id, email, first_name, last_name
  FROM core."user"
  WHERE id::text = $1
  LIMIT 1
`;

const ALL_USERS_QUERY = `
  SELECT id, email, first_name, last_name
  FROM core."user"
  ORDER BY last_name, first_name
`;

const USER_LOCATIONS_QUERY = `
  SELECT ul.*, l.display_name AS location_name, l.id AS location_id
  FROM core.user_location ul
  LEFT JOIN core.location l ON l.id = ul.location_id
  WHERE ul.user_id = $1
  ORDER BY l.display_name
`;

export async function findUserAcrossDatabases(
  clientId: string
): Promise<{ database: string | null; user: DatabaseUser | null }> {
  const pools = getPools();
  const results = await Promise.allSettled(
    Array.from(pools.entries()).map(async ([dbName, pool]) => {
      const res = await pool.query<DatabaseUser>(USER_QUERY, [clientId]);
      if (res.rows.length > 0) return { database: dbName, user: res.rows[0] };
      return null;
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) return result.value;
  }
  return { database: null, user: null };
}

export async function getUsersByCustomer(): Promise<
  Record<string, { users: DatabaseUser[]; error: string | null; label: string }>
> {
  const pools = getPools();
  const configs = globalForDb._mqttDbConfigs ?? [];
  const labelMap = new Map(configs.map((c) => [c.name, c.label]));

  const results = await Promise.allSettled(
    Array.from(pools.entries()).map(async ([dbName, pool]) => {
      try {
        const res = await pool.query<DatabaseUser>(ALL_USERS_QUERY);
        return { dbName, users: res.rows, error: null };
      } catch (err) {
        return { dbName, users: [], error: (err as Error).message };
      }
    })
  );

  const grouped: Record<string, { users: DatabaseUser[]; error: string | null; label: string }> = {};
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      const { dbName, users, error } = result.value;
      grouped[dbName] = { users, error, label: labelMap.get(dbName) ?? dbName };
    }
  }
  return grouped;
}

export async function getUserLocations(
  userId: string
): Promise<{ dbName: string | null; locations: UserLocation[] }> {
  const pools = getPools();

  const results = await Promise.allSettled(
    Array.from(pools.entries()).map(async ([dbName, pool]) => {
      try {
        const res = await pool.query<UserLocation>(USER_LOCATIONS_QUERY, [userId]);
        if (res.rows.length > 0) return { dbName, locations: res.rows };
        return null;
      } catch {
        try {
          const fallback = await pool.query<UserLocation>(
            "SELECT * FROM core.user_location WHERE user_id = $1",
            [userId]
          );
          if (fallback.rows.length > 0) return { dbName, locations: fallback.rows };
        } catch { /* ignore */ }
        return null;
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) return result.value;
  }
  return { dbName: null, locations: [] };
}

export async function testDatabaseConnections(): Promise<
  Record<string, { connected: boolean; error?: string; label: string }>
> {
  const pools = getPools();
  const configs = globalForDb._mqttDbConfigs ?? [];
  const labelMap = new Map(configs.map((c) => [c.name, c.label]));
  const status: Record<string, { connected: boolean; error?: string; label: string }> = {};

  for (const [name, pool] of pools.entries()) {
    try {
      await pool.query("SELECT 1");
      status[name] = { connected: true, label: labelMap.get(name) ?? name };
    } catch (err) {
      status[name] = { connected: false, error: (err as Error).message, label: labelMap.get(name) ?? name };
    }
  }
  return status;
}
