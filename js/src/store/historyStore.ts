import { storage } from '../adapters/localStorage';
import { STORAGE_KEYS } from '../ports/storage';
import { SEED_WASH_HISTORY } from '../adapters/mockData';
import type { User } from '../core/models/user';
import type { WashHistory } from '../core/models/wash';

interface AuthStorageData {
  isAuthenticated: boolean;
  currentUser: User | null;
  token: string | null;
}

export function historyStore() {
  return {
    user: null as User | null,
    washHistory: [] as WashHistory[],

    init() {
      const auth = storage.get<AuthStorageData>(STORAGE_KEYS.AUTH);
      if (auth?.currentUser) this.user = auth.currentUser;

      const uid = this.user?.id || '1';
      this.washHistory = SEED_WASH_HISTORY
        .filter((w) => w.userId === uid)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    formatWashDate(date: Date): string {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
  };
}
