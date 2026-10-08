// E2E fixture: the same shape as the workload used in the manual
// v0.1.0 QA — a VM (prices by ARM SKU name), a storage account and an
// App Service plan (whose SKUs the catalog lists under display names),
// and a site with no SKU of its own. See ../suite/extension.test.js.
param location string = 'canadacentral'

resource vms 'Microsoft.Compute/virtualMachines@2023-09-01' = {
  name: 'vm-costlens-test'
  location: location
  properties: {
    hardwareProfile: {
      vmSize: 'Standard_D2s_v3'
    }
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'costlensstorage'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'asp-costlens-test'
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
  }
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-costlens-test'
  location: location
  properties: {
    serverFarmId: plan.id
  }
}
