import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ActiveBidView } from '../types';
import { Gavel, AlertCircle, Info } from 'lucide-react';

interface BiddingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedAssetId: string | null;
  onBidSuccess?: () => void;
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val);
};

export const BiddingFormModal: React.FC<BiddingFormModalProps> = ({
  isOpen,
  onClose,
  preselectedAssetId,
  onBidSuccess
}) => {
  const [assets, setAssets] = useState<ActiveBidView[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch active open assets
  const fetchOpenAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('view_active_bids')
        .select('*')
        .order('waktu_selesai', { ascending: true });

      if (error) throw error;
      
      // Filter only open/active assets
      const activeOnly = (data || []).filter(a => a.computed_status === 'OPEN');
      setAssets(activeOnly);
    } catch (err) {
      console.error('Error fetching assets in modal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOpenAssets();
      setBidError(null);
      setBidSuccess(null);
      setBidAmount('');
      if (preselectedAssetId) {
        setSelectedAssetId(preselectedAssetId);
      } else {
        setSelectedAssetId('');
      }
    }
  }, [isOpen, preselectedAssetId]);

  // Click outside listener for custom dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.asset_id === selectedAssetId);
  }, [assets, selectedAssetId]);

  const minRequiredBid = useMemo(() => {
    if (!selectedAsset) return 0;
    const currentHighest = selectedAsset.current_highest_bid || 0;
    const base = currentHighest > selectedAsset.harga_buka ? currentHighest : selectedAsset.harga_buka;
    return base + (selectedAsset.kelipatan_bid || 10000);
  }, [selectedAsset]);

  const filteredDropdownOptions = useMemo(() => {
    return assets.filter((a) =>
      a.nama_aset.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
      a.kode_aset.toLowerCase().includes(dropdownSearch.toLowerCase())
    );
  }, [assets, dropdownSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setBidError('Silakan pilih aset lelang terlebih dahulu.');
      return;
    }

    const nominal = parseInt(bidAmount.replace(/[^0-9]/g, ''));
    if (isNaN(nominal) || nominal <= 0) {
      setBidError('Masukkan nominal bidding yang valid.');
      return;
    }

    if (nominal < minRequiredBid) {
      setBidError(`Nominal penawaran minimum adalah ${formatRupiah(minRequiredBid)}`);
      return;
    }

    setSubmittingBid(true);
    setBidError(null);
    setBidSuccess(null);

    try {
      const { error } = await supabase.rpc('submit_bid', {
        p_asset_id: selectedAssetId,
        p_nominal: nominal
      });

      if (error) throw error;

      setBidSuccess('Bidding Anda berhasil diajukan!');
      setBidAmount('');
      
      if (onBidSuccess) onBidSuccess();
      
      // Refresh list to show updated bidding status
      await fetchOpenAssets();
      
      setTimeout(() => {
        setBidSuccess(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setBidError(err.message || 'Gagal mengajukan penawaran.');
    } finally {
      setSubmittingBid(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1e293b]/70 dark:bg-[#0e141d]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[12px_12px_24px_#d5d8df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#0e141d,-12px_-12px_24px_#2e3e59] rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 relative animate-fade-in-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pull handle bar for mobile bottom-sheet feel */}
        <div className="w-12 h-1.5 bg-slate-355 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden cursor-pointer" onClick={onClose} />

        <button
          onClick={onClose}
          className="btn-neu absolute top-4 right-4 text-slate-500 hover:text-rose-500 transition cursor-pointer text-xs font-black p-2 px-3 hidden sm:block"
        >
          ✕
        </button>

        <div className="flex justify-between items-center pb-3 border-b border-slate-200/40 dark:border-slate-855/40 mb-4">
          <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Gavel className="text-brand-500" size={18} />
            Form Pengajuan Bid
          </h3>
          <button
            onClick={onClose}
            className="text-xs font-black text-slate-555 hover:text-rose-500 cursor-pointer sm:hidden bg-transparent border-none"
          >
            Tutup
          </button>
        </div>

        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 text-left">
          Pilih barang lelang terbuka, lalu masukkan nominal bidding baru yang lebih tinggi dari bid tertinggi saat ini.
        </p>

        {loading && assets.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-brand-500 mx-auto mb-2" />
            <p className="text-xs">Memuat katalog lelang aktif...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Custom Searchable Dropdown Asset Select */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider pl-1">Aset Terbuka</label>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3.5 py-3 text-xs outline-none cursor-pointer select-none flex justify-between items-center rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/40 dark:border-slate-855/40 shadow-[inset_1.5px_1.5px_3px_#c8cbd4] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d]"
              >
                <span className={selectedAsset ? 'text-slate-800 dark:text-white font-bold truncate pr-4' : 'text-slate-400 dark:text-slate-500'}>
                  {selectedAsset ? `[${selectedAsset.kode_aset}] ${selectedAsset.nama_aset}` : '-- Pilih Aset Lelang --'}
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-550 shrink-0">▼</span>
              </div>

              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 max-h-48 overflow-y-auto neu-card rounded-xl shadow-2xl z-50 bg-[#f1f2f5] dark:bg-[#1e293b] border border-slate-200/50 dark:border-slate-800/80">
                  <div className="p-2 sticky top-0 z-10 bg-[#f1f2f5] dark:bg-[#1e293b] border-b border-slate-200/30 dark:border-slate-800/30">
                    <input
                      type="text"
                      placeholder="Cari aset..."
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg text-slate-800 dark:text-white bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/20 dark:border-slate-855/20 shadow-[inset_1px_1px_2px_#c8cbd4] dark:shadow-[inset_1px_1px_2px_#0e141d] outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="divide-y divide-slate-200/30 dark:divide-slate-800/20">
                    {filteredDropdownOptions.length === 0 ? (
                      <div className="p-3 text-[10px] text-slate-400 dark:text-slate-500 text-center italic">Tidak ada lelang aktif.</div>
                    ) : (
                      filteredDropdownOptions.map((a) => (
                        <div
                          key={a.asset_id}
                          onClick={() => {
                            setSelectedAssetId(a.asset_id);
                            setDropdownSearch('');
                            setIsDropdownOpen(false);
                            setBidAmount('');
                            setBidError(null);
                          }}
                          className="p-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-brand-500/5 cursor-pointer flex justify-between items-center"
                        >
                          <span className="truncate pr-2">[{a.kode_aset}] {a.nama_aset}</span>
                          <span className="shrink-0 text-brand-500 text-[10px] font-bold">{formatRupiah(a.current_highest_bid)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bidding Limit Displays */}
            {selectedAsset && (
              <div className="neu-inset rounded-xl p-3.5 text-xs space-y-2 bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/40 dark:border-slate-855/40 shadow-[inset_1px_1px_2.5px_#c8cbd4] dark:shadow-[inset_1px_1px_2.5px_#0e141d]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Harga Buka:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(selectedAsset.harga_buka)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Kelipatan Bid:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(selectedAsset.kelipatan_bid)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/20 dark:border-slate-800/20 pt-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold">Bid Tertinggi:</span>
                  <span className="font-bold text-brand-500">
                    {selectedAsset.current_highest_bid > selectedAsset.harga_buka || selectedAsset.winner_id ? formatRupiah(selectedAsset.current_highest_bid) : '-'}
                  </span>
                </div>
              </div>
            )}

            {/* Messages alerts */}
            {bidError && (
              <div className="neu-inset rounded-xl p-3.5 flex items-start gap-2 border-l-4 border-rose-500 bg-[#f1f2f5] dark:bg-[#1e293b]">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">{bidError}</span>
              </div>
            )}
            {bidSuccess && (
              <div className="neu-inset rounded-xl p-3.5 border-l-4 border-emerald-500 bg-[#f1f2f5] dark:bg-[#1e293b]">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{bidSuccess}</span>
              </div>
            )}

            {/* Bidding input field */}
            <div className="space-y-1.5">
              <label htmlFor="bid-amount-modal" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Nominal Bid (IDR)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-sm">Rp</span>
                <input
                  type="text"
                  id="bid-amount-modal"
                  required
                  placeholder={selectedAsset ? `Minimal ${minRequiredBid.toLocaleString('id-ID')}` : 'Contoh: 1.500.000'}
                  value={bidAmount ? parseInt(bidAmount).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                    setBidAmount(cleanVal);
                  }}
                  className="w-full pl-11 pr-4 py-3 text-sm text-slate-855 dark:text-white font-semibold rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/40 dark:border-slate-855/40 shadow-[inset_1.5px_1.5px_3px_#c8cbd4] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d] outline-none"
                />
              </div>
            </div>

            {selectedAsset && (
              <div className="flex items-center gap-1.5 text-[9px] text-slate-455 dark:text-slate-500 pl-1 font-semibold">
                <Info size={11} className="text-slate-400" />
                Penawaran minimal selanjutnya: <span className="text-brand-500 font-extrabold">{formatRupiah(minRequiredBid)}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingBid || !selectedAssetId}
              className="btn-brand-neu w-full py-3.5 font-bold text-xs uppercase tracking-wider mt-4 cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-95 transition-all"
            >
              {submittingBid ? 'Memproses...' : 'Kirim Penawaran'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
