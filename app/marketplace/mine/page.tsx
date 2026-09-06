import { redirect } from "next/navigation";
/* eslint-disable @next/next/no-html-link-for-pages */
import { AppHeader } from "@/components/AppHeader";
import { MarketplaceMine } from "@/components/MarketplaceMine";
import { createClient } from "@/lib/supabase/server";
import type { MarketplaceListing } from "@/lib/marketplace";
export const metadata={title:"My listings · CueBracket Marketplace"};
export default async function MinePage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/auth/login?next=/marketplace/mine");const {data}=await supabase.from("marketplace_listings").select("*").eq("seller_user_id",user.id).order("updated_at",{ascending:false});return <main className="min-h-dvh bg-[#0a1628] text-white"><AppHeader/><div className="mx-auto max-w-4xl px-4 py-8"><div className="flex items-end justify-between gap-4"><div><a href="/marketplace" className="text-sm font-bold text-[#7fc9ff]">← Marketplace</a><h1 className="mt-3 text-3xl font-black">My listings</h1><p className="mt-2 text-sm text-[#9db4d1]">Track stock, confirm older listings and keep sold gear visible.</p></div><a href="/marketplace/new" className="rounded-[10px] bg-[#1d9e75] px-4 py-3 text-sm font-black text-[#04342c]">+ List an item</a></div><div className="mt-6"><MarketplaceMine initial={(data??[]) as MarketplaceListing[]}/></div></div></main>}
