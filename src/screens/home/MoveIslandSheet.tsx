import { useRef, useState } from 'react';
import { balance } from '../../../shared/balance/balance';
import { selectActiveUnicorns, useApp } from '../../store';
import { islandLevel } from '../../domain/island/level';
import { usePrefersReducedMotion } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import { SeedIslandPreview } from '../../world/preview/ItemPreview';

/**
 * Island move confirm (guidance_v2 Step 4.2, DESIGN.md 7.9): a preview of the new island, rerolled up to
 * `balance.islandMove.freePreviews` times, the Unicorn count, and Move.
 */
export function MoveIslandSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const unicorns = useApp(selectActiveUnicorns);
  const level = useApp((s) => islandLevel(s.animals));
  const themeId = useApp((s) => s.equipped.blockThemeId);
  const roll = useApp((s) => s.rollIslandSeed);
  const moveIsland = useApp((s) => s.moveIsland);
  const reducedMotion = usePrefersReducedMotion();
  const [seeds, setSeeds] = useState(() => [roll()]);
  const [state, setState] = useState<'confirm' | 'busy' | 'failed'>('confirm');
  const seed = seeds[seeds.length - 1]!;
  const left = balance.islandMove.freePreviews - seeds.length;

  const move = async () => {
    setState('busy');
    try {
      const problem = await moveIsland(seed);
      if (problem) setState('failed');
      else sheet.current?.close();
    } catch {
      setState('failed');
    }
  };

  return (
    <Sheet ref={sheet} title={strings.move.title} onClose={onClose}>
      <SeedIslandPreview seed={seed} level={level} themeId={themeId} reducedMotion={reducedMotion} />
      <p className="type-body-md">{strings.move.body}</p>
      <p className={`${sheetStyles.note} type-body-sm`}>{unicorns > 0 ? strings.move.have(unicorns) : strings.move.needUnicorn}</p>
      <p className={`${sheetStyles.note} type-body-sm`}>{left > 0 ? strings.move.previewsLeft(left) : strings.move.noPreviews}</p>
      {state === 'failed' && <p className={`${sheetStyles.error} type-body-sm`}>{strings.move.failed}</p>}
      <div className={sheetStyles.actions}>
        <Button variant="secondary" onClick={() => setSeeds([...seeds, roll()])} disabled={left <= 0 || state === 'busy'}>
          {strings.move.another}
        </Button>
        <Button variant="secondary" onClick={() => sheet.current?.close()}>
          {strings.move.cancel}
        </Button>
        <Button onClick={() => void move()} disabled={unicorns < balance.islandMove.cost || state === 'busy'}>
          {strings.move.confirm}
        </Button>
      </div>
    </Sheet>
  );
}
