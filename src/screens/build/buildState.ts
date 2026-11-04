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
  /** Buildings, or arranging animals (Phase 10). */
  mode: 'buildings' | 'animals';
  /** The animal being moved, its target tile, and whether a drag is under way. */
  picked: string | null;
  target: Tile | null;
  dragging: boolean;
  /** Why the last drop failed (arrange mode). */
  note: string | null;
}

const EMPTY = { placing: null, tile: null, selected: null, picked: null, target: null, dragging: false, note: null };

export const buildUi = createStore<BuildUi>(() => ({ ...EMPTY, mode: 'buildings' }));

export const resetBuildUi = () => buildUi.setState({ ...EMPTY, mode: 'buildings' });

export const useBuildUi = <T,>(selector: (s: BuildUi) => T): T => useStore(buildUi, selector);

export const nextRotation = (r: Rotation): Rotation => ((r + 90) % 360) as Rotation;
