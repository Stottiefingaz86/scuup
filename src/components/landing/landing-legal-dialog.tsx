"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LEGAL_DOCUMENTS,
  LEGAL_UPDATED,
  type LegalDocument,
} from "@/components/landing/legal-content";
import { cn } from "@/lib/utils";

const LegalDialogContext = createContext<{
  openLegal: (doc: LegalDocument) => void;
} | null>(null);

export function useLegalDialog() {
  const ctx = useContext(LegalDialogContext);
  if (!ctx) {
    throw new Error("useLegalDialog must be used within LegalDialogProvider");
  }
  return ctx;
}

const DOC_ORDER: LegalDocument[] = ["privacy", "terms", "cookies"];

function LegalTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border/70 text-muted-foreground hover:border-primary/25 hover:text-foreground",
      )}
    >
      {label.replace(" Policy", "").replace(" of Service", "")}
    </button>
  );
}

function LegalDialogBody({
  doc,
  open,
  onOpenChange,
  onDocChange,
}: {
  doc: LegalDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocChange: (doc: LegalDocument) => void;
}) {
  const { title, Content } = LEGAL_DOCUMENTS[doc];

  const goToContact = useCallback(() => {
    onOpenChange(false);
    requestAnimationFrame(() => {
      document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
    });
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/70 backdrop-blur-sm"
        className="max-h-[min(92vh,820px)] w-[min(96vw,42rem)] gap-0 overflow-hidden border-border/80 bg-background p-0 sm:max-w-none"
      >
        <div className="border-b border-border/80 px-6 pb-5 pt-8 sm:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-brand">
            Legal
          </p>
          <DialogTitle className="mt-2 font-heading text-2xl font-semibold tracking-tight">
            {title}
          </DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated {LEGAL_UPDATED}
          </p>
          <nav
            aria-label="Legal documents"
            className="mt-4 flex flex-wrap gap-2"
          >
            {DOC_ORDER.map((id) => (
              <LegalTab
                key={id}
                label={LEGAL_DOCUMENTS[id].title}
                active={doc === id}
                onClick={() => onDocChange(id)}
              />
            ))}
          </nav>
        </div>

        <div className="prose-legal max-h-[min(58vh,520px)] overflow-y-auto px-6 py-6 sm:px-8 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:ps-5">
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground">
            <Content onContactClick={goToContact} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LegalDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<LegalDocument>("privacy");

  const openLegal = useCallback((next: LegalDocument) => {
    setDoc(next);
    setOpen(true);
  }, []);

  return (
    <LegalDialogContext.Provider value={{ openLegal }}>
      {children}
      <LegalDialogBody
        doc={doc}
        open={open}
        onOpenChange={setOpen}
        onDocChange={setDoc}
      />
    </LegalDialogContext.Provider>
  );
}

export function LegalNavButton({
  doc,
  children,
  className,
}: {
  doc: LegalDocument;
  children: React.ReactNode;
  className?: string;
}) {
  const { openLegal } = useLegalDialog();

  return (
    <button
      type="button"
      onClick={() => openLegal(doc)}
      className={cn(
        "text-start transition-colors hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
