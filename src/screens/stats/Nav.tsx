import { IconButton } from '../../ui/components/Button';
import { NextIcon, PrevIcon } from '../../ui/components/Icons';
import styles from './Stats.module.css';

/** ← label → for months and weeks. → is disabled at the present (no future periods). */
export function Nav({ label, previous, next, canGoNext, onShift }: { label: string; previous: string; next: string; canGoNext: boolean; onShift: (by: number) => void }) {
  return (
    <div className={styles.nav}>
      <IconButton aria-label={previous} onClick={() => onShift(-1)}>
        <PrevIcon />
      </IconButton>
      <p className={`${styles.navLabel} type-display-xs`} aria-live="polite">
        {label}
      </p>
      <IconButton aria-label={next} disabled={!canGoNext} onClick={() => onShift(1)}>
        <NextIcon />
      </IconButton>
    </div>
  );
}
