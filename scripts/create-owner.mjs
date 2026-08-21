#!/usr/bin/env node
// Computes a PBKDF2-SHA256 password hash (same scheme/iteration count as
// worker/src/crypto.js's hashPin — duplicated inline here rather than
// imported across the worker/root package boundary, since this is a
// one-time operational script, not app code) and writes the owner row
// directly into D1 via `wrangler d1 execute`. Reads OWNER_EMAIL /
// OWNER_PASSWORD from the environment, never a CLI arg, so the password
// never lands in shell history — see create-owner.sh, the wrapper that
// actually prompts for these without echoing.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PBKDF2_ITERATIONS = 100000; // Cloudflare Workers' crypto.subtle.deriveBits
// enforces this as a hard ceiling for PBKDF2 (see worker/src/crypto.js) — matched
// here so a hash created by this script verifies correctly against ownerLogin().

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations },
    keyMaterial,
    256
  );
  return `pbkdf2$${iterations}$${bufToHex(bits)}`;
}

const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
const password = process.env.OWNER_PASSWORD || "";

if (!email || !email.includes("@")) {
  console.error("OWNER_EMAIL must be a valid email address.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("OWNER_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const id = randomUUID();
const salt = randomSalt();
const hash = await hashPassword(password, salt);

// Single-quote SQL string escaping — only the email is attacker/typo-
// reachable text; salt/hash are our own hex output, id is a UUID.
const escapedEmail = email.replace(/'/g, "''");
const sql = `INSERT INTO owners (id, email, password_hash, password_salt) VALUES ('${id}', '${escapedEmail}', '${hash}', '${salt}');`;

const workerDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "worker");

execFileSync("npx", ["wrangler", "d1", "execute", "chilimba-db", "--remote", "--command", sql], {
  cwd: workerDir,
  stdio: "inherit",
});

console.log(`\nOwner account created: ${email}`);
console.log(`Sign in at /owner on the deployed frontend.`);
