export const DEFAULT_NOTIFICATION_PREFERENCES = {
  taskAssignedPush: true,
  agentExecutionPush: true,
} as const;

export type NotificationPreferences = {
  taskAssignedPush: boolean;
  agentExecutionPush: boolean;
};

export function formatAgentActionType(actionType: string) {
  return actionType
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
