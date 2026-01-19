import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';

type MeResponse = {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
};

type SubscriptionResponse = {
  active: boolean;
  subscription: null | {
    planId: string;
    planName: string;
    priceCents: number;
    featuresJson: string;
    status: string;
    nextBillingDate: string;
  };
};

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: any | null;
  token: string | null;
}

export function accountStore() {
  return {
    // API-backed data
    me: null as MeResponse | null,
    subscription: null as SubscriptionResponse['subscription'] | null,

    // Form state
    firstName: '',
    lastName: '',
    email: '',
    avatarPreview: '' as string,

    error: null as string | null,
    saved: false,
    loading: false,

    // DEV-only: match your backend demo header
    demoUserId: 4,

    async init() {
      this.loading = true;
      this.error = null;
      this.saved = false;

      try {
        // Load profile + subscription from API
        const [meRes, subRes] = await Promise.all([
          fetch('/api/v1/me', { headers: { 'X-Demo-UserId': String(this.demoUserId) } }),
          fetch('/api/v1/me/subscription', { headers: { 'X-Demo-UserId': String(this.demoUserId) } }),
        ]);

        if (!meRes.ok) throw new Error('Failed to load profile');
        const me = (await meRes.json()) as MeResponse;
        this.me = me;

        const sub = (await subRes.json()) as SubscriptionResponse;
        this.subscription = sub.subscription;

        // Fill form
        this.firstName = me.firstName || '';
        this.lastName = me.lastName || '';
        this.email = me.email || '';
        this.avatarPreview = '';
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load account';
      } finally {
        this.loading = false;
      }
    },

    resetForm() {
      this.saved = false;
      this.error = null;
      this.avatarPreview = '';

      this.firstName = this.me?.firstName || '';
      this.lastName = this.me?.lastName || '';
      this.email = this.me?.email || '';
    },

    onAvatarChange(e: Event) {
      this.saved = false;
      this.error = null;

      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    },

    async saveProfile() {
      this.saved = false;
      this.error = null;

      if (!this.email || !this.email.includes('@')) {
        this.error = 'Please enter a valid email.';
        return;
      }
      if (!this.firstName || !this.lastName) {
        this.error = 'Please enter your first and last name.';
        return;
      }

      try {
        const res = await fetch('/api/v1/me', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Demo-UserId': String(this.demoUserId),
          },
          body: JSON.stringify({
            email: this.email,
            firstName: this.firstName,
            lastName: this.lastName,
            avatarUrl: this.avatarPreview || undefined,
          }),
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || 'Save failed');
        }

        const me = (await res.json()) as MeResponse;
        this.me = me;
        this.avatarPreview = '';
        this.saved = true;

        // Keep local auth storage updated for existing UI pieces
        const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
        if (auth?.currentUser) {
          auth.currentUser.email = me.email;
          auth.currentUser.firstName = me.firstName;
          auth.currentUser.lastName = me.lastName;
          auth.currentUser.avatarUrl = me.avatarUrl;
          storage.set(STORAGE_KEYS.AUTH, auth);
        }

        setTimeout(() => (this.saved = false), 2000);
      } catch (e: any) {
        this.error = e?.message ?? 'Save failed';
      }
    },
  };
}
