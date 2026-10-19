import { LinearClient } from '@linear/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MessageEmbed } from 'discord.js';
import { z, ZodError, ZodIssue } from 'zod';
import { HttpError } from '../lib/HttpError';
import { SCHEMA } from '../lib/schema';
import { Model } from '../lib/schema/utils';

const DISCORD_WEBHOOKS_URL = 'https://discord.com/api/webhooks';

const WEBHOOK_USERNAME = 'Linear';
const WEBHOOK_AVATAR_URL = 'https://ldw.screfy.com/static/linear.png';

const LINEAR_COLOR = '#5E6AD2';
const LINEAR_TRUSTED_IPS = z.enum([
	'35.231.147.226',
	'35.243.134.228',
	'34.140.253.14',
	'34.38.87.206',
	'34.134.222.122',
	'35.222.25.142'
]);

const QUERY_SCHEMA = z.object({
	webhookId: z.string(),
	webhookToken: z.string(),
	linearToken: z.string()
});

function parseIdentifier(url: string) {
	return (
		url.match(/\/issue\/([^/]+)/)?.[1] ||
		url.split('/').pop()?.split('#')[0] ||
		'Linear'
	);
}

function value(value: unknown, fallback = 'Unknown') {
	if (typeof value === 'string' && value.length > 0) return value;
	if (typeof value === 'number') return String(value);
	return fallback;
}

function humanize(value: string) {
	return value
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/_/g, ' ')
		.replace(/^./, (c) => c.toUpperCase());
}

async function getActor(body: any, linear: LinearClient) {
	if (body.actor?.name) return body.actor;
	const id = body.data?.creatorId || body.data?.userId;
	if (id) {
		try {
			return await linear.user(id);
		} catch (_) {
			// Deleted users and integration actors are still valid webhook actors.
		}
	}
	return { name: 'Linear' };
}

function formatEvent(embed: MessageEmbed, body: any, actor: any) {
	const data = body.data || body.notification || {};
	const action =
		body.action === 'remove'
			? 'deleted'
			: body.action === 'create'
			? 'created'
			: body.action === 'update'
			? 'updated'
			: humanize(body.action);
	const resource = body.type;
	const issue = data.issue || data.parentIssue;
	const title =
		data.title ||
		data.name ||
		data.project?.name ||
		data.initiative?.name ||
		data.body?.split('\n')[0] ||
		resource;

	embed
		.setTitle(
			resource === Model.ISSUE
				? `${parseIdentifier(body.url || '')} ${title}`
				: title
		)
		.setAuthor({
			name: `${resource} ${action} by ${actor.name}`,
			iconURL: actor.avatarUrl
		})
		.setFooter({ text: actor.name, iconURL: actor.avatarUrl });
	if (body.url) embed.setURL(body.url);

	if (data.description || data.body)
		embed.setDescription(value(data.description || data.body).slice(0, 4096));
	if (data.state?.name)
		embed.addFields({ name: 'Status', value: data.state.name, inline: true });
	if (data.priorityLabel || data.priority)
		embed.addFields({
			name: 'Priority',
			value: value(data.priorityLabel || data.priority),
			inline: true
		});
	if (data.assignee?.name || data.assignee?.displayName)
		embed.addFields({
			name: 'Assignee',
			value: data.assignee.name || data.assignee.displayName,
			inline: true
		});
	if (data.project?.name)
		embed.addFields({
			name: 'Project',
			value: data.project.name,
			inline: true
		});
	if (issue?.title)
		embed.addFields({ name: 'Issue', value: issue.title, inline: true });

	if (body.updatedFrom) {
		Object.keys(body.updatedFrom)
			.filter((key) => key !== 'updatedAt' && data[key] !== undefined)
			.slice(0, 6)
			.forEach((key) =>
				embed.addFields({
					name: humanize(key),
					value: value(
						typeof data[key] === 'object'
							? data[key].name || data[key].title
							: data[key],
						JSON.stringify(data[key]).slice(0, 900)
					),
					inline: true
				})
			);
	}
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
		const actor = await getActor(body, linear);
		formatEvent(embed, body, actor);

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
