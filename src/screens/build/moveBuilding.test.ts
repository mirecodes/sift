import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { appStore } from '../../store';

// The real store module starts the web platform (needs a DOM); this logic only reads buildings and places one.
vi.mock('../../store', () => ({ appStore: createStore<Record<string, unknown>>(() => ({})) }));
import { cameraLock } from '../../world/camera/CameraRig';
import { buildUi, resetBuildUi } from './buildState';
import { buildingDrag, dragBuildingTo, dropBuilding, onGhost, startBuildingDrag } from './moveBuilding';

const placed = [{ id: 'b1', defId: 'lantern', tileX: 1, tileZ: 2, rotation: 0 as const }];

describe('moving a building by drag', () => {
  const placeBuilding = vi.fn();
  beforeEach(() => {
    resetBuildUi();
    placeBuilding.mockReset().mockResolvedValue(null);
    buildingDrag.at = 0;
    appStore.setState({ placedBuildings: placed as never, placeBuilding });
  });

  it('picks a placed building up, keeps the grip offset and places it on release', async () => {
    startBuildingDrag({ x: 1, z: 2 }, 'b1');
    expect(cameraLock.current).toBe(true);
    expect(buildUi.getState()).toMatchObject({ dragging: true, placing: { defId: 'lantern', movingId: 'b1' }, tile: { x: 1, z: 2 } });
    dragBuildingTo({ x: 3, z: 2 });
    expect(buildUi.getState().tile).toEqual({ x: 3, z: 2 });
    await dropBuilding();
    expect(placeBuilding).toHaveBeenCalledWith({ defId: 'lantern', rotation: 0, movingId: 'b1', tile: { x: 3, z: 2 } });
    expect(buildUi.getState()).toMatchObject({ dragging: false, placing: null, tile: null });
    expect(cameraLock.current).toBe(false);
  });

  it('a release where the press began selects the building instead of moving it', async () => {
    startBuildingDrag({ x: 1, z: 2 }, 'b1');
    await dropBuilding();
    expect(placeBuilding).not.toHaveBeenCalled();
    expect(buildUi.getState()).toMatchObject({ placing: null, selected: 'b1' });
  });

  it('drags the ghost by the tile it was gripped on and keeps it with the reason when it cannot be placed', async () => {
    placeBuilding.mockResolvedValue('not_idle');
    buildUi.setState({ placing: { defId: 'lantern', rotation: 0 }, tile: { x: 0, z: 0 } });
    expect(onGhost({ x: 0, z: 0 })).toBe(true);
    expect(onGhost({ x: 2, z: 0 })).toBe(false);
    startBuildingDrag({ x: 0, z: 0 });
    dragBuildingTo({ x: -1, z: 1 });
    await dropBuilding();
    expect(placeBuilding).toHaveBeenCalledWith({ defId: 'lantern', rotation: 0, tile: { x: -1, z: 1 } });
    expect(buildUi.getState()).toMatchObject({ placing: { defId: 'lantern' }, tile: { x: -1, z: 1 } });
    expect(buildUi.getState().note).toBeTruthy();
  });
});
