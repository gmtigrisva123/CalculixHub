import { describe, expect, it } from 'vitest';
import { readArenaResponse } from './arenaResponse';

describe('Arena API response', () => {
  it('shows a readable fallback for a Vercel text error page', async () => {
    const response = new Response('The page could not be found', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
    await expect(readArenaResponse(response, 'Could not open this match right now.')).rejects.toThrow(
      'Could not open this match right now.',
    );
  });

  it('keeps a useful message from a JSON API error', async () => {
    const response = Response.json({ error: 'Register before entering' }, { status: 409 });
    await expect(readArenaResponse(response, 'Could not open this match right now.')).rejects.toThrow(
      'Register before entering',
    );
  });
});
