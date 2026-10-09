"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ROLL_MS = 560;

/** Slot-style roll when a label changes — Poker → Casino, or out to nothing. */
export function RollingText({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef<HTMLSpanElement>(null);
  const nextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (value === shown) {
      setIncoming(null);
      setRolling(false);
      return;
    }
    setIncoming(value);
    setRolling(false);
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setRolling(true));
    });
    const timer = window.setTimeout(() => {
      setShown(value);
      setIncoming(null);
      setRolling(false);
    }, ROLL_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [value, shown]);

  useLayoutEffect(() => {
    const sizer = sizerRef.current;
    const wrap = wrapRef.current;
    if (!sizer || !wrap) return;
    const width = Math.ceil(sizer.scrollWidth + 10);
    wrap.style.width = `${width}px`;
  }, [shown, incoming]);

  const live = incoming != null && incoming !== shown;

  return (
    <span
      ref={wrapRef}
      className={`gr-roll${className ? ` ${className}` : ""}`}
      data-roll={rolling && live ? "on" : "off"}
      data-empty={String(!live && !shown)}
    >
      <span ref={sizerRef} className="gr-roll-sizer" aria-hidden>
        {(incoming ?? shown) || "\u00a0"}
      </span>
      <span className="gr-roll-track">
        <span ref={shownRef} className="gr-roll-word">
          {shown || "\u00a0"}
        </span>
        {live ? (
          <span ref={nextRef} className="gr-roll-word">
            {incoming || "\u00a0"}
          </span>
        ) : null}
      </span>
    </span>
  );
}