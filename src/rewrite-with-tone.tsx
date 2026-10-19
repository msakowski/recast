import {
  ActionPanel,
  Action,
  Detail,
  List,
  getSelectedText,
  showToast,
  Toast,
  getFrontmostApplication,
} from "@raycast/api";
import { useState } from "react";
import { getConfig, TONES } from "./config";
import { rewrite } from "./bedrock";
import { ResultView } from "./result-view";

export default function Command() {
  const preferences = getConfig();
  const [result, setResult] = useState<string | null>(null);
  const [activeTone, setActiveTone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frontApp, setFrontApp] = useState("");

  async function handleToneSelection(tone: string) {
    let selectedText: string;
    try {
      selectedText = await getSelectedText();
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "No text selected",
      });
      return;
    }

    if (!selectedText.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Selection is empty",
      });
      return;
    }

    setResult(null);
    setError(null);
    setActiveTone(tone);
    setIsLoading(true);

    try {
      const app = await getFrontmostApplication();
      setFrontApp(app.name ?? "");
    } catch {
      // ignore
    }

    try {
      const rewritten = await rewrite({
        text: selectedText,
        tone,
        preferences,
      });
      setResult(rewritten);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await showToast({
        style: Toast.Style.Failure,
        title: "Rewrite Failed",
        message,
      });
      setError(message);
      setActiveTone(null);
    } finally {
      setIsLoading(false);
    }
  }

  if (activeTone && (isLoading || result)) {
    const toneLabel = activeTone.charAt(0).toUpperCase() + activeTone.slice(1);

    if (error && !result) {
      return <Detail markdown={`**Error:** ${error}`} />;
    }

    return (
      <ResultView
        result={result ?? ""}
        title={`Tone: ${toneLabel}`}
        isLoading={isLoading}
        frontApp={frontApp}
        preferences={preferences}
      />
    );
  }

  return (
    <List>
      {Object.entries(TONES).map(([key, description]) => (
        <List.Item
          key={key}
          title={key.charAt(0).toUpperCase() + key.slice(1)}
          subtitle={description.split(".")[0]}
          actions={
            <ActionPanel>
              <Action
                title="Rewrite with This Tone"
                onAction={() => handleToneSelection(key)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
