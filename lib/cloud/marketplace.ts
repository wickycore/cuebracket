"use client";
import { createClient } from "@/lib/supabase/client";
import { validateImageFile } from "@/lib/cloud/media";
import type { MarketplaceCategory, MarketplaceCondition } from "@/lib/marketplace";

export interface ListingInput { title:string; description:string; category:MarketplaceCategory; condition:MarketplaceCondition; price:number; currency:string; quantityTotal:number; location:string; clubId:string|null; }

export async function createMarketplaceListing(input: ListingInput, photos: File[]) {
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("Sign in before publishing a listing.");
  if(photos.length>5) throw new Error("Add no more than 5 photos.");
  for(const photo of photos){ const problem=validateImageFile(photo); if(problem) throw new Error(problem); }
  const {data,error}=await supabase.from("marketplace_listings").insert({title:input.title,description:input.description,category:input.category,condition:input.condition,price:input.price,currency:input.currency,quantity_total:input.quantityTotal,location:input.location,club_id:input.clubId}).select("id").single();
  if(error) throw error;
  const urls:string[]=[];
  for(const photo of photos){
    const ext=photo.type==="image/png"?"png":photo.type==="image/webp"?"webp":"jpg";
    const path=`${user.id}/${data.id}/${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("marketplace-photos").upload(path,photo,{cacheControl:"31536000",contentType:photo.type});
    if(uploadError) throw uploadError;
    urls.push(supabase.storage.from("marketplace-photos").getPublicUrl(path).data.publicUrl);
  }
  if(urls.length){ const {error:updateError}=await supabase.from("marketplace_listings").update({photos:urls}).eq("id",data.id); if(updateError) throw updateError; }
  return data.id as string;
}
export async function incrementListingSold(id:string){ const supabase=createClient(); const {data,error}=await supabase.from("marketplace_listings").select("quantity_sold,quantity_total").eq("id",id).single(); if(error) throw error; if(data.quantity_sold>=data.quantity_total) return; const result=await supabase.from("marketplace_listings").update({quantity_sold:data.quantity_sold+1}).eq("id",id); if(result.error) throw result.error; }
export async function updateListingStatus(id:string,status:"active"|"removed"){ const {error}=await createClient().from("marketplace_listings").update({status}).eq("id",id); if(error) throw error; }
export async function reportMarketplaceListing(id:string,category:string,details:string){ const {error}=await createClient().from("marketplace_listing_reports").insert({listing_id:id,category,details}); if(error) throw error; }
export async function openListingThread(listingId:string, body:string){
  const supabase=createClient(); const {data:existing}=await supabase.from("marketplace_threads").select("id").eq("listing_id",listingId).maybeSingle();
  let threadId=existing?.id as string|undefined;
  if(!threadId){ const {data,error}=await supabase.from("marketplace_threads").insert({listing_id:listingId}).select("id").single(); if(error) throw error; threadId=data.id; }
  const {error}=await supabase.from("marketplace_messages").insert({thread_id:threadId,body}); if(error) throw error;
  return threadId;
}
export async function sendMarketplaceMessage(threadId:string,body:string){ const {error}=await createClient().from("marketplace_messages").insert({thread_id:threadId,body}); if(error) throw error; }
export async function toggleSavedListing(listingId:string,save:boolean){const supabase=createClient();const {error}=save?await supabase.from("marketplace_saved_listings").insert({listing_id:listingId}):await supabase.from("marketplace_saved_listings").delete().eq("listing_id",listingId);if(error)throw error;}
export async function submitMarketplaceReview(listingId:string,rating:number,comment:string){const {error}=await createClient().from("marketplace_reviews").insert({listing_id:listingId,rating,comment:comment.trim()||null});if(error)throw error;}
export async function requestMarketplaceReviewRemoval(reviewId:string){const {error}=await createClient().from("marketplace_review_removal_requests").insert({review_id:reviewId,reason:"Submitted in error"});if(error)throw error;}
export async function resolveMarketplaceReviewRemoval(requestId:string,resolution:"approved"|"dismissed"){const {error}=await createClient().rpc("resolve_marketplace_review_removal",{request_id:requestId,resolution_value:resolution});if(error)throw error;}
export async function resolveMarketplaceListingReport(reportId:string,status:"reviewed"|"dismissed"){const {error}=await createClient().from("marketplace_listing_reports").update({status,updated_at:new Date().toISOString()}).eq("id",reportId);if(error)throw error;}
