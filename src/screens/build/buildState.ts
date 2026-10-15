import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Tile } from '../../domain/island/island';
import type { Rotation } from '../../domain/island/occupancy';

/**
 * Build mode UI state (Step 3.11), shared by the DOM panel and the in-canvas layer. Not persisted:
 * leaving build mode forgets it.
 */
export interface BuildUi {
  /** The building being placed (new from the tray, or a placed one being moved). */
  placing: { defId: string; rotation: Rotation; movingId?: string } | null;
  /** Where its ghost stands. */
  tile: Tile | null;
  /** A placed building tapped while not placing. */
  selected: string | null;
}

export const buildUi = createStore<BuildUi>(() => ({ placing: null, tile: null, selected: null }));

export const resetBuildUi = () => buildUi.setState({ placing: null, tile: null, selected: null });

export const useBuildUi = <T,>(selector: (s: BuildUi) => T): T => useStore(buildUi, selector);

export const nextRotation = (r: Rotation): Rotation => ((r + 90) % 360) as Rotation;
