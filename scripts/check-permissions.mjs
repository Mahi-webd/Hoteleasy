// Checks that every permission named in the app (allowed("…"), perm: "…") and in SQL role checks
// exists in permission_catalog, as filled by the migrations. Run: npm run check:perms
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const migDir = join(root, "supabase/migrations");
const migrations = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

const catalog = new Set();
for (const f of migrations) {
  const sql = readFileSync(join(migDir, f), "utf8");
  for (const block of sql.split(/insert into public\.permission_catalog/i).slice(1)) {
    const body = block.split(/;\s*\n/)[0];
    for (const m of body.matchAll(/\(\s*'([a-z_]+\.[a-z_]+)'\s*,/g)) catalog.add(m[1]);
  }
}
if (!catalog.size) { console.error("No permissions found in the migrations"); process.exit(1); }
const modules = new Set([...catalog].map((k) => k.split(".")[0]));

const problems = [];
const check = (key, where) => key.split("|").forEach((k) => { if (!catalog.has(k)) problems.push(`${where}: unknown permission "${k}"`); });

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(n) ? [p] : [];
});
for (const file of walk(join(root, "src"))) {
  const src = readFileSync(file, "utf8");
  const rel = file.slice(root.length);
  for (const m of src.matchAll(/\ballowed\(([^)]*)\)/g)) {
    for (const s of m[1].matchAll(/["'`]([^"'`]+)["'`]/g)) if (/^[a-z_]+\.[a-z_|.]+$/.test(s[1])) check(s[1], rel);
  }
  for (const m of src.matchAll(/\bperm(?:=|:\s*)["']([^"']+)["']/g)) check(m[1], rel);
}
// SQL: quoted 'module.action' strings whose module is a permission area, in the role migrations onwards
const firstRoles = migrations.findIndex((f) => f.includes("_roles"));
for (const f of migrations.slice(firstRoles)) {
  const sql = readFileSync(join(migDir, f), "utf8").replace(/insert into public\.permission_catalog[\s\S]*?;\s*\n/gi, "");
  for (const m of sql.matchAll(/'([a-z_]+\.[a-z_]+(?:\|[a-z_]+\.[a-z_]+)*)'/g)) {
    if (m[1].split("|").every((k) => modules.has(k.split(".")[0]))) check(m[1], `supabase/migrations/${f}`);
  }
}

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`Permissions OK: ${catalog.size} in the list, every name used in the app and SQL exists.`);
