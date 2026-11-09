import { logger } from '../config/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ConfigCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) {
    // Default TTL: 5 minutes
    this.defaultTtlMs = defaultTtlMs;
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  public invalidate(key: string): void {
    if (this.cache.delete(key)) {
      logger.debug(`[ConfigCache] Invalidated key: ${key}`);
    }
  }

  public invalidatePattern(prefix: string): void {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    logger.debug(`[ConfigCache] Invalidated ${count} keys matching prefix: ${prefix}`);
  }

  public clear(): void {
    this.cache.clear();
    logger.debug('[ConfigCache] All configuration cache entries cleared');
  }

  public size(): number {
    return this.cache.size;
  }
}

export const configCache = new ConfigCache();

