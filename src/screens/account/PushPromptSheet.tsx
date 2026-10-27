import { useRef } from 'react';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';

/**
 * The one-line explanation before the system push permission (Step 6.6), shown once, at the first social
 * action. Closing it counts as "Not now".
 */
export function PushPromptSheet() {
  const sheet = useRef<SheetHandle>(null);
  const answer = useApp((s) => s.answerPush);
  const answered = useRef(false);
  const choose = (allow: boolean) => {
    answered.current = true;
    void answer(allow);
    sheet.current?.close();
  };
  return (
    <Sheet ref={sheet} title={strings.settings.notifications} onClose={() => !answered.current && void answer(false)}>
      <p className="type-body-md">{strings.push.why}</p>
      <div className={sheetStyles.actions}>
        <Button onClick={() => choose(true)}>{strings.push.allow}</Button>
        <Button variant="secondary" onClick={() => choose(false)}>
          {strings.push.notNow}
        </Button>
      </div>
    </Sheet>
  );
}
