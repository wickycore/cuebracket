import { redirect } from "next/navigation";
/* eslint-disable @next/next/no-html-link-for-pages */
import { AppHeader } from "@/components/AppHeader";
import { MarketplaceListingForm } from "@/components/MarketplaceListingForm";
import { createClient } from "@/lib/supabase/server";
export const metadata={title:"List an item · CueBracket Marketplace"};
export default async function NewListingPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/login?next=/marketplace/new");const {data:memberships}=await supabase.from("club_members").select("club_id,clubs(id,name)").eq("user_id",user.id);const clubs=(memberships??[]).flatMap(row=>{const club=Array.isArray(row.clubs)?row.clubs[0]:row.clubs;return club?[club]:[]}) as {id:string;name:string}[];return <main className="min-h-dvh bg-[#0a1628] text-white"><AppHeader/><div className="px-4 py-8"><div className="mx-auto mb-5 max-w-2xl"><a href="/marketplace" className="text-sm font-bold text-[#7fc9ff]">← Marketplace</a><h1 className="mt-3 text-3xl font-black">List an item</h1><p className="mt-2 text-sm text-[#9db4d1]">Add honest details and up to five clear photos.</p></div><MarketplaceListingForm clubs={clubs}/></div></main>}
