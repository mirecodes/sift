import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true">
      {children}
    </svg>
  );
}

export const CollectionIcon = () => (
  <Icon>
    <rect x="3.75" y="3.75" width="5" height="5" />
    <rect x="11.25" y="3.75" width="5" height="5" />
    <rect x="3.75" y="11.25" width="5" height="5" />
    <rect x="11.25" y="11.25" width="5" height="5" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    <path d="M7 3.5v4M13 8v4M8 12.5v4" strokeWidth="2" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon>
    <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z" />
  </Icon>
);

export const SunIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
  </Icon>
);

/** Tab icons (DESIGN.md 6.7). */
export const IslandIcon = () => (
  <Icon>
    <path d="M2.5 10.5h15l-3 4h-9z" />
    <path d="M7.5 10.5V6.5h5v4" />
  </Icon>
);

export const StatsIcon = () => (
  <Icon>
    <path d="M3.5 16.5h13" />
    <path d="M5.75 13.5v-4M10 13.5v-9M14.25 13.5v-6" strokeWidth="2" />
  </Icon>
);

export const FriendsIcon = () => (
  <Icon>
    <circle cx="7" cy="7" r="2.75" />
    <circle cx="13.5" cy="8" r="2.25" />
    <path d="M2.5 16.5a4.5 4.5 0 0 1 9 0M12 16.5h5.5a3.75 3.75 0 0 0-5.5-3.3" />
  </Icon>
);

export const GroupIcon = () => (
  <Icon>
    <path d="M5 17.5v-14M5 4h10l-2 3.25L15 10.5H5" />
  </Icon>
);

/** HUD icons (DESIGN.md 6.6). */
export const GoldIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="6.75" fill="var(--color-accent-yellow)" />
    <circle cx="10" cy="10" r="3.75" />
  </Icon>
);

export const UnicornIcon = () => (
  <Icon>
    <path d="M10 2.5l3.5 15h-7z" />
    <path d="M8.2 12.5l4.3-2.5M7.2 16.2l5.7-3.2" />
  </Icon>
);

export const PrevIcon = () => (
  <Icon>
    <path d="M12 4.5L6.5 10l5.5 5.5" />
  </Icon>
);

export const NextIcon = () => (
  <Icon>
    <path d="M8 4.5l5.5 5.5L8 15.5" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
  </Icon>
);
