import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imageRoot = join(projectRoot, 'public', 'images', 'projects');
const outputFile = join(projectRoot, 'src', 'data', 'image-bank.generated.json');
const supportedExtensions = new Set(['.avif', '.jpg', '.jpeg', '.png', '.webp']);

function displayName(value) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function creatorFromFilename(filename) {
  const stem = filename.replace(/\.[^.]+$/, '');
  const pexelsName = stem
    .replace(/^pexels-/, '')
    .replace(/-\d+-\d+$/, '')
    .replace(/-\d+$/, '');
  return stem.startsWith('pexels-') ? displayName(pexelsName) : '';
}

const projects = {};
if (statSync(imageRoot, { throwIfNoEntry: false })?.isDirectory()) {
  for (const projectEntry of readdirSync(imageRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!projectEntry.isDirectory()) continue;
    const projectPath = join(imageRoot, projectEntry.name);
    const images = readdirSync(projectPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && supportedExtensions.has(extname(entry.name).toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => {
        const imagePath = join(projectPath, entry.name);
        let dimensions;
        try {
          dimensions = imageSize(readFileSync(imagePath));
        } catch (cause) {
          throw new Error(`Cannot read image dimensions: ${imagePath}`, { cause });
        }
        // Browsers apply EXIF orientation when displaying JPEGs.
        const rotated = dimensions.orientation >= 5 && dimensions.orientation <= 8;
        const width = rotated ? dimensions.height : dimensions.width;
        const height = rotated ? dimensions.width : dimensions.height;
        if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
          throw new Error(`Invalid image dimensions: ${imagePath}`);
        }
        return {
          src: `/${relative(join(projectRoot, 'public'), imagePath).replaceAll('\\', '/')}`,
          width,
          height,
          filename: entry.name,
          creator: creatorFromFilename(entry.name),
          source: entry.name.toLowerCase().startsWith('pexels-') ? 'Pexels' : '',
          sourceUrl: '',
        };
      });
    if (images.length) projects[projectEntry.name] = images;
  }
}

writeFileSync(outputFile, `${JSON.stringify(projects, null, 2)}\n`);
console.log(`Generated image bank for ${Object.keys(projects).length} project(s).`);
