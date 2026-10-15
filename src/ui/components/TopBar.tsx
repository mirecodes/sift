import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';
import styles from './TopBar.module.css';

/** Home, Settings, and Collection only. Never on Focus. `start` sits on the left (Home's HUD counters). */
export function TopBar({ children, start }: { children?: ReactNode; start?: ReactNode }) {
  return (
    <header className={styles.bar}>
      {start}
      <div className={styles.actions}>
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
