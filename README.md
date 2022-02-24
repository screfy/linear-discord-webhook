![linear-discord-webhook](.github/banner.png)

# Linear Discord Webhook

Receive Linear updates directly in your Discord channels.

This application is powered by [Vercel][vercel] serverless functions utilizing Linear's webhooks to get notified when somebody creates a new issue, comment on the issue, or change the status of the issue.

It's inspired by the official [Slack integration][slack] for Linear.

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
