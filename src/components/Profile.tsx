import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Profile as UserProfile, RegistrationField } from '../types';
import { User, Shield, CheckCircle, Ban, Hourglass, Mail, FileText, ArrowRight, LogOut, Camera, Save, RefreshCw } from 'lucide-react';

interface ProfileProps {
  profile: UserProfile;
  onProfileUpdate?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ profile, onProfileUpdate }) => {
  const [fields, setFields] = useState<RegistrationField[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing states
  const [editing, setEditing] = useState(false);
  const [namaLengkap, setNamaLengkap] = useState(profile.nama_lengkap || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [oauthAvatar, setOauthAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchFields();
    checkOauthAvatar();
  }, [profile]);

  const checkOauthAvatar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const pic = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
      if (pic) {
        setOauthAvatar(pic);
      }
    } catch (err) {
      console.error('Error checking OAuth avatar:', err);
    }
  };

  const fetchFields = async () => {
    try {
      const { data, error } = await supabase
        .from('registration_fields')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (err) {
      console.error('Error fetching fields:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      let finalAvatarUrl = avatarUrl;

      // 1. Upload file if user selected one
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile.id}/avatar_${Date.now()}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('user-avatars')
          .upload(fileName, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from('user-avatars')
          .getPublicUrl(fileName);

        finalAvatarUrl = publicUrlData.publicUrl;
      }

      // 2. Update profiles table
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          nama_lengkap: namaLengkap,
          avatar_url: finalAvatarUrl,
        })
        .eq('id', profile.id);

      if (updateErr) throw updateErr;

      setSaveSuccess(true);
      setEditing(false);
      setFile(null);
      if (onProfileUpdate) onProfileUpdate();

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Gagal menyimpan profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchOauthAvatar = () => {
    if (oauthAvatar) {
      setAvatarUrl(oauthAvatar);
      setFile(null);
    }
  };

  const getStatusBadge = (status: UserProfile['status_akun']) => {
    switch (status) {
      case 'AKTIF':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-405">
            <CheckCircle size={14} /> Akun Aktif
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-405">
            <Hourglass size={14} /> Menunggu Verifikasi
          </span>
        );
      case 'BLOKIR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-405">
            <Ban size={14} /> Akun Diblokir
          </span>
        );
      default:
        return null;
    }
  };

  const currentPhoto = file ? URL.createObjectURL(file) : (avatarUrl || profile.avatar_url);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 text-left">
      {/* Profile Header Card */}
      <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          {/* Avatar Area */}
          <div className="relative group shrink-0">
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt={profile.nama_lengkap || 'User'}
                className="h-24 w-24 rounded-3xl object-cover border-2 border-white dark:border-slate-800 shadow-[4px_4px_8px_#d5d8df] dark:shadow-[4px_4px_8px_#0e141d]"
              />
            ) : (
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-tr from-brand-500 to-brand-600 flex items-center justify-center text-white shadow-xl shadow-brand-500/10 font-bold text-3xl">
                {profile.nama_lengkap ? profile.nama_lengkap.charAt(0).toUpperCase() : profile.email.charAt(0).toUpperCase()}
              </div>
            )}
            
            {editing && (
              <label className="absolute inset-0 bg-black/60 hover:bg-black/75 rounded-3xl flex flex-col items-center justify-center text-white cursor-pointer transition-all">
                <Camera size={20} />
                <span className="text-[8px] font-bold uppercase mt-1">Ganti</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>
 
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-850 dark:text-white tracking-tight">{profile.nama_lengkap || 'Pengguna Baru'}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-bold bg-[#f1f2f5] dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-widest shadow-sm">
                <Shield size={10} /> {profile.role}
              </span>
              {getStatusBadge(profile.status_akun)}
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-500 dark:text-slate-450 mt-2 font-medium">
              <Mail size={14} className="text-slate-400" />
              <span>{profile.email}</span>
            </div>
          </div>
        </div>
 
        {/* Edit Button */}
        {!editing ? (
          <button
            onClick={() => {
              setEditing(true);
              setNamaLengkap(profile.nama_lengkap || '');
              setAvatarUrl(profile.avatar_url || '');
              setFile(null);
            }}
            className="btn-brand-neu py-3 px-5 text-xs font-bold shrink-0"
          >
            Edit Profil
          </button>
        ) : (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setEditing(false)}
              className="btn-neu py-3 px-5 text-xs text-slate-600 dark:text-slate-350 font-bold"
            >
              ✕ Batal
            </button>
          </div>
        )}
      </div>
 
      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-5 rounded-2xl text-xs font-semibold shadow-sm">
          Profil berhasil diperbarui!
        </div>
      )}
      {saveError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-5 rounded-2xl text-xs shadow-sm">
          {saveError}
        </div>
      )}
 
      {/* Editing View */}
      {editing && (
        <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-8">
          <h3 className="text-base font-bold text-slate-850 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-850 pb-3 flex items-center gap-2">
            <User size={18} className="text-brand-500" /> Edit Detail Profil
          </h3>
 
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">Nama Lengkap</label>
              <input
                type="text"
                required
                value={namaLengkap}
                onChange={(e) => setNamaLengkap(e.target.value)}
                className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-3 px-4 text-xs text-slate-800 dark:text-white outline-none transition-all placeholder-slate-450"
              />
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1 mb-2">URL Avatar Foto</label>
                <input
                  type="text"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setFile(null);
                  }}
                  className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-3 px-4 text-xs text-slate-800 dark:text-white outline-none transition-all placeholder-slate-455"
                />
              </div>
 
              {oauthAvatar && (
                <button
                  type="button"
                  onClick={handleFetchOauthAvatar}
                  className="btn-neu w-full py-3.5 px-4 font-bold text-xs flex items-center justify-center gap-2 text-slate-700 dark:text-slate-350"
                >
                  <RefreshCw size={14} /> Ambil Foto Akun Google/Microsoft
                </button>
              )}
            </div>
 
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-neu py-3 px-5 text-xs text-slate-600 dark:text-slate-350 font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-brand-neu py-3 px-5 text-xs font-bold flex items-center gap-2"
              >
                <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}
 
      {/* Dynamic Profile Fields Grid */}
      <div className="bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-8">
        <h3 className="text-base font-bold text-slate-850 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-850 pb-3 flex items-center gap-2">
          <User size={18} className="text-brand-500" /> Informasi Registrasi & Profil
        </h3>
 
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-brand-500 mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest pl-1">Nama Lengkap</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_1.5px_1.5px_3px_#c8cbd4,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d,inset_-1.5px_-1.5px_3px_#2e3e59] px-4 py-3 rounded-xl border border-white/40 dark:border-slate-800/20">{profile.nama_lengkap || '-'}</p>
            </div>
 
            {fields.map((field) => {
              const value = profile.additional_data?.[field.field_name];
              const isFile = field.field_type === 'file';
 
              return (
                <div key={field.field_name} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-widest pl-1">{field.label}</span>
                  <div>
                    {isFile ? (
                      value ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-neu inline-flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 px-4 py-2.5"
                        >
                          <FileText size={14} /> Lihat Berkas / Dokumen <ArrowRight size={12} className="ml-1 text-slate-400" />
                        </a>
                      ) : (
                        <p className="text-xs text-slate-500 italic bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_1.5px_1.5px_3px_#c8cbd4,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d,inset_-1.5px_-1.5px_3px_#2e3e59] px-4 py-3 rounded-xl border border-white/40 dark:border-slate-800/20">Belum diunggah</p>
                      )
                    ) : (
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_1.5px_1.5px_3px_#c8cbd4,inset_-1.5px_-1.5px_3px_#ffffff] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d,inset_-1.5px_-1.5px_3px_#2e3e59] px-4 py-3 rounded-xl border border-white/40 dark:border-slate-800/20">{value || '-'}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
 
      {/* Account Settings / Actions (Mobile accessibility) */}
      <div className="lg:hidden bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[6px_6px_12px_#d5d8df,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#0e141d,-6px_-6px_12px_#2e3e59] rounded-3xl p-6">
        <button
          onClick={async () => {
            if (window.confirm('Apakah Anda yakin ingin keluar dari sesi?')) {
              await supabase.auth.signOut();
            }
          }}
          className="btn-neu w-full py-3.5 hover:text-rose-500 font-bold text-xs"
        >
          <LogOut size={14} /> Keluar Sesi
        </button>
      </div>
    </div>
  );
};
 
interface BlockedUserProps {
  userEmail: string;
}
 
export const BlockedUser: React.FC<BlockedUserProps> = ({ userEmail }) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
 
  return (
    <div className="min-h-screen bg-[#f1f2f5] dark:bg-[#1e293b] text-slate-850 dark:text-slate-100 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-rose-900/10 rounded-full blur-[120px] pointer-events-none" />
 
      <div className="w-full max-w-md bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[12px_12px_24px_#d5d8df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#0e141d,-12px_-12px_24px_#2e3e59] rounded-3xl p-8 sm:p-10 text-center relative z-10">
        <div className="inline-flex p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-5 text-rose-500 animate-bounce">
          <Ban size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-850 dark:text-white mb-2">Akun Ditangguhkan</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Akun Anda ({userEmail}) telah diblokir atau ditangguhkan oleh Administrator. Silakan hubungi bagian manajemen PT. Berlian Manyar Sejahtera untuk info lebih lanjut.
        </p>
 
        <button
          onClick={handleSignOut}
          className="btn-neu w-full flex items-center justify-center gap-2 text-rose-500 hover:text-rose-600 font-bold text-xs py-3.5"
        >
          <LogOut size={16} /> Keluar
        </button>
      </div>
    </div>
  );
};
