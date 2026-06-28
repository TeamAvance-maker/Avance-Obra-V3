import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";

export function HelpFab({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label="Abrir ayuda"
      className="group fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.3_0.05_45/0.45)] transition-colors hover:bg-primary/90"
    >
      <HelpCircle className="h-5 w-5" />
      <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow transition-opacity group-hover:opacity-100">
        Ayuda
      </span>
    </motion.button>
  );
}
