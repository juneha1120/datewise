export type User = {
  id: string;
  email: string;
  displayName: string;
  profileImage: string | null;
  password?: string;
  provider: 'EMAIL' | 'GOOGLE';
};

export type ItinerarySlot = {
  slotIndex: number;
  selection: string;
  slotType?: string;
  placeName: string;
  place?: {
    name: string;
    placeId: string;
    latitude: number;
    longitude: number;
    address: string;
    rating?: number;
  };
  subgroup: string;
  travelMinutes: number;
  startOffsetMin: number;
  durationMin: number;
  arrivalTime?: string;
  departureTime?: string;
  lat: number;
  lng: number;
};

export type ItineraryRecord = {
  id: string;
  userId: string;
  title: string;
  isPublic: boolean;
  inputJson: string;
  edited: boolean;
  sourceId: string | null;
  slots: ItinerarySlot[];
  createdAt: string;
};

export type SavedRecord = {
  id: string;
  userId: string;
  sourceItineraryId: string;
  snapshot: ItineraryRecord;
  sourceUserId: string;
  createdAt: string;
};

export const db = {
  users: new Map<string, User>(),
  itineraries: new Map<string, ItineraryRecord>(),
  saved: new Map<string, SavedRecord>(),
};
