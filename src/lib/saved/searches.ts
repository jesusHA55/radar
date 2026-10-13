import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { savedSearches } from "@/db/schema";

export type SavedSearch = typeof savedSearches.$inferSelect;

export const SAVED_KINDS = ["search", "explore", "meet"] as const;
export type SavedKind = (typeof SAVED_KINDS)[number];

export const SAVED_KIND_LABELS: Record<SavedKind, string> = {
  search: "Route search",
  explore: "Explore",
  meet: "Meet",
};

export function isSavedKind(value: string): value is SavedKind {
  return (SAVED_KINDS as readonly string[]).includes(value);
}

export async function listSavedSearches(ownerId: string): Promise<SavedSearch[]> {
  return db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.ownerId, ownerId))
    .orderBy(desc(savedSearches.createdAt));
}

export async function createSavedSearch(input: {
  ownerId: string;
  kind: SavedKind;
  label: string;
  href: string;
}): Promise<SavedSearch> {
  const [row] = await db.insert(savedSearches).values(input).returning();
  return row;
}

export async function deleteSavedSearch(ownerId: string, id: string): Promise<void> {
  await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.ownerId, ownerId)));
}
