import React from "react";
import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export interface ParkPageParams {
  environmentId?: string | string[];
  threadId?: string | string[];
  title?: string | string[];
  project?: string | string[];
  cwd?: string | string[];
  branch?: string | string[];
}

export interface ParkPageMetadata {
  environmentId: string;
  threadId: string;
  title: string;
  project: string;
  cwd: string;
  branch: string;
}

function firstParam(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

export function readParkPageMetadata(params: ParkPageParams): ParkPageMetadata {
  return {
    environmentId: firstParam(params.environmentId),
    threadId: firstParam(params.threadId),
    title: firstParam(params.title),
    project: firstParam(params.project),
    cwd: firstParam(params.cwd),
    branch: firstParam(params.branch),
  };
}

export function parkReturnHref(
  metadata: Pick<ParkPageMetadata, "environmentId" | "threadId">,
): string | null {
  if (!metadata.environmentId || !metadata.threadId) return null;
  return `/h/${encodeURIComponent(metadata.environmentId)}/agent/${encodeURIComponent(metadata.threadId)}`;
}

const FIELDS = [
  ["Title", "title"],
  ["Project", "project"],
  ["Directory", "cwd"],
  ["Branch", "branch"],
] as const;

export function ParkPage({ params }: { params: ParkPageParams }) {
  const metadata = readParkPageMetadata(params);
  const returnHref = parkReturnHref(metadata);
  const fields = FIELDS.filter(([, key]) => metadata[key]).map(([label, key]) => (
    <View key={key} style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {metadata[key]}
      </Text>
    </View>
  ));

  return (
    <View style={styles.page}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          session parked
        </Text>
        {fields.length > 0 ? (
          <View accessibilityRole="list" style={styles.metadata}>
            {fields}
          </View>
        ) : null}
        {returnHref ? (
          <Link href={returnHref as Href} asChild>
            <Pressable accessibilityRole="link" style={styles.returnLink}>
              <Text style={styles.returnText}>Return to session</Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface0,
    color: theme.colors.foreground,
    paddingHorizontal: theme.spacing[6],
  },
  content: {
    width: "100%",
    maxWidth: 576,
    alignItems: "center",
    gap: theme.spacing[6],
  },
  title: {
    color: theme.colors.foreground,
    fontSize: 18,
    fontWeight: "600",
  },
  metadata: {
    width: "100%",
    gap: theme.spacing[2],
  },
  field: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing[3],
  },
  label: {
    width: 80,
    flexShrink: 0,
    color: theme.colors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  value: {
    flex: 1,
    color: theme.colors.foregroundMuted,
    fontSize: 14,
  },
  returnLink: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: theme.spacing[3],
  },
  returnText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
}));
