"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface BreadcrumbContextType {
  nameMappings: Record<string, string>;
  setNameMapping: (uuid: string, name: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [nameMappings, setNameMappings] = useState<Record<string, string>>({});

  const setNameMapping = useCallback((uuid: string, name: string) => {
    setNameMappings((prev) => ({ ...prev, [uuid]: name }));
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ nameMappings, setNameMapping }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error("useBreadcrumbContext must be used within BreadcrumbProvider");
  }
  return context;
}
