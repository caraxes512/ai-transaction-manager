import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Body, Button, Card, ErrorText, Field, Screen, Title } from "@/components/ui";
import { useAuth } from "@/auth/AuthContext";
import { errorMessage } from "@/lib/format";

export default function LoginScreen() {
  const { token, ready, login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && token) return <Redirect href="/" />;
  const isRegister = mode === "register";

  async function submit() {
    setError(null);
    if (isRegister && password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (isRegister) await register(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ gap: 14, paddingTop: 48 }}>
        <Title>{isRegister ? "Create your account" : "Welcome back"}</Title>
        <Body muted>AI Transaction Manager</Body>
        <Card>
          {isRegister && <Field label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
            autoComplete={isRegister ? "new-password" : "current-password"} textContentType={isRegister ? "newPassword" : "password"} onSubmitEditing={submit} />
          {error && <ErrorText>{error}</ErrorText>}
          <Button title={isRegister ? "Create account" : "Log in"} onPress={submit} loading={busy} disabled={!email || !password} />
          <View style={{ alignItems: "center" }}>
            <Button variant="ghost" title={isRegister ? "Already have an account? Log in" : "New here? Create an account"}
              onPress={() => { setMode(isRegister ? "login" : "register"); setError(null); }} />
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}
