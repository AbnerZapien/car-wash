import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import { SEED_SUBSCRIPTIONS } from '../adapters/mockData';
import type { User } from '../core/models/user';
import type { Subscription } from '../core/models/subscription';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
}

export function accountStore() {
  return {
    user: null as User | null,
    subscription: null as Subscription | null,

    firstName: '',
    lastName: '',
    email: '',
    avatarPreview: '' as string,

    error: null as string | null,
    saved: false,

    init() {
      const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
      if (auth?.currentUser) this.user = auth.currentUser;

      const uid = this.user?.id || '1';
      this.subscription =
        SEED_SUBSCRIPTIONS.find((s) => s.userId === uid) || SEED_SUBSCRIPTIONS[0];

      this.resetForm();
    },

    resetForm() {
      this.saved = false;
      this.error = null;
      this.avatarPreview = '';

      this.firstName = this.user?.firstName || '';
      this.lastName = this.user?.lastName || '';
      this.email = this.user?.email || '';
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

    saveProfile() {
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

      if (!this.user) {
        // If user isn't set, create a minimal one for dev flow.
        this.user = {
          id: '1',
          username: 'user',
          email: this.email,
          firstName: this.firstName,
          lastName: this.lastName,
          avatarUrl: this.avatarPreview || '',
          createdAt: new Date(),
          role: 'user',
        };
      } else {
        this.user.firstName = this.firstName;
        this.user.lastName = this.lastName;
        this.user.email = this.email;
        if (this.avatarPreview) this.user.avatarUrl = this.avatarPreview;
      }

      // Persist back to AUTH storage (same pattern other stores read)
      const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH) || {
        isAuthenticated: true,
        currentUser: null,
        token: 'dev-token',
      };

      auth.currentUser = this.user;
      auth.isAuthenticated = true;

      storage.set(STORAGE_KEYS.AUTH, auth);

      this.saved = true;
      setTimeout(() => (this.saved = false), 2000);
    },
  };
}
