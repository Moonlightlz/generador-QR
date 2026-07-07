import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const svg = await readFile(path.join(root, 'public', 'icon.svg'));
const out = (name) => path.join(root, 'public', name);

const targets = [
  ['pwa-64x64.png', 64],
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['maskable-icon-512x512.png', 512],
  ['apple-touch-icon-180x180.png', 180],
];

for (const [name, size] of targets) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(name));
  console.log('generated', name);
}
