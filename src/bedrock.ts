import { readFileSync } from "fs";
import { execSync } from "child_process";
import { homedir } from "os";
import { delimiter } from "path";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  fromIni,
  fromEnv,
  fromNodeProviderChain,
} from "@aws-sdk/credential-providers";
import {
  Preferences,
  SYSTEM_PROMPT,
  USER_TEMPLATE,
  TONES,
  resolveModelId,
} from "./config";

export interface RewriteOptions {
  text: string;
  tone: string;
  customInstruction?: string;
  preferences: Preferences;
}

function getCredentialProvider(preferences: Preferences) {
  switch (preferences.credentialMethod) {
    case "profile": {
      const profile = preferences.awsProfile.trim();
      if (!profile) {
        throw new Error(
          "Credential method is 'Named Profile' but no profile name is configured in extension preferences.",
        );
      }

      const home = homedir();
      const configPath = process.env.AWS_CONFIG_FILE || `${home}/.aws/config`;

      let content = "";
      try {
        content = readFileSync(configPath, "utf-8");
      } catch {
        // No config file: the profile may still exist in ~/.aws/credentials.
      }

      // The config file names the default profile "[default]" and all others
      // "[profile name]". Accept both forms for any name.
      const headers = [`[profile ${profile}]`, `[${profile}]`];
      const profileHeader = headers.find((h) => content.includes(h));
      if (!profileHeader) {
        // Not in the config file (e.g. static keys in ~/.aws/credentials).
        // fromIni() reads both files and reports a clear error if it's missing.
        return fromIni({ profile });
      }

      const idx = content.indexOf(profileHeader);
      const section = content.slice(idx + profileHeader.length);
      const nextSection = section.search(/\n\[/);
      const block =
        nextSection === -1 ? section : section.slice(0, nextSection);
      const match = block.match(/credential_process\s*=\s*(.+)/);

      // The SDK's fromIni() supports credential_process too, but Raycast runs
      // extensions with a minimal PATH, so tools installed via Homebrew or
      // ~/.local/bin are not found. Run the command ourselves with a fuller PATH.
      if (match) {
        const credCmd = match[1].trim();
        const shell = process.env.SHELL || "/bin/zsh";
        const output = execSync(credCmd, {
          encoding: "utf-8",
          timeout: 30_000,
          env: {
            HOME: home,
            SHELL: shell,
            PATH: [
              process.env.PATH,
              `${home}/.local/bin`,
              "/opt/homebrew/bin",
              "/usr/local/bin",
              "/usr/bin",
              "/bin",
              "/usr/sbin",
              "/sbin",
            ]
              .filter(Boolean)
              .join(delimiter),
            USER: process.env.USER ?? "",
            TERM: process.env.TERM ?? "xterm-256color",
          },
        }).trim();
        const creds = JSON.parse(output);
        return {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.SessionToken,
        };
      }

      return fromIni({ profile });
    }

    case "environment":
      return fromEnv();

    case "default":
    default:
      return fromNodeProviderChain();
  }
}

function buildPrompt(
  text: string,
  tone: string,
  customInstruction?: string,
): string {
  const toneInstruction = TONES[tone] || TONES["neutral"];
  const custom = customInstruction?.trim()
    ? `Additional instruction: ${customInstruction.trim()}`
    : "";
  return USER_TEMPLATE.replace("{{tone_instruction}}", toneInstruction)
    .replace("{{custom_instruction}}", custom)
    .replace("{{input_text}}", text);
}

export async function rewrite(options: RewriteOptions): Promise<string> {
  const { text, tone, customInstruction, preferences } = options;

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No text provided to rewrite.");
  }

  const maxTokens = parseInt(preferences.maxTokens, 10) || 2048;
  const temperatureRaw = preferences.temperature?.trim();
  const temperature = temperatureRaw ? Number(temperatureRaw) : undefined;
  if (temperature !== undefined && !Number.isFinite(temperature)) {
    throw new Error(
      `Invalid temperature "${temperatureRaw}" in extension preferences.`,
    );
  }
  const targetModelId = resolveModelId(preferences);

  const credentials = getCredentialProvider(preferences);

  const client = new BedrockRuntimeClient({
    region: preferences.awsRegion,
    credentials,
  });

  const prompt = buildPrompt(trimmed, tone, customInstruction);

  const command = new ConverseCommand({
    modelId: targetModelId,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: {
      maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
    },
    // Rewriting needs no reasoning. Claude models that think by default can
    // spend the whole token budget thinking and return no text.
    ...(targetModelId.includes("anthropic.")
      ? { additionalModelRequestFields: { thinking: { type: "disabled" } } }
      : {}),
  });

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 30_000);
  let response;
  try {
    response = await client.send(command, {
      abortSignal: abortController.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const content = response.output?.message?.content;
  if (!content || content.length === 0) {
    throw new Error("Bedrock returned no content.");
  }

  const parts: string[] = [];
  for (const block of content) {
    if (block.text?.trim()) {
      parts.push(block.text.trim());
    }
  }

  const result = parts.join("\n").trim();
  if (!result) {
    if (response.stopReason === "max_tokens") {
      throw new Error(
        `Model hit the ${maxTokens}-token limit before producing text. Increase Max Tokens in extension preferences.`,
      );
    }
    throw new Error(
      `Bedrock returned empty text (stop reason: ${response.stopReason ?? "unknown"}).`,
    );
  }

  const ratio = result.length / Math.max(trimmed.length, 1);
  if (ratio > 3.0) {
    throw new Error(
      "Model output is unexpectedly long — it may have added commentary. Try again.",
    );
  }
  if (ratio < 0.1) {
    throw new Error(
      "Model output is unexpectedly short — the rewrite may be incomplete. Try again.",
    );
  }

  return result;
}
