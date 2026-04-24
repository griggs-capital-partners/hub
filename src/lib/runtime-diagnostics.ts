import { normalizeAgentLlmConfig } from "@/lib/agent-llm-config";

type LegacyLlmFields = {
  llmEndpointUrl?: string | null;
  llmUsername?: string | null;
  llmPassword?: string | null;
  llmModel?: string | null;
  llmThinkingMode?: string | null;
};

function sanitizeUrlTarget(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname || "/",
    };
  } catch {
    return { invalid: true };
  }
}

export function getSanitizedDatabaseTarget() {
  return sanitizeUrlTarget(process.env.DATABASE_URL);
}

export function summarizeAgentLlmConnections(
  rawConfig: unknown,
  legacy?: LegacyLlmFields | null
) {
  const config = normalizeAgentLlmConfig(rawConfig, legacy);

  return config.connections.map((connection) => {
    const endpoint = sanitizeUrlTarget(connection.connection.endpointUrl.trim() || null);

    return {
      id: connection.id,
      label: connection.label,
      provider: connection.provider,
      model: connection.model.trim() || null,
      region: connection.connection.region.trim() || null,
      endpointHost: endpoint && "host" in endpoint ? endpoint.host : null,
      hasEndpoint: Boolean(connection.connection.endpointUrl.trim()),
      hasApiKey: Boolean(connection.auth.apiKey.trim() || connection.auth.hasApiKey),
      hasUsername: Boolean(connection.auth.username.trim()),
      hasPassword: Boolean(connection.auth.password.trim() || connection.auth.hasPassword),
      hasAccessKeyId: Boolean(connection.auth.accessKeyId.trim()),
      hasSecretAccessKey: Boolean(
        connection.auth.secretAccessKey.trim() || connection.auth.hasSecretAccessKey
      ),
      enabled: connection.enabled,
      status: connection.status,
      lastValidatedAt: connection.lastValidatedAt,
      validationError: connection.validationError,
    };
  });
}

