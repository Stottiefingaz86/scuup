import type { Metadata } from "next";
import "./grace.css";

export const metadata: Metadata = {
  title: "Grace | Trustpilot review intelligence",
  description:
    "Internal tool — pull a brand's Trustpilot reviews, filter by time and keyword, and build a sentiment report with competitor benchmarks.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function GraceLayout({ children }: { children: React.ReactNode }) {
  return <div className="grace-root">{children}</div>;
}
