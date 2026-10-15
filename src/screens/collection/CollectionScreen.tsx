import { useMemo } from 'react';
import { CATALOG } from '../../domain/animals/catalog';
import { computeStats, countBySpecies, formatDuration } from '../../domain/stats/stats';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { TierBadge } from '../../ui/components/Badge';
import { IconButton } from '../../ui/components/Button';
import { CloseIcon } from '../../ui/components/Icons';
import { FeatureCard, TierCard } from '../../ui/components/Surfaces';
import { TopBar } from '../../ui/components/TopBar';
import page from '../Screen.module.css';
import styles from './CollectionScreen.module.css';
import { VoxelSprite } from './VoxelSprite';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <FeatureCard className={styles.stat}>
      <p className={`${styles.statLabel} type-eyebrow`}>{label}</p>
      <p className={`${styles.statValue} type-display-sm`}>{value}</p>
    </FeatureCard>
  );
}

export function CollectionScreen() {
  const animals = useApp((s) => s.animals);
  const sessions = useApp((s) => s.sessions);
  const setView = useApp((s) => s.setView);
  const stats = useMemo(() => computeStats(sessions, animals), [sessions, animals]);
  const counts = useMemo(() => countBySpecies(animals), [animals]);

  return (
    <div className={page.page}>
      <TopBar>
        <IconButton aria-label={strings.aria.close} onClick={() => setView('home')}>
          <CloseIcon />
        </IconButton>
      </TopBar>
      <main className={`${page.content} ${styles.wide}`}>
        <h1 className={`${page.title} type-display-md`}>{strings.collection.title}</h1>

        <div className={styles.stats}>
          <Stat label={strings.collection.focusTime} value={formatDuration(stats.focusMs)} />
          <Stat label={strings.collection.sessions} value={String(stats.completedSessions)} />
          <Stat label={strings.collection.animals} value={`${stats.collectedSpecies} / ${stats.totalSpecies}`} />
        </div>

        <ul className={styles.grid}>
          {CATALOG.map((species) => {
            const count = counts.get(species.id) ?? 0;
            return (
              <li key={species.id}>
                {count > 0 ? (
                  <TierCard rank={species.tierRank} className={styles.card}>
                    <VoxelSprite modelId={species.modelId} />
                    <p className={`${styles.name} type-display-xs`}>{species.name}</p>
                    <TierBadge rank={species.tierRank} />
                    {count > 1 && <p className={`${styles.count} type-caption`}>{strings.collection.count(count)}</p>}
                  </TierCard>
                ) : (
                  <FeatureCard className={styles.card} aria-label={strings.collection.unknownAnimal}>
                    <VoxelSprite modelId={species.modelId} silhouette />
                    <p className={`${styles.name} ${styles.unknown} type-display-xs`}>{strings.collection.unknown}</p>
                  </FeatureCard>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
