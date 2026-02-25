import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Candidate } from '@datewise/shared';
import { ScoringService } from './scoring.service';

const service = new ScoringService();

function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    kind: 'PLACE',
    externalId: 'candidate',
    name: 'Candidate',
    lat: 1.29027,
    lng: 103.851959,
    ...overrides,
  };
}

test('quality score prefers higher rating and review count', () => {
  const ranked = service.scoreCandidates({
    origin: { lat: 1.29027, lng: 103.851959 },
    budget: '$$',
    dateStyle: 'FOOD',
    vibe: 'CHILL',
    candidates: [
      candidate({ externalId: 'low-quality', rating: 4.1, reviewCount: 25 }),
      candidate({ externalId: 'high-quality', rating: 4.7, reviewCount: 2_100 }),
    ],
  });

  assert.equal(ranked[0]?.candidate.externalId, 'high-quality');
  assert.ok(ranked[0].breakdown.qualityScore > ranked[1].breakdown.qualityScore);
});

test('fit score penalizes distance according to selected transport preference', () => {
  const near = candidate({ externalId: 'near', lat: 1.291, lng: 103.852, priceLevel: 2 });
  const far = candidate({ externalId: 'far', lat: 1.33, lng: 103.89, priceLevel: 2 });

  const minWalkRanked = service.scoreCandidates({
    origin: { lat: 1.29027, lng: 103.851959 },
    budget: '$$',
    dateStyle: 'FOOD',
    vibe: 'CHILL',
    transport: 'MIN_WALK',
    candidates: [near, far],
  });

  assert.equal(minWalkRanked[0]?.candidate.externalId, 'near');
  assert.ok(minWalkRanked[0].breakdown.fitScore > minWalkRanked[1].breakdown.fitScore);
});

test('style and vibe matches boost the styleVibe score', () => {
  const ranked = service.scoreCandidates({
    origin: { lat: 1.29027, lng: 103.851959 },
    budget: '$$',
    dateStyle: 'SCENIC',
    vibe: 'ROMANTIC',
    candidates: [
      candidate({
        externalId: 'match',
        tags: ['ROMANTIC', 'NATURE', 'DATE_NIGHT'],
      }),
      candidate({
        externalId: 'mismatch',
        tags: ['ARTSY'],
      }),
    ],
  });

  assert.equal(ranked[0]?.candidate.externalId, 'match');
  assert.ok(ranked[0].breakdown.styleVibeScore > ranked[1].breakdown.styleVibeScore);
});

test('avoid filters apply penalties for matching loud/crowded signals', () => {
  const ranked = service.scoreCandidates({
    origin: { lat: 1.29027, lng: 103.851959 },
    budget: '$$',
    dateStyle: 'EVENT',
    vibe: 'ACTIVE',
    avoid: ['LOUD', 'CROWDED'],
    candidates: [
      candidate({ externalId: 'safe', tags: ['COZY'] }),
      candidate({ externalId: 'avoid-hit', tags: ['LOUD', 'CROWDED'] }),
    ],
  });

  assert.equal(ranked[0]?.candidate.externalId, 'safe');
  assert.ok(ranked[1].breakdown.avoidPenalty > ranked[0].breakdown.avoidPenalty);
});

test('diversity penalty reduces score for repeated tags/types from selected candidates', () => {
  const ranked = service.scoreCandidates({
    origin: { lat: 1.29027, lng: 103.851959 },
    budget: '$$',
    dateStyle: 'ACTIVITY',
    vibe: 'ACTIVE',
    selected: [
      candidate({ externalId: 'picked-1', types: ['museum'], tags: ['ARTSY'] }),
      candidate({ externalId: 'picked-2', types: ['museum'], tags: ['ARTSY'] }),
    ],
    candidates: [
      candidate({ externalId: 'repeat', types: ['museum'], tags: ['ARTSY'] }),
      candidate({ externalId: 'diverse', types: ['gallery'], tags: ['ICONIC'] }),
    ],
  });

  const diverse = ranked.find((item) => item.candidate.externalId === 'diverse');
  const repeat = ranked.find((item) => item.candidate.externalId === 'repeat');

  assert.ok(diverse);
  assert.ok(repeat);
  assert.ok(repeat.breakdown.diversityPenalty > diverse.breakdown.diversityPenalty);
  assert.ok(repeat.score < diverse.score);
});

test('diversity penalty ignores ubiquitous place types', () => {
  const ranked = service.scoreCandidates({
    origin: { lat: 1.29027, lng: 103.851959 },
    budget: '$$',
    dateStyle: 'ACTIVITY',
    vibe: 'ACTIVE',
    selected: [
      candidate({ externalId: 'picked-1', types: ['point_of_interest', 'establishment', 'museum'] }),
      candidate({ externalId: 'picked-2', types: ['point_of_interest', 'establishment', 'park'] }),
    ],
    candidates: [
      candidate({ externalId: 'ubiquitous-only', types: ['point_of_interest', 'establishment', 'cafe'] }),
      candidate({ externalId: 'meaningful-repeat', types: ['point_of_interest', 'establishment', 'museum'] }),
    ],
  });

  const ubiquitousOnly = ranked.find((item) => item.candidate.externalId === 'ubiquitous-only');
  const meaningfulRepeat = ranked.find((item) => item.candidate.externalId === 'meaningful-repeat');

  assert.ok(ubiquitousOnly);
  assert.ok(meaningfulRepeat);
  assert.equal(ubiquitousOnly.breakdown.diversityPenalty, 0);
  assert.ok(meaningfulRepeat.breakdown.diversityPenalty > ubiquitousOnly.breakdown.diversityPenalty);
});
