import { access, readFile } from 'node:fs/promises';

const outputDir = '.output/chrome-mv3';

try {
  await access(`${outputDir}/e2e-harness.html`);
  throw new Error('Production build unexpectedly contains the E2E harness');
} catch (error) {
  if (
    !(error instanceof Error) ||
    !('code' in error) ||
    error.code !== 'ENOENT'
  ) {
    throw error;
  }
}

const manifest = JSON.parse(
  await readFile(`${outputDir}/manifest.json`, 'utf8'),
);
if (manifest.options_ui?.open_in_tab !== true) {
  throw new Error('Production options page must open in a full tab');
}
