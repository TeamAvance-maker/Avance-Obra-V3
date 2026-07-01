import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Una OBRA (work). La empresa es única; cada obra cuelga de ella.
export interface Work {
  id: string;
  company_id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
}

export function useWorks() {
  return useQuery({
    queryKey: ["works"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("works" as never) as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Work[];
    },
  });
}

interface WorkCtxValue {
  workId: string | null;
  setWorkId: (id: string) => void;
  works: Work[];
  loading: boolean;
}

const WorkCtx = createContext<WorkCtxValue>({
  workId: null,
  setWorkId: () => {},
  works: [],
  loading: true,
});

const LS_KEY = "controlobra_work_id";

export function WorkProvider({ children }: { children: ReactNode }) {
  const worksQ = useWorks();
  const [workId, setWorkIdState] = useState<string | null>(null);

  // Cuando llegan las obras, elegir la guardada (si sigue existiendo) o la primera.
  useEffect(() => {
    const list = worksQ.data;
    if (!list || list.length === 0) return;
    setWorkIdState((cur) => {
      if (cur && list.some((w) => w.id === cur)) return cur;
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(LS_KEY);
      } catch {
        /* ignore */
      }
      return saved && list.some((w) => w.id === saved) ? saved : list[0].id;
    });
  }, [worksQ.data]);

  const setWorkId = (id: string) => {
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      /* ignore */
    }
    setWorkIdState(id);
  };

  const value = useMemo<WorkCtxValue>(
    () => ({ workId, setWorkId, works: worksQ.data ?? [], loading: worksQ.isLoading }),
    [workId, worksQ.data, worksQ.isLoading],
  );

  return <WorkCtx.Provider value={value}>{children}</WorkCtx.Provider>;
}

export function useWorkContext() {
  return useContext(WorkCtx);
}

/** Obra actualmente seleccionada (o null mientras carga). Lo usan los hooks de datos. */
export function useCurrentWorkId() {
  return useContext(WorkCtx).workId;
}

/** Selector de obra para el encabezado. */
export function ObraSelector() {
  const { works, workId, setWorkId } = useWorkContext();
  if (works.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Obra
      </span>
      <Select value={workId ?? undefined} onValueChange={setWorkId}>
        <SelectTrigger className="h-9 w-[220px] max-w-[70vw]">
          <SelectValue placeholder="Selecciona obra…" />
        </SelectTrigger>
        <SelectContent>
          {works.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
