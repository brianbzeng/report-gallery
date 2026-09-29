import projects from './image-bank.generated.json';

export interface BankImage {
  src: string;
  width: number;
  height: number;
  filename: string;
  creator: string;
  source: string;
  sourceUrl: string;
}

export const projectImageBank = projects as Record<string, BankImage[]>;
export const allProjectImages = Object.values(projectImageBank).flat();

/** Shuffle unique sources once, then recycle that order without mutating inputs.
 * A supplied first image takes precedence over catalog entries with the same src
 * and is included in every cycle, even when it is outside the catalog.
 */
export function createImageQueue(images: BankImage[], first?: BankImage): { next(): BankImage | undefined } {
  const unique = new Map<string, BankImage>();
  for (const image of images) {
    if (image.src !== first?.src && !unique.has(image.src)) unique.set(image.src, image);
  }
  const queue = randomImageSequence([...unique.values()], unique.size);
  if (first) queue.unshift(first);

  return {
    next() {
      const image = queue.shift();
      if (image) queue.push(image);
      return image;
    },
  };
}

export function randomImageSequence(images: BankImage[], requestedCount: number): BankImage[] {
  const shuffled = [...images];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled.slice(0, Math.min(requestedCount, shuffled.length));
}
