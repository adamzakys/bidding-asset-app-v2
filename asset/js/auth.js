/**
 * Authentication Service using Google Identity Services SDK
 */
const AuthService = {
  authMode: 'INTERNAL', // 'INTERNAL' or 'EXTERNAL' (loaded dynamically)
  registrationClosed: false, // true or false (loaded dynamically)

  // Configurable Google Client ID - USER can replace this in Google Console
  CLIENT_ID: '64029822268-p3b84r963uq0b0p4t1tibiommkq1kuo5.apps.googleusercontent.com',

  // Configurable Microsoft Client ID
  MS_CLIENT_ID: 'cbf2760f-e6c3-45b7-8982-222306d31b2f',
  // Configurable Microsoft Directory (tenant) ID
  MS_TENANT_ID: '5540bb28-9fec-4e8f-a639-a4c2bc699bcf',
  msalInstance: null,

  // Cache for profile data decoded from Google or Microsoft Sign-In (used for registration if unregistered)
  tempGoogleProfile: null,

  /**
   * Decodes Google ID Token (JWT) on the client side
   * @param {string} token 
   */
  decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const jsonPayload = decodeURIComponent(
        atob(padded)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT Token:', error);
      return null;
    }
  },

  /**
   * Initializes MSAL.js for Microsoft Authentication
   */
  initMicrosoftSignIn() {
    if (typeof msal === 'undefined') {
      console.error('MSAL SDK not loaded.');
      return;
    }

    const msalConfig = {
      auth: {
        clientId: this.MS_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${this.MS_TENANT_ID || 'common'}`,
        redirectUri: window.location.origin + window.location.pathname
      },
      cache: {
        cacheLocation: 'localStorage', // More persistent cache on mobile devices
        storeAuthStateInCookie: true // Fallback for Safari iOS and in-app webviews
      }
    };

    try {
      this.msalInstance = new msal.PublicClientApplication(msalConfig);

      // Handle redirect promise if returning from loginRedirect
      this.msalInstance.handleRedirectPromise()
        .then((response) => {
          if (response) {
            this.handleMsResponse(response);
          }
        })
        .catch((error) => {
          console.error('Error handling MSAL redirect:', error);
          UiService.showToast('Gagal memproses login Microsoft: ' + error.message, 'error');
        });
    } catch (error) {
      console.error('Error initializing MSAL:', error);
    }
  },

  /**
   * Triggers the Microsoft Sign-In flow (Redirect for mobile, Popup for desktop)
   */
  async handleMsSignIn() {
    if (!this.msalInstance) {
      this.initMicrosoftSignIn();
    }
    if (!this.msalInstance) {
      UiService.showToast('SDK Microsoft belum siap. Silakan periksa koneksi internet Anda atau coba beberapa saat lagi.', 'error');
      return;
    }

    const loginRequest = {
      scopes: ['user.read'],
      prompt: 'select_account'
    };

    // Detect if mobile browser to use redirect flow (avoiding popup blocking)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
      if (isMobile) {
        UiService.showGoogleLoading(true, 'Mengalihkan ke Microsoft...');
        await this.msalInstance.loginRedirect(loginRequest);
      } else {
        UiService.showGoogleLoading(true, 'Menghubungkan Microsoft...');
        const response = await this.msalInstance.loginPopup(loginRequest);
        await this.handleMsResponse(response);
      }
    } catch (error) {
      console.error('Error in handleMsSignIn:', error);
      UiService.showGoogleLoading(false);
      // Ignore user cancelled error to avoid annoying toasts
      if (error.name !== 'BrowserAuthError' && !error.message.includes('user_cancelled')) {
        UiService.showToast(error.message || 'Gagal masuk dengan Microsoft.', 'error');
      }
    }
  },

  /**
   * Shared handler for MSAL authentication response
   */
  async handleMsResponse(response) {
    if (!response || !response.account) {
      return;
    }

    try {
      UiService.showGoogleLoading(true, 'Memproses akun Microsoft...');
      const account = response.account;

      // Extract details
      const email = account.username;
      const name = account.name || email.split('@')[0];
      const domain = email.split('@')[1] ? email.split('@')[1].toLowerCase() : '';

      // Strict internal domain validation
      if (this.authMode === 'INTERNAL' && domain !== 'bms.jiipe.co.id') {
        UiService.showToast('Akses Ditolak: Hanya email dengan domain @bms.jiipe.co.id yang diizinkan pada lelang internal.', 'error');
        return;
      }

      // Use ui-avatars.com to get a nice corporate initial avatar
      const initialAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2596be&color=fff&bold=true`;

      this.tempGoogleProfile = {
        email: email,
        nama_lengkap: name,
        picture: initialAvatar
      };

      // Check registration on GAS backend
      const checkResult = await ApiService.login(email);

      if (checkResult.success) {
        // User registered and active
        const userSession = {
          ...checkResult.data,
          picture: initialAvatar
        };

        this.saveSession(userSession);
        UiService.showToast(`Selamat datang kembali, ${userSession.nama_lengkap}!`, 'success');
        UiService.showDashboard(userSession);
      } else {
        // Login failed or connection failed
        if (checkResult.isRegistered === false) {
          // Not registered -> Show registration form
          UiService.showToast('Akun Microsoft Anda belum terdaftar. Silakan lengkapi pendaftaran.', 'info');
          UiService.showRegistrationForm(this.tempGoogleProfile);
        } else if (checkResult.isRegistered === true) {
          // Registered but blocked
          UiService.showToast(checkResult.message || 'Akses ditolak.', 'error');
        } else {
          UiService.showToast(checkResult.message || 'Gagal memeriksa status pendaftaran.', 'error');
        }
      }
    } catch (error) {
      console.error('Error in handleMsResponse:', error);
      UiService.showToast(error.message || 'Gagal memproses data akun Microsoft.', 'error');
    } finally {
      UiService.showGoogleLoading(false);
    }
  },

  /**
   * Initializes Google Identity Services
   */
  initGoogleSignIn() {
    if (typeof google === 'undefined') {
      console.error('Google Identity Services SDK not loaded.');
      return;
    }

    google.accounts.id.initialize({
      client_id: this.CLIENT_ID,
      callback: this.handleCredentialResponse.bind(this)
    });

    google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      {
        theme: 'filled_blue',
        size: 'large',
        width: '100%',
        shape: 'rectangular',
        logo_alignment: 'left'
      }
    );

    // Prompt Google One Tap optionally
    google.accounts.id.prompt();
  },

  /**
   * Callback handle after user selects Google Account
   */
  async handleCredentialResponse(response) {
    try {
      UiService.showGoogleLoading(true, 'Menghubungkan...');

      if (!response || !response.credential) {
        throw new Error('Credential response dari Google kosong.');
      }

      const credential = response.credential;
      const profile = this.decodeJwt(credential);

      if (!profile) {
        throw new Error('Gagal membaca data profil Google (JWT).');
      }

      const email = profile.email;

      // Google Login is only allowed in EXTERNAL mode
      if (this.authMode === 'INTERNAL') {
        UiService.showToast('Gagal: Login Google hanya diperbolehkan pada lelang eksternal.', 'error');
        return;
      }

      this.tempGoogleProfile = {
        email: email,
        nama_lengkap: profile.name,
        picture: profile.picture
      };

      // Check with GAS backend
      const checkResult = await ApiService.login(email);

      if (checkResult.success) {
        // User is registered and active
        const userSession = {
          ...checkResult.data,
          picture: profile.picture // Use high quality avatar from Google
        };

        this.saveSession(userSession);
        UiService.showToast(`Selamat datang kembali, ${userSession.nama_lengkap}!`, 'success');
        UiService.showDashboard(userSession);
      } else {
        // Login failed or connection failed
        if (checkResult.isRegistered === false) {
          // Not registered -> Show registration form
          UiService.showToast('Akun Anda belum terdaftar. Silakan lengkapi pendaftaran.', 'info');
          UiService.showRegistrationForm(this.tempGoogleProfile);
        } else if (checkResult.isRegistered === true) {
          // Registered but blocked
          UiService.showToast(checkResult.message || 'Akses ditolak.', 'error');
        } else {
          // Connection failed / Server error (isRegistered is undefined)
          UiService.showToast(checkResult.message || 'Gagal memeriksa status pendaftaran.', 'error');
        }
      }
    } catch (error) {
      console.error('Error in handleCredentialResponse:', error);
      UiService.showToast(error.message || 'Terjadi kesalahan sistem saat login.', 'error');
    } finally {
      UiService.showGoogleLoading(false);
    }
  },

  /**
   * Performs registration submission
   * @param {string} department 
   * @param {string} whatsapp 
   */
  async registerUser(registrationData) {
    if (this.registrationClosed) {
      UiService.showToast('Pendaftaran ditutup: Admin telah menonaktifkan pendaftaran saat ini.', 'error');
      return;
    }

    if (!this.tempGoogleProfile) {
      UiService.showToast('Data profil tidak ditemukan. Silakan login kembali.', 'error');
      this.logout();
      return;
    }

    UiService.showButtonLoading('btn-submit-register', true, 'Memproses Pendaftaran...');

    const payload = {
      email: this.tempGoogleProfile.email,
      nama_lengkap: registrationData.nama_lengkap,
      nip_bms: registrationData.nip_bms,
      no_wa: registrationData.no_wa,
      nik: registrationData.nik,
      fileKepegawaian: registrationData.fileKepegawaian,
      fileKesanggupan: registrationData.fileKesanggupan,
      fileKtp: registrationData.fileKtp
    };

    const result = await ApiService.register(payload);

    if (result.success) {
      UiService.showToast('Pendaftaran berhasil! Akun Anda telah aktif.', 'success');

      // Auto login after successful registration
      try {
        const loginCheck = await ApiService.login(payload.email);
        if (loginCheck.success) {
          const userSession = {
            ...loginCheck.data,
            picture: this.tempGoogleProfile ? this.tempGoogleProfile.picture : null
          };
          this.saveSession(userSession);
          UiService.showDashboard(userSession);
        } else {
          this.logout();
        }
      } catch (e) {
        this.logout();
      }
      this.tempGoogleProfile = null; // Clear cache
    } else {
      UiService.showToast(result.message || 'Pendaftaran gagal.', 'error');
    }

    UiService.showButtonLoading('btn-submit-register', false, 'Daftar');
  },

  /**
   * Save user session in LocalStorage
   * @param {object} userData 
   */
  saveSession(userData) {
    localStorage.setItem('currentUser', JSON.stringify(userData));
  },

  /**
   * Get user session from LocalStorage
   */
  getCurrentUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Clear session and log out
   */
  logout() {
    localStorage.removeItem('currentUser');
    sessionStorage.clear(); // Clear MSAL session cache
    this.tempGoogleProfile = null;

    // Revoke Google session
    if (typeof google !== 'undefined') {
      google.accounts.id.disableAutoSelect();
    }

    UiService.showLogin();
    UiService.showToast('Anda telah keluar dari sistem.', 'info');
  }
};
