export interface Profile {
  id: string;
  email: string;
  nama_lengkap: string | null;
  avatar_url?: string | null;
  role: 'BIDDER' | 'ADMIN';
  status_akun: 'PENDING' | 'AKTIF' | 'BLOKIR';
  additional_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  kode_aset: string;
  kelipatan_bid: number;
  jenis_aset: string;
  nama_aset: string;
  deskripsi: string | null;
  gambar_url: string[];
  harga_buka: number;
  waktu_mulai: string;
  waktu_selesai: string;
  status_lelang: 'OPEN' | 'CLOSED' | 'CANCEL';
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  asset_id: string;
  user_id: string;
  nominal_bid: number;
  status_bid: 'VALID' | 'CANCELLED';
  created_at: string;
}

export interface RegistrationField {
  id: string;
  field_name: string;
  label: string;
  field_type: 'text' | 'number' | 'email' | 'tel' | 'file' | 'textarea';
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActiveBidView {
  asset_id: string;
  kode_aset: string;
  kelipatan_bid: number;
  nama_aset: string;
  jenis_aset: string;
  deskripsi: string | null;
  gambar_url: string[];
  harga_buka: number;
  current_highest_bid: number;
  winner_id: string | null;
  winner_email: string | null;
  winner_name: string | null;
  winner_details: Record<string, any> | null;
  waktu_selesai: string;
  status_lelang: 'OPEN' | 'CLOSED' | 'CANCEL';
  computed_status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}
