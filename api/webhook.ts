import { bold, hyperlink, quote } from '@discordjs/builders';
import { LinearClient } from '@linear/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HexColorString, MessageEmbed } from 'discord.js';
import fetch from 'node-fetch';
import { z, ZodError, ZodIssue } from 'zod';
import { HttpError } from '../lib/HttpError';
import { SCHEMA } from '../lib/schema';
import { Action, Model } from '../lib/schema/utils';

const DISCORD_WEBHOOKS_URL = 'https://discord.com/api/webhooks';

const WEBHOOK_USERNAME = 'Linear';

const LINEAR_BASE_URL = 'https://linear.app';
const LINEAR_COLOR: HexColorString = '#5E6AD2';
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

    const result = SCHEMA.parse(req.body);
    const embed = new MessageEmbed({ color: LINEAR_COLOR });
    const linear = new LinearClient({ apiKey: linearToken });

    switch (result.type) {
      case Model.ISSUE: {
        if (result.action === Action.CREATE) {
          const creator = await linear.user(result.data.creatorId);
          const identifier = parseIdentifier(result.url);

          embed
            .setTitle(`${identifier} ${result.data.title}`)
            .setURL(result.url)
            .setAuthor({
              name: 'New issue added'
            })
            .setFooter({ text: creator.name, iconURL: creator.avatarUrl })
            .setTimestamp(result.createdAt)
            .addField(
              'Team',
              hyperlink(
                result.data.team.name,
                `${LINEAR_BASE_URL}/team/${result.data.team.key}`
              ),
              true
            )
            .addField('Status', result.data.state.name, true);

          if (result.data.assignee) {
            const assignee = await linear.user(result.data.assignee.id);

            embed.addField(
              'Assignee',
              hyperlink(assignee.displayName, assignee.url),
              true
            );
          }

          if (result.data.description) {
            embed.setDescription(result.data.description);
          }
        } else if (
          result.action === Action.UPDATE &&
          result.updatedFrom?.stateId
        ) {
          const creator = await linear.user(result.data.creatorId);
          const identifier = parseIdentifier(result.url);

          embed
            .setTitle(`${identifier} ${result.data.title}`)
            .setURL(result.url)
            .setAuthor({
              name: 'Status changed'
            })
            .setColor(result.data.state.color as HexColorString)
            .setFooter({ text: creator.name, iconURL: creator.avatarUrl })
            .setTimestamp(result.createdAt)
            .setDescription(`Status: ${bold(result.data.state.name)}`);
        }

        break;
      }
      case Model.COMMENT: {
        if (result.action === Action.CREATE) {
          const user = await linear.user(result.data.userId);
          const identifier = parseIdentifier(result.url);

          embed
            .setTitle(`${identifier} ${result.data.issue.title}`)
            .setURL(result.url)
            .setAuthor({
              name: 'New comment'
            })
            .setTimestamp(result.createdAt)
            .setFooter({ text: user.name, iconURL: user.avatarUrl })
            .setDescription(result.data.body);
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
