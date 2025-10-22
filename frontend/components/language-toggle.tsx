'use client';

import { useLanguage } from "@/lib/language";
import { Button } from "@/components/ui/button";

const OPTIONS: Array<{ code: "en" | "zh"; label: string }> = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
];

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      {OPTIONS.map((option) => (
        <Button
          key={option.code}
          variant={language === option.code ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setLanguage(option.code)}
          type="button"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
