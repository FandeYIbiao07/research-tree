import { readdirSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const folder = readdirSync('node_modules/.pnpm').find((name) =>
  name.startsWith('esbuild@'),
);
const { build } = require(
  `../node_modules/.pnpm/${folder}/node_modules/esbuild`,
);
mkdirSync('work', { recursive: true });
await build({
  entryPoints: ['tests/research-tree.test.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'work/research-tree.test.cjs',
});
const result = spawnSync(
  process.execPath,
  ['--test', 'work/research-tree.test.cjs'],
  { stdio: 'inherit', env: process.env },
);
process.exit(result.status ?? 1);
