export type ServiceContext = {
  serviceId: string;
  orderId?: string;
  hostname?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  provisionConfig?: Record<string, unknown>;
  client?: {
    email: string;
    name: string;
  };
};

export type ProvisionResult = {
  externalId?: string;
  hostname?: string;
};

export interface ProvisioningProvider {
  id: string;
  name: string;
  provision(service: ServiceContext): Promise<ProvisionResult | void>;
  suspend(service: ServiceContext): Promise<void>;
  unsuspend(service: ServiceContext): Promise<void>;
  terminate(service: ServiceContext): Promise<void>;
}
