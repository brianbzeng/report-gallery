import { useLayoutEffect, useRef, useState } from "react";
import { createImageQueue, type BankImage } from "../data/imageBank";
import { createGalleryDistances } from "../data/galleryMotion";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

interface Slide {
  element: HTMLDivElement;
  image: HTMLImageElement;
  photo: BankImage;
  ordinal: number;
  ready: boolean;
}

/** The hero and moving strip share the same photograph nodes throughout the handoff. */
export default function FeaturedGallery({ images }: { images: BankImage[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const live = useRef({ seek: 0, seekVersion: 0, seekDuration: 500, seeking: false, position: 0, paused, dragging: false, keyboard: false, resumeAt: 0 });
  live.current.paused = paused;
  const count = new Set(images.map((image) => image.src)).size;

  const stepPhoto = (direction: -1 | 1) => {
    if (count < 2) return;
    const position = live.current.seeking ? live.current.seek : live.current.position;
    live.current.seek = Math.floor(position + 1e-8) + direction;
    live.current.seekDuration = 250;
    live.current.seeking = true;
    live.current.seekVersion += 1;
    live.current.resumeAt = performance.now() + 500;
  };

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const controls = controlsRef.current;
    const timeline = progressRef.current;
    if (!section || !sticky || !viewport || !track || !controls || !timeline || !images.length) return;

    const cover = images.find((image) => image.filename.startsWith("pexels-jonathanborba-35210801.")) ?? images[0];
    const queue = createImageQueue(images, cover);
    // The tail of this same shuffled cycle supplies the photos to the hero's left.
    const cycle = Array.from({ length: count }, () => queue.next()!);
    const distances = createGalleryDistances(cycle.map((photo) => photo.width / photo.height));
    const cycleIndex = (ordinal: number) => ((ordinal % count) + count) % count;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setActive(0);
    setReady(false);
    const slides: Slide[] = [];
    const history: Slide[] = [];
    const historyTrack = document.createElement("div");
    historyTrack.className = "featured-gallery__history";
    track.append(historyTrack);
    let ordinal = 0;
    let offset = 0;
    let progress = 0;
    let width = 0;
    let height = 0;
    let sectionTop = 0;
    let sectionHeight = 0;
    let travel = 1;
    let galleryHeight = 0;
    let heroHeight = 0;
    let gutter = 20;
    let frame = 0;
    let previousTime = 0;
    let settledAt = 0;
    let isReady = false;
    let dirty = true;
    let alive = true;
    let handledSeek = live.current.seekVersion;
    let reusePool: Map<string, Slide> | undefined;
    let paintedProgress = -1;
    let paintedWidth = 0;
    let paintedHeight = 0;
    let paintedFirst: Slide | undefined;
    let seekAnimation: { from: number; to: number; start: number; duration: number; loaded: boolean; prepared: boolean } | undefined;
    const decoded = new Map<string, Promise<void>>();
    live.current.position = 0;
    live.current.seeking = false;

    const preload = (photo: BankImage) => {
      let pending = decoded.get(photo.src);
      if (!pending) {
        const image = new Image();
        image.src = photo.src;
        pending = image.decode().catch(() => {});
        decoded.set(photo.src, pending);
      }
      return pending;
    };

    const createSlide = (photo: BankImage, ordinal: number) => {
      const cached = reusePool?.get(photo.src);
      if (cached) {
        reusePool!.delete(photo.src);
        cached.ordinal = ordinal;
        cached.image.alt = `Formula 1 photo ${((ordinal % count + count) % count) + 1} of ${count}`;
        cached.element.classList.remove("featured-gallery__slide--current");
        return cached;
      }
      const element = document.createElement("div");
      element.className = "featured-gallery__slide";
      element.dataset.src = photo.src;
      const image = new Image();
      const slide: Slide = { element, image, photo, ordinal, ready: false };
      image.alt = `Formula 1 photo ${((slide.ordinal % count + count) % count) + 1} of ${count}`;
      image.width = photo.width;
      image.height = photo.height;
      image.draggable = false;
      image.decoding = "async";
      if (slide.ordinal === 0) image.fetchPriority = "high";
      image.onload = () => {
        // Decode the next photo before it is allowed to cross into the viewport.
        image.decode().catch(() => {}).then(() => { if (alive) slide.ready = true; });
      };
      image.onerror = () => {
        if (!alive) return;
        slide.ready = true;
        image.hidden = true;
        element.classList.add("featured-gallery__slide--unavailable");
        element.setAttribute("role", "img");
        element.setAttribute("aria-label", "Photograph unavailable");
      };
      image.src = photo.src;
      element.append(image);
      return slide;
    };

    const append = () => {
      const photo = cycle[(ordinal % count + count) % count];
      const slide = createSlide(photo, ordinal++);
      track.append(slide.element);
      slides.push(slide);
    };

    const slideWidth = (slide: Slide) => galleryHeight * slide.photo.width / slide.photo.height;
    const centerStep = () => (slideWidth(slides[0]) + slideWidth(slides[1])) / 2;

    const fillHistory = () => {
      let historyWidth = history.reduce((sum, slide) => sum + slideWidth(slide), 0);
      while (historyWidth < width && history.length < 24) {
        const previousOrdinal = (history[0]?.ordinal ?? slides[0].ordinal) - 1;
        const photo = cycle[(previousOrdinal % count + count) % count];
        const slide = createSlide(photo, previousOrdinal);
        history.unshift(slide);
        historyTrack.prepend(slide.element);
        historyWidth += slideWidth(slide);
      }
      while (history.length > 1 && historyWidth - slideWidth(history[0]) > width) {
        const removed = history.shift()!;
        historyWidth -= slideWidth(removed);
        removed.image.onload = null;
        removed.image.onerror = null;
        removed.element.remove();
      }
    };

    const fillBuffer = () => {
      let bufferedWidth = slides.reduce((sum, slide) => sum + galleryHeight * slide.photo.width / slide.photo.height, 0);
      while ((slides.length < 2 || bufferedWidth < width * 3) && slides.length < 24) {
        append();
        const last = slides.at(-1)!;
        bufferedWidth += galleryHeight * last.photo.width / last.photo.height;
      }
    };

    const measure = () => {
      const oldHeight = galleryHeight;
      width = sticky.clientWidth;
      height = sticky.clientHeight;
      gutter = width <= 960 ? 10 : 20;
      // The page's entrance uses a transform; scroll geometry must use layout coordinates.
      sectionTop = 0;
      for (let node: HTMLElement | null = section; node; node = node.offsetParent as HTMLElement | null) sectionTop += node.offsetTop;
      sectionHeight = section.offsetHeight;
      travel = Math.max(1, sectionHeight - height);
      heroHeight = width <= 960 ? Math.min(height * .64, 620) : Math.min(width * .68, height * .76);
      galleryHeight = Math.min(height * .64, width * (width <= 600 ? .78 : .62) / (cover.width / cover.height));
      if (oldHeight) offset *= galleryHeight / oldHeight;
      // Keep only a few screens of decoded photos mounted, irrespective of catalog size.
      fillBuffer();
      if (!seekAnimation) fillHistory();
      else seekAnimation.prepared = false;
      paintedProgress = -1;
      dirty = false;
    };

    const recycle = () => {
      const removed = slides.shift();
      if (!removed) return;
      removed.element.classList.remove("featured-gallery__slide--current");
      history.push(removed);
      historyTrack.append(removed.element);
      append();
      // A run of portrait images needs more buffered slides than a run of landscapes.
      fillBuffer();
      fillHistory();
      setActive(cycleIndex(slides[0].ordinal));
    };

    const seekTo = (position: number) => {
      const index = Math.floor(position + 1e-8);
      // Keep decoded neighbors when possible; scrubbing never reshuffles the catalog.
      reusePool = new Map([...slides, ...history].map((slide) => [slide.photo.src, slide]));
      const oldSlides = [...slides, ...history];
      slides.length = 0;
      history.length = 0;
      ordinal = index;
      fillBuffer();
      fillHistory();
      const retained = new Set([...slides, ...history]);
      oldSlides.forEach((slide) => {
        if (retained.has(slide)) return;
        slide.image.onload = null;
        slide.image.onerror = null;
        slide.element.remove();
      });
      reusePool = undefined;
      offset = Math.max(0, position - index) * centerStep();
      paintedProgress = -1;
      setActive(cycleIndex(index));
    };

    const tick = (time: number) => {
      const elapsed = previousTime ? time - previousTime : 0;
      const motionElapsed = Math.min(elapsed, 48);
      previousTime = time;
      if (dirty) measure();
      const target = media.matches ? 1 : clamp((window.scrollY - sectionTop) / travel);
      progress = media.matches || Math.abs(target - progress) < .0001 ? target : mix(progress, target, 1 - Math.exp(-elapsed / 85));
      const eased = progress * progress * (3 - 2 * progress);
      const settled = progress >= .999;
      if (settled !== isReady) {
        isReady = settled;
        settledAt = time;
        setReady(settled);
      }
      const visible = window.scrollY + window.innerHeight > sectionTop && window.scrollY < sectionTop + sectionHeight;
      const suspended = document.hidden || document.body.style.overflow === "hidden" || !visible;
      if (settled && handledSeek !== live.current.seekVersion) {
        const from = distances.position(distances.distance(slides[0].ordinal) + offset / galleryHeight);
        const to = live.current.seek;
        const animation = {
          from: distances.distance(from), to: distances.distance(to), start: 0,
          duration: media.matches ? 0 : live.current.seekDuration, loaded: false, prepared: false,
        };
        seekAnimation = animation;
        // Decode the traversed catalog before sliding so long jumps never show empty frames.
        const needed = new Set<BankImage>([...slides, ...history].map((slide) => slide.photo));
        const padding = width / galleryHeight * 2;
        const first = Math.floor(distances.position(Math.min(animation.from, animation.to) - padding));
        const last = Math.ceil(distances.position(Math.max(animation.from, animation.to) + padding));
        for (let index = first; index <= last; index += 1) {
          needed.add(cycle[cycleIndex(index)]);
          if (needed.size === count) break;
        }
        Promise.all([...needed].map(preload)).then(() => {
          if (alive && seekAnimation === animation) animation.loaded = true;
        });
        handledSeek = live.current.seekVersion;
      }
      if (seekAnimation?.loaded && settled && !suspended) {
        if (!seekAnimation.prepared) {
          // Mount the traversed strip once, then animate only its transform. Rebuilding
          // the buffer every frame creates layout/decode stalls on long skips.
          const padding = width / galleryHeight * 2;
          const left = Math.min(seekAnimation.from, seekAnimation.to) - padding;
          const right = Math.max(seekAnimation.from, seekAnimation.to) + padding;
          while (distances.distance(slides.at(-1)!.ordinal) < right) append();
          while (distances.distance(history[0]?.ordinal ?? slides[0].ordinal) > left) {
            const previousOrdinal = (history[0]?.ordinal ?? slides[0].ordinal) - 1;
            const slide = createSlide(cycle[cycleIndex(previousOrdinal)], previousOrdinal);
            history.unshift(slide);
            historyTrack.prepend(slide.element);
          }
          paintedProgress = -1;
          seekAnimation.prepared = true;
        }
        if (!seekAnimation.start) seekAnimation.start = time;
        const amount = seekAnimation.duration ? clamp((time - seekAnimation.start) / seekAnimation.duration) : 1;
        const easedSeek = amount * amount * (3 - 2 * amount);
        offset = (mix(seekAnimation.from, seekAnimation.to, easedSeek) - distances.distance(slides[0].ordinal)) * galleryHeight;
        if (amount === 1) {
          seekTo(distances.position(seekAnimation.to));
          seekAnimation = undefined;
          live.current.seeking = false;
          live.current.resumeAt = time + 250;
        }
      } else if (seekAnimation?.start) {
        seekAnimation.start += elapsed;
      }

      let aheadWidth = -offset;
      const visiblePhotosReady = slides.every((slide) => {
        const needed = aheadWidth < width + galleryHeight;
        aheadWidth += galleryHeight * slide.photo.width / slide.photo.height;
        return !needed || slide.ready;
      });
      const canMove = settled && !suspended && count > 1 && visiblePhotosReady && history.every((slide) => slide.ready);
      if (canMove && !live.current.seeking) {
        if (!live.current.paused && !live.current.dragging && !live.current.keyboard && time >= live.current.resumeAt) {
          const acceleration = clamp((time - settledAt - 250) / 700);
          offset += motionElapsed * (width <= 600 ? .045 : .085) * acceleration;
        }
        let distance = centerStep();
        while (offset >= distance - .01) {
          offset = Math.max(0, offset - distance);
          recycle();
          distance = centerStep();
        }
      }

      const rowHeight = mix(heroHeight, galleryHeight, eased);
      const margin = gutter * (1 - eased);
      const viewportWidth = width - margin * 2;
      const currentWidth = mix(width - gutter * 2, rowHeight * slides[0].photo.width / slides[0].photo.height, eased);
      if (eased !== paintedProgress || width !== paintedWidth || height !== paintedHeight || slides[0] !== paintedFirst) {
        viewport.style.height = `${rowHeight}px`;
        viewport.style.width = `${viewportWidth}px`;
        viewport.style.left = `${margin}px`;
        viewport.style.top = `${(height - rowHeight) / 2}px`;
        slides.forEach((slide, index) => {
          const naturalWidth = rowHeight * slide.photo.width / slide.photo.height;
          slide.element.style.width = `${index === 0 ? currentWidth : naturalWidth}px`;
          slide.element.classList.toggle("featured-gallery__slide--current", index === 0);
        });
        history.forEach((slide) => {
          slide.element.style.width = `${rowHeight * slide.photo.width / slide.photo.height}px`;
        });
        controls.style.top = `${(height + rowHeight) / 2 + 16}px`;
        paintedProgress = eased;
        paintedWidth = width;
        paintedHeight = height;
        paintedFirst = slides[0];
      }
      // Keep the hero centered as its neighbors emerge from behind either viewport edge.
      track.style.transform = `translate3d(${(viewportWidth - currentWidth) / 2 - offset * eased}px, 0, 0)`;
      live.current.position = distances.position(distances.distance(slides[0].ordinal) + offset / galleryHeight);
      const visibleOrdinal = Math.floor(live.current.position + 1e-8);
      const currentIndex = cycleIndex(visibleOrdinal);
      setActive((previous) => previous === currentIndex ? previous : currentIndex);
      const timelineProgress = count > 1 ? clamp((currentIndex + Math.max(0, live.current.position - visibleOrdinal)) / (count - 1)) : 0;
      if (!live.current.dragging && !live.current.keyboard) timeline.value = String(Math.round(timelineProgress * 1000));
      timeline.style.setProperty("--gallery-progress", `${timelineProgress * 100}%`);
      timeline.setAttribute("aria-valuetext", `Photo ${currentIndex + 1} of ${count}`);
      section.dataset.phase = settled ? "gallery" : "shrinking";
      frame = requestAnimationFrame(tick);
    };

    const resize = () => { dirty = true; };
    const motionChange = () => {
      if (media.matches) { live.current.paused = true; setPaused(true); }
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(sticky);
    observer.observe(section);
    if (section.parentElement) observer.observe(section.parentElement);
    window.addEventListener("resize", resize);
    media.addEventListener("change", motionChange);
    measure();
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", motionChange);
      [...slides, ...history].forEach((slide) => { slide.image.onload = null; slide.image.onerror = null; });
      track.replaceChildren();
    };
  }, [images, count]);

  if (!images.length) return null;
  return (
    <section className="featured-gallery" ref={sectionRef} aria-label="Formula 1 photo gallery">
      <div className="featured-gallery__sticky" ref={stickyRef}>
        <div className="featured-gallery__viewport" ref={viewportRef}>
          <div className="featured-gallery__track" ref={trackRef} />
        </div>
        <div className={`featured-gallery__controls${ready ? " is-ready" : ""}`} ref={controlsRef} inert={!ready}>
          <button
            type="button"
            className="featured-gallery__play"
            aria-label={paused ? "Play photo gallery" : "Pause photo gallery"}
            disabled={count < 2}
            onClick={() => {
              live.current.paused = !live.current.paused;
              live.current.keyboard = false;
              setPaused(live.current.paused);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
              {paused ? <path d="M5 3 13 8 5 13Z" /> : <path d="M4 3h3v10H4zM9 3h3v10H9z" />}
            </svg>
          </button>
          <input
            ref={progressRef}
            className="featured-gallery__progress"
            type="range"
            min={0}
            max={1000}
            step={1}
            defaultValue={0}
            disabled={count < 2}
            aria-label="Gallery progress"
            aria-valuetext={`Photo ${active + 1} of ${count}`}
            onChange={(event) => {
              live.current.seek = Math.floor(live.current.position / count) * count
                + Math.round(Number(event.currentTarget.value) / 1000 * (count - 1));
              live.current.seekDuration = 500;
              live.current.seeking = true;
              live.current.seekVersion += 1;
              live.current.resumeAt = performance.now() + 500;
            }}
            onPointerDown={(event) => {
              live.current.dragging = true;
              live.current.keyboard = false;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={() => { live.current.dragging = false; live.current.resumeAt = performance.now() + 500; }}
            onPointerCancel={() => { live.current.dragging = false; }}
            onLostPointerCapture={() => { live.current.dragging = false; }}
            onKeyDown={(event) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) live.current.keyboard = true;
            }}
            onBlur={() => { live.current.keyboard = false; live.current.dragging = false; live.current.resumeAt = performance.now() + 500; }}
          />
          <div className="featured-gallery__arrows">
            <button type="button" aria-label="Previous photograph" disabled={count < 2} onClick={() => stepPhoto(-1)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" focusable="false">
                <path d="M12 8H4m4-4L4 8l4 4" />
              </svg>
            </button>
            <button type="button" aria-label="Next photograph" disabled={count < 2} onClick={() => stepPhoto(1)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" focusable="false">
                <path d="M4 8h8m-4-4 4 4-4 4" />
              </svg>
            </button>
          </div>
          <span className="featured-gallery__position">{active + 1} / {count}</span>
        </div>
      </div>
    </section>
  );
}
