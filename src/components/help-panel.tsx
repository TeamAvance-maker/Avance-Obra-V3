import { useMemo, useState } from "react";
import { Search, LifeBuoy, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { HELP_SECTIONS } from "@/lib/help-content";
import { cn } from "@/lib/utils";

export function HelpPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_SECTIONS;
    return HELP_SECTIONS.map((s) => ({
      ...s,
      qa: s.qa.filter(
        (item) =>
          item.q.toLowerCase().includes(q) ||
          item.a.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q),
      ),
    })).filter((s) => s.qa.length > 0);
  }, [query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg"
      >
        <SheetHeader className="space-y-3 border-b border-border bg-gradient-to-b from-secondary/40 to-transparent px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="font-display text-xl">Centro de ayuda</SheetTitle>
              <SheetDescription className="text-xs">
                Manual de usuario del sistema de control de obra
              </SheetDescription>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar en la ayuda…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {filtered.length === 0 ? (
            <div className="mt-12 text-center text-sm text-muted-foreground">
              No encontramos resultados para
              <div className="mt-1 font-medium text-foreground">"{query}"</div>
              <p className="mt-3 text-xs">Prueba con otra palabra más corta.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filtered.map((section) => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className={cn(
                    "overflow-hidden rounded-xl border border-border bg-card",
                    "data-[state=open]:shadow-sm",
                  )}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-xl leading-none">{section.emoji}</span>
                      <div>
                        <div className="font-display text-sm font-semibold">
                          {section.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {section.intro}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0">
                    <ul className="space-y-3 border-t border-border/60 pt-3">
                      {section.qa.map((item, i) => (
                        <li key={i} className="space-y-1">
                          <div className="text-sm font-medium text-foreground">
                            {item.q}
                          </div>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {item.a}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        <div className="border-t border-border bg-secondary/30 px-6 py-3 text-center text-[11px] text-muted-foreground">
          ¿No encuentras lo que buscas? Avisa al administrador de la obra.
        </div>
      </SheetContent>
    </Sheet>
  );
}
