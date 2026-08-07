"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ListToolbarActionsContextValue = {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
};

const ListToolbarActionsContext = createContext<ListToolbarActionsContextValue | null>(null);

export function ListToolbarActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null);
  const setActions = useCallback((next: ReactNode) => {
    setActionsState(next);
  }, []);
  const value = useMemo(() => ({ actions, setActions }), [actions, setActions]);
  return (
    <ListToolbarActionsContext.Provider value={value}>
      {children}
    </ListToolbarActionsContext.Provider>
  );
}

export function useListToolbarActions() {
  return useContext(ListToolbarActionsContext)?.actions ?? null;
}

/** Register primary list actions (e.g. Add button) so FilterBar can render them on the same row. */
export function useRegisterListToolbarActions(actions: ReactNode) {
  const setActions = useContext(ListToolbarActionsContext)?.setActions;
  const hasActions = actions != null && actions !== false;
  useLayoutEffect(() => {
    if (!setActions) return;
    setActions(hasActions ? actions : null);
    return () => setActions(null);
    // Only re-sync when actions appear/disappear to avoid render loops from new JSX each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActions, hasActions]);
}
