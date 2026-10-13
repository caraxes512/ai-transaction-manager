import { type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BudgetStatus } from "@/api/types";
import { monthLabel, shiftMonth } from "@/lib/format";
import { useTheme } from "@/lib/theme";

export function Screen({ children, onRefresh, refreshing = false, scroll = true }: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; scroll?: boolean;
}) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
          {children}
        </ScrollView>
      ) : <View style={[s.screen, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[s.title, { color: t.text }]}>{children}</Text>;
}

export function Body({ children, style, muted, bold }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; bold?: boolean }) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.muted : t.text, fontSize: 15, fontWeight: bold ? "600" : "400" }, style]}>{children}</Text>;
}

export function Small({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={{ color: color ?? t.muted, fontSize: 12 }}>{children}</Text>;
}

export function Card({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[s.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {(title || right) && (
        <View style={s.cardHead}>
          {title ? <Text accessibilityRole="header" style={[s.cardTitle, { color: t.text }]}>{title}</Text> : <View />}
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function Button({ title, onPress, variant = "primary", loading, disabled, accessibilityLabel }: {
  title: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean; disabled?: boolean; accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.primary : variant === "danger" ? t.badBg : variant === "secondary" ? t.card : "transparent";
  const fg = variant === "primary" ? t.primaryText : variant === "danger" ? t.bad : t.text;
  const off = disabled || loading;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.button, { backgroundColor: bg, borderColor: variant === "secondary" ? t.border : "transparent", opacity: off ? 0.5 : pressed ? 0.8 : 1 }]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={t.muted}
        style={[s.input, { backgroundColor: t.bg, borderColor: error ? t.bad : t.border, color: t.text }]} {...props} />
      {error ? <Text style={{ color: t.bad, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="alert" style={{ color: t.bad, fontSize: 14 }}>{children}</Text>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  const t = useTheme();
  return <View style={{ padding: 16, alignItems: "center", gap: 8 }}><ActivityIndicator color={t.primary} /><Text style={{ color: t.muted }}>{label}</Text></View>;
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "ai";
export function Chip({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const t = useTheme();
  const map = { neutral: [t.neutralBg, t.muted], good: [t.goodBg, t.good], warn: [t.warnBg, t.warn], bad: [t.badBg, t.bad], ai: [t.aiBg, t.primary] } as const;
  const [bg, fg] = map[tone];
  return <View style={[s.chip, { backgroundColor: bg }]}><Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{label}</Text></View>;
}

/** For spending, an increase is bad news: up = red, down = green. */
export function ChangeChip({ pct, nullLabel = "new" }: { pct: number | null; nullLabel?: string }) {
  if (pct === null) return <Chip label={nullLabel} />;
  if (pct === 0) return <Chip label="no change" />;
  return <Chip label={`${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`} tone={pct > 0 ? "bad" : "good"} />;
}

const STATUS: Record<BudgetStatus, { label: string; tone: Tone }> = {
  ok: { label: "On track", tone: "good" }, warning: { label: "Close to limit", tone: "warn" }, exceeded: { label: "Over budget", tone: "bad" },
};
export function StatusChip({ status }: { status: BudgetStatus }) {
  return <Chip label={STATUS[status].label} tone={STATUS[status].tone} />;
}

export function ProgressBar({ percent, status }: { percent: number; status: BudgetStatus }) {
  const t = useTheme();
  const color = status === "exceeded" ? t.bad : status === "warning" ? t.warn : t.good;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${percent}% used`} accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      style={[s.progress, { backgroundColor: t.neutralBg }]}>
      <View style={{ width: `${Math.max(0, Math.min(percent, 100))}%`, height: "100%", backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[s.segmented, { borderColor: t.border }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityLabel={o.label} accessibilityState={{ selected: active }} onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, alignItems: "center", backgroundColor: active ? t.primary : "transparent" }}>
            <Text style={{ color: active ? t.primaryText : t.muted, fontWeight: active ? "700" : "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Wrapping row of tappable chips: a phone-friendly replacement for a <select>. */
export function ChipPicker<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const t = useTheme();
  return (
    <View accessibilityLabel={label} style={{ gap: 6 }}>
      <Text style={{ color: t.muted, fontSize: 13 }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable key={String(o.value)} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ selected: active }} onPress={() => onChange(o.value)}
              style={[s.pick, { backgroundColor: active ? t.primary : t.bg, borderColor: active ? t.primary : t.border }]}>
              <Text style={{ color: active ? t.primaryText : t.text, fontSize: 14, fontWeight: active ? "700" : "400" }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} onPress={() => onChange(shiftMonth(month, -1))} style={s.arrow}>
        <Text style={{ color: t.text, fontSize: 22 }}>‹</Text>
      </Pressable>
      <Text style={{ color: t.text, fontWeight: "600", minWidth: 110, textAlign: "center" }}>{monthLabel(month)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} onPress={() => onChange(shiftMonth(month, 1))} style={s.arrow}>
        <Text style={{ color: t.text, fontSize: 22 }}>›</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { padding: 16, gap: 14, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  button: { minHeight: 46, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, minHeight: 44 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: "flex-start" },
  progress: { height: 10, borderRadius: 999, overflow: "hidden" },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  pick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  arrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
