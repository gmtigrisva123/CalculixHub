/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The API is Web-standard and runs on Node in both targets, so tests need
    // no DOM. `Request`, `Response` and `Headers` are globals here already.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // A hung test is a broken test; fail fast rather than blocking CI.
    testTimeout: 10_000,
  },
});
