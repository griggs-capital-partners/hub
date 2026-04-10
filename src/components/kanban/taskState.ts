export const KANBAN_TASK_STATES = [
  "normal",
  "investigating",
  "waiting_on_customer",
  "waiting_on_another_task",
] as const;

export type KanbanTaskState = (typeof KANBAN_TASK_STATES)[number];

export const KANBAN_TASK_STATE_META: Record<
  KanbanTaskState,
  {
    label: string;
    shortLabel: string;
    color: string;
    background: string;
    border: string;
  }
> = {
  normal: {
    label: "Normal",
    shortLabel: "Normal",
    color: "#9CA3AF",
    background: "rgba(156,163,175,0.12)",
    border: "rgba(156,163,175,0.22)",
  },
  investigating: {
    label: "Investigating",
    shortLabel: "Investigating",
    color: "#38BDF8",
    background: "rgba(56,189,248,0.14)",
    border: "rgba(56,189,248,0.24)",
  },
  waiting_on_customer: {
    label: "Waiting on Customer",
    shortLabel: "Waiting: Customer",
    color: "#F59E0B",
    background: "rgba(245,158,11,0.14)",
    border: "rgba(245,158,11,0.24)",
  },
  waiting_on_another_task: {
    label: "Waiting on Another Task",
    shortLabel: "Waiting: Task",
    color: "#14B8A6",
    background: "rgba(20,184,166,0.14)",
    border: "rgba(20,184,166,0.24)",
  },
};

export function isKanbanTaskState(value: string): value is KanbanTaskState {
  return (KANBAN_TASK_STATES as readonly string[]).includes(value);
}
