'use client';

import { useMemo } from "react";
import { STORY_CHAPTERS, type StoryChapter } from "@/lib/storyline";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/lib/language";
import { getLocalizedChapterContent } from "@/lib/storyline-translations";
import { LanguageToggle } from "@/components/language-toggle";

type ChapterState = {
  chapter: StoryChapter;
  localized: ReturnType<typeof getLocalizedChapterContent>;
};

export default function StoryPage() {
  const { language } = useLanguage();
  const chapters = useMemo<ChapterState[]>(
    () =>
      STORY_CHAPTERS.map((chapter) => ({
        chapter,
        localized: getLocalizedChapterContent(chapter, language),
      })),
    [language],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/10">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Storyline Codex</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Leasebound Chronicles</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Follow the landlord-led narrative arc that ushers the council through the valley&apos;s tutorial cadence.
            </p>
          </div>
          <LanguageToggle />
        </header>

        <div className="space-y-8">
          {chapters.map(({ chapter, localized }) => (
            <Card key={chapter.id} className="border-border/60 bg-card/90 backdrop-blur">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                    Chapter {chapter.order}
                  </Badge>
                  <CardTitle>{localized.title}</CardTitle>
                </div>
                <CardDescription>{localized.synopsis}</CardDescription>
                {localized.highlight ? (
                  <p className="text-sm font-medium text-foreground/80">{localized.highlight}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-6">
                {localized.objectives?.length ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Objectives
                    </h2>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {localized.objectives.map((objective: string) => (
                        <li key={objective} className="rounded-xl bg-muted/40 px-3 py-2">
                          {objective}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {localized.unlocks?.length ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Unlocks
                    </h2>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {localized.unlocks.map((unlock: string) => (
                        <li key={unlock} className="rounded-xl bg-primary/10 px-3 py-2 text-primary">
                          {unlock}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <Separator />

                <section className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Trigger</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {chapter.trigger.type}
                  </Badge>
                  {chapter.trigger.type === "stage" ? <span>Stage {chapter.trigger.stage}</span> : null}
                  {chapter.trigger.type === "purchase" ? <span>Item: {chapter.trigger.itemId}</span> : null}
                  {chapter.trigger.type === "resource" ? (
                    <span>
                      {chapter.trigger.resource} &ge; {chapter.trigger.amount}
                    </span>
                  ) : null}
                  {chapter.trigger.type === "milestone" ? <span>{chapter.trigger.label}</span> : null}
                </section>

                {localized.notes ? (
                  <section className="rounded-xl bg-muted/30 p-4 text-xs text-muted-foreground">
                    {localized.notes}
                  </section>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
