import {
  Detail,
  showToast,
  Toast,
  getSelectedText,
  getFrontmostApplication,
} from "@raycast/api";
import { useEffect, useState, useRef } from "react";
import { getConfig } from "./config";
import { rewrite } from "./bedrock";
import { ResultView } from "./result-view";

export default function Command() {
  const preferences = getConfig();
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [frontApp, setFrontApp] = useState("");
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        const app = await getFrontmostApplication();
        setFrontApp(app.name ?? "");
      } catch {
        // ignore
      }

      let selectedText: string;
      try {
        selectedText = await getSelectedText();
      } catch {
        setError("No text selected. Select text in any app, then try again.");
        setIsLoading(false);
        return;
      }

      if (!selectedText.trim()) {
        setError("Selection is empty.");
        setIsLoading(false);
        return;
      }

      try {
        const rewritten = await rewrite({
          text: selectedText,
          tone: preferences.defaultTone,
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
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (error && !result) {
    return <Detail markdown={`**Error:** ${error}`} />;
  }

  const toneLabel =
    preferences.defaultTone.charAt(0).toUpperCase() +
    preferences.defaultTone.slice(1);

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
