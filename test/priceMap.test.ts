import { describe, expect, it } from 'vitest';
import { findPricingMapping, resolveSkuName } from '../src/priceMap';
import type { BicepResource } from '../src/types';

function resource(overrides: Partial<BicepResource>): BicepResource {
  return {
    symbolicName: 'r',
    resourceType: 'Microsoft.Compute/virtualMachines',
    apiVersion: '2024-07-01',
    line: 1,
    ...overrides,
  };
}

describe('findPricingMapping', () => {
  it('maps known resource types to Retail Prices service names', () => {
    expect(findPricingMapping('Microsoft.Compute/virtualMachines')?.serviceName).toBe(
      'Virtual Machines',
    );
    expect(findPricingMapping('Microsoft.Storage/storageAccounts')?.serviceName).toBe('Storage');
    expect(findPricingMapping('Microsoft.Web/serverfarms')?.serviceName).toBe('Azure App Service');
  });

  it('returns undefined for unmapped types', () => {
    expect(findPricingMapping('Microsoft.MadeUp/widgets')).toBeUndefined();
  });

  it('falls back to parent-type prefixes for child resources', () => {
    expect(findPricingMapping('Microsoft.Sql/servers/databases/backupLongTermRetentionPolicies')?.serviceName).toBe(
      'SQL Database',
    );
  });
});

describe('resolveSkuName', () => {
  it('prefers vmSize for virtual machines', () => {
    const mapping = findPricingMapping('Microsoft.Compute/virtualMachines');
    if (mapping === undefined) {
      throw new Error('expected a mapping for Microsoft.Compute/virtualMachines');
    }
    expect(resolveSkuName(resource({ vmSize: 'Standard_D2s_v3', skuName: 'other' }), mapping)).toBe(
      'Standard_D2s_v3',
    );
  });

  it('falls back to skuName when vmSize is absent', () => {
    const mapping = findPricingMapping('Microsoft.Storage/storageAccounts');
    if (mapping === undefined) {
      throw new Error('expected a mapping for Microsoft.Storage/storageAccounts');
    }
    expect(resolveSkuName(resource({ skuName: 'Standard_LRS' }), mapping)).toBe('Standard_LRS');
  });

  it('returns undefined when no SKU field is present', () => {
    const mapping = findPricingMapping('Microsoft.Storage/storageAccounts');
    if (mapping === undefined) {
      throw new Error('expected a mapping for Microsoft.Storage/storageAccounts');
    }
    expect(resolveSkuName(resource({}), mapping)).toBeUndefined();
  });
});
