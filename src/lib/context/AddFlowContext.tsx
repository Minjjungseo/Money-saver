"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type AddFlowMode = "closed" | "menu" | "manual" | "image" | "import";

interface AddFlowContextValue {
  mode: AddFlowMode;
  editingTransactionId: string | null;
  openMenu(): void;
  openManual(editTransactionId?: string): void;
  openImage(): void;
  openImport(): void;
  close(): void;
}

const AddFlowContext = createContext<AddFlowContextValue | null>(null);

export function AddFlowProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AddFlowMode>("closed");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const openMenu = useCallback(() => setMode("menu"), []);
  const openManual = useCallback((editTransactionId?: string) => {
    setEditingTransactionId(editTransactionId ?? null);
    setMode("manual");
  }, []);
  const openImage = useCallback(() => setMode("image"), []);
  const openImport = useCallback(() => setMode("import"), []);
  const close = useCallback(() => {
    setMode("closed");
    setEditingTransactionId(null);
  }, []);

  const value = useMemo(
    () => ({ mode, editingTransactionId, openMenu, openManual, openImage, openImport, close }),
    [mode, editingTransactionId, openMenu, openManual, openImage, openImport, close]
  );

  return <AddFlowContext.Provider value={value}>{children}</AddFlowContext.Provider>;
}

export function useAddFlow(): AddFlowContextValue {
  const ctx = useContext(AddFlowContext);
  if (!ctx) throw new Error("useAddFlow must be used within AddFlowProvider");
  return ctx;
}
