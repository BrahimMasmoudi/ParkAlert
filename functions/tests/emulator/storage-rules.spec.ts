import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'parkalert-test',
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: readFileSync(resolve(__dirname, '../../../storage.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv?.clearStorage();
});

describe('storage.rules /reports/{agentId}/{fileName}', () => {
  it('allows agent to create valid JPEG under 1.5 MB, blocks SVG/HEIC/oversize, and denies reads, updates, and deletes', async () => {
    const validBytes = new Uint8Array(1024).fill(1);
    const oversizedBytes = new Uint8Array(1600000).fill(1);

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref('reports/agent-1/existing.jpg').put(validBytes, { contentType: 'image/jpeg' }).then();
    });

    const agentStorage = testEnv.authenticatedContext('agent-1').storage();
    const otherStorage = testEnv.authenticatedContext('agent-2').storage();

    await assertSucceeds(
      agentStorage.ref('reports/agent-1/new.jpg').put(validBytes, { contentType: 'image/jpeg' }).then()
    );
    await assertFails(
      agentStorage.ref('reports/agent-1/xss.svg').put(validBytes, { contentType: 'image/svg+xml' }).then()
    );
    await assertFails(
      agentStorage.ref('reports/agent-1/photo.heic').put(validBytes, { contentType: 'image/heic' }).then()
    );
    await assertFails(
      agentStorage.ref('reports/agent-1/huge.jpg').put(oversizedBytes, { contentType: 'image/jpeg' }).then()
    );
    await assertFails(
      otherStorage.ref('reports/agent-1/spoof.jpg').put(validBytes, { contentType: 'image/jpeg' }).then()
    );

    // Direct reads, overwrites, and client deletes are all denied
    await assertFails(agentStorage.ref('reports/agent-1/existing.jpg').getDownloadURL());
    await assertFails(
      agentStorage.ref('reports/agent-1/existing.jpg').put(validBytes, { contentType: 'image/jpeg' }).then()
    );
    await assertFails(agentStorage.ref('reports/agent-1/existing.jpg').delete());
  });
});
