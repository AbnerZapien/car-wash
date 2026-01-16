import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import { SEED_SUBSCRIPTIONS } from '../adapters/mockData';
import type { User } from '../core/models/user';
import type { Subscription } from '../core/models/subscription';
import type { CodeTimer } from '../core/models/qrCode';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
}

export function qrCodeStore() {
  return {
    code: '',
    user: null as User | null,
    subscription: null as Subscription | null,
    timer: { minutes: 5, seconds: 0, expired: false } as CodeTimer,
    intervalId: null as ReturnType<typeof setInterval> | null,

    get formattedMinutes(): string {
      return String(this.timer.minutes).padStart(2, '0');
    },

    get formattedSeconds(): string {
      return String(this.timer.seconds).padStart(2, '0');
    },

    get planName(): string {
      return this.subscription?.plan.name || 'No Plan';
    },

    get userName(): string {
      if (!this.user) return '';
      return `${this.user.firstName} ${this.user.lastName}`;
    },

    get qrCodeUrl(): string {
      return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.code)}`;
    },

    init() {
      const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
      if (auth?.currentUser) {
        this.user = auth.currentUser;
        this.subscription =
          SEED_SUBSCRIPTIONS.find((s) => s.userId === this.user?.id) ||
          SEED_SUBSCRIPTIONS[0];
      }

      this.generateCode();
      this.startTimer();
    },

    generateCode() {
      const timestamp = Date.now();
      const userId = this.user?.id || 'guest';
      this.code = `CARWASH-${userId}-${timestamp}`;
    },

    refreshCode() {
      this.stopTimer();
      this.timer = { minutes: 5, seconds: 0, expired: false };
      this.generateCode();
      this.startTimer();
    },

    startTimer() {
      this.intervalId = setInterval(() => {
        if (this.timer.seconds > 0) {
          this.timer.seconds--;
        } else if (this.timer.minutes > 0) {
          this.timer.minutes--;
          this.timer.seconds = 59;
        } else {
          this.timer.expired = true;
          this.stopTimer();
        }
      }, 1000);
    },

    stopTimer() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    },

    destroy() {
      this.stopTimer();
    },
  };
}
