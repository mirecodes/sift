import { forwardRef, useEffect, useImperativeHandle, useId, useRef, type ReactNode } from 'react';
import { strings } from '../strings';
import { IconButton } from './Button';
import { CloseIcon } from './Icons';
import styles from './Sheet.module.css';

export interface SheetHandle {
  close(): void;
}

/**
 * A native modal `<dialog>` (focus trap, Esc, inert background) with a title and a close button
 * (DESIGN.md 6.2 `modal`). Opens on mount; `onClose` runs after it closes.
 */
export const Sheet = forwardRef<SheetHandle, { title: ReactNode; onClose: () => void; wide?: boolean; children: ReactNode }>(function Sheet({ title, onClose, wide, children }, handle) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  useImperativeHandle(handle, () => ({ close: () => ref.current?.close() }), []);
  return (
    <dialog ref={ref} className={`${styles.sheet} ${wide ? styles.wide : ''}`} onClose={onClose} aria-labelledby={id}>
      <div className={styles.head}>
        <h2 id={id} className="type-display-sm">
          {title}
        </h2>
        <IconButton aria-label={strings.aria.close} onClick={() => ref.current?.close()}>
          <CloseIcon />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
});

export const sheetStyles = styles;
