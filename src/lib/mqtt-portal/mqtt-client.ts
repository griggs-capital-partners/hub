import mqtt, { MqttClient } from "mqtt";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MqttPortalConnectionConfig {
  mqttUrl: string;
  mqttUser: string;
  mqttPass: string;
}

interface PendingCommand {
  resolve: (value: DynSecResponse) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface DynSecResponse {
  command?: string;
  correlationData?: string;
  error?: string;
  data?: Record<string, unknown>;
}

// ─── Singleton state ──────────────────────────────────────────────────────────

const DYNSEC_TOPIC = "$CONTROL/dynamic-security/v1";
const DYNSEC_RESPONSE = "$CONTROL/dynamic-security/v1/response";

const globalForMqtt = globalThis as unknown as {
  _mqttClient: MqttClient | null;
  _mqttConnected: boolean;
  _mqttPending: Map<string, PendingCommand>;
  _mqttConfig: MqttPortalConnectionConfig | null;
};

if (!globalForMqtt._mqttPending) {
  globalForMqtt._mqttClient = null;
  globalForMqtt._mqttConnected = false;
  globalForMqtt._mqttPending = new Map();
  globalForMqtt._mqttConfig = null;
}

// ─── Connect ──────────────────────────────────────────────────────────────────

export function connectMqtt(config: MqttPortalConnectionConfig): void {
  // Disconnect existing client if reconnecting with new config
  if (globalForMqtt._mqttClient) {
    globalForMqtt._mqttClient.end(true);
    globalForMqtt._mqttClient = null;
    globalForMqtt._mqttConnected = false;
  }

  globalForMqtt._mqttConfig = config;

  const client = mqtt.connect(config.mqttUrl, {
    username: config.mqttUser,
    password: config.mqttPass,
    protocolVersion: 5,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 15000,
  });

  client.on("connect", () => {
    globalForMqtt._mqttConnected = true;
    client.subscribe(DYNSEC_RESPONSE, { qos: 1 }, (err) => {
      if (err) console.error("[MQTT] Subscribe error:", err);
    });
  });

  client.on("close", () => {
    globalForMqtt._mqttConnected = false;
  });

  client.on("error", (err) => {
    console.error("[MQTT] Error:", err.message);
  });

  client.on("message", (_topic: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString()) as { responses?: DynSecResponse[] };
      if (data.responses) {
        for (const resp of data.responses) {
          const key = resp.correlationData;
          if (key && globalForMqtt._mqttPending.has(key)) {
            const pending = globalForMqtt._mqttPending.get(key)!;
            clearTimeout(pending.timer);
            globalForMqtt._mqttPending.delete(key);
            pending.resolve(resp);
          }
        }
      }
    } catch (e) {
      console.error("[MQTT] Failed to parse response:", e);
    }
  });

  globalForMqtt._mqttClient = client;
}

export function disconnectMqtt(): void {
  if (globalForMqtt._mqttClient) {
    globalForMqtt._mqttClient.end(true);
    globalForMqtt._mqttClient = null;
    globalForMqtt._mqttConnected = false;
    globalForMqtt._mqttConfig = null;
  }
}

// ─── Send command ─────────────────────────────────────────────────────────────

export function sendDynSecCommand(
  command: Record<string, unknown>,
  timeoutMs = 15000
): Promise<DynSecResponse> {
  return new Promise((resolve, reject) => {
    if (!globalForMqtt._mqttConnected || !globalForMqtt._mqttClient) {
      return reject(new Error("MQTT not connected"));
    }

    const correlationData = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cmd = { ...command, correlationData };

    const timer = setTimeout(() => {
      globalForMqtt._mqttPending.delete(correlationData);
      reject(new Error("Command timed out"));
    }, timeoutMs);

    globalForMqtt._mqttPending.set(correlationData, { resolve, reject, timer });

    const payload = JSON.stringify({ commands: [cmd] });
    globalForMqtt._mqttClient.publish(DYNSEC_TOPIC, payload, { qos: 1 });
  });
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function getMqttConnectionStatus(): boolean {
  return globalForMqtt._mqttConnected;
}

export function getMqttConfig(): MqttPortalConnectionConfig | null {
  return globalForMqtt._mqttConfig;
}
