# Research Work

Brian Zeng's standalone research gallery. The site introduces the collection, features the latest report, provides a report index and About page, and includes contact links and image credits.

## Local development

```sh
npm ci
npm run dev
```

The Vite preview is available at `http://127.0.0.1:4178`.

```sh
npm run build
npm test
```

The static production output is generated in `dist/`. `public/_redirects` enables direct navigation to client-side routes on Cloudflare Pages.

## Adding report imagery

Place images in `public/images/projects/<project-slug>/`. `npm run dev` and `npm run build` regenerate `src/data/image-bank.generated.json` with image dimensions and credits inferred from filenames. Use filenames such as `pexels-creator-name-123456.webp`; include source-page URLs in the image-bank data when available.

The greeting draws from the project image bank, while the Featured page currently uses the `f1-stewarding` collection and continues into the Formula 1 Stewarding Analysis report. The About page includes Brian's portrait and current focus list. Contact includes the image-credit list.

## Typography and assets

DM Sans and Instrument Serif are included in `public/fonts/` under the SIL Open Font License, with their license texts alongside the font files. The Formula 1 project images are from Brian's curated photo collection; a separate Credits view lists image filenames and credited creators.

This repository contains the current Research Work site only. Legacy visual-study product records and original reference assets are kept out of the public repository and deployment.
