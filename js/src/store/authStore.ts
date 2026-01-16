import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import { SEED_USERS } from '../adapters/mockData';
import type { User, AuthTab } from '../core/models/user';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
}

export function authStore() {
  return {
    isAuthenticated: false,
    currentUser: null as User | null,
    loading: false,
    error: null as string | null,
    activeTab: 'login' as AuthTab,

    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    showPassword: false,

    get displayName(): string {
      if (!this.currentUser) return '';
      return `${this.currentUser.firstName} ${this.currentUser.lastName}`;
    },

    get initials(): string {
      if (!this.currentUser) return '';
      return `${this.currentUser.firstName[0]}${this.currentUser.lastName[0]}`.toUpperCase();
    },

    init() {
      console.log('authStore init called');
      const saved = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
      if (saved) {
        this.isAuthenticated = saved.isAuthenticated;
        this.currentUser = saved.currentUser;
      }
    },

    persist() {
      storage.set<AuthStorageData>(STORAGE_KEYS.AUTH, {
        isAuthenticated: this.isAuthenticated,
        currentUser: this.currentUser,
        token: null,
      });
    },

    switchTab(tab: AuthTab) {
      this.activeTab = tab;
      this.error = null;
      this.email = '';
      this.password = '';
      this.confirmPassword = '';
      this.firstName = '';
      this.lastName = '';
    },

    togglePassword() {
      this.showPassword = !this.showPassword;
    },

    async login() {
      console.log('Login called with:', this.email, this.password);
      this.loading = true;
      this.error = null;

      await new Promise((r) => setTimeout(r, 500));

      const user = SEED_USERS.find(
        (u) => u.email === this.email && u.password === this.password
      );

      console.log('User found:', user);

      if (user) {
        const { password: _, ...userData } = user;
        this.currentUser = userData;
        this.isAuthenticated = true;
        this.persist();
        const redirectUrl = userData.role === 'admin' ? '/admin/portal' : '/dashboard';
        console.log('Redirecting to', redirectUrl);
        window.location.href = redirectUrl;
      } else {
        this.error = 'Invalid email or password';
        console.log('Login failed - invalid credentials');
      }

      this.loading = false;
    },

    async register() {
      this.loading = true;
      this.error = null;

      if (this.password !== this.confirmPassword) {
        this.error = 'Passwords do not match';
        this.loading = false;
        return;
      }

      if (this.password.length < 6) {
        this.error = 'Password must be at least 6 characters';
        this.loading = false;
        return;
      }

      const exists = SEED_USERS.find((u) => u.email === this.email);
      if (exists) {
        this.error = 'Email already registered';
        this.loading = false;
        return;
      }

      await new Promise((r) => setTimeout(r, 500));

      const newUser: User = {
        id: `user-${Date.now()}`,
        username: this.email.split('@')[0],
        email: this.email,
        firstName: this.firstName,
        lastName: this.lastName,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.email}`,
        createdAt: new Date(),
        role: 'user',
      };

      this.currentUser = newUser;
      this.isAuthenticated = true;
      this.persist();
      window.location.href = '/dashboard';
      this.loading = false;
    },

    logout() {
      this.isAuthenticated = false;
      this.currentUser = null;
      storage.remove(STORAGE_KEYS.AUTH);
      storage.remove(STORAGE_KEYS.USER);
      window.location.href = '/login';
    },
  };
}
