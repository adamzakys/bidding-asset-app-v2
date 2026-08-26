/**
 * API Service for communication with Google Apps Script (GAS) Backend
 */
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzEKhgNWhP6gV1z8ACI6v8e_tAF6Wa9svgzO8Ylh3hk0XMcPl_o9XU7bRH153g4X8XNtg/exec';

const ApiService = {
  /**
   * Helper function to execute post fetch requests to GAS
   * Sends payload as a string body with default simple content-type to bypass CORS preflight OPTIONS request
   */
  async _post(action, payload = {}) {
    try {
      const body = { action, ...payload };

      const response = await fetch(GAS_API_URL, {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`HTTP status error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Error on action [${action}]:`, error);
      return {
        success: false,
        message: 'Koneksi gagal: Silakan periksa jaringan Anda atau coba lagi nanti.'
      };
    }
  },

  /**
   * Login user check against backend database
   * @param {string} email 
   */
  async login(email) {
    return this._post('login', { email });
  },

  /**
   * Register new user in database
   * @param {object} userData { email, nama_lengkap, nip_bms, no_wa, nik, fileKepegawaian, fileKesanggupan, fileKtp }
   */
  async register(userData) {
    return this._post('register', userData);
  },

  async getAssets() {
    const response = await this._post('getAssets');
    if (response && response.success && Array.isArray(response.data)) {
      response.data = response.data.map(asset => {
        if (asset.gambarUrls && Array.isArray(asset.gambarUrls)) {
          asset.gambarUrls = asset.gambarUrls.map(url => {
            if (url && url.includes('lh3.googleusercontent.com/d/')) {
              const parts = url.split('/');
              const fileId = parts[parts.length - 1];
              return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
            }
            return url;
          });
        }
        return asset;
      });
    }
    return response;
  },

  /**
   * Submit bid for an asset
   * @param {string} assetId 
   * @param {string} email 
   * @param {number} nominal 
   */
  async submitBid(assetId, email, nominal) {
    return this._post('submitBid', { assetId, email, nominal });
  },

  /**
   * Fetch all bids submitted by a user
   * @param {string} email
   */
  async getUserBids(email) {
    return this._post('getUserBids', { email });
  },

  /**
   * Cancel the highest bid for an asset (Admin only)
   * @param {string} assetId 
   * @param {string} adminEmail 
   */
  async cancelBid(assetId, adminEmail) {
    return this._post('cancelBid', { assetId, adminEmail });
  },

  /**
   * Add a new asset to the catalog (Admin only)
   * @param {string} adminEmail 
   * @param {object} assetData { nama, kategori, deskripsi, hargaBuka, gambarUrls, waktuSelesai }
   */
  async addAsset(adminEmail, assetData) {
    return this._post('addAsset', { adminEmail, data: assetData });
  },

  /**
   * Edit an existing asset (Admin only)
   */
  async editAsset(adminEmail, assetId, assetData) {
    return this._post('editAsset', { adminEmail, assetId, data: assetData });
  },

  /**
   * Delete an asset by setting status to CANCEL (Admin only)
   */
  async deleteAsset(adminEmail, assetId) {
    return this._post('deleteAsset', { adminEmail, assetId });
  },

  /**
   * Fetch all registered users (Admin only)
   */
  async getUsers(adminEmail) {
    return this._post('getUsers', { adminEmail });
  },

  /**
   * Update user role and account status (Admin only)
   */
  async updateUser(adminEmail, targetEmail, role, status, namaLengkap, nipBms, noWa, nik, files) {
    return this._post('updateUser', {
      adminEmail,
      targetEmail,
      role,
      status,
      nama_lengkap: namaLengkap,
      nip_bms: nipBms,
      no_wa: noWa,
      nik: nik,
      files: files
    });
  },

  /**
   * Fetch system quotas and storage limits (Admin only)
   */
  async getSystemQuotas(adminEmail) {
    return this._post('getSystemQuotas', { adminEmail });
  },

  /**
   * Fetch global system configuration (Auth Mode and Registration Status)
   */
  async getSystemConfig() {
    return this._post('getSystemConfig');
  },

  /**
   * Update global system configuration (Admin only)
   */
  async updateSystemConfig(adminEmail, configData) {
    return this._post('updateSystemConfig', { adminEmail, ...configData });
  }
};
