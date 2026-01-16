export interface IStorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

export const STORAGE_KEYS = {
  AUTH: 'carwash_auth',
  USER: 'carwash_user',
  SUBSCRIPTION: 'carwash_subscription',
  WASH_HISTORY: 'carwash_wash_history',
} as const;
