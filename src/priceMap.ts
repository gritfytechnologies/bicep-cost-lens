/**
 * Maps Bicep resource types to Azure Retail Prices API lookups.
 *
 * Only resource types whose `serviceName` is known-good are listed here.
 * Anything unmapped degrades gracefully to a "no pricing data" message —
 * we would rather show nothing than a wrong number.
 */
import type { BicepResource, PricingMapping } from './types';

const MAPPINGS: Record<string, PricingMapping> = {
  'Microsoft.Compute/virtualMachines': {
    serviceName: 'Virtual Machines',
    skuFields: ['vmSize', 'skuName'],
  },
  'Microsoft.Storage/storageAccounts': {
    serviceName: 'Storage',
    skuFields: ['skuName'],
  },
  'Microsoft.Sql/servers/databases': {
    serviceName: 'SQL Database',
    skuFields: ['skuName'],
  },
  'Microsoft.Web/serverfarms': {
    serviceName: 'Azure App Service',
    skuFields: ['skuName'],
  },
  'Microsoft.ContainerService/managedClusters': {
    serviceName: 'Azure Kubernetes Service',
    skuFields: ['skuName'],
  },
  'Microsoft.DocumentDB/databaseAccounts': {
    serviceName: 'Azure Cosmos DB',
    skuFields: ['skuName'],
  },
  'Microsoft.Cache/redis': {
    serviceName: 'Azure Cache for Redis',
    skuFields: ['skuName'],
  },
  'Microsoft.Network/applicationGateways': {
    serviceName: 'Application Gateway',
    skuFields: ['skuName'],
  },
  'Microsoft.Network/loadBalancers': {
    serviceName: 'Load Balancer',
    skuFields: ['skuName'],
  },
  'Microsoft.ContainerRegistry/registries': {
    serviceName: 'Container Registry',
    skuFields: ['skuName'],
  },
  'Microsoft.KeyVault/vaults': {
    serviceName: 'Key Vault',
    skuFields: ['skuName'],
  },
  'Microsoft.Web/sites': {
    // Consumption Functions / Logic Apps style usage is metered, not SKU-priced;
    // App Service plans carry the cost. Map to Functions for serverless plans.
    serviceName: 'Functions',
    skuFields: ['skuName'],
  },
};

/**
 * Find the pricing mapping for a resource type.
 * Matches exact types and falls back to parent-type prefixes
 * (e.g. `Microsoft.Sql/servers/databases` also covers nested variants).
 */
export function findPricingMapping(resourceType: string): PricingMapping | undefined {
  const direct = MAPPINGS[resourceType];
  if (direct) {
    return direct;
  }
  // Longest-prefix fallback for child resource types.
  let best: PricingMapping | undefined;
  let bestLen = -1;
  for (const [key, mapping] of Object.entries(MAPPINGS)) {
    if (resourceType.startsWith(key) && key.length > bestLen) {
      best = mapping;
      bestLen = key.length;
    }
  }
  return best;
}

/**
 * Pick the SKU value to query for, given a mapping and a parsed resource.
 * Returns undefined when the resource declares no usable SKU.
 */
export function resolveSkuName(
  resource: BicepResource,
  mapping: PricingMapping,
): string | undefined {
  for (const field of mapping.skuFields) {
    const value = resource[field];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Name variants of a declared SKU to try against the Retail Prices catalog.
 *
 * Bicep declares ARM SKU names (`Standard_LRS`), but the catalog often
 * lists the same SKU under a display name with spaces (`Standard LRS`) —
 * storage accounts are one example (verified against the live catalog in
 * `canadacentral`: `skuName eq 'Standard LRS'` returns records where the
 * underscore form returns none). Returns the trimmed SKU, then its
 * underscores-to-spaces and spaces-to-underscores forms, deduplicated.
 */
export function skuCandidates(skuName: string): string[] {
  const base = skuName.trim();
  if (!base) {
    return [];
  }
  const variants = [base, base.replace(/_/g, ' '), base.replace(/ +/g, '_')];
  // App Service Premium v3 SKUs are catalogued with a space before the
  // version suffix ('P1 v3'), while Bicep declares 'P1v3' — try both shapes.
  const spaced = base.replace(/^([A-Za-z]+\d+)(v\d+)$/, '$1 $2');
  const despaced = base.replace(/\s+(v\d+)$/, '$1');
  variants.push(spaced, despaced);
  return [...new Set(variants)];
}
