import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import type { Profile as UserProfile } from './types';
import { Login } from './components/Login';
import { CompleteProfile, AwaitingApproval } from './components/CompleteProfile';
import { Profile as UserProfileTab, BlockedUser } from './components/Profile';
import { BiddingGallery } from './components/BiddingGallery';
import { MyBids } from './components/MyBids';
import { AdminDashboard } from './components/AdminDashboard';
import { LogOut, User, Gavel, ShoppingBag, LayoutDashboard, Shield, Sun, Moon, LayoutGrid } from 'lucide-react';
import { BiddingFormModal } from './components/BiddingFormModal';

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gallery' | 'my-bids' | 'profile' | 'admin'>('gallery');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [selectedBidAssetId, setSelectedBidAssetId] = useState<string | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'gallery':
        return 'Galeri Aset Lelang';
      case 'my-bids':
        return 'Histori Lelang Saya';
      case 'profile':
        return 'Profil Saya';
      case 'admin':
        return 'Panel Administrator';
      default:
        return 'BMS Bidding Portal';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto mb-4" />
          <p className="text-sm">Memuat Aplikasi...</p>
        </div>
      </div>
    );
  }

  // State 1: Not logged in
  if (!session) {
    return <Login onLoginSuccess={() => setLoading(true)} />;
  }

  // State 2: Logged in, but profile record not created or incomplete
  const hasIncompleteProfile = !profile || !profile.nama_lengkap || Object.keys(profile.additional_data || {}).length === 0;

  if (hasIncompleteProfile) {
    return (
      <CompleteProfile
        userId={session.user.id}
        userEmail={session.user.email}
        onSubmissionSuccess={() => {
          setLoading(true);
          fetchProfile(session.user.id);
        }}
      />
    );
  }

  // State 3: Awaiting admin verification
  if (profile.status_akun === 'PENDING') {
    return (
      <AwaitingApproval
        userEmail={session.user.email}
        onCheckStatus={() => {
          setLoading(true);
          fetchProfile(session.user.id);
        }}
      />
    );
  }

  // State 4: Blocked / Suspended
  if (profile.status_akun === 'BLOKIR') {
    return <BlockedUser userEmail={session.user.email} />;
  }

  // State 5: Active (Approved) User - Show Main App Layout matching original dashboard
  return (
    <div className="min-h-screen bg-[#f1f2f5] dark:bg-[#1e293b] text-slate-800 dark:text-slate-100 flex flex-row overflow-hidden">
      
      {/* DESKTOP LEFT SIDEBAR */}
      <aside className="hidden lg:flex flex-col justify-between w-80 bg-[#f1f2f5] dark:bg-[#1e293b] border-r border-[#d5d8df]/40 dark:border-[#0e141d]/40 p-8 h-screen sticky top-0 shrink-0 z-10">
        <div className="space-y-8 flex flex-col h-full">
          
          {/* Sidebar Header / Logo */}
          <div className="flex items-center gap-3.5">
            <div className="bg-[#f1f2f5] dark:bg-[#1e293b] p-2 rounded-2xl border border-white dark:border-slate-800 shadow-[4px_4px_8px_#d5d8df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#0e141d,-4px_-4px_8px_#2e3e59] h-10 w-auto flex items-center justify-center">
              <img
                src="/images/Logo-Berlian-Manyar-Sejahtera.png"
                alt="BMS Logo"
                className="h-6 object-contain"
              />
            </div>
            <div className="text-left leading-none">
              <span className="block text-xs font-black tracking-wider uppercase text-slate-850 dark:text-white leading-none">PT. BMS</span>
              <span className="text-[8px] text-slate-450 dark:text-slate-550 font-bold tracking-wider uppercase">Bidding Assets</span>
            </div>
          </div>
 
          {/* User Profile Card */}
          <div className="p-6 rounded-2xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] flex flex-col items-center text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-500 to-indigo-650 flex items-center justify-center text-white shadow-md font-bold text-xl uppercase border-2 border-brand-500">
                {profile.nama_lengkap ? profile.nama_lengkap.charAt(0) : profile.email.charAt(0)}
              </div>
              <div
                className="absolute -bottom-1 -right-1 bg-brand-500 text-white rounded-full p-1 border border-white dark:border-slate-900 shadow-sm"
                title={`${profile.role} Role`}
              >
                <Shield size={10} />
              </div>
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1 w-full">
              {profile.nama_lengkap}
            </h4>
            <p className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-500 uppercase mt-0.5 max-w-full truncate">
              {profile.role}
            </p>
          </div>
 
          {/* Sidebar Navigation */}
          <div className="flex-grow space-y-3 mt-4 text-left">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Menu Utama</span>
 
            <button
              onClick={() => {
                setActiveTab('gallery');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'gallery'
                  ? 'tab-active-neu text-brand-600 dark:text-brand-400 font-bold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-x-1 border border-transparent'
              }`}
            >
              <Gavel size={16} />
              <span>Galeri Aset Lelang</span>
            </button>
 
            <button
              onClick={() => {
                setActiveTab('my-bids');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'my-bids'
                  ? 'tab-active-neu text-brand-600 dark:text-brand-400 font-bold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-x-1 border border-transparent'
              }`}
            >
              <ShoppingBag size={16} />
              <span>Histori Lelang</span>
            </button>
 
            <button
              onClick={() => {
                setActiveTab('profile');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold text-left transition-all ${
                activeTab === 'profile'
                  ? 'tab-active-neu text-brand-600 dark:text-brand-400 font-bold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-x-1 border border-transparent'
              }`}
            >
              <User size={16} />
              <span>Profil Saya</span>
            </button>
 
            {profile.role === 'ADMIN' && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Panel Admin</span>
                <button
                  onClick={() => {
                    setActiveTab('admin');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold text-left transition-all ${
                    activeTab === 'admin'
                      ? 'tab-active-neu text-brand-600 dark:text-brand-400 font-bold'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:translate-x-1 border border-transparent'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  <span>Panel Administrator</span>
                </button>
              </div>
            )}
          </div>
 
          {/* Sidebar Footer */}
          <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 space-y-4">
            {/* Theme Toggle Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[inset_2px_2px_4px_#d5d8df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59]">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 select-none">
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                Mode Gelap
              </span>
              <button
                onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  theme === 'dark' ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
 
            <button
              onClick={handleSignOut}
              className="btn-danger-neu w-full py-3.5 flex items-center justify-center gap-2 font-bold text-xs cursor-pointer select-none"
            >
              <LogOut size={13} strokeWidth={2.5} className="shrink-0" />
              <span className="leading-none mt-0.5">Keluar Sesi</span>
            </button>
            <div className="text-center text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest pt-3">
              App Dev v2.0.0
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE CONTAINER (HIDDEN ON DESKTOP SIDEBAR) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* iOS style Navigation Bar */}
        {/* iOS style Navigation Bar */}
        <header className="h-14 border-b border-slate-200/40 dark:border-slate-800/30 bg-[#f1f2f5]/80 dark:bg-[#1e293b]/80 backdrop-blur-xl px-4 flex items-center justify-between shrink-0 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded-lg border border-slate-200/50 shadow-sm h-6 w-auto flex items-center justify-center lg:hidden">
              <img src="/images/Logo-Berlian-Manyar-Sejahtera.png" className="h-4 object-contain" />
            </div>
            <h1 className="text-sm font-extrabold text-slate-850 dark:text-white tracking-tight">
              {getTabTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3.5">
            {/* Quick access theme toggle */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[2px_2px_4.5px_#d5d8df,-2px_-2px_4.5px_#ffffff] dark:shadow-[2px_2px_4.5px_#0e141d,-2px_-2px_4.5px_#2e3e59] text-slate-655 dark:text-slate-350 transition-all cursor-pointer hover:translate-y-[0.5px] active:scale-95 flex items-center justify-center h-8 w-8"
              title="Toggle Tema"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 p-1 rounded-full transition-all active:scale-95 cursor-pointer border ${
                activeTab === 'profile'
                  ? 'bg-brand-500/15 border-brand-500/40'
                  : 'bg-slate-200/40 dark:bg-slate-800/40 border-slate-200/50 dark:border-slate-800'
              }`}
              title="Buka Profil Saya"
            >
              <div className="text-right hidden sm:block pl-1">
                <span className="block text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-none">{profile.nama_lengkap || 'User'}</span>
                <span className="text-[7px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest">{profile.role}</span>
              </div>
              <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 pl-2 pr-0.5 uppercase tracking-wider sm:hidden">Profil</span>
              <div className="h-6 w-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold uppercase select-none shadow-sm">
                {profile.nama_lengkap ? profile.nama_lengkap.charAt(0) : profile.email.charAt(0)}
              </div>
            </button>
          </div>
        </header>

        {/* Scrollable Content Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 lg:pb-8">
          {activeTab === 'gallery' && (
            <BiddingGallery 
              userId={profile.id} 
              isAdmin={profile.role === 'ADMIN'} 
              onOpenBidModal={(assetId) => {
                setSelectedBidAssetId(assetId);
                setIsBidModalOpen(true);
              }}
            />
          )}
          {activeTab === 'my-bids' && <MyBids userId={profile.id} />}
          {activeTab === 'profile' && profile && (
            <UserProfileTab
              profile={profile}
              onProfileUpdate={() => fetchProfile(session.user.id)}
            />
          )}
          {activeTab === 'admin' && profile.role === 'ADMIN' && <AdminDashboard />}
        </div>

        {/* Footer (Desktop only or collapsed) */}
        <footer className="hidden lg:block border-t border-slate-200 dark:border-slate-850 bg-white/40 dark:bg-slate-900/10 py-4 text-center text-[9px] text-slate-400 dark:text-slate-500 font-medium">
          <p>© 2026 PT. Berlian Manyar Sejahtera. All rights reserved.</p>
        </footer>

        {/* Floating iOS-style Neumorphic Bottom Dock (Visible only on mobile/tablet) */}
        <nav className="lg:hidden fixed bottom-4 left-4 right-4 h-16 bg-[#f1f2f5]/90 dark:bg-[#1e293b]/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/80 rounded-2xl flex items-center justify-around z-40 px-2">
          {profile.role === 'ADMIN' ? (
            // #admin layout: [Galeri, Panel Administrator]
            <>
              {/* Button 1: Galeri */}
              <button
                onClick={() => setActiveTab('gallery')}
                className={`w-28 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'gallery'
                    ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold shadow-[inset_2px_2px_4px_#c8cbd4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59]'
                    : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
                }`}
              >
                <LayoutGrid size={16} />
                <span className="text-[9px] tracking-tight font-black uppercase">Galeri</span>
              </button>

              {/* Button 2: Panel Administrator */}
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-28 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold shadow-[inset_2px_2px_4px_#c8cbd4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59]'
                    : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
                }`}
              >
                <LayoutDashboard size={16} />
                <span className="text-[9px] tracking-tight font-black uppercase">Admin Panel</span>
              </button>
            </>
          ) : (
            // #bidder layout: [Galeri, Tombol Bid, Bids(history)]
            <>
              {/* Button 1: Galeri */}
              <button
                onClick={() => setActiveTab('gallery')}
                className={`w-16 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'gallery'
                    ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold shadow-[inset_2px_2px_4px_#c8cbd4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59]'
                    : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
                }`}
              >
                <LayoutGrid size={16} />
                <span className="text-[8px] tracking-tight font-black uppercase">Galeri</span>
              </button>

              {/* Button 2 (Center): Prominent circle Bid Action button */}
              <button
                onClick={() => {
                  setSelectedBidAssetId(null);
                  setIsBidModalOpen(true);
                }}
                className="w-14 h-14 -mt-7 bg-brand-500 hover:bg-brand-600 text-white rounded-full flex flex-col items-center justify-center transition-all cursor-pointer active:scale-90 border border-brand-400/30"
              >
                <Gavel size={18} />
                <span className="text-[7px] tracking-tight font-black uppercase mt-0.5">Bid</span>
              </button>

              {/* Button 3: Bids */}
              <button
                onClick={() => setActiveTab('my-bids')}
                className={`w-16 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'my-bids'
                    ? 'tab-active-neu text-brand-650 dark:text-brand-400 font-bold shadow-[inset_2px_2px_4px_#c8cbd4,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59]'
                    : 'text-slate-500 hover:text-slate-750 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent'
                }`}
              >
                <ShoppingBag size={16} />
                <span className="text-[8px] tracking-tight font-black uppercase">Bids</span>
              </button>
            </>
          )}
        </nav>

        {/* Global Bidding Form Modal (Mobile center action launcher) */}
        <BiddingFormModal
          isOpen={isBidModalOpen}
          onClose={() => setIsBidModalOpen(false)}
          preselectedAssetId={selectedBidAssetId}
        />
      </div>

    </div>
  );
}

export default App;
