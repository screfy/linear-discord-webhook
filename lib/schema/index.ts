import { z } from 'zod';
import { DATE_RESOLVABLE } from './utils';

const COMMONS = z.object({
	action: z.string(),
	createdAt: DATE_RESOLVABLE,
	url: z.string().url().optional(),
	type: z.string(),
	data: z.record(z.any()).optional().nullable(),
	notification: z.record(z.any()).optional().nullable(),
	updatedFrom: z.record(z.any()).optional().nullable(),
	actor: z.record(z.any()).optional().nullable()
});

// Linear adds webhook resources over time; validate the envelope and keep the
// resource body flexible so new fields do not silently get discarded.
export const SCHEMA = COMMONS;
