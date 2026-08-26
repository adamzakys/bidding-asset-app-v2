// Supabase Edge Function: send-email
// Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Received database webhook payload:", payload);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (payload.type === "INSERT" && payload.table === "bids") {
      const newBid = payload.record;
      const assetId = newBid.asset_id;

      // 1. Fetch Asset Details
      const { data: asset, error: assetErr } = await supabaseAdmin
        .from("assets")
        .select("nama_aset")
        .eq("id", assetId)
        .single();

      if (assetErr) throw assetErr;

      // 2. Fetch New Bidder Details
      const { data: bidder, error: bidderErr } = await supabaseAdmin
        .from("profiles")
        .select("email, nama_lengkap")
        .eq("id", newBid.user_id)
        .single();

      if (bidderErr) throw bidderErr;

      // 3. Find the previous highest valid bidder to send outbid notification
      const { data: previousBids, error: prevErr } = await supabaseAdmin
        .from("bids")
        .select("user_id, nominal_bid")
        .eq("asset_id", assetId)
        .eq("status_bid", "VALID")
        .neq("user_id", newBid.user_id) // different user
        .order("nominal_bid", { ascending: false });

      if (prevErr) throw prevErr;

      const formatRupiah = (val: number) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(val);
      };

      if (RESEND_API_KEY) {
        // --- Email to New Bidder (Success Confirmation) ---
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: "BMS Auction Portal <onboarding@resend.dev>",
            to: [bidder.email],
            subject: `[BMS] Penawaran Sukses: ${asset.nama_aset}`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #6366f1;">Penawaran Anda Berhasil Diajukan</h2>
                <p>Halo <strong>${bidder.nama_lengkap}</strong>,</p>
                <p>Penawaran Anda untuk aset berikut telah sukses masuk ke sistem kami:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr style="background: #f9f9f9;">
                    <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Aset</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${asset.nama_aset}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Nominal Penawaran</td>
                    <td style="padding: 10px; font-weight: bold; color: #6366f1; border-bottom: 1px solid #ddd;">${formatRupiah(newBid.nominal_bid)}</td>
                  </tr>
                </table>
                <p style="font-size: 12px; color: #777;">Terima kasih atas partisipasi Anda.</p>
              </div>
            `
          })
        });

        // --- Email to Previous Outbid User (if exists) ---
        if (previousBids && previousBids.length > 0) {
          const outbidUserId = previousBids[0].user_id;

          const { data: outbidUser, error: outbidUserErr } = await supabaseAdmin
            .from("profiles")
            .select("email, nama_lengkap")
            .eq("id", outbidUserId)
            .single();

          if (!outbidUserErr && outbidUser) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_API_KEY}`
              },
              body: JSON.stringify({
                from: "BMS Auction Portal <onboarding@resend.dev>",
                to: [outbidUser.email],
                subject: `[BMS] Perhatian: Penawaran Anda Tersalip (${asset.nama_aset})`,
                html: `
                  <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #ef4444;">Penawaran Anda Tersalip</h2>
                    <p>Halo <strong>${outbidUser.nama_lengkap}</strong>,</p>
                    <p>Kami ingin menginformasikan bahwa penawaran Anda untuk aset <strong>${asset.nama_aset}</strong> baru saja tersalip oleh penawar lain.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                      <tr style="background: #f9f9f9;">
                        <td style="padding: 10px; font-weight: bold; border-bottom: 1px solid #ddd;">Penawaran Baru Terkini</td>
                        <td style="padding: 10px; font-weight: bold; color: #ef4444; border-bottom: 1px solid #ddd;">${formatRupiah(newBid.nominal_bid)}</td>
                      </tr>
                    </table>
                    <p>Silakan masuk ke portal BMS untuk mengajukan penawaran baru jika Anda masih berminat dengan aset tersebut.</p>
                    <p style="font-size: 12px; color: #777;">Sistem Bidding Management System - PT. Berlian Manyar Sejahtera.</p>
                  </div>
                `
              })
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in Edge Function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
