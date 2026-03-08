const KEYWORDS: Record<string, string[]> = {
  JAPANESE: ['japanese', 'sushi', 'ramen', 'izakaya'],
  MUSEUM: ['museum', 'gallery', 'exhibit'],
  COFFEE: ['coffee', 'espresso', 'cafe'],
  DESSERT: ['dessert', 'cake', 'pastry', 'sweet'],
  COCKTAIL: ['cocktail', 'bar', 'mixology'],
  HAWKER: ['hawker', 'food centre', 'kopitiam'],
};

export class TaggingService {
  relevanceScore(selection: string, name: string): number {
    const normalized = name.toLowerCase();
    const defaultHit = normalized.includes(selection.toLowerCase()) ? 0.7 : 0.2;
    const hits = (KEYWORDS[selection] ?? []).filter((keyword) => normalized.includes(keyword)).length;
    return Math.min(1, defaultHit + hits * 0.2);
  }
}
