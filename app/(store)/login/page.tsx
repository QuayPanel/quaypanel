"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/src/auth/client";
import { useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageMotion } from "@/components/motion";

export default function LoginPage() {
  const router = useRouter();
  const { data: settings } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const registrationDisabled = Boolean(
    settings?.["auth.disableRegistration"],
  );
  const brand = String(settings?.["brand.name"] || "QuayPanel");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Login failed");
      return;
    }

    await fetch("/api/v1/me").then((r) => r.json());
    router.push("/client");
  }

  async function social(provider: "google" | "github" | "discord") {
    await authClient.signIn.social({
      provider,
      callbackURL: "/client",
    });
  }

  return (
    <PageMotion>
      <h1 className="text-3xl font-semibold tracking-tight">
        Sign in to {brand}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Access your admin or client portal.
      </p>

      <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" disabled={loading} className="sm:min-w-48">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          {!registrationDisabled ? (
            <p className="text-sm text-muted-foreground">
              New here?{" "}
              <Link className="text-primary underline" href="/register">
                Create an account
              </Link>
            </p>
          ) : null}
        </div>
      </form>

      {(Boolean(settings?.["oauth.google.enabled"]) ||
        Boolean(settings?.["oauth.github.enabled"]) ||
        Boolean(settings?.["oauth.discord.enabled"])) && (
        <div className="mt-8 space-y-2 border-t pt-8">
          {Boolean(settings?.["oauth.google.enabled"]) && (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:max-w-xs"
              onClick={() => social("google")}
            >
              Continue with Google
            </Button>
          )}
          {Boolean(settings?.["oauth.github.enabled"]) && (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:max-w-xs"
              onClick={() => social("github")}
            >
              Continue with GitHub
            </Button>
          )}
          {Boolean(settings?.["oauth.discord.enabled"]) && (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:max-w-xs"
              onClick={() => social("discord")}
            >
              Continue with Discord
            </Button>
          )}
        </div>
      )}
    </PageMotion>
  );
}
