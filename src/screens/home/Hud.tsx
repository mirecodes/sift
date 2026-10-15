import { useEffect, useRef, useState } from 'react';
import { selectActiveUnicorns, selectShownGold, useApp } from '../../store';
import { useCountUp, usePrefersReducedMotion } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { GoldIcon, UnicornIcon } from '../../ui/components/Icons';
import { runtimeConfig } from '../../app/runtimeConfig';
import styles from './Hud.module.css';

const { features } = runtimeConfig;

/** The gold balance as a display-only pill (Shop top bar). */
export function GoldBalance() {
  const gold = useApp((s) => s.gold);
  return (
    <span className={`${styles.counter} type-body-sm-strong`} role="img" aria-label={strings.hud.balance(gold)}>
      <GoldIcon />
      <span aria-hidden="true">{gold}</span>
    </span>
  );
}

/** Gold and Unicorn counters on Home's top bar (DESIGN.md 6.8). Rendered only with `features.economy`. */
export function Hud() {
  const gold = useCountUp(useApp(selectShownGold), usePrefersReducedMotion());
  const unicorns = useApp(selectActiveUnicorns);
  const setView = useApp((s) => s.setView);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Until the Shop exists, gold opens a short explanation; any tap elsewhere or Esc closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={styles.hud}>
      {features.cosmetics ? (
        <button type="button" className={`${styles.counter} type-body-sm-strong`} aria-label={strings.hud.openShop(gold)} onClick={() => setView('shop')}>
          <GoldIcon />
          <span aria-hidden="true">{gold}</span>
        </button>
      ) : (
        <button type="button" className={`${styles.counter} type-body-sm-strong`} aria-label={strings.hud.gold(gold)} aria-expanded={open} onClick={() => setOpen(!open)}>
          <GoldIcon />
          <span aria-hidden="true">{gold}</span>
        </button>
      )}
      <span className={`${styles.counter} type-body-sm-strong`} role="img" aria-label={strings.hud.unicorns(unicorns)}>
        <UnicornIcon />
        <span aria-hidden="true">{unicorns}</span>
      </span>
      {open && <p className={`${styles.info} type-body-sm`}>{strings.hud.goldInfo}</p>}
    </div>
  );
}
