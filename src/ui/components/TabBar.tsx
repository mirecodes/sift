import type { ReactNode } from 'react';
import styles from './TabBar.module.css';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

/** `tab-bar` (DESIGN.md 6.7): slim bar at the bottom center. Never on Focus. */
export function TabBar<T extends string>({ tabs, active, onSelect, label }: { tabs: readonly TabItem<T>[]; active: T; onSelect: (id: T) => void; label: string }) {
  return (
    <nav className={styles.bar} aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={styles.tab}
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          {t.icon}
          <span className="type-caption">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
