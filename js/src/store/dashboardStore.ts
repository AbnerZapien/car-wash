import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import type { User } from '../core/models/user';
import type { WashHistory } from '../core/models/wash';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: any | null;
  token: string | null;
}

function authHeaders() {
  const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
  const token = auth?.token;
  return token ? { 'X-Session-Token': token } : {};
}

type MeResponse = {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
};

type SubResponse = {
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

type HistoryItem = {
  id: string;
  userId: number;
  locationId: string;
  locationName: string;
  locationAddress: string;
  scannedAt: string;
  result: string; // allowed|denied
  reason: string;
  rawQr: string;
};

export function dashboardStore() {
  return {
    accessCode: '' as string,
    accessQrUrl: '' as string,

    user: null as User | null,
    subscription: null as any, // keep template getters working
    washHistory: [] as WashHistory[],
    loading: true,
    error: null as string | null,

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
      this.error = null;

      try {
        const headers = authHeaders();

        // 1) User
        const meRes = await fetch('/api/v1/me', { headers, credentials: 'include' });
        if (meRes.status === 401) throw new Error('Please sign in again.');
        if (!meRes.ok) throw new Error('Failed to load profile');
        const me = (await meRes.json()) as MeResponse;

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

        // 2) Subscription (for the plan card)
        const subRes = await fetch('/api/v1/me/subscription', { headers, credentials: 'include' });
        const subJson = (await subRes.json()) as SubResponse;

        // Login guard: force plan selection if no active subscription
        if (!subJson || !subJson.active || !subJson.subscription) {
          window.location.href = '/choose-plan';
          return;
        }

        if (subJson.subscription) {
          let features: string[] = [];
          try {
            features = JSON.parse(subJson.subscription.featuresJson || '[]');
          } catch {}

          this.subscription = {
            status: subJson.subscription.status,
            nextBillingDate: subJson.subscription.nextBillingDate,
            plan: {
              name: subJson.subscription.planName,
              price: (subJson.subscription.priceCents || 0) / 100,
              features,
            },
          };
        } else {
          this.subscription = null;
        }

        // 3) History -> map wash_events into the old WashHistory UI shape
        const histRes = await fetch('/api/v1/me/history', { headers, credentials: 'include' });
        if (!histRes.ok) throw new Error('Failed to load history');
        const data = await histRes.json();
        const items: HistoryItem[] = data.items || [];

        this.washHistory = items.map((e) => {
          const d = new Date(e.scannedAt);
          const washType =
            e.result === 'allowed'
              ? 'Access Granted'
              : `Access Denied${e.reason ? ` — ${e.reason}` : ''}`;

          return {
            id: e.id,
            washType,
            location: {
              name: e.locationName || e.locationId || 'Unknown location',
              address: e.locationAddress || '',
            },
            date: d,
            time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          } as any;
        });

        // 4) QR for dashboard card
        this.generateAccessCode();
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load dashboard';
      } finally {
        this.loading = false;
      }
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
