/**
 * Shared types for Bicep Cost Lens.
 * Pure data shapes — no VS Code dependency, so they stay unit-testable.
 */

/** A single `resource` declaration parsed out of a .bicep file. */
export interface BicepResource {
  /** Symbolic name, e.g. `vm` in `resource vm 'Microsoft.Compute/virtualMachines@...'`. */
  symbolicName: string;
  /** Fully qualified resource type without API version, e.g. `Microsoft.Compute/virtualMachines`. */
  resourceType: string;
  /** API version from the type string, e.g. `2024-07-01`. */
  apiVersion: string;
  /** SKU name when the body declares one, e.g. `Standard_LRS`, `B1`, `S0`. */
  skuName?: string;
  /** VM size for virtual machines, e.g. `Standard_D2s_v3` (from hardwareProfile). */
  vmSize?: string;
  /** Location when the body declares a literal, e.g. `canadacentral`. */
  location?: string;
  /** 1-based line number of the `resource` keyword. */
  line: number;
}

/** How to look a resource type up in the Azure Retail Prices API. */
export interface PricingMapping {
  /** `serviceName` filter value for the Retail Prices API. */
  serviceName: string;
  /**
   * Which parsed fields to try as `armSkuName`, in order.
   * First non-empty field wins.
   */
  skuFields: ('vmSize' | 'skuName')[];
}

/** One price record from the Azure Retail Prices API (trimmed to what we use). */
export interface PriceItem {
  armSkuName: string;
  serviceName: string;
  meterName: string;
  retailPrice: number;
  unitOfMeasure: string;
}

/** A monthly estimate derived from retail price records. Always directional. */
export interface CostEstimate {
  /** Low end of the monthly range, in the configured currency. */
  low: number;
  /** High end of the monthly range, in the configured currency. */
  high: number;
  currency: string;
  /** Human-readable basis, e.g. `730 hrs/month × unit price`. */
  basis: string;
  /** How many price records the range was built from. */
  meterCount: number;
}

/** Extension configuration, read from the `bicepCostLens.*` settings. */
export interface CostLensConfig {
  /** Azure region for price lookups, e.g. `canadacentral`. */
  region: string;
  /** ISO currency code, e.g. `CAD`. */
  currency: string;
  /** Destination for the "Get a full FinOps audit" action. */
  auditUrl: string;
}
