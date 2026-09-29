import type { Photo } from "../types";

export const studio = {
  image: {
    url: "/images/brian-profile.png",
    width: 2160,
    height: 2880,
    color: "#6f625d",
  } satisfies Photo,
};

export function imageUrl(photo: Photo, _width?: number): string {
  return photo.url;
}
