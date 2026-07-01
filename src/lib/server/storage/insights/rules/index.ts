import type { StorageInsightRule } from '../types.js';
import { MissingFromMediaServerRule } from './MissingFromMediaServerRule.js';
import { UntrackedByCinephageRule } from './UntrackedByCinephageRule.js';
import { UnplayedRule } from './UnplayedRule.js';
import { DuplicateItemsRule } from './DuplicateItemsRule.js';

// Rules are added in Tasks 5-12. Each new rule is appended to this array.
export const ALL_RULES: StorageInsightRule[] = [
	new MissingFromMediaServerRule(),
	new UntrackedByCinephageRule(),
	new UnplayedRule(),
	new DuplicateItemsRule()
];
