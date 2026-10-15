import type { TierRank } from '../../domain/config';
import { strings } from '../strings';
import styles from './Badge.module.css';

/** Tier is never conveyed by color alone: the name is always shown. */
export function TierBadge({ rank }: { rank: TierRank }) {
  return (
    <span data-tier={rank} className={`${styles.badge} ${styles.tier} type-eyebrow-sm`}>
      {strings.tiers[rank]}
    </span>
  );
}

export function OvertimeBadge() {
  return <span className={`${styles.badge} ${styles.overtime} type-eyebrow-sm`}>{strings.focus.overtime}</span>;
}
