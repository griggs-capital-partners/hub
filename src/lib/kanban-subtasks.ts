export type KanbanSubtaskState = "off" | "active" | "complete";

export type KanbanSubtask = {
  id: string;
  title: string;
  state: KanbanSubtaskState;
};

const VALID_STATES: KanbanSubtaskState[] = ["off", "active", "complete"];

export function createKanbanSubtask(): KanbanSubtask {
  return {
    id: `subtask_${Math.random().toString(36).slice(2, 10)}`,
    title: "",
    state: "off",
  };
}

export function isKanbanSubtaskState(value: unknown): value is KanbanSubtaskState {
  return typeof value === "string" && VALID_STATES.includes(value as KanbanSubtaskState);
}

export function sanitizeKanbanSubtasks(value: unknown): KanbanSubtask[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const subtask = item as Partial<KanbanSubtask>;
      const title = typeof subtask.title === "string" ? subtask.title.trim() : "";
      if (!title) return null;
      const id = typeof subtask.id === "string" && subtask.id.trim() ? subtask.id : `subtask_${index + 1}`;
      const state = isKanbanSubtaskState(subtask.state) ? subtask.state : "off";

      return { id, title, state };
    })
    .filter((item): item is KanbanSubtask => Boolean(item));
}

export function parseKanbanSubtasks(raw: string | null | undefined): KanbanSubtask[] {
  try {
    return sanitizeKanbanSubtasks(JSON.parse(raw ?? "[]"));
  } catch {
    return [];
  }
}

export function serializeKanbanSubtasks(subtasks: KanbanSubtask[]): string {
  return JSON.stringify(
    sanitizeKanbanSubtasks(subtasks).map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      state: subtask.state,
    }))
  );
}
