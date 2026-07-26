import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fetchBlob } from "@/src/api";

/**
 * Download or share a file returned by a backend endpoint.
 * - Web: creates an object URL and triggers browser download.
 * - Native (iOS/Android): saves to app cache directory, opens the native share sheet.
 */
export async function downloadExport(path: string, fallbackName: string): Promise<void> {
  const { blob, filename } = await fetchBlob(path);
  const finalName = filename || fallbackName;

  if (Platform.OS === "web") {
    // Web: trigger download via blob URL
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return;
  }

  // Native: read blob as base64 and write file to cache, then share
  const b64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:*/*;base64," prefix
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

  const dir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || "";
  const target = dir + finalName;
  await FileSystem.writeAsStringAsync(target, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const mime = finalName.endsWith(".pdf")
      ? "application/pdf"
      : finalName.endsWith(".csv")
      ? "text/csv"
      : "application/octet-stream";
    await Sharing.shareAsync(target, { mimeType: mime, dialogTitle: finalName });
  }
}
