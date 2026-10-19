# Recast

Rewrite selected text using Claude on Amazon Bedrock — right from Raycast. Pick a tone preset, provide a custom instruction, or just hit Enter to polish what you've written.

## Features

- **Rewrite Selected Text** — instantly rewrite with your default tone
- **Rewrite with Tone** — choose from Professional, Friendly, Concise, Polished, or Neutral
- **Rewrite with Custom Instruction** — pass any rewrite instruction (e.g. "make it shorter", "add bullet points", "translate to Spanish")
- Language-aware: rewrites in the same language as the input unless you explicitly ask to translate
- Paste the result back into the original app with one keystroke

## Prerequisites

You need an AWS account with access to Amazon Bedrock.

### Model access

Serverless models on Amazon Bedrock are enabled by default. Anthropic models need a one-time use case form before first use: open a Claude model in the [Amazon Bedrock console](https://console.aws.amazon.com/bedrock) playground and submit the form. If your organization already did this, you can skip it.

### Inference profiles

Recast calls the model through a [cross-Region inference profile](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html). The default is **Global**, which routes requests to any supported commercial Region. Pick a geography (US, EU, APAC, Australia, Japan) to keep requests within that area, or **None** to call the model in your configured Region directly. Not every model supports every option: Claude Haiku 5.5, for example, is only available through inference profiles.

### AWS credentials

Recast supports three credential methods (configurable in extension preferences):

| Method | When to use |
|--------|-------------|
| **Default Chain** (recommended) | Works automatically if you already have credentials configured via env vars, `~/.aws/credentials`, AWS SSO, or an instance role. |
| **Named Profile** | Use a specific profile from `~/.aws/config`. Supports `credential_process`, SSO, and static credentials. |
| **Environment Variables** | Reads `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` directly. |

## Configuration

Open Raycast Settings → Extensions → Recast to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| Credential Method | How to obtain AWS credentials | Default Chain |
| AWS Profile | Named profile (only used with "Named Profile" method) | — |
| AWS Region | Bedrock runtime region | us-east-1 |
| Model ID | Base Bedrock model ID, without a profile prefix | anthropic.claude-haiku-5-5 |
| Inference Profile | Global, US, EU, APAC, Australia, Japan, or None (in-Region) | Global |
| Max Tokens | Maximum response length | 512 |
| Temperature | Optional. Creativity (0.0 = deterministic, 1.0 = creative). Leave empty for Claude Haiku 5.5, which rejects it. | — |
| Default Tone | Tone used by "Rewrite Selected Text" | Friendly |

## Usage

1. Select text in any application
2. Open Raycast and run one of the Recast commands
3. Wait for the rewrite to appear
4. Press Enter to paste it back, or ⌘C to copy to clipboard

## Development

Requires Node.js 22 or later and [Raycast](https://www.raycast.com).

```sh
git clone https://github.com/msakowski/recast.git
cd recast
npm install
npm run dev        # build, load into Raycast, and rebuild on change
```

Other scripts: `npm run build` (production build), `npm run lint` (ESLint and Prettier), `npm run typecheck`.

> [!NOTE]
> Recast stays on `@raycast/api` 1.x on purpose. With 2.x, `ray build` moves dependencies shared by several commands into a generated `node_modules/` and breaks the AWS SDK v3: every command fails with `Cannot read properties of undefined (reading 'for')` or `Package subpath './transport' is not defined by "exports"`. See [raycast/extensions#32553](https://github.com/raycast/extensions/issues/32553). Upgrade once that is fixed.

## License

[MIT](LICENSE)

Recast is an independent project and is not affiliated with or endorsed by Amazon Web Services or Anthropic.
