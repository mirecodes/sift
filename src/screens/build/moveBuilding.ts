import type { Tile } from '../../domain/island/island';
import { buildingShape, footprintTiles } from '../../domain/island/occupancy';
import { appStore } from '../../store';
import { strings } from '../../ui/strings';
import { cameraLock } from '../../world/camera/CameraRig';
import { buildUi } from './buildState';

/**
 * Dragging a building in build mode (owner request): the ghost being placed, or a placed building picked
 * up by a drag. `offset` keeps the grip point under the pointer (anchor = pointer tile − offset).
 */
export const buildingDrag: { from: Tile | null; offset: Tile; at: number; picked?: string } = { from: null, offset: { x: 0, z: 0 }, at: 0 };

/** Whether `t` is one of the ghost's footprint tiles. */
export function onGhost(t: Tile): boolean {
  const { placing, tile } = buildUi.getState();
  if (!placing || !tile) return false;
  return footprintTiles(tile, buildingShape(placing.defId).footprint, placing.rotation).some((f) => f.x === t.x && f.z === t.z);
}

/** Starts dragging the ghost (when `id` is omitted) or the placed building `id`, gripped at tile `t`. */
export function startBuildingDrag(t: Tile, id?: string): void {
  const s = buildUi.getState();
  let anchor = s.tile;
  if (id) {
    const b = appStore.getState().placedBuildings.find((x) => x.id === id);
    if (!b) return;
    anchor = { x: b.tileX, z: b.tileZ };
    buildUi.setState({ placing: { defId: b.defId, rotation: b.rotation, movingId: b.id }, tile: anchor, selected: null });
  }
  if (!anchor) return;
  cameraLock.current = true;
  buildingDrag.from = { x: t.x, z: t.z };
  buildingDrag.offset = { x: t.x - anchor.x, z: t.z - anchor.z };
  buildingDrag.picked = id;
  buildUi.setState({ dragging: true, note: null });
}

/** Moves the dragged ghost so the grip point is on tile `t`. */
export function dragBuildingTo(t: Tile): void {
  if (!buildUi.getState().dragging) return;
  const { offset } = buildingDrag;
  const tile = { x: t.x - offset.x, z: t.z - offset.z };
  const now = buildUi.getState().tile;
  if (now?.x !== tile.x || now?.z !== tile.z) buildUi.setState({ tile });
}

/**
 * Ends the drag: places the building where it is when it fits; otherwise the ghost stays there with the
 * reason in the panel. A release where the press began changes nothing (it was a tap).
 */
export async function dropBuilding(): Promise<void> {
  const { from, offset, picked } = buildingDrag;
  const { tile, placing } = buildUi.getState();
  buildingDrag.from = null;
  buildingDrag.picked = undefined;
  buildingDrag.at = Date.now();
  cameraLock.current = false;
  buildUi.setState({ dragging: false });
  if (!from || !placing || !tile) return;
  if (from.x === tile.x + offset.x && from.z === tile.z + offset.z) {
    // A click on a placed building without moving it selects it, as before.
    if (picked) buildUi.setState({ placing: null, tile: null, selected: picked });
    return;
  }
  const result = await appStore.getState().placeBuilding({ ...placing, tile });
  if (!result) buildUi.setState({ placing: null, tile: null, note: null });
  else buildUi.setState({ note: strings.build.problems[result] });
}
