import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/api";
import type { ReceiptDraft } from "@/api/types";
import { Body, Button, Card, Chip, ErrorText, Loading, Screen, Small, Title } from "@/components/ui";
import { RequireAuth } from "@/components/RequireAuth";
import { errorMessage, inr, shortDate } from "@/lib/format";
import { buildReceiptForm, type PickedImage } from "@/lib/receipt";

export default function ReceiptScreen() {
  return <RequireAuth><Scanner /></RequireAuth>;
}

function Scanner() {
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const scan = useMutation({
    mutationFn: async (asset: PickedImage) => api.scanReceipt(await buildReceiptForm(asset)),
    onSuccess: (d) => { setDraft(d); setProblem(null); },
    onError: (e) => { setDraft(null); setProblem(errorMessage(e)); },
  });

  // Saving only happens here, after the user has seen the draft. We don't send category_id for an AI
  // suggestion: the server re-derives it with the right "how was this chosen" label.
  const save = useMutation({
    mutationFn: (d: ReceiptDraft) => api.createTransaction({ amount: d.amount, type: "expense", description: d.description, date: d.date }),
    onSuccess: () => { qc.invalidateQueries(); close(); },
  });

  async function pick(source: "camera" | "library") {
    setProblem(null);
    // The system photo picker needs no permission (and on Android 13+ there is no media permission to grant),
    // so only the camera is gated. Gating the library would wrongly block it on most current phones.
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setProblem("Camera access is off. Enable it in Settings, or choose a photo from your library.");
        return;
      }
    }
    // quality < 1 keeps phone photos well under the server's 5 MB limit
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) scan.mutate(result.assets[0]);
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Title>Scan receipt</Title>
        <Button variant="ghost" title="Close" onPress={close} />
      </View>

      {scan.isPending && <Card><Loading label="Reading your receipt…" /></Card>}

      {!scan.isPending && !draft && (
        <Card>
          <Body>Take a photo of a receipt and we'll fill in the shop, total and date. You'll review it before anything is saved.</Body>
          <Button title="📷  Take a photo" onPress={() => pick("camera")} />
          <Button variant="secondary" title="🖼  Choose from library" onPress={() => pick("library")} />
          {problem && <ErrorText>{problem}</ErrorText>}
        </Card>
      )}

      {draft && !scan.isPending && (
        <Card title="Add this transaction?">
          <Body bold style={{ fontSize: 20 }}>{draft.description}</Body>
          <Body style={{ fontSize: 28, fontWeight: "700" }}>{inr(draft.amount)}</Body>
          <Body muted>{shortDate(draft.date)}{draft.date_guessed ? " (guessed)" : ""}</Body>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {draft.category
              ? <Chip tone={draft.auto_apply ? "ai" : "warn"} label={draft.auto_apply ? `${draft.category} · ${draft.source} ${Math.round(draft.confidence * 100)}%` : `Maybe ${draft.category}`} />
              : <Chip label="No category yet" />}
          </View>
          {draft.warnings.map((w) => <Small key={w}>⚠️ {w}</Small>)}
          {save.isError && <ErrorText>{errorMessage(save.error)}</ErrorText>}
          <Button title="Add transaction" onPress={() => save.mutate(draft)} loading={save.isPending} />
          <Button variant="secondary" title="Edit first" onPress={() => router.replace({ pathname: "/add", params: { description: draft.description, amount: draft.amount, date: draft.date } })} />
          <Button variant="ghost" title="Scan a different receipt" onPress={() => { setDraft(null); setProblem(null); }} />
        </Card>
      )}
    </Screen>
  );
}
