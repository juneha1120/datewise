import { CoreGroup } from '@datewise/shared';

import { FAMILY_GROUPS, PROFILES, SubgroupProfile } from './subgroupProfiles';

export type VerificationEvidence = {
  typeScore: number;
  keywordScore: number;
  reviewScore: number;
  conflictPenalty: number;
  reasons: string[];
};

export type VerificationResult = {
  accepted: boolean;
  confidence: number;
  evidence: VerificationEvidence;
};

type VerifiablePlaceDetails = {
  name: string;
  primaryType?: string;
  types?: string[];
  editorialSummary?: string;
  reviews?: string[];
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeText(value: string | undefined): string {
  return value?.toLowerCase() ?? '';
}

function scoreKeywordMatches(text: string, keywords: string[] | undefined): { score: number; hits: string[] } {
  if (!keywords || keywords.length === 0) {
    return { score: 0.5, hits: [] };
  }

  const hits = keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
  return {
    score: hits.length > 0 ? 1 : 0,
    hits,
  };
}

function computeProfileEvidence(profile: SubgroupProfile, place: VerifiablePlaceDetails): VerificationEvidence {
  const reasons: string[] = [];
  const primaryType = normalizeText(place.primaryType);
  const types = new Set((place.types ?? []).map((type) => type.toLowerCase()));
  const name = normalizeText(place.name);
  const summary = normalizeText(place.editorialSummary);
  const reviewsText = normalizeText((place.reviews ?? []).join(' '));

  let typeScore = 0;
  const hasTypeAnchors = Boolean((profile.requiredPrimaryTypesAny?.length ?? 0) > 0 || (profile.requiredTypesAny?.length ?? 0) > 0);
  if (profile.requiredPrimaryTypesAny?.some((type) => primaryType === type.toLowerCase())) {
    typeScore = 1;
    reasons.push('primary type matched subgroup anchor');
  } else if (profile.requiredTypesAny?.some((type) => types.has(type.toLowerCase()))) {
    const primaryMatchesRequiredType = profile.requiredTypesAny?.some((type) => primaryType === type.toLowerCase()) ?? false;
    typeScore = primaryMatchesRequiredType ? 1 : 0.7;
    reasons.push(primaryMatchesRequiredType ? 'primary type matched required type' : 'type list matched subgroup anchor');
  } else if (!hasTypeAnchors) {
    typeScore = 0.4;
    reasons.push('no type anchors; using keyword-led verification');
  }

  let conflictPenalty = 0;
  if (profile.forbiddenPrimaryTypes?.some((type) => primaryType === type.toLowerCase())) {
    conflictPenalty = 1;
    reasons.push('forbidden primary type for subgroup');
  } else {
    const negativeText = `${name} ${summary}`;
    const negativeHits = (profile.negativeKeywords ?? []).filter((keyword) => negativeText.includes(keyword.toLowerCase()));
    if (negativeHits.length > 0) {
      conflictPenalty = Math.min(0.7, 0.3 + (negativeHits.length - 1) * 0.2);
      reasons.push(`negative keywords: ${negativeHits.slice(0, 2).join(', ')}`);
    }
  }

  const nameKeywords = scoreKeywordMatches(name, profile.positiveNameKeywords);
  const summaryKeywords = scoreKeywordMatches(summary, profile.positiveSummaryKeywords);
  const keywordScore = clamp(nameKeywords.score * 0.6 + summaryKeywords.score * 0.4);
  if (nameKeywords.hits.length > 0 || summaryKeywords.hits.length > 0) {
    reasons.push('keyword evidence from name/summary');
  }

  let reviewScore = 0;
  const reviewKeywords = profile.positiveReviewKeywords ?? profile.positiveSummaryKeywords ?? profile.positiveNameKeywords ?? [];
  if (reviewKeywords.length > 0 && reviewsText.length > 0) {
    const reviewMatches = scoreKeywordMatches(reviewsText, reviewKeywords);
    reviewScore = reviewMatches.score;
    if (reviewMatches.hits.length > 0) {
      reasons.push('review snippet evidence');
    }
  }

  return {
    typeScore,
    keywordScore,
    reviewScore,
    conflictPenalty,
    reasons: reasons.slice(0, 5),
  };
}

function computeConfidence(evidence: VerificationEvidence): number {
  return clamp(0.45 * evidence.typeScore + 0.3 * evidence.keywordScore + 0.25 * evidence.reviewScore - evidence.conflictPenalty);
}

export function verifySubgroupCandidate(
  targetSubgroup: string,
  placeDetails: VerifiablePlaceDetails,
  profiles: Record<string, SubgroupProfile> = PROFILES,
): VerificationResult {
  const targetProfile = profiles[targetSubgroup];
  if (!targetProfile) {
    return {
      accepted: false,
      confidence: 0,
      evidence: {
        typeScore: 0,
        keywordScore: 0,
        reviewScore: 0,
        conflictPenalty: 1,
        reasons: ['missing subgroup profile'],
      },
    };
  }

  const targetEvidence = computeProfileEvidence(targetProfile, placeDetails);
  const targetConfidence = computeConfidence(targetEvidence);

  let accepted = targetConfidence >= 0.7;
  if (targetProfile.familyId) {
    const familyMembers = FAMILY_GROUPS[targetProfile.familyId] ?? [targetSubgroup, ...(targetProfile.familyAlternatives ?? [])];
    const ranked = familyMembers
      .map((subgroup) => {
        const profile = profiles[subgroup];
        if (!profile) return { subgroup, confidence: -1 };
        return { subgroup, confidence: computeConfidence(computeProfileEvidence(profile, placeDetails)) };
      })
      .sort((a, b) => b.confidence - a.confidence);

    const top = ranked[0];
    const second = ranked[1] ?? { subgroup: 'NONE', confidence: 0 };
    const margin = top.confidence - second.confidence;
    const familyAccepted = top.subgroup === targetSubgroup && margin >= 0.15 && top.confidence >= 0.7;
    accepted = accepted && familyAccepted;

    targetEvidence.reasons = [...targetEvidence.reasons, `family winner ${top.subgroup} (${top.confidence.toFixed(2)})`, `family margin ${margin.toFixed(2)}`].slice(0, 5);
  }

  return {
    accepted,
    confidence: targetConfidence,
    evidence: targetEvidence,
  };
}

export function verifyCoreCandidate(
  targetCore: CoreGroup,
  placeDetails: VerifiablePlaceDetails,
  coreAnchors: Record<CoreGroup, { requiredTypesAny: string[]; forbiddenPrimaryTypes: string[] }>,
): VerificationResult {
  const anchor = coreAnchors[targetCore];
  const profile: SubgroupProfile = {
    core: targetCore,
    subgroup: targetCore,
    retrievalMode: 'TYPE',
    requiredTypesAny: anchor.requiredTypesAny,
    forbiddenPrimaryTypes: anchor.forbiddenPrimaryTypes,
  };
  const evidence = computeProfileEvidence(profile, placeDetails);
  if (evidence.typeScore === 0.7) {
    evidence.typeScore = 1;
    evidence.reasons = [...evidence.reasons, 'core type anchor matched'].slice(0, 5);
  }
  const confidence = computeConfidence(evidence);
  const coreAnchorPass = evidence.typeScore > 0 && evidence.conflictPenalty < 1;

  return {
    accepted: coreAnchorPass && confidence >= 0.55,
    confidence,
    evidence,
  };
}
