import React, { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ActiveBidView } from '../types';
import { Gavel, Clock, ChevronLeft, ChevronRight, User, AlertCircle, Search, LayoutGrid, List, MessageSquare, Maximize2 } from 'lucide-react';
import gsap from 'gsap';

interface BiddingGalleryProps {
  userId: string;
  isAdmin?: boolean;
  onOpenBidModal?: (assetId: string) => void;
}

export const BiddingGallery: React.FC<BiddingGalleryProps> = ({ userId, isAdmin = false, onOpenBidModal }) => {
  const [assets, setAssets] = useState<ActiveBidView[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Statistics counters
  const [userBidsCount, setUserBidsCount] = useState(0);

  // Layout states
  const [layout, setLayout] = useState<'card' | 'list'>('card');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortOption, setSortOption] = useState('sisaWaktuAsc');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Custom searchable select states for Bidding Form
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');

  // Bid input state (for Bidding Form on the right)
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  // Detail Modal states
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);
  const [detailImgIdx, setDetailImgIdx] = useState(0);
  const [fullscreenImgUrl, setFullscreenImgUrl] = useState<string | null>(null);

  // Carousel indices per card asset
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});

  // Real-time countdowns
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Stagger entry animation using GSAP
  useEffect(() => {
    if (!loading && assets.length > 0 && containerRef.current) {
      gsap.killTweensOf(containerRef.current.children);
      gsap.fromTo(
        containerRef.current.children,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.05,
          duration: 0.45,
          ease: 'power2.out',
          overwrite: 'auto'
        }
      );
    }
  }, [loading, layout, selectedCategory, sortOption]);

  // Click outside handler for dropdown searchable select
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailAssetId(null);
        setFullscreenImgUrl(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch functions
  const fetchUserBidsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status_bid', 'VALID');
      if (!error && count !== null) {
        setUserBidsCount(count);
      }
    } catch (err) {
      console.error('Error counting user bids:', err);
    }
  };

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('view_active_bids')
        .select('*')
        .order('waktu_selesai', { ascending: true });

      if (error) throw error;
      setAssets(data || []);
    } catch (err: any) {
      console.error('Error fetching assets:', err);
      setErrorMsg('Gagal mengambil katalog aset lelang.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories in gallery:', err);
    }
  };

  // Main setup logic
  useEffect(() => {
    fetchAssets();
    fetchUserBidsCount();
    fetchCategories();

    const bidsChannel = supabase
      .channel('bids-realtime-gallery')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids' },
        () => {
          fetchAssets();
          fetchUserBidsCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bids' },
        () => {
          fetchAssets();
          fetchUserBidsCount();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      updateCountdowns();
    }, 1000);

    return () => {
      supabase.removeChannel(bidsChannel);
      clearInterval(interval);
    };
  }, [assets.length]);

  const updateCountdowns = () => {
    const updated: Record<string, string> = {};
    assets.forEach((asset) => {
      if (asset.status_lelang === 'CANCEL' || asset.computed_status === 'CANCELLED') {
        updated[asset.asset_id] = 'DIBATALKAN';
        return;
      }
      const diff = new Date(asset.waktu_selesai).getTime() - Date.now();
      if (diff <= 0) {
        updated[asset.asset_id] = 'LELANG BERAKHIR';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}h`);
      if (hours > 0 || days > 0) parts.push(`${hours}j`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}d`);

      updated[asset.asset_id] = parts.join(' ');
    });
    setCountdowns(updated);
  };

  useEffect(() => {
    if (assets.length > 0) {
      updateCountdowns();
    }
  }, [assets]);

  // Statistics memoization
  const stats = useMemo(() => {
    const total = assets.length;
    const nowTime = Date.now();
    const scheduled = assets.filter(a => new Date(a.waktu_selesai).getTime() > nowTime && new Date(a.waktu_selesai).getTime() - nowTime > 3 * 24 * 60 * 60 * 1000).length; // Mock scheduled criteria or status based
    const closed = assets.filter(a => a.computed_status === 'CLOSED' || a.status_lelang === 'CLOSED').length;
    const active = assets.filter(a => a.computed_status === 'OPEN' && a.status_lelang === 'OPEN').length;
    const activeWithBids = assets.filter(a => a.computed_status === 'OPEN' && a.status_lelang === 'OPEN' && a.current_highest_bid > a.harga_buka).length;
    const activeNoBids = active - activeWithBids;

    return {
      total,
      scheduled,
      closed,
      active,
      activeWithBids,
      activeNoBids
    };
  }, [assets]);

  // Handle Search & Filter logic
  const filteredAssets = useMemo(() => {
    let result = [...assets];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        a =>
          a.nama_aset.toLowerCase().includes(q) ||
          a.kode_aset.toLowerCase().includes(q) ||
          (a.deskripsi && a.deskripsi.toLowerCase().includes(q))
      );
    }

    if (selectedCategory) {
      result = result.filter(a => a.jenis_aset === selectedCategory);
    }

    if (minPrice) {
      const minVal = parseFloat(minPrice.replace(/[^0-9]/g, ''));
      if (!isNaN(minVal)) {
        result = result.filter(a => a.harga_buka >= minVal);
      }
    }

    if (maxPrice) {
      const maxVal = parseFloat(maxPrice.replace(/[^0-9]/g, ''));
      if (!isNaN(maxVal)) {
        result = result.filter(a => a.harga_buka <= maxVal);
      }
    }

    result.sort((a, b) => {
      const now = Date.now();
      const aTimeLeft = new Date(a.waktu_selesai).getTime() - now;
      const bTimeLeft = new Date(b.waktu_selesai).getTime() - now;

      switch (sortOption) {
        case 'sisaWaktuAsc':
          return aTimeLeft - bTimeLeft;
        case 'sisaWaktuDesc':
          return bTimeLeft - aTimeLeft;
        case 'hargaBukaAsc':
          return a.harga_buka - b.harga_buka;
        case 'hargaBukaDesc':
          return b.harga_buka - a.harga_buka;
        case 'highestBidDesc':
          return b.current_highest_bid - a.current_highest_bid;
        default:
          return 0;
      }
    });

    return result;
  }, [assets, searchQuery, selectedCategory, minPrice, maxPrice, sortOption]);

  // List of open assets for Bidding select options
  const openAssetsForSelect = useMemo(() => {
    return assets.filter(a => a.computed_status === 'OPEN' && a.status_lelang === 'OPEN');
  }, [assets]);

  // Search filtered open assets for custom dropdown select
  const filteredDropdownOptions = useMemo(() => {
    return openAssetsForSelect.filter(
      a =>
        a.nama_aset.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        a.kode_aset.toLowerCase().includes(dropdownSearch.toLowerCase())
    );
  }, [openAssetsForSelect, dropdownSearch]);

  const selectedAsset = useMemo(() => {
    return assets.find(a => a.asset_id === selectedAssetId);
  }, [assets, selectedAssetId]);

  // Selected asset bids helpers
  const minRequiredBid = useMemo(() => {
    if (!selectedAsset) return 0;
    const hasBids = selectedAsset.winner_id !== null;
    const currentPrice = selectedAsset.current_highest_bid;
    const kelipatan = Number(selectedAsset.kelipatan_bid) || 10000;

    return hasBids ? currentPrice + kelipatan : selectedAsset.harga_buka;
  }, [selectedAsset]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const handleBiddingFormSubmit = async (e: React.FormEvent) => {
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
      fetchUserBidsCount();
      fetchAssets();

      setTimeout(() => {
        setBidSuccess(null);
      }, 3000);
    } catch (err: any) {
      setBidError(err.message || 'Gagal mengajukan penawaran.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleCancelHighestBid = async (assetId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan penawaran tertinggi saat ini?')) return;
    try {
      const { data: bidsList, error: fetchErr } = await supabase
        .from('bids')
        .select('id')
        .eq('asset_id', assetId)
        .eq('status_bid', 'VALID')
        .order('nominal_bid', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);

      if (fetchErr) throw fetchErr;
      if (!bidsList || bidsList.length === 0) {
        alert('Tidak ada penawaran valid untuk dibatalkan.');
        return;
      }

      const { error: updateErr } = await supabase
        .from('bids')
        .update({ status_bid: 'CANCELLED' })
        .eq('id', bidsList[0].id);

      if (updateErr) throw updateErr;
      alert('Penawaran tertinggi berhasil dibatalkan.');
      fetchAssets();
      if (detailAssetId) {
        // Refresh details modal winner details
        const updatedAsset = assets.find(a => a.asset_id === assetId);
        if (updatedAsset && !updatedAsset.winner_id) {
          setDetailAssetId(null);
        }
      }
    } catch (err: any) {
      alert('Gagal membatalkan penawaran: ' + err.message);
    }
  };

  // Carousel helpers for card
  const handleNextImage = (e: React.MouseEvent, assetId: string, maxImages: number) => {
    e.stopPropagation();
    setCarouselIndex((prev) => ({
      ...prev,
      [assetId]: ((prev[assetId] || 0) + 1) % maxImages
    }));
  };

  const handlePrevImage = (e: React.MouseEvent, assetId: string, maxImages: number) => {
    e.stopPropagation();
    setCarouselIndex((prev) => ({
      ...prev,
      [assetId]: ((prev[assetId] || 0) - 1 + maxImages) % maxImages
    }));
  };

  // Switch to bidding panel and focus
  const handleSelectAssetForBid = (assetId: string) => {
    setSelectedAssetId(assetId);
    setBidAmount('');
    setBidError(null);
    setBidSuccess(null);

    // Scroll to form panel on desktop
    const biddingSection = document.getElementById('bidding-panel-section');
    if (biddingSection) {
      biddingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        const inputEl = document.getElementById('bid-amount');
        if (inputEl) inputEl.focus();
      }, 500);
    }
  };

  // Detail Modal asset finder
  const detailAsset = useMemo(() => {
    return assets.find(a => a.asset_id === detailAssetId);
  }, [assets, detailAssetId]);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="neu-card inline-flex p-4 rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Memuat katalog lelang aset...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="neu-inset rounded-2xl p-8 text-center space-y-3">
        <AlertCircle size={28} className="text-rose-500 mx-auto" />
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 text-left relative">

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
              <span className="text-sm md:text-2xl font-extrabold text-slate-800 dark:text-white">{userBidsCount}</span>
              <span className="text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400">diajukan</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 text-[8px] md:text-[9.5px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Real-time update
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN PAGE CONTENT GRID --- */}
      <div id="view-gallery" className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">

        {/* Left Side: Search, Filters & Cards Gallery */}
        <div id="assets-section" className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Aset Tersedia</h3>
            
            <div className="flex items-center gap-2">
              {/* Sorting Select */}
              <div className="relative">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="text-slate-700 dark:text-slate-200 rounded-xl pl-3 pr-7 py-2 text-[10px] md:text-xs font-semibold cursor-pointer outline-none transition appearance-none"
                  style={{ boxShadow: '3px 3px 7px var(--neu-shadow-dark), -3px -3px 7px var(--neu-shadow-light)', background: 'var(--neu-surface)' }}
                >
                  <option value="sisaWaktuAsc">Sisa Waktu Terdekat</option>
                  <option value="sisaWaktuDesc">Sisa Waktu Terlama</option>
                  <option value="hargaBukaAsc">Harga Terendah</option>
                  <option value="hargaBukaDesc">Harga Tertinggi</option>
                  <option value="highestBidDesc">Bid Tertinggi</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[8px]">▼</span>
              </div>

              {/* Layout togglers */}
              <div className="neu-inset flex items-center p-1 rounded-xl gap-0.5">
                <button
                  onClick={() => setLayout('card')}
                  className={`no-neu p-2 rounded-lg transition-all ${layout === 'card' ? 'active-neu text-brand-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Tampilan Card"
                  style={{ minHeight: 'auto' }}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => setLayout('list')}
                  className={`no-neu p-2 rounded-lg transition-all ${layout === 'list' ? 'active-neu text-brand-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Tampilan List"
                  style={{ minHeight: 'auto' }}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Search & Filter Panel */}
          <div className="neu-inset rounded-2xl p-4 md:p-5 space-y-3">
            <div className="flex gap-2.5">
              {/* Query search */}
              <div className="flex-grow">
                <label className="block text-[8px] md:text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Cari Kata Kunci</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari kode aset, nama, deskripsi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs text-slate-800 dark:text-white rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-slate-200/30 dark:border-slate-800/25 shadow-[inset_1.5px_1.5px_3px_#c8cbd4] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d] outline-none"
                  />
                </div>
              </div>

              {/* Mobile Filter Toggle Button */}
              <div className="flex items-end md:hidden">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={`btn-neu py-2 px-4 text-xs font-black flex items-center justify-center gap-1.5 h-[37.5px] min-h-[auto] ${filtersOpen ? 'tab-active-neu text-brand-650' : 'text-slate-500'}`}
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Collapsible drawer for advanced filters on mobile */}
            <div className={`${filtersOpen ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200/30 dark:border-slate-800/20 pt-3.5 mt-2`}>
              {/* Kategori Select */}
              <div>
                <label className="block text-[8px] md:text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Kategori</label>
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-2.5 py-2.5 text-xs text-slate-800 dark:text-white rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-slate-200/30 dark:border-slate-800/25 shadow-[inset_1px_1px_2px_#c8cbd4] dark:shadow-[inset_1px_1px_2px_#0e141d] outline-none cursor-pointer appearance-none"
                  >
                    <option value="">Semua Kategori</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[8px]">▼</span>
                </div>
              </div>

              {/* Min Harga */}
              <div>
                <label className="block text-[8px] md:text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Harga (Min)</label>
                <input
                  type="text"
                  placeholder="Contoh: 1.000.000"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs text-slate-800 dark:text-white rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-slate-200/30 dark:border-slate-800/25 shadow-[inset_1px_1px_2px_#c8cbd4] dark:shadow-[inset_1px_1px_2px_#0e141d] outline-none"
                />
              </div>

              {/* Max Harga */}
              <div>
                <label className="block text-[8px] md:text-[10px] font-bold text-slate-455 dark:text-slate-500 mb-1.5 uppercase tracking-wider pl-1">Harga (Max)</label>
                <input
                  type="text"
                  placeholder="Contoh: 50.000.000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs text-slate-800 dark:text-white rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-slate-200/30 dark:border-slate-800/25 shadow-[inset_1px_1px_2px_#c8cbd4] dark:shadow-[inset_1px_1px_2px_#0e141d] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Catalog grid */}
          {filteredAssets.length === 0 ? (
            <div className="neu-card rounded-2xl p-12 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada aset lelang yang sesuai pencarian Anda.</p>
            </div>
          ) : layout === 'card' ? (
            /* Card view */
            <div ref={containerRef} className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              {filteredAssets.map((asset) => {
                const currentImgIdx = carouselIndex[asset.asset_id] || 0;
                const images = asset.gambar_url.length > 0 ? asset.gambar_url : ['https://placehold.co/600x400/1e293b/94a3b8?text=Tidak+Ada+Gambar'];
                const countdownStr = countdowns[asset.asset_id] || 'Loading...';
                const isClosed = countdownStr === 'LELANG BERAKHIR' || asset.computed_status === 'CLOSED';
                const isCancelled = countdownStr === 'DIBATALKAN' || asset.computed_status === 'CANCELLED';
                const isScheduled = countdownStr.startsWith('Mulai');

                return (
                  <div
                    key={asset.asset_id}
                    onClick={() => { setDetailAssetId(asset.asset_id); setDetailImgIdx(0); }}
                    className={`neu-card flex flex-col rounded-2xl overflow-hidden transition-all cursor-pointer ${
                      isClosed ? 'opacity-75' : ''
                    }`}
                  >
                    {/* Carousel Box */}
                    <div className="relative h-24 sm:h-36 lg:h-44 w-full bg-slate-950 flex items-center justify-center overflow-hidden group">
                      <img
                        src={images[currentImgIdx]}
                        alt={asset.nama_aset}
                        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      />

                      <div className="absolute top-2 left-2 bg-[#f1f2f5]/90 dark:bg-[#1e293b]/90 backdrop-blur text-slate-800 dark:text-slate-200 text-[8px] px-2 py-0.5 rounded-lg border border-slate-200/40 dark:border-slate-800/35 font-bold uppercase tracking-wider shadow-sm">
                        {asset.jenis_aset}
                      </div>

                      {images.length > 1 && (
                        <>
                          <button
                            onClick={(e) => handlePrevImage(e, asset.asset_id, images.length)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-slate-950/80 hover:bg-slate-900 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronLeft size={12} />
                          </button>
                          <button
                            onClick={(e) => handleNextImage(e, asset.asset_id, images.length)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-slate-950/80 hover:bg-slate-900 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight size={12} />
                          </button>
                          <div className="absolute bottom-2 right-2 bg-slate-950/80 px-1.5 py-0.5 rounded text-[8px] text-slate-300 font-bold shadow-sm">
                            {currentImgIdx + 1}/{images.length}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-3 sm:p-4 md:p-5 flex-grow flex flex-col justify-between space-y-2 sm:space-y-3">
                      <div>
                        <div className="flex justify-between items-start gap-1 flex-wrap">
                          <span className="text-[8px] font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20 uppercase tracking-wider">
                            {asset.kode_aset}
                          </span>
                          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-455 text-[8px] sm:text-xs">
                            <Clock size={9} />
                            <span className="font-bold">{countdownStr}</span>
                          </div>
                        </div>

                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white mt-1 line-clamp-1" title={asset.nama_aset}>{asset.nama_aset}</h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mt-0.5">{asset.deskripsi || 'Tidak ada deskripsi.'}</p>
                      </div>

                      {/* Prices and Action buttons */}
                      <div className="border-t border-slate-200/30 dark:border-slate-800/20 pt-2.5">
                        <div className="neu-inset rounded-xl p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2.5 text-left">
                          <div className="flex justify-between sm:block">
                            <span className="text-[7px] uppercase font-bold tracking-wider text-slate-500 pl-0.5">Buka:</span>
                            <span className="text-[9px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 block pr-0.5">{formatRupiah(asset.harga_buka)}</span>
                          </div>
                          <div className="flex justify-between sm:block border-t border-slate-200/20 sm:border-t-0 pt-0.5 sm:pt-0">
                            <span className="text-[7px] uppercase font-bold tracking-wider text-slate-500 pl-0.5">Bid:</span>
                            <span className="text-[9px] sm:text-xs font-black text-brand-500 block pr-0.5">
                              {asset.current_highest_bid > asset.harga_buka || asset.winner_id ? formatRupiah(asset.current_highest_bid) : '-'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailAssetId(asset.asset_id); setDetailImgIdx(0); }}
                            className="btn-neu flex-1 py-1.5 text-[9px] sm:text-xs font-black text-center text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            Detail
                          </button>
                          {(!isClosed && !isCancelled && !isScheduled) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenBidModal && window.innerWidth < 1024) {
                                  onOpenBidModal(asset.asset_id);
                                } else {
                                  handleSelectAssetForBid(asset.asset_id);
                                }
                              }}
                              className="btn-brand-neu flex-1 py-1.5 text-[9px] sm:text-xs font-bold cursor-pointer"
                            >
                              Bid
                            </button>
                          ) : (
                            <button
                              disabled
                              className="btn-neu flex-1 py-1.5 text-[9px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed"
                            >
                              {isAdmin ? 'Admin' : (isScheduled ? 'Mulai' : 'Selesai')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view layout */
            <div ref={containerRef} className="space-y-3">
              {filteredAssets.map((asset) => {
                const currentImgIdx = carouselIndex[asset.asset_id] || 0;
                const images = asset.gambar_url.length > 0 ? asset.gambar_url : ['https://placehold.co/600x400/1e293b/94a3b8?text=Tidak+Ada+Gambar'];
                const countdownStr = countdowns[asset.asset_id] || 'Loading...';
                const isClosed = countdownStr === 'LELANG BERAKHIR' || asset.computed_status === 'CLOSED';
                const isCancelled = countdownStr === 'DIBATALKAN' || asset.computed_status === 'CANCELLED';
                const isScheduled = countdownStr.startsWith('Mulai');

                return (
                  <div
                    key={asset.asset_id}
                    onClick={() => { setDetailAssetId(asset.asset_id); setDetailImgIdx(0); }}
                    className={`neu-card flex flex-row rounded-2xl overflow-hidden transition-all p-3 sm:p-4 gap-3 sm:gap-4 items-center cursor-pointer ${
                      isClosed ? 'opacity-75' : ''
                    }`}
                  >
                    {/* Thumbnail Box */}
                    <div className="relative w-20 h-20 sm:w-28 sm:h-28 overflow-hidden bg-slate-950 rounded-xl flex-shrink-0 group">
                      <img
                        src={images[currentImgIdx]}
                        alt={asset.nama_aset}
                        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      />
                    </div>

                    {/* Content Details */}
                    <div className="flex-grow flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-1 flex-wrap">
                          <span className="text-[8px] font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20 uppercase tracking-wider">
                            {asset.kode_aset}
                          </span>
                          <span className="text-[8px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{asset.jenis_aset}</span>
                        </div>
                        <h3 className="text-xs sm:text-base font-extrabold text-slate-800 dark:text-white line-clamp-1 mt-1">{asset.nama_aset}</h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal mt-0.5">{asset.deskripsi || 'Tidak ada deskripsi.'}</p>
                      </div>

                      {/* Lower Prices Block */}
                      <div className="flex items-center justify-between gap-3 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/40">
                        <div className="flex gap-4">
                          <div>
                            <span className="block text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400">Buka</span>
                            <span className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(asset.harga_buka)}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400">Bid</span>
                            <span className="text-[10px] sm:text-xs font-bold text-brand-500">
                              {asset.current_highest_bid > asset.harga_buka || asset.winner_id ? formatRupiah(asset.current_highest_bid) : '-'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailAssetId(asset.asset_id); setDetailImgIdx(0); }}
                            className="no-neu bg-[#f1f2f5] dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 font-bold px-2.5 py-1.5 rounded-lg text-[9px] sm:text-xs transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                            style={{ boxShadow: '2px 2px 5px var(--neu-shadow-dark), -2px -2px 5px var(--neu-shadow-light)', minHeight: 'auto' }}
                          >
                            Detail
                          </button>
                          {(!isClosed && !isCancelled && !isScheduled) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenBidModal && window.innerWidth < 1024) {
                                  onOpenBidModal(asset.asset_id);
                                } else {
                                  handleSelectAssetForBid(asset.asset_id);
                                }
                              }}
                              className="btn-primary bg-brand-500 hover:bg-brand-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[9px] sm:text-xs transition cursor-pointer"
                            >
                              Bid
                            </button>
                          ) : (
                            <button
                              disabled
                              className="no-neu bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed px-2.5 py-1.5 rounded-lg text-[9px] sm:text-xs font-bold"
                              style={{ minHeight: 'auto' }}
                            >
                              {isAdmin ? 'Admin' : (isScheduled ? 'Belum' : 'Selesai')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Bidding Form Panel */}
        <div id="bidding-panel-section" className="lg:col-span-1 lg:sticky lg:top-28">
          <div className="neu-card p-5 md:p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 dark:border-slate-700/40">
              <h3 className="text-sm md:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Gavel className="text-brand-500" size={18} />
                Form Pengajuan Bid
              </h3>
            </div>
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Pilih barang lelang terbuka, lalu masukkan nominal bidding baru yang lebih tinggi.</p>

            <form onSubmit={handleBiddingFormSubmit} className="space-y-4 text-left">
              {/* Custom Searchable Dropdown Asset Select */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Aset Terbuka</label>
                <div
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-3.5 py-3 text-xs outline-none cursor-pointer select-none flex justify-between items-center rounded-xl"
                  style={{ background: 'var(--neu-surface)', boxShadow: 'inset 2px 2px 6px var(--neu-shadow-dark), inset -2px -2px 6px var(--neu-shadow-light)' }}
                >
                  <span className={selectedAsset ? 'text-slate-800 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500'}>
                    {selectedAsset ? `[${selectedAsset.kode_aset}] ${selectedAsset.nama_aset}` : '-- Pilih Aset Lelang --'}
                  </span>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500">▼</span>
                </div>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto neu-card rounded-xl shadow-2xl z-50">
                    <div className="p-2 sticky top-0 z-10" style={{ background: 'var(--neu-surface)' }}>
                      <input
                        type="text"
                        placeholder="Cari aset..."
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg text-slate-800 dark:text-white"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="divide-y divide-slate-200/60 dark:divide-slate-700/40">
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
                <div className="neu-inset rounded-xl p-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Harga Buka:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{formatRupiah(selectedAsset.harga_buka)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Kelipatan Bid:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{formatRupiah(selectedAsset.kelipatan_bid)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 dark:border-slate-700/40 pt-2">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">Bid Tertinggi:</span>
                    <span className="font-bold text-brand-500">
                      {selectedAsset.current_highest_bid > selectedAsset.harga_buka || selectedAsset.winner_id ? formatRupiah(selectedAsset.current_highest_bid) : '-'}
                    </span>
                  </div>
                </div>
              )}

              {/* Messages info */}
              {bidError && (
                <div className="neu-inset rounded-xl p-3 flex items-start gap-2 border-l-4 border-rose-500">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-500" />
                  <span className="text-[11px] text-rose-700 dark:text-rose-300">{bidError}</span>
                </div>
              )}
              {bidSuccess && (
                <div className="neu-inset rounded-xl p-3 border-l-4 border-emerald-500">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">{bidSuccess}</span>
                </div>
              )}

              {/* Bidding input field */}
              <div className="space-y-1.5">
                <label htmlFor="bid-amount" className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nominal Bid (IDR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold text-sm">Rp</span>
                  <input
                    type="text"
                    id="bid-amount"
                    required
                    placeholder={selectedAsset ? `Minimal ${minRequiredBid.toLocaleString('id-ID')}` : 'Contoh: 1.500.000'}
                    value={bidAmount ? parseInt(bidAmount).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                      setBidAmount(cleanVal);
                    }}
                    className="w-full pl-11 pr-4 py-3 text-sm text-slate-800 dark:text-white font-semibold rounded-xl"
                  />
                </div>
              </div>

              {/* Kirim Penawaran action button */}
              <button
                type="submit"
                disabled={submittingBid || !selectedAssetId}
                className="btn-primary w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                {submittingBid ? 'Memproses...' : 'Kirim Penawaran'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* --- 5. USER / ADMIN ASSET DETAIL VIEW MODAL --- */}
      {detailAssetId && detailAsset && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          onClick={() => setDetailAssetId(null)}
        >
          <div
            className="w-full sm:max-w-4xl modal-sheet sm:rounded-3xl sm:modal-dialog bg-[#f1f2f5] dark:bg-[#1e293b] flex flex-col md:flex-row overflow-hidden max-h-[93vh] animate-slide-up-sheet sm:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Left Column: Image Slider */}
            <div className="w-full md:w-1/2 h-48 sm:h-64 md:h-auto bg-slate-100 dark:bg-slate-950 relative flex items-center justify-center flex-shrink-0 group/modal">
              {(() => {
                const images = detailAsset.gambar_url.length > 0 ? detailAsset.gambar_url : ['https://placehold.co/600x400/1e293b/94a3b8?text=Tidak+Ada+Gambar'];
                return (
                  <>
                    <img
                      src={images[detailImgIdx]}
                      alt={detailAsset.nama_aset}
                      className="w-full h-full object-cover md:object-contain select-none transition-all duration-300"
                    />

                    {/* Fullscreen Trigger */}
                    <button
                      onClick={() => setFullscreenImgUrl(images[detailImgIdx])}
                      className="absolute top-3 left-3 bg-white/90 dark:bg-slate-950/70 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-850 dark:text-white rounded-full p-2 border border-slate-200 dark:border-slate-800 shadow z-10 transition cursor-pointer"
                    >
                      <Maximize2 size={14} />
                    </button>

                    {/* Navigation */}
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setDetailImgIdx((prev) => (prev - 1 + images.length) % images.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-950/70 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-850 dark:text-white rounded-full p-2 border border-slate-200 dark:border-slate-800 shadow cursor-pointer transition-all duration-200"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => setDetailImgIdx((prev) => (prev + 1) % images.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-950/70 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-850 dark:text-white rounded-full p-2 border border-slate-200 dark:border-slate-800 shadow cursor-pointer transition-all duration-200"
                        >
                          <ChevronRight size={16} />
                        </button>

                        {/* Dots Indicators */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1.5 bg-white/60 dark:bg-slate-950/40 p-1.5 rounded-full backdrop-blur shadow-sm">
                          {images.map((_, idx) => (
                            <span
                              key={idx}
                              onClick={() => setDetailImgIdx(idx)}
                              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${idx === detailImgIdx ? 'bg-brand-500 w-5' : 'bg-slate-400/50 w-2'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Right Column: Information Details */}
            <div className="w-full md:w-1/2 p-5 sm:p-6 lg:p-8 flex flex-col justify-between flex-grow overflow-hidden min-h-0 text-left">
              <div className="space-y-4 overflow-y-auto pr-1 flex-grow min-h-0">
                <div className="flex justify-between items-start gap-4">
                  <span className="bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs px-3 py-1.5 rounded-xl border border-brand-500/20 font-bold uppercase tracking-wider">
                    {detailAsset.jenis_aset}
                  </span>
                  <button
                    onClick={() => setDetailAssetId(null)}
                    className="no-neu h-8 w-8 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                    style={{ minHeight: 'auto' }}
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 uppercase tracking-wider">
                    {detailAsset.kode_aset}
                  </span>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-white leading-tight pt-1">
                    {detailAsset.nama_aset}
                  </h2>
                </div>

                {/* Prices Grid */}
                <div className="neu-inset rounded-xl p-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Harga Buka</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(detailAsset.harga_buka)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Kelipatan</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRupiah(detailAsset.kelipatan_bid)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Bid Tertinggi</span>
                    <span className="font-bold text-brand-500">
                      {detailAsset.current_highest_bid > detailAsset.harga_buka || detailAsset.winner_id ? formatRupiah(detailAsset.current_highest_bid) : '-'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <span className="block text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1.5">Deskripsi Lengkap</span>
                  <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed max-h-36 overflow-y-auto pr-1 whitespace-pre-line">
                    {detailAsset.deskripsi || 'Tidak ada deskripsi.'}
                  </div>
                </div>

                {/* Admin-only winner section */}
                {isAdmin && detailAsset.winner_id && (
                  <div className="neu-inset rounded-xl p-4 text-xs space-y-2">
                    <div className="font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-widest text-[9px] mb-1">
                      Pemenang Sementara (Admin Only)
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Nama Lengkap:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{detailAsset.winner_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Departemen:</span>
                      <span className="font-semibold text-slate-800 dark:text-white">{detailAsset.winner_details?.departemen || 'Karyawan'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">WhatsApp:</span>
                      <span className="font-semibold text-slate-800 dark:text-white">{detailAsset.winner_details?.no_wa || '-'}</span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 mt-1">
                      {detailAsset.winner_details?.no_wa && (
                        <a
                          href={`https://wa.me/${detailAsset.winner_details.no_wa.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-[10px] text-center transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          Hubungi WA
                        </a>
                      )}
                      <button
                        onClick={() => handleCancelHighestBid(detailAsset.asset_id)}
                        className="no-neu flex-1 bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white font-bold py-2.5 rounded-xl text-[10px] border border-rose-500/20 transition cursor-pointer"
                        style={{ minHeight: 'auto' }}
                      >
                        Batalkan Bid
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/40 flex flex-col gap-2.5 mt-2">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                      Sisa Waktu
                    </span>
                    <span className="text-xs font-extrabold text-slate-800 dark:text-white">
                      {countdowns[detailAsset.asset_id]}
                    </span>
                  </div>
                  {detailAsset.computed_status === 'OPEN' && detailAsset.status_lelang === 'OPEN' ? (
                    <button
                      onClick={() => {
                        setDetailAssetId(null);
                        if (onOpenBidModal && window.innerWidth < 1024) {
                          onOpenBidModal(detailAsset.asset_id);
                        } else {
                          handleSelectAssetForBid(detailAsset.asset_id);
                        }
                      }}
                      className="btn-primary bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer"
                    >
                      Ikut Lelang
                    </button>
                  ) : (
                    <button
                      disabled
                      className="no-neu bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed px-6 py-2.5 rounded-xl text-xs font-bold"
                      style={{ minHeight: 'auto' }}
                    >
                      Lelang Selesai
                    </button>
                  )}
                </div>
                
                <a
                  href={`mailto:biddingz@bms.jiipe.co.id?subject=${encodeURIComponent(`Tanya Detail Aset: ${detailAsset.nama_aset}`)}&body=${encodeURIComponent(`Halo Admin,\n\nSaya ingin bertanya lebih lanjut mengenai aset lelang berikut:\n- Nama Aset: ${detailAsset.nama_aset}\n- Kategori: ${detailAsset.jenis_aset}\n- Kode Aset: ${detailAsset.kode_aset}\n- Harga Buka: ${formatRupiah(detailAsset.harga_buka)}\n\nPertanyaan saya:\n[Tuliskan pertanyaan Anda di sini]\n\nTerima kasih.`)}`}
                  className="no-neu text-center bg-[#f1f2f5] dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 font-bold py-2.5 rounded-xl text-xs transition border border-slate-200 dark:border-slate-700 w-full flex items-center justify-center gap-1.5"
                  style={{ boxShadow: '2px 2px 6px var(--neu-shadow-dark), -2px -2px 6px var(--neu-shadow-light)' }}
                >
                  <MessageSquare size={12} />
                  Tanyakan Lebih Lanjut
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Fullscreen Image Viewer Modal --- */}
      {fullscreenImgUrl && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setFullscreenImgUrl(null)}
        >
          <img
            src={fullscreenImgUrl}
            alt="Fullscreen Preview"
            className="max-w-full max-h-full object-contain rounded-lg animate-fluid-modal"
          />
        </div>
      )}
    </div>
  );
};
