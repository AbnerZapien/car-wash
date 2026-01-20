import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import type { User, AuthTab } from '../core/models/user';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
}

type ApiEnvelope = any;

function apiUrl(path: string) {
  // If you ever open pages from Vite (8080), force API calls to Go (3000).
  if (window.location.port === '8080') {
    return `${window.location.protocol}//${window.location.hostname}:3000${path}`;
  }
  return path;
}

function formBody(fields: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) p.set(k, v);
  return p.toString();
}

function unwrapApi(raw: ApiEnvelope) {
  const status = raw?.Status ?? raw?.status ?? 0;
  const message = raw?.Message ?? raw?.message ?? '';
  const data = raw?.Data ?? raw?.data ?? null;
  return { status, message, data };
}

async function readJsonOrThrow(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // HTML usually starts with "<"
    const preview = text.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(`Non-JSON response from API (status ${res.status}). Preview: ${preview}`);
  }
}

export function authStore() {
  return {
    isAuthenticated: false,
    currentUser: null as User | null,
    token: null as string | null,
    loading: false,
    error: null as string | null,
    activeTab: 'login' as AuthTab,

    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    showPassword: false,

    init() {
      const saved = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
      if (saved) {
        this.isAuthenticated = saved.isAuthenticated;
        this.currentUser = saved.currentUser;
        this.token = saved.token;
      }
    },

    persist() {
      storage.set<AuthStorageData>(STORAGE_KEYS.AUTH, {
        isAuthenticated: this.isAuthenticated,
        currentUser: this.currentUser,
        token: this.token,
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
      this.loading = true;
      this.error = null;

      try {
        const res = await fetch(apiUrl('/api/v1/users/signin'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          credentials: 'include',
          body: formBody({
            username: this.email.trim(), // backend maps email -> username
            password: this.password,
          }),
        });

        const raw = await readJsonOrThrow(res);
        const { status, message, data } = unwrapApi(raw);

        if (!res.ok || status !== 200 || !data) {
          throw new Error(message || 'Login failed');
        }

        const token = data.token ?? data.Token;
        const u = data.user ?? data.User;
        if (!token || !u) throw new Error('Malformed signin response');

        this.token = token;

        const userModel: User = {
          id: String(u.id ?? ''),
          username: u.username ?? this.email.split('@')[0],
          email: this.email.trim(),
          firstName: u.firstName ?? '',
          lastName: u.lastName ?? '',
          avatarUrl: u.avatarUrl ?? '',
          createdAt: new Date(),
          role: u.username === 'admin' ? 'admin' : 'user',
        };

        this.currentUser = userModel;
        this.isAuthenticated = true;
        this.persist();

        window.location.href = userModel.role === 'admin' ? '/admin/portal' : '/dashboard';
      } catch (e: any) {
        this.error = e?.message ?? 'Invalid email or password';
      } finally {
        this.loading = false;
      }
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

      try {
        const res = await fetch(apiUrl('/api/v1/users/signup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          credentials: 'include',
          body: formBody({
            username: this.email.trim(),
            password: this.password,
            email: this.email.trim(),
            firstName: this.firstName.trim(),
            lastName: this.lastName.trim(),
            avatarUrl: '',
          }),
        });

        const raw = await readJsonOrThrow(res);
        const { status, message, data } = unwrapApi(raw);

        if (!res.ok || status !== 200 || !data) {
          throw new Error(message || 'Signup failed');
        }

        const token = data.token ?? data.Token;
        const u = data.user ?? data.User;
        if (!token || !u) throw new Error('Malformed signup response');

        this.token = token;

        const userModel: User = {
          id: String(u.id ?? ''),
          username: u.username ?? this.email.split('@')[0],
          email: this.email.trim(),
          firstName: this.firstName.trim(),
          lastName: this.lastName.trim(),
          avatarUrl: '',
          createdAt: new Date(),
          role: 'user',
        };

        this.currentUser = userModel;
        this.isAuthenticated = true;
        this.persist();

        window.location.href = '/choose-plan';
      } catch (e: any) {
        this.error = e?.message ?? 'Signup failed';
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.isAuthenticated = false;
      this.currentUser = null;
      this.token = null;
      storage.remove(STORAGE_KEYS.AUTH);
      storage.remove(STORAGE_KEYS.USER);
      window.location.href = '/login';
    },
  };
}
