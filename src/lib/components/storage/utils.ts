export { formatBytes } from '$lib/utils/format.js';

export type InsightSeverity = 'info' | 'warning' | 'critical';

/**
 * Badge classes for each severity, matching the codebase convention:
 * border-X/30 bg-X/10 text-X (fixed in Phase 1 from the broken bg-X/15 pattern).
 */
export function severityBadgeClass(severity: InsightSeverity): string {
	switch (severity) {
		case 'critical':
			return 'border-error/30 bg-error/10 text-error';
		case 'warning':
			return 'border-warning/30 bg-warning/10 text-warning';
		default:
			return 'border-info/30 bg-info/10 text-info';
	}
}

/**
 * Dismiss an insight via the API. Returns true on success.
 */
export async function dismissInsight(insightId: string): Promise<boolean> {
	try {
		const response = await fetch(`/api/storage/insights/${insightId}/dismiss`, {
			method: 'POST'
		});
		const data = await response.json();
		return data.success === true;
	} catch {
		return false;
	}
}

/**
 * Map an insight type to a human-readable category label.
 */
export function insightTypeLabel(type: string): string {
	const labels: Record<string, string> = {
		'orphaned-files': 'Orphaned Files',
		'missing-from-media-server': 'Sync Gap',
		'untracked-by-cinephage': 'Untracked',
		unplayed: 'Unplayed',
		'duplicate-items': 'Duplicates',
		'quality-below-cutoff': 'Quality',
		'broken-paths': 'Broken Paths',
		'health-issues': 'Health'
	};
	return labels[type] ?? type;
}
