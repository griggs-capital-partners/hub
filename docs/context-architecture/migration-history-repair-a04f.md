# Migration History Repair Note - A-04f

Date: 2026-04-26

## Summary

A-04f was unblocked without resetting the shared Neon database and without using `prisma db push`.

The A-04f migration `20260426010000_add_async_agent_work_queue` was applied with `npx prisma migrate deploy` after a live schema diff confirmed that the only remaining database delta was the new `async_agent_work_items` table, indexes, and foreign keys.

## Missing Historical Checksum

The local repository cannot currently reproduce the applied checksum for:

- Migration: `20260403225003_baseline`
- Applied checksum: `7e6da82cf2f0ac409a798574a74fb676d9e751556eb86b34dffeba0beb146a0c`

The local working-tree and known Git blob hashes do not match this checksum.

## Live Schema Verification

The shared Neon schema was checked before applying A-04f.

Verified live state:

- All 38 historical baseline/chat-project affected tables exist.
- `chat_projects` exists.
- `conversations.chatProjectId` exists.
- `conversations_chatProjectId_fkey` exists.
- `conversations_chatProjectId_updatedAt_idx` exists.
- `conversation_document_knowledge_artifacts` exists.
- `conversation_document_inspection_tasks` exists.
- The existing document-intelligence foreign key names are PostgreSQL-truncated live names.
- `async_agent_work_items` did not exist before A-04f deploy.
- After A-04f deploy, `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` returned an empty migration.

## Unrecoverable Baseline Finding

The exact applied baseline migration file was not recoverable locally.

Searches performed:

- Reachable Git blobs: no SHA-256 match for `7e6da82cf2f0ac409a798574a74fb676d9e751556eb86b34dffeba0beb146a0c`.
- Unreachable Git blobs: no SHA-256 match for `7e6da82cf2f0ac409a798574a74fb676d9e751556eb86b34dffeba0beb146a0c`.
- Local filesystem: only the current baseline migration file was present.

The chat-project migration was recoverable:

- Migration: `20260419000000_add_chat_projects`
- Applied checksum: `969d8df324f430f03ab3f2dc5a26a11c4cea46427200da3516b1b6b10b70385e`
- Restored from raw LF Git blob at commit `720a87e`.

## Repository Alignment Changes

Added `.gitattributes` rules to preserve LF for Prisma migration SQL files:

```gitattributes
prisma/migrations/**/*.sql text eol=lf
prisma/migrations/**/migration.sql text eol=lf
```

Aligned `schema.prisma` to the already-applied live schema metadata for existing tables:

- Preserved live `updatedAt DEFAULT CURRENT_TIMESTAMP` on `chat_projects`.
- Preserved live `updatedAt DEFAULT CURRENT_TIMESTAMP` on document-intelligence artifact/task tables.
- Mapped document-intelligence relation constraint names to the PostgreSQL-truncated live names.

## Recommendation

Preferred repair path:

1. Recover the exact external `20260403225003_baseline/migration.sql` file that hashes to `7e6da82cf2f0ac409a798574a74fb676d9e751556eb86b34dffeba0beb146a0c`.
2. Commit that exact file with LF line endings.
3. Keep the `.gitattributes` migration SQL rules in place.
4. Re-run `npx prisma migrate status` and `npx prisma migrate diff`.

If the exact baseline file cannot be recovered externally, plan a separate non-destructive re-baseline with a DB snapshot and explicit human approval. Do not manually edit `_prisma_migrations` without approval and a snapshot.
