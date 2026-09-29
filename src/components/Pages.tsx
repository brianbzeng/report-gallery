import { useState } from "react";
import { studio, imageUrl } from "../data";
import { Link } from "../navigation";
import type { Photo } from "../types";
import { allProjectImages, projectImageBank, randomImageSequence } from "../data/imageBank";
import FeaturedGallery from "./FeaturedGallery";
import F1Report from "./F1Report";

export function Picture({
  photo,
  alt,
  eager = false,
  className = "",
}: {
  photo: Photo;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      className={className}
      src={
        failed ? "/image-unavailable.svg" : imageUrl(photo, eager ? 1800 : 1000)
      }
      srcSet={
        failed
          ? undefined
          : [400, 800, 1200, 1800]
              .filter((w) => w <= Math.max(photo.width, 400))
              .map((w) => `${imageUrl(photo, w)} ${w}w`)
              .join(", ")
      }
      sizes={eager ? "100vw" : "(max-width: 960px) 100vw, 40vw"}
      width={photo.width}
      height={photo.height}
      style={{ backgroundColor: photo.color }}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      alt={failed ? `${alt} — image unavailable` : alt}
      onError={() => setFailed(true)}
    />
  );
}

export function HomePage() {
  const [selection] = useState(() => {
    const images = randomImageSequence(allProjectImages, 2);
    return { images, layout: images.length > 1 ? Math.floor(Math.random() * 3) : 0 };
  });
  const { images: [primary, secondary], layout } = selection;
  return (
    <main className={`home-page home-layout-${layout}`} id="main" tabIndex={-1}>
      <h1 className="home-word home-word--research">Research</h1>
      <div className="home-reveal-mask">
        <div className="home-composition">
          {primary && (
            <Link className="home-primary" href="/featured" aria-label="Explore the featured report">
              <Picture
                photo={{ url: primary.src, width: primary.width, height: primary.height, color: "#d4d1cb" }}
                alt="Research project photograph"
                eager
              />
            </Link>
          )}
          {layout !== 0 && secondary && (
            <Link className="home-secondary" href="/featured" aria-label="Explore the featured report">
              <Picture
                photo={{ url: secondary.src, width: secondary.width, height: secondary.height, color: "#d4d1cb" }}
                alt="Research project photograph"
                eager
              />
            </Link>
          )}
        </div>
      </div>
      <div className="home-word home-word--work" aria-hidden="true">
        Work
      </div>
    </main>
  );
}

export function FeaturedPage() {
  const f1Images = projectImageBank["f1-stewarding"] ?? [];

  return (
    <main className="featured-page route-reveal" id="main" tabIndex={-1}>
      <div className="featured-page-heading">
        <span>Featured Report</span>
        <h1>Formula 1 Stewarding Analysis</h1>
      </div>
      <FeaturedGallery images={f1Images} />
      <F1Report />
    </main>
  );
}

export function CataloguePage() {
  return (
    <main className="catalogue-page route-reveal" id="main" tabIndex={-1}>
      <h1>Data-driven Analytic Reports</h1>
      <div className="catalogue-list">
        <div className="catalogue-columns" aria-hidden="true">
          <span>#</span>
          <span>Title</span>
          <span>Published</span>
          <span>Repository</span>
        </div>
        <div className="catalogue-row">
          <span className="catalogue-number">#1</span>
          <h2><Link href="/featured">Formula 1 Stewarding Analysis</Link></h2>
          <span className="catalogue-published">09/02/26</span>
          <a className="catalogue-repo" href="https://github.com/brianbzeng/f1-stewarding-analysis" aria-label="Github (opens repository)">
            Github
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M5 4h7v7M12 4 4 12" />
            </svg>
          </a>
        </div>
      </div>
    </main>
  );
}

export function StudioPage() {
  return (
    <main className="studio-page route-reveal" id="main" tabIndex={-1}>
      <h1 className="sr-only">About</h1>
      <div className="studio-profile">
        <p>
          This is a collection of research I do in my spare time. These reports are my attempts to answer questions I have with the hobbies I'm involved with. Whether that's watching sports like the NBA or F1, or out fishing, I use my understanding of data science to try and answer them. This hub is dedicated to my data science reports, but for my other projects, please visit{" "}
          <a href="https://brianbzeng.com">brianbzeng.com</a>.
        </p>
      </div>
      <div className="studio-details">
        <section className="studio-pursuits">
          <h2>Current Focus</h2>
          <ol>
            <li>Data Scientist / Analyst Opportunities</li>
            <li>AI Engineering Opportunities</li>
            <li>Independent Research Reports</li>
          </ol>
        </section>
        <div className="studio-portrait">
          <Picture
            photo={studio.image}
            alt="Portrait of Brian Zeng by a window"
            eager
          />
        </div>
      </div>
    </main>
  );
}
