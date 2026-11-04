import { useEffect } from 'react';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import layer from '../Screen.module.css';
import styles from './HomeScreen.module.css';

/** Over the island-move sequence (DESIGN.md 7.9): only a Skip button (Esc skips too). */
export function MoveScreen() {
  const finish = useApp((s) => s.finishIslandMove);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);
  return (
    <div className={layer.layer}>
      <p className="sr-only" role="status">
        {strings.move.moving}
      </p>
      <div className={styles.skip}>
        <Button variant="secondary" onClick={finish}>
          {strings.move.skip}
        </Button>
      </div>
    </div>
  );
}
