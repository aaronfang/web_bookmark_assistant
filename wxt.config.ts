import { resolve } from 'node:path';
import { env } from 'node:process';

import { defineConfig } from 'wxt';

const includeE2eHarness = env.WBA_E2E_HARNESS === '1';

export default defineConfig({
  outDir: includeE2eHarness ? '.output-e2e' : '.output',
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'entrypoints:found': (_wxt, entrypoints) => {
      if (includeE2eHarness) {
        entrypoints.push({
          name: 'e2e-harness',
          inputPath: resolve('tests/e2e/harness/index.html'),
          type: 'unlisted-page',
        });
      }
    },
  },
  manifest: {
    name: 'Web Bookmark Assistant',
    description: '本地优先的 Chrome 书签检索、分类和回顾助手',
    version: '0.1.0',
    permissions: ['bookmarks', 'sidePanel'],
    action: {
      default_title: 'Web Bookmark Assistant',
    },
  },
});
