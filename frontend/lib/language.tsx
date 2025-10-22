'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SupportedLanguage = "en" | "zh";

type LanguageContextValue = {
  language: SupportedLanguage;
  setLanguage: (value: SupportedLanguage) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguage>("en");

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === "en" ? "zh" : "en"));
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
    }),
    [language, toggleLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
