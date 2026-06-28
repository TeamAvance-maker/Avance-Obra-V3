import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  /** Texto adicional para que el buscador filtre (descripción, código…) */
  keywords?: string;
  /** Texto secundario opcional para mostrar bajo el label */
  hint?: string;
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados",
  className,
  disabled,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-10 w-full justify-between whitespace-normal py-2 text-left font-normal",
            !current && "text-muted-foreground",
            className,
          )}
        >
          <span className="line-clamp-2 min-w-0 flex-1 text-left leading-snug break-words">
            {current ? current.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const opt = options.find((o) => o.value === itemValue);
            if (!opt) return 0;
            const hay = `${opt.label} ${opt.keywords ?? ""} ${opt.hint ?? ""}`.toLowerCase();
            const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
            if (tokens.length === 0) return 1;
            return tokens.every((t) => hay.includes(t)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="truncate text-xs text-muted-foreground">{o.hint}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
