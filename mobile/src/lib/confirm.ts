import { Alert, Platform } from "react-native";

/** Alert.alert does nothing on web, so use window.confirm there. Resolves true if the user agrees. */
export function confirmAction(title: string, message: string, confirmLabel = "Delete"): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
