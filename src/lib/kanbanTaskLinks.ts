export interface KanbanTaskLinkRef {
  id: string;
  title: string;
  state: string;
  columnName?: string | null;
}

export function findLinkedKanbanTasksInText(text: string, tasks: KanbanTaskLinkRef[]) {
  if (!text.trim()) return [];

  const normalized = text.toLowerCase();
  const matches: KanbanTaskLinkRef[] = [];

  for (const task of tasks) {
    if (!normalized.includes(task.id.toLowerCase())) continue;
    matches.push(task);
  }

  return matches;
}
