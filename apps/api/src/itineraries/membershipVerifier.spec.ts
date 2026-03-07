import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyCoreCandidate, verifySubgroupCandidate } from './membershipVerifier';
import { CORE_ANCHORS, PROFILES } from './subgroupProfiles';

test('cuisine mislabel test rejects fast food for japanese', () => {
  const result = verifySubgroupCandidate(
    'JAPANESE',
    {
      name: "McDonald's",
      primaryType: 'fast_food_restaurant',
      types: ['restaurant', 'fast_food_restaurant'],
      editorialSummary: 'Fast food burgers and fries',
      reviews: ['Quick burger meal'],
    },
    PROFILES,
  );

  assert.equal(result.accepted, false);
  assert.equal(result.confidence < 0.7, true);
});

test('mall collision test rejects EAT core when primary type is shopping mall', () => {
  const result = verifyCoreCandidate(
    'EAT',
    {
      name: 'Mega Mall Food Hall',
      primaryType: 'shopping_mall',
      types: ['restaurant', 'shopping_mall'],
      editorialSummary: 'Large shopping complex',
      reviews: [],
    },
    CORE_ANCHORS,
  );

  assert.equal(result.accepted, false);
  assert.equal(result.evidence.conflictPenalty, 1);
});

test('alcohol family disambiguation enforces single label with margin', () => {
  const wineResult = verifySubgroupCandidate(
    'WINE',
    {
      name: 'Cellar & Vine Wine Bar',
      primaryType: 'bar',
      types: ['bar'],
      editorialSummary: 'Wine bar with sommelier picks',
      reviews: ['Excellent wine list and pairings'],
    },
    PROFILES,
  );
  const cocktailResult = verifySubgroupCandidate(
    'COCKTAIL',
    {
      name: 'Cellar & Vine Wine Bar',
      primaryType: 'bar',
      types: ['bar'],
      editorialSummary: 'Wine bar with sommelier picks',
      reviews: ['Excellent wine list and pairings'],
    },
    PROFILES,
  );

  assert.equal(wineResult.accepted, true);
  assert.equal(cocktailResult.accepted, false);
});

test('text subgroup escape room accepts direct match and rejects board game cafe', () => {
  const escapeResult = verifySubgroupCandidate(
    'ESCAPE_ROOM',
    {
      name: 'Escape Room XYZ',
      primaryType: 'point_of_interest',
      types: ['point_of_interest'],
      editorialSummary: 'Immersive escape room challenge',
      reviews: ['Great escape room puzzles'],
    },
    PROFILES,
  );
  const boardGameResult = verifySubgroupCandidate(
    'ESCAPE_ROOM',
    {
      name: 'Board Game Cafe',
      primaryType: 'cafe',
      types: ['cafe'],
      editorialSummary: 'Tabletop games with coffee',
      reviews: ['Fun board games'],
    },
    PROFILES,
  );
  const coreDoResult = verifyCoreCandidate(
    'DO',
    {
      name: 'Board Game Cafe',
      primaryType: 'cafe',
      types: ['amusement_center', 'cafe'],
      editorialSummary: 'Tabletop games with coffee',
      reviews: [],
    },
    CORE_ANCHORS,
  );

  assert.equal(escapeResult.accepted, true);
  assert.equal(boardGameResult.accepted, false);
  assert.equal(coreDoResult.accepted, true);
});

test('core-only acceptance allows generic restaurant but cuisine lock rejects', () => {
  const details = {
    name: 'Neighborhood Restaurant',
    primaryType: 'restaurant',
    types: ['restaurant'],
    editorialSummary: 'Popular dining spot in Singapore',
    reviews: ['Tasty food and friendly service'],
  };

  const coreResult = verifyCoreCandidate('EAT', details, CORE_ANCHORS);
  const japaneseResult = verifySubgroupCandidate('JAPANESE', details, PROFILES);
  const koreanResult = verifySubgroupCandidate('KOREAN', details, PROFILES);

  assert.equal(coreResult.accepted, true);
  assert.equal(japaneseResult.accepted, false);
  assert.equal(koreanResult.accepted, false);
});
