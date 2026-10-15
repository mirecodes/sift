import { useEffect, useMemo, useState } from 'react';
import { balance } from '../../../shared/balance/balance';
import { content } from '../../domain/content';
import { placementProblem, suggestTile, type PlaceProblem } from '../../domain/build/placement';
import { unplacedBuildings } from '../../domain/cosmetics/inventory';
import { selectOccupancy, useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { Panel } from '../../ui/components/Surfaces';
import { TopBar } from '../../ui/components/TopBar';
import { ItemSprite } from '../collection/ItemSprite';
import { buildUi, nextRotation, resetBuildUi, useBuildUi } from './buildState';
import layer from '../Screen.module.css';
import styles from './Build.module.css';

const nameOf = (id: string) => {
  const item = content.get(id);
  return item && 'name' in item ? item.name.en : id;
};

/** Live validity of the ghost on its tile, against the island as it is now. */
export function useGhostProblem(): PlaceProblem | null | undefined {
  const { placing, tile } = useBuildUi((s) => s);
  const grid = useApp(selectOccupancyMemo);
  if (!placing || !tile) return undefined;
  return placementProblem(grid, { defId: placing.defId, tile, rotation: placing.rotation, minFreeTiles: balance.build.minFreeTiles, ...(placing.movingId && { movingId: placing.movingId }) });
}

// Memoized per store snapshot: the grid is rebuilt only when world, animals or buildings change.
let last: { key: unknown[]; grid: ReturnType<typeof selectOccupancy> } | undefined;
function selectOccupancyMemo(s: Parameters<typeof selectOccupancy>[0]) {
  const key = [s.world, s.animals, s.placedBuildings];
  if (!last || last.key.some((k, i) => k !== key[i])) last = { key, grid: selectOccupancy(s) };
  return last.grid;
}

/** Build mode panel (guidance_v2 Step 3.11, DESIGN.md 7.8). The island layer lives in `world/build`. */
export function BuildScreen() {
  const setView = useApp((s) => s.setView);
  const cosmetics = useApp((s) => s.cosmetics);
  const placed = useApp((s) => s.placedBuildings);
  const placeBuilding = useApp((s) => s.placeBuilding);
  const storeBuilding = useApp((s) => s.storeBuilding);
  const grid = useApp(selectOccupancyMemo);
  const { placing, tile, selected } = useBuildUi((s) => s);
  const problem = useGhostProblem();
  const [message, setMessage] = useState<string | null>(null);
  const tray = useMemo(() => [...unplacedBuildings(cosmetics, placed)], [cosmetics, placed]);

  const exit = () => {
    resetBuildUi();
    setView('home');
  };
  const start = (defId: string, movingId?: string, rotation = buildUi.getState().placing?.rotation ?? 0) => {
    const from = suggestTile(grid, { defId, rotation, minFreeTiles: balance.build.minFreeTiles, ...(movingId && { movingId }) });
    const moving = movingId ? placed.find((b) => b.id === movingId) : undefined;
    buildUi.setState({ placing: { defId, rotation: moving?.rotation ?? rotation, ...(movingId && { movingId }) }, tile: moving ? { x: moving.tileX, z: moving.tileZ } : from, selected: null });
    setMessage(from || moving ? null : strings.build.noRoom);
  };
  const place = async () => {
    const s = buildUi.getState();
    if (!s.placing || !s.tile) return;
    const result = await placeBuilding({ ...s.placing, tile: s.tile });
    if (result) setMessage(strings.build.problems[result]);
    else {
      setMessage(null);
      buildUi.setState({ placing: null, tile: null });
    }
  };
  const rotate = async () => {
    const s = buildUi.getState();
    if (s.placing) buildUi.setState({ placing: { ...s.placing, rotation: nextRotation(s.placing.rotation) } });
    else if (s.selected) {
      const b = placed.find((x) => x.id === s.selected);
      if (!b) return;
      const result = await placeBuilding({ defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: nextRotation(b.rotation), movingId: b.id });
      setMessage(result ? strings.build.problems[result] : null);
    }
  };
  const cancel = () => {
    buildUi.setState({ placing: null, tile: null, selected: null });
    setMessage(null);
  };

  // Keyboard: R rotates, arrows move the ghost, Enter places, Esc cancels, then leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const s = buildUi.getState();
      if (e.key === 'r' || e.key === 'R') void rotate();
      else if (e.key === 'Escape') {
        if (s.placing || s.selected) cancel();
        else exit();
      } else if (e.key === 'Enter' && s.placing) {
        e.preventDefault();
        void place();
      } else if (s.placing && s.tile) {
        const step = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, [number, number]>)[e.key];
        if (step) {
          e.preventDefault();
          buildUi.setState({ tile: { x: s.tile.x + step[0], z: s.tile.z + step[1] } });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => () => resetBuildUi(), []);

  const selectedBuilding = selected ? placed.find((b) => b.id === selected) : undefined;
  const status = message ?? (problem === undefined ? null : problem ? strings.build.problems[problem] : strings.build.fits);

  return (
    <div className={layer.layer}>
      <div className={styles.top}>
        <TopBar start={<h1 className={`${styles.title} type-display-xs`}>{strings.build.title}</h1>}>
          <Button variant="secondary" onClick={exit}>
            {strings.build.done}
          </Button>
        </TopBar>
      </div>
      <Panel className={styles.panel}>
        {placing ? (
          <>
            <p className={`${styles.name} type-body-md-strong`}>{nameOf(placing.defId)}</p>
            <p className={`${styles.status} type-body-sm`} role="status">
              {status}
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => void rotate()}>
                {strings.build.rotate}
              </Button>
              <Button variant="secondary" onClick={cancel}>
                {strings.build.cancel}
              </Button>
              <Button onClick={() => void place()} disabled={!tile || !!problem}>
                {strings.build.place}
              </Button>
            </div>
          </>
        ) : selectedBuilding ? (
          <>
            <p className={`${styles.name} type-body-md-strong`}>{nameOf(selectedBuilding.defId)}</p>
            {message && (
              <p className={`${styles.status} type-body-sm`} role="status">
                {message}
              </p>
            )}
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => start(selectedBuilding.defId, selectedBuilding.id)}>
                {strings.build.move}
              </Button>
              <Button variant="secondary" onClick={() => void rotate()}>
                {strings.build.rotate}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void storeBuilding(selectedBuilding.id);
                  cancel();
                }}
              >
                {strings.build.store}
              </Button>
              <Button variant="secondary" onClick={cancel}>
                {strings.build.cancel}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={`${styles.eyebrow} type-eyebrow`}>{strings.build.tray}</p>
            {tray.length ? (
              <ul className={styles.tray}>
                {tray.map(([defId, n]) => (
                  <li key={defId}>
                    <button type="button" className={styles.item} aria-label={strings.build.pick(nameOf(defId))} onClick={() => start(defId)}>
                      <ItemSprite id={defId} size={48} />
                      <span className="type-caption">{nameOf(defId)}</span>
                      {n > 1 && <span className={`${styles.count} type-caption`}>{strings.build.count(n)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.empty}>
                <p className="type-body-sm">{strings.build.empty}</p>
                <Button variant="secondary" onClick={() => setView('shop')}>
                  {strings.build.openShop}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
