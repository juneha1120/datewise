import { Injectable } from '@nestjs/common';
import { Tag, TagSchema } from '@datewise/shared';
import { z } from 'zod';

const TaggingInputSchema = z.object({
  types: z.array(z.string().min(1)).default([]),
  priceLevel: z.number().int().min(0).max(4).optional(),
  snippets: z.array(z.string().min(1)).default([]),
});

const typeTagMap: Readonly<Record<string, readonly Tag[]>> = {
  museum: ['ARTSY'],
  art_gallery: ['ARTSY'],
  tourist_attraction: ['ICONIC', 'DATE_NIGHT'],
  park: ['NATURE', 'ROMANTIC'],
  botanical_garden: ['NATURE', 'ROMANTIC'],
  cafe: ['COZY', 'DATE_NIGHT'],
  bakery: ['COZY'],
};

const snippetSignals: ReadonlyArray<{ pattern: RegExp; tags: readonly Tag[] }> = [
  { pattern: /\b(date\s*night|couple|anniversary|intimate)\b/iu, tags: ['DATE_NIGHT', 'ROMANTIC'] },
  { pattern: /\bromantic|sunset|candle\b/iu, tags: ['ROMANTIC'] },
  { pattern: /\bcozy|quiet|relaxing\b/iu, tags: ['COZY'] },
  { pattern: /\b(loud|noisy|blasting\s+music)\b/iu, tags: ['LOUD'] },
  { pattern: /\b(crowded|packed|long\s+queue|busy)\b/iu, tags: ['CROWDED'] },
];

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

@Injectable()
export class TaggingService {
  inferTags(input: unknown): Tag[] {
    const parsed = TaggingInputSchema.parse(input);
    const tags = new Set<Tag>();

    for (const rawType of parsed.types) {
      const mapped = typeTagMap[normalizeType(rawType)];
      if (!mapped) {
        continue;
      }

      for (const tag of mapped) {
        tags.add(tag);
      }
    }

    if (parsed.priceLevel !== undefined) {
      if (parsed.priceLevel <= 1) {
        tags.add('BUDGET_FRIENDLY');
      }

      if (parsed.priceLevel >= 3) {
        tags.add('PREMIUM');
      }
    }

    const combinedSnippets = parsed.snippets.join(' ').toLowerCase();
    for (const signal of snippetSignals) {
      if (!signal.pattern.test(combinedSnippets)) {
        continue;
      }

      for (const tag of signal.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags)
      .filter((tag) => TagSchema.safeParse(tag).success)
      .sort((left, right) => left.localeCompare(right));
  }
}
