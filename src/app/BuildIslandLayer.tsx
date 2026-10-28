import { useEffect, useMemo, useRef } from 'react';
import { arrangeProblem } from '../domain/island/arrange';
import { generateIsland, type Tile } from '../domain/island/island';
import { buildingShape, footprintTiles, tileKey } from '../domain/island/occupancy';
import { skinForAnimal } from '../domain/cosmetics/inventory';
import { platform } from '../platform';
import { appStore, selectIslandLevel, selectOccupancy, useApp } from '../store';
import { buildUi, useBuildUi } from '../screens/build/buildState';
import { drag, dropPickedAnimal, lastDrop } from '../screens/build/arrange';
import { useGhostProblem } from '../screens/build/BuildScreen';
import { ArrangeLayer } from '../world/build/ArrangeLayer';
import { BuildLayer } from '../world/build/BuildLayer';
import { cameraLock } from '../world/camera/CameraRig';

/** Touch: hold this long on an animal to pick it up (Step 10.1). */
const LONG_PRESS_MS = 350;
const SLOP_PX = 8;

/** The active animal standing on a tile, if any (the most recent arrival first). */
function animalOn(tile: Tile): string | null {
  const ids = selectOccupancy(appStore.getState()).get(tileKey(tile))?.animalIds ?? [];
  return ids.at(-1) ?? null;
}

const drop = dropPickedAnimal;

/** Connects build mode state (store + `buildUi`) to the in-canvas build and arrange layers (Steps 3.11, 10.1). */
export function BuildIslandLayer() {
  const seed = useApp((s) => s.world.seed);
  const level = useApp(selectIslandLevel);
  const placed = useApp((s) => s.placedBuildings);
  const animals = useApp((s) => s.animals);
  const equipped = useApp((s) => s.equipped);
  const tiles = useMemo(() => generateIsland(seed, level).tiles, [seed, level]);
  const { placing, tile, selected, mode, picked, target } = useBuildUi((s) => s);
  const problem = useGhostProblem();
  const selectedTiles = useMemo(() => {
    const b = placed.find((x) => x.id === selected);
    return b ? footprintTiles({ x: b.tileX, z: b.tileZ }, buildingShape(b.defId).footprint, b.rotation) : [];
  }, [placed, selected]);

  // Long-press bookkeeping (touch) and drops released off the island.
  const press = useRef<{ x: number; y: number; timer: number | undefined } | null>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      press.current = { x: e.clientX, y: e.clientY, timer: undefined };
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (p?.timer !== undefined && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP_PX) {
        window.clearTimeout(p.timer); // it was a camera drag
        p.timer = undefined;
      }
    };
    const up = () => {
      if (press.current?.timer !== undefined) window.clearTimeout(press.current.timer);
      press.current = null;
      if (buildUi.getState().dragging) void drop();
    };
    window.addEventListener('pointerdown', down, { capture: true });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      cameraLock.current = false;
      window.removeEventListener('pointerdown', down, { capture: true });
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  if (mode === 'animals') {
    const pickedAnimal = picked ? animals.find((a) => a.id === picked) : undefined;
    const valid = !!(picked && target) && arrangeProblem({ seed, islandLevel: level, animals, buildings: placed }, picked!, target!) === null;
    const startDrag = (id: string, t: Tile) => {
      cameraLock.current = true;
      drag.from = { x: t.x, z: t.z };
      buildUi.setState({ picked: id, target: { x: t.x, z: t.z }, dragging: true, note: null });
    };
    return (
      <ArrangeLayer
        tiles={tiles}
        picked={pickedAnimal ? { speciesId: pickedAnimal.speciesId, skinId: skinForAnimal(pickedAnimal, equipped) } : null}
        target={target}
        valid={valid}
        handlers={{
          onDown(t, pointerType) {
            const id = animalOn(t);
            if (!id) return;
            if (pointerType === 'mouse') startDrag(id, t);
            else if (press.current) {
              press.current.timer = window.setTimeout(() => {
                if (!press.current) return;
                platform.haptics.impact('light');
                startDrag(id, t);
              }, LONG_PRESS_MS);
            }
          },
          onMove(t) {
            if (buildUi.getState().dragging) buildUi.setState({ target: { x: t.x, z: t.z } });
          },
          onUp(t) {
            if (!buildUi.getState().dragging) return;
            if (t) buildUi.setState({ target: { x: t.x, z: t.z } });
            void drop();
          },
          onTap(t) {
            const s = buildUi.getState();
            if (s.dragging || Date.now() - lastDrop.at < 400) return;
            // Tap flow: tap an animal to pick it, then tap where it should go (Place confirms).
            if (s.picked) buildUi.setState({ target: { x: t.x, z: t.z }, note: null });
            else {
              const id = animalOn(t);
              if (id) buildUi.setState({ picked: id, target: null, note: null });
            }
          },
        }}
      />
    );
  }

  const onTap = (t: Tile) => {
    if (buildUi.getState().placing) buildUi.setState({ tile: { x: t.x, z: t.z } });
    else {
      // A tap on a placed building selects it; anywhere else clears the selection.
      const info = selectOccupancy(appStore.getState()).get(tileKey(t));
      buildUi.setState({ selected: info?.buildingId ?? null });
    }
  };

  return (
    <BuildLayer
      tiles={tiles}
      placing={placing}
      tile={tile}
      valid={problem === null}
      selectedTiles={selectedTiles}
      onHover={(t) => buildUi.getState().placing && buildUi.setState({ tile: { x: t.x, z: t.z } })}
      onTap={onTap}
    />
  );
}
