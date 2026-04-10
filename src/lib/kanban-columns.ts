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
  QA_COLUMN,
  PO_REVIEW_COLUMN,
  DONE_COLUMN,
] as const;

export const DEFAULT_KANBAN_COLUMN_DEFINITIONS = [
  { name: BACKLOG_COLUMN, color: "#333333", position: 0 },
  { name: ACTIVE_COLUMN, color: "#F7941D", position: 1 },
  { name: QA_COLUMN, color: "#3B82F6", position: 2 },
  { name: PO_REVIEW_COLUMN, color: "#EAB308", position: 3 },
  { name: DONE_COLUMN, color: "#22C55E", position: 4 },
] as const;

export function isLegacyActiveColumnName(name: string) {
  return (LEGACY_ACTIVE_COLUMN_NAMES as readonly string[]).includes(name);
}

export function isActiveColumnName(name: string) {
  return name === ACTIVE_COLUMN || isLegacyActiveColumnName(name);
}

export function normalizeKanbanColumnName(name: string) {
  return isActiveColumnName(name) ? ACTIVE_COLUMN : name;
}
