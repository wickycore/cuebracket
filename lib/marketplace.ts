export const MARKETPLACE_CATEGORIES = [
  ["cue", "Cues"], ["case", "Cases"], ["chalk", "Chalk"], ["gloves", "Gloves"],
  ["table_felt", "Table felt"], ["balls", "Balls"], ["rack", "Racks"],
  ["tips_ferrules", "Tips & ferrules"], ["apparel", "Apparel"],
  ["maintenance", "Maintenance"], ["table", "Tables"], ["other", "Other"],
] as const;
export const MARKETPLACE_CONDITIONS = [["new", "New"], ["like_new", "Like new"], ["used", "Used"]] as const;
export type MarketplaceCategory = typeof MARKETPLACE_CATEGORIES[number][0];
export type MarketplaceCondition = typeof MARKETPLACE_CONDITIONS[number][0];
export type MarketplaceStatus = "active" | "sold_out" | "removed";

export interface MarketplaceListing {
  id: string; seller_user_id: string; title: string; description: string;
  category: MarketplaceCategory; condition: MarketplaceCondition; price: number;
  currency: string; quantity_total: number; quantity_sold: number; location: string;
  photos: string[]; club_id: string | null; status: MarketplaceStatus;
  created_at: string; updated_at: string;
  club?: { name: string; slug: string; is_verified: boolean } | null;
  seller?: { display_name: string; username: string | null; avatar_url: string | null; seller_avg_rating: number; seller_review_count: number } | null;
}

export interface MarketplaceReview { id:string; listing_id:string; seller_user_id:string; buyer_user_id:string; rating:number; comment:string|null; removal_requested_at:string|null; created_at:string; buyer?:{display_name:string;username:string|null}|null }

export function availableQuantity(listing: Pick<MarketplaceListing, "quantity_total" | "quantity_sold">) {
  return Math.max(0, listing.quantity_total - listing.quantity_sold);
}
export function marketplaceAvailability(listing: Pick<MarketplaceListing, "quantity_total" | "quantity_sold">) {
  return `${availableQuantity(listing)} available · ${listing.quantity_sold} sold`;
}
export function formatMarketplacePrice(price: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: price % 1 ? 2 : 0 }).format(price);
}
export function marketplaceLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
export function isMarketplaceStale(updatedAt: string, now = Date.now()) {
  return now - new Date(updatedAt).getTime() >= 30 * 86_400_000;
}
