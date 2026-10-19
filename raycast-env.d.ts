/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Credential Method - How to obtain AWS credentials. 'Profile' uses a named AWS CLI profile. 'Environment' uses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars. 'Default' uses the AWS SDK default credential chain (env → profile → SSO → instance role). */
  "credentialMethod": "default" | "profile" | "environment",
  /** AWS Profile - AWS CLI profile name. Only used when Credential Method is set to 'Named Profile'. */
  "awsProfile": string,
  /** AWS Region - AWS region for Bedrock runtime (e.g. us-east-1, eu-central-1) */
  "awsRegion": string,
  /** Model ID - Base Bedrock model ID, without an inference profile prefix (e.g. anthropic.claude-haiku-5-5). The prefix comes from the Inference Profile setting. */
  "modelId": string,
  /** Inference Profile - Cross-Region inference profile used to call the model. Global routes to any supported commercial Region; a geography keeps requests within that area. 'None' invokes the model in your AWS Region directly (not supported by Claude Haiku 5.5). */
  "inferenceProfile": "global" | "us" | "eu" | "apac" | "au" | "jp" | "none",
  /** Max Tokens - Maximum tokens for the Bedrock response */
  "maxTokens": string,
  /** Temperature - Optional model temperature (0.0 = deterministic, 1.0 = creative). Leave empty for the model default. Claude Haiku 5.5 does not accept a temperature; leave it empty for that model. */
  "temperature": string,
  /** Default Tone - Tone to use when no tone is specified */
  "defaultTone": "friendly" | "professional" | "concise" | "polished" | "neutral"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `rewrite-selected` command */
  export type RewriteSelected = ExtensionPreferences & {}
  /** Preferences accessible in the `rewrite-with-tone` command */
  export type RewriteWithTone = ExtensionPreferences & {}
  /** Preferences accessible in the `rewrite-with-instruction` command */
  export type RewriteWithInstruction = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `rewrite-selected` command */
  export type RewriteSelected = {}
  /** Arguments passed to the `rewrite-with-tone` command */
  export type RewriteWithTone = {}
  /** Arguments passed to the `rewrite-with-instruction` command */
  export type RewriteWithInstruction = {
  /** Custom instruction */
  "instruction": string
}
}

