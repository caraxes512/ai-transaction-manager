import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { errorMessage } from "../lib/format";

export default function LoginPage() {
  const { token, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";
  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">AI Transaction Manager</p>
        {isRegister && (
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? "new-password" : "current-password"} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create account" : "Log in"}</button>
        <button type="button" className="btn btn-link" onClick={() => { setMode(isRegister ? "login" : "register"); setError(null); }}>
          {isRegister ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
}
