#!/usr/bin/env node
/**
 * The browser an agent drives, one command at a time.
 *
 *   node qa/agent/browser.mjs <id> start [--device desktop|mobile|tablet]
 *   node qa/agent/browser.mjs <id> goto <url>
 *   node qa/agent/browser.mjs <id> snap [--all]
 *   node qa/agent/browser.mjs <id> click <ref|text>
 *   ... see qa/agent/BRIEF.md for the full list.
 *
 * `start` launches a daemon (daemon.mjs) that keeps the page open between
 * commands; every other command is a request to it.
 */
import { spawn } from 'node:child_process';
import { existsSync, openSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outPath } from '../lib/config.mjs';

const [id, cmd, ...args] = process.argv.slice(2);
if (!id || !cmd) {
  console.error('Usage: node qa/agent/browser.mjs <id> <command> [args]');
  process.exit(2);
}

const portFile = outPath('agents', id, 'port');
const daemonPort = () => (existsSync(portFile) ? Number(readFileSync(portFile, 'utf8')) : null);

async function alive(port) {
  if (!port) return false;
  try { return (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch { return false; }
}

const freePort = () => new Promise((resolve) => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

async function start() {
  if (await alive(daemonPort())) return 'Browser already running.';
  const device = args.includes('--device') ? args[args.indexOf('--device') + 1] : 'desktop';
  const port = await freePort();
  const logFile = openSync(outPath('agents', id, 'daemon.log'), 'a');
  const child = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'daemon.mjs'), id, String(port), device], {
    detached: true,
    stdio: ['ignore', logFile, logFile],
    env: process.env,
  });
  child.unref();
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    if (daemonPort() === port && (await alive(port))) return `Browser started (${device}).`;
  }
  throw new Error(`The browser did not start; see qa/out/agents/${id}/daemon.log`);
}

async function send() {
  const port = daemonPort();
  if (!(await alive(port))) throw new Error(`No browser running for ${id}. Run: node qa/agent/browser.mjs ${id} start --device <device>`);
  const response = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body: JSON.stringify({ cmd, args }) });
  const result = await response.json();
  if (!result.ok) throw new Error(result.text);
  return result.text;
}

try {
  console.log(cmd === 'start' ? await start() : await send());
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
