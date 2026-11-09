import { AsyncLocalStorage } from 'async_hooks';

export interface ITenantContext {
  tenantId: string;
  businessId: string;
  plan: string;
  role?: string;
  userId?: string;
  correlationId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<ITenantContext>();

export class TenantContextService {
  /**
   * Run an asynchronous operation within a bound tenant context
   */
  static run<T>(context: ITenantContext, fn: () => Promise<T> | T): Promise<T> | T {
    return asyncLocalStorage.run(context, fn);
  }

  /**
   * Retrieve the active tenant context for the current execution fiber
   */
  static getContext(): ITenantContext | undefined {
    return asyncLocalStorage.getStore();
  }

  /**
   * Retrieve the current tenant ID or throw if out of context
   */
  static getRequiredTenantId(): string {
    const store = asyncLocalStorage.getStore();
    if (!store || !store.tenantId) {
      throw new Error('Tenant context missing: Execution attempted outside active tenant scope');
    }
    return store.tenantId;
  }

  /**
   * Check if current execution fiber is in an enterprise tier context
   */
  static isEnterprise(): boolean {
    const store = asyncLocalStorage.getStore();
    return store?.plan?.toUpperCase() === 'ENTERPRISE';
  }
}

