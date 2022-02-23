import { z } from 'zod';
import { createModelSchema, Model } from './utils';

const COMMONS = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  creatorId: z.string().uuid(),
  assignee: z
    .object({
      id: z.string().uuid()
    })
    .optional(),
  state: z.object({
    name: z.string()
  }),
  team: z.object({
    name: z.string(),
    key: z.string()
  })
});

export const ISSUE_SCHEMA = createModelSchema(Model.ISSUE, COMMONS);
