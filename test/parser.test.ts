import { describe, expect, it } from 'vitest';
import { parseBicepResources } from '../src/parser';

const SAMPLE = `
param location string = resourceGroup().location

resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: 'web-vm'
  location: location
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_D2s_v3'
    }
  }
}

resource stg 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mystorageacct'
  location: 'canadacentral'
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}
`;

describe('parseBicepResources', () => {
  it('finds all resource declarations with type and api version', () => {
    const resources = parseBicepResources(SAMPLE);
    expect(resources).toHaveLength(2);
    expect(resources[0]).toMatchObject({
      symbolicName: 'vm',
      resourceType: 'Microsoft.Compute/virtualMachines',
      apiVersion: '2024-07-01',
      line: 4,
    });
    expect(resources[1]).toMatchObject({
      symbolicName: 'stg',
      resourceType: 'Microsoft.Storage/storageAccounts',
      apiVersion: '2023-01-01',
    });
  });

  it('extracts vmSize from hardwareProfile', () => {
    const [vm] = parseBicepResources(SAMPLE);
    expect(vm?.vmSize).toBe('Standard_D2s_v3');
    expect(vm?.location).toBeUndefined(); // location: location is a param reference, not a literal
  });

  it('extracts sku name and literal location', () => {
    const [, stg] = parseBicepResources(SAMPLE);
    expect(stg?.skuName).toBe('Standard_LRS');
    expect(stg?.location).toBe('canadacentral');
  });

  it('returns an empty array for files with no resources', () => {
    expect(parseBicepResources('param x string\noutput y string = x\n')).toEqual([]);
    expect(parseBicepResources('')).toEqual([]);
  });

  it('skips unparseable declarations instead of throwing', () => {
    const text = `resource broken 'Microsoft.Foo/bar@2024-01-01' = {\n  name: 'x'\n`;
    expect(() => parseBicepResources(text)).not.toThrow();
    expect(parseBicepResources(text)).toEqual([]);
  });

  it('handles nested braces and strings containing braces', () => {
    const text = `
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: 'my-nsg-{prod}'
  properties: {
    securityRules: [
      {
        name: 'allow-ssh'
        properties: { destinationPortRange: '22' }
      }
    ]
  }
}
`;
    const [nsg] = parseBicepResources(text);
    expect(nsg?.symbolicName).toBe('nsg');
    expect(nsg?.resourceType).toBe('Microsoft.Network/networkSecurityGroups');
  });

  it('handles conditional and looped resources', () => {
    const text = `
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = if (deployKv) {
  name: 'mykv'
  sku: { name: 'standard', family: 'A' }
}
resource vms 'Microsoft.Compute/virtualMachines@2024-07-01' = [for i in range(0, 2): {
  name: 'vm-\${i}'
  properties: { hardwareProfile: { vmSize: 'Standard_B2s' } }
}]
`;
    const resources = parseBicepResources(text);
    expect(resources).toHaveLength(2);
    expect(resources[0]?.skuName).toBe('standard');
    expect(resources[1]?.vmSize).toBe('Standard_B2s');
  });
});
