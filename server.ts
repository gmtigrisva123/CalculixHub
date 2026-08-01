/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local development server.
 *
 * This file used to be the application: 595 lines mixing fixture data, prompt
 * templates, route handlers and process bootstrap, with no validation layer and
 * no security headers. It is now an adapter and nothing else. The API lives in
 * `src/server/`, is runtime-agnostic, and is exercised by the same tests
 * whether it runs here or on Vercel.
 *
 * Two jobs remain:
 *
 *   1. Bridge Node's `(req, res)` to the Web-standard handler in `src/server/`.
 *   2. Serve the front end -- through Vite in development, from `dist/` in
 *      production -- with the document security headers applied.
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { buildApp } from './src/server/app';
import { config } from './src/server/config';
import { problem } from './src/server/http';
import { securityHeaders, withHeaders } from './src/server/security';

dotenv.config();

const appConfig = config();
const handleApiRequest = buildApp({ config: appConfig });
const server = express();

// Express advertises itself by default, which tells a scanner exactly which
// framework's advisories to try. There is no reason to volunteer it.
server.disable('x-powered-by');

/**
 * Read the request body under a hard ceiling.
 *
 * Buffering stops the moment the ceiling is passed, so an oversized upload
 * costs the memory it had already sent and no more. This is the adapter-level
 * counterpart to the check in `readJsonBody`: that one protects the handler,
 * this one protects the process.
 *
 * The stream is paused rather than destroyed. Destroying it tears down the
 * socket the response has to travel over, so the caller sees a connection reset
 * instead of a 413 and cannot tell a size limit from a crashed server. The
 * connection is closed afterwards instead, once the status has been delivered.
 */
function readBody(request: express.Request, maxBytes: number): Promise<Buffer | 'too-large'> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    request.on('data', (chunk: Buffer) => {
      if (settled) return;

      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        request.pause();
        resolve('too-large');
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    request.on('error', reject);
  });
}

/** Convert an Express request into a Web-standard `Request`. */
async function toWebRequest(request: express.Request, body: Buffer): Promise<Request> {
  // A fixed base: only the path and query are read downstream, so the client's
  // Host header is never allowed to influence routing or any generated URL.
  const url = new URL(request.originalUrl, 'http://localhost');

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
    else if (value !== undefined) headers.set(key, value);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  return new Request(url, { method: request.method, headers, ...(hasBody ? { body } : {}) });
}

/** Write a Web-standard `Response` back through Express. */
async function sendWebResponse(response: Response, res: express.Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));

  const body = response.body ? Buffer.from(await response.arrayBuffer()) : undefined;
  if (body && body.length > 0) res.send(body);
  else res.end();
}

server.all(/^\/api\//, async (req, res, next) => {
  try {
    const body = await readBody(req, appConfig.maxBodyBytes);
    if (body === 'too-large') {
      // Built with the same helpers as every other response, so the refusal
      // carries the standard problem document and the full header policy rather
      // than being a bespoke shape only this path produces.
      const refusal = withHeaders(
        problem(413, 'payload-too-large', 'Payload too large', `Body must not exceed ${appConfig.maxBodyBytes} bytes.`),
        securityHeaders('api', { isProduction: appConfig.isProduction }),
      );

      // The rest of the request body was never read, so this connection cannot
      // be reused for another. Close it once the response has been flushed.
      res.setHeader('connection', 'close');
      await sendWebResponse(refusal, res);
      return;
    }

    const webRequest = await toWebRequest(req, body);
    const response = await handleApiRequest(webRequest, {
      // `req.socket.remoteAddress` cannot be forged by the client, unlike
      // `x-forwarded-for`. Locally there is no trusted proxy in front, so this
      // is the only identity worth rate-limiting on.
      peerAddress: req.socket.remoteAddress ?? undefined,
    });

    await sendWebResponse(response, res);
  } catch (error) {
    next(error);
  }
});

async function startServer(): Promise<void> {
  const documentHeaders = securityHeaders('document', { isProduction: appConfig.isProduction });

  if (appConfig.isProduction) {
    // Only the built application is served in production, and every document
    // response carries the same hardening headers the API does.
    const distPath = path.join(process.cwd(), 'dist');

    server.use((_req, res, next) => {
      for (const [key, value] of Object.entries(documentHeaders)) res.setHeader(key, value);
      next();
    });
    server.use(express.static(distPath));
    server.get(/.*/, (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    // Vite's dev server needs inline scripts and eval for hot module
    // replacement, so the production document policy is not applied here. The
    // policy is verified against a production build instead, which is the only
    // artefact it has to hold for.
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    server.use(vite.middlewares);
  }

  // Last-resort error handler. Express only routes to a four-argument handler,
  // and without one an error surfaces as a stack trace in the response body.
  server.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[CalculixHub] Unhandled server error', error);
    if (!res.headersSent) res.status(500).json({ title: 'Internal server error', status: 500 });
  });

  const port = Number(process.env.PORT ?? '8000') || 8000;

  server.listen(port, '0.0.0.0', () => {
    console.log(`[CalculixHub] Listening on http://localhost:${port}`);
    console.log(
      `[CalculixHub] mode=${appConfig.nodeEnv} model=${appConfig.geminiApiKey ? appConfig.geminiModel : 'disabled (no key)'} ` +
        `aiBudget=${appConfig.aiDailyCallBudget}/day origins=${appConfig.allowedOrigins.length}`,
    );
  });
}

/**
 * A rejected promise with no handler terminates the process under Node's
 * default policy. Every such path inside the API is already closed, but this
 * catches anything in startup or in a future dependency -- a crash loop is a
 * far worse outcome than a logged error.
 */
process.on('unhandledRejection', (reason) => {
  console.error('[CalculixHub] Unhandled promise rejection', reason);
});

startServer().catch((error) => {
  console.error('[CalculixHub] Failed to start', error);
  process.exitCode = 1;
});
