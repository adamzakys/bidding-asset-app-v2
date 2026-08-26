const IMAGE_LOAD_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgNDAwIDMwMCI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNmMWY1ZjkiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyMDAsMTUwKSI+PGNpcmNsZSBjeD0iMCIgY3k9IjAiIHI9IjE4IiBzdHJva2U9IiNjYmQ1ZTEiIHN0cm9rZS13aWR0aD0iNCIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0tMTgsMCBBMTgsMTggMCAwLDEgMCwtMTgiIHN0cm9rZT0iIzNiODJmNiIgc3Ryb2tlLXdpZHRoPSI0IiBmaWxsPSJub25lIj48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InJvdGF0ZSIgZnJvbT0iMCIgdG89IjM2MCIgZHVyPSIxcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3BhdGg+PC9nPjwvc3ZnPg==';

/**
 * UI Service for DOM manipulation, page states, and rendering
 */
const UiService = {
  // Cache variables
  rawAssets: null,
  lastAssetsFetchTime: null,
  cachedUserBids: null,
  lastUserBidsFetchTime: null,
  rawUsers: null,
  lastUsersFetchTime: null,

  // Store loaded assets locally for UI reference (e.g. bidding validation)
  loadedAssets: [],

  // Store uploaded image base64 strings locally for Add Asset
  compressedImages: [],

  // Store uploaded image base64 strings locally for Edit Asset
  editCompressedImages: [],

  // Carousel variables for Detailed Modal view
  currentDetailImages: [],
  currentDetailIdx: 0,
  currentDetailAssetId: null,

  countdownInterval: null,
  galleryLayout: 'card',
  currentPage: 1,
  assetsPerPage: 6,
  currentFilteredAssets: [],

  /**
   * Sets up real-time thousands dot formatting for Rupiah inputs
   */
  setupRupiahInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', (e) => {
      let value = e.target.value;
      // Remove all non-digit characters
      let digits = value.replace(/[^0-9]/g, '');
      if (digits) {
        e.target.value = Number(digits).toLocaleString('id-ID');
      } else {
        e.target.value = '';
      }
    });
  },

  /**
   * Starts a background timer that updates lelang countdowns on the gallery view
   */
  startCountdownTimer() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      const galleryView = document.getElementById('view-gallery');
      if (galleryView && !galleryView.classList.contains('hidden') && this.loadedAssets && this.loadedAssets.length > 0) {
        this.renderAssets(this.loadedAssets);
      }
    }, 15000); // refresh gallery every 15s to update remaining time
  },

  /**
   * Initializes application event listeners and sets initial page state
   */
  init() {
    // Setup Theme Mode (default is light)
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.setTheme(savedTheme);

    // Set floating help button template
    this.updateSupportButtonMailto();

    // Theme Toggle Switch Events (Desktop & Mobile)
    const toggleThemeFn = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const nextTheme = isDark ? 'light' : 'dark';
      this.setTheme(nextTheme);
    };

    const themeBtn = document.getElementById('theme-toggle-switch');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleThemeFn);
    }
    const themeBtnMobile = document.getElementById('theme-toggle-switch-mobile');
    if (themeBtnMobile) {
      themeBtnMobile.addEventListener('click', toggleThemeFn);
    }

    // Initialize Rupiah Inputs Live Formatting
    this.setupRupiahInput('bid-amount');
    this.setupRupiahInput('new-asset-price');
    this.setupRupiahInput('edit-asset-price-input');
    this.setupRupiahInput('search-asset-min-price');
    this.setupRupiahInput('search-asset-max-price');

    // Initialize Kelipatan Input Dynamic Formatting
    const setupKelipatanValInput = (prefix) => {
      const valInput = document.getElementById(`${prefix}-asset-kelipatan-val`);
      const typeSelect = document.getElementById(`${prefix}-asset-kelipatan-type`);
      if (!valInput || !typeSelect) return;

      valInput.addEventListener('input', (e) => {
        const type = typeSelect.value;
        let value = e.target.value;
        if (type === 'NOMINAL') {
          let digits = value.replace(/[^0-9]/g, '');
          e.target.value = digits ? Number(digits).toLocaleString('id-ID') : '';
        } else if (type === 'PERCENTAGE') {
          let cleaned = value.replace(/[^0-9.]/g, '');
          const parts = cleaned.split('.');
          if (parts.length > 2) {
            cleaned = parts[0] + '.' + parts.slice(1).join('');
          }
          e.target.value = cleaned;
        }
      });
    };

    setupKelipatanValInput('new');
    setupKelipatanValInput('edit');

    // Redirect user bids card to history tab directly
    const totalBidsCard = document.getElementById('stat-total-bids-card');
    if (totalBidsCard) {
      totalBidsCard.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchDashboardView('cart');
      });
    }

    // Mobile Menu Drawer Toggles removed as sidebar is hidden on mobile and bottom navbar is used instead.

    // Register Form submission
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value.trim();
        const nip = document.getElementById('reg-nip').value.trim();
        const whatsapp = document.getElementById('reg-whatsapp').value.trim();
        const nik = document.getElementById('reg-nik').value.trim();

        const fileKepegawaianEl = document.getElementById('reg-file-kepegawaian');
        const fileKesanggupanEl = document.getElementById('reg-file-kesanggupan');
        const fileKtpEl = document.getElementById('reg-file-ktp');

        if (!name || !nip || !whatsapp || !nik || !fileKepegawaianEl.files[0] || !fileKesanggupanEl.files[0] || !fileKtpEl.files[0]) {
          this.showToast('Harap lengkapi seluruh data profil dan unggah ketiga berkas PDF.', 'error');
          return;
        }

        // Limit size is 3MB (3 * 1024 * 1024 bytes)
        const maxSizeBytes = 3 * 1024 * 1024;
        if (fileKepegawaianEl.files[0].size > maxSizeBytes) {
          this.showToast('File gagal dikirim! Ukuran Surat Kepegawaian melebihi batas 3MB.', 'error');
          return;
        }
        if (fileKesanggupanEl.files[0].size > maxSizeBytes) {
          this.showToast('File gagal dikirim! Ukuran Surat Kesanggupan melebihi batas 3MB.', 'error');
          return;
        }
        if (fileKtpEl.files[0].size > maxSizeBytes) {
          this.showToast('File gagal dikirim! Ukuran KTP Pemohon melebihi batas 3MB.', 'error');
          return;
        }

        const readAsBase64 = (file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
          });
        };

        try {
          this.showButtonLoading('btn-submit-register', true, 'Membaca berkas PDF...');
          const fileKepegawaianBase64 = await readAsBase64(fileKepegawaianEl.files[0]);
          const fileKesanggupanBase64 = await readAsBase64(fileKesanggupanEl.files[0]);
          const fileKtpBase64 = await readAsBase64(fileKtpEl.files[0]);

          const registrationData = {
            nama_lengkap: name,
            nip_bms: nip,
            no_wa: whatsapp,
            nik: nik,
            fileKepegawaian: {
              name: fileKepegawaianEl.files[0].name,
              base64: fileKepegawaianBase64
            },
            fileKesanggupan: {
              name: fileKesanggupanEl.files[0].name,
              base64: fileKesanggupanBase64
            },
            fileKtp: {
              name: fileKtpEl.files[0].name,
              base64: fileKtpBase64
            }
          };

          await AuthService.registerUser(registrationData);
        } catch (error) {
          console.error("Gagal membaca file PDF:", error);
          this.showToast('Gagal membaca file PDF. Harap pastikan file tidak rusak.', 'error');
          this.showButtonLoading('btn-submit-register', false, 'Daftar');
        }
      });
    }

    // Custom Searchable Dropdown Event Listeners Setup
    const searchInput = document.getElementById('bid-asset-search-input');
    const dropdownPanel = document.getElementById('bid-asset-dropdown-panel');
    const searchQuery = document.getElementById('bid-asset-search-query');

    if (searchInput && dropdownPanel) {
      searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownPanel.classList.toggle('hidden');
        if (!dropdownPanel.classList.contains('hidden')) {
          if (searchQuery) {
            searchQuery.value = '';
            searchQuery.focus();
          }
          this.renderCustomSelectOptions(this.openAssetsForSelect || []);
        }
      });
    }

    if (searchQuery) {
      searchQuery.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = (this.openAssetsForSelect || []).filter(asset =>
          asset.nama.toLowerCase().includes(query) ||
          asset.kategori.toLowerCase().includes(query)
        );
        this.renderCustomSelectOptions(filtered);
      });
      searchQuery.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('bid-asset-dropdown-panel');
      const wrapper = document.getElementById('custom-searchable-select');
      if (panel && wrapper && !wrapper.contains(e.target)) {
        panel.classList.add('hidden');
      }
    });

    // Bidding Form submission
    const bidForm = document.getElementById('bid-form');
    if (bidForm) {
      bidForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const assetSelect = document.getElementById('bid-asset-select');
        const bidAmountInput = document.getElementById('bid-amount');

        const assetId = assetSelect.value;
        const bidAmount = Number(bidAmountInput.value.replace(/[^0-9]/g, ''));

        if (!assetId) {
          this.showToast('Silakan pilih aset terlebih dahulu.', 'error');
          return;
        }
        if (!bidAmount || bidAmount <= 0) {
          this.showToast('Masukkan nominal bid yang valid.', 'error');
          return;
        }

        const selectedAsset = this.loadedAssets.find(a => a.id === assetId);
        if (!selectedAsset) {
          this.showToast('Aset tidak ditemukan.', 'error');
          return;
        }

        // Client-side Validation:
        const parsedHighest = Number(selectedAsset.bidTertinggi.replace(/[^0-9]/g, '')) || 0;
        const parsedStarting = Number(selectedAsset.hargaBuka.replace(/[^0-9]/g, '')) || 0;
        const currentHighest = parsedHighest > 0 ? parsedHighest : parsedStarting;
        const kelipatan = Number(selectedAsset.kelipatanBidRaw) || 0;

        if (parsedHighest === 0) {
          if (bidAmount < parsedStarting) {
            this.showToast(`Nominal bid minimal sama dengan harga buka: Rp ${parsedStarting.toLocaleString('id-ID')}`, 'error');
            return;
          }
        } else {
          if (kelipatan > 0) {
            const minRequired = parsedHighest + kelipatan;
            if (bidAmount < minRequired) {
              this.showToast(`Nominal bid minimal Rp ${minRequired.toLocaleString('id-ID')} (Kelipatan Rp ${kelipatan.toLocaleString('id-ID')})`, 'error');
              return;
            }
          } else {
            if (bidAmount <= parsedHighest) {
              this.showToast(`Nominal bid harus lebih tinggi dari penawaran tertinggi saat ini: Rp ${parsedHighest.toLocaleString('id-ID')}`, 'error');
              return;
            }
          }
        }

        const user = AuthService.getCurrentUser();
        if (!user) {
          this.showToast('Autentikasi diperlukan.', 'error');
          AuthService.logout();
          return;
        }
        if (String(user.role).toUpperCase() === 'ADMIN') {
          this.showToast('Gagal: Pengguna dengan peran ADMIN tidak diperbolehkan mengajukan penawaran.', 'error');
          return;
        }

        const confirmMsg = `Apakah Anda yakin ingin mengirimkan penawaran sebesar Rp ${bidAmount.toLocaleString('id-ID')} untuk aset "${selectedAsset.nama}"?`;
        if (!confirm(confirmMsg)) {
          return;
        }

        this.showButtonLoading('btn-submit-bid', true, 'Memproses...');
        const result = await ApiService.submitBid(assetId, user.email, bidAmount);
        this.showButtonLoading('btn-submit-bid', false, 'Kirim Penawaran');

        if (result.success) {
          this.showToast(result.message || 'Bid Anda berhasil dimasukkan!', 'success');
          bidAmountInput.value = '';
          this.showWhitelistInstructionModal(user.email);
          await this.loadActiveAssets(true);
        } else {
          this.showToast(result.message || 'Gagal mengirimkan penawaran.', 'error');
        }
      });
    }

    // Asset Select changes (for updating bid min label helper)
    const assetSelect = document.getElementById('bid-asset-select');
    if (assetSelect) {
      assetSelect.addEventListener('change', () => {
        this.updateBidHelperLabel();
      });
    }

    // Microsoft Sign-In button click listener
    const msBtn = document.getElementById('microsoft-signin-btn');
    if (msBtn) {
      msBtn.addEventListener('click', () => {
        AuthService.handleMsSignIn();
      });
    }

    // Logout button click listener
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        AuthService.logout();
      });
    }

    // Refresh Assets button click listener
    const refreshBtns = document.querySelectorAll('[id="btn-refresh-assets"]');
    refreshBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const activeView = document.querySelector('#view-manage-assets').classList.contains('hidden') ?
          (document.querySelector('#view-manage-users').classList.contains('hidden') ?
            (document.querySelector('#view-cart').classList.contains('hidden') ? 'gallery' : 'cart')
            : 'manage-users')
          : 'manage-assets';

        if (activeView === 'gallery' || activeView === 'cart') {
          this.loadActiveAssets(true);
        } else if (activeView === 'manage-assets') {
          this.loadAdminAssetsTable(true);
        } else {
          this.loadAdminUsersTable(true);
        }
      });
    });

    // Close modals on clicking backdrop
    const modalIds = ['add-asset-modal', 'edit-asset-modal', 'asset-detail-modal', 'image-fullscreen-overlay'];
    modalIds.forEach(id => {
      const modalEl = document.getElementById(id);
      if (modalEl) {
        modalEl.addEventListener('click', (e) => {
          if (e.target === modalEl) {
            if (id === 'add-asset-modal') this.hideAddAssetModal();
            else if (id === 'edit-asset-modal') this.hideEditAssetModal();
            else if (id === 'asset-detail-modal') this.hideAssetDetailModal();
            else if (id === 'image-fullscreen-overlay') this.closeFullscreenImage();
          }
        });
      }
    });

    // Close mobile bid modal on backdrop click
    const bidPanel = document.getElementById('bidding-panel-section');
    if (bidPanel) {
      bidPanel.addEventListener('click', (e) => {
        if (window.innerWidth < 1024 && e.target === bidPanel) {
          this.closeMobileBidModal();
        }
      });
    }

    // Close active modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const fullscreenOverlay = document.getElementById('image-fullscreen-overlay');
        if (fullscreenOverlay && !fullscreenOverlay.classList.contains('hidden')) {
          this.closeFullscreenImage();
          return;
        }

        const detailModal = document.getElementById('asset-detail-modal');
        if (detailModal && !detailModal.classList.contains('hidden')) {
          this.hideAssetDetailModal();
          return;
        }

        const addModal = document.getElementById('add-asset-modal');
        if (addModal && !addModal.classList.contains('hidden')) {
          this.hideAddAssetModal();
          return;
        }

        const editModal = document.getElementById('edit-asset-modal');
        if (editModal && !editModal.classList.contains('hidden')) {
          this.hideEditAssetModal();
          return;
        }

        const bidPanel = document.getElementById('bidding-panel-section');
        if (bidPanel && bidPanel.classList.contains('active') && window.innerWidth < 1024) {
          this.closeMobileBidModal();
          return;
        }
      }
    });

    // Setup fullscreen pointer panning and zooming
    this.setupFullscreenPointerEvents();

    // Check localStorage user session
    const cachedUser = AuthService.getCurrentUser();
    if (cachedUser) {
      this.showDashboard(cachedUser);
      this.startCountdownTimer();
    } else {
      this.showLogin();
    }
  },

  /**
   * Theme toggler helper
   * @param {string} theme 'light' | 'dark'
   */
  setTheme(theme) {
    const root = document.documentElement;
    const switchSpan = document.querySelector('#theme-toggle-switch span');

    if (theme === 'dark') {
      root.classList.add('dark');
      if (switchSpan) {
        switchSpan.classList.replace('translate-x-0', 'translate-x-5');
      }
    } else {
      root.classList.remove('dark');
      if (switchSpan) {
        switchSpan.classList.replace('translate-x-5', 'translate-x-0');
      }
    }
    localStorage.setItem('theme', theme);
  },

  /**
   * Update floating support button mailto template dynamically
   */
  updateSupportButtonMailto() {
    const helpBtn = document.getElementById('floating-help-btn');
    if (!helpBtn) return;

    const user = AuthService.getCurrentUser();
    const adminEmail = 'bidding@bms.jiipe.co.id';
    const subject = encodeURIComponent('Laporan Kendala / Bantuan Aplikasi Bidding');

    let bodyText = `Halo Developer/Admin,\n\nSaya mengalami kendala saat menggunakan Aplikasi Bidding. Berikut detailnya:\n`;
    if (user) {
      bodyText += `- Nama Pengguna: ${user.nama_lengkap || '-'}\n`;
      bodyText += `- Email: ${user.email || '-'}\n`;
      bodyText += `- NIP BMS: ${user.nip_bms || '-'}\n`;
      bodyText += `- No. WA: ${user.no_wa || '-'}\n`;
    } else {
      bodyText += `- Nama Pengguna: [Tuliskan Nama Anda]\n`;
      bodyText += `- Email: [Tuliskan Email Anda]\n`;
    }

    bodyText += `- Kendala yang Dihadapi:\n[Tuliskan kendala atau pertanyaan Anda di sini]\n\nTerima kasih.`;

    const body = encodeURIComponent(bodyText);
    helpBtn.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  },

  /**
   * Universal page switcher helper
   * @param {string} pageId 
   */
  switchPage(pageId) {
    const pages = ['login-page', 'register-page', 'dashboard-page'];
    pages.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === pageId) {
          el.classList.remove('hidden');
          el.classList.add('animate-fade-in');
        } else {
          el.classList.add('hidden');
          el.classList.remove('animate-fade-in');
        }
      }
    });

    // Show/hide mobile bottom navigation depending on the active page
    const mobileBottomNav = document.getElementById('mobile-bottom-nav');
    if (mobileBottomNav) {
      if (pageId === 'dashboard-page') {
        mobileBottomNav.classList.remove('hidden');
      } else {
        mobileBottomNav.classList.add('hidden');
      }
    }

    // Sidebar is responsive and static on desktop, no translation required.
  },

  async showLogin() {
    this.switchPage('login-page');
    this.updateSupportButtonMailto();

    let authMode = 'INTERNAL';
    let registrationClosed = false;

    try {
      const configRes = await ApiService.getSystemConfig();
      if (configRes && configRes.success) {
        authMode = configRes.authMode;
        registrationClosed = configRes.registrationClosed;
      }
    } catch (e) {
      console.error("Gagal memuat konfigurasi lelang:", e);
    }

    AuthService.authMode = authMode;
    AuthService.registrationClosed = registrationClosed;

    this.applyLoginUiConfig(authMode);

    setTimeout(() => {
      if (authMode === 'EXTERNAL') {
        AuthService.initGoogleSignIn();
      }
      AuthService.initMicrosoftSignIn();
    }, 100);
  },

  applyLoginUiConfig(authMode) {
    const googleBtnContainer = document.getElementById('google-signin-btn');
    const dividerContainer = document.getElementById('or-divider-container');
    const externalInfo = document.getElementById('external-login-info');

    if (authMode === 'INTERNAL') {
      if (googleBtnContainer) googleBtnContainer.classList.add('hidden');
      if (dividerContainer) dividerContainer.classList.add('hidden');
      if (externalInfo) externalInfo.classList.add('hidden');
    } else {
      if (googleBtnContainer) googleBtnContainer.classList.remove('hidden');
      if (dividerContainer) dividerContainer.classList.remove('hidden');
      if (externalInfo) externalInfo.classList.remove('hidden');
    }
  },

  /**
   * Displays the Registration screen and auto-fills profile details
   */
  showRegistrationForm(profile) {
    this.switchPage('register-page');

    document.getElementById('reg-avatar').src = profile.picture || 'https://via.placeholder.com/150';
    document.getElementById('reg-email-display').innerText = profile.email;
    document.getElementById('reg-name-display').innerText = profile.nama_lengkap;

    const emailField = document.getElementById('reg-email');
    const nameField = document.getElementById('reg-name');
    emailField.value = profile.email;
    nameField.value = profile.nama_lengkap;

    document.getElementById('reg-nip').value = '';
    document.getElementById('reg-whatsapp').value = '';
    document.getElementById('reg-nik').value = '';
    document.getElementById('reg-file-kepegawaian').value = '';
    document.getElementById('reg-file-kesanggupan').value = '';
    document.getElementById('reg-file-ktp').value = '';
  },

  /**
   * Displays Dashboard screen and pulls active bidding details
   */
  showDashboard(user) {
    this.switchPage('dashboard-page');

    document.getElementById('user-profile-pic').src = user.picture || 'https://via.placeholder.com/40';
    document.getElementById('user-profile-name').innerText = user.nama_lengkap;
    document.getElementById('user-profile-role').innerText = `${user.role} | NIP: ${user.nip_bms || '-'}`;

    this.updateSupportButtonMailto();

    const adminPanel = document.getElementById('admin-quick-panel');
    const adminBadge = document.getElementById('admin-indicator-badge');
    const mobileManageAssets = document.getElementById('mobile-nav-manage-assets');
    const mobileManageUsers = document.getElementById('mobile-nav-manage-users');

    const isAdmin = user && String(user.role).toUpperCase() === 'ADMIN';

    const navGallery = document.getElementById('mobile-nav-gallery');
    const navCart = document.getElementById('mobile-nav-cart');
    const navBid = document.getElementById('mobile-nav-bid');
    const navManageAssets = document.getElementById('mobile-nav-manage-assets');
    const navManageUsers = document.getElementById('mobile-nav-manage-users');

    if (isAdmin) {
      if (adminPanel) adminPanel.classList.remove('hidden');
      if (adminBadge) adminBadge.classList.remove('hidden');
      if (mobileManageAssets) mobileManageAssets.classList.remove('hidden');
      if (mobileManageUsers) mobileManageUsers.classList.remove('hidden');

      // Admin button ordering: Gallery, History, Bid, Manage Assets, Manage Users
      if (navGallery) navGallery.style.order = '1';
      if (navCart) navCart.style.order = '2';
      if (navBid) navBid.style.order = '3';
      if (navManageAssets) navManageAssets.style.order = '4';
      if (navManageUsers) navManageUsers.style.order = '5';
    } else {
      if (adminPanel) adminPanel.classList.add('hidden');
      if (adminBadge) adminBadge.classList.add('hidden');
      if (mobileManageAssets) mobileManageAssets.classList.add('hidden');
      if (mobileManageUsers) mobileManageUsers.classList.add('hidden');

      // Bidder button ordering: Gallery, Bid, History
      if (navGallery) navGallery.style.order = '1';
      if (navBid) navBid.style.order = '2';
      if (navCart) navCart.style.order = '3';
    }

    // Toggle stats cards panel (Total Asset, Aktif, Bid Anda) visibility based on role
    const statsPanel = document.getElementById('stats-panel-section');
    const bidCard = document.getElementById('stat-total-bids-card');
    if (statsPanel) {
      if (isAdmin) {
        statsPanel.classList.remove('hidden');
        statsPanel.classList.remove('grid-cols-3');
        statsPanel.classList.add('grid-cols-2');
        if (bidCard) bidCard.classList.add('hidden');
      } else {
        statsPanel.classList.add('hidden');
        statsPanel.classList.remove('grid-cols-2');
        statsPanel.classList.add('grid-cols-3');
        if (bidCard) bidCard.classList.remove('hidden');
      }
    }

    // Set default view to Gallery
    this.updateCartBadge();
    this.switchDashboardView('gallery');
    this.startCountdownTimer();
  },

  /**
   * Switch between Dashboard workspace panels (Gallery, Kelola Aset, Kelola Pengguna)
   * @param {string} viewId 'gallery' | 'manage-assets' | 'manage-users'
   */
  switchDashboardView(viewId) {
    const currentUser = AuthService.getCurrentUser();
    const isAdmin = currentUser && String(currentUser.role).toUpperCase() === 'ADMIN';

    // Adjust Bidding Panel & Gallery layout for Admin role
    const biddingPanel = document.getElementById('bidding-panel-section');
    const galleryView = document.getElementById('view-gallery');
    const mobileNavBid = document.getElementById('mobile-nav-bid');

    if (biddingPanel && galleryView) {
      if (isAdmin) {
        biddingPanel.classList.add('hidden');
        galleryView.classList.remove('lg:col-span-2');
        galleryView.classList.add('lg:col-span-3');
      } else {
        biddingPanel.classList.remove('hidden');
        galleryView.classList.remove('lg:col-span-3');
        galleryView.classList.add('lg:col-span-2');
      }
    }
    if (mobileNavBid) {
      if (isAdmin) mobileNavBid.classList.add('hidden');
      else mobileNavBid.classList.remove('hidden');
    }

    if (viewId === 'manage-assets' || viewId === 'manage-users' || viewId === 'system-monitor') {
      if (!isAdmin) {
        this.showToast('Akses ditolak: Hanya Admin yang dapat mengakses menu ini.', 'error');
        this.switchDashboardView('gallery');
        return;
      }
    }

    const views = ['gallery', 'manage-assets', 'manage-users', 'cart', 'system-monitor'];
    views.forEach(id => {
      const el = document.getElementById(`view-${id}`);
      const navBtn = document.getElementById(`nav-${id}`);
      if (el) {
        if (id === viewId) {
          el.classList.remove('hidden');
          el.classList.add('animate-fade-in');
        } else {
          el.classList.add('hidden');
          el.classList.remove('animate-fade-in');
        }
      }

      if (navBtn) {
        const isCart = (id === 'cart');
        const flexClass = isCart ? 'flex items-center justify-between' : 'flex items-center gap-3';
        if (id === viewId) {
          navBtn.className = `w-full ${flexClass} px-3 py-2.5 rounded-xl text-xs font-semibold bg-brand-500/10 text-brand-650 dark:text-brand-400 border border-brand-500/20 text-left transition-all`;
        } else {
          navBtn.className = `w-full ${flexClass} px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent text-left transition-all`;
        }
      }

      // Update Mobile Bottom Nav button highlighting
      const mobileNavBtn = document.getElementById(`mobile-nav-${id}`);
      if (mobileNavBtn) {
        const isAdminBtn = (id === 'manage-assets' || id === 'manage-users' || id === 'system-monitor');

        if (isAdminBtn && !isAdmin) {
          mobileNavBtn.classList.add('hidden');
        } else {
          if (id === viewId) {
            mobileNavBtn.className = "flex-1 relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-2xl text-brand-600 dark:text-brand-400 bg-brand-500/10 dark:bg-brand-500/20 font-bold scale-105 transition-all";
          } else {
            mobileNavBtn.className = "flex-1 relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-brand-500 transition-all font-normal";
          }
        }
      }
    });

    // Reset active highlight on Bid button when changing views
    if (mobileNavBid) {
      mobileNavBid.className = "flex-1 relative flex flex-col items-center gap-0.5 py-1 px-1 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-brand-500 transition-all";
    }

    // Update Topbar View Title
    const titleEl = document.getElementById('dashboard-view-title');
    if (titleEl) {
      if (viewId === 'gallery') titleEl.innerText = 'Sistem Lelang Internal';
      else if (viewId === 'manage-assets') titleEl.innerText = 'Kelola Aset (Admin Mode)';
      else if (viewId === 'manage-users') titleEl.innerText = 'Kelola Pengguna (Admin Mode)';
      else if (viewId === 'system-monitor') titleEl.innerText = 'Status & Limit Sistem (Admin Mode)';
      else if (viewId === 'cart') titleEl.innerText = 'Histori Penawaran Anda';
    }

    // Run loader corresponding to active view
    if (viewId === 'gallery') {
      this.loadActiveAssets();
    } else if (viewId === 'manage-assets') {
      this.loadAdminAssetsTable();
    } else if (viewId === 'manage-users') {
      this.loadAdminUsersTable();
    } else if (viewId === 'system-monitor') {
      this.loadSystemMonitor();
    } else if (viewId === 'cart') {
      this.renderCart();
    }

    // Sidebar is responsive and static on desktop, no translation required.
  },

  /**
   * Disables button and replaces label during async API operations
   */
  showButtonLoading(buttonId, isLoading, loadingText = 'Memproses...') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (isLoading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>${loadingText}</span>
      `;
      btn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || loadingText;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
  },

  showGoogleLoading(show, text = 'Menghubungkan...') {
    const loadingOverlay = document.getElementById('google-signin-loading');
    const loadingText = document.getElementById('google-signin-loading-text');
    if (!loadingOverlay) return;

    if (show) {
      if (loadingText) loadingText.innerText = text;
      loadingOverlay.classList.remove('hidden');
    } else {
      loadingOverlay.classList.add('hidden');
    }
  },

  /**
   * Downloads assets data from backend and updates gallery
   */
  async loadActiveAssets(forceRefresh = false) {
    const galleryContainer = document.getElementById('assets-gallery');

    const cacheDuration = 15000; // 15 detik
    const isAssetsCacheFresh = this.rawAssets &&
      this.lastAssetsFetchTime &&
      (Date.now() - this.lastAssetsFetchTime < cacheDuration);

    const isBidsCacheFresh = this.cachedUserBids &&
      this.lastUserBidsFetchTime &&
      (Date.now() - this.lastUserBidsFetchTime < cacheDuration);

    const user = AuthService.getCurrentUser();

    if (!forceRefresh && isAssetsCacheFresh && (!user || isBidsCacheFresh)) {
      const activeAssets = this.rawAssets.filter(a => a.sisaWaktu !== 'CANCELLED' && a.sisaWaktu !== 'CANCEL');
      this.loadedAssets = activeAssets;
      const userBids = this.cachedUserBids || [];

      this.calculateDashboardStats(activeAssets, userBids);
      this.handleSearchFilter();
      this.renderAssetSelectOptions(activeAssets);
      this.updateCartBadge(userBids);
      this.renderCart(userBids);
      return;
    }

    // Tampilkan skeleton hanya jika belum ada data sama sekali di memori
    if (!this.rawAssets) {
      galleryContainer.innerHTML = Array(4).fill(0).map(() => this.getSkeletonCardHtml()).join('');
    }

    try {
      const response = await ApiService.getAssets();

      if (response && response.success === false) {
        if (this.rawAssets) {
          this.showToast('Gagal memuat data terbaru, menampilkan data tersimpan.', 'warning');
          return;
        }
        this.showToast(response.message || 'Gagal memuat daftar aset.', 'error');
        galleryContainer.innerHTML = `
          <div class="col-span-full py-12 text-center text-slate-400">
            <p class="mb-4">Gagal memuat data aset lelang.</p>
            <button id="btn-retry-assets" class="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition">Coba Lagi</button>
          </div>
        `;
        const retryBtn = document.getElementById('btn-retry-assets');
        if (retryBtn) retryBtn.addEventListener('click', () => this.loadActiveAssets(true));
        return;
      }

      this.rawAssets = response.data || [];
      this.lastAssetsFetchTime = Date.now();

      const activeAssets = this.rawAssets.filter(a => a.sisaWaktu !== 'CANCELLED' && a.sisaWaktu !== 'CANCEL');
      this.loadedAssets = activeAssets;

      let userBids = [];
      if (user) {
        const bidsResponse = await ApiService.getUserBids(user.email);
        if (bidsResponse && bidsResponse.success) {
          this.cachedUserBids = bidsResponse.data || [];
          this.lastUserBidsFetchTime = Date.now();
          userBids = this.cachedUserBids;
        }
      }

      if (!this.currentPage) this.currentPage = 1;
      this.assetsPerPage = 6;

      this.calculateDashboardStats(activeAssets, userBids);
      this.handleSearchFilter();
      this.renderAssetSelectOptions(activeAssets);
      this.updateCartBadge(userBids);
      this.renderCart(userBids);
      this.checkClosedAssetsNotifications(activeAssets, userBids);
    } catch (err) {
      console.error("Error loading active assets:", err);
      this.showToast('Terjadi kesalahan koneksi.', 'error');
    }
  },

  calculateDashboardStats(assets, userBids = []) {
    const user = AuthService.getCurrentUser();

    // Total Assets
    const totalAssets = assets.length;
    const totalAssetsEl = document.getElementById('stat-total-assets');
    if (totalAssetsEl) totalAssetsEl.innerText = totalAssets;

    let scheduledAssets = 0;
    let closedAssets = 0;
    let activeCount = 0;
    let activeBidded = 0;
    let activeUnbidded = 0;

    assets.forEach(a => {
      const timeInfo = this.formatRemainingTime(a.waktuMulai, a.waktuSelesai);
      if (timeInfo.status === 'SCHEDULED') {
        scheduledAssets++;
      } else if (timeInfo.status === 'CLOSED') {
        closedAssets++;
      } else if (timeInfo.status === 'ACTIVE') {
        activeCount++;
        const parsedBid = Number(a.bidTertinggi.replace(/[^0-9]/g, '')) || 0;
        if (parsedBid > 0) {
          activeBidded++;
        } else {
          activeUnbidded++;
        }
      }
    });

    const scheduledEl = document.getElementById('stat-total-scheduled');
    if (scheduledEl) scheduledEl.innerText = scheduledAssets;

    const closedEl = document.getElementById('stat-total-closed');
    if (closedEl) closedEl.innerText = closedAssets;

    // Active Auctions
    const activeEl = document.getElementById('stat-active-auctions');
    if (activeEl) activeEl.innerText = activeCount;

    const activeBiddedEl = document.getElementById('stat-active-bidded');
    if (activeBiddedEl) activeBiddedEl.innerText = activeBidded;

    const activeUnbiddedEl = document.getElementById('stat-active-unbidded');
    if (activeUnbiddedEl) activeUnbiddedEl.innerText = activeUnbidded;

    // Group bids by assetId to find user's highest bid for each unique asset
    const biddedAssetsMap = {};
    userBids.forEach(bid => {
      const assetId = bid.assetId;
      const nominalVal = Number(bid.nominal) || 0;
      if (!biddedAssetsMap[assetId] || nominalVal > biddedAssetsMap[assetId].nominal) {
        biddedAssetsMap[assetId] = {
          assetId: assetId,
          namaAset: bid.namaAset,
          nominal: nominalVal,
          status: bid.status,
          timestamp: bid.timestamp
        };
      }
    });

    const uniqueBidsList = Object.values(biddedAssetsMap);

    const totalBidsEl = document.getElementById('stat-user-total-bids');
    if (totalBidsEl) {
      totalBidsEl.innerText = `${uniqueBidsList.length} Aset`;
    }
  },

  /**
   * Renders active asset card collections (deferred scroll list)
   */
  renderAssets(assets) {
    const container = document.getElementById('assets-gallery');
    if (!container) return;

    this.currentFilteredAssets = assets;

    // Hide pagination container since pagination is disabled
    const pagContainer = document.getElementById('gallery-pagination');
    if (pagContainer) pagContainer.classList.add('hidden');

    if (this.galleryLayout === 'list') {
      container.className = "flex flex-col gap-4";
    } else {
      container.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2 gap-3 md:gap-6";
    }

    if (assets.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400">
          <svg class="mx-auto h-12 w-12 text-slate-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p class="text-lg font-semibold">Tidak ada Aset Lelang</p>
          <p class="text-xs">Saat ini tidak ada data aset aktif.</p>
        </div>
      `;
      return;
    }

    const currentUser = AuthService.getCurrentUser();
    const isAdmin = currentUser && String(currentUser.role).toUpperCase() === 'ADMIN';

    // Clear previous items
    container.innerHTML = '';

    // Deferred Chunked Rendering to avoid UI freeze / lag
    const chunkSize = 6;
    let index = 0;

    const renderChunk = () => {
      if (index >= assets.length) return;

      const chunk = assets.slice(index, index + chunkSize);
      const htmlString = chunk.map(asset => {
        const images = asset.gambarUrls || [];
        const primaryImage = images.length > 0 ? images[0] : IMAGE_LOAD_PLACEHOLDER;
        const hasMultipleImages = images.length > 1;

        const parsedHighest = Number(asset.bidTertinggi.replace(/[^0-9]/g, '')) || 0;
        const displayHighest = parsedHighest > 0 ? `Rp ${parsedHighest.toLocaleString('id-ID')}` : '-';

        const timeInfo = this.formatRemainingTime(asset.waktuMulai, asset.waktuSelesai);
        const isClosed = timeInfo.status === 'CLOSED';
        const isScheduled = timeInfo.status === 'SCHEDULED';
        const canBid = timeInfo.status === 'ACTIVE' && !isAdmin;

        let statusBadge = '';
        if (isClosed) {
          statusBadge = `<span class="bg-red-500/20 text-red-650 dark:text-red-400 text-xs px-2.5 py-1 rounded-full border border-red-500/30 flex items-center gap-1 font-semibold">● Selesai</span>`;
        } else if (isScheduled) {
          statusBadge = `<span class="bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-500/30 flex items-center gap-1 font-semibold">● Scheduled</span>`;
        } else {
          statusBadge = `<span class="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1 font-semibold animate-pulse">● Aktif</span>`;
        }

        let dotsHtml = '';
        if (hasMultipleImages) {
          dotsHtml = images.map((_, idx) => `
            <span class="dot-${asset.id} h-1.5 rounded-full transition-all duration-300 ${idx === 0 ? 'bg-brand-500 w-4' : 'bg-slate-400/50 w-1.5'}"></span>
          `).join('');
        }

        let cardActionsHtml = `
          <div class="space-y-1.5 sm:space-y-2">
            <div class="flex flex-col sm:flex-row gap-1 sm:gap-2">
              <button onclick="UiService.showAssetDetail('${asset.id}')" 
                      class="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-1 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs transition border border-slate-250 dark:border-slate-700">
                Detail
              </button>
              ${canBid ? `
                <button onclick="UiService.selectAssetForBid('${asset.id}')" 
                        class="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-bold py-1 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs transition shadow-md shadow-brand-500/10">
                  Bid
                </button>
              ` : `
                <button disabled 
                        class="flex-1 bg-slate-200 dark:bg-slate-850 text-slate-400 dark:text-slate-500 cursor-not-allowed py-1 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-xs transition border border-slate-300 dark:border-slate-700">
                  ${isAdmin ? 'Admin' : (isScheduled ? 'Belum Mulai' : 'Selesai')}
                </button>
              `}
            </div>
          </div>
        `;

        if (this.galleryLayout === 'list') {
          const truncatedDesc = asset.deskripsi && asset.deskripsi.length > 80
            ? asset.deskripsi.substring(0, 80) + '...'
            : (asset.deskripsi || 'Tidak ada deskripsi.');

          return `
            <div class="glass-card flex flex-row rounded-2xl overflow-hidden animate-fade-in bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-md p-2.5 sm:p-4 gap-2.5 sm:gap-4 items-center">
              <!-- Image Slider / Thumbnail -->
              <div id="img-container-${asset.id}" 
                   data-images="${images.join(',')}" 
                   data-current-index="0" 
                   class="relative w-20 h-20 sm:w-36 sm:h-28 overflow-hidden bg-slate-100 dark:bg-slate-950 rounded-xl group flex items-center justify-center flex-shrink-0">
                
                <!-- Image Loader Spinner -->
                <div id="img-loader-${asset.id}" class="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900 z-10">
                  <svg class="animate-spin h-4 w-4 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>

                <img id="img-${asset.id}" 
                     src="${primaryImage}" 
                     loading="lazy"
                     class="w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-105"
                     onload="const loader = document.getElementById('img-loader-${asset.id}'); if(loader) loader.classList.add('hidden'); this.classList.remove('opacity-0');"
                     onerror="this.src=IMAGE_LOAD_PLACEHOLDER; const loader = document.getElementById('img-loader-${asset.id}'); if(loader) loader.classList.add('hidden'); this.classList.remove('opacity-0');">
                
                <!-- Category Badge -->
                <div class="absolute top-1 left-1 sm:top-2 sm:left-2 bg-white/90 dark:bg-slate-950/80 backdrop-blur text-slate-850 dark:text-slate-200 text-[6px] sm:text-[8px] px-1 sm:px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-semibold shadow-sm">
                  ${asset.kategori}
                </div>

                <!-- Carousel index indicator -->
                ${hasMultipleImages ? `
                  <div class="absolute top-1 right-1 sm:top-2 sm:right-2 bg-white/90 dark:bg-slate-950/80 backdrop-blur text-slate-850 dark:text-slate-200 text-[6px] sm:text-[8px] px-1 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-semibold shadow-sm">
                    <span id="counter-${asset.id}">1</span> / ${images.length}
                  </div>
                ` : ''}

                <!-- Slider buttons - Hidden on mobile -->
                ${hasMultipleImages ? `
                  <button onclick="UiService.prevImage(event, '${asset.id}')" 
                          class="hidden sm:block absolute left-1 top-1/2 -translate-y-1/2 bg-white/95 dark:bg-slate-950/85 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-800 dark:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200 border border-slate-200 dark:border-slate-800 shadow">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button onclick="UiService.nextImage(event, '${asset.id}')" 
                          class="hidden sm:block absolute right-1 top-1/2 -translate-y-1/2 bg-white/95 dark:bg-slate-950/85 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-800 dark:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200 border border-slate-200 dark:border-slate-800 shadow">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ` : ''}
              </div>

              <!-- Details Block -->
              <div class="flex-grow text-left space-y-0.5 sm:space-y-1.5 min-w-0">
                <div class="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  ${statusBadge}
                  <div class="flex items-center gap-0.5 sm:gap-1 text-slate-500 dark:text-slate-400 text-[8px] sm:text-[10px]">
                    <svg class="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="font-semibold">${isClosed ? 'Lelang Selesai' : (isScheduled ? 'Belum Mulai' : timeInfo.timeLabel)}</span>
                  </div>
                </div>

                <h3 class="text-[11px] sm:text-sm font-bold text-slate-850 dark:text-slate-100 line-clamp-1" title="${asset.nama}">${asset.nama}</h3>
                <p class="text-[9px] sm:text-[11px] text-slate-550 dark:text-slate-400 leading-normal sm:leading-relaxed line-clamp-2">${truncatedDesc}</p>
              </div>

              <!-- Price & Actions Block -->
              <div class="flex flex-col items-end justify-between w-24 sm:w-48 flex-shrink-0 gap-1.5 sm:gap-3 border-l border-slate-150 dark:border-slate-800/80 pl-2 sm:pl-4 self-stretch">
                <div class="text-right space-y-0.5 w-full">
                  <div class="flex justify-between sm:justify-end gap-1 sm:gap-3 text-[8px] sm:text-[10px]">
                    <span class="text-slate-400 font-medium">Buka:</span>
                    <span class="font-semibold text-slate-650 dark:text-slate-350">${asset.hargaBuka}</span>
                  </div>
                  <div class="flex justify-between sm:justify-end gap-1 sm:gap-3 text-[9px] sm:text-xs">
                    <span class="text-slate-400 font-bold">Bid:</span>
                    <span class="font-extrabold text-brand-500 dark:text-brand-400">${displayHighest}</span>
                  </div>
                </div>

                <div class="w-full">
                  ${cardActionsHtml}
                </div>
              </div>
            </div>
          `;
        } else {
          const truncatedDesc = asset.deskripsi && asset.deskripsi.length > 50
            ? asset.deskripsi.substring(0, 50) + '...'
            : (asset.deskripsi || 'Tidak ada deskripsi.');

          return `
            <div class="glass-card flex flex-col rounded-2xl overflow-hidden animate-fade-in-up bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-md">
              <!-- Image Slider -->
              <div id="img-container-${asset.id}" 
                   data-images="${images.join(',')}" 
                   data-current-index="0" 
                   class="relative h-32 sm:h-56 overflow-hidden bg-slate-100 dark:bg-slate-950 group flex items-center justify-center">
                
                <!-- Image Loader Spinner -->
                <div id="img-loader-${asset.id}" class="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900 z-10">
                  <svg class="animate-spin h-5 w-5 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>

                <img id="img-${asset.id}" 
                     src="${primaryImage}" 
                     loading="lazy"
                     class="w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-105"
                     onload="const loader = document.getElementById('img-loader-${asset.id}'); if(loader) loader.classList.add('hidden'); this.classList.remove('opacity-0');"
                     onerror="this.src=IMAGE_LOAD_PLACEHOLDER; const loader = document.getElementById('img-loader-${asset.id}'); if(loader) loader.classList.add('hidden'); this.classList.remove('opacity-0');">
                
                <!-- Category Badge -->
                <div class="absolute top-2 left-2 bg-white/90 dark:bg-slate-950/85 backdrop-blur text-slate-850 dark:text-slate-200 text-[8px] sm:text-xs px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-semibold shadow-sm">
                  ${asset.kategori}
                </div>

                <!-- Carousel index indicator -->
                ${hasMultipleImages ? `
                  <div class="absolute top-2 right-2 bg-white/90 dark:bg-slate-950/85 backdrop-blur text-slate-850 dark:text-slate-200 text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-semibold shadow-sm">
                    <span id="counter-${asset.id}">1</span> / ${images.length}
                  </div>
                ` : ''}

                <!-- Slider buttons -->
                ${hasMultipleImages ? `
                  <button onclick="UiService.prevImage(event, '${asset.id}')" 
                          class="absolute left-1.5 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-950/70 hover:bg-slate-100 dark:hover:bg-slate-950 hover:scale-105 text-slate-850 dark:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all duration-200 border border-slate-200 dark:border-slate-800 shadow">
                    <svg class="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button onclick="UiService.nextImage(event, '${asset.id}')" 
                          class="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-slate-950/70 hover:bg-slate-100 dark:hover:bg-slate-950 hover:scale-105 text-slate-850 dark:text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 border border-slate-200 dark:border-slate-800 shadow">
                    <svg class="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1 bg-white/60 dark:bg-slate-950/40 p-1 rounded-full backdrop-blur shadow-sm">
                    ${dotsHtml}
                  </div>
                ` : ''}
              </div>

              <!-- Info Details -->
              <div class="p-3 sm:p-5 flex-grow flex flex-col justify-between space-y-3 sm:space-y-4">
                <div>
                  <div class="flex items-center justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                    ${statusBadge}
                    <div class="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[9px] sm:text-xs">
                      <svg class="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="font-semibold">${isClosed ? 'Selesai' : (isScheduled ? 'Mulai' : timeInfo.timeLabel)}</span>
                    </div>
                  </div>

                  <h3 class="text-xs sm:text-base font-bold text-slate-850 dark:text-slate-100 line-clamp-1 mb-0.5 sm:mb-1" title="${asset.nama}">${asset.nama}</h3>
                  <p class="text-[10px] sm:text-xs text-slate-550 dark:text-slate-400 leading-normal sm:leading-relaxed line-clamp-2">${truncatedDesc}</p>
                </div>

                <!-- Price Block -->
                <div class="border-t border-slate-150 dark:border-slate-850 pt-2.5 sm:pt-4 mt-auto">
                  <div class="grid grid-cols-2 gap-2 sm:gap-4 mb-2.5 sm:mb-4">
                    <div>
                      <span class="block text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-slate-400">Buka</span>
                      <span class="text-[10px] sm:text-xs font-semibold text-slate-650 dark:text-slate-350">${asset.hargaBuka}</span>
                    </div>
                    <div>
                      <span class="block text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-slate-400">Bid</span>
                      <span class="text-[10px] sm:text-xs font-bold text-brand-500 dark:text-brand-400">${displayHighest}</span>
                    </div>
                  </div>

                  ${cardActionsHtml}
                </div>
              </div>
            </div>
          `;
        }
      }).join('');

      container.insertAdjacentHTML('beforeend', htmlString);
      index += chunkSize;

      if (index < assets.length) {
        setTimeout(renderNextChunk, 40);
      }
    };

    const renderNextChunk = renderChunk;
    renderNextChunk();
  },

  toggleLayout(layout) {
    this.galleryLayout = layout;

    const cardBtn = document.getElementById('btn-layout-card');
    const listBtn = document.getElementById('btn-layout-list');

    if (cardBtn && listBtn) {
      if (layout === 'card') {
        cardBtn.className = "p-2 rounded-lg transition-all text-brand-650 dark:text-brand-400 bg-white dark:bg-slate-900 shadow-sm";
        listBtn.className = "p-2 rounded-lg transition-all text-slate-400 hover:text-slate-650 dark:hover:text-slate-200";
      } else {
        listBtn.className = "p-2 rounded-lg transition-all text-brand-650 dark:text-brand-400 bg-white dark:bg-slate-900 shadow-sm";
        cardBtn.className = "p-2 rounded-lg transition-all text-slate-400 hover:text-slate-650 dark:hover:text-slate-200";
      }
    }

    this.handleSearchFilter();
  },

  handleSearchFilter() {
    const searchName = (document.getElementById('search-asset-name')?.value || '').toLowerCase().trim();
    const minPriceRaw = document.getElementById('search-asset-min-price')?.value || '';
    const minPriceVal = Number(minPriceRaw.replace(/[^0-9]/g, '')) || 0;
    const maxPriceRaw = document.getElementById('search-asset-max-price')?.value || '';
    const maxPriceVal = Number(maxPriceRaw.replace(/[^0-9]/g, '')) || Infinity;
    const category = document.getElementById('search-asset-category')?.value || '';

    const filtered = (this.loadedAssets || []).filter(asset => {
      const nameMatch = !searchName || asset.nama.toLowerCase().includes(searchName);
      const categoryMatch = !category || asset.kategori === category;

      const startingPriceVal = Number(asset.hargaBuka.replace(/[^0-9]/g, '')) || 0;
      const priceMatch = startingPriceVal >= minPriceVal && startingPriceVal <= maxPriceVal;

      return nameMatch && categoryMatch && priceMatch;
    });

    // Apply Sorting
    const sortBy = document.getElementById('sort-assets-select')?.value || 'sisaWaktuAsc';
    filtered.sort((a, b) => {
      if (sortBy === 'sisaWaktuAsc' || sortBy === 'sisaWaktuDesc') {
        const getRemainingTime = (asset) => {
          if (asset.sisaWaktu === 'CLOSED') return 0;
          if (asset.sisaWaktu === 'CANCELLED' || asset.sisaWaktu === '') return -1;
          return Number(asset.sisaWaktu) || 0;
        };

        const tA = getRemainingTime(a);
        const tB = getRemainingTime(b);

        if (sortBy === 'sisaWaktuAsc') {
          // Closed/Cancelled assets last. Active assets first, sorted by nearest deadline.
          if (tA <= 0 && tB > 0) return 1;
          if (tB <= 0 && tA > 0) return -1;
          return tA - tB;
        } else {
          // Closed/Cancelled assets last. Active assets first, sorted by furthest deadline.
          if (tA <= 0 && tB > 0) return 1;
          if (tB <= 0 && tA > 0) return -1;
          return tB - tA;
        }
      }

      if (sortBy === 'hargaBukaAsc' || sortBy === 'hargaBukaDesc') {
        const priceA = Number(a.hargaBuka.replace(/[^0-9]/g, '')) || 0;
        const priceB = Number(b.hargaBuka.replace(/[^0-9]/g, '')) || 0;
        return sortBy === 'hargaBukaAsc' ? priceA - priceB : priceB - priceA;
      }

      if (sortBy === 'highestBidDesc') {
        const bidA = Number(a.bidTertinggi.replace(/[^0-9]/g, '')) || 0;
        const bidB = Number(b.bidTertinggi.replace(/[^0-9]/g, '')) || 0;
        return bidB - bidA;
      }

      return 0;
    });

    this.currentPage = 1; // Reset to page 1 on filter/search change
    this.renderAssets(filtered);
  },

  handleSortAssets() {
    this.handleSearchFilter();
  },

  /**
   * Action trigger for Admin to cancel the highest bid
   */
  async handleCancelBid(assetId, assetName) {
    const confirmCancel = confirm(`Apakah Anda yakin ingin membatalkan penawaran tertinggi untuk aset "${assetName}"?`);
    if (!confirmCancel) return;

    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    this.showToast('Memproses pembatalan...', 'info');
    const result = await ApiService.cancelBid(assetId, admin.email);

    if (result.success) {
      this.showToast(result.message || 'Penawaran tertinggi berhasil dibatalkan!', 'success');
      this.loadActiveAssets(true);
      this.loadAdminAssetsTable(true);
    } else {
      this.showToast(result.message || 'Gagal membatalkan penawaran.', 'error');
    }
  },

  prevImage(event, assetId) {
    if (event) event.stopPropagation();
    const container = document.getElementById(`img-container-${assetId}`);
    const img = document.getElementById(`img-${assetId}`);
    const counter = document.getElementById(`counter-${assetId}`);
    const images = container.dataset.images.split(',');

    let idx = parseInt(container.dataset.currentIndex);
    idx = (idx - 1 + images.length) % images.length;

    container.dataset.currentIndex = idx;

    const loader = document.getElementById(`img-loader-${assetId}`);
    if (loader) loader.classList.remove('hidden');
    img.classList.add('opacity-0');

    img.src = images[idx];
    if (counter) counter.innerText = idx + 1;
    this.updateCarouselDots(assetId, idx);
  },

  nextImage(event, assetId) {
    if (event) event.stopPropagation();
    const container = document.getElementById(`img-container-${assetId}`);
    const img = document.getElementById(`img-${assetId}`);
    const counter = document.getElementById(`counter-${assetId}`);
    const images = container.dataset.images.split(',');

    let idx = parseInt(container.dataset.currentIndex);
    idx = (idx + 1) % images.length;

    container.dataset.currentIndex = idx;

    const loader = document.getElementById(`img-loader-${assetId}`);
    if (loader) loader.classList.remove('hidden');
    img.classList.add('opacity-0');

    img.src = images[idx];
    if (counter) counter.innerText = idx + 1;
    this.updateCarouselDots(assetId, idx);
  },

  updateCarouselDots(assetId, activeIdx) {
    const dots = document.querySelectorAll(`.dot-${assetId}`);
    dots.forEach((dot, idx) => {
      if (idx === activeIdx) {
        dot.classList.add('bg-brand-500', 'w-4');
        dot.classList.remove('bg-slate-400/50', 'w-1.5');
      } else {
        dot.classList.remove('bg-brand-500', 'w-4');
        dot.classList.add('bg-slate-400/50', 'w-1.5');
      }
    });
  },

  /**
   * Detailed Modal View Handlers
   */
  formatDescription(text) {
    if (!text) return 'Tidak ada deskripsi.';

    const lines = String(text).split('\n');
    let html = '';
    let inList = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
        if (!inList) {
          html += '<ul class="list-disc pl-5 space-y-1 my-2 text-slate-650 dark:text-slate-350 select-text">';
          inList = true;
        }
        const itemContent = trimmed.substring(1).trim();
        html += `<li>${itemContent}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (trimmed) {
          html += `<p class="mb-2 text-slate-655 dark:text-slate-350 select-text">${trimmed}</p>`;
        }
      }
    });

    if (inList) {
      html += '</ul>';
    }

    return html;
  },

  showAssetDetail(assetId) {
    const currentUser = AuthService.getCurrentUser();
    const isAdmin = currentUser && String(currentUser.role).toUpperCase() === 'ADMIN';

    const asset = (this.rawAssets || []).find(a => a.id === assetId) || (this.loadedAssets || []).find(a => a.id === assetId);
    if (!asset) return;

    this.currentDetailAssetId = asset.id;
    this.currentDetailImages = asset.gambarUrls || [];
    if (this.currentDetailImages.length === 0) {
      this.currentDetailImages = [IMAGE_LOAD_PLACEHOLDER];
    }
    this.currentDetailIdx = 0;

    // Populates Modal fields
    document.getElementById('detail-asset-name').innerText = asset.nama;
    document.getElementById('detail-asset-category').innerText = asset.kategori;
    document.getElementById('detail-asset-starting-price').innerText = asset.hargaBuka;
    document.getElementById('detail-asset-kelipatan').innerText = asset.kelipatanBid || 'Bebas';

    const parsedHighest = Number(String(asset.bidTertinggi).replace(/[^0-9]/g, '')) || 0;
    document.getElementById('detail-asset-highest-bid').innerText = parsedHighest > 0 ? asset.bidTertinggi : '-';

    // Formatted Description HTML output (with bullets and paragraphs support)
    document.getElementById('detail-asset-desc').innerHTML = this.formatDescription(asset.deskripsi);

    // Prefill mailto template for asking details
    const mailtoBtn = document.getElementById('btn-ask-detail');
    if (mailtoBtn) {
      const adminEmail = 'biddingz@bms.jiipe.co.id';
      const subject = encodeURIComponent(`Tanya Detail Aset: ${asset.nama}`);
      const body = encodeURIComponent(`Halo Admin,\n\nSaya ingin bertanya lebih lanjut mengenai aset lelang berikut:\n- Nama Aset: ${asset.nama}\n- Kategori: ${asset.kategori}\n- ID Aset: ${asset.id}\n- Harga Buka: ${asset.hargaBuka}\n\nPertanyaan saya:\n[Tuliskan pertanyaan Anda di sini]\n\nTerima kasih.`);
      mailtoBtn.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
    }

    const timeInfo = this.formatRemainingTime(asset.waktuMulai, asset.waktuSelesai);
    const isClosed = timeInfo.status === 'CLOSED';
    const isScheduled = timeInfo.status === 'SCHEDULED';

    const timeEl = document.getElementById('detail-asset-time');
    const timeHeaderEl = document.getElementById('detail-time-header');
    const absoluteTimeEl = document.getElementById('detail-absolute-time');
    const actionBtn = document.getElementById('btn-detail-action');

    if (absoluteTimeEl) {
      absoluteTimeEl.innerText = timeInfo.detailText;
    }

    if (timeHeaderEl) {
      if (isScheduled) timeHeaderEl.innerText = 'Mulai Lelang';
      else if (isClosed) timeHeaderEl.innerText = 'Lelang Selesai';
      else timeHeaderEl.innerText = 'Sisa Waktu';
    }

    if (isClosed) {
      timeEl.innerHTML = '<span class="text-red-500 dark:text-red-400 font-bold">Lelang Selesai</span>';
      if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.innerText = 'Lelang Selesai';
        actionBtn.className = 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed px-6 py-2.5 rounded-xl text-xs font-bold transition';
      }
    } else if (isScheduled) {
      timeEl.innerHTML = `<span class="text-blue-500 dark:text-blue-400 font-bold">${timeInfo.timeLabel}</span>`;
      if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.innerText = 'Belum Mulai';
        actionBtn.className = 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed px-6 py-2.5 rounded-xl text-xs font-bold transition';
      }
    } else {
      timeEl.innerText = timeInfo.timeLabel;
      if (actionBtn) {
        if (isAdmin) {
          actionBtn.disabled = true;
          actionBtn.innerText = 'Admin';
          actionBtn.className = 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed px-6 py-2.5 rounded-xl text-xs font-bold transition';
        } else {
          actionBtn.disabled = false;
          actionBtn.innerText = 'Ikut Lelang';
          actionBtn.className = 'bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-brand-500/10';
        }
      }
    }

    // Render detailed carousel
    this.renderDetailCarousel();

    // Admin section in modal update
    const adminSection = document.getElementById('detail-admin-section');
    if (adminSection) {
      if (isAdmin && parsedHighest > 0) {
        adminSection.classList.remove('hidden');

        const winnerNameEl = document.getElementById('detail-admin-winner-name');
        const winnerDeptEl = document.getElementById('detail-admin-winner-dept');
        const winnerWaEl = document.getElementById('detail-admin-winner-wa');
        const waBtn = document.getElementById('detail-admin-btn-wa');
        const cancelBtn = document.getElementById('detail-admin-btn-cancel');

        if (winnerNameEl) winnerNameEl.innerText = asset.namaPemenang || '-';
        if (winnerDeptEl) winnerDeptEl.innerText = asset.nip_bms || '-';
        if (winnerWaEl) winnerWaEl.innerText = asset.noWa || '-';

        const cleanWa = asset.noWa ? String(asset.noWa).replace(/[^0-9]/g, '') : '';
        if (waBtn) {
          if (cleanWa && !isClosed) {
            waBtn.href = `https://wa.me/${cleanWa}`;
            waBtn.classList.remove('hidden');
          } else {
            waBtn.classList.add('hidden');
          }
        }

        if (cancelBtn) {
          if (!isClosed) {
            cancelBtn.classList.remove('hidden');
            cancelBtn.onclick = (e) => {
              e.preventDefault();
              this.hideAssetDetailModal();
              this.handleCancelBid(asset.id, asset.nama);
            };
          } else {
            cancelBtn.classList.add('hidden');
          }
        }
      } else {
        adminSection.classList.add('hidden');
      }
    }

    document.getElementById('asset-detail-modal').classList.remove('hidden');
  },

  hideAssetDetailModal() {
    document.getElementById('asset-detail-modal').classList.add('hidden');
  },

  renderDetailCarousel() {
    const imgEl = document.getElementById('detail-carousel-img');
    const dotsContainer = document.getElementById('detail-carousel-dots');
    if (!imgEl || !dotsContainer) return;

    const loader = document.getElementById('detail-carousel-loader');
    if (loader) loader.classList.remove('hidden');
    imgEl.classList.add('opacity-0');

    imgEl.src = this.currentDetailImages[this.currentDetailIdx];

    if (this.currentDetailImages.length <= 1) {
      dotsContainer.innerHTML = '';
      return;
    }

    dotsContainer.innerHTML = this.currentDetailImages.map((_, idx) => `
      <span class="h-2 rounded-full transition-all duration-300 ${idx === this.currentDetailIdx ? 'bg-brand-500 w-5' : 'bg-slate-400/50 w-2'}"></span>
    `).join('');
  },

  prevDetailImage() {
    if (this.currentDetailImages.length <= 1) return;
    this.currentDetailIdx = (this.currentDetailIdx - 1 + this.currentDetailImages.length) % this.currentDetailImages.length;
    this.renderDetailCarousel();
  },

  nextDetailImage() {
    if (this.currentDetailImages.length <= 1) return;
    this.currentDetailIdx = (this.currentDetailIdx + 1) % this.currentDetailImages.length;
    this.renderDetailCarousel();
  },

  bidFromDetail() {
    this.hideAssetDetailModal();
    if (this.currentDetailAssetId) {
      this.selectAssetForBid(this.currentDetailAssetId);
    }
  },

  // State for raw files
  rawAssetFiles: [],
  rawEditAssetFiles: [],

  // State for Camera functionality
  cameraStream: null,
  cameraTarget: null, // 'new' or 'edit'
  cameraFacingMode: 'environment', // 'environment' (back) or 'user' (front),

  /**
   * Native Canvas-based Image Compression (used at submit time)
   */
  processImageToPureBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const MAX_WIDTH = 1024;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.floor(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Return pure base64
          resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  /**
   * Native Canvas-based Image Compression
   */
  processImageNative(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const MAX_WIDTH = 1024;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.floor(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Client-side Image selection
   */
  handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!this.rawAssetFiles) {
      this.rawAssetFiles = [];
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      this.rawAssetFiles.push(file);
    }

    this.renderUploadPreviews();
    event.target.value = ''; // Reset input file
    this.updateAssetPreview();
  },
  renderUploadPreviews() {
    const previewEl = document.getElementById('image-thumbnails-preview');
    if (!previewEl) return;
    previewEl.innerHTML = '';

    if (!this.rawAssetFiles) this.rawAssetFiles = [];

    this.rawAssetFiles.forEach((file, idx) => {
      const url = URL.createObjectURL(file);
      const thumbDiv = document.createElement('div');
      thumbDiv.className = 'relative w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex items-center justify-center bg-slate-100 dark:bg-slate-950';
      thumbDiv.innerHTML = `
        <img src="${url}" class="w-full h-full object-cover">
        <button type="button" onclick="UiService.removeUploadImage(${idx})" 
                class="absolute -top-1 -right-1 bg-red-500 hover:bg-red-660 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow-md">
          ×
        </button>
      `;
      previewEl.appendChild(thumbDiv);
    });
  },

  removeUploadImage(index) {
    this.rawAssetFiles.splice(index, 1);
    this.renderUploadPreviews();
    this.updateAssetPreview();
  },

  handleEditImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!this.rawEditAssetFiles) {
      this.rawEditAssetFiles = [];
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      this.rawEditAssetFiles.push(file);
    }

    this.renderEditUploadPreviews();
    event.target.value = '';
  },

  renderEditUploadPreviews() {
    const previewEl = document.getElementById('edit-image-thumbnails-preview');
    if (!previewEl) return;
    previewEl.innerHTML = '';

    if (!this.rawEditAssetFiles) this.rawEditAssetFiles = [];

    this.rawEditAssetFiles.forEach((file, idx) => {
      const url = URL.createObjectURL(file);
      const thumbDiv = document.createElement('div');
      thumbDiv.className = 'relative w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex items-center justify-center bg-slate-100 dark:bg-slate-950';
      thumbDiv.innerHTML = `
        <img src="${url}" class="w-full h-full object-cover">
        <button type="button" onclick="UiService.removeEditUploadImage(${idx})" 
                class="absolute -top-1 -right-1 bg-red-500 hover:bg-red-660 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shadow-md">
          ×
        </button>
      `;
      previewEl.appendChild(thumbDiv);
    });
  },

  removeEditUploadImage(index) {
    this.rawEditAssetFiles.splice(index, 1);
    this.renderEditUploadPreviews();
  },

  /**
   * Camera direct capture functionality
   */
  async openCamera(target) {
    this.cameraTarget = target;
    const modal = document.getElementById('camera-modal');
    const loading = document.getElementById('camera-loading');
    const video = document.getElementById('camera-stream');

    if (!modal || !loading || !video) return;

    // Show modal and loading spinner
    modal.classList.remove('hidden');
    loading.classList.remove('hidden');

    // Clean up any existing stream
    if (this.cameraStream) {
      this.closeCamera();
    }

    try {
      // Set mirror view if using user-facing camera
      if (this.cameraFacingMode === 'user') {
        video.style.transform = 'scaleX(-1)';
      } else {
        video.style.transform = 'scaleX(1)';
      }

      const constraints = {
        video: {
          facingMode: this.cameraFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cameraStream = stream;
      video.srcObject = stream;

      // Hide loading spinner when video is ready to play
      video.onloadedmetadata = () => {
        loading.classList.add('hidden');
      };
    } catch (err) {
      console.error('Gagal mengakses kamera:', err);
      alert('Gagal mengakses kamera. Pastikan Anda memberikan izin akses kamera dan menggunakan koneksi HTTPS/localhost.');
      this.closeCamera();
    }
  },

  closeCamera() {
    const modal = document.getElementById('camera-modal');
    const video = document.getElementById('camera-stream');

    if (modal) {
      modal.classList.add('hidden');
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }

    if (video) {
      video.srcObject = null;
    }
  },

  async switchCamera() {
    this.cameraFacingMode = this.cameraFacingMode === 'environment' ? 'user' : 'environment';

    // Temporarily show loading state during switch
    const loading = document.getElementById('camera-loading');
    if (loading) {
      loading.classList.remove('hidden');
    }

    // Stop current stream first
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }

    const video = document.getElementById('camera-stream');
    if (video) {
      video.srcObject = null;
      if (this.cameraFacingMode === 'user') {
        video.style.transform = 'scaleX(-1)';
      } else {
        video.style.transform = 'scaleX(1)';
      }
    }

    // Reopen with new facing mode constraints
    try {
      const constraints = {
        video: {
          facingMode: this.cameraFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cameraStream = stream;
      if (video) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          if (loading) loading.classList.add('hidden');
        };
      }
    } catch (err) {
      console.error('Gagal mengganti kamera:', err);
      alert('Gagal beralih ke kamera pilihan.');
      if (loading) loading.classList.add('hidden');
    }
  },

  capturePhoto() {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    if (!video || !canvas) return;

    // Set canvas dimensions to match video stream exactly
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle horizontal mirror drawing if cameraFacingMode is 'user'
    if (this.cameraFacingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Reset transform matrix to default just in case
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Convert canvas image to Blob
    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Gagal mengambil gambar dari kamera.');
        return;
      }

      // Generate random unique filename
      const filename = `kamera-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (this.cameraTarget === 'new') {
        if (!this.rawAssetFiles) this.rawAssetFiles = [];
        this.rawAssetFiles.push(file);
        this.renderUploadPreviews();
        this.updateAssetPreview();
      } else if (this.cameraTarget === 'edit') {
        if (!this.rawEditAssetFiles) this.rawEditAssetFiles = [];
        this.rawEditAssetFiles.push(file);
        this.renderEditUploadPreviews();
      }

      // Stop camera stream and close modal
      this.closeCamera();
    }, 'image/jpeg', 0.85);
  },

  /**
   * Populates Bidding Select Option dropdown
   */
  renderAssetSelectOptions(assets) {
    const select = document.getElementById('bid-asset-select');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Pilih Aset Lelang --</option>';

    const openAssets = assets.filter(a => a.sisaWaktu !== 'CLOSED' && a.sisaWaktu !== '');

    openAssets.forEach(asset => {
      const option = document.createElement('option');
      option.value = asset.id;
      option.textContent = `${asset.nama} (${asset.kategori})`;
      select.appendChild(option);
    });

    if (currentValue && openAssets.some(a => a.id === currentValue)) {
      select.value = currentValue;
    }

    this.updateBidHelperLabel();

    // Custom searchable select population
    this.openAssetsForSelect = openAssets;
    this.renderCustomSelectOptions(openAssets);
  },

  renderCustomSelectOptions(options) {
    const listContainer = document.getElementById('bid-asset-options-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (options.length === 0) {
      listContainer.innerHTML = '<div class="p-3 text-center text-xs text-slate-400">Tidak ada aset cocok</div>';
      return;
    }

    options.forEach(asset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-full text-left px-3 py-2.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-700 dark:text-slate-350 block border-b border-slate-100 dark:border-slate-850/60 last:border-0';
      btn.innerHTML = `<span class="font-semibold block text-slate-800 dark:text-slate-200">${asset.nama}</span><span class="text-[10px] text-slate-400 dark:text-slate-500">${asset.kategori}</span>`;
      btn.onclick = () => {
        this.selectCustomAssetOption(asset.id, asset.nama);
      };
      listContainer.appendChild(btn);
    });
  },

  selectCustomAssetOption(id, name) {
    const hiddenSelect = document.getElementById('bid-asset-select');
    const input = document.getElementById('bid-asset-search-input');
    const panel = document.getElementById('bid-asset-dropdown-panel');

    if (hiddenSelect) {
      hiddenSelect.value = id;
      hiddenSelect.dispatchEvent(new Event('change'));
    }

    if (input) {
      input.value = name;
    }

    if (panel) {
      panel.classList.add('hidden');
    }
  },

  selectAssetForBid(assetId) {
    const select = document.getElementById('bid-asset-select');
    if (!select) return;

    select.value = assetId;
    this.updateBidHelperLabel();

    // Sync searchable text box display value
    const targetAsset = this.openAssetsForSelect ? this.openAssetsForSelect.find(a => a.id === assetId) : null;
    const input = document.getElementById('bid-asset-search-input');
    if (input) {
      input.value = targetAsset ? targetAsset.nama : '';
    }

    if (window.innerWidth < 1024) {
      this.openMobileBidModal();
      setTimeout(() => {
        document.getElementById('bid-amount').focus();
      }, 300);
    } else {
      const bidFormSection = document.getElementById('bidding-panel-section');
      if (bidFormSection) {
        bidFormSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          document.getElementById('bid-amount').focus();
        }, 500);
      }
    }
  },

  openMobileBidModal() {
    const panel = document.getElementById('bidding-panel-section');
    if (panel) {
      const galleryView = document.getElementById('view-gallery');
      if (galleryView) {
        galleryView.classList.remove('hidden');
        galleryView.classList.add('z-[60]');
      }
      panel.classList.add('active');
      const card = panel.querySelector('div');
      if (card) {
        card.classList.remove('animate-fade-in-up');
        card.classList.add('animate-fade-in');
      }

      // Add active background highlight to mobile Bid button
      const mobileNavBid = document.getElementById('mobile-nav-bid');
      if (mobileNavBid) {
        mobileNavBid.className = "flex-1 relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-2xl text-brand-600 dark:text-brand-400 bg-brand-500/10 dark:bg-brand-500/20 font-bold scale-105 transition-all";
      }

      // Reset style for other tabs while Bid modal is open (preserving hidden states)
      const views = ['gallery', 'manage-assets', 'manage-users', 'cart'];
      views.forEach(id => {
        const btn = document.getElementById(`mobile-nav-${id}`);
        if (btn) {
          const isBtnHidden = btn.classList.contains('hidden');
          btn.className = "flex-1 relative flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-brand-500 transition-all font-normal" + (isBtnHidden ? " hidden" : "");
        }
      });
    }
  },

  closeMobileBidModal() {
    const panel = document.getElementById('bidding-panel-section');
    if (panel) {
      panel.classList.remove('active');

      const galleryView = document.getElementById('view-gallery');
      if (galleryView) {
        galleryView.classList.remove('z-[60]');
      }

      // Restore highlighting to the active dashboard view
      const activeView = document.querySelector('#view-manage-assets').classList.contains('hidden') ?
        (document.querySelector('#view-manage-users').classList.contains('hidden') ?
          (document.querySelector('#view-cart').classList.contains('hidden') ? 'gallery' : 'cart')
          : 'manage-users')
        : 'manage-assets';
      this.switchDashboardView(activeView);
    }
  },

  updateBidHelperLabel() {
    const select = document.getElementById('bid-asset-select');
    const labelContainer = document.getElementById('bid-limit-info');
    const bidInput = document.getElementById('bid-amount');

    if (!select || !labelContainer) return;

    const assetId = select.value;
    if (!assetId) {
      labelContainer.classList.add('hidden');
      if (bidInput) bidInput.placeholder = 'Contoh: 1500000';
      return;
    }

    const asset = this.loadedAssets.find(a => a.id === assetId);
    if (!asset) {
      labelContainer.classList.add('hidden');
      return;
    }

    const parsedHighest = Number(asset.bidTertinggi.replace(/[^0-9]/g, '')) || 0;
    const parsedStarting = Number(asset.hargaBuka.replace(/[^0-9]/g, '')) || 0;
    const kelipatan = Number(asset.kelipatanBidRaw) || 0;

    const isFirstBid = parsedHighest === 0;
    const currentPrice = isFirstBid ? parsedStarting : parsedHighest;

    let minRequiredBid;
    if (isFirstBid) {
      minRequiredBid = parsedStarting;
    } else {
      minRequiredBid = currentPrice + (kelipatan > 0 ? kelipatan : 1);
    }

    labelContainer.classList.remove('hidden');

    document.getElementById('info-starting-price').innerText = asset.hargaBuka;
    document.getElementById('info-highest-bid').innerText = isFirstBid ? '-' : asset.bidTertinggi;

    const infoKelipatanEl = document.getElementById('info-kelipatan');
    if (infoKelipatanEl) {
      infoKelipatanEl.innerText = asset.kelipatanBid || 'Bebas';
    }

    const minBidEl = document.getElementById('info-min-required');
    if (minBidEl) {
      minBidEl.innerText = `Rp ${minRequiredBid.toLocaleString('id-ID')}`;
    }

    if (bidInput) {
      if (kelipatan > 0) {
        bidInput.placeholder = `Minimal Rp ${minRequiredBid.toLocaleString('id-ID')} (Kelipatan Rp ${kelipatan.toLocaleString('id-ID')})`;
      } else {
        bidInput.placeholder = `Minimal Rp ${minRequiredBid.toLocaleString('id-ID')}`;
      }
    }
  },

  toggleKelipatanInput(prefix) {
    const typeSelect = document.getElementById(`${prefix}-asset-kelipatan-type`);
    const valInput = document.getElementById(`${prefix}-asset-kelipatan-val`);
    if (!typeSelect || !valInput) return;

    const type = typeSelect.value;
    valInput.value = '';

    if (type === 'NONE') {
      valInput.disabled = true;
      valInput.placeholder = '-';
      valInput.required = false;
    } else if (type === 'NOMINAL') {
      valInput.disabled = false;
      valInput.placeholder = 'Contoh: 50.000';
      valInput.required = true;
    } else if (type === 'PERCENTAGE') {
      valInput.disabled = false;
      valInput.placeholder = 'Contoh: 5 (untuk 5%)';
      valInput.required = true;
    }

    this.updateAssetPreview();
  },

  showAddAssetModal() {
    const modal = document.getElementById('add-asset-modal');
    if (!modal) return;

    document.getElementById('add-asset-form').reset();
    this.rawAssetFiles = [];
    const previewEl = document.getElementById('image-thumbnails-preview');
    if (previewEl) previewEl.innerHTML = '';

    const typeSelect = document.getElementById('new-asset-kelipatan-type');
    const valInput = document.getElementById('new-asset-kelipatan-val');
    if (typeSelect) typeSelect.value = 'NONE';
    if (valInput) {
      valInput.value = '';
      valInput.disabled = true;
      valInput.placeholder = '-';
    }

    // Preset start time to now
    const startTimeInput = document.getElementById('new-asset-start-time');
    if (startTimeInput) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      startTimeInput.value = now.toISOString().slice(0, 16);
    }

    // Preset deadline to 7 days from now
    const deadlineInput = document.getElementById('new-asset-deadline');
    if (deadlineInput) {
      const now = new Date();
      now.setDate(now.getDate() + 7);
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      deadlineInput.value = now.toISOString().slice(0, 16);
    }

    modal.classList.remove('hidden');
    this.updateAssetPreview();
  },

  hideAddAssetModal() {
    const modal = document.getElementById('add-asset-modal');
    if (modal) modal.classList.add('hidden');
    this.rawAssetFiles = [];
    this.closeCamera();
  },

  /**
   * Dynamically renders mock live card preview inside Admin modal
   */
  updateAssetPreview() {
    const container = document.getElementById('live-preview-card-container');
    if (!container) return;

    const nama = document.getElementById('new-asset-name').value.trim() || 'Nama Aset Baru';
    const kategori = document.getElementById('new-asset-category').value;
    const deskripsi = document.getElementById('new-asset-desc').value.trim() || 'Keterangan detail kondisi aset...';

    const priceRaw = document.getElementById('new-asset-price').value || '';
    const priceVal = Number(priceRaw.replace(/[^0-9]/g, '')) || 0;
    const displayPrice = priceVal > 0 ? `Rp ${priceVal.toLocaleString('id-ID')}` : 'Rp 0';

    const primaryImg = this.rawAssetFiles && this.rawAssetFiles.length > 0
      ? URL.createObjectURL(this.rawAssetFiles[0])
      : IMAGE_LOAD_PLACEHOLDER;

    const startTimeVal = document.getElementById('new-asset-start-time').value;
    const deadlineVal = document.getElementById('new-asset-deadline').value;

    const timeInfo = this.formatRemainingTime(startTimeVal, deadlineVal);
    let timeLabel = timeInfo.timeLabel;

    let badgeHtml = '';
    if (timeInfo.status === 'CLOSED') {
      badgeHtml = `<span class="bg-red-500/20 text-red-650 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 font-semibold">● Selesai</span>`;
    } else if (timeInfo.status === 'SCHEDULED') {
      badgeHtml = `<span class="bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 font-semibold">● Scheduled</span>`;
    } else {
      badgeHtml = `<span class="bg-brand-500/20 text-brand-650 dark:text-brand-400 text-[10px] px-2 py-0.5 rounded-full border border-brand-500/30 font-semibold animate-pulse">● Aktif</span>`;
    }

    container.innerHTML = `
      <div class="glass-card flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-xl opacity-90 scale-95 transition-all">
        <div class="relative h-48 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
          <img src="${primaryImg}" class="w-full h-full object-cover">
          <div class="absolute top-2 left-2 bg-white/90 dark:bg-slate-950/80 backdrop-blur text-slate-800 dark:text-slate-200 text-[10px] px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 font-semibold shadow-sm">
            ${kategori}
          </div>
          ${this.rawAssetFiles && this.rawAssetFiles.length > 1 ? `
            <div class="absolute top-2 right-2 bg-white/90 dark:bg-slate-950/80 backdrop-blur text-slate-800 dark:text-slate-200 text-[9px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 font-medium">
              1 / ${this.rawAssetFiles.length}
            </div>
          ` : ''}
        </div>
        <div class="p-4 flex-grow flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              ${badgeHtml}
              <div class="flex items-center gap-0.5 text-slate-500 dark:text-slate-400 text-[10px]">
                <span>⏱️</span>
                <span>${timeLabel}</span>
              </div>
            </div>
            <h3 class="text-sm font-bold text-slate-850 dark:text-slate-100 line-clamp-1">${nama}</h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">${deskripsi}</p>
          </div>
          <div class="border-t border-slate-150 dark:border-slate-800/80 pt-3 flex justify-between items-center">
            <div>
              <span class="block text-[8px] uppercase font-bold text-slate-400">Harga Buka</span>
              <span class="text-[11px] font-bold text-slate-600 dark:text-slate-200">${displayPrice}</span>
            </div>
            <button disabled class="bg-brand-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] opacity-75">
              Bid Terbuka
            </button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Submit new asset with compressed Base64 images to REST endpoint
   */
  async handleAddAsset(event) {
    if (event) event.preventDefault();

    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') {
      this.showToast('Autentikasi admin diperlukan.', 'error');
      AuthService.logout();
      return;
    }

    const nama = document.getElementById('new-asset-name').value.trim();
    const kategori = document.getElementById('new-asset-category').value;
    const deskripsi = document.getElementById('new-asset-desc').value.trim();

    const hargaBukaRaw = document.getElementById('new-asset-price').value;
    const hargaBuka = Number(hargaBukaRaw.replace(/[^0-9]/g, ''));

    const startTimeVal = document.getElementById('new-asset-start-time').value;
    const deadlineVal = document.getElementById('new-asset-deadline').value;

    const customId = document.getElementById('new-asset-id').value.trim();

    if (!nama || !kategori || !hargaBuka || !startTimeVal || !deadlineVal) {
      this.showToast('Harap isi seluruh kolom wajib!', 'error');
      return;
    }

    this.showButtonLoading('btn-submit-add-asset', true, 'Memproses Gambar...');

    // Process images to pure base64 here
    let processedImagesArray = [];
    if (this.rawAssetFiles && this.rawAssetFiles.length > 0) {
      try {
        const promises = this.rawAssetFiles.map(file => this.processImageToPureBase64(file));
        processedImagesArray = await Promise.all(promises);
      } catch (err) {
        this.showToast('Gagal memproses gambar.', 'error');
        this.showButtonLoading('btn-submit-add-asset', false, 'Simpan Aset');
        return;
      }
    }

    const kelipatanType = document.getElementById('new-asset-kelipatan-type').value;
    const kelipatanValRaw = document.getElementById('new-asset-kelipatan-val').value;
    let kelipatanBid = '';

    if (kelipatanType === 'NOMINAL') {
      kelipatanBid = String(Number(kelipatanValRaw.replace(/[^0-9]/g, '')) || 0);
    } else if (kelipatanType === 'PERCENTAGE') {
      const percentVal = parseFloat(kelipatanValRaw.replace(/[^0-9.]/g, '')) || 0;
      kelipatanBid = percentVal > 0 ? `${percentVal}%` : '';
    }

    // Prepare JSON payload
    const assetData = {
      id: customId,
      nama,
      kategori,
      deskripsi,
      hargaBuka,
      waktuMulai: startTimeVal,
      waktuSelesai: deadlineVal,
      images: processedImagesArray, // Array of pure base64 strings
      kelipatanBid: kelipatanBid
    };

    this.showButtonLoading('btn-submit-add-asset', true, 'Menyimpan ke Server...');

    const result = await ApiService.addAsset(admin.email, assetData);

    this.showButtonLoading('btn-submit-add-asset', false, 'Simpan Aset');

    if (result.success) {
      this.showToast(result.message || 'Aset baru berhasil ditambahkan!', 'success');
      this.hideAddAssetModal();
      // Reset views
      this.loadActiveAssets(true);
      this.loadAdminAssetsTable(true);
    } else {
      this.showToast(result.message || 'Gagal menambahkan aset baru.', 'error');
    }
  },

  /**
   * =========================================================================
   * ADMIN MASTER DATA MANAGEMENT TABLES
   * =========================================================================
   */

  /**
   * Downloads assets data and renders the Asset master data management table
   */
  async loadAdminAssetsTable(forceRefresh = false) {
    const tableBody = document.getElementById('admin-assets-table-body');
    if (!tableBody) return;

    const cacheDuration = 15000;
    const isCacheFresh = this.rawAssets &&
      this.lastAssetsFetchTime &&
      (Date.now() - this.lastAssetsFetchTime < cacheDuration);

    let assets = this.rawAssets;

    if (forceRefresh || !isCacheFresh || !assets) {
      if (!assets || tableBody.children.length === 0 || tableBody.innerHTML.includes('<!-- Loaded via JS -->')) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
              <svg class="animate-spin h-5 w-5 text-brand-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading data aset...
            </td>
          </tr>
        `;
      }

      try {
        const response = await ApiService.getAssets();
        if (!response || response.success === false) {
          if (this.rawAssets) {
            this.showToast('Gagal memuat data terbaru, menampilkan data tersimpan.', 'warning');
            assets = this.rawAssets;
          } else {
            tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-6 text-center text-red-500 font-semibold">Gagal memuat data aset dari server.</td></tr>`;
            return;
          }
        } else {
          this.rawAssets = response.data || [];
          this.lastAssetsFetchTime = Date.now();
          assets = this.rawAssets;
        }
      } catch (err) {
        console.error(err);
        if (this.rawAssets) {
          assets = this.rawAssets;
        } else {
          tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-6 text-center text-red-500 font-semibold">Terjadi kesalahan koneksi.</td></tr>`;
          return;
        }
      }
    }

    this.loadedAssets = assets;

    if (assets.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="px-6 py-6 text-center text-slate-500">Tidak ada data aset terdaftar.</td></tr>`;
      return;
    }

    tableBody.innerHTML = assets.map(asset => {
      const parsedPrice = Number(asset.hargaBuka.replace(/[^0-9]/g, '')) || 0;
      const parsedBid = Number(asset.bidTertinggi.replace(/[^0-9]/g, '')) || 0;

      const timeInfo = this.formatRemainingTime(asset.waktuMulai, asset.waktuSelesai);
      const isCanceled = asset.sisaWaktu === 'CANCELLED' || asset.sisaWaktu === 'CANCEL';

      let statusBadge = '';
      if (isCanceled) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-400 font-bold border border-slate-350 dark:border-slate-700">CANCEL</span>`;
      } else if (timeInfo.status === 'CLOSED') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold border border-red-200 dark:border-red-900/40">SELESAI</span>`;
      } else if (timeInfo.status === 'SCHEDULED') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-900/40">SCHEDULED</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-900/40 animate-pulse">AKTIF</span>`;
      }

      const displayTime = isCanceled ? '-' : (timeInfo.status === 'CLOSED' ? 'Lelang Selesai' : timeInfo.timeLabel);

      return `
        <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-900/30 transition-colors">
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap">
            <div class="font-bold text-slate-800 dark:text-slate-200 text-xs">${asset.nama}</div>
            <div class="text-[10px] text-slate-400 font-mono mt-0.5">${asset.id}</div>
          </td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-medium text-slate-600 dark:text-slate-450">${asset.kategori}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-semibold text-slate-650 dark:text-slate-300">Rp ${parsedPrice.toLocaleString('id-ID')}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-medium text-slate-600 dark:text-slate-400">${asset.kelipatanBid || '-'}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-bold text-brand-600 dark:text-brand-400">${parsedBid > 0 ? `Rp ${parsedBid.toLocaleString('id-ID')}` : '-'}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-slate-500 dark:text-slate-400">${displayTime}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap">${statusBadge}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <button onclick="UiService.showEditAssetModal('${asset.id}')"
                      class="bg-brand-500/10 hover:bg-brand-500 text-brand-650 dark:text-brand-400 hover:text-white border border-brand-500/20 px-2.5 py-1 rounded-lg transition-all font-semibold text-[10px]">
                Edit
              </button>
              ${!isCanceled ? `
                <button onclick="UiService.handleDeleteAsset('${asset.id}', '${asset.nama}')"
                        class="bg-red-500/10 hover:bg-red-500 text-red-650 dark:text-red-400 hover:text-white border border-red-500/20 px-2.5 py-1 rounded-lg transition-all font-semibold text-[10px]">
                  Hapus
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  showEditAssetModal(assetId) {
    const asset = (this.rawAssets || []).find(a => a.id === assetId) || (this.loadedAssets || []).find(a => a.id === assetId);
    if (!asset) return;

    this.editCompressedImages = [];
    this.rawEditAssetFiles = [];
    const editFileInput = document.getElementById('edit-asset-files');
    if (editFileInput) editFileInput.value = '';

    const previewEl = document.getElementById('edit-image-thumbnails-preview');
    if (previewEl) {
      previewEl.innerHTML = '';
      const currentImages = asset.gambarUrls || [];
      currentImages.forEach(url => {
        if (!url) return;
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'relative w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex items-center justify-center bg-slate-100 dark:bg-slate-950';
        thumbDiv.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`;
        previewEl.appendChild(thumbDiv);
      });
    }

    document.getElementById('edit-asset-id').value = asset.id;
    document.getElementById('edit-asset-name-input').value = asset.nama;
    document.getElementById('edit-asset-category-input').value = asset.kategori;

    const parsedPrice = Number(asset.hargaBuka.replace(/[^0-9]/g, '')) || 0;
    document.getElementById('edit-asset-price-input').value = parsedPrice.toLocaleString('id-ID');
    document.getElementById('edit-asset-desc-input').value = asset.deskripsi || '';

    // Convert start time back to datetime-local
    const startTimeInput = document.getElementById('edit-asset-start-time-input');
    if (startTimeInput) {
      if (asset.waktuMulai) {
        try {
          const start = new Date(asset.waktuMulai);
          start.setMinutes(start.getMinutes() - start.getTimezoneOffset());
          startTimeInput.value = start.toISOString().slice(0, 16);
        } catch (e) {
          startTimeInput.value = '';
        }
      } else {
        startTimeInput.value = '';
      }
    }

    // Convert deadline text back to datetime-local
    const deadlineInput = document.getElementById('edit-asset-deadline-input');
    if (deadlineInput) {
      if (asset.waktuSelesai) {
        try {
          const deadline = new Date(asset.waktuSelesai);
          deadline.setMinutes(deadline.getMinutes() - deadline.getTimezoneOffset());
          deadlineInput.value = deadline.toISOString().slice(0, 16);
        } catch (e) {
          deadlineInput.value = '';
        }
      } else {
        deadlineInput.value = '';
      }
    }

    const kelipatanType = asset.kelipatanBidType || 'NONE';
    const kelipatanVal = asset.kelipatanBidOriginalVal || '';

    const typeSelect = document.getElementById('edit-asset-kelipatan-type');
    const valInput = document.getElementById('edit-asset-kelipatan-val');

    if (typeSelect) {
      typeSelect.value = kelipatanType;
    }
    if (valInput) {
      valInput.disabled = (kelipatanType === 'NONE');
      if (kelipatanType === 'NOMINAL' && kelipatanVal) {
        valInput.value = Number(kelipatanVal).toLocaleString('id-ID');
      } else {
        valInput.value = kelipatanVal;
      }

      if (kelipatanType === 'NONE') valInput.placeholder = '-';
      else if (kelipatanType === 'NOMINAL') valInput.placeholder = 'Contoh: 50.000';
      else if (kelipatanType === 'PERCENTAGE') valInput.placeholder = 'Contoh: 5';
    }

    document.getElementById('edit-asset-modal').classList.remove('hidden');
  },

  hideEditAssetModal() {
    document.getElementById('edit-asset-modal').classList.add('hidden');
    this.rawEditAssetFiles = [];
    this.closeCamera();
  },

  async handleEditAsset(event) {
    if (event) event.preventDefault();

    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    const assetId = document.getElementById('edit-asset-id').value;
    const nama = document.getElementById('edit-asset-name-input').value.trim();
    const kategori = document.getElementById('edit-asset-category-input').value;
    const deskripsi = document.getElementById('edit-asset-desc-input').value.trim();

    const hargaBukaRaw = document.getElementById('edit-asset-price-input').value;
    const hargaBuka = Number(hargaBukaRaw.replace(/[^0-9]/g, ''));

    const startTimeVal = document.getElementById('edit-asset-start-time-input').value;
    const deadlineVal = document.getElementById('edit-asset-deadline-input').value;

    this.showButtonLoading('btn-submit-edit-asset', true, 'Memproses Gambar...');

    let processedImagesArray = [];
    if (this.rawEditAssetFiles && this.rawEditAssetFiles.length > 0) {
      try {
        const promises = this.rawEditAssetFiles.map(file => this.processImageToPureBase64(file));
        processedImagesArray = await Promise.all(promises);
      } catch (err) {
        this.showToast('Gagal memproses gambar.', 'error');
        this.showButtonLoading('btn-submit-edit-asset', false, 'Simpan Perubahan');
        return;
      }
    }

    const kelipatanType = document.getElementById('edit-asset-kelipatan-type').value;
    const kelipatanValRaw = document.getElementById('edit-asset-kelipatan-val').value;
    let kelipatanBid = '';

    if (kelipatanType === 'NOMINAL') {
      kelipatanBid = String(Number(kelipatanValRaw.replace(/[^0-9]/g, '')) || 0);
    } else if (kelipatanType === 'PERCENTAGE') {
      const percentVal = parseFloat(kelipatanValRaw.replace(/[^0-9.]/g, '')) || 0;
      kelipatanBid = percentVal > 0 ? `${percentVal}%` : '';
    }

    const assetData = {
      nama,
      kategori,
      deskripsi,
      hargaBuka,
      waktuMulai: startTimeVal,
      waktuSelesai: deadlineVal,
      images: processedImagesArray,
      kelipatanBid: kelipatanBid
    };

    this.showButtonLoading('btn-submit-edit-asset', true, 'Menyimpan...');

    const result = await ApiService.editAsset(admin.email, assetId, assetData);

    this.showButtonLoading('btn-submit-edit-asset', false, 'Simpan Perubahan');

    if (result.success) {
      this.showToast(result.message || 'Perubahan aset berhasil disimpan!', 'success');
      this.hideEditAssetModal();
      this.rawEditAssetFiles = [];
      this.loadAdminAssetsTable(true);
      this.loadActiveAssets(true);
    } else {
      this.showToast(result.message || 'Gagal menyimpan perubahan aset.', 'error');
    }
  },

  async handleDeleteAsset(assetId, assetName) {
    const confirmDelete = confirm(`Apakah Anda yakin ingin menonaktifkan aset "${assetName}"? Status lelang akan diubah menjadi CANCEL.`);
    if (!confirmDelete) return;

    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    this.showToast('Menonaktifkan aset...', 'info');
    const result = await ApiService.deleteAsset(admin.email, assetId);

    if (result.success) {
      this.showToast(result.message || 'Aset berhasil dinonaktifkan!', 'success');
      this.loadAdminAssetsTable(true);
      this.loadActiveAssets(true);
    } else {
      this.showToast(result.message || 'Gagal menonaktifkan aset.', 'error');
    }
  },

  /**
   * Downloads users list and renders the User account management table
   */
  async loadAdminUsersTable(forceRefresh = false) {
    const tableBody = document.getElementById('admin-users-table-body');
    if (!tableBody) return;

    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    const cacheDuration = 15000;
    const isCacheFresh = this.rawUsers &&
      this.lastUsersFetchTime &&
      (Date.now() - this.lastUsersFetchTime < cacheDuration);

    let users = this.rawUsers;

    if (forceRefresh || !isCacheFresh || !users) {
      if (!users || tableBody.children.length === 0 || tableBody.innerHTML.includes('<!-- Loaded via JS -->')) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
              <svg class="animate-spin h-5 w-5 text-brand-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading data pengguna...
            </td>
          </tr>
        `;
      }

      try {
        const response = await ApiService.getUsers(admin.email);
        if (!response || response.success === false) {
          if (this.rawUsers) {
            this.showToast('Gagal memuat data terbaru, menampilkan data tersimpan.', 'warning');
            users = this.rawUsers;
          } else {
            tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-6 text-center text-red-500 font-semibold">Gagal memuat data pengguna dari server.</td></tr>`;
            return;
          }
        } else {
          this.rawUsers = response.data || [];
          this.lastUsersFetchTime = Date.now();
          users = this.rawUsers;
        }
      } catch (err) {
        console.error(err);
        if (this.rawUsers) {
          users = this.rawUsers;
        } else {
          tableBody.innerHTML = `<tr><td colspan="9" class="px-6 py-6 text-center text-red-500 font-semibold">Terjadi kesalahan koneksi.</td></tr>`;
          return;
        }
      }
    }

    if (users.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="px-6 py-6 text-center text-slate-500">Tidak ada data pengguna.</td></tr>`;
      return;
    }

    tableBody.innerHTML = users.map(user => {
      const isSelf = user.email.toLowerCase() === admin.email.toLowerCase();

      return `
        <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-900/30 transition-colors">
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">${user.nama_lengkap} ${isSelf ? '<span class="text-[9px] bg-brand-500/20 text-brand-650 dark:text-brand-400 px-1.5 py-0.5 rounded font-bold ml-1">Saya</span>' : ''}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-medium text-slate-500 dark:text-slate-400 font-mono">${user.email}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-slate-600 dark:text-slate-400 font-semibold">${user.nip_bms || '-'}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-slate-650 dark:text-slate-400">${user.no_wa || '-'}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-slate-650 dark:text-slate-400 font-mono">${user.nik || '-'}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap space-x-1">
            ${user.link_surat_kepegawaian && user.link_surat_kepegawaian !== '-' ? `<a href="${user.link_surat_kepegawaian}" target="_blank" class="inline-block bg-brand-500/10 text-brand-650 dark:text-brand-400 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-brand-500/20" title="Surat Kepegawaian / ID Card">🪪 ID</a>` : ''}
            ${user.link_surat_kesanggupan && user.link_surat_kesanggupan !== '-' ? `<a href="${user.link_surat_kesanggupan}" target="_blank" class="inline-block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-emerald-500/20" title="Surat Pernyataan Kesanggupan">📄 Surat</a>` : ''}
            ${user.link_ktp && user.link_ktp !== '-' ? `<a href="${user.link_ktp}" target="_blank" class="inline-block bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-amber-500/20" title="KTP">📇 KTP</a>` : ''}
            ${(!user.link_surat_kepegawaian || user.link_surat_kepegawaian === '-') && (!user.link_surat_kesanggupan || user.link_surat_kesanggupan === '-') && (!user.link_ktp || user.link_ktp === '-') ? '<span class="text-slate-400">-</span>' : ''}
          </td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap">
            <select onchange="UiService.handleUpdateUserRoleAndStatus('${user.email}', this, null)"
                    ${isSelf ? 'disabled' : ''}
                    class="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 rounded px-2 py-1 text-[11px] font-semibold cursor-pointer outline-none">
              <option value="BIDDER" ${String(user.role).toUpperCase() === 'BIDDER' ? 'selected' : ''}>BIDDER</option>
              <option value="ADMIN" ${String(user.role).toUpperCase() === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
            </select>
          </td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap">
            <select onchange="UiService.handleUpdateUserRoleAndStatus('${user.email}', null, this)"
                    ${isSelf ? 'disabled' : ''}
                    class="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 rounded px-2 py-1 text-[11px] font-semibold cursor-pointer outline-none">
              <option value="PENDING" ${user.status_akun === 'PENDING' ? 'selected' : ''}>PENDING</option>
              <option value="AKTIF" ${user.status_akun === 'AKTIF' ? 'selected' : ''}>AKTIF</option>
              <option value="BLOKIR" ${user.status_akun === 'BLOKIR' ? 'selected' : ''}>BLOKIR</option>
            </select>
          </td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-xs">
            ${isSelf ? '<span class="text-slate-400 font-medium text-[10px]">Tidak bisa diedit</span>' : `
              <button onclick="UiService.showEditUserModal('${user.email}')" 
                class="bg-brand-500 hover:bg-brand-600 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-sm hover:shadow-brand-500/10">
                Edit Data
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Action trigger when Admin changes user Role or status inside table
   */
  async handleUpdateUserRoleAndStatus(userEmail, roleSelectElement, statusSelectElement) {
    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    // Load original values from selects
    // (If one of select elements is null, grab the other currently in DOM row, or just parse from selectors)
    let tr = roleSelectElement ? roleSelectElement.closest('tr') : statusSelectElement.closest('tr');
    let selects = tr.querySelectorAll('select');
    let role = selects[0].value;
    let status = selects[1].value;

    this.showToast(`Memperbarui status ${userEmail}...`, 'info');

    const result = await ApiService.updateUser(admin.email, userEmail, role, status);

    if (result.success) {
      this.showToast(result.message || 'Data pengguna berhasil diperbarui!', 'success');
      this.loadAdminUsersTable(true);
    } else {
      this.showToast(result.message || 'Gagal memperbarui data pengguna.', 'error');
    }
  },

  showEditUserModal(userEmail) {
    const user = this.rawUsers.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
    if (!user) {
      this.showToast('Data pengguna tidak ditemukan.', 'error');
      return;
    }

    // Populate text inputs
    document.getElementById('edit-user-email-hidden').value = user.email;
    document.getElementById('edit-user-email-display').value = user.email;
    document.getElementById('edit-user-name').value = user.nama_lengkap || '';
    document.getElementById('edit-user-nip').value = user.nip_bms || '';
    document.getElementById('edit-user-whatsapp').value = user.no_wa || '';
    document.getElementById('edit-user-nik').value = user.nik || '';

    // Populate role and status dropdowns
    document.getElementById('edit-user-role').value = String(user.role).toUpperCase();
    document.getElementById('edit-user-status').value = String(user.status_akun).toUpperCase();

    // Populate current document links
    const showLink = (id, linkText, url) => {
      const el = document.getElementById(id);
      if (el) {
        if (url && url !== '-') {
          el.innerHTML = `<a href="${url}" target="_blank" class="text-brand-500 hover:underline font-bold">${linkText} (Buka Berkas)</a>`;
        } else {
          el.innerHTML = `<span class="text-slate-400">Belum ada dokumen</span>`;
        }
      }
    };

    showLink('edit-user-doc-kepegawaian-link', 'Surat Kepegawaian', user.link_surat_kepegawaian);
    showLink('edit-user-doc-kesanggupan-link', 'Surat Kesanggupan', user.link_surat_kesanggupan);
    showLink('edit-user-doc-ktp-link', 'KTP Pemohon', user.link_ktp);

    // Reset file input values
    document.getElementById('edit-user-file-kepegawaian').value = '';
    document.getElementById('edit-user-file-kesanggupan').value = '';
    document.getElementById('edit-user-file-ktp').value = '';

    // Show modal
    document.getElementById('edit-user-modal').classList.remove('hidden');
  },

  hideEditUserModal() {
    const modal = document.getElementById('edit-user-modal');
    if (modal) modal.classList.add('hidden');
  },

  async handleEditUserSubmit(event) {
    event.preventDefault();
    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    const userEmail = document.getElementById('edit-user-email-hidden').value;
    const name = document.getElementById('edit-user-name').value.trim();
    const nip = document.getElementById('edit-user-nip').value.trim();
    const whatsapp = document.getElementById('edit-user-whatsapp').value.trim();
    const nik = document.getElementById('edit-user-nik').value.trim();
    const role = document.getElementById('edit-user-role').value;
    const status = document.getElementById('edit-user-status').value;

    const fileKepegawaianEl = document.getElementById('edit-user-file-kepegawaian');
    const fileKesanggupanEl = document.getElementById('edit-user-file-kesanggupan');
    const fileKtpEl = document.getElementById('edit-user-file-ktp');

    const maxSizeBytes = 3 * 1024 * 1024; // 3MB

    if (fileKepegawaianEl.files[0] && fileKepegawaianEl.files[0].size > maxSizeBytes) {
      this.showToast('Gagal! Surat Kepegawaian melebihi batas 3MB.', 'error');
      return;
    }
    if (fileKesanggupanEl.files[0] && fileKesanggupanEl.files[0].size > maxSizeBytes) {
      this.showToast('Gagal! Surat Kesanggupan melebihi batas 3MB.', 'error');
      return;
    }
    if (fileKtpEl.files[0] && fileKtpEl.files[0].size > maxSizeBytes) {
      this.showToast('Gagal! KTP Pemohon melebihi batas 3MB.', 'error');
      return;
    }

    const readAsBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    };

    this.showButtonLoading('btn-submit-edit-user', true, 'Memproses data...');

    try {
      const filesPayload = {};
      if (fileKepegawaianEl.files[0]) {
        filesPayload.fileKepegawaian = {
          name: fileKepegawaianEl.files[0].name,
          base64: await readAsBase64(fileKepegawaianEl.files[0])
        };
      }
      if (fileKesanggupanEl.files[0]) {
        filesPayload.fileKesanggupan = {
          name: fileKesanggupanEl.files[0].name,
          base64: await readAsBase64(fileKesanggupanEl.files[0])
        };
      }
      if (fileKtpEl.files[0]) {
        filesPayload.fileKtp = {
          name: fileKtpEl.files[0].name,
          base64: await readAsBase64(fileKtpEl.files[0])
        };
      }

      const result = await ApiService.updateUser(
        admin.email,
        userEmail,
        role,
        status,
        name,
        nip,
        whatsapp,
        nik,
        Object.keys(filesPayload).length > 0 ? filesPayload : null
      );

      this.showButtonLoading('btn-submit-edit-user', false, 'Simpan Perubahan');

      if (result.success) {
        this.showToast(result.message || 'Profil dan berkas pengguna berhasil diperbarui!', 'success');
        this.hideEditUserModal();
        await this.loadAdminUsersTable(true);
      } else {
        this.showToast(result.message || 'Gagal memperbarui data pengguna.', 'error');
      }
    } catch (e) {
      console.error(e);
      this.showToast('Terjadi kesalahan saat mengunggah file.', 'error');
      this.showButtonLoading('btn-submit-edit-user', false, 'Simpan Perubahan');
    }
  },

  async loadSystemMonitor() {
    const container = document.getElementById('system-monitor-content');
    if (!container) return;

    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    container.innerHTML = `
      <div class="py-12 text-center text-slate-500 dark:text-slate-400">
        <svg class="animate-spin h-5 w-5 text-brand-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Memuat status dan kontrol sistem...
      </div>
    `;

    try {
      const response = await ApiService.getSystemQuotas(admin.email);
      if (!response || !response.success) {
        container.innerHTML = `
          <div class="p-6 text-center text-red-500 bg-red-100/20 rounded-2xl border border-red-500/20 font-semibold">
            Gagal memuat status sistem: ${response ? response.message : 'Kesalahan server'}
          </div>
        `;
        return;
      }

      const data = response.data;

      // Formatting bytes helper
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = 2;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
      };

      // 1. Storage math
      const storageUsed = data.storage.used;
      const storageLimit = data.storage.limit;
      const storageUsedPercent = storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;
      let storageStatusClass = 'bg-emerald-500';
      let storageBadgeText = 'AMAN';
      let storageBadgeClass = 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-250 dark:border-emerald-900/40';
      if (storageUsedPercent > 90) {
        storageStatusClass = 'bg-red-500';
        storageBadgeText = 'PENUH';
        storageBadgeClass = 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-250 dark:border-red-900/40 animate-pulse';
      } else if (storageUsedPercent > 75) {
        storageStatusClass = 'bg-amber-500';
        storageBadgeText = 'HAMPIR PENUH';
        storageBadgeClass = 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-250 dark:border-amber-900/40';
      }

      // 2. Cells math
      const cellsUsed = data.database.cellsUsed;
      const cellsLimit = data.database.cellsLimit;
      const cellsUsedPercent = cellsLimit > 0 ? Math.min(100, Math.round((cellsUsed / cellsLimit) * 100)) : 0;
      let cellsStatusClass = 'bg-emerald-500';
      let cellsBadgeText = 'AMAN';
      let cellsBadgeClass = 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-250 dark:border-emerald-900/40';
      if (cellsUsedPercent > 90) {
        cellsStatusClass = 'bg-red-500';
        cellsBadgeText = 'PENUH';
        cellsBadgeClass = 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-250 dark:border-red-900/40 animate-pulse';
      } else if (cellsUsedPercent > 70) {
        cellsStatusClass = 'bg-amber-500';
        cellsBadgeText = 'HAMPIR PENUH';
        cellsBadgeClass = 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-250 dark:border-amber-900/40';
      }

      const sys = data.system || { authMode: 'INTERNAL', registrationClosed: false };

      container.innerHTML = `
        <!-- Control Panel: Access Control & Bidding Phase (Watermarked config) -->
        <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6 mb-6">
          <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
            ⚙️ Kontrol Akses & Fase Bidding
          </h4>
          <p class="text-[11px] text-slate-450 mb-6">Ubah fase lelang dan batasi registrasi penawar secara real-time.</p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Selector 1: Auth Mode / Fase Bidding -->
            <div>
              <label for="sys-auth-mode" class="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Fase Bidding / Login</label>
              <select id="sys-auth-mode" class="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-350 dark:border-slate-850 focus:border-brand-500 rounded-xl px-4 py-3 text-xs font-semibold outline-none transition cursor-pointer text-slate-700 dark:text-slate-300">
                <option value="INTERNAL" ${sys.authMode === 'INTERNAL' ? 'selected' : ''}>Internal (Strict Microsoft @bms.jiipe.co.id)</option>
                <option value="EXTERNAL" ${sys.authMode === 'EXTERNAL' ? 'selected' : ''}>Eksternal (Terbuka untuk Umum - Microsoft & Google)</option>
              </select>
              <p class="text-[10px] text-slate-455 mt-1.5 leading-relaxed">
                Mode <strong>Internal</strong> menyembunyikan tombol Google Sign-In dan membatasi agar hanya email domain '@bms.jiipe.co.id' yang dapat mengakses sistem.
              </p>
            </div>
            
            <!-- Selector 2: Registrasi Control -->
            <div>
              <label for="sys-reg-status" class="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">Status Registrasi Anggota</label>
              <select id="sys-reg-status" class="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-350 dark:border-slate-850 focus:border-brand-500 rounded-xl px-4 py-3 text-xs font-semibold outline-none transition cursor-pointer text-slate-700 dark:text-slate-300">
                <option value="open" ${!sys.registrationClosed ? 'selected' : ''}>Terbuka (User Baru Bisa Mendaftar)</option>
                <option value="closed" ${sys.registrationClosed ? 'selected' : ''}>Ditutup (Pendaftaran Baru Nonaktif)</option>
              </select>
              <p class="text-[10px] text-slate-455 mt-1.5 leading-relaxed">
                Jika <strong>Ditutup</strong>, akun yang belum terdaftar di database 'tb_users' tidak dapat mendaftar (registrasi diblokir).
              </p>
            </div>
          </div>
          
          <div class="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button id="btn-save-sys-config" onclick="UiService.handleSaveSystemConfig()" class="bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-brand-500/10 flex items-center gap-1.5">
              Simpan Pengaturan
            </button>
          </div>
        </div>

        <!-- Metrics Grid (Storage & Database Cells) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          <!-- Metric 1: Drive Storage -->
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-4">
                <div class="p-3 bg-brand-500/10 text-brand-650 dark:text-brand-400 rounded-xl">
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${storageBadgeClass}">${storageBadgeText}</span>
              </div>
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-350">Penyimpanan Google Drive</h4>
              <p class="text-[11px] text-slate-450 mt-1">Digunakan untuk menampung seluruh file gambar aset lelang.</p>
            </div>
            <div class="mt-6">
              <div class="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <span>Terpakai: ${formatBytes(storageUsed)} / ${formatBytes(storageLimit)}</span>
                <span>${storageUsedPercent}%</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div class="${storageStatusClass} h-full rounded-full transition-all duration-500" style="width: ${storageUsedPercent}%"></div>
              </div>
              <div class="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-405">
                Batas maksimal penyimpanan: <span class="font-bold text-slate-700 dark:text-slate-250">${formatBytes(storageLimit)}</span>
              </div>
            </div>
          </div>

          <!-- Metric 2: Sheet Database -->
          <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-4">
                <div class="p-3 bg-brand-500/10 text-brand-650 dark:text-brand-400 rounded-xl">
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${cellsBadgeClass}">${cellsBadgeText}</span>
              </div>
              <h4 class="text-sm font-bold text-slate-700 dark:text-slate-350">Kapasitas Sel Database (Sheet)</h4>
              <p class="text-[11px] text-slate-450 mt-1">Utilisasi jumlah sel terpakai. Google Sheet membatasi maksimal 10 juta sel.</p>
            </div>
            <div class="mt-6">
              <div class="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <span>Terpakai: ${cellsUsed.toLocaleString('id-ID')} / ${cellsLimit.toLocaleString('id-ID')}</span>
                <span>${cellsUsedPercent}%</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div class="${cellsStatusClass} h-full rounded-full transition-all duration-500" style="width: ${cellsUsedPercent}%"></div>
              </div>
              <div class="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-405">
                Plafon limit database: <span class="font-bold text-slate-700 dark:text-slate-250">10 Juta Sel</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Sheet Detail Statistics -->
        <div class="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6">
          <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Statistik Rekor Database (Baris Data)</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div class="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-850">
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pengguna Terdaftar</span>
              <span class="block text-2xl font-extrabold text-slate-800 dark:text-slate-200 mt-2">${data.database.users}</span>
              <span class="block text-[9px] text-slate-405 mt-1">tb_users</span>
            </div>
            <div class="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-850">
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aset Lelang Terdaftar</span>
              <span class="block text-2xl font-extrabold text-slate-800 dark:text-slate-200 mt-2">${data.database.assets}</span>
              <span class="block text-[9px] text-slate-405 mt-1">tb_assets</span>
            </div>
            <div class="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-850">
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Histori Penawaran (Bids)</span>
              <span class="block text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-2">${data.database.bids}</span>
              <span class="block text-[9px] text-slate-405 mt-1">tb_bids</span>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="p-6 text-center text-red-500 bg-red-100/20 rounded-2xl border border-red-500/20 font-semibold">
          Terjadi kesalahan koneksi saat memuat status sistem.
        </div>
      `;
    }
  },

  async handleSaveSystemConfig() {
    const admin = AuthService.getCurrentUser();
    if (!admin || String(admin.role).toUpperCase() !== 'ADMIN') return;

    const authModeSelect = document.getElementById('sys-auth-mode');
    const regStatusSelect = document.getElementById('sys-reg-status');

    if (!authModeSelect || !regStatusSelect) return;

    const authMode = authModeSelect.value;
    const registrationClosed = regStatusSelect.value === 'closed';

    this.showButtonLoading('btn-save-sys-config', true, 'Menyimpan...');

    try {
      const result = await ApiService.updateSystemConfig(admin.email, {
        authMode,
        registrationClosed
      });

      if (result.success) {
        this.showToast(result.message || 'Pengaturan lelang berhasil diperbarui!', 'success');
        AuthService.authMode = authMode;
        AuthService.registrationClosed = registrationClosed;
        await this.loadSystemMonitor();
      } else {
        this.showToast(result.message || 'Gagal menyimpan pengaturan.', 'error');
      }
    } catch (e) {
      console.error(e);
      this.showToast('Terjadi kesalahan koneksi.', 'error');
    } finally {
      this.showButtonLoading('btn-save-sys-config', false, 'Simpan Pengaturan');
    }
  },

  /**
   * Displays aesthetic floating toast messages
   */
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto flex items-center gap-3 p-4 rounded-xl border max-w-sm shadow-2xl glass-panel bg-white/95 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 animate-slide-in';

    let borderClass = 'border-blue-500/30 text-blue-500 dark:text-blue-400';
    let icon = `
      <svg class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    `;

    if (type === 'success') {
      borderClass = 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
      icon = `
        <svg class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `;
    } else if (type === 'error') {
      borderClass = 'border-red-500/30 text-red-650 dark:text-red-400';
      icon = `
        <svg class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      `;
    }

    toast.classList.add(...borderClass.split(' '));
    toast.innerHTML = `
      ${icon}
      <div class="text-xs font-semibold text-slate-700 dark:text-slate-200 pr-2">${message}</div>
      <button class="text-slate-400 hover:text-slate-650 dark:hover:text-white flex-shrink-0" onclick="this.parentElement.remove()">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.replace('animate-slide-in', 'animate-slide-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  },

  /**
   * Displays modal alerting the user to whitelist the automated system email in Outlook
   */
  showWhitelistInstructionModal(userEmail) {
    const modalId = 'email-whitelist-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
      <div id="${modalId}" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-3xl mt-1">📧</span>
            <div>
              <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">Penting: Verifikasi Notifikasi Email</h3>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Notifikasi dikirim ke: <strong class="text-brand-500">${userEmail}</strong></p>
            </div>
          </div>
          
          <div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-slate-700 dark:text-slate-350 space-y-2.5 text-xs">
            <p class="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span>⚠️</span> MOHON LAKUKAN INI DI OUTLOOK:
            </p>
            <ol class="list-decimal pl-4 space-y-2 leading-relaxed">
              <li>Buka <strong>Microsoft Outlook</strong> Anda (Web/Aplikasi).</li>
              <li>Periksa folder <strong>Junk Email (Sampah / Spam)</strong>.</li>
              <li>Temukan email dari <strong>"BMS Bidding Portal"</strong> (pengirim: *biddingz@bms.jiipe.co.id*).</li>
              <li>Klik kanan pada email tersebut, lalu pilih <strong>Junk</strong> -&gt; <strong>Not Junk</strong> (atau <strong>Never Block Sender</strong>).</li>
            </ol>
            <p class="text-[9.5px] text-slate-400 dark:text-slate-500 leading-normal border-t border-slate-200/50 dark:border-slate-700/50 pt-2 font-medium">
              *Langkah ini wajib agar Anda menerima notifikasi penting saat harga penawaran Anda tersalip (outbid) atau saat memenangkan lelang.*
            </p>
          </div>
          
          <button onclick="document.getElementById('${modalId}').remove()" class="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-xl text-xs transition shadow-lg shadow-brand-500/10 tracking-wider">
            SAYA MENGERTI & SIAP CEK EMAIL
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  getCart() {
    return [];
  },

  saveCart(cart) {
    // Obsolete: cart is now handled in the backend as bid history
  },

  toggleCart(event, assetId) {
    // Obsolete: cart is now handled in the backend as bid history
  },

  clearCart() {
    // Obsolete: cart is now handled in the backend as bid history
  },

  async updateCartBadge(userBids = null) {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    let bids = userBids;
    if (!bids) {
      const response = await ApiService.getUserBids(user.email);
      if (response && response.success) {
        bids = response.data || [];
      }
    }

    const badge = document.getElementById('cart-badge');
    const mobileBadge = document.getElementById('mobile-cart-badge');

    if (bids && bids.length > 0) {
      // Find unique assets that user has bid on
      const uniqueAssetIds = new Set(bids.map(b => b.assetId));
      const count = uniqueAssetIds.size;

      if (count > 0) {
        if (badge) {
          badge.innerText = count;
          badge.classList.remove('hidden');
        }
        if (mobileBadge) {
          mobileBadge.innerText = count;
          mobileBadge.classList.remove('hidden');
        }
      } else {
        if (badge) badge.classList.add('hidden');
        if (mobileBadge) mobileBadge.classList.add('hidden');
      }
    } else {
      if (badge) badge.classList.add('hidden');
      if (mobileBadge) mobileBadge.classList.add('hidden');
    }
  },

  async renderCart(userBids = null) {
    const tableBody = document.getElementById('user-bids-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-12 text-center text-slate-550 dark:text-slate-400">
          <svg class="animate-spin h-5 w-5 text-brand-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Memuat histori penawaran...
        </td>
      </tr>
    `;

    const user = AuthService.getCurrentUser();
    if (!user) {
      tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-red-500">Autentikasi diperlukan.</td></tr>`;
      return;
    }

    let bids = userBids;
    if (!bids) {
      const response = await ApiService.getUserBids(user.email);
      if (!response || !response.success) {
        tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-center text-red-500">Gagal memuat histori penawaran dari server.</td></tr>`;
        return;
      }
      bids = response.data || [];
    }

    if (bids.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-16 text-center text-slate-400 bg-white/40 dark:bg-slate-900/10 rounded-2xl">
            <svg class="mx-auto h-12 w-12 text-slate-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2h2a2 2 0 002-2" />
            </svg>
            <p class="text-sm font-bold">Belum Ada Histori Penawaran</p>
            <p class="text-xs">Anda belum pernah mengajukan penawaran pada aset apa pun.</p>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = bids.map(bid => {
      const nominalVal = Number(bid.nominal) || 0;
      const displayNominal = `Rp ${nominalVal.toLocaleString('id-ID')}`;

      const bidDate = new Date(bid.timestamp);
      const displayDate = isNaN(bidDate.getTime()) ? '-' : bidDate.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) + ' WIB';

      const primaryImage = bid.gambarUrl || IMAGE_LOAD_PLACEHOLDER;

      let statusBadge = '';
      if (bid.status === 'VALID') {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">VALID</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 font-bold">${bid.status || 'BATAL'}</span>`;
      }

      // Check if this bid won or was outbid
      const correspondingAsset = (this.rawAssets || []).find(a => a.id === bid.assetId) || (this.loadedAssets || []).find(a => a.id === bid.assetId);
      let outcomeBadge = '';
      if (correspondingAsset) {
        const timeInfo = this.formatRemainingTime(correspondingAsset.waktuMulai, correspondingAsset.waktuSelesai);
        const isClosed = timeInfo.status === 'CLOSED';
        const isWinner = correspondingAsset.emailPemenang && correspondingAsset.emailPemenang.toLowerCase() === user.email.toLowerCase();
        const currentHighestBid = Number(String(correspondingAsset.bidTertinggi).replace(/[^0-9]/g, '')) || 0;
        const isOutbid = bid.status === 'VALID' && currentHighestBid > 0 && nominalVal < currentHighestBid;

        if (isClosed) {
          if (isWinner && nominalVal === currentHighestBid) {
            outcomeBadge = `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-extrabold shadow-sm animate-pulse">
                🏆 MENANG LELANG
              </span>
            `;
          } else if (isOutbid) {
            outcomeBadge = `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-rose-500/10 text-rose-650 dark:text-rose-400 border border-rose-500/20 font-bold shadow-sm">
                ❌ Terlampaui
              </span>
            `;
          } else {
            outcomeBadge = `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold">
                Selesai
              </span>
            `;
          }
        } else {
          // Auction is still active/scheduled
          if (isOutbid) {
            outcomeBadge = `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-amber-500/10 text-amber-655 dark:text-amber-400 border border-amber-500/20 font-bold shadow-sm">
                ⚠️ Terlampaui
              </span>
            `;
          } else if (bid.status === 'VALID' && nominalVal === currentHighestBid) {
            outcomeBadge = `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-extrabold shadow-sm">
                📈 Teratas
              </span>
            `;
          }
        }
      }

      let statusColContent = statusBadge;
      if (outcomeBadge) {
        statusColContent = `
          <div class="flex flex-col gap-1.5 items-start">
            ${statusBadge}
            ${outcomeBadge}
          </div>
        `;
      }

      return `
        <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-900/30 transition-colors">
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap">
            <div class="flex items-center gap-3">
              <img src="${primaryImage}" class="h-10 w-10 flex-shrink-0 rounded-lg object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950" onerror="this.src=IMAGE_LOAD_PLACEHOLDER;">
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-200 text-xs">${bid.namaAset}</div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5">${bid.assetId}</div>
              </div>
            </div>
          </td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-medium text-slate-650 dark:text-slate-400">${bid.kategori}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-bold text-brand-600 dark:text-brand-400">${displayNominal}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap text-slate-500 dark:text-slate-405">${displayDate}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap">${statusColContent}</td>
          <td class="px-3 md:px-6 py-2.5 md:py-4 whitespace-nowrap font-medium">
            <button onclick="UiService.showAssetDetail('${bid.assetId}')"
                    class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-350 font-bold px-3 py-1.5 rounded-lg text-[10px] transition border border-slate-250 dark:border-slate-700">
              Detail
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  formatRemainingTime(waktuMulai, waktuSelesai) {
    if (!waktuSelesai) {
      return { status: 'CLOSED', timeLabel: 'Lelang Selesai', detailText: '-', detailTextLong: '-' };
    }

    const now = new Date();
    const start = waktuMulai ? new Date(waktuMulai) : null;
    const end = new Date(waktuSelesai);

    const formatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };

    const startStr = start && !isNaN(start.getTime()) ? start.toLocaleString('id-ID', formatOptions) + ' WIB' : '-';
    const endStr = !isNaN(end.getTime()) ? end.toLocaleString('id-ID', formatOptions) + ' WIB' : '-';

    if (isNaN(end.getTime())) {
      return { status: 'CLOSED', timeLabel: 'Lelang Selesai', detailText: '-', detailTextLong: '-' };
    }

    if (start && !isNaN(start.getTime()) && now < start) {
      const diffMs = start - now;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHrs = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHrs / 24);

      let timeLabel = '';
      if (diffDays > 0) {
        timeLabel = `Mulai dlm: ${diffDays} hari ${diffHrs % 24} jam`;
      } else if (diffHrs > 0) {
        timeLabel = `Mulai dlm: ${diffHrs} jam`;
      } else {
        timeLabel = 'Segera Mulai';
      }

      return {
        status: 'SCHEDULED',
        timeLabel: timeLabel,
        detailText: `Mulai: ${startStr}`,
        detailTextLong: `Lelang dimulai pada ${startStr} s/d ${endStr}`
      };
    } else if (now > end) {
      return {
        status: 'CLOSED',
        timeLabel: 'Lelang Selesai',
        detailText: `Selesai: ${endStr}`,
        detailTextLong: `Lelang telah selesai pada ${endStr}`
      };
    } else {
      const diffMs = end - now;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHrs = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHrs / 24);

      let timeLabel = '';
      if (diffDays > 0) {
        timeLabel = `${diffDays} hari ${diffHrs % 24} jam`;
      } else if (diffHrs > 0) {
        timeLabel = `${diffHrs} jam`;
      } else {
        timeLabel = 'Kurang dari 1 jam';
      }

      return {
        status: 'ACTIVE',
        timeLabel: timeLabel,
        detailText: `Selesai: ${endStr}`,
        detailTextLong: `Selesai pada ${endStr}`
      };
    }
  },

  /**
   * Helper skeleton HTML while assets are loading from REST endpoint
   */
  getSkeletonCardHtml() {
    return `
      <div class="glass-card flex flex-col rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-pulse bg-white dark:bg-slate-900/40">
        <div class="h-56 bg-slate-200 dark:bg-slate-800"></div>
        <div class="p-5 flex-1 space-y-4">
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
          <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
          <div class="border-t border-slate-150 dark:border-slate-800/80 pt-4 mt-auto">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div class="space-y-2"><div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div></div>
              <div class="space-y-2"><div class="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div><div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div></div>
            </div>
            <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Checks if any asset the user has bid on has closed, and displays a toast notification
   */
  async checkClosedAssetsNotifications(assets, userBids = null) {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    // Filter assets that are CLOSED
    const closedAssets = assets.filter(asset => {
      const timeInfo = this.formatRemainingTime(asset.waktuMulai, asset.waktuSelesai);
      return timeInfo.status === 'CLOSED';
    });

    if (closedAssets.length === 0) return;

    // Get list of notified closed assets from localStorage (scoped by user email)
    const storageKey = `notifiedClosed_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    let notifiedIds = {};
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        notifiedIds = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error parsing notifiedClosedAssets:', e);
    }

    // Check user's bids to see if they participated
    let bids = userBids;
    if (!bids) {
      const response = await ApiService.getUserBids(user.email);
      if (response && response.success) {
        bids = response.data || [];
      }
    }

    if (!bids) return;

    const userBidAssetIds = new Set(bids.map(b => b.assetId));

    let updated = false;

    closedAssets.forEach(asset => {
      if (userBidAssetIds.has(asset.id)) {
        if (!notifiedIds[asset.id]) {
          const userEmail = user.email.toLowerCase();
          const winnerEmail = asset.emailPemenang ? asset.emailPemenang.toLowerCase() : '';

          let message = '';
          if (winnerEmail === userEmail) {
            // User won!
            message = `🎉 Selamat! Lelang untuk aset <b>"${asset.nama}"</b> telah selesai dan Anda memenangkannya dengan penawaran tertinggi ${asset.bidTertinggi}!`;
            this.showToast(message, 'success');
          } else {
            // User lost
            const winnerText = asset.namaPemenang ? `${asset.namaPemenang} (NIP: ${asset.nip_bms || '-'})` : 'orang lain';
            message = `📢 Informasi: Lelang untuk aset <b>"${asset.nama}"</b> telah selesai. Pemenang: ${winnerText} dengan penawaran ${asset.bidTertinggi || 'Rp 0'}.`;
            this.showToast(message, 'info');
          }

          notifiedIds[asset.id] = true;
          updated = true;
        }
      }
    });

    if (updated) {
      localStorage.setItem(storageKey, JSON.stringify(notifiedIds));
    }
  },

  /**
   * Renders the pagination controls for the gallery view
   */
  renderPagination(totalItems) {
    const container = document.getElementById('gallery-pagination');
    if (!container) return;

    const totalPages = Math.ceil(totalItems / this.assetsPerPage);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Prev Button
    html += `
      <button onclick="UiService.changePage(${this.currentPage - 1})"
              ${this.currentPage === 1 ? 'disabled' : ''}
              class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 text-slate-550 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-semibold shadow-sm">
        &larr; Prev
      </button>
    `;

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
      html += `
        <button onclick="UiService.changePage(${i})"
                class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${this.currentPage === i ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-850'}">
          ${i}
        </button>
      `;
    }

    // Next Button
    html += `
      <button onclick="UiService.changePage(${this.currentPage + 1})"
              ${this.currentPage === totalPages ? 'disabled' : ''}
              class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 text-slate-550 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-semibold shadow-sm">
        Next &rarr;
      </button>
    `;

    container.innerHTML = html;
  },

  changePage(page) {
    this.currentPage = page;
    this.renderAssets(this.currentFilteredAssets);

    // Smooth scroll back to search filters panel
    const searchSection = document.getElementById('stats-panel-section');
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  // Fullscreen Image Viewer State & Controls
  fullscreenScale: 1.0,
  fullscreenPanX: 0,
  fullscreenPanY: 0,
  isFullscreenDragging: false,
  fullscreenStartX: 0,
  fullscreenStartY: 0,

  openFullscreenImage() {
    const detailImg = document.getElementById('detail-carousel-img');
    const fullscreenImg = document.getElementById('fullscreen-zoom-img');
    const overlay = document.getElementById('image-fullscreen-overlay');
    const indicator = document.getElementById('fullscreen-index-indicator');

    if (!detailImg || !fullscreenImg || !overlay) return;

    fullscreenImg.src = detailImg.src;

    // Reset zoom and panning values
    this.fullscreenScale = 1.0;
    this.fullscreenPanX = 0;
    this.fullscreenPanY = 0;
    this.updateFullscreenTransform();

    // Set indicator text
    if (indicator) {
      const idxSpan = document.getElementById('counter-' + this.currentDetailAssetId);
      if (idxSpan) {
        indicator.innerText = `${idxSpan.innerText} / ${this.currentDetailImages.length}`;
      } else {
        indicator.innerText = `${this.currentDetailIdx + 1} / ${this.currentDetailImages.length}`;
      }
    }

    overlay.classList.remove('hidden');
  },

  closeFullscreenImage() {
    const overlay = document.getElementById('image-fullscreen-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  },

  zoomFullscreen(factor) {
    this.fullscreenScale = Math.max(0.5, Math.min(5.0, this.fullscreenScale + factor));
    this.updateFullscreenTransform();
  },

  resetFullscreenZoom() {
    this.fullscreenScale = 1.0;
    this.fullscreenPanX = 0;
    this.fullscreenPanY = 0;
    this.updateFullscreenTransform();
  },

  setupFullscreenPointerEvents() {
    const viewport = document.getElementById('fullscreen-zoom-viewport');
    const img = document.getElementById('fullscreen-zoom-img');
    if (!viewport || !img) return;

    viewport.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      viewport.setPointerCapture(e.pointerId);
      this.isFullscreenDragging = true;
      this.fullscreenStartX = e.clientX - this.fullscreenPanX;
      this.fullscreenStartY = e.clientY - this.fullscreenPanY;
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!this.isFullscreenDragging) return;
      e.preventDefault();
      this.fullscreenPanX = e.clientX - this.fullscreenStartX;
      this.fullscreenPanY = e.clientY - this.fullscreenStartY;
      this.updateFullscreenTransform();
    });

    const endDrag = (e) => {
      if (!this.isFullscreenDragging) return;
      this.isFullscreenDragging = false;
      viewport.releasePointerCapture(e.pointerId);
    };

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    // Double tap/click to zoom quickly toggle
    viewport.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (this.fullscreenScale > 1.0) {
        this.resetFullscreenZoom();
      } else {
        this.fullscreenScale = 2.0;
        this.fullscreenPanX = 0;
        this.fullscreenPanY = 0;
        this.updateFullscreenTransform();
      }
    });
  },

  updateFullscreenTransform() {
    const img = document.getElementById('fullscreen-zoom-img');
    if (img) {
      img.style.transform = `scale(${this.fullscreenScale}) translate(${this.fullscreenPanX / this.fullscreenScale}px, ${this.fullscreenPanY / this.fullscreenScale}px)`;
    }
  },

  showTimelineModal() {
    const modalId = 'timeline-modal';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    // Determine current stage dynamically based on current date
    const now = new Date();
    let activeStage = 1; // Default fallback to Stage 1

    // Month is 0-indexed: 5 is June, 6 is July
    const stage1Start = new Date(2026, 5, 29, 0, 0, 0);
    const stage1End = new Date(2026, 6, 3, 23, 59, 59);

    const stage2Start = new Date(2026, 6, 6, 11, 0, 0);
    const stage2End = new Date(2026, 6, 6, 13, 0, 0);

    const stage3Start = new Date(2026, 6, 6, 0, 0, 0);
    const stage3End = new Date(2026, 6, 9, 23, 59, 59);

    const stage4Start = new Date(2026, 6, 10, 0, 0, 0);
    const stage4End = new Date(2026, 6, 10, 23, 59, 59);

    const stage5Start = new Date(2026, 6, 13, 0, 0, 0);

    if (now >= stage1Start && now <= stage1End) {
      activeStage = 1;
    } else if (now >= stage2Start && now <= stage2End) {
      activeStage = 2;
    } else if (now >= stage3Start && now <= stage3End) {
      if (now >= stage2Start && now <= stage2End) {
        activeStage = 2;
      } else {
        activeStage = 3;
      }
    } else if (now >= stage4Start && now <= stage4End) {
      activeStage = 4;
    } else if (now >= stage5Start) {
      activeStage = 5;
    } else if (now > stage1End && now < stage3Start) {
      activeStage = 2;
    } else if (now > stage3End && now < stage4Start) {
      activeStage = 4;
    } else if (now > stage4End && now < stage5Start) {
      activeStage = 5;
    }

    const getStageClasses = (stageNum) => {
      const isActive = activeStage === stageNum;
      return {
        badge: isActive
          ? 'absolute left-0 w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-extrabold text-[10px] shadow-lg shadow-brand-500/20 ring-4 ring-brand-500/10'
          : 'absolute left-0 w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-400 flex items-center justify-center font-extrabold text-[10px]',
        box: isActive
          ? 'flex-grow bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl p-3 ring-1 ring-brand-500/20 shadow-md'
          : 'flex-grow bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-2xl p-3',
        status: isActive
          ? `<span class="bg-brand-500/15 text-brand-650 dark:text-brand-400 text-[8px] font-bold px-2 py-0.5 rounded-full animate-pulse border border-brand-500/20">Sedang Berlangsung</span>`
          : '',
        label: isActive ? 'STAGE 0' + stageNum : 'STAGE 0' + stageNum
      };
    };

    const s1 = getStageClasses(1);
    const s2 = getStageClasses(2);
    const s3 = getStageClasses(3);
    const s4 = getStageClasses(4);
    const s5 = getStageClasses(5);

    const modalHtml = `
      <div id="${modalId}" style="z-index: 150;" class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div class="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl p-6 relative animate-fade-in-up">
          
          <button onclick="document.getElementById('${modalId}').remove()" 
                  class="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="mb-5">
            <span class="text-[9px] font-extrabold text-brand-650 dark:text-brand-400 uppercase tracking-widest">Jadwal Kegiatan</span>
            <h3 class="text-base font-extrabold text-slate-850 dark:text-slate-100">Timeline Lelang Aset</h3>
            <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">PT Berlian Manyar Sejahtera</p>
          </div>

          <div class="space-y-4 relative before:absolute before:inset-y-1 before:left-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            
            <!-- Stage 1 -->
            <div class="relative pl-8 flex gap-3">
              <div class="${s1.badge}">01</div>
              <div class="${s1.box}">
                <div class="flex justify-between items-start">
                  <span class="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">${s1.label}</span>
                  ${s1.status}
                </div>
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-150 mt-0.5">PENGUMUMAN LELANG</h4>
                <p class="text-[9.5px] text-slate-500 dark:text-slate-450 mt-0.5">29 Juni – 03 Juli 2026</p>
              </div>
            </div>

            <!-- Stage 2 -->
            <div class="relative pl-8 flex gap-3">
              <div class="${s2.badge}">02</div>
              <div class="${s2.box}">
                <div class="flex justify-between items-start">
                  <span class="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">${s2.label}</span>
                  ${s2.status}
                </div>
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-150 mt-0.5">DISPLAY BARANG LELANG</h4>
                <p class="text-[9.5px] text-slate-500 dark:text-slate-450 mt-0.5 font-semibold">06 Juli 2026 <span class="text-slate-400">|</span> 11:00 – 13:00 WIB</p>
                <p class="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-medium flex items-center gap-1">
                  <span>📍</span> Kantor Operasional PT Berlian Manyar Sejahtera
                </p>
              </div>
            </div>

            <!-- Stage 3 -->
            <div class="relative pl-8 flex gap-3">
              <div class="${s3.badge}">03</div>
              <div class="${s3.box}">
                <div class="flex justify-between items-start">
                  <span class="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">${s3.label}</span>
                  ${s3.status}
                </div>
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-150 mt-0.5">PENDAFTARAN & BIDDING ITEM LELANG</h4>
                <p class="text-[9.5px] text-slate-500 dark:text-slate-450 mt-0.5 font-semibold">06 – 09 Juli 2026</p>
                <ul class="text-[9px] text-slate-450 dark:text-slate-500 mt-1 list-disc pl-3.5 space-y-0.5">
                  <li>Pendaftaran Peserta Lelang</li>
                  <li>Bidding Item Lelang</li>
                </ul>
              </div>
            </div>

            <!-- Stage 4 -->
            <div class="relative pl-8 flex gap-3">
              <div class="${s4.badge}">04</div>
              <div class="${s4.box}">
                <div class="flex justify-between items-start">
                  <span class="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">${s4.label}</span>
                  ${s4.status}
                </div>
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-150 mt-0.5">EVALUASI HASIL BIDDING</h4>
                <p class="text-[9.5px] text-slate-500 dark:text-slate-450 mt-0.5 font-semibold">10 Juli 2026</p>
                <p class="text-[9px] text-slate-455 dark:text-slate-500 mt-1">Oleh Panitia Lelang</p>
              </div>
            </div>

            <!-- Stage 5 -->
            <div class="relative pl-8 flex gap-3">
              <div class="${s5.badge}">05</div>
              <div class="${s5.box}">
                <div class="flex justify-between items-start">
                  <span class="text-[8px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">${s5.label}</span>
                  ${s5.status}
                </div>
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-150 mt-0.5">PENGUMUMAN PEMENANG LELANG</h4>
                <p class="text-[9.5px] text-slate-500 dark:text-slate-450 mt-0.5 font-semibold">13 Juli 2026</p>
              </div>
            </div>

          </div>

          <div class="mt-5 flex justify-end">
            <button onclick="document.getElementById('${modalId}').remove()" 
                    class="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-5 rounded-xl text-xs transition">
              Tutup
            </button>
          </div>

        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  // =========================================================================
  // EXPORT REKAP PEMENANG
  // =========================================================================

  /**
   * Helper: Build winner recap rows from rawAssets data.
   * Returns array of objects with all relevant winner fields.
   */
  _buildWinnerRekapData() {
    const assets = this.rawAssets || this.loadedAssets || [];
    if (!assets.length) return [];

    return assets
      .filter(asset => {
        const isCanceled = asset.sisaWaktu === 'CANCELLED' || asset.sisaWaktu === 'CANCEL';
        return !isCanceled;
      })
      .map((asset, index) => {
        const parsedHargaBuka = Number(String(asset.hargaBuka || '').replace(/[^0-9]/g, '')) || 0;
        const parsedBidTertinggi = Number(String(asset.bidTertinggi || '').replace(/[^0-9]/g, '')) || 0;
        const timeInfo = this.formatRemainingTime(asset.waktuMulai, asset.waktuSelesai);
        const isClosed = timeInfo.status === 'CLOSED';
        const hasPemenang = parsedBidTertinggi > 0;

        let deadlineDisplay = '-';
        if (asset.waktuSelesai) {
          try {
            const d = new Date(asset.waktuSelesai);
            deadlineDisplay = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
          } catch (e) { deadlineDisplay = asset.waktuSelesai; }
        }

        return {
          no: index + 1,
          idAset: asset.id || '-',
          namaAset: asset.nama || '-',
          kategori: asset.kategori || '-',
          hargaBuka: `Rp ${parsedHargaBuka.toLocaleString('id-ID')}`,
          bidPemenang: hasPemenang ? `Rp ${parsedBidTertinggi.toLocaleString('id-ID')}` : '-',
          emailPemenang: asset.emailPemenang || '-',
          namaPemenang: asset.namaPemenang || '-',
          nipBms: asset.nip_bms || '-',
          noWa: asset.noWa || '-',
          statusLelang: isClosed ? 'SELESAI' : 'AKTIF',
          waktuSelesai: deadlineDisplay,
          rawBid: parsedBidTertinggi,
          rawHargaBuka: parsedHargaBuka,
          isClosed: isClosed,
          hasPemenang: hasPemenang
        };
      });
  },

  /**
   * Export winner recap data as a UTF-8 BOM CSV file.
   * BOM ensures proper encoding when opened in Microsoft Excel (Indonesian locale).
   */
  exportWinnersCSV() {
    const data = this._buildWinnerRekapData();
    if (!data.length) {
      this.showToast('Tidak ada data pemenang untuk diekspor. Pastikan data aset sudah dimuat.', 'warning');
      return;
    }

    const headers = [
      'No', 'ID Aset', 'Nama Aset', 'Kategori',
      'Harga Buka', 'Bid Pemenang', 'Email Pemenang',
      'Nama Pemenang', 'NIP BMS', 'No. WhatsApp',
      'Status Lelang', 'Tanggal Selesai'
    ];

    const escapeCSV = (val) => {
      const str = String(val || '-');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = data.map(row => [
      row.no, row.idAset, row.namaAset, row.kategori,
      row.hargaBuka, row.bidPemenang, row.emailPemenang,
      row.namaPemenang, row.nipBms, row.noWa,
      row.statusLelang, row.waktuSelesai
    ].map(escapeCSV).join(','));

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const fileName = `Rekap_Pemenang_BMS_${dateStr}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.showToast(`Berhasil mengekspor ${data.length} data pemenang ke CSV.`, 'success');
  },

  /**
   * Export winner recap data as a beautifully formatted print-ready PDF.
   * Opens a new window with a styled HTML page that auto-triggers the print dialog.
   */
  exportWinnersPDF() {
    const data = this._buildWinnerRekapData();
    if (!data.length) {
      this.showToast('Tidak ada data pemenang untuk diekspor. Pastikan data aset sudah dimuat.', 'warning');
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Logo path (relative to the page origin)
    const logoUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/') + 'asset/images/Logo-Berlian-Manyar-Sejahtera.png';

    const tableRows = data.map((row, idx) => {
      const statusClass = row.isClosed
        ? 'background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;'
        : 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;';
      const rowBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';

      const pemenangCell = row.hasPemenang
        ? `<div style="font-weight:700;color:#1e293b;font-size:10.5px;">${row.namaPemenang}</div>
           <div style="font-size:9px;color:#94a3b8;margin-top:1px;">NIP: ${row.nipBms}</div>
           <div style="font-size:9px;color:#94a3b8;">WA: ${row.noWa}</div>`
        : `<span style="color:#cbd5e1;font-size:9.5px;font-style:italic;">Belum ada pemenang</span>`;

      const bidCell = row.hasPemenang
        ? `<span style="font-weight:800;color:#1d4ed8;font-size:11px;">${row.bidPemenang}</span>`
        : `<span style="color:#cbd5e1;font-size:9.5px;">-</span>`;

      return `
        <tr style="background:${rowBg};">
          <td style="padding:8px 10px;text-align:center;font-weight:700;color:#64748b;border-bottom:1px solid #e2e8f0;">${row.no}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">
            <div style="font-weight:700;color:#1e293b;font-size:10.5px;">${row.namaAset}</div>
            <div style="font-size:9px;color:#94a3b8;font-family:monospace;margin-top:2px;">${row.idAset}</div>
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#475569;">${row.kategori}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#475569;">${row.hargaBuka}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${bidCell}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${pemenangCell}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">
            <span style="display:inline-block;padding:3px 8px;border-radius:20px;font-size:9px;font-weight:800;letter-spacing:0.04em;${statusClass}">
              ${row.statusLelang}
            </span>
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:9.5px;color:#64748b;">${row.waktuSelesai}</td>
        </tr>
      `;
    }).join('');

    const terlelangCount = data.filter(r => r.hasPemenang).length;
    const tidakTerlelangCount = data.filter(r => !r.hasPemenang).length;
    const totalHargaBuka = data.reduce((sum, row) => sum + (row.rawHargaBuka || 0), 0);
    const totalHargaTerjual = data.reduce((sum, row) => sum + (row.rawBid || 0), 0);
    const totalHargaBukaFormatted = `Rp ${totalHargaBuka.toLocaleString('id-ID')}`;
    const totalHargaTerjualFormatted = `Rp ${totalHargaTerjual.toLocaleString('id-ID')}`;

    const printHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekap Pemenang Lelang — PT. Berlian Manyar Sejahtera</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-wrapper {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 36px 40px;
    }

    /* === HEADER === */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 20px;
      border-bottom: 3px solid #1d4ed8;
      margin-bottom: 24px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo-wrapper {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      background: #eff6ff;
      border: 2px solid #bfdbfe;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .logo-wrapper img {
      width: 52px;
      height: 52px;
      object-fit: contain;
    }
    .company-info .company-name {
      font-size: 17px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .company-info .company-sub {
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .doc-subtitle {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 4px;
      font-weight: 500;
    }
    .doc-date {
      font-size: 10px;
      color: #475569;
      font-weight: 600;
      margin-top: 2px;
    }

    /* === SUMMARY CARDS === */
    .summary-section {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 8px;
    }
    .summary-section-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .summary-card .card-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .summary-card .card-value {
      font-size: 18px;
      font-weight: 900;
      color: #1e3a8a;
      margin-top: 4px;
      line-height: 1;
    }
    .summary-card .card-value.green { color: #065f46; }
    .summary-card .card-value.red { color: #b91c1c; }
    .summary-card .card-value.blue { color: #1e3a8a; }
    .summary-card .card-value.small {
      font-size: 12px;
      margin-top: 6px;
    }

    /* === TABLE === */
    .section-title {
      font-size: 10px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    thead th {
      background: #1e3a8a;
      color: #ffffff;
      padding: 9px 10px;
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    thead th:first-child { border-radius: 6px 0 0 0; }
    thead th:last-child { border-radius: 0 6px 0 0; }
    tbody tr:hover { background: #f0f9ff !important; }

    /* === FOOTER === */
    .footer {
      margin-top: 32px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 32px;
      margin-top: 10px;
    }
    .signature-box {
      text-align: center;
    }
    .signature-box .sig-title {
      font-size: 9px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .signature-box .sig-line {
      margin: 48px auto 8px;
      width: 120px;
      border-top: 1px solid #1e3a8a;
    }
    .signature-box .sig-name {
      font-size: 9.5px;
      font-weight: 700;
      color: #1e293b;
    }
    .signature-box .sig-role {
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .footer-note {
      text-align: center;
      font-size: 8.5px;
      color: #cbd5e1;
      margin-top: 24px;
    }

    /* === PRINT STYLES === */
    @media print {
      body { margin: 0; }
      .page-wrapper { padding: 18px 22px 24px; max-width: 100%; }
      @page {
        size: A4 portrait;
        margin: 12mm 14mm;
      }
    }

    @media screen {
      body { background: #f1f5f9; }
      .page-wrapper {
        background: #fff;
        margin: 24px auto;
        border-radius: 12px;
        box-shadow: 0 4px 32px rgba(0,0,0,0.08);
      }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">

    <!-- HEADER -->
    <div class="header">
      <div class="header-left">
        <div class="logo-wrapper">
          <img src="${logoUrl}" alt="Logo BMS" onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'font-size:18px;font-weight:900;color:#1d4ed8;\\'>BMS</div>'">
        </div>
        <div class="company-info">
          <div class="company-name">PT. Berlian Manyar Sejahtera</div>
          <div class="company-sub">Sistem Lelang Internal Aset Perusahaan</div>
        </div>
      </div>
      <div class="header-right">
        <div class="doc-title">Rekap Pemenang Lelang</div>
        <div class="doc-subtitle">Bidding Assets Internal</div>
        <div class="doc-date">Dicetak: ${formattedDate}, ${formattedTime} WIB</div>
      </div>
    </div>

    <!-- SUMMARY CARDS -->
    <div class="summary-section">
      <div class="summary-card">
        <div class="card-label">Total Item Dilelang</div>
        <div class="card-value blue">${data.length}</div>
      </div>
      <div class="summary-card">
        <div class="card-label">Item Terlelang</div>
        <div class="card-value green">${terlelangCount}</div>
      </div>
      <div class="summary-card">
        <div class="card-label">Tidak Terlelang</div>
        <div class="card-value red">${tidakTerlelangCount}</div>
      </div>
    </div>
    <div class="summary-section-2">
      <div class="summary-card">
        <div class="card-label">Total Harga Buka</div>
        <div class="card-value small blue">${totalHargaBukaFormatted}</div>
      </div>
      <div class="summary-card">
        <div class="card-label">Total Harga Terjual</div>
        <div class="card-value small green">${totalHargaTerjualFormatted}</div>
      </div>
    </div>

    <!-- TABLE TITLE -->
    <div class="section-title">Daftar Pemenang per Aset</div>

    <!-- TABLE -->
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:32px;">No.</th>
          <th style="min-width:140px;">Nama Aset</th>
          <th>Kategori</th>
          <th>Harga Buka</th>
          <th>Bid Pemenang</th>
          <th style="min-width:140px;">Data Pemenang</th>
          <th style="text-align:center;">Status</th>
          <th>Tgl. Selesai</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- FOOTER / SIGNATURE SECTION -->
    <div class="footer">
      <div class="signature-grid">
        <div class="signature-box">
          <div class="sig-title">Dibuat oleh</div>
          <div class="sig-line"></div>
          <div class="sig-name">Administrator</div>
          <div class="sig-role">Pengelola Sistem Lelang</div>
        </div>
        <div class="signature-box">
          <div class="sig-title">Diperiksa oleh</div>
          <div class="sig-line"></div>
        </div>
        <div class="signature-box">
          <div class="sig-title">Disetujui oleh</div>
          <div class="sig-line"></div>
        </div>
      </div>
      <div class="footer-note">
        Dokumen ini digenerate secara otomatis oleh Sistem Lelang Internal PT. Berlian Manyar Sejahtera.
      </div>
    </div>

  </div>
  <script>
    window.onload = function() { window.print(); }
  <\/script>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes');
    if (!printWindow) {
      this.showToast('Popup diblokir oleh browser. Harap izinkan popup untuk fitur ini.', 'error');
      return;
    }
    printWindow.document.write(printHtml);
    printWindow.document.close();

    this.showToast(`Membuka preview PDF dengan ${data.length} data pemenang...`, 'success');
  }

};
window.UiService = UiService;
