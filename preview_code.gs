// =========================================================================
// DRIVE API AUTHORIZATION HELPER
// =========================================================================
/**
 * PENTING: Jalankan fungsi ini SEKALI di Editor Google Apps Script untuk
 * memicu dialog otorisasi Google Drive (OAuth) jika Anda mendapatkan error
 * DriveApp permission.
 */
function authorizeDriveApp() {
  try {
    // Memicu dialog izin tulis (write scope) Google Drive
    const tempFile = DriveApp.createFile("BMS_Auth_Temp.txt", "Temp");
    tempFile.setTrashed(true);
    Logger.log("Koneksi Google Drive (Akses Tulis/Write) Berhasil!");
  } catch (e) {
    Logger.log("Gagal otorisasi: " + e.toString());
  }
}

// =========================================================================
// CONFIGURATION & SETUP
// =========================================================================
const CONFIG = {
  DB_ID: '1n-ZCjeVVdZKLFz1e73pvgPVugKbU22u-85ztuGBJxeU',
  SHEETS: {
    USERS: 'tb_users',
    ASSETS: 'tb_assets',
    BIDS: 'tb_bids',
    VIEW: 'view_active_bids'
  },
  ADMIN_EMAIL: 'bidding@bms.jiipe.co.id', // Notifikasi sistem akan dikirim ke sini
  FRONTEND_URL: 'https://bidding-assets-bms.vercel.app' // URL aplikasi web lelang
};

/**
 * Membersihkan cache daftar aset aktif
 */
function clearAssetsCache() {
  try {
    CacheService.getScriptCache().remove("active_assets_cache");
  } catch (e) {
    Logger.log("Gagal membersihkan cache: " + e.toString());
  }
}

// =========================================================================
// 1. ROUTER / REST API ENDPOINTS & CORS (Untuk Separated Frontend Fetch)
// =========================================================================

/**
 * Handle POST request from Frontend (fetch API)
 * Parses JSON body and routes action
 */
function doPost(e) {
  try {
    let postData;
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      return makeJsonResponse({ success: false, message: "Data request tidak ditemukan." });
    }

    const action = postData.action;
    let result;

    switch (action) {
      case 'login':
        result = AuthController.login(postData.email);
        break;
      case 'register':
        result = AuthController.register({
          email: postData.email,
          nama_lengkap: postData.nama_lengkap,
          nip_bms: postData.nip_bms,
          no_wa: postData.no_wa,
          nik: postData.nik,
          fileKepegawaian: postData.fileKepegawaian,
          fileKesanggupan: postData.fileKesanggupan,
          fileKtp: postData.fileKtp
        });
        break;
      case 'getAssets':
        result = { success: true, data: BiddingController.fetchAssets() };
        break;
      case 'submitBid':
        result = BiddingController.processBid(
          postData.assetId, 
          postData.email, 
          Number(postData.nominal)
        );
        break;
      case 'getUserBids':
        result = BiddingController.fetchUserBids(postData.email);
        break;
      case 'cancelBid':
        result = AdminController.cancelWinner(postData.assetId, postData.adminEmail);
        break;
      case 'addAsset':
        if (postData.images && !postData.data.images) postData.data.images = postData.images;
        result = AdminController.addAsset(postData.adminEmail, postData.data);
        break;
      case 'editAsset':
        if (postData.images && !postData.data.images) postData.data.images = postData.images;
        result = AdminController.editAsset(postData.adminEmail, postData.assetId, postData.data);
        break;
      case 'deleteAsset':
        result = AdminController.deleteAsset(postData.adminEmail, postData.assetId);
        break;
      case 'getUsers':
        result = AdminController.fetchUsers(postData.adminEmail);
        break;
      case 'updateUser':
        result = AdminController.updateUser(
          postData.adminEmail,
          postData.targetEmail,
          postData.role,
          postData.status,
          postData.nama_lengkap,
          postData.nip_bms,
          postData.no_wa,
          postData.nik,
          postData.files
        );
        break;
      case 'getSystemQuotas':
        result = AdminController.fetchSystemQuotas(postData.adminEmail);
        break;
      case 'checkDiagnostics':
        result = AdminController.checkDiagnostics(postData.adminEmail);
        break;
      case 'getSystemConfig':
        result = {
          success: true,
          authMode: PropertiesService.getScriptProperties().getProperty('AUTH_MODE') || 'INTERNAL',
          registrationClosed: PropertiesService.getScriptProperties().getProperty('REGISTRATION_CLOSED') === 'true'
        };
        break;
      case 'updateSystemConfig':
        result = AdminController.updateSystemConfig(
          postData.adminEmail,
          postData.authMode,
          postData.registrationClosed
        );
        break;
      default:
        result = { success: false, message: "Aksi tidak dikenali: " + action };
    }

    return makeJsonResponse(result);
  } catch (err) {
    return makeJsonResponse({ success: false, message: "Kesalahan server: " + err.toString() });
  }
}

/**
 * Helper to build JSON Response with appropriate CORS Headers in GAS
 */
function makeJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Router / View Engine (If run inside Google Sheets/GAS Web App container directly)
 */
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'auth') {
    const tenantId = PropertiesService.getScriptProperties().getProperty('MS_TENANT_ID') || '5540bb28-9fec-4e8f-a639-a4c2bc699bcf';
    const clientId = PropertiesService.getScriptProperties().getProperty('MS_CLIENT_ID') || 'cbf2760f-e6c3-45b7-8982-222306d31b2f';
    const redirectUri = ScriptApp.getService().getUrl();
    
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_mode=query&` +
      `scope=${encodeURIComponent('https://graph.microsoft.com/Mail.Send offline_access')}&` +
      `state=bms_auth`;
      
    return HtmlService.createHtmlOutput(`<script>window.top.location.href = "${authUrl}";</script><p>Mengarahkan ke Microsoft Login...</p>`);
  }
  
  if (e.parameter.code) {
    try {
      const code = e.parameter.code;
      const tenantId = PropertiesService.getScriptProperties().getProperty('MS_TENANT_ID') || '5540bb28-9fec-4e8f-a639-a4c2bc699bcf';
      const clientId = PropertiesService.getScriptProperties().getProperty('MS_CLIENT_ID') || 'cbf2760f-e6c3-45b7-8982-222306d31b2f';
      const clientSecret = PropertiesService.getScriptProperties().getProperty('MS_CLIENT_SECRET');
      const redirectUri = ScriptApp.getService().getUrl();
      
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const payload = {
        client_id: clientId,
        scope: 'https://graph.microsoft.com/Mail.Send offline_access',
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        client_secret: clientSecret
      };
      
      const options = {
        method: 'post',
        payload: payload,
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(tokenUrl, options);
      const data = JSON.parse(response.getContentText());
      
      if (response.getResponseCode() !== 200) {
        return HtmlService.createHtmlOutput(`<h3>Otorisasi Gagal</h3><p>${data.error_description || response.getContentText()}</p>`);
      }
      
      const props = PropertiesService.getScriptProperties();
      props.setProperty('MS_ACCESS_TOKEN', data.access_token);
      if (data.refresh_token) {
        props.setProperty('MS_REFRESH_TOKEN', data.refresh_token);
      }
      const expiryTime = new Date().getTime() + (data.expires_in * 1000);
      props.setProperty('MS_TOKEN_EXPIRY', expiryTime.toString());
      
      return HtmlService.createHtmlOutput(`<h3>Otorisasi Sukses!</h3><p>Aplikasi berhasil terhubung ke email Microsoft Anda. Anda sekarang dapat menutup jendela ini.</p>`);
    } catch(err) {
      return HtmlService.createHtmlOutput(`<h3>Terjadi Kesalahan</h3><p>${err.toString()}</p>`);
    }
  }

  const response = { 
    status: "active", 
    message: "API Sistem Lelang Internal BMS is online & Ready to Receive POST Requests." 
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 2. BACKEND CONTROLLERS (Business Logic)
// =========================================================================

const AuthController = {
  login: function(email) {
    try {
      const user = UserModel.getByEmail(email);
      if (!user) return { success: false, isRegistered: false, message: "Akun belum terdaftar." };
      
      const status = String(user.status_akun).toUpperCase().trim();
      if (status === "PENDING") {
        return { success: false, isRegistered: true, message: "Pendaftaran Anda sedang ditinjau oleh Administrator. Mohon periksa kembali nanti." };
      }
      if (status !== "AKTIF") {
        return { success: false, isRegistered: true, message: "Akses Ditolak: Akun Anda telah dinonaktifkan atau diblokir oleh Administrator." };
      }
      
      return { success: true, isRegistered: true, data: user };
    } catch (e) { return { success: false, message: e.toString() }; }
  },
  
  register: function(data) {
    try {
      const registrationClosed = PropertiesService.getScriptProperties().getProperty('REGISTRATION_CLOSED') === 'true';
      if (registrationClosed) {
        return { success: false, message: "Pendaftaran ditutup: Admin telah menonaktifkan pendaftaran anggota baru saat ini." };
      }

      const existing = UserModel.getByEmail(data.email);
      if (existing) return { success: false, message: "Email sudah terdaftar." };

      // Induk Folder ID Dokumen Pendaftaran BMS
      const folderId = '1Ut4emx_c0IodG2j38JYzs3h0F_OivfzJ';
      let parentFolder;
      try {
        parentFolder = DriveApp.getFolderById(folderId);
      } catch (e) {
        return { success: false, message: "Gagal mengakses folder dokumen pendaftaran di Google Drive. Harap hubungi Administrator." };
      }

      let linkKepegawaian = "-";
      let linkKesanggupan = "-";
      let linkKtp = "-";

      const savePdf = function(fileName, base64Data) {
        try {
          const contentBytes = Utilities.base64Decode(base64Data);
          const blob = Utilities.newBlob(contentBytes, 'application/pdf', fileName);
          const file = parentFolder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          return file.getUrl();
        } catch (e) {
          Logger.log(`Gagal menyimpan file ${fileName}: ` + e.toString());
          throw e;
        }
      };

      if (data.fileKepegawaian && data.fileKepegawaian.base64) {
        linkKepegawaian = savePdf(`Kepegawaian_${data.nama_lengkap.replace(/\s+/g, '_')}_${Date.now()}.pdf`, data.fileKepegawaian.base64);
      }
      if (data.fileKesanggupan && data.fileKesanggupan.base64) {
        linkKesanggupan = savePdf(`Kesanggupan_${data.nama_lengkap.replace(/\s+/g, '_')}_${Date.now()}.pdf`, data.fileKesanggupan.base64);
      }
      if (data.fileKtp && data.fileKtp.base64) {
        linkKtp = savePdf(`KTP_${data.nama_lengkap.replace(/\s+/g, '_')}_${Date.now()}.pdf`, data.fileKtp.base64);
      }
      
      UserModel.create(
        data.email, 
        data.nama_lengkap, 
        data.nip_bms, 
        data.no_wa, 
        data.nik,
        linkKepegawaian,
        linkKesanggupan,
        linkKtp
      );
      return { success: true, message: "Registrasi berhasil diajukan. Silakan tunggu peninjauan dokumen oleh Admin." };
    } catch (e) { return { success: false, message: e.toString() }; }
  }
};

const BiddingController = {
  fetchAssets: function() {
    const cache = CacheService.getScriptCache();
    const cacheKey = "active_assets_cache";
    try {
      const cached = cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      Logger.log("Gagal membaca cache: " + e.toString());
    }

    const assets = ViewModel.getAllActive();
    try {
      // Simpan ke cache selama 15 detik. Menggunakan try-catch agar jika payload > 100KB tidak menyebabkan error crash.
      cache.put(cacheKey, JSON.stringify(assets), 15);
    } catch (e) {
      Logger.log("Gagal menulis cache: " + e.toString());
    }
    return assets;
  },

  processBid: function(assetId, email, nominalBid) {
    const lock = LockService.getScriptLock();
    let success = false;
    let assetView, user, currentHighest;
    const bidId = "BID-" + new Date().getTime();

    try {
      // Tunggu hingga maksimal 10 detik untuk mendapatkan kunci (lock)
      lock.waitLock(10000);

      // Bersihkan cache database agar proses membaca data teraktual dari sheet (tidak menggunakan cache lama)
      DB._sheetCache = {};

      user = UserModel.getByEmail(email);
      if (!user || user.status_akun !== "AKTIF") return { success: false, message: "Autentikasi gagal." };
      
      if (String(user.role).toUpperCase() === "ADMIN") {
        return { success: false, message: "Gagal: Pengguna dengan peran ADMIN tidak diperbolehkan mengajukan penawaran lelang." };
      }

      assetView = ViewModel.getAssetById(assetId);
      if (!assetView) return { success: false, message: "Aset tidak ditemukan." };
      
      const now = new Date();
      if (assetView.waktuMulai) {
        const startTime = new Date(assetView.waktuMulai);
        if (now < startTime) {
          return { success: false, message: "Gagal: Lelang untuk aset ini belum dimulai." };
        }
      }

      if (assetView.sisaWaktu === "CLOSED" || assetView.sisaWaktu === "") {
         return { success: false, message: "Lelang untuk aset ini sudah ditutup." };
      }

      const rawHargaBuka = Number(assetView.hargaBukaRaw) || 0;
      const rawBidTertinggi = Number(assetView.bidTertinggiRaw) || 0;
      currentHighest = rawBidTertinggi > 0 ? rawBidTertinggi : rawHargaBuka;
      const kelipatanBid = Number(assetView.kelipatanBidRaw) || 0;

      if (rawBidTertinggi === 0) {
        if (nominalBid < rawHargaBuka) {
          return { 
            success: false, 
            message: `Nominal bid minimal sama dengan harga buka (Rp ${rawHargaBuka.toLocaleString('id-ID')}).` 
          };
        }
      } else {
        if (kelipatanBid > 0) {
          const minRequiredBid = rawBidTertinggi + kelipatanBid;
          if (nominalBid < minRequiredBid) {
            return { 
              success: false, 
              message: `Nominal bid minimal Rp ${minRequiredBid.toLocaleString('id-ID')} (Kelipatan Rp ${kelipatanBid.toLocaleString('id-ID')}).` 
            };
          }
        } else {
          if (nominalBid <= rawBidTertinggi) {
            return { 
              success: false, 
              message: `Penawar lain telah memasukkan harga yang sama atau lebih tinggi terlebih dahulu (Rp ${rawBidTertinggi.toLocaleString('id-ID')}). Silakan tunggu pembaruan harga dan ajukan kembali nominal bid yang lebih tinggi.` 
            };
          }
        }
      }

      // Catat bid baru ke dalam database sheet
      BidModel.logBid(bidId, assetId, email, nominalBid, "VALID");

      // Paksa Google Sheets untuk segera menulis data sebelum lock dirilis
      SpreadsheetApp.flush();

      // Hapus cache agar user mendapatkan data bid terbaru pada polling berikutnya
      clearAssetsCache();
      
      success = true;
    } catch (e) {
      return { success: false, message: "Sistem sedang sibuk memproses antrean penawaran lain. Silakan coba sesaat lagi. (" + e.toString() + ")" };
    } finally {
      // Pastikan lock selalu dirilis dalam kondisi apa pun
      lock.releaseLock();
    }

    // Kirim notifikasi email di luar penguncian (lock) agar antrean tidak tertahan lama
    if (success) {
      try {
        NotificationService.sendAlerts(
          assetView.nama, 
          nominalBid, 
          email, 
          user.nama_lengkap, 
          assetView.emailPemenang, 
          currentHighest
        );
      } catch (err) {
        Logger.log("Gagal mengirim email outbid: " + err.toString());
      }
      return { success: true, message: "Berhasil! Anda penawar tertinggi sementara." };
    }
  },

  fetchUserBids: function(email) {
    try {
      const bidsData = DB.getSheetValues(CONFIG.SHEETS.BIDS);
      const assetsData = DB.getSheetValues(CONFIG.SHEETS.ASSETS);
      
      const assetMap = {};
      for (let i = 1; i < assetsData.length; i++) {
        const id = assetsData[i][0];
        if (id) {
          const rawUrls = assetsData[i][4] || "";
          const images = rawUrls.split(',').map(url => url.trim()).filter(url => url !== "");
          assetMap[id] = {
            nama: assetsData[i][2],
            kategori: assetsData[i][1],
            gambarUrl: images.length > 0 ? images[0] : ''
          };
        }
      }

      const userBids = [];
      for (let i = 1; i < bidsData.length; i++) {
        if (bidsData[i][3] && bidsData[i][3].toString().toLowerCase() === email.toLowerCase()) {
          const assetId = bidsData[i][2];
          const assetInfo = assetMap[assetId] || { nama: "Aset Tidak Dikenal", kategori: "Lain-lain", gambarUrl: "" };
          userBids.push({
            bidId: bidsData[i][0],
            timestamp: bidsData[i][1] instanceof Date ? bidsData[i][1].toISOString() : new Date(bidsData[i][1]).toISOString(),
            assetId: assetId,
            namaAset: assetInfo.nama,
            kategori: assetInfo.kategori,
            gambarUrl: assetInfo.gambarUrl,
            nominal: bidsData[i][4],
            status: bidsData[i][5]
          });
        }
      }
      userBids.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return { success: true, data: userBids };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }
};

// =========================================================================
// IMAGE UPLOAD HELPER (Google Drive Integration)
// =========================================================================
function uploadBase64ImagesToDrive(images, assetId) {
  let errors = [];
  if (!images || images.length === 0) return { url: "", errors: ["Tidak ada gambar yang dikirim"] };

  let imageUrls = [];
  let folder;
  let usingFallback = false;
  const folderId = "1CuamVUwN3zrqiByh4TFhp9x4MVL1Avtr";

  function getFallbackFolder() {
    const folderName = "BMS Bidding Images";
    try {
      const folders = DriveApp.getFoldersByName(folderName);
      while (folders.hasNext()) {
        const f = folders.next();
        if (!f.isTrashed()) {
          return f;
        }
      }
      const newFolder = DriveApp.createFolder(folderName);
      try {
        newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log("Warning: Could not set sharing for fallback folder: " + shareErr.toString());
        try {
          newFolder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (domainErr) {
          try {
            newFolder.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
          } catch (domainErr2) {
            Logger.log("Could not set domain sharing for fallback folder: " + domainErr2.toString());
          }
        }
      }
      return newFolder;
    } catch (e) {
      Logger.log("Failed to get or create fallback folder: " + e.toString());
      throw e;
    }
  }

  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    usingFallback = true;
    errors.push("Folder utama (" + folderId + ") tidak dapat diakses: " + e.toString());
  }

  if (usingFallback || !folder) {
    try {
      folder = getFallbackFolder();
      usingFallback = true;
    } catch (e) {
      Logger.log("Critical: All attempts to find/create folder failed: " + e.toString());
      errors.push("Folder cadangan tidak dapat dibuat/diakses: " + e.toString());
      return { url: "", errors: errors };
    }
  }

  images.forEach(function(base64Str, idx) {
    if (!base64Str) {
      errors.push("Gambar indeks " + idx + " kosong");
      return;
    }
    try {
      let base64Data = base64Str;
      let contentType = "image/jpeg";
      let extension = "jpg";
      
      if (base64Str.indexOf(",") !== -1) {
        const base64Parts = base64Str.split(",");
        base64Data = base64Parts[1];
        const contentTypeMatch = base64Parts[0].match(/:(.*?);/);
        contentType = contentTypeMatch ? contentTypeMatch[1] : "image/jpeg";
        extension = contentType.split("/")[1] || "jpg";
      }
      
      const decoded = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decoded, contentType, `image-${assetId}-${idx}.${extension}`);
      
      let file;
      try {
        file = folder.createFile(blob);
      } catch (writeErr) {
        if (!usingFallback) {
          Logger.log("Main folder is read-only. Switching to fallback folder. Error: " + writeErr.toString());
          errors.push("Folder utama read-only, mencoba folder cadangan: " + writeErr.toString());
          try {
            folder = getFallbackFolder();
            usingFallback = true;
            file = folder.createFile(blob);
          } catch (fallbackWriteErr) {
            throw fallbackWriteErr;
          }
        } else {
          throw writeErr;
        }
      }

      let sharedSuccessfully = false;
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        sharedSuccessfully = true;
      } catch (shareErr) {
        Logger.log(`Warning: Could not set public sharing for file: ` + shareErr.toString());
        try {
          // Coba fallback 1: Domain dengan link (internal Google Workspace)
          file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
          sharedSuccessfully = true;
        } catch (domainErr) {
          try {
            // Coba fallback 2: Domain (internal Google Workspace)
            file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
            sharedSuccessfully = true;
          } catch (domainErr2) {
            Logger.log("Warning: Could not set domain sharing: " + domainErr2.toString());
          }
        }
      }
      
      const fileId = file.getId();
      // Menggunakan link thumbnail resmi Google Drive yang bebas dari hambatan cookies dan error 400
      imageUrls.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
    } catch (err) {
      Logger.log(`Failed to upload image index ${idx}: ` + err.toString());
      errors.push("Gagal memproses gambar " + idx + ": " + err.toString());
    }
  });

  return { url: imageUrls.join(","), errors: errors };
}

const AdminController = {
  cancelWinner: function(assetId, adminEmail) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Unauthorized Akses." };

      const cancelledBid = BidModel.cancelHighest(assetId);
      if (!cancelledBid) return { success: false, message: "Tidak ada data penawaran yang bisa dibatalkan." };

      clearAssetsCache();
      return { success: true, message: `Penawaran atas nama ${cancelledBid.email} senilai Rp ${cancelledBid.nominal} berhasil dibatalkan.` };
    } catch (e) { return { success: false, message: e.toString() }; }
  },

  addAsset: function(adminEmail, assetData) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Akses ditolak. Hanya Admin yang dapat menambah aset baru." };

      if (!assetData.nama || !assetData.kategori || !assetData.hargaBuka || !assetData.waktuSelesai) {
        return { success: false, message: "Kolom Nama Aset, Kategori, Harga Buka, dan Batas Waktu wajib diisi." };
      }

      let assetId = "";
      if (assetData.id && assetData.id.trim()) {
        const customId = assetData.id.trim();
        const sheet = DB.getSheet(CONFIG.SHEETS.ASSETS);
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] && data[i][0].toString().toLowerCase() === customId.toLowerCase()) {
            return { success: false, message: `Gagal: ID Aset "${customId}" sudah digunakan oleh aset lain.` };
          }
        }
        assetId = customId;
      } else {
        assetId = "AST-" + new Date().getTime();
      }
      
      // Upload base64 images to Drive folder
      let gambarUrlStr = "";
      let uploadNote = "";
      if (assetData.images && assetData.images.length > 0) {
        const uploadResult = uploadBase64ImagesToDrive(assetData.images, assetId);
        gambarUrlStr = uploadResult.url;
        if (uploadResult.errors && uploadResult.errors.length > 0) {
          uploadNote = " (Detail Upload: " + uploadResult.errors.join("; ") + ")";
        }
      }

      const kelipatanBidValStr = String(assetData.kelipatanBid || "").trim();
      const finalKelipatan = (kelipatanBidValStr.endsWith("%")) ? "'" + kelipatanBidValStr : kelipatanBidValStr;

      // Susunan baris tb_assets: asset_id, jenis_aset, nama_aset, deskripsi, gambar_url, harga_buka, waktu_mulai, waktu_selesai, status_lelang, kelipatan_bid
      const row = [
        assetId,
        assetData.kategori,
        assetData.nama,
        assetData.deskripsi || "",
        gambarUrlStr, 
        Number(assetData.hargaBuka),
        assetData.waktuMulai ? new Date(assetData.waktuMulai) : new Date(), // waktu_mulai
        new Date(assetData.waktuSelesai), // waktu_selesai
        "OPEN", // status_lelang (default OPEN)
        finalKelipatan // kelipatan_bid (J)
      ];

      DB.getSheet(CONFIG.SHEETS.ASSETS).appendRow(row);
      
      clearAssetsCache();
      
      let successMsg = `Aset "${assetData.nama}" berhasil ditambahkan dengan ID ${assetId}.`;
      if (assetData.images && assetData.images.length > 0 && !gambarUrlStr) {
        successMsg += " (Gagal mengunggah gambar)." + uploadNote;
      } else if (uploadNote) {
        successMsg += uploadNote;
      }
      
      return { success: true, message: successMsg, assetId: assetId };
    } catch (e) {
      return { success: false, message: "Gagal menyimpan aset: " + e.toString() };
    }
  },

  editAsset: function(adminEmail, assetId, assetData) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Akses ditolak." };

      const sheet = DB.getSheet(CONFIG.SHEETS.ASSETS);
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === assetId) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) return { success: false, message: "Aset tidak ditemukan." };

      // Upload base64 images if provided
      let uploadNote = "";
      if (assetData.images && assetData.images.length > 0) {
        const uploadResult = uploadBase64ImagesToDrive(assetData.images, assetId);
        if (uploadResult.url) {
          sheet.getRange(rowIndex, 5).setValue(uploadResult.url);
        }
        if (uploadResult.errors && uploadResult.errors.length > 0) {
          uploadNote = " (Detail Upload: " + uploadResult.errors.join("; ") + ")";
        }
      }

      // Update columns: jenis_aset (B), nama_aset (C), deskripsi (D), harga_buka (F), waktu_mulai (G), waktu_selesai (H)
      sheet.getRange(rowIndex, 2).setValue(assetData.kategori);
      sheet.getRange(rowIndex, 3).setValue(assetData.nama);
      sheet.getRange(rowIndex, 4).setValue(assetData.deskripsi);
      sheet.getRange(rowIndex, 6).setValue(Number(assetData.hargaBuka));
      if (assetData.waktuMulai) {
        sheet.getRange(rowIndex, 7).setValue(new Date(assetData.waktuMulai));
      }
      sheet.getRange(rowIndex, 8).setValue(new Date(assetData.waktuSelesai));
      const editKelipatanBidValStr = String(assetData.kelipatanBid || "").trim();
      const editFinalKelipatan = (editKelipatanBidValStr.endsWith("%")) ? "'" + editKelipatanBidValStr : editKelipatanBidValStr;
      sheet.getRange(rowIndex, 10).setValue(editFinalKelipatan);

      clearAssetsCache();
      return { success: true, message: "Aset berhasil diperbarui." + uploadNote };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  },

  deleteAsset: function(adminEmail, assetId) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Akses ditolak." };

      const sheet = DB.getSheet(CONFIG.SHEETS.ASSETS);
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === assetId) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) return { success: false, message: "Aset tidak ditemukan." };

      // Set status_lelang (column 9) to "CANCEL"
      sheet.getRange(rowIndex, 9).setValue("CANCEL");

      clearAssetsCache();
      return { success: true, message: "Aset berhasil dinonaktifkan (CANCEL)." };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  },

  fetchUsers: function(adminEmail) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Akses ditolak." };

      const data = DB.getSheetValues(CONFIG.SHEETS.USERS);
      let users = [];
      for (let i = 1; i < data.length; i++) {
        users.push({
          email: data[i][0],
          nama_lengkap: data[i][1],
          nip_bms: data[i][2],
          no_wa: data[i][3],
          nik: data[i][4],
          link_surat_kepegawaian: data[i][5],
          link_surat_kesanggupan: data[i][6],
          link_ktp: data[i][7],
          role: data[i][8],
          status_akun: data[i][9]
        });
      }
      return { success: true, data: users };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  },

  updateUser: function(adminEmail, targetUserEmail, role, status, nama_lengkap, nip_bms, no_wa, nik, files) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Akses ditolak." };

      const sheet = DB.getSheet(CONFIG.SHEETS.USERS);
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      let targetUserObj = null;
      for (let i = 1; i < data.length; i++) {
        if (data[i][0].toString().toLowerCase() === targetUserEmail.toLowerCase()) {
          rowIndex = i + 1;
          targetUserObj = data[i];
          break;
        }
      }

      if (rowIndex === -1) return { success: false, message: "Pengguna tidak ditemukan." };

      // Update role and status
      sheet.getRange(rowIndex, 9).setValue(role);
      sheet.getRange(rowIndex, 10).setValue(status);

      // Update text fields if provided
      if (nama_lengkap !== undefined) sheet.getRange(rowIndex, 2).setValue(nama_lengkap);
      if (nip_bms !== undefined) sheet.getRange(rowIndex, 3).setValue(nip_bms);
      if (no_wa !== undefined) sheet.getRange(rowIndex, 4).setValue(no_wa);
      if (nik !== undefined) sheet.getRange(rowIndex, 5).setValue(nik);

      // Handle file updates
      if (files) {
        const parentFolder = DriveApp.getFolderById('1Ut4emx_c0IodG2j38JYzs3h0F_OivfzJ');
        const savePdf = function(fileName, base64Data) {
          const contentBytes = Utilities.base64Decode(base64Data);
          const blob = Utilities.newBlob(contentBytes, 'application/pdf', fileName);
          const file = parentFolder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          return file.getUrl();
        };

        const userNameForFile = (nama_lengkap || targetUserObj[1]).replace(/\s+/g, '_');
        if (files.fileKepegawaian && files.fileKepegawaian.base64) {
          const url = savePdf(`Kepegawaian_${userNameForFile}_${Date.now()}.pdf`, files.fileKepegawaian.base64);
          sheet.getRange(rowIndex, 6).setValue(url);
        }
        if (files.fileKesanggupan && files.fileKesanggupan.base64) {
          const url = savePdf(`Kesanggupan_${userNameForFile}_${Date.now()}.pdf`, files.fileKesanggupan.base64);
          sheet.getRange(rowIndex, 7).setValue(url);
        }
        if (files.fileKtp && files.fileKtp.base64) {
          const url = savePdf(`KTP_${userNameForFile}_${Date.now()}.pdf`, files.fileKtp.base64);
          sheet.getRange(rowIndex, 8).setValue(url);
        }
      }

      return { success: true, message: "Data pengguna dan dokumen berhasil diperbarui." };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  },

  fetchSystemQuotas: function(adminEmail) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Akses ditolak." };

      // 1. Email Quota
      const emailRemaining = MailApp.getRemainingDailyQuota();

      // 2. Drive Storage Quota
      let storageUsed = 0;
      let storageLimit = 0;
      try {
        storageUsed = DriveApp.getStorageUsed();
        storageLimit = DriveApp.getStorageLimit();
      } catch (e) {
        Logger.log("Failed to get storage quota: " + e.toString());
      }

      // 3. Database Sheet statistics
      let usersCount = 0;
      let assetsCount = 0;
      let bidsCount = 0;
      try {
        usersCount = Math.max(0, DB.getSheetValues(CONFIG.SHEETS.USERS).length - 1);
        assetsCount = Math.max(0, DB.getSheetValues(CONFIG.SHEETS.ASSETS).length - 1);
        bidsCount = Math.max(0, DB.getSheetValues(CONFIG.SHEETS.BIDS).length - 1);
      } catch (e) {
        Logger.log("Failed to get sheet stats: " + e.toString());
      }

      // 4. Spreadsheets size/cells check (limit: 10 million cells)
      let totalCellsUsed = 0;
      try {
        const spreadsheet = DB.getSpreadsheet();
        const sheets = spreadsheet.getSheets();
        sheets.forEach(function(s) {
          totalCellsUsed += (s.getLastRow() * s.getLastColumn());
        });
      } catch (e) {
        Logger.log("Failed to get cell count: " + e.toString());
      }

      return {
        success: true,
        data: {
          system: {
            authMode: PropertiesService.getScriptProperties().getProperty('AUTH_MODE') || 'INTERNAL',
            registrationClosed: PropertiesService.getScriptProperties().getProperty('REGISTRATION_CLOSED') === 'true'
          },
          email: {
            remaining: emailRemaining,
            limit: emailRemaining > 100 ? 1500 : 100
          },
          storage: {
            used: storageUsed,
            limit: storageLimit
          },
          database: {
            users: usersCount,
            assets: assetsCount,
            bids: bidsCount,
            cellsUsed: totalCellsUsed,
            cellsLimit: 10000000
          }
        }
      };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  },

  checkDiagnostics: function(adminEmail) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") {
        return { success: false, message: "Unauthorized Akses." };
      }

      const status = {
        spreadsheet: false,
        drive: false,
        microsoft: false,
        details: {
          spreadsheetMsg: "",
          driveMsg: "",
          microsoftMsg: ""
        }
      };

      // 1. Check Spreadsheet Access
      try {
        const userSheet = DB.getSheet(CONFIG.SHEETS.USERS);
        const testRead = userSheet.getRange(1, 1).getValue();
        status.spreadsheet = true;
        status.details.spreadsheetMsg = "Koneksi Google Sheets Aktif.";
      } catch (e) {
        status.details.spreadsheetMsg = "Gagal mengakses Google Sheets: " + e.toString();
      }

      // 2. Check Drive Folder Access
      try {
        const folder = DriveApp.getFolderById("1Ut4emx_c0IodG2j38JYzs3h0F_OivfzJ");
        const folderName = folder.getName();
        status.drive = true;
        status.details.driveMsg = "Koneksi Google Drive Folder '" + folderName + "' Aktif.";
      } catch (e) {
        status.details.driveMsg = "Gagal mengakses Google Drive Folder (ID: 1Ut4emx_c0IodG2j38JYzs3h0F_OivfzJ): " + e.toString();
      }

      // 3. Check Microsoft Graph API
      try {
        const token = NotificationService._getMsAccessToken();
        if (token) {
          status.microsoft = true;
          status.details.microsoftMsg = "Koneksi Microsoft Graph API Aktif (Token Berhasil Diambil).";
        } else {
          status.details.microsoftMsg = "Gagal mengambil token Microsoft. Silakan lakukan otorisasi ulang.";
        }
      } catch (e) {
        status.details.microsoftMsg = "Gagal mengakses Microsoft Graph API: " + e.toString();
      }

      return { success: true, data: status };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  },

  updateSystemConfig: function(adminEmail, authMode, registrationClosed) {
    try {
      const admin = UserModel.getByEmail(adminEmail);
      if (!admin || String(admin.role).toUpperCase() !== "ADMIN") return { success: false, message: "Akses ditolak. Hanya Admin yang dapat mengubah konfigurasi sistem." };

      const properties = PropertiesService.getScriptProperties();
      if (authMode) {
        properties.setProperty('AUTH_MODE', authMode);
      }
      if (registrationClosed !== undefined) {
        properties.setProperty('REGISTRATION_CLOSED', String(registrationClosed));
      }

      return { success: true, message: "Konfigurasi sistem berhasil diperbarui." };
    } catch (e) {
      return { success: false, message: e.toString() };
    }
  }
};

// =========================================================================
// 3. MODELS (Database Query & Abstraction)
// =========================================================================
// Helper format Rupiah cepat di GAS
function formatRupiah(val) {
  if (val === undefined || val === null || val === "" || isNaN(val) || Number(val) === 0) {
    return "0";
  }
  return "Rp " + Number(val).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const DB = {
  _spreadsheet: null,
  _sheetCache: {},
  
  getSpreadsheet: function() {
    if (!this._spreadsheet) {
      this._spreadsheet = SpreadsheetApp.openById(CONFIG.DB_ID);
    }
    return this._spreadsheet;
  },
  
  getSheet: function(name) { 
    return this.getSpreadsheet().getSheetByName(name); 
  },
  
  getSheetValues: function(name) {
    if (!this._sheetCache[name]) {
      this._sheetCache[name] = this.getSheet(name).getDataRange().getValues();
    }
    return this._sheetCache[name];
  }
};

const UserModel = {
  getByEmail: function(email) {
    const data = DB.getSheetValues(CONFIG.SHEETS.USERS);
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString().toLowerCase() === email.toLowerCase()) {
        return {
          email: data[i][0],
          nama_lengkap: data[i][1],
          nip_bms: data[i][2],
          no_wa: data[i][3],
          nik: data[i][4],
          link_surat_kepegawaian: data[i][5],
          link_surat_kesanggupan: data[i][6],
          link_ktp: data[i][7],
          role: data[i][8],
          status_akun: data[i][9]
        };
      }
    }
    return null;
  },
  create: function(email, nama, nip, wa, nik, linkKepegawaian, linkKesanggupan, linkKtp) {
    DB.getSheet(CONFIG.SHEETS.USERS).appendRow([
      email, nama, nip, wa, nik, 
      linkKepegawaian, linkKesanggupan, linkKtp, 
      "BIDDER", "AKTIF"
    ]);
  }
};

const BidModel = {
  logBid: function(bidId, assetId, email, nominal, status) {
    DB.getSheet(CONFIG.SHEETS.BIDS).appendRow([bidId, new Date(), assetId, email, nominal, status]);
  },
  
  cancelHighest: function(assetId) {
    const sheet = DB.getSheet(CONFIG.SHEETS.BIDS);
    const data = sheet.getDataRange().getValues();
    let highestIndex = -1;
    let highestNominal = -1;
    let cancelledEmail = "";

    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === assetId && data[i][5] === "VALID") {
        let nominal = Number(data[i][4]);
        if (nominal > highestNominal) {
          highestNominal = nominal;
          highestIndex = i + 1; 
          cancelledEmail = data[i][3];
        }
      }
    }

    if (highestIndex > -1) {
      sheet.getRange(highestIndex, 6).setValue("CANCELLED"); 
      return { email: cancelledEmail, nominal: highestNominal };
    }
    return null;
  }
};

const ViewModel = {
  getAllActive: function() {
    const assetsData = DB.getSheetValues(CONFIG.SHEETS.ASSETS);
    const bidsData = DB.getSheetValues(CONFIG.SHEETS.BIDS);
    const usersData = DB.getSheetValues(CONFIG.SHEETS.USERS);
    
    // Parse users into a map for fast lookup
    const userMap = {};
    for (let i = 1; i < usersData.length; i++) {
      const email = String(usersData[i][0]).toLowerCase().trim();
      if (email) {
        userMap[email] = {
          nama: usersData[i][1] || "-",
          nip_bms: usersData[i][2] || "-",
          noWa: usersData[i][3] || "-"
        };
      }
    }
    
    // Parse bids to find the highest VALID bid for each asset
    const highestBidsMap = {};
    for (let i = 1; i < bidsData.length; i++) {
      const assetId = String(bidsData[i][2]).trim();
      const email = String(bidsData[i][3]).toLowerCase().trim();
      const nominal = Number(bidsData[i][4]) || 0;
      const status = String(bidsData[i][5]).toUpperCase().trim();
      
      if (status === "VALID" && assetId) {
        const currentHighest = highestBidsMap[assetId];
        if (!currentHighest || nominal > currentHighest.nominal) {
          highestBidsMap[assetId] = {
            nominal: nominal,
            email: bidsData[i][3]
          };
        }
      }
    }
    
    const now = new Date();
    const assets = [];
    
    for (let i = 1; i < assetsData.length; i++) {
      const assetId = String(assetsData[i][0]).trim();
      if (assetId) {
        const kategori = assetsData[i][1];
        const nama = assetsData[i][2];
        const deskripsi = assetsData[i][3];
        const rawUrls = assetsData[i][4] || "";
        const parsedImageUrls = rawUrls.split(',').map(url => url.trim()).filter(url => url !== "");
        const hargaBukaNum = Number(assetsData[i][5]) || 0;
        
        let waktuMulaiIso = "";
        let waktuSelesaiIso = "";
        let deadline = null;
        try {
          if (assetsData[i][6]) {
            const dStart = assetsData[i][6] instanceof Date ? assetsData[i][6] : new Date(assetsData[i][6]);
            waktuMulaiIso = dStart.toISOString();
          }
          if (assetsData[i][7]) {
            deadline = assetsData[i][7] instanceof Date ? assetsData[i][7] : new Date(assetsData[i][7]);
            waktuSelesaiIso = deadline.toISOString();
          }
        } catch (e) {}
        
        const statusLelang = String(assetsData[i][8] || "OPEN").toUpperCase().trim();
        const kelipatanBidValStr = String(assetsData[i][9] || "").trim();
        let kelipatanBidNum = 0;
        let kelipatanBidDisplay = "-";
        let kelipatanBidType = "NONE";
        let kelipatanBidOriginalVal = "0";

        if (kelipatanBidValStr && kelipatanBidValStr !== "0") {
          const isPercent = (kelipatanBidValStr.indexOf("%") !== -1) || 
                            (typeof assetsData[i][9] === "number" && assetsData[i][9] > 0 && assetsData[i][9] < 1);
          if (isPercent) {
            let percentVal = 0;
            if (kelipatanBidValStr.indexOf("%") !== -1) {
              percentVal = parseFloat(kelipatanBidValStr.replace(/[^0-9.]/g, '')) || 0;
            } else {
              percentVal = Number(assetsData[i][9]) * 100;
            }
            kelipatanBidNum = Math.round((percentVal / 100) * hargaBukaNum);
            kelipatanBidDisplay = `${percentVal}% (Rp ${Number(kelipatanBidNum).toLocaleString('id-ID')})`;
            kelipatanBidType = "PERCENTAGE";
            kelipatanBidOriginalVal = String(percentVal);
          } else {
            kelipatanBidNum = Number(kelipatanBidValStr.replace(/[^0-9]/g, '')) || 0;
            if (kelipatanBidNum > 0) {
              kelipatanBidDisplay = `Rp ${Number(kelipatanBidNum).toLocaleString('id-ID')}`;
              kelipatanBidType = "NOMINAL";
              kelipatanBidOriginalVal = String(kelipatanBidNum);
            }
          }
        }
        
        const highestBid = highestBidsMap[assetId];
        let bidTertinggiVal = "0";
        let emailPemenang = "-";
        let namaPemenang = "-";
        let nip_bms = "-";
        let noWa = "-";
        
        if (highestBid) {
          bidTertinggiVal = formatRupiah(highestBid.nominal);
          emailPemenang = highestBid.email;
          const userDetails = userMap[emailPemenang.toLowerCase().trim()];
          if (userDetails) {
            namaPemenang = userDetails.nama;
            nip_bms = userDetails.nip_bms;
            noWa = userDetails.noWa;
          }
        }
        
        let sisaWaktu = "";
        if (statusLelang === "CANCEL" || statusLelang === "CANCELLED") {
          sisaWaktu = "CANCELLED";
        } else if (deadline) {
          if (deadline < now) {
            sisaWaktu = "CLOSED";
          } else {
            sisaWaktu = (deadline - now) / (1000 * 60 * 60 * 24);
          }
        }
        
        assets.push({
          id: assetId,
          kategori: kategori,
          nama: nama,
          deskripsi: deskripsi,
          gambarUrls: parsedImageUrls,
          hargaBuka: formatRupiah(hargaBukaNum),
          hargaBukaRaw: hargaBukaNum,
          waktuMulai: waktuMulaiIso,
          waktuSelesai: waktuSelesaiIso,
          bidTertinggi: bidTertinggiVal,
          bidTertinggiRaw: highestBid ? highestBid.nominal : 0,
          emailPemenang: emailPemenang,
          namaPemenang: namaPemenang,
          nip_bms: nip_bms,
          noWa: noWa,
          sisaWaktu: sisaWaktu,
          kelipatanBid: kelipatanBidDisplay,
          kelipatanBidRaw: kelipatanBidNum,
          kelipatanBidType: kelipatanBidType,
          kelipatanBidOriginalVal: kelipatanBidOriginalVal
        });
      }
    }
    return assets;
  },
  getAssetById: function(assetId) {
    const all = this.getAllActive();
    return all.find(a => a.id === assetId) || null;
  }
};

// =========================================================================
// 4. SERVICES (Email Integrations)
// =========================================================================
const EmailTemplates = {
  getSuccessBid: function(namaAset, nominalBaru) {
    const formatRp = (num) => "Rp " + Number(num).toLocaleString('id-ID');
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bidding Sukses</title>
        <style>
          body { font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #2596be 0%, #1e7fa3 100%); padding: 25px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 5px 0 0 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 13px; }
          .content { padding: 30px; }
          .content h2 { margin-top: 0; color: #0f172a; font-size: 20px; font-weight: 600; }
          .content p { line-height: 1.6; color: #475569; font-size: 15px; }
          .card { background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }
          .badge { background-color: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block; }
          .btn-container { text-align: center; margin: 30px 0 10px 0; }
          .btn { background-color: #2596be; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; transition: background-color 0.2s ease; box-shadow: 0 4px 6px -1px rgba(37, 150, 190, 0.2); }
          .btn:hover { background-color: #1e7fa3; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="margin-bottom: 8px;">
              <img src="cid:logo" alt="BMS Logo" style="height: 48px; max-height: 48px; width: auto;" onerror="this.style.display='none';">
            </div>
            <h1>BMS E-Bidding</h1>
            <p>PT. Berlian Manyar Sejahtera</p>
          </div>
          <div class="content">
            <h2>Penawaran Berhasil Diajukan</h2>
            <p>Halo,</p>
            <p>Kami menginformasikan bahwa penawaran Anda untuk aset di bawah ini telah berhasil dicatat dalam sistem. Saat ini, Anda merupakan penawar tertinggi sementara.</p>
            
            <div class="card">
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nama Aset</td>
                  <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 14px;">${namaAset}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nominal Bid</td>
                  <td style="padding: 10px 0; color: #2596be; font-weight: 700; text-align: right; font-size: 16px;">${formatRp(nominalBaru)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Status</td>
                  <td style="padding: 10px 0; text-align: right;"><span class="badge">🟢 Tertinggi Sementara</span></td>
                </tr>
              </table>
            </div>
            
            <p>Kami akan mengirimkan pemberitahuan kembali apabila terdapat pengguna lain yang mengajukan penawaran lebih tinggi.</p>
            
            <div class="btn-container">
              <a href="${CONFIG.FRONTEND_URL || '#'}" class="btn" style="color: #ffffff !important;">Lihat Dashboard Lelang</a>
            </div>
          </div>
          <div class="footer">
            <p>Email ini dikirimkan secara otomatis oleh Bidding Management System PT. Berlian Manyar Sejahtera.</p>
            <p>&copy; 2026 PT. Berlian Manyar Sejahtera. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  getOutbid: function(namaAset, nominalLama, nominalBaru) {
    const formatRp = (num) => "Rp " + Number(num).toLocaleString('id-ID');
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Penawaran Anda Telah Terlampaui</title>
        <style>
          body { font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding: 25px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 5px 0 0 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 13px; }
          .content { padding: 30px; }
          .content h2 { margin-top: 0; color: #e11d48; font-size: 20px; font-weight: 600; }
          .content p { line-height: 1.6; color: #475569; font-size: 15px; }
          .card { background-color: #fff1f2; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #ffe4e6; }
          .badge { background-color: #ffe4e6; color: #be123c; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block; }
          .btn-container { text-align: center; margin: 30px 0 10px 0; }
          .btn { background-color: #e11d48; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; transition: background-color 0.2s ease; box-shadow: 0 4px 6px -1px rgba(225, 29, 72, 0.2); }
          .btn:hover { background-color: #be123c; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="margin-bottom: 8px;">
              <img src="cid:logo" alt="BMS Logo" style="height: 48px; max-height: 48px; width: auto;" onerror="this.style.display='none';">
            </div>
            <h1>BMS E-Bidding</h1>
            <p>PT. Berlian Manyar Sejahtera</p>
          </div>
          <div class="content">
            <h2>Penawaran Anda Telah Terlampaui</h2>
            <p>Halo,</p>
            <p>Kami menginformasikan bahwa terdapat penawaran yang lebih tinggi dari Anda untuk aset di bawah ini. Silakan ajukan penawaran baru agar peluang Anda untuk memenangkan lelang aset ini tetap terbuka.</p>
            
            <div class="card">
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #ffe4e6;">
                  <td style="padding: 10px 0; color: #be123c; font-weight: 500; font-size: 14px;">Nama Aset</td>
                  <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 14px;">${namaAset}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ffe4e6;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Penawaran Lama Anda</td>
                  <td style="padding: 10px 0; color: #64748b; text-decoration: line-through; text-align: right; font-size: 14px;">${formatRp(nominalLama)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ffe4e6;">
                  <td style="padding: 10px 0; color: #e11d48; font-weight: 600; font-size: 14px;">Harga Tertinggi Sekarang</td>
                  <td style="padding: 10px 0; color: #e11d48; font-weight: 700; text-align: right; font-size: 16px;">${formatRp(nominalBaru)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #be123c; font-weight: 500; font-size: 14px;">Status Anda</td>
                  <td style="padding: 10px 0; text-align: right;"><span class="badge">🔴 Terlampaui</span></td>
                </tr>
              </table>
            </div>
            
            <p>Silakan ajukan penawaran baru Anda sebelum batas waktu berakhir untuk mengamankan aset ini.</p>
            
            <div class="btn-container">
              <a href="${CONFIG.FRONTEND_URL || '#'}" class="btn" style="color: #ffffff !important;">Ajukan Penawaran Baru</a>
            </div>
          </div>
          <div class="footer">
            <p>Email ini dikirimkan secara otomatis oleh Bidding Management System PT. Berlian Manyar Sejahtera.</p>
            <p>&copy; 2026 PT. Berlian Manyar Sejahtera. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  getAdminAlert: function(namaAset, nominalBaru, namaBaru, emailBaru) {
    const formatRp = (num) => "Rp " + Number(num).toLocaleString('id-ID');
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notifikasi Lelang Baru</title>
        <style>
          body { font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 25px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 5px 0 0 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 13px; }
          .content { padding: 30px; }
          .content h2 { margin-top: 0; color: #0f172a; font-size: 20px; font-weight: 600; }
          .content p { line-height: 1.6; color: #475569; font-size: 15px; }
          .card { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }
          .btn-container { text-align: center; margin: 30px 0 10px 0; }
          .btn { background-color: #0f172a; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; transition: background-color 0.2s ease; }
          .btn:hover { background-color: #1e293b; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="margin-bottom: 8px;">
              <img src="cid:logo" alt="BMS Logo" style="height: 48px; max-height: 48px; width: auto;" onerror="this.style.display='none';">
            </div>
            <h1>BMS E-Bidding Admin</h1>
            <p>PT. Berlian Manyar Sejahtera</p>
          </div>
          <div class="content">
            <h2>Penawaran Lelang Baru Diterima</h2>
            <p>Halo Admin,</p>
            <p>Sistem telah mencatat adanya penawaran baru yang sah (VALID) untuk aset lelang aktif. Berikut detail transaksinya:</p>
            
            <div class="card">
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nama Aset</td>
                  <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 14px;">${namaAset}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nominal Penawaran</td>
                  <td style="padding: 10px 0; color: #2596be; font-weight: 700; text-align: right; font-size: 16px;">${formatRp(nominalBaru)}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nama Penawar</td>
                  <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 14px;">${namaBaru}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Email Penawar</td>
                  <td style="padding: 10px 0; color: #475569; text-align: right; font-size: 14px;">${emailBaru}</td>
                </tr>
              </table>
            </div>
            
            <div class="btn-container">
              <a href="${CONFIG.FRONTEND_URL || '#'}" class="btn" style="color: #ffffff !important;">Kelola Dashboard Admin</a>
            </div>
          </div>
          <div class="footer">
            <p>Email ini dikirimkan secara otomatis oleh Bidding Management System PT. Berlian Manyar Sejahtera.</p>
            <p>&copy; 2026 PT. Berlian Manyar Sejahtera. All rights reserved.</p>
          </div>
        </div>
      </html>
    `;
  },

  getWinnerAlert: function(namaAset, nominalMenang, namaPemenang) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pemenang Lelang</title>
        <style>
          body { font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); padding: 25px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 5px 0 0 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 13px; }
          .content { padding: 30px; }
          .content h2 { margin-top: 0; color: #ca8a04; font-size: 20px; font-weight: 600; }
          .content p { line-height: 1.6; color: #475569; font-size: 15px; }
          .card { background-color: #fef08a; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #fef08a; }
          .badge { background-color: #ca8a04; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block; }
          .btn-container { text-align: center; margin: 30px 0 10px 0; }
          .btn { background-color: #ca8a04; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; transition: background-color 0.2s ease; box-shadow: 0 4px 6px -1px rgba(202, 138, 4, 0.2); }
          .btn:hover { background-color: #a16207; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="margin-bottom: 8px;">
              <img src="cid:logo" alt="BMS Logo" style="height: 48px; max-height: 48px; width: auto;" onerror="this.style.display='none';">
            </div>
            <h1>BMS E-Bidding</h1>
            <p>PT. Berlian Manyar Sejahtera</p>
          </div>
          <div class="content">
            <h2>Selamat, Anda Dinyatakan Pemenang Lelang</h2>
            <p>Yth. Bapak/Ibu <b>${namaPemenang}</b>,</p>
            <p>Selamat, Anda telah ditetapkan sebagai pemenang lelang resmi untuk aset berikut setelah batas waktu pengajuan penawaran berakhir:</p>
            
            <div class="card">
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #fef08a;">
                  <td style="padding: 10px 0; color: #854d0e; font-weight: 500; font-size: 14px;">Nama Aset</td>
                  <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 14px;">${namaAset}</td>
                </tr>
                <tr style="border-bottom: 1px solid #fef08a;">
                  <td style="padding: 10px 0; color: #854d0e; font-weight: 500; font-size: 14px;">Nominal Kemenangan</td>
                  <td style="padding: 10px 0; color: #ca8a04; font-weight: 700; text-align: right; font-size: 16px;">${nominalMenang}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #854d0e; font-weight: 500; font-size: 14px;">Status</td>
                  <td style="padding: 10px 0; text-align: right;"><span class="badge">🏆 Pemenang Lelang</span></td>
                </tr>
              </table>
            </div>
            
            <p>Silakan hubungi Administrator atau kunjungi bagian pengelolaan aset perusahaan untuk melakukan proses verifikasi serta serah terima aset terkait.</p>
            
            <div class="btn-container">
              <a href="${CONFIG.FRONTEND_URL || '#'}" class="btn" style="color: #ffffff !important;">Kunjungi Aplikasi Bidding</a>
            </div>
          </div>
          <div class="footer">
            <p>Email ini dikirimkan secara otomatis oleh Bidding Management System PT. Berlian Manyar Sejahtera.</p>
            <p>&copy; 2026 PT. Berlian Manyar Sejahtera. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  },

  getAdminClosedAlert: function(namaAset, nominalMenang, namaPemenang, emailPemenang) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lelang Selesai</title>
        <style>
          body { font-family: 'Outfit', 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 25px 20px; text-align: center; color: #ffffff; }
          .header h1 { margin: 5px 0 0 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
          .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 13px; }
          .content { padding: 30px; }
          .content h2 { margin-top: 0; color: #0f172a; font-size: 20px; font-weight: 600; }
          .content p { line-height: 1.6; color: #475569; font-size: 15px; }
          .card { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }
          .btn-container { text-align: center; margin: 30px 0 10px 0; }
          .btn { background-color: #0f172a; color: #ffffff !important; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; transition: background-color 0.2s ease; }
          .btn:hover { background-color: #1e293b; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="margin-bottom: 8px;">
              <img src="cid:logo" alt="BMS Logo" style="height: 48px; max-height: 48px; width: auto;" onerror="this.style.display='none';">
            </div>
            <h1>BMS E-Bidding Admin</h1>
            <p>PT. Berlian Manyar Sejahtera</p>
          </div>
          <div class="content">
            <h2>Lelang Selesai & Pemenang Terdeteksi</h2>
            <p>Halo Admin,</p>
            <p>Masa lelang untuk aset di bawah ini telah ditutup dengan pemenang resmi:</p>
            
            <div class="card">
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nama Aset</td>
                  <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 14px;">${namaAset}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nominal Akhir</td>
                  <td style="padding: 10px 0; color: #2596be; font-weight: 700; text-align: right; font-size: 16px;">${nominalMenang}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Nama Pemenang</td>
                  <td style="padding: 10px 0; color: #0f172a; font-weight: 600; text-align: right; font-size: 14px;">${namaPemenang}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-weight: 500; font-size: 14px;">Email Pemenang</td>
                  <td style="padding: 10px 0; color: #475569; text-align: right; font-size: 14px;">${emailPemenang}</td>
                </tr>
              </table>
            </div>
            
            <p>Silakan hubungi pemenang lelang di atas untuk proses tindak lanjut penyelesaian.</p>
            
            <div class="btn-container">
              <a href="${CONFIG.FRONTEND_URL || '#'}" class="btn" style="color: #ffffff !important;">Kelola Dashboard Admin</a>
            </div>
          </div>
          <div class="footer">
            <p>Email ini dikirimkan secara otomatis oleh Bidding Management System PT. Berlian Manyar Sejahtera.</p>
            <p>&copy; 2026 PT. Berlian Manyar Sejahtera. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

const NotificationService = {
  // Ubah ke true jika ingin menggunakan Microsoft Graph API, false jika ingin menggunakan GmailApp
  USE_MS_GRAPH: true, 

  sendAlerts: function(namaAset, nominalBaru, emailBaru, namaBaru, emailLama, nominalLama) {
    const successHtml = EmailTemplates.getSuccessBid(namaAset, nominalBaru);
    this._dispatch(emailBaru, `✅ Penawaran Berhasil Diajukan: ${namaAset}`, successHtml);

    if (emailLama && emailLama !== "-" && emailLama !== emailBaru) {
      const outbidHtml = EmailTemplates.getOutbid(namaAset, nominalLama, nominalBaru);
      this._dispatch(emailLama, `⚠️ Penawaran Terlampaui: Ada penawaran yang lebih tinggi untuk ${namaAset}`, outbidHtml);
    }
  },

  _getLogoBlob: function() {
    try {
      const files = DriveApp.getFilesByName("Logo-Berlian-Manyar-Sejahtera.png");
      if (files.hasNext()) {
        return files.next().getBlob();
      }
    } catch (e) {
      Logger.log("Gagal mengambil logo blob: " + e.toString());
    }
    return null;
  },

  _getMsAccessToken: function() {
    const props = PropertiesService.getScriptProperties();
    const accessToken = props.getProperty('MS_ACCESS_TOKEN');
    const refreshToken = props.getProperty('MS_REFRESH_TOKEN');
    const expiryStr = props.getProperty('MS_TOKEN_EXPIRY');
    
    if (!refreshToken) {
      throw new Error("Aplikasi belum terhubung dengan Microsoft. Silakan buka URL Web App Anda di browser dengan parameter '?action=auth' (misal: https://script.google.com/macros/s/.../exec?action=auth) untuk melakukan otorisasi.");
    }
    
    const now = new Date().getTime();
    const expiry = expiryStr ? Number(expiryStr) : 0;
    
    // Jika access token masih valid (buffer 5 menit), gunakan yang ada
    if (accessToken && (expiry - now > 5 * 60 * 1000)) {
      return accessToken;
    }
    
    // Jika tidak valid, perbarui access token menggunakan refresh token
    const tenantId = props.getProperty('MS_TENANT_ID') || '5540bb28-9fec-4e8f-a639-a4c2bc699bcf';
    const clientId = props.getProperty('MS_CLIENT_ID') || 'cbf2760f-e6c3-45b7-8982-222306d31b2f';
    const clientSecret = props.getProperty('MS_CLIENT_SECRET');
    
    if (!clientSecret) {
      throw new Error("Client Secret Microsoft Graph (MS_CLIENT_SECRET) belum diatur di Script Properties. Jalankan fungsi setupMicrosoftGraphCredentials() terlebih dahulu.");
    }
    
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const payload = {
      client_id: clientId,
      scope: 'https://graph.microsoft.com/Mail.Send offline_access',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_secret: clientSecret
    };
    
    const options = {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(tokenUrl, options);
    const data = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 200) {
      throw new Error('Gagal memperbarui token Microsoft Graph: ' + (data.error_description || response.getContentText()));
    }
    
    props.setProperty('MS_ACCESS_TOKEN', data.access_token);
    if (data.refresh_token) {
      props.setProperty('MS_REFRESH_TOKEN', data.refresh_token);
    }
    const expiryTime = new Date().getTime() + (data.expires_in * 1000);
    props.setProperty('MS_TOKEN_EXPIRY', expiryTime.toString());
    
    return data.access_token;
  },

  _dispatchMS: function(to, subject, html) {
    try {
      const accessToken = this._getMsAccessToken();
      const logoBlob = this._getLogoBlob();

      const payload = {
        message: {
          subject: subject,
          body: {
            contentType: "HTML",
            content: html
          },
          toRecipients: [
            {
              emailAddress: {
                address: to
              }
            }
          ],
          replyTo: [
            {
              emailAddress: {
                address: "bidding@bms.jiipe.co.id"
              }
            }
          ],
          attachments: []
        },
        saveToSentItems: true
      };

      if (logoBlob) {
        const base64Bytes = Utilities.base64Encode(logoBlob.getBytes());
        payload.message.attachments.push({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: "Logo-Berlian-Manyar-Sejahtera.png",
          contentType: logoBlob.getContentType() || "image/png",
          isInline: true,
          contentBytes: base64Bytes,
          contentId: "logo"
        });
      }

      const url = 'https://graph.microsoft.com/v1.0/me/sendMail';
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + accessToken
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      if (responseCode !== 200 && responseCode !== 202) {
        Logger.log("Gagal kirim email via MS Graph (Delegated). Status: " + responseCode + ", Respon: " + response.getContentText());
      } else {
        Logger.log("Email berhasil dikirim via MS Graph (Delegated) ke: " + to);
      }
    } catch (e) {
      Logger.log("Gagal kirim email via MS Graph (Delegated): " + e.toString());
    }
  },

  _dispatchGmail: function(to, subject, html) {
    try {
      const logoBlob = this._getLogoBlob();
      const options = {
        htmlBody: html,
        name: "BMS Bidding Portal",
        replyTo: "bidding@bms.jiipe.co.id"
      };
      
      if (logoBlob) {
        options.inlineImages = {
          logo: logoBlob
        };
      }
      
      GmailApp.sendEmail(to, subject, "", options);
    } catch (e) {
      Logger.log("Gagal kirim email via GmailApp: " + e.toString());
    }
  },
  
  _dispatch: function(to, subject, html) {
    if (this.USE_MS_GRAPH) {
      this._dispatchMS(to, subject, html);
    } else {
      this._dispatchGmail(to, subject, html);
    }
  }
};

/**
 * Jalankan fungsi ini SEKALI di Editor Apps Script untuk menyimpan kredensial Microsoft Graph secara aman.
 * Ganti nilainya dengan Client Secret dan Tenant ID Anda dari portal Azure (Entra ID).
 */
function setupMicrosoftGraphCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('MS_CLIENT_ID', 'cbf2760f-e6c3-45b7-8982-222306d31b2f');
  props.setProperty('MS_TENANT_ID', '5540bb28-9fec-4e8f-a639-a4c2bc699bcf');
  props.setProperty('MS_CLIENT_SECRET', 'GANTI_DENGAN_CLIENT_SECRET_ANDA');
  Logger.log("Kredensial Microsoft Graph berhasil dikonfigurasi ke dalam Script Properties!");
}

/**
 * Memeriksa aset lelang yang sudah tutup secara terjadwal (Time-Driven Trigger)
 * dan mengirim email notifikasi resmi ke pemenang serta admin.
 */
function checkAndNotifyClosedAssets() {
  const assets = ViewModel.getAllActive();
  const properties = PropertiesService.getScriptProperties();
  
  let notifiedAssets = [];
  try {
    notifiedAssets = JSON.parse(properties.getProperty('NOTIFIED_CLOSED_ASSETS') || '[]');
  } catch(e) {}

  let updated = false;

  assets.forEach(asset => {
    // Jika lelang sudah selesai (CLOSED), ada pemenang yang terdaftar, dan belum dikirimi email kemenangan
    if (asset.sisaWaktu === "CLOSED" && asset.emailPemenang !== "-" && !notifiedAssets.includes(asset.id)) {
      
      const winnerHtml = EmailTemplates.getWinnerAlert(asset.nama, asset.bidTertinggi, asset.namaPemenang);
      NotificationService._dispatch(asset.emailPemenang, `🎉 Selamat! Anda Memenangkan Lelang: ${asset.nama}`, winnerHtml);
      
      const adminHtml = EmailTemplates.getAdminClosedAlert(asset.nama, asset.bidTertinggi, asset.namaPemenang, asset.emailPemenang);
      NotificationService._dispatch(CONFIG.ADMIN_EMAIL, `🔔 LELANG SELESAI: ${asset.nama}`, adminHtml);

      notifiedAssets.push(asset.id);
      updated = true;
    }
  });
  
  if (updated) {
    properties.setProperty('NOTIFIED_CLOSED_ASSETS', JSON.stringify(notifiedAssets));
  }
}

/**
 * Helper function to debug and check daily email quota remaining in GAS console
 */
function checkEmailQuota() {
  Logger.log("Sisa kuota kirim email harian Anda: " + MailApp.getRemainingDailyQuota());
}

/**
 * Jalankan fungsi ini langsung dari dropdown Google Apps Script Editor
 * untuk melihat status koneksi seluruh integrasi sistem (Sheets, Drive, Microsoft Graph).
 */
function runSystemDiagnostics() {
  Logger.log("=== MEMULAI DIAGNOSTIK KONEKSI SISTEM ===");
  
  // 1. Uji Google Sheets
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log("✅ Google Sheets: Terkoneksi. Nama spreadsheet: " + sheet.getName());
  } catch (e) {
    Logger.log("❌ Google Sheets: Gagal mengakses. Detail: " + e.toString());
  }
  
  // 2. Uji Google Drive Folder
  try {
    const folder = DriveApp.getFolderById("1Ut4emx_c0IodG2j38JYzs3h0F_OivfzJ");
    Logger.log("✅ Google Drive Folder: Terkoneksi. Nama folder: " + folder.getName());
  } catch (e) {
    Logger.log("❌ Google Drive Folder: Gagal mengakses. Detail: " + e.toString());
  }
  
  // 3. Uji Microsoft Graph Token & API
  try {
    const token = NotificationService._getMsAccessToken();
    if (token) {
      Logger.log("✅ Microsoft Graph API: Terkoneksi (Token berhasil didekripsi/diambil).");
    } else {
      Logger.log("❌ Microsoft Graph API: Gagal mengambil token (Butuh Otorisasi Ulang).");
    }
  } catch (e) {
    Logger.log("❌ Microsoft Graph API: Error. Detail: " + e.toString());
  }
  
  Logger.log("=== DIAGNOSTIK SELESAI ===");
}
