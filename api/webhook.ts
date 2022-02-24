import { LinearClient } from '@linear/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MessageEmbed } from 'discord.js';
import fetch from 'node-fetch';
import { z, ZodError, ZodIssue } from 'zod';
import { HttpError } from '../lib/HttpError';
import { SCHEMA } from '../lib/schema';
import { Action, Model } from '../lib/schema/utils';

const DISCORD_WEBHOOKS_URL = 'https://discord.com/api/webhooks';

const WEBHOOK_USERNAME = 'Linear';
const WEBHOOK_AVATAR_URL = 'https://ldw.screfy.com/static/linear.png';

const LINEAR_BASE_URL = 'https://linear.app';
const LINEAR_COLOR = '#5E6AD2';
const LINEAR_TRUSTED_IPS = z.enum(['35.231.147.226', '35.243.134.228']);

const QUERY_SCHEMA = z.object({
  webhookId: z.string(),
  webhookToken: z.string(),
  linearToken: z.string()
});

function parseIdentifier(url: string) {
  return url.split('/')[5].split('#')[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const forwardedFor = req.headers['x-vercel-forwarded-for'] || '';

    // Allow only `POST` method:
    if (req.method !== 'POST') {
      throw new HttpError(`Method ${req.method} is not allowed.`, 405);
    }

    // Make sure a request is truly sent from Linear:
    const { success } = LINEAR_TRUSTED_IPS.safeParse(forwardedFor);

    if (process.env.NODE_ENV !== 'development' && !success) {
      throw new HttpError(
        `Request from IP address ${forwardedFor} is not allowed.`,
        403
      );
    }

    const { webhookId, webhookToken, linearToken } = QUERY_SCHEMA.parse(
      req.query
    );
    const result = SCHEMA.safeParse(req.body);

    // Prevent Linear repeating requests for not supported resources:
    if (!result.success) {
      return res.send({
        success: true,
        message: 'Event skipped.',
        error: null
      });
    }

    const body = result.data;
    const embed = new MessageEmbed({
      color: LINEAR_COLOR,
      timestamp: body.createdAt
    });
    const linear = new LinearClient({ apiKey: linearToken });

    switch (body.type) {
      case Model.ISSUE: {
        if (body.action === Action.CREATE) {
          const creator = await linear.user(body.data.creatorId);
          const identifier = parseIdentifier(body.url);
          const teamUrl = `${LINEAR_BASE_URL}/team/${body.data.team.key}`;

          embed
            .setTitle(`${identifier} ${body.data.title}`)
            .setURL(body.url)
            .setAuthor('New issue added')
            .setFooter(creator.name, creator.avatarUrl)
            .addField('Team', `[${body.data.team.name}](${teamUrl})`, true)
            .addField('Status', body.data.state.name, true);

          if (body.data.assignee) {
            const assignee = await linear.user(body.data.assignee.id);

            embed.addField(
              'Assignee',
              `[${assignee.displayName}](${assignee.url})`,
              true
            );
          }

          if (body.data.description) {
            embed.setDescription(body.data.description);
          }
        } else if (body.action === Action.UPDATE && body.updatedFrom?.stateId) {
          const creator = await linear.user(body.data.creatorId);
          const identifier = parseIdentifier(body.url);

          embed
            .setTitle(`${identifier} ${body.data.title}`)
            .setURL(body.url)
            .setAuthor('Status changed')
            .setColor(body.data.state.color)
            .setFooter(creator.name, creator.avatarUrl)
            .setDescription(`Status: **${body.data.state.name}**`);
        }

        break;
      }
      case Model.COMMENT: {
        if (body.action === Action.CREATE) {
          const user = await linear.user(body.data.userId);
          const identifier = parseIdentifier(body.url);

          embed
            .setTitle(`${identifier} ${body.data.issue.title}`)
            .setURL(body.url)
            .setAuthor('New comment')
            .setFooter(user.name, user.avatarUrl)
            .setDescription(body.data.body);
        }

        break;
      }
    }

    const webhookUrl = `${DISCORD_WEBHOOKS_URL}/${webhookId}/${webhookToken}`;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: WEBHOOK_USERNAME,
        avatar_url: WEBHOOK_AVATAR_URL,
        embeds: [embed.toJSON()]
      })
    });

    res.send({ success: true, message: 'OK', error: null });
  } catch (e) {
    let error: string | ZodIssue[] = 'Something went wrong.';
    let statusCode = 500;

    if (e instanceof HttpError) {
      error = e.message;
      statusCode = e.statusCode;
    } else if (e instanceof ZodError) {
      error = e.issues;
      statusCode = 400;
    }

    res.status(statusCode).send({ success: false, message: null, error });
  }
}
