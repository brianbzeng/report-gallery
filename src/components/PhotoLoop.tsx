import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { imageUrl } from '../data';
import type { Photo } from '../types';
import './PhotoLoop.css';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const wrap = (value: number, length: number) => length > 0 ? ((value % length) + length) % length : 0;
const ratio = (photo: Photo) => photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1;

interface PhotoLoopProps {
  photos: Photo[];
  name: string;
  collapsed: boolean;
  enlarged: boolean;
  canEnlarge: boolean;
  initialIndex: number;
  paused: boolean;
  reducedMotion: boolean;
  suspended: boolean;
  onPauseChange: (paused: boolean) => void;
  onEnlarge: (index: number) => void;
}

function Photograph({ photo, name, index, duplicate, enlarged, eager }: {
  photo: Photo; name: string; index: number; duplicate: boolean; enlarged: boolean; eager: boolean;
}) {
  const requested = imageUrl(photo, enlarged ? 2400 : 1600);
  const [original, setOriginal] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setOriginal(false); setFailed(false); }, [requested]);
  return (
    <span className="photo-loop__image" style={{ backgroundColor: photo.color || '#c9c7c4' }}>
      {failed ? (
        <span className="photo-loop__unavailable" role={duplicate ? undefined : 'img'}
          aria-label={duplicate ? undefined : `${name}, photograph ${index + 1} unavailable`}>
          Photograph unavailable
        </span>
      ) : (
        <img src={original ? photo.url : requested} alt={duplicate ? '' : `${name} — photograph ${index + 1}`}
          width={photo.width || 1000} height={photo.height || 1000}
          loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false}
          onError={() => {
            if (!original && requested !== photo.url) setOriginal(true);
            else setFailed(true);
          }} />
      )}
    </span>
  );
}

/** DOM photographs, with a measured transform loop on desktop and native scroll snap on touch screens. */
export default function PhotoLoop({ photos, name, collapsed, enlarged, canEnlarge, initialIndex,
  paused, reducedMotion, suspended, onPauseChange, onEnlarge }: PhotoLoopProps) {
  const mobile = useMediaQuery('(max-width: 960px), (pointer: coarse)');
  const vertical = enlarged && !mobile;
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cycleRef = useRef<HTMLDivElement>(null);
  const geometry = useRef({ length: 0, stops: [] as number[] });
  const position = useRef(0);
  const current = useRef(0);
  const mobileTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [copies, setCopies] = useState(2);
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const helpId = useId();
  const playing = !paused && !reducedMotion && !suspended && !hidden;
  const zoomable = canEnlarge && !mobile;
  const count = photos.length;

  const showIndex = (index: number) => {
    if (index === current.current) return;
    current.current = index;
    setActive(index);
  };

  const paint = () => {
    const { length, stops } = geometry.current;
    position.current = wrap(position.current, length);
    if (trackRef.current) {
      trackRef.current.style.transform = vertical
        ? `translate3d(0, ${-position.current}px, 0)`
        : `translate3d(${-position.current}px, 0, 0)`;
    }
    let index = 0;
    for (let i = 1; i < stops.length; i++) {
      if (stops[i] > position.current + 1) break;
      index = i;
    }
    showIndex(index);
  };

  // Keep handlers current without restarting the frame loop on every image boundary.
  const live = useRef({ paint, showIndex, playing, onPauseChange });
  useLayoutEffect(() => { live.current = { paint, showIndex, playing, onPauseChange }; });

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !count) return;
    current.current = Math.min(initialIndex, count - 1);
    setActive(current.current);
    if (mobile) {
      if (trackRef.current) trackRef.current.style.transform = '';
      const place = () => {
        viewport.scrollTo({ left: (current.current + (count > 1 ? 1 : 0)) * viewport.clientWidth, behavior: 'instant' });
      };
      place();
      const observer = new ResizeObserver(place);
      observer.observe(viewport);
      return () => observer.disconnect();
    }
    const cycle = cycleRef.current;
    if (!cycle) return;
    let first = true;
    geometry.current = { length: 0, stops: [] };
    const measure = () => {
      const length = vertical ? cycle.offsetHeight : cycle.offsetWidth;
      const stops = Array.from(cycle.children, element => vertical
        ? (element as HTMLElement).offsetTop : (element as HTMLElement).offsetLeft);
      if (first) {
        position.current = stops[current.current] || 0;
        first = false;
      } else if (geometry.current.length) {
        position.current *= length / geometry.current.length;
      }
      geometry.current = { length, stops };
      const visible = vertical ? viewport.clientHeight : viewport.clientWidth;
      setCopies(Math.max(2, Math.ceil(visible / Math.max(length, 1)) + 1));
      live.current.paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(cycle);
    return () => observer.disconnect();
  }, [mobile, vertical, count, initialIndex]);

  useEffect(() => {
    if (mobile || !playing || count === 0) return;
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      // Clamp long gaps so tab suspension never produces a large jump.
      if (previous) position.current += Math.min(time - previous, 64) * 0.12;
      previous = time;
      live.current.paint();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mobile, playing, count]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || suspended) return;
      if (mobile) { live.current.onPauseChange(true); return; }
      // In Info mode vertical wheel input belongs to the document.
      if (collapsed && Math.abs(event.deltaY) >= Math.abs(event.deltaX)) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      event.preventDefault();
      position.current += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      live.current.paint();
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => viewport.removeEventListener('wheel', wheel);
  }, [mobile, collapsed, suspended]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!mobile || !playing || count < 2 || !viewport) return;
    const timer = window.setInterval(() => {
      viewport.scrollTo({ left: (current.current + 2) * viewport.clientWidth, behavior: 'smooth' });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [mobile, playing, count]);

  useEffect(() => () => clearTimeout(mobileTimer.current), []);

  const settleMobile = () => {
    if (!mobile) return;
    clearTimeout(mobileTimer.current);
    mobileTimer.current = setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport?.clientWidth) return;
      const page = Math.round(viewport.scrollLeft / viewport.clientWidth);
      const index = wrap(page - (count > 1 ? 1 : 0), count);
      showIndex(index);
      if (count > 1 && (page === 0 || page === count + 1)) {
        viewport.scrollTo({ left: (index + 1) * viewport.clientWidth, behavior: 'instant' });
      }
    }, 140);
  };

  const goTo = (index: number) => {
    onPauseChange(true);
    const target = wrap(index, count);
    if (mobile) {
      viewportRef.current?.scrollTo({ left: (target + (count > 1 ? 1 : 0)) * (viewportRef.current?.clientWidth || 0),
        behavior: reducedMotion ? 'instant' : 'smooth' });
      showIndex(target);
    } else {
      position.current = geometry.current.stops[target] || 0;
      paint();
    }
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' || (vertical && event.key === 'ArrowDown')) {
      event.preventDefault(); goTo(current.current + 1);
    } else if (event.key === 'ArrowLeft' || (vertical && event.key === 'ArrowUp')) {
      event.preventDefault(); goTo(current.current - 1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); goTo(event.key === 'Home' ? 0 : count - 1);
    } else if (event.key === ' ') {
      event.preventDefault(); if (!reducedMotion) onPauseChange(!paused);
    } else if (event.key === 'Enter' && zoomable) {
      event.preventDefault(); onEnlarge(current.current);
    }
  };

  const slide = (photo: Photo, index: number, duplicate: boolean, key: string) => (
    <div className={`photo-loop__slide${zoomable ? ' photo-loop__slide--zoomable' : ''}`} key={key}
      style={{ '--photo-ratio': ratio(photo) } as CSSProperties}
      aria-hidden={duplicate || undefined} role={duplicate ? undefined : 'group'}
      aria-roledescription={duplicate ? undefined : 'slide'}
      aria-label={duplicate ? undefined : `${index + 1} of ${count}`}>
      {zoomable ? (
        <button type="button" className="photo-loop__photo-button" tabIndex={-1}
          aria-label={`${vertical ? 'Reduce' : 'Enlarge'} photograph ${index + 1}`}
          onPointerDown={event => event.preventDefault()}
          onClick={() => onEnlarge(index)}>
          <Photograph photo={photo} name={name} index={index} duplicate={duplicate} enlarged={vertical} eager={index < 2} />
        </button>
      ) : <Photograph photo={photo} name={name} index={index} duplicate={duplicate} enlarged={false} eager={index < 2} />}
    </div>
  );

  return (
    <div className={`photo-loop${mobile ? ' photo-loop--native' : ''}${vertical ? ' photo-loop--vertical' : ''}${collapsed ? ' photo-loop--compact' : ''}`}>
      <div className="photo-loop__viewport" ref={viewportRef} tabIndex={0} role="region"
        aria-label={`${name} photographs`} aria-roledescription="carousel" aria-describedby={helpId}
        onKeyDown={handleKey} onScroll={mobile ? settleMobile : undefined}
        onPointerDown={() => { if (mobile) onPauseChange(true); }}
        onTouchStart={() => { if (mobile) onPauseChange(true); }}
        onFocus={() => onPauseChange(true)}>
        <div className="photo-loop__track" ref={trackRef}>
          {mobile ? <>
            {count > 1 && slide(photos[count - 1], count - 1, true, 'leading-clone')}
            {photos.map((photo, index) => slide(photo, index, false, `photo-${index}`))}
            {count > 1 && slide(photos[0], 0, true, 'trailing-clone')}
          </> : Array.from({ length: copies }, (_, copy) => (
            <div className="photo-loop__cycle" ref={copy === 0 ? cycleRef : undefined} key={copy}
              aria-hidden={copy > 0 || undefined}>
              {photos.map((photo, index) => slide(photo, index, copy > 0, `${copy}-${index}`))}
            </div>
          ))}
        </div>
      </div>
      <p id={helpId} className="product-view__sr-only">
        Use the arrow keys to change photographs, and Space to pause or play.
        {zoomable ? ' Press Enter to toggle a full-width photograph view.' : ' Swipe to browse photographs.'}
      </p>
      <div className="photo-loop__controls">
        <button type="button" className="photo-loop__play" onClick={() => onPauseChange(!paused)}
          disabled={reducedMotion} aria-label={reducedMotion ? 'Automatic motion disabled by your reduced motion preference' : playing ? 'Pause photographs' : 'Play photographs'}>
          {reducedMotion ? 'Motion off' : playing ? 'Pause' : 'Play'}
        </button>
        <div className="photo-loop__paging">
          <button type="button" onClick={() => goTo(current.current - 1)} disabled={count < 2} aria-label="Previous photograph">←</button>
          <span className="photo-loop__count" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
            <span className="product-view__sr-only">Photograph </span>{active + 1}<span aria-hidden="true"> / </span><span className="product-view__sr-only"> of </span>{count}
          </span>
          <button type="button" onClick={() => goTo(current.current + 1)} disabled={count < 2} aria-label="Next photograph">→</button>
          {zoomable && <button type="button" className="photo-loop__enlarge" onClick={() => onEnlarge(current.current)}
            aria-label={vertical ? 'Return to horizontal photographs' : 'Enlarge current photograph'}>{vertical ? 'Reduce' : 'Enlarge'}</button>}
        </div>
      </div>
    </div>
  );
}
