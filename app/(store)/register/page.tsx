"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { registerClientAction } from "@/src/actions/auth";
import { authClient } from "@/src/auth/client";
import { useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageMotion } from "@/components/motion";
import { CountrySelect } from "@/components/ui/country-select";

export default function RegisterPage() {
  const router = useRouter();
  const { data: settings } = useApiQuery<Record<string, unknown>>(
    ["public-settings"],
    "/api/v1/settings?public=1",
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const disabled = Boolean(settings?.["auth.disableRegistration"]);
  const termsUrl = String(settings?.["legal.termsUrl"] || "").trim();
  const brandName = String(settings?.["brand.name"] || "QuayPanel");

  useEffect(() => {
    if (settings && disabled) {
      router.replace("/login");
    }
  }, [settings, disabled, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (termsUrl && !acceptedTerms) {
      toast.error("Please agree to the Terms of Service");
      return;
    }

    setLoading(true);
    try {
      await registerClientAction({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        phone,
        company: company || undefined,
        address1,
        address2: address2 || undefined,
        city,
        state,
        postalCode,
        country,
        acceptedTerms: termsUrl ? acceptedTerms : undefined,
      });
      const { error } = await authClient.signIn.email({ email, password });
      if (error) throw new Error(error.message);
      router.push("/client");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return (
      <p className="text-center text-muted-foreground">
        Registration is disabled.
      </p>
    );
  }

  return (
    <PageMotion>
      <h1 className="text-3xl font-semibold tracking-tight">
        Create your {brandName} account
      </h1>
      <p className="mt-2 text-muted-foreground">
        Register as a client to manage orders and invoices.
      </p>

      <form className="mt-8 space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" required>
              First Name
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" required>
              Last Name
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" required>
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone" required>
              Phone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address1" required>
            Address
          </Label>
          <Input
            id="address1"
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
            autoComplete="address-line1"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address2">Address 2</Label>
          <Input
            id="address2"
            value={address2}
            onChange={(e) => setAddress2(e.target.value)}
            autoComplete="address-line2"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="city" required>
              City
            </Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" required>
              State
            </Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              autoComplete="address-level1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode" required>
              ZIP
            </Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              autoComplete="postal-code"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="country" required>
            Country
          </Label>
          <CountrySelect
            id="country"
            value={country}
            onChange={setCountry}
            required
          />
        </div>

        {termsUrl ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              required
            />
            <span>
              I agree to the{" "}
              <a
                href={termsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Terms of Service
              </a>
            </span>
          </label>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" disabled={loading} className="sm:min-w-48">
            {loading ? "Creating..." : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="text-primary underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </PageMotion>
  );
}
