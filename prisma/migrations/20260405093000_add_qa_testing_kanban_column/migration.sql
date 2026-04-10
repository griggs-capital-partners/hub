CREATE TEMP TABLE boards_missing_qa AS
  SELECT kb.id
  FROM "kanban_boards" kb
  WHERE NOT EXISTS (
    SELECT 1
    FROM "kanban_columns" kc
    WHERE kc."boardId" = kb.id
      AND kc."name" = 'QA Testing'
  );

UPDATE "kanban_columns"
SET "name" = 'Research & Investigation',
    "color" = '#FBBA00'
WHERE "name" = 'In Review';

UPDATE "kanban_columns"
SET "position" = 1
WHERE "name" = 'Research & Investigation';

UPDATE "kanban_columns"
SET "position" = 2
WHERE "name" = 'In Progress';

UPDATE "kanban_columns" kc
SET "position" = kc."position" + 1
FROM boards_missing_qa b
WHERE kc."boardId" = b.id
  AND kc."position" >= 3;

INSERT INTO "kanban_columns" ("id", "boardId", "name", "color", "position")
SELECT
  'qa_' || md5(b.id || clock_timestamp()::text || random()::text),
  b.id,
  'QA Testing',
  '#3B82F6',
  3
FROM boards_missing_qa b;

DROP TABLE boards_missing_qa;
