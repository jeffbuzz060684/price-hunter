#!/usr/bin/env node
/**
 * HARNais DE TESTS LOCAL — sans node_modules.
 *
 * Le sandbox n'autorise pas `npm install`. Ce harnais vérifie donc les tests
 * unitaires purs (moteur, matching, coupons, alertes, historique, edge cases)
 * en exécutant les sources TypeScript directement via Node 22
 * (--experimental-strip-types) :
 *   1. copie src -> /tmp/ph-verify (validation.test.ts exclu : nécessite zod,
 *      il est couvert par Vitest en CI) ;
 *   2. retire les imports "vitest" (globals fournis par le shim) ;
 *   3. réécrit les imports "@/x" en chemins relatifs avec extension .ts ;
 *   4. exécute tous les fichiers de test puis affiche le bilan.
 *
 * Vitest + zod restent la référence en CI (npm test).
 */

import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const DEST = "/tmp/ph-verify";
const EXCLUDED = new Set(["validation.test.ts"]); // zod requis -> CI uniquement

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(SRC, join(DEST, "src"), { recursive: true });

/* ---------- collecte des fichiers ---------- */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const SRC_DIR = join(DEST, "src");
const allFiles = walk(SRC_DIR).filter((f) => f.endsWith(".ts"));
const testFiles = allFiles
  .filter((f) => f.endsWith(".test.ts") && !EXCLUDED.has(basename(f)))
  .sort();

/* ---------- réécriture des sources copiées ---------- */
for (const file of allFiles) {
  let code = readFileSync(file, "utf8");
  // les globals du shim remplacent vitest
  code = code.replace(/^import\s*\{[^}]*\}\s*from\s*"vitest";\s*$/gm, "");
  // "@/x" -> chemin relatif avec extension .ts
  const rel = relative(SRC_DIR, file);
  const fileDir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  code = code.replace(/"@\/([^"]+)"/g, (_m, target) => {
    let relPath = relative(fileDir || ".", target).replaceAll("\\", "/");
    if (!relPath.startsWith(".")) relPath = "./" + relPath;
    return `"${relPath}.ts"`;
  });
  writeFileSync(file, code);
}

/* ---------- shim de test (describe/it/expect avec .not) ---------- */
const shim = `
let __pass = 0;
const __failures = [];
const __queue = [];
let __prefix = [];
globalThis.describe = function (name, fn) {
  const prev = __prefix;
  __prefix = [...prev, name];
  fn();
  __prefix = prev;
};
globalThis.it = function (name, fn) {
  __queue.push({ name: [...__prefix, name].join(" > "), fn });
};
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}
function show(v) {
  if (typeof v === "string") return JSON.stringify(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}
globalThis.expect = function (actual) {
  const ops = {
    toBe: (e) => actual === e,
    toEqual: (e) => deepEqual(actual, e),
    toBeNull: () => actual === null,
    toBeUndefined: () => actual === undefined,
    toBeTruthy: () => !!actual,
    toBeFalsy: () => !actual,
    toContain: (e) => actual != null && actual.includes(e),
    toHaveLength: (n) => actual != null && actual.length === n,
    toBeGreaterThan: (e) => actual > e,
    toBeGreaterThanOrEqual: (e) => actual >= e,
    toBeLessThan: (e) => actual < e,
    toBeLessThanOrEqual: (e) => actual <= e,
    toBeCloseTo: (e, p = 2) => Math.abs(actual - e) < Math.pow(10, -p),
    toMatch: (re) => (typeof re === "string" ? actual.includes(re) : re.test(actual)),
    toThrow: () => {
      let threw = false;
      try { actual(); } catch { threw = true; }
      return threw;
    }
  };
  const api = {};
  for (const [op, fn] of Object.entries(ops)) {
    api[op] = (expected) => {
      if (!fn(expected)) {
        throw new Error("attendu " + op + " : reçu " + show(actual) + ", voulu " + show(expected));
      }
    };
  }
  const negated = {};
  for (const [op, fn] of Object.entries(ops)) {
    negated[op] = (expected) => {
      if (fn(expected)) {
        throw new Error(".not " + op + " a échoué : reçu " + show(actual));
      }
    };
  }
  api.not = negated;
  return api;
};
globalThis.__run = async function () {
  for (const t of __queue) {
    try {
      await t.fn();
      __pass++;
    } catch (e) {
      __failures.push({ name: t.name, error: e && e.message ? e.message : String(e) });
    }
  }
  for (const f of __failures) console.log("ÉCHEC : " + f.name + " → " + f.error);
  console.log("=== " + __pass + " tests OK, " + __failures.length + " échecs ===");
  if (__failures.length > 0) process.exitCode = 1;
};
`;
writeFileSync(join(DEST, "shim.mjs"), shim);

/* ---------- runner ---------- */
const imports = testFiles.map((f) => `await import(${JSON.stringify(f)});`).join("\n");
writeFileSync(
  join(DEST, "runner.mjs"),
  `await import(${JSON.stringify(join(DEST, "shim.mjs"))});\n${imports}\nawait globalThis.__run();\n`
);

console.log("Harnais local —", testFiles.length, "fichiers de test");
execFileSync(process.execPath, ["--experimental-strip-types", join(DEST, "runner.mjs")], {
  stdio: "inherit"
});
