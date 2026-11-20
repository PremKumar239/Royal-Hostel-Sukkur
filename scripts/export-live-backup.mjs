/**
 * Export live hostel data from the OLD (still working) Supabase project.
 * Uses the same login as the Vercel app — no old dashboard needed.
 *
 * Usage:
 *   node scripts/export-live-backup.mjs
 *
 * Reads .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   BACKUP_EMAIL=hostel1@royalgirls.com
 *   BACKUP_PASSWORD=your_password
 *   BACKUP_EMAIL_2=hostel2@royalgirls.com   (optional, second hostel)
 *   BACKUP_PASSWORD_2=your_password         (optional)
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(root, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email1 = process.env.BACKUP_EMAIL || "hostel1@royalgirls.com";
const pass1 = process.env.BACKUP_PASSWORD;
const email2 = process.env.BACKUP_EMAIL_2 || "hostel2@royalgirls.com";
const pass2 = process.env.BACKUP_PASSWORD_2 || process.env.BACKUP_PASSWORD;

if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}
if (!pass1) {
  console.error("Set BACKUP_PASSWORD in .env.local (Hostel 1 login password).");
  process.exit(1);
}

const TABLES = [
  "hostels",
  "rooms",
  "beds",
  "students",
  "allocations",
  "expense_categories",
  "employees",
  "expenses",
  "fee_records",
  "complaints",
  "mess_expenses",
  "police_verifications",
  "cash_budgets",
  "admission_fees",
  "outside_mess_payments",
  "van_payments",
  "van_expenses",
  "month_closures",
  "activity_logs",
];

const SKIP_INSERT = new Set(["activity_logs"]);

function loadEnv(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    console.error("Could not read .env.local at", path);
    process.exit(1);
  }
}

async function signIn(email, password) {
  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Login failed for ${email}:`, error.message);
    return null;
  }
  console.log(`Signed in as ${email}`);
  return supabase;
}

async function fetchAll(supabase, table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) {
      if (/does not exist|schema cache|Could not find/i.test(error.message)) {
        return { missing: true, rows: [] };
      }
      return { error: error.message, rows: [] };
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { rows };
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toInsert(table, rows) {
  if (rows.length === 0) return `-- ${table}: 0 rows\n`;
  const cols = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const chunks = [];
  for (let i = 0; i < rows.length; i += 200) {
    const slice = rows.slice(i, i + 200);
    const values = slice
      .map((row) => `(${cols.map((col) => sqlValue(row[col] ?? null)).join(", ")})`)
      .join(",\n");
    chunks.push(
      `INSERT INTO ${table} (${cols.join(", ")})\nVALUES\n${values}\nON CONFLICT (id) DO NOTHING;`
    );
  }
  return `-- ${table}: ${rows.length} rows\n${chunks.join("\n\n")}\n`;
}

function mergeById(into, extra) {
  const map = new Map(into.map((row) => [row.id, row]));
  for (const row of extra) {
    if (row?.id) map.set(row.id, row);
  }
  return [...map.values()];
}

const dump = {};
const accounts = [{ email: email1, password: pass1 }];
if (email2 && pass2 && email2.toLowerCase() !== email1.toLowerCase()) {
  accounts.push({ email: email2, password: pass2 });
}

for (const account of accounts) {
  const supabase = await signIn(account.email, account.password);
  if (!supabase) continue;
  for (const table of TABLES) {
    const result = await fetchAll(supabase, table);
    if (result.missing) {
      if (!dump[table]) dump[table] = [];
      continue;
    }
    if (result.error) {
      console.error(`${table} (${account.email}): ${result.error}`);
      continue;
    }
    dump[table] = mergeById(dump[table] ?? [], result.rows);
    console.log(`${table}: ${dump[table].length} rows after ${account.email}`);
  }
}

const outDir = join(root, "backups");
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = join(outDir, `live-backup-${stamp}.json`);
const sqlPath = join(outDir, `live-backup-${stamp}.sql`);

writeFileSync(jsonPath, JSON.stringify(dump, null, 2));

const insertOrder = [
  "hostels",
  "rooms",
  "beds",
  "students",
  "allocations",
  "expense_categories",
  "employees",
  "expenses",
  "fee_records",
  "complaints",
  "mess_expenses",
  "police_verifications",
  "cash_budgets",
  "admission_fees",
  "outside_mess_payments",
  "van_payments",
  "van_expenses",
  "month_closures",
];

const sqlParts = [
  "-- Generated live backup. Paste into NEW Supabase SQL Editor AFTER running migrations.",
  "-- Recreate Auth users first (hostel1 / hostel2), then run the link SQL at the bottom.",
  "BEGIN;",
  `-- Migrations may have created hostels with the same slugs but different IDs.
DELETE FROM hostel_members
WHERE hostel_id IN (
  SELECT id FROM hostels
  WHERE slug IN ('royal-girls-hostel-1', 'royal-girls-hostel-2')
);
DELETE FROM month_closures
WHERE hostel_id IN (
  SELECT id FROM hostels
  WHERE slug IN ('royal-girls-hostel-1', 'royal-girls-hostel-2')
);
DELETE FROM hostels
WHERE slug IN ('royal-girls-hostel-1', 'royal-girls-hostel-2');`,
];

for (const table of insertOrder) {
  if (SKIP_INSERT.has(table)) continue;
  sqlParts.push(toInsert(table, dump[table] ?? []));
}

sqlParts.push(`
-- Link NEW Auth users to the restored hostels (do not import old user UUIDs)
UPDATE profiles SET role = 'hostel_super_admin', full_name = 'Royal Girls Hostel 1'
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('hostel1@royalgirls.com'));

UPDATE profiles SET role = 'hostel_super_admin', full_name = 'Royal Girls Hostel 2'
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('hostel2@royalgirls.com'));

INSERT INTO hostel_members (hostel_id, user_id, role, is_active)
SELECT h.id, u.id, 'hostel_super_admin', true
FROM hostels h
JOIN auth.users u ON lower(u.email) = lower('hostel1@royalgirls.com')
WHERE h.slug = 'royal-girls-hostel-1'
ON CONFLICT (hostel_id, user_id) DO UPDATE SET is_active = true;

INSERT INTO hostel_members (hostel_id, user_id, role, is_active)
SELECT h.id, u.id, 'hostel_super_admin', true
FROM hostels h
JOIN auth.users u ON lower(u.email) = lower('hostel2@royalgirls.com')
WHERE h.slug = 'royal-girls-hostel-2'
ON CONFLICT (hostel_id, user_id) DO UPDATE SET is_active = true;

COMMIT;
`);

writeFileSync(sqlPath, sqlParts.join("\n\n"));

console.log("\nWrote:");
console.log(" ", jsonPath);
console.log(" ", sqlPath);
console.log("\nKeep Vercel on the OLD Supabase URL until this backup looks complete.");
