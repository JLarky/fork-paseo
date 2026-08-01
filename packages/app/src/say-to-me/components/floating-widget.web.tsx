import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useHostRuntimeSnapshot, useHosts, type ActiveConnection } from "@/runtime/host-runtime";
import type { HostProfile } from "@/types/host-connection";
import { paseoVoiceSessionId } from "@/say-to-me/voice-session-id";
import {
  loadVoiceWidget,
  voiceWidgetLoadMode,
  VOICE_WIDGET_PROXY_PATH,
} from "@/say-to-me/voice-widget-loader";
import {
  handleVoiceWidgetEvent,
  VOICE_WIDGET_COLLAPSE_EVENT,
  VOICE_WIDGET_ERROR_EVENT,
  VOICE_WIDGET_PERMISSION_EVENT,
  VOICE_WIDGET_PLAYBACK_EVENT,
  VOICE_WIDGET_USAGE_PROMPT_EVENT,
} from "@/say-to-me/voice-widget-events";
import { buildVoiceWidgetAttributes } from "@/say-to-me/voice-widget-adapter";

function daemonApiBaseUrl(
  activeConnection: ActiveConnection | null | undefined,
  host: HostProfile | undefined,
): string | null {
  const activeEndpoint = activeConnection?.type === "directTcp" ? activeConnection.endpoint : null;
  const directConnection = host?.connections.find(
    (connection) =>
      connection.type === "directTcp" &&
      (!activeEndpoint || connection.endpoint === activeEndpoint),
  );
  if (!directConnection || directConnection.type !== "directTcp") return null;
  return `${directConnection.useTls ? "https" : "http"}://${directConnection.endpoint}`;
}

function isLocalhost(): boolean {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function requireVoiceWidgetElement(): HTMLElement {
  const element = document.createElement("say-to-me-voice-widget");
  return element;
}

export function SayToMeInlineWidget({
  serverId,
  agentId,
  onInsertUsagePrompt,
}: {
  serverId: string;
  agentId: string;
  onInsertUsagePrompt: (prompt: string) => void;
}) {
  const runtime = useHostRuntimeSnapshot(serverId);
  const host = useHosts().find((entry) => entry.serverId === serverId);
  const apiBaseUrl = daemonApiBaseUrl(runtime?.activeConnection, host);
  const sessionId = useMemo(() => paseoVoiceSessionId(agentId), [agentId]);
  const [error, setError] = useState<string | null>(null);
  const [permissionIssue, setPermissionIssue] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    if (!apiBaseUrl || !sessionId) return undefined;
    const mode = voiceWidgetLoadMode({
      isLocalhost: isLocalhost(),
      isDevelopment: process.env.NODE_ENV !== "production",
    });
    let disposed = false;
    let element: HTMLElement | null = null;

    const mount = async () => {
      try {
        await loadVoiceWidget(mode, `${apiBaseUrl}${VOICE_WIDGET_PROXY_PATH}`);
        if (disposed) return;
        await customElements.whenDefined("say-to-me-voice-widget");
        if (disposed) return;
        element = requireVoiceWidgetElement();
        const attributes = buildVoiceWidgetAttributes({
          sessionId,
          apiBaseUrl,
          canAutoplay: false,
        });
        for (const [name, value] of Object.entries(attributes)) {
          element.setAttribute(name, value);
        }
        element.addEventListener(VOICE_WIDGET_COLLAPSE_EVENT, onWidgetEvent);
        element.addEventListener(VOICE_WIDGET_ERROR_EVENT, onWidgetEvent);
        element.addEventListener(VOICE_WIDGET_USAGE_PROMPT_EVENT, onWidgetEvent);
        element.addEventListener(VOICE_WIDGET_PERMISSION_EVENT, onWidgetEvent);
        element.addEventListener(VOICE_WIDGET_PLAYBACK_EVENT, onWidgetEvent);
        document.getElementById(`paseo-say-to-me-${serverId}-${agentId}`)?.append(element);
      } catch (cause) {
        if (!disposed) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load Say To Me voice widget",
          );
        }
      }
    };

    function onWidgetEvent(event: Event): void {
      handleVoiceWidgetEvent(event, {
        onInsertUsagePrompt,
        onCollapseChange: () => undefined,
        onError: setError,
        onPermissionIssue: (reason, noteId) => setPermissionIssue(`${reason} (${noteId})`),
        onPlaybackChange: setPlayingId,
      });
    }

    void mount();
    return () => {
      disposed = true;
      if (element) {
        element.removeEventListener(VOICE_WIDGET_COLLAPSE_EVENT, onWidgetEvent);
        element.removeEventListener(VOICE_WIDGET_ERROR_EVENT, onWidgetEvent);
        element.removeEventListener(VOICE_WIDGET_USAGE_PROMPT_EVENT, onWidgetEvent);
        element.removeEventListener(VOICE_WIDGET_PERMISSION_EVENT, onWidgetEvent);
        element.removeEventListener(VOICE_WIDGET_PLAYBACK_EVENT, onWidgetEvent);
        element.remove();
      }
    };
  }, [agentId, apiBaseUrl, onInsertUsagePrompt, serverId, sessionId]);

  if (!sessionId || !apiBaseUrl) return null;
  return (
    <View style={styles.container}>
      <View nativeID={`paseo-say-to-me-${serverId}-${agentId}`} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {permissionIssue ? (
        <Text style={styles.error}>Playback permission: {permissionIssue}</Text>
      ) : null}
      {playingId ? <Text style={styles.playing}>Playing voice note {playingId}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    width: "100%",
    paddingHorizontal: theme.spacing[3],
    paddingTop: theme.spacing[2],
  },
  error: {
    color: theme.colors.statusDanger,
    fontSize: 12,
    paddingTop: theme.spacing[1],
  },
  playing: {
    color: theme.colors.secondary,
    fontSize: 12,
    paddingTop: theme.spacing[1],
  },
}));
