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
  result: string; // allowed|denied
  reason: string;
  rawQr: string;
};

export function historyStore() {
  return {
    // Used by template header avatar
    user: null as MeResponse | null,

    // Template expects washHistory rows with washType/location/date/time
    washHistory: [] as any[],

    error: null as string | null,
    loading: false,

    // DEV-only: demo user
    userId: 4,

    async init() {
      this.loading = true;
      this.error = null;

      try {
        const [meRes, histRes] = await Promise.all([
          fetch('/api/v1/me', { headers: { 'X-Demo-UserId': String(this.userId) } }),
          fetch('/api/v1/me/history', { headers: { 'X-Demo-UserId': String(this.userId) } }),
        ]);

        if (!meRes.ok) throw new Error('Failed to load profile');
        this.user = (await meRes.json()) as MeResponse;

        if (!histRes.ok) throw new Error('Failed to load history');
        const data = await histRes.json();
        const items: HistoryAPIItem[] = data.items || [];

        this.washHistory = items.map((e) => {
          const d = new Date(e.scannedAt);
          const dateStr = d.toISOString(); // feed into formatWashDate
          const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

          const locName = e.locationName || e.locationId || 'Unknown location';
          const locAddr = e.locationAddress || '';

          const washType =
            e.result === 'allowed'
              ? 'Access Granted'
              : `Access Denied${e.reason ? ` — ${e.reason}` : ''}`;

          return {
            id: e.id,
            washType,
            location: { name: locName, address: locAddr },
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
