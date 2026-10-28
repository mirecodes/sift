import type { Tile } from '../../domain/island/island';
import { appStore } from '../../store';
import { strings } from '../../ui/strings';
import { cameraLock } from '../../world/camera/CameraRig';
import { buildUi } from './buildState';

/** When the last drop happened: the click that follows a drag's release must not pick the animal up again. */
export const lastDrop = { at: 0 };

/** Where the current drag started, if one is under way. */
export const drag: { from: Tile | null } = { from: null };

/** Drops the picked animal on its target tile through the store (Step 10.1); the reason shows when it fails. */
export async function dropPickedAnimal(): Promise<void> {
  const { picked, target } = buildUi.getState();
  const from = drag.from;
  drag.from = null;
  cameraLock.current = false;
  lastDrop.at = Date.now();
  buildUi.setState({ dragging: false });
  if (!picked || !target) return;
  // Released where it was pressed: nothing moved, so the animal stays picked for the tap flow.
  if (from && from.x === target.x && from.z === target.z) return void buildUi.setState({ target: null });
  const result = await appStore.getState().arrangeAnimal(picked, target);
  if (result) buildUi.setState({ note: strings.build.arrangeProblems[result] });
  else buildUi.setState({ picked: null, target: null, note: null });
}
