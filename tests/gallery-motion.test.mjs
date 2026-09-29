import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../src/data/galleryMotion.ts', import.meta.url), 'utf8');
const { createGalleryDistances } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);

test('gallery distance follows natural widths and center-to-center spacing', () => {
  const motion = createGalleryDistances([1.5, .5, 2]);
  assert.equal(motion.distance(0), 0);
  assert.equal(motion.distance(1), 1);
  assert.equal(motion.distance(2), 2.25);
  assert.equal(motion.distance(3), 4);
  assert.equal(motion.distance(-1), -1.75);
});

test('seeking distance round trips in both directions across loop boundaries', () => {
  for (const ratios of [[1], [1.5, .5, 2], [.3, 3, 1, .5, 1.8]]) {
    const motion = createGalleryDistances(ratios);
    for (let position = -120; position < 120; position += .125) {
      assert.ok(Math.abs(motion.position(motion.distance(position)) - position) < 1e-9);
    }
  }
});

test('equal distance steps preserve physical speed across unequal photo widths', () => {
  const motion = createGalleryDistances([1.5, .5, 2]);
  const start = motion.distance(-1);
  const end = motion.distance(7);
  const frames = Array.from({ length: 31 }, (_, index) => motion.position(start + (end - start) * index / 30));
  frames.slice(1).forEach((position, index) => {
    assert.ok(Math.abs(motion.distance(position) - motion.distance(frames[index]) - (end - start) / 30) < 1e-9);
  });
});
