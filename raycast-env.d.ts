/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Credential Method - Use AWS SDK credentials, a named AWS CLI profile, or environment variables inherited by Raycast. See the setup guide for SSO and credential_process. */
  "credentialMethod": "default" | "profile" | "environment",
  /** AWS Profile - AWS CLI profile name. Only used when Credential Method is set to 'Named Profile'. */
  "awsProfile": string,
  /** AWS Region - AWS region for Bedrock runtime (e.g. us-east-1, eu-central-1) */
  "awsRegion": string,
  /** Model ID - Base Bedrock model ID, without a geography prefix. The Inference Profile setting supplies the prefix. An inference profile ARN is used unchanged. */
  "modelId": string,
  /** Inference Profile - Global may process text outside your AWS Region. Choose a geography for regional routing, or None for direct invocation. Availability depends on the model and source Region; see the setup guide. */
  "inferenceProfile": "global" | "us" | "eu" | "apac" | "au" | "jp" | "ca" | "none",
  /** Max Tokens - Maximum response tokens (1–65536; your model may have a lower limit). Incomplete rewrites cannot be pasted. Increase this for long selections. */
  "maxTokens": string,
  /** Temperature - Optional value from 0 to 1. Leave empty for Claude Haiku 5.5 and other models with restricted sampling parameters. */
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

