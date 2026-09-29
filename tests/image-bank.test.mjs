import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { imageSize } from 'image-size';

const root = new URL('../', import.meta.url);
const manifestUrl = new URL('src/data/image-bank.generated.json', root);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const source = await readFile(new URL('src/data/imageBank.ts', root), 'utf8');
// Execute the production adapter, adapting only Vite's JSON import for Node.
const executable = stripTypeScriptTypes(source).replace(
  /from '\.\/image-bank\.generated\.json'/,
  `from ${JSON.stringify(manifestUrl.href)} with { type: 'json' }`,
);
assert.match(executable, /with \{ type: 'json' \}/);
const { createImageQueue, randomImageSequence, projectImageBank, allProjectImages } =
  await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`);

function image(name) {
  return Object.freeze({
    src: `/images/${name}.webp`, width: 1200, height: 800,
    filename: `${name}.webp`, creator: '', source: '', sourceUrl: '',
  });
}

function take(queue, count) {
  return Array.from({ length: count }, () => queue.next());
}

test('queue shuffles unique sources once and repeats identical complete cycles', t => {
  const images = Object.freeze([image('a'), image('b'), image('c'), image('d'), image('b')]);
  const random = t.mock.method(Math, 'random', () => 0);
  const queue = createImageQueue(images);
  const firstCycle = take(queue, 4);
  assert.deepEqual(firstCycle.map(item => item.src), [images[1].src, images[2].src, images[3].src, images[0].src]);
  assert.equal(new Set(firstCycle.map(item => item.src)).size, 4);
  assert.equal(firstCycle[0], images[1], 'First entry wins for duplicate catalog sources');
  const shuffleCalls = random.mock.callCount();
  assert.equal(shuffleCalls, 3);
  for (let cycle = 0; cycle < 10; cycle++) assert.deepEqual(take(queue, 4), firstCycle);
  assert.equal(random.mock.callCount(), shuffleCalls, 'Consumption must never reshuffle');
});

test('supplied cover leads every cycle and is not repeated within a cycle', () => {
  const images = Object.freeze([image('a'), image('b'), image('b'), image('c')]);
  const cover = Object.freeze({ ...images[1], creator: 'Cover metadata' });
  const queue = createImageQueue(images, cover);
  const firstCycle = take(queue, 3);
  assert.equal(firstCycle[0], cover);
  assert.equal(new Set(firstCycle.map(item => item.src)).size, 3);
  assert.deepEqual(new Set(firstCycle.map(item => item.src)), new Set(images.map(item => item.src)));
  assert.deepEqual(take(queue, 3), firstCycle);
});

test('cover outside the catalog is included exactly once in every cycle', () => {
  const images = [image('a'), image('b')];
  const cover = image('cover');
  const queue = createImageQueue(images, cover);
  const firstCycle = take(queue, 3);
  assert.equal(firstCycle[0], cover);
  assert.deepEqual(new Set(firstCycle.map(item => item.src)), new Set([...images, cover].map(item => item.src)));
  assert.deepEqual(take(queue, 3), firstCycle);
});

test('empty and singleton queues remain stable indefinitely', () => {
  assert.deepEqual(take(createImageQueue([]), 5), Array(5).fill(undefined));
  const only = image('only');
  for (const queue of [createImageQueue([only]), createImageQueue([only, only], only), createImageQueue([], only)]) {
    assert.deepEqual(take(queue, 5), Array(5).fill(only));
  }
});

test('queues own their arrays and do not share consumption state', t => {
  t.mock.method(Math, 'random', () => 0);
  const images = [image('a'), image('b'), image('c')];
  const original = [...images];
  const one = createImageQueue(images);
  const two = createImageQueue(images);
  assert.deepEqual(images, original);
  const firstCycle = take(one, 3);
  one.next();
  images.length = 0;
  assert.deepEqual(take(two, 3), firstCycle);
});

test('existing randomImageSequence export retains capped, non-mutating behavior', () => {
  const images = Object.freeze([image('a'), image('b'), image('c')]);
  assert.equal(randomImageSequence(images, 2).length, 2);
  assert.equal(new Set(randomImageSequence(images, 10)).size, images.length);
  assert.deepEqual(randomImageSequence(images, 0), []);
  assert.deepEqual(randomImageSequence([], 10), []);
});

test('manifest covers every supported local project image with exact positive dimensions', async () => {
  assert.deepEqual(projectImageBank, manifest);
  assert.deepEqual(allProjectImages, Object.values(manifest).flat());
  assert.ok(allProjectImages.length > 0);
  const imageRoot = new URL('public/images/projects/', root);
  const expectedSources = [];
  for (const project of await readdir(imageRoot, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const projectUrl = new URL(`${encodeURIComponent(project.name)}/`, imageRoot);
    for (const entry of await readdir(projectUrl, { withFileTypes: true })) {
      if (entry.isFile() && /\.(avif|jpe?g|png|webp)$/i.test(entry.name)) {
        expectedSources.push(`/images/projects/${project.name}/${entry.name}`);
      }
    }
  }
  assert.deepEqual(allProjectImages.map(item => item.src).sort(), expectedSources.sort());
  assert.equal(new Set(allProjectImages.map(item => item.src)).size, allProjectImages.length);
  await Promise.all(allProjectImages.map(async item => {
    assert.ok(Number.isInteger(item.width) && item.width > 0, `${item.src}: invalid width`);
    assert.ok(Number.isInteger(item.height) && item.height > 0, `${item.src}: invalid height`);
    const fileUrl = new URL(`public/${item.src.slice(1).split('/').map(encodeURIComponent).join('/')}`, root);
    const dimensions = imageSize(await readFile(fileUrl));
    const rotated = dimensions.orientation >= 5 && dimensions.orientation <= 8;
    assert.deepEqual([item.width, item.height], rotated
      ? [dimensions.height, dimensions.width]
      : [dimensions.width, dimensions.height], `${item.src}: stale dimensions`);
  }));
});

test('complete manifest cycles contain every image exactly once, including the cover', () => {
  const cover = allProjectImages.at(-1);
  const queue = createImageQueue(allProjectImages, cover);
  const cycle = take(queue, allProjectImages.length);
  assert.equal(cycle[0], cover);
  assert.equal(new Set(cycle.map(item => item.src)).size, allProjectImages.length);
  assert.deepEqual(new Set(cycle.map(item => item.src)), new Set(allProjectImages.map(item => item.src)));
  assert.deepEqual(take(queue, allProjectImages.length), cycle);
});
