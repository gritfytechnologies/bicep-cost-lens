/**
 * Reads the `bicepCostLens.*` settings. Config over code, per standards.
 */
import * as vscode from 'vscode';
import type { CostLensConfig } from './types';

const NAMESPACE = 'bicepCostLens';

const DEFAULTS: CostLensConfig = {
  region: 'canadacentral',
  currency: 'CAD',
  auditUrl: 'https://gritfytechnologies.com',
};

export function getConfig(): CostLensConfig {
  const settings = vscode.workspace.getConfiguration(NAMESPACE);
  const region = settings.get<string>('region', DEFAULTS.region).trim() || DEFAULTS.region;
  const currency = (
    settings.get<string>('currency', DEFAULTS.currency).trim() || DEFAULTS.currency
  ).toUpperCase();
  const auditUrl = settings.get<string>('auditUrl', DEFAULTS.auditUrl).trim() || DEFAULTS.auditUrl;
  return { region, currency, auditUrl };
}
