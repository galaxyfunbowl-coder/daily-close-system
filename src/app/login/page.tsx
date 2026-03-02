"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/daily");
      router.refresh();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-100 dark:bg-neutral-950">
      <div className="card-section w-full max-w-xs p-6">
        <h1 className="text-xl font-semibold text-center mb-4 text-neutral-900 dark:text-neutral-100">Daily Closing</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-field"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "..." : "Login"}
          </button>
        </form>
        <p className="mt-3 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Local only · No cloud
        </p>
      </div>
    </div>
  );
}
