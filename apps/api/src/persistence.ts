import { PrismaClient, type Itinerary as PrismaItinerary, type ItinerarySlot as PrismaItinerarySlot, type SavedItinerary as PrismaSavedItinerary, type User as PrismaUser } from '@prisma/client';
import { DURATION_BY_CORE, type GenerateItineraryInput, type ItineraryRecord, type ItinerarySlot, resolveCore, type SlotType } from '@datewise/shared';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

type ItineraryRow = PrismaItinerary & { slots: PrismaItinerarySlot[] };
type SavedRow = PrismaSavedItinerary & { itinerary: ItineraryRow };

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function mapAuthUser(user: PrismaUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    profileImage: user.profileImage,
  };
}

export function buildItineraryTitle(input: GenerateItineraryInput) {
  return `${input.startPoint.name} - ${input.date} ${input.time}`;
}

export function serializeSlots(input: GenerateItineraryInput, result: ItinerarySlot[]) {
  const baseDateTime = combineDateTime(input.date, input.time);

  return result.map((slot) => {
    const arrival = new Date(slot.arrivalTime);
    const departure = new Date(slot.departureTime);
    const startOffsetMin = Math.round((arrival.getTime() - baseDateTime.getTime()) / 60_000);
    const durationMin = Math.round((departure.getTime() - arrival.getTime()) / 60_000);

    return {
      slotIndex: slot.slotIndex,
      selection: slot.slotType,
      subgroup: slot.subgroup,
      placeName: slot.place.name,
      travelMinutes: slot.travelMinutes,
      startOffsetMin,
      durationMin,
      metadataJson: JSON.stringify({
        place: slot.place,
      }),
    };
  });
}

export function mapItineraryRecord(row: ItineraryRow): ItineraryRecord {
  const input = parseJson<GenerateItineraryInput>(row.inputJson);
  const baseDateTime = combineDateTime(input.date, input.time);
  const result = [...row.slots]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((slot) => {
      const metadata = parseJson<{ place: ItinerarySlot['place'] }>(slot.metadataJson);
      const arrival = addMinutes(baseDateTime, slot.startOffsetMin);
      const departure = addMinutes(arrival, slot.durationMin || DURATION_BY_CORE[resolveCore(slot.selection as SlotType)]);

      return {
        slotIndex: slot.slotIndex,
        slotType: slot.selection as SlotType,
        subgroup: slot.subgroup,
        travelMinutes: slot.travelMinutes,
        arrivalTime: arrival.toISOString(),
        departureTime: departure.toISOString(),
        place: metadata.place,
      } satisfies ItinerarySlot;
    });

  return {
    id: row.id,
    userId: row.userId,
    input,
    result,
    isPublic: row.isPublic,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editedAfterGeneration: row.edited,
    sourceItineraryId: row.sourceId,
  };
}

export function mapSavedRecord(row: SavedRow) {
  return {
    id: row.id,
    userId: row.userId,
    sourceItineraryId: row.itineraryId,
    sourceUserId: row.sourceUserId ?? row.itinerary.userId,
    snapshot: parseJson<ItineraryRecord>(row.snapshotJson),
    createdAt: row.createdAt.toISOString(),
  };
}
