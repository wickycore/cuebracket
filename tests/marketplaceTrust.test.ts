import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration=readFileSync("supabase/migrations/20260907092000_marketplace_trust_retention.sql","utf8");
const directory=readFileSync("components/MarketplaceDirectory.tsx","utf8");
const detail=readFileSync("app/marketplace/[id]/page.tsx","utf8");
const profile=readFileSync("app/players/[username]/page.tsx","utf8");
const pushPolicy=readFileSync("supabase/functions/push-notifications/policy.ts","utf8");

test("marketplace reviews require a prior buyer thread and remain one per listing",()=>{
  assert.match(migration,/unique \(listing_id, buyer_user_id\)/);
  assert.match(migration,/exists \([\s\S]*from public\.marketplace_threads/);
  assert.match(migration,/Sellers cannot review themselves/);
  assert.match(migration,/refresh_marketplace_seller_rating/);
});

test("saved listings are private and emit price-drop and restock alerts",()=>{
  assert.match(migration,/primary key \(user_id, listing_id\)/);
  assert.match(migration,/Users read their saved listings/);
  assert.match(migration,/new\.price < old\.price/);
  assert.match(migration,/old\.status = 'sold_out' and new\.status = 'active'/);
  assert.match(pushPolicy,/marketplace_price_drop/);
});

test("marketplace discovery supports requested sorts and related listings",()=>{
  for(const value of ["newest","price_low","price_high","most_sold"])assert.match(directory,new RegExp(value));
  assert.match(detail,/Similar listings/);
  assert.match(detail,/\.eq\("category",listing\.category\)/);
  assert.match(detail,/\.limit\(4\)/);
  assert.match(profile,/Marketplace listings/);
  assert.match(profile,/What buyers say/);
});
