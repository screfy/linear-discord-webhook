import { z } from 'zod';
import { ISSUE_SCHEMA } from './issue';
import { Action, DATE_RESOLVABLE } from './utils';

const COMMONS = z.object({
  action: z.enum([Action.CREATE, Action.UPDATE, Action.REMOVE]),
  createdAt: DATE_RESOLVABLE,
  url: z.string().url()
});

export const SCHEMA = COMMONS.and(ISSUE_SCHEMA);
