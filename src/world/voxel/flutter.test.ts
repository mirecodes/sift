import { describe, expect, it } from 'vitest';
import butterfly from '../../../content/animals/butterfly/model';
import { flutterSplit } from './flutter';

const sorted = (vs: readonly (readonly number[])[]) => vs.map((v) => v.join(',')).sort();

// The body and wing meshes that were hand-made before models became content (2026-10-27).
const BODY = [[0,0,0,3],[1,0,0,3],[0,0,1,3],[1,0,1,3],[0,0,2,3],[1,0,2,3],[0,0,3,3],[1,0,3,3],[0,0,4,3],[1,0,4,3],[0,1,0,3],[1,1,0,3],[0,1,1,3],[1,1,1,3],[0,1,2,3],[1,1,2,3],[0,1,3,3],[1,1,3,3],[0,1,4,3],[1,1,4,3],[0,0,5,3],[1,0,5,3],[0,1,5,3],[1,1,5,3],[0,2,5,5],[1,2,5,5]];
const WING = [[1,0,3,1],[1,0,4,1],[1,0,5,1],[0,0,3,1],[0,0,4,4],[1,0,0,2],[1,0,1,2],[1,0,2,2],[0,0,1,2]];

describe('flutterSplit', () => {
  it('derives the body and left wing from the rest pose', () => {
    const { body, wing } = flutterSplit(butterfly);
    expect(body.size).toEqual([2, 3, 6]);
    expect(sorted(body.voxels)).toEqual(sorted(BODY));
    expect(wing.size).toEqual([2, 1, 6]);
    expect(sorted(wing.voxels)).toEqual(sorted(WING));
  });
});
