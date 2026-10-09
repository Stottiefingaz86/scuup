"use client";

/** Official Trustpilot star-box colours. */
export const TP_STAR: Record<0 | 1 | 2 | 3 | 4 | 5, string> = {
  0: "#dcdce6",
  1: "#ff3722",
  2: "#ff8622",
  3: "#ffce00",
  4: "#73cf11",
  5: "#00b67a",
};

export function starColor(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating))) as 0 | 1 | 2 | 3 | 4 | 5;
  return TP_STAR[n];
}

function StarGlyph({ size }: { size: number }) {
  return (
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        d="M12 1.7l2.86 6.88 7.44.64-5.64 4.9 1.7 7.28L12 17.62 5.64 21.4l1.7-7.28-5.64-4.9 7.44-.64L12 1.7z"
      />
    </svg>
  );
}

/** Trustpilot's boxed stars — every filled box uses the colour of that rating. */
export function TpStars({
  rating,
  size = 20,
}: {
  rating: number;
  size?: number;
}) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  const color = starColor(filled || rating);
  return (
    <span className="tp-stars" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="tp-star"
          style={{
            width: size,
            height: size,
            background: i <= filled ? color : TP_STAR[0],
          }}
        >
          <StarGlyph size={size} />
        </span>
      ))}
    </span>
  );
}

/** TrustScore row: 4.1 + boxed stars coloured by the score. */
export function TpScore({
  score,
  size = 16,
}: {
  score: number | null;
  size?: number;
}) {
  if (score == null) return <span className="text-[#8a9198]">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-[15px] font-semibold text-[#191919]">
        {score.toFixed(1)}
      </span>
      <TpStars rating={score} size={size} />
    </span>
  );
}

/** Official Trustpilot score vs poker over the last 12 months. */
export function ScorePair({
  officialScore,
  officialCount,
  pokerScore,
  pokerCount,
  pokerCaption,
  size = 18,
  compact = false,
  onOfficial,
  onPoker,
}: {
  officialScore: number | null;
  officialCount?: number | null;
  pokerScore: number | null;
  pokerCount: number;
  pokerCaption?: string;
  size?: number;
  compact?: boolean;
  onOfficial?: () => void;
  onPoker?: () => void;
}) {
  const officialSub =
    officialCount != null
      ? `Trustpilot · all time · ${officialCount.toLocaleString()} reviews`
      : "Trustpilot · all time";
  const pokerSub = pokerCaption ?? `${pokerCount.toLocaleString()} poker reviews · last 12 months`;
  return (
    <div className={`gr-scoreboard${compact ? " gr-scoreboard-compact" : ""}`}>
      <div className="gr-score-card">
        <div className="gr-score-kicker">Brand</div>
        <div className="gr-score-row">
          <span className="gr-score-num">{officialScore != null ? officialScore.toFixed(1) : "—"}</span>
          {officialScore != null ? <TpStars rating={officialScore} size={size} /> : null}
        </div>
        {onOfficial ? (
          <button type="button" className="gr-count gr-score-sub" onClick={onOfficial}>
            {officialSub}
          </button>
        ) : (
          <div className="gr-score-sub">{officialSub}</div>
        )}
      </div>
      <div className="gr-score-card">
        <div className="gr-score-kicker">Poker</div>
        <div className="gr-score-row">
          <span className="gr-score-num">{pokerScore != null ? pokerScore.toFixed(1) : "—"}</span>
          {pokerScore != null ? <TpStars rating={pokerScore} size={size} /> : null}
        </div>
        {onPoker ? (
          <button type="button" className="gr-count gr-score-sub" onClick={onPoker}>
            {pokerSub}
          </button>
        ) : (
          <div className="gr-score-sub">{pokerSub}</div>
        )}
      </div>
    </div>
  );
}
