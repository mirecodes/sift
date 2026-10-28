import type { PersonView } from '../../../shared/api/types';
import { ItemSprite } from '../collection/ItemSprite';
import styles from './Friends.module.css';

/** `민지#4821`: the name prominent, the tag small and muted (Step 7.1, DESIGN.md 7.11). */
export function HandleText({ handle }: { handle: PersonView['handle'] }) {
  if (!handle) return <span className="type-body-md-strong">…</span>;
  return (
    <span className={styles.handle}>
      <span className="type-body-md-strong">{handle.name}</span>
      <span className={`${styles.tag} type-caption`}>#{handle.tag}</span>
    </span>
  );
}

/** The avatar sprite on a soft circle; a chick when the person has no animal yet. */
export function Avatar({ speciesId, size = 48 }: { speciesId: string | null; size?: number }) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true">
      <ItemSprite id={speciesId ?? 'chick'} size={size} />
    </span>
  );
}

/**
 * One person row: an optional lead (rank), avatar, handle and a line under it, then actions on the right.
 * `compact` keeps short trailing values (minutes, a score) on the row on phones instead of wrapping.
 */
export function PersonRow({
  person,
  sub,
  lead,
  children,
  compact,
  highlight,
  onPress,
}: {
  person: PersonView;
  sub?: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
  highlight?: boolean;
  onPress?: () => void;
}) {
  return (
    <li className={`${styles.row} ${highlight ? styles.highlight : ''}`} onPointerDown={onPress}>
      {lead}
      <Avatar speciesId={person.avatarSpeciesId} />
      <span className={styles.who}>
        <HandleText handle={person.handle} />
        {sub}
      </span>
      {children && <span className={compact ? styles.trail : styles.actions}>{children}</span>}
    </li>
  );
}

/** `Focusing now` with a green dot (presence, Step 7.6). */
export function FocusingNow({ label }: { label: string }) {
  return (
    <span className={`${styles.presence} type-caption`}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
