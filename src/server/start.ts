import fs from 'node:fs';
import path from 'node:path';
import { build as viteBuild } from 'vite';
import { startServer } from './index.js';

async function main() {
  const clientDistDir = path.resolve(process.cwd(), 'dist', 'client');
  const indexHtml = path.join(clientDistDir, 'index.html');

  if (!fs.existsSync(indexHtml)) {
    console.log('Building Warm CRM client bundle for first launch...');
    await viteBuild();
  }

  startServer({ clientDistDir });
}

main().catch((err) => {
  console.error('Failed to start Warm CRM:', err);
  process.exit(1);
});
