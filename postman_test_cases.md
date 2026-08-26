# Panduan Test Case API & Pengujian Postman

Dokumen ini menjelaskan daftar test case untuk setiap endpoint backend Google Apps Script serta cara mengujinya menggunakan aplikasi Postman.

---

## 1. Persiapan Awal di Postman

1. Buka aplikasi **Postman**.
2. Klik tombol **Import** di pojok kiri atas.
3. Pilih file [BMS_Bidding_App.postman_collection.json](file:///home/urzection/Documents/bidding-app/BMS_Bidding_App.postman_collection.json) dari folder proyek ini.
4. Setelah berhasil diimpor, koleksi bernama **"BMS Bidding App API"** akan muncul di sidebar kiri Anda.
5. **Konfigurasi URL Backend**:
   - Klik kanan pada nama koleksi `BMS Bidding App API` -> klik **Edit**.
   - Pilih tab **Variables**.
   - Cari baris variable `gas_api_url` dan ganti nilai `Current Value` dengan URL Web App Google Apps Script Anda (URL yang didapat setelah proses *Deploy* baru).
   - Klik **Save** (Ctrl+S / Cmd+S).

> [!IMPORTANT]
> Google Apps Script mengharuskan pemanggilan API menggunakan metode **POST** dengan Header `Content-Type: text/plain` untuk menghindari pemblokiran CORS. Koleksi Postman yang diimpor sudah disetel otomatis ke pengaturan ini.

---

## 2. Daftar Test Case

### A. Fitur Autentikasi & Registrasi

#### 1. Test Case: Login User Terdaftar
*   **Tujuan**: Memastikan pengguna terdaftar dengan status akun `AKTIF` bisa login dan mendapatkan profilnya.
*   **Metode / Action**: `POST` / `"action": "login"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "login",
      "email": "adamzaky.dy@gmail.com"
    }
    ```
*   **Ekspektasi Respon (Sukses)**:
    ```json
    {
      "success": true,
      "isRegistered": true,
      "data": {
        "email": "adamzaky.dy@gmail.com",
        "nama_lengkap": "Adam Zaky",
        "departemen": "IT",
        "no_wa": "08123456789",
        "role": "ADMIN",
        "status_akun": "AKTIF"
      }
    }
    ```

#### 2. Test Case: Login User Belum Terdaftar
*   **Tujuan**: Memverifikasi sistem mendeteksi user yang belum terdaftar.
*   **Metode / Action**: `POST` / `"action": "login"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "login",
      "email": "user.unknown@gmail.com"
    }
    ```
*   **Ekspektasi Respon (Gagal)**:
    ```json
    {
      "success": false,
      "isRegistered": false,
      "message": "Akun belum terdaftar."
    }
    ```

#### 3. Test Case: Login User Terblokir (Blocked)
*   **Tujuan**: Memastikan user dengan status akun `BLOCKED` tidak dapat masuk ke sistem.
*   **Metode / Action**: `POST` / `"action": "login"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "login",
      "email": "user.blocked@gmail.com"
    }
    ```
*   **Ekspektasi Respon (Gagal)**:
    ```json
    {
      "success": false,
      "isRegistered": true,
      "message": "Akses Ditolak: Akun Anda diblokir oleh Admin."
    }
    ```

#### 4. Test Case: Registrasi Pengguna Baru
*   **Tujuan**: Mendaftarkan email baru ke dalam database `tb_users`.
*   **Metode / Action**: `POST` / `"action": "register"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "register",
      "email": "employee.new@gmail.com",
      "nama_lengkap": "Budi Santoso",
      "departemen": "Logistik",
      "no_wa": "08987654321"
    }
    ```
*   **Ekspektasi Respon**:
    - **Jika Email Belum Ada**: `{"success": true, "message": "Registrasi berhasil. Silakan lanjut."}`
    - **Jika Email Sudah Ada**: `{"success": false, "message": "Email sudah terdaftar."}`

---

### B. Fitur Bidding (Operasi Bidder)

#### 5. Test Case: Mengambil Daftar Aset Lelang (Get Assets)
*   **Tujuan**: Mendapatkan semua daftar barang lelang berserta informasi nominal penawaran tertinggi saat ini.
*   **Metode / Action**: `POST` / `"action": "getAssets"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "getAssets"
    }
    ```
*   **Ekspektasi Respon**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "AST-1719118000000",
          "kategori": "Laptop & PC",
          "nama": "MacBook Pro M1 2020",
          "deskripsi": "Kondisi 90% mulus...",
          "gambarUrls": ["https://lh3.googleusercontent.com/d/xyz"],
          "hargaBuka": 8000000,
          "bidTertinggi": 9500000,
          "emailPemenang": "adamzaky.dy@gmail.com",
          "namaPemenang": "Adam Zaky",
          "departemenPemenang": "IT",
          "waPemenang": "08123456789",
          "sisaWaktu": "05:12:30"
        }
      ]
    }
    ```

#### 6. Test Case: Mengajukan Penawaran (Submit Bid) - Sukses
*   **Tujuan**: Mengirimkan bid dengan nominal lebih tinggi dari harga buka/penawaran tertinggi saat ini. Memicu email notifikasi.
*   **Metode / Action**: `POST` / `"action": "submitBid"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "submitBid",
      "assetId": "AST-1719118000000",
      "email": "employee.new@gmail.com",
      "nominal": 10000000
    }
    ```
*   **Ekspektasi Respon**:
    - **Jika Valid**: `{"success": true, "message": "Berhasil! Anda penawar tertinggi sementara."}` (dan email sukses dikirim ke `employee.new@gmail.com`, email outbid dikirim ke `adamzaky.dy@gmail.com`, serta laporan masuk ke `CONFIG.ADMIN_EMAIL`).
    - **Jika Nominal Kurang**: `{"success": false, "message": "Gagal: Tawaran harus lebih dari Rp 10.000.000"}`
    - **Jika Waktu Habis**: `{"success": false, "message": "Lelang untuk aset ini sudah ditutup."}`

#### 7. Test Case: Riwayat Bid Pengguna (Get User Bids)
*   **Tujuan**: Mengambil histori seluruh bid yang pernah dikirimkan oleh pengguna terkait.
*   **Metode / Action**: `POST` / `"action": "getUserBids"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "getUserBids",
      "email": "employee.new@gmail.com"
    }
    ```
*   **Ekspektasi Respon**:
    ```json
    {
      "success": true,
      "data": [
        {
          "bidId": "BID-1719119520000",
          "timestamp": "2026-06-23T04:52:00.000Z",
          "assetId": "AST-1719118000000",
          "namaAset": "MacBook Pro M1 2020",
          "kategori": "Laptop & PC",
          "gambarUrl": "https://lh3.googleusercontent.com/d/xyz",
          "nominal": 10000000,
          "status": "VALID"
        }
      ]
    }
    ```

---

### C. Fitur Manajemen (Operasi Admin)

#### 8. Test Case: Mengambil Semua Pengguna (Hanya Admin)
*   **Tujuan**: Menampilkan seluruh data user terdaftar di database.
*   **Metode / Action**: `POST` / `"action": "getUsers"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "getUsers",
      "adminEmail": "adamzaky.dy@gmail.com"
    }
    ```
*   **Ekspektasi Respon**:
    - **Jika Pengirim Admin**: `{"success": true, "data": [...]}`
    - **Jika Pengirim Bidder biasa**: `{"success": false, "message": "Unauthorized Akses."}`

#### 9. Test Case: Menambah Aset Baru (Hanya Admin)
*   **Tujuan**: Menambahkan entri aset lelang baru ke sheet `tb_assets`.
*   **Metode / Action**: `POST` / `"action": "addAsset"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "addAsset",
      "adminEmail": "adamzaky.dy@gmail.com",
      "data": {
        "nama": "Monitor Dell UltraSharp 27",
        "kategori": "Elektronik",
        "deskripsi": "Resolusi 4K, tipe IPS, sRGB 99%.",
        "hargaBuka": 3500000,
        "waktuMulai": "2026-06-23T08:00:00.000Z",
        "waktuSelesai": "2026-06-30T17:00:00.000Z",
        "images": []
      }
    }
    ```
*   **Ekspektasi Respon**: `{"success": true, "message": "Aset \"Monitor Dell UltraSharp 27\" berhasil ditambahkan dengan ID AST-XXXXXXXXXXXXX.", "assetId": "AST-XXXXXXXXXXXXX"}`

#### 10. Test Case: Membatalkan Penawaran Tertinggi (Hanya Admin)
*   **Tujuan**: Membatalkan bid tertinggi aktif jika terindikasi kecurangan atau *typo*. Mengubah status penawaran terkait menjadi `CANCELLED`.
*   **Metode / Action**: `POST` / `"action": "cancelBid"`
*   **Contoh Request Body**:
    ```json
    {
      "action": "cancelBid",
      "adminEmail": "adamzaky.dy@gmail.com",
      "assetId": "AST-1719118000000"
    }
    ```
*   **Ekspektasi Respon**: `{"success": true, "message": "Penawaran atas nama employee.new@gmail.com senilai Rp 10.000.000 berhasil dibatalkan."}`

#### 11. Test Case: Menambah Aset Baru dengan Kelipatan Bid (Hanya Admin)
*   **Tujuan**: Menambahkan aset lelang baru dengan konfigurasi kelipatan bid (bisa nominal seperti `50000` atau persentase harga buka seperti `5%`).
*   **Metode / Action**: `POST` / `"action": "addAsset"`
*   **Contoh Request Body (Kelipatan Persentase)**:
    ```json
    {
      "action": "addAsset",
      "adminEmail": "adamzaky.dy@gmail.com",
      "data": {
        "nama": "Laptop ThinkPad L13",
        "kategori": "Elektronik",
        "deskripsi": "RAM 16GB, SSD 512GB, kondisi mulus.",
        "hargaBuka": 10000000,
        "waktuMulai": "2026-07-01T08:00:00.000Z",
        "waktuSelesai": "2026-07-08T17:00:00.000Z",
        "images": [],
        "kelipatanBid": "5%"
      }
    }
    ```
*   **Ekspektasi Respon**: `{"success": true, "message": "Aset \"Laptop ThinkPad L13\" berhasil ditambahkan dengan ID AST-XXXXXXXXXXXXX.", "assetId": "AST-XXXXXXXXXXXXX"}`

#### 12. Test Case: Validasi Pengajuan Bid Lanjutan dengan Kelipatan (Sukses & Gagal)
*   **Tujuan**: Mengajukan bid lanjutan pada aset yang memiliki kelipatan dan memverifikasi batas minimal penawarannya.
*   **Metode / Action**: `POST` / `"action": "submitBid"`
*   **Contoh Request Body (Gagal - Di Bawah Batas Minimal)**:
    *   *Kondisi:* Bid tertinggi saat ini `10.000.000` dengan kelipatan `5%` (`500.000`). User melakukan bid `10.300.000` (kurang dari syarat minimal `10.500.000`).
    ```json
    {
      "action": "submitBid",
      "assetId": "AST-XXXXXXXXXXXXX",
      "email": "employee.new@gmail.com",
      "nominal": 10300000
    }
    ```
    *   *Ekspektasi Respon*: `{"success": false, "message": "Nominal bid minimal Rp 10.500.000 (Kelipatan Rp 500.000)."}`

*   **Contoh Request Body (Sukses - Di Atas Batas Minimal)**:
    *   *Kondisi:* Bid tertinggi saat ini `10.000.000` dengan kelipatan `5%` (`500.000`). User melakukan bid `10.750.000` (lebih besar atau sama dengan `10.500.000`, diperbolehkan mengajukan nominal cantik bebas).
    ```json
    {
      "action": "submitBid",
      "assetId": "AST-XXXXXXXXXXXXX",
      "email": "employee.new@gmail.com",
      "nominal": 10750000
    }
    ```
    *   *Ekspektasi Respon*: `{"success": true, "message": "Berhasil! Anda penawar tertinggi sementara."}`

#### 13. Test Case: Validasi Admin Tidak Boleh Mengajukan Bid
*   **Tujuan**: Memastikan pengguna dengan peran ADMIN tidak diperbolehkan mengajukan penawaran lelang.
*   **Metode / Action**: `POST` / `"action": "submitBid"`
*   **Contoh Request Body**:
    *   *Kondisi:* Email yang dimasukkan terdaftar dengan peran ADMIN di database `tb_users`.
    ```json
    {
      "action": "submitBid",
      "assetId": "AST-XXXXXXXXXXXXX",
      "email": "adamzaky.dy@gmail.com",
      "nominal": 11000000
    }
    ```
    *   *Ekspektasi Respon*: `{"success": false, "message": "Gagal: Pengguna dengan peran ADMIN tidak diperbolehkan mengajukan penawaran lelang."}`

