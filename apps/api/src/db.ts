import type { GenerateItineraryInput, ItineraryRecord, ItinerarySlot } from '@datewise/shared';
export { prisma } from './persistence';

export type User = {
  id: string;
  email: string;
  displayName: string;
  profileImage: string | null;
  password?: string;
  provider: 'EMAIL' | 'GOOGLE';
};

export type SavedRecord = {
  id: string;
  userId: string;
  sourceItineraryId: string;
  sourceUserId: string;
  snapshot: ItineraryRecord;
  createdAt: string;
};

export type PersistedItinerary = ItineraryRecord & {
  input: GenerateItineraryInput;
  result: ItinerarySlot[];
};

export const db = {
  users: new Map<string, User>(),
  itineraries: new Map<string, PersistedItinerary>(),
  saved: new Map<string, SavedRecord>(),
};
