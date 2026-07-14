"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const PRODUCT_LINKS = [
  { label: "What we score", href: "#pillars" },
  { label: "How it works", href: "#how" },
  { label: "Why Scuup", href: "#compare" },
];

export function LandingProductNav({ className }: { className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 transition-colors hover:text-foreground data-popup-open:text-foreground",
              className,
            )}
          />
        }
      >
        Product
        <ChevronDown className="size-3.5 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="min-w-44">
        {PRODUCT_LINKS.map((link) => (
          <DropdownMenuItem key={link.href} render={<a href={link.href} />}>
            {link.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
