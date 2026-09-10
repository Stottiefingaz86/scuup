import { cn } from "@/lib/utils";

/** Brand wordmark from /public/logo.svg (icon + Scuup). */
export function ScuupMark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand SVG wordmark
    <img
      src="/logo.svg"
      alt="Scuup"
      width={121}
      height={41}
      className={cn(
        "h-auto w-auto",
        size === "default" && "h-7",
        size === "lg" && "h-8",
        className
      )}
    />
  );
}

/** Icon-only mark (no wordmark) for tight chrome like a collapsed sidebar. */
export function ScuupIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 33 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-5", className)}
      aria-hidden
    >
      <path
        d="M5.923 10.154C5.923 4.546 10.469 0 16.077 0H30.099C31.701 0 33 1.299 33 2.901C33 6.907 29.753 10.154 25.747 10.154H5.923Z"
        fill="url(#scuup-icon-a)"
      />
      <path
        d="M27.077 11.846C27.077 17.454 22.531 22 16.923 22H2.901C1.299 22 0 20.701 0 19.099C0 15.093 3.247 11.846 7.253 11.846H27.077Z"
        fill="url(#scuup-icon-b)"
      />
      <defs>
        <linearGradient
          id="scuup-icon-a"
          x1="21.5"
          y1="10"
          x2="33"
          y2="21.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#3CD199" />
          <stop offset="1" stopColor="#3ACDCD" />
        </linearGradient>
        <linearGradient
          id="scuup-icon-b"
          x1="14"
          y1="24.5"
          x2="27"
          y2="-0.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#3ACDCD" />
          <stop offset="1" stopColor="#3DD199" />
        </linearGradient>
      </defs>
    </svg>
  );
}
