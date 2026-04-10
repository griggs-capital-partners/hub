export const BACKLOG_COLUMN = "Backlog";
export const ACTIVE_COLUMN = "Active";
export const QA_COLUMN = "QA Testing";
export const PO_REVIEW_COLUMN = "PO Review";
export const DONE_COLUMN = "Done";

export const LEGACY_ACTIVE_COLUMN_NAMES = [
  "Research & Investigation",
  "In Progress",
  "In Review",
] as const;

export const PRIMARY_KANBAN_COLUMNS = [
  BACKLOG_COLUMN,
  ACTIVE_COLUMN,
] as const;

export const ALL_KANBAN_COLUMNS = [
  ...PRIMARY_KANBAN_COLUMNS,
  DONE_COLUMN,
] as const;

export const DEFAULT_KANBAN_COLUMN_DEFINITIONS = [
  { name: BACKLOG_COLUMN, color: "#333333", position: 0 },
  { name: ACTIVE_COLUMN, color: "#F7941D", position: 1 },
  { name: DONE_COLUMN, color: "#22C55E", position: 2 },
] as const;

export function isLegacyDoneColumnName(name: string) {
  return name === QA_COLUMN || name === PO_REVIEW_COLUMN;
}

export function isLegacyActiveColumnName(name: string) {
  return (LEGACY_ACTIVE_COLUMN_NAMES as readonly string[]).includes(name);
}

export function isActiveColumnName(name: string) {
  return name === ACTIVE_COLUMN || isLegacyActiveColumnName(name);
}

export function normalizeKanbanColumnName(name: string) {
  if (isActiveColumnName(name)) return ACTIVE_COLUMN;
  if (isLegacyDoneColumnName(name)) return DONE_COLUMN;
  return name;
}
