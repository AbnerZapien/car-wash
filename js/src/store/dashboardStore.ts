import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import { SEED_SUBSCRIPTIONS, SEED_WASH_HISTORY } from '../adapters/mockData';
import type { User } from '../core/models/user';
import type { Subscription } from '../core/models/subscription';
import type { WashHistory } from '../core/models/wash';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
}

type MeResponse = {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
};

export function dashboardStore() {
  return {
    accessCode: '' as string,
    accessQrUrl: '' as string,

    user: null as User | null,
    subscription: null as Subscription | null,
    washHistory: [] as WashHistory[],
    loading: true,

    get planName(): string {
      return this.subscription?.plan?.name || 'No Plan';
    },

    get isActive(): boolean {
      return this.subscription?.status === 'active';
    },

    get recentWashes(): WashHistory[] {
      return this.washHistory.slice(0, 3);
    },

    get nextBillingFormatted(): string {
      if (!this.subscription?.nextBillingDate) return '';
      const date = new Date(this.subscription.nextBillingDate);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    },

    get welcomeMessage(): string {
      if (!this.user) return 'Welcome back!';
      return `Welcome back, ${this.user.firstName}!`;
    },

    async init() {
      await this.loadDashboard();
    },

    async loadDashboard() {
      this.loading = true;

      // 1) Load from local storage (fast UI)
      const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
      if (auth?.currentUser) {
        this.user = auth.currentUser;
      }

      // 2) Refresh from backend (authoritative numeric id)
      try {
        const res = await fetch('/api/v1/me', { credentials: 'include' });
        if (res.ok) {
          const me = (await res.json()) as MeResponse;

          // Normalize into UI User shape
          this.user = {
            id: String(me.id),
            username: me.username,
            email: me.email,
            firstName: me.firstName,
            lastName: me.lastName,
            avatarUrl: me.avatarUrl,
            createdAt: new Date(),
            role: 'user',
          } as any;

          // Keep local storage in sync (so other pages that still read it behave)
          if (auth) {
            auth.currentUser = this.user;
            storage.set(STORAGE_KEYS.AUTH, auth);
          }
        }
      } catch {
        // ignore; fall back to storage user
      }

      // 3) Generate access QR from numeric id
      this.generateAccessCode();

      // 4) Keep existing mock subscription/history for now
      if (this.user?.id) {
        this.subscription =
          SEED_SUBSCRIPTIONS.find((s: any) => String(s.userId) === String(this.user?.id)) ||
          SEED_SUBSCRIPTIONS[0];

        this.washHistory = SEED_WASH_HISTORY.filter((w: any) => String(w.userId) === String(this.user?.id));
      }

      this.loading = false;
    },

    generateAccessCode() {
      const uid = parseInt(String(this.user?.id || ''), 10);
      if (!uid) {
        this.accessCode = '';
        this.accessQrUrl = '';
        return;
      }
      this.accessCode = `CARWASH-${uid}-${Date.now()}`;
      this.accessQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.accessCode)}`;
    },

    manageSubscription() {
      window.location.assign('/account');
    },

    viewHistory() {
      window.location.assign('/history');
    },

    printCode() {
      window.print();
    },

    formatWashDate(date: Date): string {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
  };
}
