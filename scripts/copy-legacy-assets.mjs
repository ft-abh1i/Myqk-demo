import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const excludedTopLevel = new Set([
  '.git',
  '.github',
  'dist',
  'node_modules',
  'scripts',
  'src',
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'vercel.json',
]);
const staticExtensions = new Set([
  '.css', '.js', '.mjs', '.cjs', '.json', '.webmanifest',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.webm',
]);

async function copyDirectory(source, destination, isTopLevel = false) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source)) {
    if (isTopLevel && excludedTopLevel.has(entry)) continue;

    const sourcePath = path.join(source, entry);
    const destinationPath = path.join(destination, entry);
    const info = await stat(sourcePath);

    if (info.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }

    if (staticExtensions.has(path.extname(entry).toLowerCase())) {
      await cp(sourcePath, destinationPath, { force: true });
    }
  }
}

await copyDirectory(root, output, true);
console.log('Copied legacy CSS, JavaScript, images and font assets into dist.');
