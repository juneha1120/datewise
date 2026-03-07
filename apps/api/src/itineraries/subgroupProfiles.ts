import { CoreGroup, Subgroup } from '@datewise/shared';

export type RetrievalMode = 'TEXT' | 'TYPE' | 'HYBRID';

export type SubgroupProfile = {
  core: 'EAT' | 'DO' | 'SIP';
  subgroup: string;
  retrievalMode: RetrievalMode;
  textQueries?: string[];
  googleTypes?: string[];
  requiredPrimaryTypesAny?: string[];
  requiredTypesAny?: string[];
  forbiddenPrimaryTypes?: string[];
  positiveNameKeywords?: string[];
  positiveSummaryKeywords?: string[];
  positiveReviewKeywords?: string[];
  negativeKeywords?: string[];
  familyId?: string;
  familyAlternatives?: string[];
};

const EAT_FORBIDDEN = ['shopping_mall', 'department_store', 'tourist_attraction', 'lodging', 'supermarket', 'grocery_store'];
const SIP_FORBIDDEN = ['shopping_mall', 'department_store', 'tourist_attraction', 'lodging'];
const EAT_NEGATIVE = ['fast food', 'burger', 'fried chicken', 'food court'];

export const CORE_ANCHORS: Record<CoreGroup, { requiredTypesAny: string[]; forbiddenPrimaryTypes: string[] }> = {
  EAT: { requiredTypesAny: ['restaurant'], forbiddenPrimaryTypes: EAT_FORBIDDEN },
  SIP: { requiredTypesAny: ['cafe', 'bar'], forbiddenPrimaryTypes: SIP_FORBIDDEN },
  DO: {
    requiredTypesAny: ['tourist_attraction', 'museum', 'park', 'movie_theater', 'art_gallery', 'shopping_mall', 'amusement_center'],
    forbiddenPrimaryTypes: ['lodging', 'airport', 'train_station', 'bus_station'],
  },
};

export const FAMILY_GROUPS: Record<string, string[]> = {
  SIP_ALCOHOL: ['COCKTAIL', 'WINE', 'BEER', 'SPIRIT'],
  SIP_TEA: ['BUBBLE_TEA', 'TEA_HOUSE'],
};

function eatProfile(subgroup: Subgroup, textQueries: string[], positiveNameKeywords: string[], positiveReviewKeywords?: string[]): SubgroupProfile {
  return {
    core: 'EAT',
    subgroup,
    retrievalMode: 'TEXT',
    textQueries,
    requiredTypesAny: ['restaurant'],
    forbiddenPrimaryTypes: EAT_FORBIDDEN,
    positiveNameKeywords,
    positiveSummaryKeywords: positiveNameKeywords,
    positiveReviewKeywords: positiveReviewKeywords ?? positiveNameKeywords,
    negativeKeywords: EAT_NEGATIVE,
  };
}

export const PROFILES: Record<string, SubgroupProfile> = {
  JAPANESE: eatProfile('JAPANESE', ['japanese restaurant', 'sushi', 'ramen', 'izakaya', 'yakitori'], ['sushi', 'ramen', 'izakaya', 'yakitori', 'udon', 'sashimi', 'donburi', 'omakase'], ['sushi', 'ramen', 'izakaya', 'yakitori', 'udon']),
  KOREAN: eatProfile('KOREAN', ['korean restaurant', 'kbbq', 'korean bbq', 'samgyupsal', 'soju'], ['korean', 'kbbq', 'bbq', 'samgyupsal', 'galbi', 'kimchi', 'soju', 'tteokbokki'], ['samgyupsal', 'galbi', 'kimchi', 'soju', 'kbbq']),
  CHINESE: eatProfile('CHINESE', ['chinese restaurant', 'dim sum', 'hotpot', 'mala'], ['chinese', 'dim sum', 'hotpot', 'mala', 'xiaolongbao']),
  THAI: eatProfile('THAI', ['thai restaurant', 'tom yum', 'pad thai'], ['thai', 'tom yum', 'pad thai', 'som tam']),
  WESTERN: eatProfile('WESTERN', ['western restaurant', 'steakhouse', 'grill restaurant'], ['steak', 'grill', 'western']),
  ITALIAN: eatProfile('ITALIAN', ['italian restaurant', 'pasta', 'pizza'], ['italian', 'pasta', 'pizza', 'trattoria']),
  INDIAN: eatProfile('INDIAN', ['indian restaurant', 'biryani', 'tandoori'], ['indian', 'biryani', 'tandoori', 'naan', 'curry']),
  MALAY: eatProfile('MALAY', ['malay restaurant', 'nasi lemak', 'mee rebus'], ['malay', 'nasi lemak', 'mee rebus', 'satay']),
  INDONESIAN: eatProfile('INDONESIAN', ['indonesian restaurant', 'nasi padang', 'ayam penyet'], ['indonesian', 'nasi padang', 'ayam penyet', 'rendang']),
  VIETNAMESE: eatProfile('VIETNAMESE', ['vietnamese restaurant', 'pho', 'banh mi'], ['pho', 'banh mi', 'vietnamese']),
  MIDDLE_EASTERN: eatProfile('MIDDLE_EASTERN', ['middle eastern restaurant', 'shawarma', 'kebab'], ['shawarma', 'kebab', 'middle eastern', 'hummus']),
  SEAFOOD: eatProfile('SEAFOOD', ['seafood restaurant', 'crab seafood', 'fish soup'], ['seafood', 'crab', 'prawn', 'fish']),
  LOCAL: eatProfile('LOCAL', ['local singapore restaurant', 'peranakan restaurant', 'singaporean restaurant'], ['peranakan', 'singaporean', 'local']),
  HAWKER: {
    core: 'EAT', subgroup: 'HAWKER', retrievalMode: 'TEXT', textQueries: ['hawker centre', 'food centre', 'hawker food'], requiredTypesAny: ['food_court', 'restaurant'], forbiddenPrimaryTypes: EAT_FORBIDDEN,
    positiveNameKeywords: ['hawker', 'food centre', 'food center'], positiveSummaryKeywords: ['hawker', 'food centre', 'food center'], positiveReviewKeywords: ['hawker', 'food centre'], negativeKeywords: EAT_NEGATIVE,
  },
  MUSEUM: { core: 'DO', subgroup: 'MUSEUM', retrievalMode: 'TYPE', googleTypes: ['museum'], requiredTypesAny: ['museum'], forbiddenPrimaryTypes: ['shopping_mall', 'restaurant'] },
  GALLERY: { core: 'DO', subgroup: 'GALLERY', retrievalMode: 'TYPE', googleTypes: ['art_gallery'], requiredTypesAny: ['art_gallery'] },
  EXHIBITION: { core: 'DO', subgroup: 'EXHIBITION', retrievalMode: 'TEXT', textQueries: ['exhibition', 'art exhibition', 'museum exhibition'], positiveNameKeywords: ['exhibition'], positiveSummaryKeywords: ['exhibition'] },
  SHOPPING: { core: 'DO', subgroup: 'SHOPPING', retrievalMode: 'TYPE', googleTypes: ['shopping_mall'], requiredTypesAny: ['shopping_mall'] },
  WELLNESS: { core: 'DO', subgroup: 'WELLNESS', retrievalMode: 'TEXT', textQueries: ['spa', 'massage', 'wellness'], positiveNameKeywords: ['spa', 'massage'], positiveSummaryKeywords: ['spa', 'massage'] },
  CINEMA: { core: 'DO', subgroup: 'CINEMA', retrievalMode: 'TYPE', googleTypes: ['movie_theater'], requiredTypesAny: ['movie_theater'] },
  CLASSES: { core: 'DO', subgroup: 'CLASSES', retrievalMode: 'TEXT', textQueries: ['workshop class', 'pottery class', 'cooking class', 'art workshop'], positiveNameKeywords: ['workshop', 'class', 'studio'], positiveSummaryKeywords: ['workshop', 'class', 'studio'] },
  WALK_IN_PARK: { core: 'DO', subgroup: 'WALK_IN_PARK', retrievalMode: 'TYPE', googleTypes: ['park'], requiredTypesAny: ['park'] },
  SCENIC_WALK: { core: 'DO', subgroup: 'SCENIC_WALK', retrievalMode: 'TEXT', textQueries: ['waterfront walk', 'boardwalk', 'promenade', 'viewpoint'], positiveNameKeywords: ['promenade', 'boardwalk', 'waterfront', 'lookout', 'viewpoint'], positiveSummaryKeywords: ['promenade', 'boardwalk', 'waterfront', 'lookout', 'viewpoint'] },
  ARCADE: { core: 'DO', subgroup: 'ARCADE', retrievalMode: 'TEXT', textQueries: ['arcade', 'amusement centre', 'amusement center'], positiveNameKeywords: ['arcade', 'amusement'], positiveSummaryKeywords: ['arcade', 'amusement'] },
  BOWLING: { core: 'DO', subgroup: 'BOWLING', retrievalMode: 'TEXT', textQueries: ['bowling'], positiveNameKeywords: ['bowling'], positiveSummaryKeywords: ['bowling'] },
  KARAOKE: { core: 'DO', subgroup: 'KARAOKE', retrievalMode: 'TEXT', textQueries: ['karaoke', 'ktv'], positiveNameKeywords: ['karaoke', 'ktv'], positiveSummaryKeywords: ['karaoke', 'ktv'] },
  ESCAPE_ROOM: { core: 'DO', subgroup: 'ESCAPE_ROOM', retrievalMode: 'TEXT', textQueries: ['escape room'], positiveNameKeywords: ['escape room'], positiveSummaryKeywords: ['escape room'] },
  INDOOR_SPORTS: { core: 'DO', subgroup: 'INDOOR_SPORTS', retrievalMode: 'TEXT', textQueries: ['indoor sports', 'climbing gym', 'bouldering', 'ice skating'], positiveNameKeywords: ['climb', 'boulder', 'skating', 'sports'], positiveSummaryKeywords: ['climb', 'boulder', 'skating', 'sports'] },
  OUTDOOR_ACTIVITY: { core: 'DO', subgroup: 'OUTDOOR_ACTIVITY', retrievalMode: 'TEXT', textQueries: ['kayaking', 'cycling rental', 'hiking trail'], positiveNameKeywords: ['kayak', 'cycling', 'hike', 'trail'], positiveSummaryKeywords: ['kayak', 'cycling', 'hike', 'trail'] },
  ATTRACTION: { core: 'DO', subgroup: 'ATTRACTION', retrievalMode: 'TYPE', googleTypes: ['tourist_attraction'], requiredTypesAny: ['tourist_attraction'] },
  COFFEE: { core: 'SIP', subgroup: 'COFFEE', retrievalMode: 'TYPE', googleTypes: ['cafe'], requiredTypesAny: ['cafe'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['coffee', 'espresso', 'roastery', 'cafe'], positiveSummaryKeywords: ['coffee', 'espresso', 'roastery', 'cafe'] },
  DESSERT: { core: 'SIP', subgroup: 'DESSERT', retrievalMode: 'TEXT', textQueries: ['dessert cafe', 'ice cream', 'cakes'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['dessert', 'ice cream', 'gelato', 'cake', 'waffle'], positiveSummaryKeywords: ['dessert', 'ice cream', 'gelato', 'cake', 'waffle'] },
  BUBBLE_TEA: { core: 'SIP', subgroup: 'BUBBLE_TEA', retrievalMode: 'TEXT', textQueries: ['bubble tea', 'boba'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['bubble tea', 'boba'], positiveSummaryKeywords: ['bubble tea', 'boba'], familyId: 'SIP_TEA', familyAlternatives: ['TEA_HOUSE'] },
  TEA_HOUSE: { core: 'SIP', subgroup: 'TEA_HOUSE', retrievalMode: 'TEXT', textQueries: ['tea house', 'teahouse', 'matcha cafe'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['tea house', 'teahouse', 'matcha', 'tea'], positiveSummaryKeywords: ['tea house', 'teahouse', 'matcha', 'tea'], familyId: 'SIP_TEA', familyAlternatives: ['BUBBLE_TEA'] },
  COCKTAIL: { core: 'SIP', subgroup: 'COCKTAIL', retrievalMode: 'TYPE', googleTypes: ['bar'], requiredTypesAny: ['bar'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['cocktail'], positiveSummaryKeywords: ['cocktail'], positiveReviewKeywords: ['cocktail'], familyId: 'SIP_ALCOHOL', familyAlternatives: ['WINE', 'BEER', 'SPIRIT'] },
  WINE: { core: 'SIP', subgroup: 'WINE', retrievalMode: 'TEXT', textQueries: ['wine bar'], requiredTypesAny: ['bar'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['wine'], positiveSummaryKeywords: ['wine'], positiveReviewKeywords: ['wine'], familyId: 'SIP_ALCOHOL', familyAlternatives: ['COCKTAIL', 'BEER', 'SPIRIT'] },
  BEER: { core: 'SIP', subgroup: 'BEER', retrievalMode: 'TEXT', textQueries: ['craft beer', 'beer bar'], requiredTypesAny: ['bar'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['beer', 'craft'], positiveSummaryKeywords: ['beer', 'craft'], familyId: 'SIP_ALCOHOL', familyAlternatives: ['COCKTAIL', 'WINE', 'SPIRIT'] },
  SPIRIT: { core: 'SIP', subgroup: 'SPIRIT', retrievalMode: 'TEXT', textQueries: ['whisky bar', 'whiskey bar', 'sake bar', 'gin bar'], requiredTypesAny: ['bar'], forbiddenPrimaryTypes: SIP_FORBIDDEN, positiveNameKeywords: ['whisky', 'whiskey', 'sake', 'gin', 'spirits'], positiveSummaryKeywords: ['whisky', 'whiskey', 'sake', 'gin', 'spirits'], familyId: 'SIP_ALCOHOL', familyAlternatives: ['COCKTAIL', 'WINE', 'BEER'] },
};
