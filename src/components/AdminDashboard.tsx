import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Profile as UserProfile, Asset, RegistrationField, ActiveBidView } from '../types';
import { ShieldCheck, Ban, Trash2, FileText, Settings, Image, Pencil } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'assets' | 'fields' | 'monitor'>('users');

  // 1. Users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [fields, setFields] = useState<RegistrationField[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // 2. Assets state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [newAsset, setNewAsset] = useState({
    kode_aset: '',
    jenis_aset: '',
    nama_aset: '',
    deskripsi: '',
    harga_buka: '',
    kelipatan_bid: '10000',
    waktu_mulai: '',
    waktu_selesai: '',
  });
  const [assetImages, setAssetImages] = useState<FileList | null>(null);
  const [assetSuccess, setAssetSuccess] = useState('');
  const [assetError, setAssetError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editAssetImages, setEditAssetImages] = useState<FileList | null>(null);

  // Categories states
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySuccess, setCategorySuccess] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // 3. Fields state
  const [newField, setNewField] = useState({
    field_name: '',
    label: '',
    field_type: 'text' as RegistrationField['field_type'],
    is_required: false,
  });

  // 4. Monitor state
  const [activeBids, setActiveBids] = useState<ActiveBidView[]>([]);
  const [loadingMonitor, setLoadingMonitor] = useState(true);

  useEffect(() => {
    fetchUsersAndFields();
    fetchAssets();
    fetchActiveBids();
    fetchCategories();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- API Fetches ---
  const fetchUsersAndFields = async () => {
    setLoadingUsers(true);
    try {
      const { data: usersData, error: usersErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: fieldsData, error: fieldsErr } = await supabase
        .from('registration_fields')
        .select('*')
        .order('created_at', { ascending: true });

      if (usersErr) throw usersErr;
      if (fieldsErr) throw fieldsErr;

      setUsers(usersData || []);
      setFields(fieldsData || []);
    } catch (err) {
      console.error('Error fetching users/fields:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleExtendAllAuctions = async () => {
    if (!confirm('Perpanjang semua aset lelang menjadi 7 hari ke depan dan reset status ke OPEN?')) return;
    setLoadingAssets(true);
    try {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const { error } = await supabase
        .from('assets')
        .update({
          status_lelang: 'OPEN',
          waktu_mulai: now.toISOString(),
          waktu_selesai: nextWeek.toISOString(),
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      alert('Berhasil memperpanjang semua lelang selama 7 hari!');
      await fetchAssets();
    } catch (err: any) {
      console.error('Error extending auctions:', err);
      alert('Gagal memperpanjang lelang: ' + err.message);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleSeedAssets = async () => {
    if (!confirm('Seed 6 aset default (aktif hingga 7 hari ke depan) ke database?')) return;
    setLoadingAssets(true);
    try {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const defaultAssets = [
        {
          kode_aset: 'BMS/DEL/KND/2026/001',
          jenis_aset: 'Kendaraan Operasional',
          nama_aset: 'Toyota Hilux Single Cabin',
          deskripsi: '| L 9853 AR | 2016 | Rusak |',
          gambar_url: ['https://drive.google.com/thumbnail?id=1OL9upJrIkTmYMdcROXm5SsxdWTZuDXHf&sz=w1000'],
          harga_buka: 16485000,
          waktu_mulai: now.toISOString(),
          waktu_selesai: nextWeek.toISOString(),
          status_lelang: 'OPEN',
          kelipatan_bid: 100000
        },
        {
          kode_aset: 'BMS/DEL/KND/2026/002',
          jenis_aset: 'Kendaraan Operasional',
          nama_aset: 'Kijang Innova G Diesel Matic',
          deskripsi: '| L 1402 FA | 2013 | Rusak |',
          gambar_url: ['https://drive.google.com/thumbnail?id=17qsCTj2H1raMe3me7vtH4cERUAG8F7NQ&sz=w1000'],
          harga_buka: 62160000,
          waktu_mulai: now.toISOString(),
          waktu_selesai: nextWeek.toISOString(),
          status_lelang: 'OPEN',
          kelipatan_bid: 100000
        },
        {
          kode_aset: 'BMS/DEL/KND/2026/003',
          jenis_aset: 'Kendaraan Operasional',
          nama_aset: 'Kijang lnnova G Diesel Matic',
          deskripsi: '| L 1530 PM | 2014 | Beroprasi |',
          gambar_url: ['https://drive.google.com/thumbnail?id=18n5ZAqKyRpzYeGS9kZZHaZPrY52yMyMH&sz=w1000'],
          harga_buka: 90300000,
          waktu_mulai: now.toISOString(),
          waktu_selesai: nextWeek.toISOString(),
          status_lelang: 'OPEN',
          kelipatan_bid: 100000
        },
        {
          kode_aset: 'BMS/DEL/IT/2026/001',
          jenis_aset: 'IT & Elektronik',
          nama_aset: 'PC Laptop Toshiba Portege R930',
          deskripsi: '| Tahun 2013 | Rusak |',
          gambar_url: ['https://drive.google.com/thumbnail?id=19cAPwefglfJByFbCQNGYWc6VJlonz8dH&sz=w1000'],
          harga_buka: 99750,
          waktu_mulai: now.toISOString(),
          waktu_selesai: nextWeek.toISOString(),
          status_lelang: 'OPEN',
          kelipatan_bid: 5000
        },
        {
          kode_aset: 'BMS/DEL/IT/2026/002',
          jenis_aset: 'IT & Elektronik',
          nama_aset: 'PC Laptop ASUS A46C',
          deskripsi: '| Tahun 2013 | Rusak |',
          gambar_url: ['https://drive.google.com/thumbnail?id=1q-kHz9TGFvPTQfDAeI9nTsCdKXt_zrx_&sz=w1000'],
          harga_buka: 99750,
          waktu_mulai: now.toISOString(),
          waktu_selesai: nextWeek.toISOString(),
          status_lelang: 'OPEN',
          kelipatan_bid: 5000
        },
        {
          kode_aset: 'BMS/DEL/IT/2026/003',
          jenis_aset: 'IT & Elektronik',
          nama_aset: 'PC Laptop Lenovo G400s',
          deskripsi: '| Tahun 2013 | Rusak |',
          gambar_url: ['https://drive.google.com/thumbnail?id=17qmDizcLNe0B5xfLmvgQ7wixq1AYWivI&sz=w1000'],
          harga_buka: 99750,
          waktu_mulai: now.toISOString(),
          waktu_selesai: nextWeek.toISOString(),
          status_lelang: 'OPEN',
          kelipatan_bid: 5000
        }
      ];

      const { error } = await supabase
        .from('assets')
        .upsert(defaultAssets, { onConflict: 'kode_aset' });

      if (error) throw error;
      alert('Berhasil seeding 6 aset default!');
      await fetchAssets();
    } catch (err: any) {
      console.error('Error seeding assets:', err);
      alert('Gagal seeding: ' + err.message);
    } finally {
      setLoadingAssets(false);
    }
  };

  const toDatetimeLocal = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const handleOpenEditModal = (asset: Asset) => {
    setEditingAsset({
      ...asset,
      waktu_mulai: toDatetimeLocal(asset.waktu_mulai),
      waktu_selesai: toDatetimeLocal(asset.waktu_selesai)
    });
    setEditAssetImages(null);
    setAssetError('');
    setAssetSuccess('');
    setIsEditModalOpen(true);
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setAssetError('');
    setAssetSuccess('');

    try {
      let urls = [...(editingAsset.gambar_url || [])];

      if (editAssetImages && editAssetImages.length > 0) {
        const newUrls: string[] = [];
        for (let i = 0; i < editAssetImages.length; i++) {
          const file = editAssetImages[i];
          const fileExt = file.name.split('.').pop();
          const filePath = `${Date.now()}_edit_${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('asset-images')
            .upload(filePath, file);

          if (uploadError) throw new Error(`Gagal mengunggah gambar baru: ${uploadError.message}`);

          const { data: publicUrlData } = supabase.storage
            .from('asset-images')
            .getPublicUrl(filePath);

          newUrls.push(publicUrlData.publicUrl);
        }
        urls = newUrls;
      }

      const { error: updateErr } = await supabase
        .from('assets')
        .update({
          jenis_aset: editingAsset.jenis_aset,
          nama_aset: editingAsset.nama_aset,
          deskripsi: editingAsset.deskripsi,
          harga_buka: parseFloat(editingAsset.harga_buka.toString()),
          kelipatan_bid: parseFloat(editingAsset.kelipatan_bid?.toString() || '0'),
          waktu_mulai: new Date(editingAsset.waktu_mulai).toISOString(),
          waktu_selesai: new Date(editingAsset.waktu_selesai).toISOString(),
          gambar_url: urls,
        })
        .eq('id', editingAsset.id);

      if (updateErr) throw updateErr;

      setAssetSuccess('Aset lelang berhasil diperbarui!');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditingAsset(null);
        setEditAssetImages(null);
      }, 1500);
      fetchAssets();
    } catch (err: any) {
      console.error('Error updating asset:', err);
      setAssetError('Gagal memperbarui aset: ' + err.message);
    }
  };

  const fetchActiveBids = async () => {
    setLoadingMonitor(true);
    try {
      const { data, error } = await supabase
        .from('view_active_bids')
        .select('*')
        .order('waktu_selesai', { ascending: true });

      if (error) throw error;
      setActiveBids(data || []);
    } catch (err) {
      console.error('Error fetching active bids:', err);
    } finally {
      setLoadingMonitor(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
      if (data && data.length > 0) {
        setNewAsset((prev) => ({ ...prev, jenis_aset: data[0].name }));
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategorySuccess('');
    setCategoryError('');
    try {
      const { error } = await supabase
        .from('categories')
        .insert({ name: newCategoryName.trim() });
      if (error) throw error;
      setCategorySuccess('Kategori berhasil ditambahkan!');
      setNewCategoryName('');
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err: any) {
      setCategoryError(err.message || 'Gagal menambahkan kategori.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus kategori ini?')) return;
    setCategorySuccess('');
    setCategoryError('');
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setCategorySuccess('Kategori berhasil dihapus!');
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err: any) {
      setCategoryError(err.message || 'Gagal menghapus kategori.');
    }
  };

  // --- User Verification Handlers ---
  const handleUpdateUserStatus = async (targetUserId: string, newStatus: UserProfile['status_akun']) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status_akun: newStatus })
        .eq('id', targetUserId);

      if (error) throw error;
      fetchUsersAndFields();
    } catch (err: any) {
      alert(`Gagal memperbarui status user: ${err.message}`);
    }
  };

  const handleUpdateUserRole = async (targetUserId: string, newRole: UserProfile['role']) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId);

      if (error) throw error;
      fetchUsersAndFields();
    } catch (err: any) {
      alert(`Gagal memperbarui role user: ${err.message}`);
    }
  };

  // --- Asset Management Handlers ---
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssetError('');
    setAssetSuccess('');

    try {
      const urls: string[] = [];

      // 1. Upload images if any
      if (assetImages && assetImages.length > 0) {
        for (let i = 0; i < assetImages.length; i++) {
          const file = assetImages[i];
          const fileExt = file.name.split('.').pop();
          const filePath = `${Date.now()}_${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('asset-images')
            .upload(filePath, file);

          if (uploadError) throw new Error(`Gagal mengunggah gambar: ${uploadError.message}`);

          const { data: publicUrlData } = supabase.storage
            .from('asset-images')
            .getPublicUrl(filePath);

          urls.push(publicUrlData.publicUrl);
        }
      }

      // 2. Insert Asset
      const { error: insertErr } = await supabase.from('assets').insert({
        kode_aset: newAsset.kode_aset,
        jenis_aset: newAsset.jenis_aset,
        nama_aset: newAsset.nama_aset,
        deskripsi: newAsset.deskripsi,
        harga_buka: parseFloat(newAsset.harga_buka),
        kelipatan_bid: parseFloat(newAsset.kelipatan_bid || '0'),
        waktu_mulai: new Date(newAsset.waktu_mulai).toISOString(),
        waktu_selesai: new Date(newAsset.waktu_selesai).toISOString(),
        gambar_url: urls,
      });

      if (insertErr) throw insertErr;

      setAssetSuccess('Aset lelang berhasil ditambahkan!');
      setNewAsset({
        kode_aset: '',
        jenis_aset: categories[0]?.name || '',
        nama_aset: '',
        deskripsi: '',
        harga_buka: '',
        kelipatan_bid: '10000',
        waktu_mulai: '',
        waktu_selesai: '',
      });
      setAssetImages(null);
      fetchAssets();
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAssetSuccess('');
      }, 1500);
    } catch (err: any) {
      setAssetError(err.message || 'Gagal menambahkan aset.');
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus aset ini secara permanen?')) return;

    try {
      const { error } = await supabase.from('assets').delete().eq('id', assetId);
      if (error) throw error;
      fetchAssets();
    } catch (err: any) {
      alert(`Gagal menghapus aset: ${err.message}`);
    }
  };

  const handleCancelAuction = async (assetId: string) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan lelang aset ini?')) return;

    try {
      const { error } = await supabase
        .from('assets')
        .update({ status_lelang: 'CANCEL' })
        .eq('id', assetId);

      if (error) throw error;
      fetchAssets();
      fetchActiveBids();
    } catch (err: any) {
      alert(`Gagal membatalkan lelang: ${err.message}`);
    }
  };

  // --- Registration Field Handlers ---
  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('registration_fields').insert({
        field_name: newField.field_name.toLowerCase().trim().replace(/\s+/g, '_'),
        label: newField.label,
        field_type: newField.field_type,
        is_required: newField.is_required,
      });

      if (error) throw error;

      setNewField({
        field_name: '',
        label: '',
        field_type: 'text',
        is_required: false,
      });
      fetchUsersAndFields();
    } catch (err: any) {
      alert(`Gagal menambah field: ${err.message}`);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kolom pendaftaran ini?')) return;

    try {
      const { error } = await supabase.from('registration_fields').delete().eq('id', fieldId);
      if (error) throw error;
      fetchUsersAndFields();
    } catch (err: any) {
      alert(`Gagal menghapus field: ${err.message}`);
    }
  };

  // --- Bidding Monitor Handlers ---
  const handleCancelHighestBid = async (assetId: string) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan penawaran tertinggi saat ini untuk aset ini?')) return;

    try {
      // 1. Find the highest valid bid for this asset
      const { data: highestBid, error: fetchErr } = await supabase
        .from('bids')
        .select('id')
        .eq('asset_id', assetId)
        .eq('status_bid', 'VALID')
        .order('nominal_bid', { ascending: false })
        .limit(1)
        .single();

      if (fetchErr || !highestBid) {
        throw new Error('Tidak ditemukan penawaran aktif untuk dibatalkan.');
      }

      // 2. Mark it as CANCELLED
      const { error: updateErr } = await supabase
        .from('bids')
        .update({ status_bid: 'CANCELLED' })
        .eq('id', highestBid.id);

      if (updateErr) throw updateErr;

      alert('Penawaran tertinggi berhasil dibatalkan.');
      fetchActiveBids();
    } catch (err: any) {
      alert(`Gagal membatalkan bid: ${err.message}`);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-8 text-left">
      <div>
        <h2 className="text-2xl font-black text-slate-850 dark:text-white flex items-center gap-2.5 tracking-tight">
          <Settings className="text-brand-500" size={24} /> Panel Administrasi (BMS)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-450 mt-1">Verifikasi user, kelola aset, konfigurasi form registrasi, dan pantau bidding lelang</p>
      </div>
 
      {/* Tabs Select */}
      <div className="p-2 rounded-2xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[inset_3px_3px_6px_#c8cbd4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#0e141d,inset_-3px_-3px_6px_#2e3e59] grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2.5 px-3 sm:px-5 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'users'
              ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold'
              : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-y-[0.5px]'
          }`}
        >
          Verifikasi User
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={`py-2.5 px-3 sm:px-5 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'assets'
              ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold'
              : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-y-[0.5px]'
          }`}
        >
          Kelola Aset Lelang
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`py-2.5 px-3 sm:px-5 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'fields'
              ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold'
              : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-y-[0.5px]'
          }`}
        >
          Pengaturan Form
        </button>
        <button
          onClick={() => setActiveTab('monitor')}
          className={`py-2.5 px-3 sm:px-5 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'monitor'
              ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold'
              : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-y-[0.5px]'
          }`}
        >
          Monitor Penawaran
        </button>
      </div>
 
      {/* --- Tab 1: Users --- */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {loadingUsers ? (
            <div className="text-center py-12 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto mb-4" />
              <p className="text-sm font-semibold">Memuat Data Pengguna...</p>
            </div>
          ) : (
            <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-5 sm:p-8">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest bg-slate-100/40 dark:bg-slate-950/20">
                      <th className="py-4 px-6 rounded-l-2xl">Email / Nama</th>
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Data Pendaftaran</th>
                      <th className="py-4 px-6">Status Akun</th>
                      <th className="py-4 px-6 text-center rounded-r-2xl">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/20 transition-all">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-855 dark:text-white">{user.nama_lengkap || 'Pengguna Baru'}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">{user.email}</div>
                        </td>
                        <td className="py-4 px-6">
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value as UserProfile['role'])}
                            className="bg-[#f1f2f5] dark:bg-[#1e293b] rounded-lg py-1.5 px-3 text-xs text-slate-800 dark:text-white outline-none border border-white dark:border-slate-800 shadow-[inset_1px_1px_2px_#c8cbd4] dark:shadow-[inset_1px_1px_2px_#0e141d]"
                          >
                            <option value="BIDDER">BIDDER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td className="py-4 px-6 space-y-2 max-w-xs">
                          {fields.map((field) => {
                            const val = user.additional_data?.[field.field_name];
                            if (!val) return null;
                            const isFile = field.field_type === 'file';
                            return (
                              <div key={field.field_name} className="text-[10px] bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_1px_1px_2.5px_#c8cbd4] dark:shadow-[inset_1px_1px_2.5px_#0e141d] px-2.5 py-1.5 rounded-lg border border-white/40 dark:border-slate-850 flex flex-wrap items-center justify-between gap-1">
                                <span className="font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">{field.label}:</span>
                                {isFile ? (
                                  <a
                                    href={val}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand-600 dark:text-brand-400 hover:underline font-bold inline-flex items-center gap-0.5"
                                  >
                                    <FileText size={10} /> Lihat Berkas
                                  </a>
                                ) : (
                                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{val}</span>
                                )}
                              </div>
                            );
                          })}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider ${
                              user.status_akun === 'AKTIF'
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : user.status_akun === 'PENDING'
                                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {user.status_akun}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleUpdateUserStatus(user.id, 'AKTIF')}
                              disabled={user.status_akun === 'AKTIF'}
                              className="btn-neu p-2 text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-500 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                              title="Aktifkan Akun"
                            >
                              <ShieldCheck size={16} />
                            </button>
                            <button
                              onClick={() => handleUpdateUserStatus(user.id, 'BLOKIR')}
                              disabled={user.status_akun === 'BLOKIR'}
                              className="btn-neu p-2 text-rose-500 dark:text-rose-400 hover:text-white hover:bg-rose-500 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                              title="Blokir Akun"
                            >
                              <Ban size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-4">
                {users.map((user) => (
                  <div 
                    key={user.id}
                    className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/40 dark:border-slate-800/40 p-4.5 rounded-2xl shadow-[inset_2px_2px_5px_#c8cbd4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_#0e141d,inset_-2px_-2px_5px_#2e3e59] space-y-3.5 text-xs text-slate-700 dark:text-slate-200 text-left"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-slate-855 dark:text-white text-sm">{user.nama_lengkap || 'Pengguna Baru'}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">{user.email}</div>
                      </div>
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider shrink-0 ${
                          user.status_akun === 'AKTIF'
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : user.status_akun === 'PENDING'
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {user.status_akun}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/20 dark:border-slate-800/20">
                      <div>
                        <span className="text-[9px] text-slate-455 dark:text-slate-500 font-bold block uppercase tracking-wider mb-1">Peran Akun</span>
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.id, e.target.value as UserProfile['role'])}
                          className="bg-[#f1f2f5] dark:bg-[#1e293b] rounded-lg py-1 px-2 text-[11px] text-slate-800 dark:text-white outline-none border border-slate-200 dark:border-slate-800 shadow-[inset_1px_1px_2px_#c8cbd4] dark:shadow-[inset_1px_1px_2px_#0e141d]"
                        >
                          <option value="BIDDER">BIDDER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-slate-455 dark:text-slate-500 font-bold block uppercase tracking-wider mb-1">Verifikasi</span>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUpdateUserStatus(user.id, 'AKTIF')}
                            disabled={user.status_akun === 'AKTIF'}
                            className="btn-neu p-2 text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-500 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                            title="Aktifkan Akun"
                          >
                            <ShieldCheck size={14} />
                          </button>
                          <button
                            onClick={() => handleUpdateUserStatus(user.id, 'BLOKIR')}
                            disabled={user.status_akun === 'BLOKIR'}
                            className="btn-neu p-2 text-rose-500 dark:text-rose-400 hover:text-white hover:bg-rose-500 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                            title="Blokir Akun"
                          >
                            <Ban size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Data pendaftaran dinamis */}
                    <div className="space-y-1.5 pt-2.5 border-t border-slate-200/20 dark:border-slate-800/20">
                      <span className="text-[9px] text-slate-455 dark:text-slate-500 font-bold block uppercase tracking-wider mb-1">Data Pendaftaran</span>
                      <div className="space-y-1.5">
                        {fields.map((field) => {
                          const val = user.additional_data?.[field.field_name];
                          if (!val) return null;
                          const isFile = field.field_type === 'file';
                          return (
                            <div key={field.field_name} className="text-[10px] bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_1px_1px_2.5px_#c8cbd4] dark:shadow-[inset_1px_1px_2.5px_#0e141d] px-2.5 py-1.5 rounded-lg border border-white/40 dark:border-slate-850 flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wider">{field.label}:</span>
                              {isFile ? (
                                <a
                                  href={val}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-600 dark:text-brand-400 hover:underline font-bold inline-flex items-center gap-0.5"
                                >
                                  <FileText size={10} /> Lihat Berkas
                                </a>
                              ) : (
                                <span className="text-slate-700 dark:text-slate-300 font-semibold">{val}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
 
      {/* --- Tab 2: Assets --- */}
      {activeTab === 'assets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Katalog Aset (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-3.5 text-left">
              <h3 className="text-base font-bold text-slate-850 dark:text-white">Katalog Aset Aktif</h3>
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={handleSeedAssets}
                  className="btn-neu py-2 px-3.5 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                  title="Seed default assets for testing"
                >
                  ⚡ Seed Aset
                </button>
                <button
                  onClick={handleExtendAllAuctions}
                  className="btn-neu py-2 px-3.5 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                  title="Extend all auction end times to 7 days from now"
                >
                  ⚡ Perpanjang (7 Hari)
                </button>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn-brand-neu py-2 px-3.5 text-[10px] font-bold"
                >
                  + Tambah Aset Baru
                </button>
              </div>
            </div>
 
            {loadingAssets ? (
              <div className="text-center py-12 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assets.map((asset) => (
                  <div key={asset.id} className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[4px_4px_8px_#d5d8df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#0e141d,-4px_-4px_8px_#2e3e59] rounded-2xl p-5 flex gap-4 items-center justify-between transition-all hover:translate-y-[-1.5px]">
                    <div className="flex gap-3.5 items-center min-w-0">
                      <div className="h-16 w-16 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
                        {asset.gambar_url[0] ? (
                          <img src={asset.gambar_url[0]} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[8px] text-slate-400 dark:text-slate-600 uppercase font-bold">No Img</div>
                        )}
                      </div>
                      <div className="text-left min-w-0">
                        <span className="text-[8px] font-mono font-bold text-brand-650 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 uppercase tracking-widest block w-fit">
                          {asset.kode_aset}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate mt-1 leading-normal">{asset.nama_aset}</h4>
                        <p className="text-[9px] text-slate-500 dark:text-slate-450 mt-0.5 truncate">{asset.jenis_aset} | Kelipatan: {formatRupiah(asset.kelipatan_bid)}</p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-455">Sisa: {new Date(asset.waktu_selesai).toLocaleString()}</p>
                      </div>
                    </div>
 
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[8px] block text-slate-400 font-bold uppercase tracking-widest mb-0.5">Harga Buka</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatRupiah(asset.harga_buka)}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(asset)}
                          className="btn-neu p-2 text-brand-650 dark:text-brand-400 hover:text-white hover:bg-brand-500"
                          title="Edit Aset"
                        >
                          <Pencil size={12} />
                        </button>
                        {asset.status_lelang === 'OPEN' && (
                          <button
                            onClick={() => handleCancelAuction(asset.id)}
                            className="btn-neu px-2 py-1.5 text-rose-500 hover:text-white hover:bg-rose-500 text-[10px] font-bold"
                            title="Batalkan Lelang"
                          >
                            Batal
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="btn-neu p-2 text-slate-455 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400"
                          title="Hapus Aset"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
 
          {/* Kelola Kategori (1/3 width) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-6 h-fit">
              <h3 className="text-base font-bold text-slate-850 dark:text-white mb-5 border-b border-slate-200 dark:border-slate-800 pb-2">Kelola Kategori</h3>
 
              {categorySuccess && <div className="mb-4 text-xs bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 font-semibold">{categorySuccess}</div>}
              {categoryError && <div className="mb-4 text-xs bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-rose-600 dark:text-rose-400 font-semibold">{categoryError}</div>}
 
              {/* Add category form */}
              <form onSubmit={handleCreateCategory} className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Nama Kategori Baru</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alat Berat"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-brand-neu w-full py-2.5 font-bold text-xs"
                >
                  Tambah Kategori
                </button>
              </form>
 
              {/* Categories list */}
              <div className="space-y-3">
                <span className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1">Daftar Kategori</span>
                {loadingCategories ? (
                  <div className="text-slate-400 text-xs">Loading...</div>
                ) : categories.length === 0 ? (
                  <div className="text-slate-450 text-xs italic pl-1">Belum ada kategori.</div>
                ) : (
                  <div className="divide-y divide-slate-200/60 dark:divide-slate-800/40 max-h-60 overflow-y-auto pr-1">
                    {categories.map((cat) => (
                      <div key={cat.id} className="py-3 flex justify-between items-center text-xs text-slate-700 dark:text-slate-350">
                        <span className="font-bold">{cat.name}</span>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="btn-neu p-1 px-2.5 text-rose-500 hover:text-white hover:bg-rose-500 text-xs font-black transition cursor-pointer"
                          title="Hapus Kategori"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
 
          {/* Add Asset Modal Overlay */}
          {isAddModalOpen && (
            <div
              className="fixed inset-0 z-50 bg-[#1e293b]/70 dark:bg-[#0e141d]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setIsAddModalOpen(false)}
            >
              <div
                className="w-full max-w-lg bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[12px_12px_24px_#d5d8df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#0e141d,-12px_-12px_24px_#2e3e59] rounded-3xl p-8 sm:p-10 relative animate-fade-in-up max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-neu absolute top-4 right-4 text-slate-500 hover:text-rose-500 transition cursor-pointer text-xs font-black p-2 px-3"
                >
                  ✕
                </button>
                <h3 className="text-base font-bold text-slate-850 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-800 pb-3 text-left">Tambah Aset Baru</h3>
 
                {assetSuccess && <div className="mb-4 text-xs bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 font-semibold">{assetSuccess}</div>}
                {assetError && <div className="mb-4 text-xs bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-rose-600 dark:text-rose-400 font-semibold">{assetError}</div>}
 
                <form onSubmit={handleCreateAsset} className="space-y-4 text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Kode Aset (Lot)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. BMS/DEL/KND/2026/001"
                        value={newAsset.kode_aset}
                        onChange={(e) => setNewAsset((prev) => ({ ...prev, kode_aset: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Kategori</label>
                      <select
                        value={newAsset.jenis_aset}
                        onChange={(e) => setNewAsset((prev) => ({ ...prev, jenis_aset: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
 
                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Nama Aset</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Toyota Hilux Single Cabin"
                      value={newAsset.nama_aset}
                      onChange={(e) => setNewAsset((prev) => ({ ...prev, nama_aset: e.target.value }))}
                      className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                    />
                  </div>
 
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Harga Buka (Rp)</label>
                      <input
                        type="number"
                        required
                        placeholder="16485000"
                        value={newAsset.harga_buka}
                        onChange={(e) => setNewAsset((prev) => ({ ...prev, harga_buka: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Kelipatan Bid (Rp)</label>
                      <input
                        type="number"
                        required
                        placeholder="100000"
                        value={newAsset.kelipatan_bid}
                        onChange={(e) => setNewAsset((prev) => ({ ...prev, kelipatan_bid: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                  </div>
 
                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Deskripsi & Spesifikasi</label>
                    <textarea
                      rows={3}
                      placeholder="Kondisi barang, kelengkapan, dll."
                      value={newAsset.deskripsi}
                      onChange={(e) => setNewAsset((prev) => ({ ...prev, deskripsi: e.target.value }))}
                      className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                    />
                  </div>
 
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Waktu Mulai</label>
                      <input
                        type="datetime-local"
                        required
                        value={newAsset.waktu_mulai}
                        onChange={(e) => setNewAsset((prev) => ({ ...prev, waktu_mulai: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Waktu Selesai</label>
                      <input
                        type="datetime-local"
                        required
                        value={newAsset.waktu_selesai}
                        onChange={(e) => setNewAsset((prev) => ({ ...prev, waktu_selesai: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                  </div>
 
                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Unggah Gambar (Multi)</label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-slate-350 dark:border-slate-800 bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_2px_2px_4px_#d5d8df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition p-4">
                        <div className="flex flex-col items-center justify-center pt-3 pb-3">
                          <Image size={20} className="text-slate-500 mb-1" />
                          <p className="text-[10px] text-slate-655 dark:text-slate-400 font-semibold">
                            {assetImages ? `${assetImages.length} berkas dipilih` : 'Klik untuk pilih gambar'}
                          </p>
                        </div>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => setAssetImages(e.target.files)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
 
                  <button
                    type="submit"
                    className="btn-brand-neu w-full py-3.5 font-bold text-xs uppercase tracking-wider mt-4"
                  >
                    Buat Aset & Rilis Lelang
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Edit Asset Modal Overlay */}
          {isEditModalOpen && editingAsset && (
            <div
              className="fixed inset-0 z-50 bg-[#1e293b]/70 dark:bg-[#0e141d]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
              onClick={() => setIsEditModalOpen(false)}
            >
              <div
                className="w-full max-w-lg bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[12px_12px_24px_#d5d8df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#0e141d,-12px_-12px_24px_#2e3e59] rounded-3xl p-8 sm:p-10 relative animate-fade-in-up max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-neu absolute top-4 right-4 text-slate-500 hover:text-rose-500 transition cursor-pointer text-xs font-black p-2 px-3"
                >
                  ✕
                </button>
                <h3 className="text-base font-bold text-slate-850 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-800 pb-3 text-left">Edit Aset Lelang</h3>

                {assetSuccess && <div className="mb-4 text-xs bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 font-semibold">{assetSuccess}</div>}
                {assetError && <div className="mb-4 text-xs bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-rose-600 dark:text-rose-400 font-semibold">{assetError}</div>}

                <form onSubmit={handleUpdateAsset} className="space-y-4 text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Kode Aset (Lot)</label>
                      <input
                        type="text"
                        disabled
                        value={editingAsset.kode_aset}
                        className="w-full bg-slate-200 dark:bg-slate-800/50 rounded-xl py-2.5 px-3.5 text-xs text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Kategori</label>
                      <select
                        value={editingAsset.jenis_aset}
                        onChange={(e) => setEditingAsset((prev: any) => ({ ...prev, jenis_aset: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Nama Aset</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Toyota Hilux Single Cabin"
                      value={editingAsset.nama_aset}
                      onChange={(e) => setEditingAsset((prev: any) => ({ ...prev, nama_aset: e.target.value }))}
                      className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Harga Buka (Rp)</label>
                      <input
                        type="number"
                        required
                        placeholder="16485000"
                        value={editingAsset.harga_buka}
                        onChange={(e) => setEditingAsset((prev: any) => ({ ...prev, harga_buka: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Kelipatan Bid (Rp)</label>
                      <input
                        type="number"
                        required
                        placeholder="100000"
                        value={editingAsset.kelipatan_bid}
                        onChange={(e) => setEditingAsset((prev: any) => ({ ...prev, kelipatan_bid: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Deskripsi & Spesifikasi</label>
                    <textarea
                      rows={3}
                      placeholder="Kondisi barang, kelengkapan, dll."
                      value={editingAsset.deskripsi || ''}
                      onChange={(e) => setEditingAsset((prev: any) => ({ ...prev, deskripsi: e.target.value }))}
                      className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Waktu Mulai</label>
                      <input
                        type="datetime-local"
                        required
                        value={editingAsset.waktu_mulai}
                        onChange={(e) => setEditingAsset((prev: any) => ({ ...prev, waktu_mulai: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Waktu Selesai</label>
                      <input
                        type="datetime-local"
                        required
                        value={editingAsset.waktu_selesai}
                        onChange={(e) => setEditingAsset((prev: any) => ({ ...prev, waktu_selesai: e.target.value }))}
                        className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Unggah Gambar Baru (Mengganti Gambar Lama)</label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-slate-350 dark:border-slate-800 bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_2px_2px_4px_#d5d8df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition p-4">
                        <div className="flex flex-col items-center justify-center pt-3 pb-3">
                          <Image size={20} className="text-slate-500 mb-1" />
                          <p className="text-[10px] text-slate-655 dark:text-slate-400 font-semibold">
                            {editAssetImages ? `${editAssetImages.length} berkas dipilih` : 'Klik untuk pilih gambar baru'}
                          </p>
                        </div>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => setEditAssetImages(e.target.files)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-brand-neu w-full py-3.5 font-bold text-xs uppercase tracking-wider mt-4"
                  >
                    Simpan Perubahan
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
 
      {/* --- Tab 3: Fields --- */}
      {activeTab === 'fields' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-6 h-fit">
            <h3 className="text-base font-bold text-slate-850 dark:text-white mb-5 border-b border-slate-200 dark:border-slate-800 pb-2">Tambah Kolom Baru</h3>
            <form onSubmit={handleAddField} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Nama Kolom (Database Key)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. no_karyawan"
                  value={newField.field_name}
                  onChange={(e) => setNewField((prev) => ({ ...prev, field_name: e.target.value }))}
                  className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                />
              </div>
 
              <div>
                <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Label Tampilan (Frontend)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nomor Karyawan"
                  value={newField.label}
                  onChange={(e) => setNewField((prev) => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                />
              </div>
 
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Tipe Input</label>
                  <select
                    value={newField.field_type}
                    onChange={(e) => setNewField((prev) => ({ ...prev, field_type: e.target.value as RegistrationField['field_type'] }))}
                    className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-2.5 px-3.5 text-xs text-slate-800 dark:text-white outline-none"
                  >
                    <option value="text">Teks biasa</option>
                    <option value="number">Angka</option>
                    <option value="email">Email</option>
                    <option value="tel">Telepon</option>
                    <option value="file">File (PDF/Gambar)</option>
                    <option value="textarea">Teks Panjang</option>
                  </select>
                </div>
                 <div className="flex flex-col justify-end pb-2 pl-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newField.is_required}
                      onChange={(e) => setNewField((prev) => ({ ...prev, is_required: e.target.checked }))}
                      className="rounded border-slate-300 dark:border-slate-800 bg-[#f1f2f5] dark:bg-[#1e293b] text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Wajib Diisi</span>
                  </label>
                </div>
              </div>
 
              <button
                type="submit"
                className="btn-brand-neu w-full py-2.5 font-bold text-xs"
              >
                Tambahkan Kolom
              </button>
            </form>
          </div>
 
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-slate-855 dark:text-white mb-2 pl-1">Kolom Pendaftaran Saat Ini</h3>
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.id} className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[4px_4px_8px_#d5d8df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#0e141d,-4px_-4px_8px_#2e3e59] rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-850 dark:text-white">{field.label}</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">Key: <code className="text-slate-650 dark:text-slate-300 font-bold">{field.field_name}</code> | Tipe: <span className="text-brand-600 dark:text-brand-400 font-bold">{field.field_type}</span></p>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <span className={`text-[9px] font-bold tracking-widest px-2.5 py-1 rounded border ${
                      field.is_required 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                        : 'bg-slate-200/50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      {field.is_required ? 'WAJIB' : 'OPSIONAL'}
                    </span>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="btn-neu p-2 text-slate-450 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-455 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
 
      {/* --- Tab 4: Monitor --- */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">
          {loadingMonitor ? (
            <div className="text-center py-12 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto" />
            </div>
          ) : (
            <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-5 sm:p-8">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest bg-slate-100/40 dark:bg-slate-950/20">
                      <th className="py-4 px-6 rounded-l-2xl">Nama Aset</th>
                      <th className="py-4 px-6 text-right">Bid Tertinggi</th>
                      <th className="py-4 px-6">Pemenang Sementara</th>
                      <th className="py-4 px-6 text-center">Status Lelang</th>
                      <th className="py-4 px-6 text-center rounded-r-2xl">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-200">
                    {activeBids.map((bid) => (
                      <tr key={bid.asset_id} className="hover:bg-slate-100/40 dark:hover:bg-slate-800/20 transition-all">
                        <td className="py-4.5 px-6 font-bold text-slate-855 dark:text-white">{bid.nama_aset}</td>
                        <td className="py-4.5 px-6 text-right font-black text-brand-650 dark:text-brand-400">{formatRupiah(bid.current_highest_bid)}</td>
                        <td className="py-4.5 px-6">
                          {bid.winner_id ? (
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">{bid.winner_name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">{bid.winner_email}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">- Belum ada bid -</span>
                          )}
                        </td>
                        <td className="py-4.5 px-6 text-center">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider ${
                              bid.computed_status === 'OPEN'
                                ? 'bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400'
                                : bid.computed_status === 'CLOSED'
                                ? 'bg-slate-200/60 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                            }`}
                          >
                            {bid.computed_status}
                          </span>
                        </td>
                        <td className="py-4.5 px-6 text-center">
                          {bid.computed_status === 'OPEN' && bid.winner_id && (
                            <button
                              onClick={() => handleCancelHighestBid(bid.asset_id)}
                              className="btn-neu px-3 py-1.5 text-rose-500 hover:text-white hover:bg-rose-500 text-[10px] font-bold"
                            >
                              Batalkan Bid Terakhir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-4">
                {activeBids.map((bid) => (
                  <div 
                    key={bid.asset_id}
                    className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/40 dark:border-slate-800/40 p-4.5 rounded-2xl shadow-[inset_2px_2px_5px_#c8cbd4,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_#0e141d,inset_-2px_-2px_5px_#2e3e59] space-y-3 text-xs text-slate-700 dark:text-slate-200 text-left"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-slate-855 dark:text-white leading-snug">{bid.nama_aset}</span>
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider shrink-0 ${
                          bid.computed_status === 'OPEN'
                            ? 'bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400'
                            : bid.computed_status === 'CLOSED'
                            ? 'bg-slate-200/60 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                        }`}
                      >
                        {bid.computed_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/20 dark:border-slate-800/20">
                      <div>
                        <span className="text-[9px] text-slate-455 dark:text-slate-500 font-bold block uppercase tracking-wider">Bid Tertinggi</span>
                        <span className="font-extrabold text-brand-650 dark:text-brand-400 text-xs block mt-0.5">{formatRupiah(bid.current_highest_bid)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-455 dark:text-slate-500 font-bold block uppercase tracking-wider">Pemenang Sementara</span>
                        {bid.winner_id ? (
                          <div className="mt-0.5">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{bid.winner_name}</div>
                            <div className="text-[9px] text-slate-500 dark:text-slate-450">{bid.winner_email}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic block mt-0.5">- Belum ada bid -</span>
                        )}
                      </div>
                    </div>

                    {bid.computed_status === 'OPEN' && bid.winner_id && (
                      <div className="pt-2.5 border-t border-slate-200/20 dark:border-slate-800/20 flex justify-end">
                        <button
                          onClick={() => handleCancelHighestBid(bid.asset_id)}
                          className="btn-neu w-full py-2 text-rose-500 hover:text-white hover:bg-rose-500 text-[10px] font-bold"
                        >
                          Batalkan Bid Terakhir
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
