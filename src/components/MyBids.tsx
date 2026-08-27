import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ShoppingBag, CheckCircle, Ban, Hourglass, Gavel, Clock, User } from 'lucide-react';

interface MyBidsProps {
  userId: string;
}

interface UserBidRow {
  bid_id: string;
  bid_time: string;
  asset_name: string;
  nominal_bid: number;
  status_bid: string;
  status_lelang: string;
  waktu_selesai: string;
  highest_bid_on_asset: number;
  winner_id: string | null;
}

export const MyBids: React.FC<MyBidsProps> = ({ userId }) => {
  const [bids, setBids] = useState<UserBidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, scheduled: 0, closed: 0, activeWithBids: 0, activeNoBids: 0 });
  const [totalUserBids, setTotalUserBids] = useState(0);

  useEffect(() => {
    fetchMyBids();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: assetsData, error } = await supabase
        .from('view_active_bids')
        .select('*');
      if (error) throw error;

      const { count: userBidsCount, error: countErr } = await supabase
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (countErr) throw countErr;

      setTotalUserBids(userBidsCount || 0);

      const total = assetsData?.length || 0;
      const nowTime = Date.now();
      const scheduled = assetsData ? assetsData.filter(a => new Date(a.waktu_selesai).getTime() > nowTime && new Date(a.waktu_selesai).getTime() - nowTime > 3 * 24 * 60 * 60 * 1000).length : 0;
      const closed = assetsData ? assetsData.filter(a => a.computed_status === 'CLOSED' || a.status_lelang === 'CLOSED').length : 0;
      const active = assetsData ? assetsData.filter(a => a.computed_status === 'OPEN' && a.status_lelang === 'OPEN').length : 0;
      const activeWithBids = assetsData ? assetsData.filter(a => a.computed_status === 'OPEN' && a.status_lelang === 'OPEN' && a.current_highest_bid > a.harga_buka).length : 0;
      const activeNoBids = active - activeWithBids;

      setStats({
        total,
        scheduled,
        closed,
        active,
        activeWithBids,
        activeNoBids
      });
    } catch (err) {
      console.error('Error fetching stats in MyBids:', err);
    }
  };

  const fetchMyBids = async () => {
    try {
      // Fetch user's bids along with asset details by joining public.bids and public.assets
      const { data, error } = await supabase
        .from('bids')
        .select(`
          id,
          created_at,
          nominal_bid,
          status_bid,
          assets (
            nama_aset,
            status_lelang,
            waktu_selesai
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform and fetch current highest bids for those assets
      const bidsFormatted: UserBidRow[] = [];

      if (data && data.length > 0) {
        // Fetch all view_active_bids to check current standings
        const { data: activeBids, error: viewError } = await supabase
          .from('view_active_bids')
          .select('asset_id, current_highest_bid, winner_id');

        const activeBidsMap = new Map<string, { current: number; winner: string | null }>();
        if (!viewError && activeBids) {
          activeBids.forEach((ab) => {
            activeBidsMap.set(ab.asset_id, { current: ab.current_highest_bid, winner: ab.winner_id });
          });
        }

        // Format data
        data.forEach((item: any) => {
          const assetInfo = item.assets;
          bidsFormatted.push({
            bid_id: item.id,
            bid_time: item.created_at,
            asset_name: assetInfo?.nama_aset || 'Aset Terhapus',
            nominal_bid: item.nominal_bid,
            status_bid: item.status_bid,
            status_lelang: assetInfo?.status_lelang || 'CLOSED',
            waktu_selesai: assetInfo?.waktu_selesai || '',
            highest_bid_on_asset: activeBidsMap.get(item.asset_id)?.current || item.nominal_bid,
            winner_id: activeBidsMap.get(item.asset_id)?.winner || null,
          });
        });
      }

      setBids(bidsFormatted);
    } catch (err: any) {
      console.error('Error fetching user bids:', err);
      setErrorMsg('Gagal memuat histori penawaran Anda.');
    } finally {
      setLoading(false);
    }
  };

  const getStandingBadge = (bid: UserBidRow) => {
    if (bid.status_bid === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-200/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider shadow-sm">
          <Ban size={10} /> Dibatalkan
        </span>
      );
    }
 
    const isLelangSelesai = new Date(bid.waktu_selesai).getTime() < Date.now() || bid.status_lelang === 'CLOSED';
 
    if (isLelangSelesai) {
      if (bid.winner_id === userId && bid.nominal_bid === bid.highest_bid_on_asset) {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider shadow-sm animate-pulse">
            <CheckCircle size={10} /> Menang Lelang
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-200/50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700/60 text-slate-500 dark:text-slate-450 uppercase tracking-wider shadow-sm">
            Selesai
          </span>
        );
      }
    }
 
    // Lelang masih jalan
    if (bid.nominal_bid === bid.highest_bid_on_asset) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-brand-500/10 border border-brand-500/20 text-brand-650 dark:text-brand-400 uppercase tracking-wider shadow-sm">
          <CheckCircle size={10} /> Bid Tertinggi
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 uppercase tracking-wider shadow-sm animate-pulse">
          <Hourglass size={10} /> Tersalip (Outbid)
        </span>
      );
    }
  };
 
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };
 
  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto mb-4" />
        <p className="text-sm font-semibold">Memuat Histori Penawaran...</p>
      </div>
    );
  }
 
  if (errorMsg) {
    return (
      <div className="py-12 text-center text-rose-500">
        <p className="text-sm font-semibold">{errorMsg}</p>
      </div>
    );
  }
 
  return (
    <div className="space-y-8 text-left">
      <div>
        <h2 className="text-2xl font-black text-slate-850 dark:text-white flex items-center gap-2.5 tracking-tight">
          <ShoppingBag className="text-brand-500" size={24} /> Riwayat Penawaran Saya
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-455 mt-1">Daftar semua aset yang telah Anda tawarkan sebelumnya</p>
      </div>

      {/* ─── STATISTICS PANEL ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 md:gap-5">
        {/* Total Aset */}
        <div className="neu-card p-3 md:p-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 md:gap-4">
          <div className="p-2 md:p-3 bg-brand-500/10 text-brand-500 rounded-xl flex-shrink-0"
            style={{ boxShadow: '3px 3px 7px var(--neu-shadow-dark), -3px -3px 7px var(--neu-shadow-light)' }}>
            <Gavel size={18} />
          </div>
          <div className="flex-grow w-full">
            <span className="block text-[8px] md:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Total Aset</span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1.5 mt-0.5">
              <span className="text-sm md:text-2xl font-extrabold text-slate-800 dark:text-white">{stats.total}</span>
              <span className="text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400">terdaftar</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Akan Datang: <strong className="text-slate-700 dark:text-slate-200">{stats.scheduled}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                Selesai: <strong className="text-slate-700 dark:text-slate-200">{stats.closed}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Lelang Aktif */}
        <div className="neu-card p-3 md:p-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 md:gap-4">
          <div className="p-2 md:p-3 bg-emerald-500/10 text-emerald-500 rounded-xl flex-shrink-0"
            style={{ boxShadow: '3px 3px 7px var(--neu-shadow-dark), -3px -3px 7px var(--neu-shadow-light)' }}>
            <Clock size={18} />
          </div>
          <div className="flex-grow w-full">
            <span className="block text-[8px] md:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Lelang Aktif</span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1.5 mt-0.5">
              <span className="text-sm md:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.active}</span>
              <span className="text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400">berjalan</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Ada Bid: <strong className="text-slate-700 dark:text-slate-200">{stats.activeWithBids}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Belum Ada: <strong className="text-slate-700 dark:text-slate-200">{stats.activeNoBids}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bid Anda */}
        <div className="neu-card p-3 md:p-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 md:gap-4">
          <div className="p-2 md:p-3 bg-amber-500/10 text-amber-500 rounded-xl flex-shrink-0"
            style={{ boxShadow: '3px 3px 7px var(--neu-shadow-dark), -3px -3px 7px var(--neu-shadow-light)' }}>
            <User size={18} />
          </div>
          <div className="flex-grow w-full">
            <span className="block text-[8px] md:text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Bid Anda</span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1.5 mt-0.5">
              <span className="text-sm md:text-2xl font-extrabold text-slate-800 dark:text-white">{totalUserBids}</span>
              <span className="text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400">diajukan</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 text-[8px] md:text-[9.5px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Real-time update
            </div>
          </div>
        </div>
      </div>
 
      {bids.length === 0 ? (
        <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[inset_3px_3px_6px_#c8cbd4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#0e141d,inset_-3px_-3px_6px_#2e3e59] rounded-3xl p-16 text-center">
          <ShoppingBag size={48} className="mx-auto text-slate-350 dark:text-slate-600 mb-4" />
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Anda belum pernah mengajukan penawaran lelang.</p>
        </div>
      ) : (
        <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-5 sm:p-8">
          {/* Table view for Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest bg-slate-100/40 dark:bg-slate-950/20">
                  <th className="py-4 px-6 rounded-l-2xl">Nama Aset</th>
                  <th className="py-4 px-6 text-right">Penawaran Anda</th>
                  <th className="py-4 px-6 text-right">Bid Tertinggi</th>
                  <th className="py-4 px-6 text-center">Status Standings</th>
                  <th className="py-4 px-6 rounded-r-2xl">Tanggal & Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-200">
                {bids.map((bid) => (
                  <tr key={bid.bid_id} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/20 transition-all">
                    <td className="py-4.5 px-6 font-bold text-slate-850 dark:text-white">{bid.asset_name}</td>
                    <td className="py-4.5 px-6 text-right font-bold text-brand-650 dark:text-brand-400">{formatRupiah(bid.nominal_bid)}</td>
                    <td className="py-4.5 px-6 text-right font-bold text-slate-800 dark:text-white">
                      {formatRupiah(bid.highest_bid_on_asset)}
                    </td>
                    <td className="py-4.5 px-6 text-center">{getStandingBadge(bid)}</td>
                    <td className="py-4.5 px-6 text-slate-500 dark:text-slate-450 font-medium">
                      {new Date(bid.bid_time).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list view for Mobile */}
          <div className="block md:hidden space-y-4">
            {bids.map((bid) => (
              <div 
                key={bid.bid_id}
                className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/40 dark:border-slate-800/40 p-4.5 rounded-2xl shadow-[inset_2px_2px_5px_#c8cbd4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_#0e141d,inset_-2px_-2px_5px_#2e3e59] space-y-3 text-xs text-slate-700 dark:text-slate-200 text-left"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-slate-855 dark:text-white leading-snug">{bid.asset_name}</span>
                  <div className="shrink-0">{getStandingBadge(bid)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-200/20 dark:border-slate-800/20">
                  <div>
                    <span className="text-[9px] text-slate-455 dark:text-slate-500 font-bold block uppercase tracking-wider">Bid Anda</span>
                    <span className="font-extrabold text-brand-650 dark:text-brand-400 text-xs block mt-0.5">{formatRupiah(bid.nominal_bid)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-455 dark:text-slate-500 font-bold block uppercase tracking-wider">Bid Tertinggi</span>
                    <span className="font-extrabold text-slate-800 dark:text-white text-xs block mt-0.5">{formatRupiah(bid.highest_bid_on_asset)}</span>
                  </div>
                </div>

                <div className="text-[9px] text-slate-500 dark:text-slate-450 pt-1.5 flex justify-between font-semibold border-t border-slate-200/20 dark:border-slate-800/20">
                  <span>Waktu Penawaran:</span>
                  <span>
                    {new Date(bid.bid_time).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
