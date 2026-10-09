"use client";

import { useMemo } from "react";
import type { CloudWord } from "@/lib/grace/analysis";

const SIZES = [13, 16, 20, 26, 34];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function sizeFor(count: number, min: number, max: number): number {
  if (max === min) return SIZES[2];
  const t = (count - min) / (max - min);
  return SIZES[Math.min(SIZES.length - 1, Math.round(t * (SIZES.length - 1)))];
}

function colorFor(lean: number): string {
  if (lean >= 0.35) return "#00b67a";
  if (lean <= -0.35) return "#ff3722";
  if (lean > 0.12) return "#1a8f68";
  if (lean < -0.12) return "#c43c2c";
  return "#5c6570";
}

export function TagCloud({
  words,
  onPick,
  active,
}: {
  words: CloudWord[];
  onPick?: (word: string) => void;
  active?: string;
}) {
  const laid = useMemo(() => {
    if (words.length === 0) return [];
    const max = words[0].count;
    const min = words[words.length - 1].count;
    return [...words]
      .map((w) => ({ ...w, size: sizeFor(w.count, min, max), order: hash(w.word) }))
      .sort((a, b) => a.order - b.order);
  }, [words]);

  if (laid.length === 0) {
    return <p className="py-8 text-center text-xs text-[#8a9198]">Not enough text to build a cloud.</p>;
  }

  return (
    <div className="gr-cloud">
      {laid.map((w) => {
        const isActive = active === w.word;
        return (
          <button
            key={w.word}
            type="button"
            onClick={() => onPick?.(w.word)}
            title={`${w.word} · ${w.count} reviews`}
            className="gr-cloud-word"
            data-on={String(isActive)}
            style={{
              fontSize: `${w.size}px`,
              color: colorFor(w.lean),
              fontWeight: w.size >= 26 ? 600 : 500,
            }}
          >
            {w.word}
          </button>
        );
      })}
    </div>
  );
}
