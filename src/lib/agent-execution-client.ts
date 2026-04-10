"use client";

export const EXECUTION_RECOVERY_STALE_MS = 10_000;

export function kickoffExecutionProcessing(executionId: string) {
  void fetch(`/api/agent-executions/${executionId}/process`, {
    method: "POST",
  }).catch(() => {
    // Best-effort fallback for environments that do not reliably run after().
  });
}

export function shouldRecoverExecution(execution: { status: string; updatedAt: string }) {
  return execution.status === "in-process"
    && Date.now() - new Date(execution.updatedAt).getTime() > EXECUTION_RECOVERY_STALE_MS;
}
