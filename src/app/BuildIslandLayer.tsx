import { useMemo } from 'react';
import { generateIsland, type Tile } from '../domain/island/island';
import { buildingShape, footprintTiles, tileKey } from '../domain/island/occupancy';
import { appStore, selectIslandLevel, selectOccupancy, useApp } from '../store';
import { buildUi, useBuildUi } from '../screens/build/buildState';
import { useGhostProblem } from '../screens/build/BuildScreen';
import { BuildLayer } from '../world/build/BuildLayer';

/** Connects build mode state (store + `buildUi`) to the in-canvas `BuildLayer` (Step 3.11). */
export function BuildIslandLayer() {
  const seed = useApp((s) => s.world.seed);
  const level = useApp(selectIslandLevel);
  const placed = useApp((s) => s.placedBuildings);
  const tiles = useMemo(() => generateIsland(seed, level).tiles, [seed, level]);
  const { placing, tile, selected } = useBuildUi((s) => s);
  const problem = useGhostProblem();
  const selectedTiles = useMemo(() => {
    const b = placed.find((x) => x.id === selected);
    return b ? footprintTiles({ x: b.tileX, z: b.tileZ }, buildingShape(b.defId).footprint, b.rotation) : [];
  }, [placed, selected]);

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
