import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { RegistrationField } from '../types';
import { UserCheck, Upload, LogOut, FileText, CheckCircle } from 'lucide-react';

interface CompleteProfileProps {
  userId: string;
  userEmail: string;
  onSubmissionSuccess: () => void;
}

export const CompleteProfile: React.FC<CompleteProfileProps> = ({
  userId,
  userEmail,
  onSubmissionSuccess,
}) => {
  const [fields, setFields] = useState<RegistrationField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [namaLengkap, setNamaLengkap] = useState('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [filesData, setFilesData] = useState<Record<string, File>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      const { data, error } = await supabase
        .from('registration_fields')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFields(data || []);
    } catch (err: any) {
      console.error('Error fetching fields:', err);
      setErrorMsg('Gagal memuat form registrasi.');
    } finally {
      setLoadingFields(false);
    }
  };

  const handleInputChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleFileChange = (fieldName: string, file: File | null) => {
    if (file) {
      setFilesData((prev) => ({ ...prev, [fieldName]: file }));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(false);
    setErrorMsg(null);
    setSubmitLoading(true);

    try {
      const updatedAdditionalData: Record<string, any> = { ...formData };

      // Upload files first
      for (const field of fields) {
        if (field.field_type === 'file' && filesData[field.field_name]) {
          const file = filesData[field.field_name];
          const fileExt = file.name.split('.').pop();
          const filePath = `${userId}/${field.field_name}_${Date.now()}.${fileExt}`;

          setUploadProgress((prev) => ({ ...prev, [field.field_name]: 'Mengunggah...' }));

          // Upload to Supabase Storage Bucket
          const { error: uploadError } = await supabase.storage
            .from('registration-docs')
            .upload(filePath, file, { upsert: true });

          if (uploadError) {
            throw new Error(`Gagal mengunggah ${field.label}: ${uploadError.message}`);
          }

          // Get Public URL
          const { data: publicUrlData } = supabase.storage
            .from('registration-docs')
            .getPublicUrl(filePath);

          updatedAdditionalData[field.field_name] = publicUrlData.publicUrl;
          setUploadProgress((prev) => ({ ...prev, [field.field_name]: 'Selesai' }));
        } else if (field.field_type === 'file' && field.is_required && !updatedAdditionalData[field.field_name]) {
          throw new Error(`File ${field.label} wajib diunggah.`);
        }
      }

      // Update User Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nama_lengkap: namaLengkap,
          additional_data: updatedAdditionalData,
          status_akun: 'PENDING', // set to pending to get verified by admin
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      onSubmissionSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan profil.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loadingFields) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500 mx-auto mb-4" />
          <p className="text-sm">Memuat Formulir Registrasi...</p>
        </div>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen bg-[#f1f2f5] dark:bg-[#1e293b] text-slate-800 dark:text-slate-100 flex items-center justify-center py-12 px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-lg bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[12px_12px_24px_#d5d8df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#0e141d,-12px_-12px_24px_#2e3e59] rounded-3xl p-8 sm:p-10 relative z-10 text-left">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-600 dark:text-brand-400">
              <UserCheck size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-850 dark:text-white">Lengkapi Profil Anda</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="btn-neu flex items-center gap-1.5 px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300 font-semibold"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
 
        {errorMsg && (
          <div className="mb-6 bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/20 rounded-xl p-4 text-rose-600 dark:text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}
 
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase mb-2 tracking-widest pl-1">Nama Lengkap (Sesuai KTP) *</label>
            <input
              type="text"
              required
              placeholder="Masukkan nama lengkap Anda"
              value={namaLengkap}
              onChange={(e) => setNamaLengkap(e.target.value)}
              className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-3 px-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600"
            />
          </div>
 
          {fields.map((field) => {
            const isRequired = field.is_required;
            return (
              <div key={field.field_name}>
                <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase mb-2 tracking-widest pl-1">
                  {field.label} {isRequired && '*'}
                </label>
 
                {field.field_type === 'textarea' ? (
                  <textarea
                    required={isRequired}
                    rows={3}
                    placeholder={`Masukkan ${field.label.toLowerCase()}`}
                    onChange={(e) => handleInputChange(field.field_name, e.target.value)}
                    className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-3 px-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600"
                  />
                ) : field.field_type === 'file' ? (
                  <div className="relative">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border border-dashed border-slate-350 dark:border-slate-800 hover:border-brand-500/50 bg-[#f1f2f5] dark:bg-[#1e293b] shadow-[inset_2px_2px_4px_#d5d8df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#0e141d,inset_-2px_-2px_4px_#2e3e59] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all p-4">
                        <div className="flex flex-col items-center justify-center pt-3 pb-4">
                          <Upload size={20} className="text-slate-500 mb-2" />
                          <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-1">
                            {filesData[field.field_name] ? filesData[field.field_name].name : 'Klik untuk unggah berkas'}
                          </p>
                          <p className="text-[10px] text-slate-450 dark:text-slate-500">PDF, PNG, JPG (Maks. 5MB)</p>
                        </div>
                        <input
                          type="file"
                          required={isRequired && !filesData[field.field_name]}
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileChange(field.field_name, e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {uploadProgress[field.field_name] && (
                      <div className="mt-2 text-xs flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-semibold">
                        <FileText size={12} />
                        <span>Status: {uploadProgress[field.field_name]}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type={field.field_type}
                    required={isRequired}
                    placeholder={`Masukkan ${field.label.toLowerCase()}`}
                    onChange={(e) => handleInputChange(field.field_name, e.target.value)}
                    className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-3 px-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600"
                  />
                )}
              </div>
            );
          })}
 
          <button
            type="submit"
            disabled={submitLoading}
            className="btn-brand-neu w-full py-3.5 font-bold text-xs uppercase tracking-wider mt-4 shadow-md"
          >
            {submitLoading ? 'Menyimpan Profil...' : 'Kirim Pengajuan Pendaftaran'}
          </button>
        </form>
      </div>
    </div>
  );
};
 
interface AwaitingApprovalProps {
  userEmail: string;
  onCheckStatus: () => void;
}
 
export const AwaitingApproval: React.FC<AwaitingApprovalProps> = ({ userEmail, onCheckStatus }) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
 
  return (
    <div className="min-h-screen bg-[#f1f2f5] dark:bg-[#1e293b] text-slate-800 dark:text-slate-100 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
 
      <div className="w-full max-w-md bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800 shadow-[12px_12px_24px_#d5d8df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#0e141d,-12px_-12px_24px_#2e3e59] rounded-3xl p-8 sm:p-10 text-center relative z-10">
        <div className="inline-flex p-3.5 bg-brand-500/10 border border-brand-500/20 rounded-2xl mb-5 text-brand-600 dark:text-brand-400 animate-pulse">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-850 dark:text-white mb-2">Pendaftaran Sedang Ditinjau</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Akun Anda ({userEmail}) berhasil terdaftar. Tim Administrator sedang memverifikasi data dan dokumen pendaftaran Anda.
        </p>
 
        <div className="space-y-4">
          <button
            onClick={onCheckStatus}
            className="btn-brand-neu w-full py-3 font-semibold text-sm shadow-md"
          >
            Segarkan Status Akun
          </button>
 
          <button
            onClick={handleSignOut}
            className="btn-neu w-full flex items-center justify-center gap-2 text-slate-650 dark:text-slate-455 font-bold text-xs py-3"
          >
            <LogOut size={14} /> Keluar Sesi
          </button>
        </div>
      </div>
    </div>
  );
};
