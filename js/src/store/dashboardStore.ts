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

export function dashboardStore() {
  return {
  
  manageSubscription() {
      console.log("Navigate to subscription management");
      window.location.assign("/account");
    },

    viewHistory() {
      console.log("Navigate to full history");
      window.location.assign("/history");
    },


    user: null as User | null,
    subscription: null as Subscription | null,
    washHistory: [] as WashHistory[],
    loading: true,

    get planName(): string {
      return this.subscription?.plan.name || 'No Plan';
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
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    },

    get welcomeMessage(): string {
      if (!this.user) return 'Welcome back!';
      return `Welcome back, ${this.user.firstName}!`;
    },

    init() {
      this.loadDashboard();
    },

    loadDashboard() {
      this.loading = true;

      const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
      if (auth?.currentUser) {
        this.user = auth.currentUser;

        this.subscription =
          SEED_SUBSCRIPTIONS.find((s) => s.userId === this.user?.id) ||
          SEED_SUBSCRIPTIONS[0];

        this.washHistory = SEED_WASH_HISTORY.filter(
          (w) => w.userId === this.user?.id
        );
      }

      this.loading = false;
    },

    manageSubscription() {
      console.log("Navigate to subscription management");
      window.location.assign("/account");
    },
    viewHistory() {
      console.log("Navigate to full history");
      window.location.assign("/history");
    },

    printCode() {
      window.print();
    },

    formatWashDate(date: Date): string {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    },
  };
}
