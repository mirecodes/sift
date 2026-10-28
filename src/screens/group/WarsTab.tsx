import type { GroupView } from '../../../shared/api/types';
import { strings } from '../../ui/strings';
import f from '../friends/Friends.module.css';

/** The Wars sub-tab (Phase 9 fills it). */
export function WarsTab(_: { group: GroupView }) {
  return <p className={`${f.muted} type-body-md`}>{strings.group.warsSoon}</p>;
}
