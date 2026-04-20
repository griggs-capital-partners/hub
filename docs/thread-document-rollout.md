# Thread Document Rollout

This feature adds the checked-in Prisma migration `20260419010000_add_conversation_documents`.

## Why `prisma migrate dev` was unsafe here

The shared Neon database already has non-linear Prisma history for chat migrations. In particular, `_prisma_migrations` contains both a rolled-back row and a successful applied row for `20260419000000_add_chat_projects`.

That is exactly the kind of shared-environment history that makes `prisma migrate dev` a bad fit. `migrate dev` is designed for disposable development databases and may ask to reset when it sees migration history it wants to reconcile locally. We do not want that behavior against the shared Team Chat database.

In the current repo state:

- the checked-in SQL for `20260419000000_add_chat_projects` matches the successfully applied migration checksum
- `prisma migrate status` reports the next pending migration as `20260419010000_add_conversation_documents`

That means the safe ship path is to apply the checked-in migration without using `migrate dev` on the shared database.

## Recommended non-destructive rollout path

### Local development

For the existing local setup in this repo, keep using:

```bash
npx prisma generate
npx prisma db push
```

That matches the current README workflow and avoids forcing local developers through the shared migration history problem just to run the app.

If you want a local environment that behaves more like preview or production, use a fresh disposable database and run:

```bash
npx prisma migrate deploy
```

### Preview, staging, and shared/prod-style environments

Use the checked-in migration with Prisma's deploy flow:

```bash
npx prisma migrate status
npx prisma migrate deploy
```

Do not run `npx prisma migrate dev` against the shared Neon database.

## Manual SQL fallback

Manual SQL is not required on the normal path.

Use a manual SQL fallback only if one of these is true:

- the environment cannot run `prisma migrate deploy` with the available database role
- the SQL was already applied out of band and Prisma only needs its migration state reconciled

Fallback steps:

1. Execute `prisma/migrations/20260419010000_add_conversation_documents/migration.sql` against the target database.
2. Record the migration as applied:

```bash
npx prisma migrate resolve --applied 20260419010000_add_conversation_documents
```

3. Resume normal deployments with:

```bash
npx prisma migrate deploy
```

The checked-in migration SQL is intentionally idempotent so this fallback stays low-risk in shared environments.
