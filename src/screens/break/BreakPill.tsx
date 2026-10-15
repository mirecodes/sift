import { formatTimer, timerDisplay } from '../../domain/timer/phase';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { useBreakClock } from './BreakScreen';
import styles from './BreakPill.module.css';

/** `break-pill` (DESIGN.md 6.7): the running break on tabs other than Island; tapping returns to Island. */
export function BreakPill() {
  const setTab = useApp((s) => s.setTab);
  const { resolved, now, over } = useBreakClock();
  const display = timerDisplay(resolved, now);
  return (
    <button type="button" className={`${styles.pill} type-body-sm-strong`} onClick={() => setTab('island')} title={strings.aria.backToBreak}>
      {over ? strings.break.over : strings.break.pill(display ? formatTimer(display) : '')}
    </button>
  );
}
