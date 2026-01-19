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

type HistoryAPIItem = {
  id: string;
  userId: number;
  locationId: string;
  locationName: string;
  locationAddress: string;
  scannedAt: string;
  result: string;
  reason: string;
  rawQr: string;
};

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

export function historyStore() {
  return {
    user: null as MeResponse | null,
    washHistory: [] as any[],
    error: null as string | null,
    loading: false,

    async init() {
      this.loading = true;
      this.error = null;

      try {
        const headers = authHeaders();

        const [meRes, histRes] = await Promise.all([
          fetch('/api/v1/me', { headers, credentials: 'include' }),
          fetch('/api/v1/me/history', { headers, credentials: 'include' }),
        ]);

        if (meRes.status === 401) throw new Error('Please sign in again.');
        if (!meRes.ok) throw new Error('Failed to load profile');

        this.user = (await meRes.json()) as MeResponse;

        if (histRes.status === 401) throw new Error('Please sign in again.');
        if (!histRes.ok) throw new Error('Failed to load history');

        const data = await histRes.json();
        const items: HistoryAPIItem[] = data.items || [];

        this.washHistory = items.map((e) => {
          const d = new Date(e.scannedAt);
          const dateStr = d.toISOString();
          const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

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
            date: dateStr,
            time: timeStr,
          };
        });
      } catch (e: any) {
        this.error = e?.message ?? 'Failed to load history';
        this.washHistory = [];
      } finally {
        this.loading = false;
      }
    },

    formatWashDate(dateIso: string): string {
      const d = new Date(dateIso);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
  };
}
