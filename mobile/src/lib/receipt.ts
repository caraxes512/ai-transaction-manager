import { Platform } from "react-native";

export interface PickedImage { uri: string; fileName?: string | null; mimeType?: string; file?: File }

/** Build the multipart body for POST /ai/receipt. React Native uploads {uri,name,type}; the browser needs a Blob. */
export async function buildReceiptForm(asset: PickedImage): Promise<FormData> {
  const form = new FormData();
  const name = asset.fileName || "receipt.jpg";
  const type = asset.mimeType || "image/jpeg";
  if (Platform.OS === "web") {
    const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
    form.append("file", blob, name);
  } else {
    form.append("file", { uri: asset.uri, name, type } as unknown as Blob);
  }
  return form;
}
