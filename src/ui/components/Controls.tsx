import { useEffect, useState, type ReactNode } from 'react';
import { clamp } from '../../domain/random';
import { strings } from '../strings';
import { Button } from './Button';
import styles from './Controls.module.css';

export function SettingsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={`${styles.label} type-body-md`}>{label}</span>
      {children}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

/** `stepper`: number input between − and + buttons. Typing commits on blur or Enter. */
export function Stepper({ label, value, min, max, step, unit, onChange }: StepperProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = (raw: string) => {
    const n = Number(raw);
    const next = Number.isFinite(n) && raw.trim() !== '' ? clamp(Math.round(n), min, max) : value;
    setText(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={styles.stepper}>
      <Button
        variant="secondary"
        className={styles.stepButton}
        aria-label={strings.aria.decrease(label)}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step, min, max))}
      >
        −
      </Button>
      <input
        className={styles.input}
        inputMode="numeric"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
      />
      <Button
        variant="secondary"
        className={styles.stepButton}
        aria-label={strings.aria.increase(label)}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step, min, max))}
      >
        +
      </Button>
      <span className={`${styles.unit} type-body-sm`}>{unit}</span>
    </div>
  );
}

/** `segmented`: one choice out of a few, as pressed/unpressed buttons. */
export function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className={styles.segmented}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className="type-body-sm-strong" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** `text-input` (DESIGN.md 6.4): full-width text field with a visible label. */
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email';
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric';
  maxLength?: number;
}) {
  return (
    <label className={styles.field}>
      <span className="type-body-sm-strong">{label}</span>
      <input
        className={`${styles.input} ${styles.text}`}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={styles.toggle} onClick={() => onChange(!checked)}>
      <span className={styles.knob} />
    </button>
  );
}
