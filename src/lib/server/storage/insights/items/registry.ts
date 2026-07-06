import type { InsightType } from '../types.js';
import type { InsightItemResolver } from './types.js';
import { duplicateItemsResolver } from './duplicate-items.js';
import { qualityBelowCutoffResolver } from './quality-below-cutoff.js';

/**
 * Registry of per-type item resolvers.
 * Each insight type maps to one resolver function.
 */
const REGISTRY: Partial<Record<InsightType, InsightItemResolver>> = {};

export function registerInsightItemResolver(
	type: InsightType,
	resolver: InsightItemResolver
): void {
	REGISTRY[type] = resolver;
}

export function getInsightItemResolver(type: InsightType): InsightItemResolver {
	const resolver = REGISTRY[type];
	if (!resolver) {
		throw new Error(`No item resolver registered for insight type: ${type}`);
	}
	return resolver;
}

registerInsightItemResolver('duplicate-items', duplicateItemsResolver);
registerInsightItemResolver('quality-below-cutoff', qualityBelowCutoffResolver);
