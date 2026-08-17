import { useState } from "react";

/**
 * A numeric input that doesn't fight the user while typing.
 *
 * Binding a plain <input type="number"> directly to numeric state is a
 * classic trap: clearing the field to retype produces Number("") === 0,
 * which immediately redisplays as "0" and blocks deleting it. This keeps
 * the in-progress text as its own state, only committing (and clamping) a
 * parsed number upstream once it's a valid integer, and reconciling fully
 * on blur so the field always ends up showing the true committed value.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  className = "",
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(value));
  // Re-derive the displayed text when `value` changes from outside (e.g.
  // clamped by a parent, or reset) — done during render, React's documented
  // pattern for this, rather than in an effect (which would cause an extra
  // render pass after every commit).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setText(String(value));
  }

  function clamp(n: number) {
    let result = n;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^\d+$/.test(raw)) return; // ignore non-digit keystrokes
        setText(raw);
        if (raw !== "") onChange(clamp(Number(raw)));
      }}
      onBlur={() => {
        const fallback = min ?? 0;
        const clamped = text === "" ? fallback : clamp(Number(text));
        setText(String(clamped));
        onChange(clamped);
      }}
      className={`h-10 rounded-lg border border-navy/15 bg-white px-2 text-center text-navy focus:border-navy focus:outline-none ${className}`}
    />
  );
}
