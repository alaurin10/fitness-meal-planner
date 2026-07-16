// Run this on YOUR OWN computer (not the server) to sign in to Garmin from an
// IP Garmin trusts and print the resulting OAuth token pair:
//
//   pnpm --filter @app/server garmin:export-tokens
//
// Why this exists: Garmin's SSO rate-limits by IP reputation, and cloud hosts
// (Railway etc.) share outbound IPs across many customers — so in-app sign-in
// can be permanently throttled in production while working fine from home.
// This script reuses the app's exact login flow (login.ts, including the 2FA
// code step) and prints a one-line JSON blob to paste into the app's Garmin
// card under "Import tokens". It needs no database or env vars — nothing is
// stored; the tokens only ever go to stdout.
//
// Prompts go to stderr and the token JSON to stdout, so the output can be
// piped or redirected cleanly (e.g. `... 2>/dev/tty | pbcopy`).

import * as readline from "node:readline";
import { stdin, stderr, stdout, exit } from "node:process";
import { startGarminLogin, resumeGarminLogin } from "./login.js";
import type { StoredTokens } from "./types.js";

// One shared interface plus an explicit line queue. Interleaving rl.question()
// calls with piped input loses lines: readline emits every line of a chunk
// synchronously, so a line that arrives between two question() registrations
// is dropped. Buffering 'line' events makes prompts work identically for TTYs
// and pipes. terminal mode only on a real TTY (where readline handles echo,
// letting us mute it for the password); piped input never echoes anyway.
const rl = readline.createInterface({ input: stdin, output: stderr, terminal: stdin.isTTY });

const pendingLines: string[] = [];
const lineWaiters: Array<(line: string | null) => void> = [];
let inputClosed = false;

rl.on("line", (line) => {
  const waiter = lineWaiters.shift();
  if (waiter) waiter(line);
  else pendingLines.push(line);
});
rl.on("close", () => {
  inputClosed = true;
  for (const waiter of lineWaiters.splice(0)) waiter(null);
});

function nextLine(): Promise<string | null> {
  const buffered = pendingLines.shift();
  if (buffered !== undefined) return Promise.resolve(buffered);
  if (inputClosed) return Promise.resolve(null);
  return new Promise((resolve) => lineWaiters.push(resolve));
}

async function ask(question: string, opts: { hidden?: boolean } = {}): Promise<string> {
  stderr.write(question);
  const anyRl = rl as unknown as { _writeToOutput?: (s: string) => void };
  const originalWrite = anyRl._writeToOutput;
  // Mute readline's echo while a password is typed so keystrokes (and pastes)
  // aren't displayed. _writeToOutput is internal but stable; if a future Node
  // drops it the only regression is a visible password.
  if (opts.hidden) anyRl._writeToOutput = () => {};
  const line = await nextLine();
  if (opts.hidden) {
    anyRl._writeToOutput = originalWrite;
    stderr.write("\n");
  }
  if (line === null) {
    stderr.write("\nInput ended before all prompts were answered.\n");
    exit(1);
  }
  return line.trim();
}

async function main(): Promise<void> {
  stderr.write("Garmin token export — sign in from this machine, paste the result into the app.\n");
  stderr.write("Your password is used only for this sign-in and is never stored or printed.\n\n");

  const username = await ask("Garmin email: ");
  const password = await ask("Garmin password (input hidden): ", { hidden: true });
  if (!username || !password) {
    stderr.write("Email and password are both required.\n");
    exit(1);
  }

  stderr.write("Signing in to Garmin…\n");
  const started = await startGarminLogin(username, password);

  let tokens: StoredTokens;
  if (started.status === "mfa_required") {
    const code = await ask("Verification code Garmin just sent you: ");
    stderr.write("Verifying code…\n");
    ({ tokens } = await resumeGarminLogin(started.pending, code));
  } else {
    tokens = started.tokens;
  }

  stderr.write(
    "\nSuccess! Copy the single line below and paste it into the app:\n" +
      "Profile → Connections → Garmin watch → “Import tokens from your computer”.\n" +
      "Treat it like a password — it grants access to your Garmin account for ~1 year.\n\n",
  );
  stdout.write(`${JSON.stringify(tokens)}\n`);
  rl.close();
}

main().catch((err: unknown) => {
  stderr.write(`\nSign-in failed: ${err instanceof Error ? err.message : String(err)}\n`);
  exit(1);
});
