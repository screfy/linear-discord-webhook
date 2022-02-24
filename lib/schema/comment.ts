import { z } from 'zod';
import { createModelSchema, Model } from './utils';

const COMMONS = z.object({
  id: z.string().uuid(),
  body: z.string(),
  userId: z.string().uuid(),
  issue: z.object({
    title: z.string()
  })
});

export const COMMENT_SCHEMA = createModelSchema(Model.COMMENT, COMMONS);
