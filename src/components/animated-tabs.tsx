"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedTab {
  value: string;
  label: ReactNode;
}

/**
 * Segmented control with a pill indicator that slides between tabs.
 * The indicator is positioned imperatively so it animates smoothly on
 * both tab change and container resize.
 */
export function AnimatedTabs({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: AnimatedTab[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const update = () => {
      const active = list.querySelector<HTMLButtonElement>(
        `[data-value="${value}"]`
      );
      if (!active) return;
      indicator.style.left = `${active.offsetLeft}px`;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.opacity = "1";
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        "relative inline-flex w-fit items-center gap-1 rounded-full border bg-muted/40 p-1",
        className
      )}
    >
      <span
        ref={indicatorRef}
        aria-hidden
        className="absolute inset-y-1 rounded-full bg-accent opacity-0 transition-[left,width] duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]"
      />
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            data-value={tab.value}
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "relative z-10 cursor-pointer rounded-full px-4 py-1.5 font-heading text-sm whitespace-nowrap transition-colors duration-200",
              active
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
