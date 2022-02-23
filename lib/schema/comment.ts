import { z } from 'zod';
import { createModelSchema, Model } from './utils';

const COMMONS = z.object({
  id: z.string().uuid(),
  body: z.string(),
  issue: z.object({
    title: z.string()
  }),
  user: z.object({
    name: z.string()
  })
});

export const COMMENT_SCHEMA = createModelSchema(Model.COMMENT, COMMONS);
