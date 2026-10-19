import {
  ActionPanel,
  Action,
  Detail,
  Clipboard,
  closeMainWindow,
  popToRoot,
} from "@raycast/api";
import { Preferences, formatModelName } from "./config";

interface ResultViewProps {
  result: string;
  title: string;
  subtitle?: string;
  isLoading: boolean;
  frontApp: string;
  preferences: Preferences;
}

export function ResultView({
  result,
  title,
  subtitle,
  isLoading,
  frontApp,
  preferences,
}: ResultViewProps) {
  return (
    <Detail
      isLoading={isLoading}
      markdown={result ? `**${title}**\n\n${result}` : undefined}
      metadata={
        result ? (
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Model"
              text={formatModelName(preferences)}
            />
            {subtitle ? (
              <Detail.Metadata.Label title="Instruction" text={subtitle} />
            ) : null}
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        result ? (
          <ActionPanel>
            <Action
              title={frontApp ? `Paste to ${frontApp}` : "Paste"}
              onAction={async () => {
                await Clipboard.copy(result);
                await closeMainWindow();
                await Clipboard.paste(result);
                popToRoot();
              }}
            />
            <Action.CopyToClipboard
              title="Copy to Clipboard"
              content={result}
              onCopy={() => {
                closeMainWindow();
                popToRoot();
              }}
            />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
