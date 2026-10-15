import type { ReactNode } from 'react';
import { TopBar } from '../ui/components/TopBar';
import page from './Screen.module.css';

/** Full-page canvas for a top-level tab (Stats, Friends, Group). The tab bar sits on top of it. */
export function TabPage({ title, wide, children }: { title: string; wide?: string; children?: ReactNode }) {
  return (
    <div className={page.page}>
      <TopBar />
      <main className={`${page.content} ${wide ?? ''}`}>
        <h1 className={`${page.title} type-display-md`}>{title}</h1>
        {children}
      </main>
    </div>
  );
}
