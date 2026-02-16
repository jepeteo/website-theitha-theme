type CacheEntry<TValue> = {
  value: TValue;
  expiresAtEpochMs: number;
};

export class TtlCache<TValue> {
  private readonly store = new Map<string, CacheEntry<TValue>>();

  get(key: string): TValue | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAtEpochMs) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: TValue, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAtEpochMs: Date.now() + ttlSeconds * 1000
    });
  }
}
