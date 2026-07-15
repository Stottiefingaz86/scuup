"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

const LINE_1 = "Get The Scuup. on 1000+";
const LINE_2 = "Brands in over 40 Markets";

const LINE_1_IMAGE = "/brands.jpg";
const LINE_2_IMAGE = "/brands.jpg";

const FONT_SIZE = "clamp(112px,18vw,300px)";

function textFillStyle(
  imageSrc: string,
  tickerX: number,
  bgX: number,
  bgY: number,
  imagePositionY: string
): CSSProperties {
  return {
    color: "transparent",
    WebkitTextFillColor: "transparent",
    backgroundImage: `url(${imageSrc})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "100vw auto",
    /* Counter ticker so collage stays fixed while text slides */
    backgroundPosition: `${-tickerX + bgX}px calc(${imagePositionY} + ${bgY}px)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
  };
}

function HeadlineRow({
  text,
  imageSrc,
  imagePositionY,
  tickerX,
  bgX,
  bgY,
  rowClassName,
}: {
  text: string;
  imageSrc: string;
  imagePositionY: string;
  tickerX: number;
  bgX: number;
  bgY: number;
  rowClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-x-clip",
        rowClassName
      )}
      style={{ fontSize: FONT_SIZE }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[min(5vw,40px)] bg-gradient-to-r from-background to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[min(8vw,64px)] bg-gradient-to-l from-background to-transparent"
      />

      <div
        className="relative will-change-transform"
        style={{ transform: `translate3d(${tickerX}px, 0, 0)` }}
      >
        <p
          className="w-max max-w-none whitespace-nowrap font-heading font-bold leading-[0.98] tracking-[-0.055em]"
          style={textFillStyle(
            imageSrc,
            tickerX,
            bgX,
            bgY,
            imagePositionY
          )}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

export function ScuupScrollHeadline() {
  const sectionRef = useRef<HTMLElement>(null);
  const [shift, setShift] = useState(0.5);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh;
      const end = -rect.height;
      const raw = (start - rect.top) / (start - end);
      setShift(Math.max(0, Math.min(1, raw)));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const delta = shift - 0.5;

  const TICKER_1_BASE = -314;
  const TICKER_2_BASE = -480;
  const TICKER_RANGE = 628;

  const ticker1X = reduceMotion
    ? TICKER_1_BASE
    : TICKER_1_BASE + delta * -TICKER_RANGE;
  const ticker2X = reduceMotion
    ? TICKER_2_BASE
    : TICKER_2_BASE + delta * TICKER_RANGE;

  const bgX = reduceMotion ? 0 : delta * -98;
  const bgY1 = reduceMotion ? 0 : delta * -98;
  const bgY2 = reduceMotion ? 0 : delta * -98;

  const fullText = `${LINE_1} ${LINE_2}`;

  return (
    <section
      ref={sectionRef}
      aria-label={fullText}
      className="relative left-1/2 z-[1] w-screen max-w-none -translate-x-1/2 overflow-x-clip border-0"
    >
      <HeadlineRow
        text={LINE_1}
        imageSrc={LINE_1_IMAGE}
        imagePositionY="22%"
        tickerX={ticker1X}
        bgX={bgX}
        bgY={bgY1}
        rowClassName="pt-[0.06em] pb-[0.03em]"
      />
      <HeadlineRow
        text={LINE_2}
        imageSrc={LINE_2_IMAGE}
        imagePositionY="78%"
        tickerX={ticker2X}
        bgX={bgX}
        bgY={bgY2}
        rowClassName="-mt-[0.06em] pb-[0.06em]"
      />
      <p className="sr-only">{fullText}</p>
    </section>
  );
}
