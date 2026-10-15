import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '../domain/config';

/**
 * Current time, refreshed on a light tick and immediately when the page becomes visible.
 * Display only: all elapsed time is computed from stored timestamps, never accumulated.
 */
export function useNow(tickMs: number = config.ui.tickMs): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const id = window.setInterval(update, tickMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', update);
      window.removeEventListener('focus', update);
    };
  }, [tickMs]);
  return now;
}

/**
 * Displays `target`, counting up to it when it rises (after `delayMs`, over `ms`).
 * Drops, the first value and reduced motion show at once.
 */
export function useCountUp(target: number, reduced: boolean, delayMs: number = config.ui.goldCountDelayMs, ms: number = config.ui.goldCountMs): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  shownRef.current = shown;
  useEffect(() => {
    const from = shownRef.current;
    if (reduced || target <= from) {
      setShown(target);
      return;
    }
    const start = performance.now() + delayMs;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / ms));
      setShown(Math.round(from + (target - from) * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced, delayMs, ms]);
  return shown;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Press-and-hold: `holding` drives the ring animation, `onComplete` fires after `ms`. */
export function useHold(ms: number, onComplete: () => void) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const complete = useRef(onComplete);
  complete.current = onComplete;

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
  }, []);

  const start = useCallback(() => {
    if (timer.current !== undefined) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      complete.current();
    }, ms);
  }, [ms]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { holding, start, cancel };
}

/** Runs `action` on Space unless focus is on an element that handles Space itself. */
export function useSpaceKey(action: (() => void) | undefined): void {
  const ref = useRef(action);
  ref.current = action;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || !ref.current) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'A')) return;
      e.preventDefault();
      ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
