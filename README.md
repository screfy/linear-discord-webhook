![linear-discord-webhook](.github/banner.png)

# Linear Discord Webhook

Receive Linear updates directly in your Discord channels.

This application is powered by [Vercel][vercel] serverless functions utilizing Linear's webhooks to mirror Linear activity in Discord. It supports issues, comments, projects, project updates (the Linear pulse), cycles, reactions, documents, initiatives, customers, attachments and labels.

It's inspired by the official [Slack integration][slack] for Linear.

When configuring the Linear webhook, enable the resources you want to mirror:
`Issue`, `Comment`, `IssueLabel`, `Reaction`, `Project`, `ProjectUpdate`,
`Cycle`, `Document`, `Initiative`, `InitiativeUpdate`, `Customer`,
`CustomerRequest` and `Attachment`. The endpoint also accepts Linear inbox
notification events such as mentions, reactions, assignments and status changes.

## Installation

Visit [ldw.screfy.com][ui] and follow the instructions.

## How does it work?

It's really simple. We form a URL that contains the Discord webhook ID, Discord webhook token, Linear API token, and use that as our Linear webhook URL, e.g.:

```
https://ldw.screfy.com/api/webhook?webhookId=123&webhookToken=abc&linearToken=lin_api_abcdefgh
```

[vercel]: https://vercel.com
[slack]: https://linear.app/docs/slack
[ui]: https://ldw.screfy.com
