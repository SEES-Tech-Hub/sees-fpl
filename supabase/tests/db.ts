// A throwaway database for tests: PGlite (Postgres compiled to WebAssembly,
// in memory) with every migration in supabase/migrations applied in order,
// on top of small stand-ins for Supabase's roles and auth (supabase-stubs.sql).
// Loading takes well under a second, so each test file gets its own.
//
//   const db = await createTestDb();
//   await asAnon(db, (tx) => tx.query("select ..."));   // as a visitor, RLS on
//
// Queries run as the database owner (RLS off) unless wrapped in asAnon or asUser.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..");

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(HERE, "supabase-stubs.sql"), "utf8"));
  const dir = join(ROOT, "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(dir, file), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Applies one migration again, for "safe to run twice" checks. */
export async function rerunMigration(db: PGlite, file: string) {
  await db.exec(readFileSync(join(ROOT, "migrations", file), "utf8"));
}

/** Runs `fn` as an anonymous visitor: the anon role, no user, row-level security on. */
export function asAnon<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    await tx.query("select set_config('request.jwt.claim.sub', '', true)");
    return fn(tx);
  });
}

/** Runs `fn` as a signed-in user (the authenticated role with that user id). */
export function asUser<T>(db: PGlite, userId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return fn(tx);
  });
}

/** The `live.*` code a database error carries in its HINT, or the message if it has none. */
export async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    const err = e as { hint?: string; message?: string };
    return err.hint || err.message || "error";
  }
  return "no error";
}
