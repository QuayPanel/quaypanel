import type { ProvisioningProvider, ServiceContext } from "./types";
import { logger } from "@/src/core/logger";

export const noopProvisioningProvider: ProvisioningProvider = {
  id: "noop",
  name: "No-op Provisioning",
  async provision(service: ServiceContext) {
    logger.info({ service }, "Noop provision");
    return {
      externalId: `noop-${service.serviceId}`,
      hostname: service.hostname ?? `svc-${service.serviceId.slice(0, 8)}`,
    };
  },
  async suspend(service: ServiceContext) {
    logger.info({ service }, "Noop suspend");
  },
  async unsuspend(service: ServiceContext) {
    logger.info({ service }, "Noop unsuspend");
  },
  async terminate(service: ServiceContext) {
    logger.info({ service }, "Noop terminate");
  },
  async getConsoleUrl() {
    return null;
  },
};
