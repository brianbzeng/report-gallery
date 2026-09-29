/** Center-to-center distances in image-height units, independent of viewport size. */
export function createGalleryDistances(ratios: number[]) {
  const count = ratios.length;
  const centers = [0];
  for (let index = 0; index < count; index += 1) {
    centers.push(centers[index] + (ratios[index] + ratios[(index + 1) % count]) / 2);
  }
  const circumference = centers[count];
  return {
    distance(position: number) {
      const ordinal = Math.floor(position);
      const index = ((ordinal % count) + count) % count;
      return Math.floor(ordinal / count) * circumference + centers[index]
        + (position - ordinal) * (centers[index + 1] - centers[index]);
    },
    position(distance: number) {
      const lap = Math.floor(distance / circumference);
      const local = distance - lap * circumference;
      let index = 0;
      while (index < count - 1 && local >= centers[index + 1]) index += 1;
      return lap * count + index + (local - centers[index]) / (centers[index + 1] - centers[index]);
    },
  };
}
