"use client";

import { useEffect, useState, type FocusEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageMotion } from "@/components/motion";
import { apiFetch, useApiQuery } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import {
  ColorField,
  ProxyChipList,
  ToggleField,
} from "@/components/admin/settings-fields";
import { FieldHint } from "@/components/admin/field-hint";
import { uploadImageFile } from "@/components/upload-image";
import { DEFAULT_THEME_COLORS } from "@/src/domains/settings/defaults";

type SettingsMap = Record<string, unknown>;

function str(v: unknown, fallback = "") {
  return v == null ? fallback : String(v);
}

function bool(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function colorsOf(
  map: SettingsMap,
  mode: "light" | "dark",
): Record<string, string> {
  const raw = map[`theme.colors.${mode}`];
  const base = DEFAULT_THEME_COLORS[mode];
  if (raw && typeof raw === "object") {
    return { ...base, ...(raw as Record<string, string>) };
  }
  return { ...base };
}

const COLOR_KEYS = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["border", "Borders"],
  ["accent", "Accents"],
  ["text", "Base text"],
  ["muted", "Muted text"],
  ["inverted", "Inverted text"],
  ["bg", "Background"],
  ["bgSecondary", "Background secondary"],
] as const;

/** Stop browsers/password managers treating settings secrets as login fields. */
const noLoginAutofill = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const noLoginAutofillSecret = {
  ...noLoginAutofill,
  autoComplete: "new-password",
} as const;

function unlockAutofill(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.removeAttribute("readonly");
}

async function uploadFile(file: File) {
  return uploadImageFile(file);
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useApiQuery<SettingsMap>(
    ["settings"],
    "/api/v1/settings",
  );
  const [form, setForm] = useState<SettingsMap>({});
  const [uploadingBrand, setUploadingBrand] = useState<
    null | "logo" | "favicon"
  >(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function set<K extends string>(key: K, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setColor(
    mode: "light" | "dark",
    key: string,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      [`theme.colors.${mode}`]: {
        ...colorsOf(prev, mode),
        [key]: value,
      },
    }));
  }

  async function persistBrandAsset(
    key: "brand.logoUrl" | "brand.faviconUrl",
    file: File,
  ) {
    const kind = key === "brand.logoUrl" ? "logo" : "favicon";
    setUploadingBrand(kind);
    try {
      const url = await uploadFile(file);
      set(key, url);
      await apiFetch<SettingsMap>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({ [key]: url }),
      });
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["public-settings"] });
      router.refresh();
      toast.success(kind === "logo" ? "Logo updated" : "Favicon updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingBrand(null);
    }
  }

  const save = useMutation({
    mutationFn: () =>
      apiFetch<SettingsMap>("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      }),
    onSuccess: (result) => {
      toast.success("Settings saved");
      setForm(result);
      queryClient.setQueryData(["settings"], result);
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMail = useMutation({
    mutationFn: () =>
      apiFetch<{ to: string; subject: string }>("/api/v1/mail/test", {
        method: "POST",
        body: "{}",
      }),
    onSuccess: (result) => {
      toast.success(`Test email sent to ${result.to}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const light = colorsOf(form, "light");
  const dark = colorsOf(form, "dark");
  const proxies = Array.isArray(form["security.trustedProxies"])
    ? (form["security.trustedProxies"] as string[])
    : [];

  return (
    <PageMotion>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your billing panel
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex h-auto flex-wrap">
          {[
            ["general", "General"],
            ["security", "Security"],
            ["social", "Social Login"],
            ["tax", "Tax"],
            ["mail", "Mail"],
            ["tickets", "Tickets"],
            ["cron", "Cronjob"],
            ["credits", "Credits"],
            ["affiliates", "Affiliates"],
            ["theme", "Theme"],
            ["fx", "Currency / FX"],
            ["invoices", "Invoices"],
            ["other", "Other"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label required>Company name</Label>
                <Input
                  value={str(form["brand.name"])}
                  onChange={(e) => set("brand.name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label required>Timezone</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={str(form["app.timezone"], "UTC")}
                  onChange={(e) => set("app.timezone", e.target.value)}
                >
                  {[
                    "UTC",
                    "America/New_York",
                    "America/Chicago",
                    "America/Denver",
                    "America/Los_Angeles",
                    "Europe/London",
                    "Europe/Paris",
                    "Europe/Berlin",
                    "Asia/Tokyo",
                    "Australia/Sydney",
                  ].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label required>App URL</Label>
                <Input
                  value={str(form["app.url"])}
                  onChange={(e) => set("app.url", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Logo</Label>
                <Input
                  type="file"
                  accept="image/*,.svg,.ico"
                  disabled={uploadingBrand !== null}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    await persistBrandAsset("brand.logoUrl", file);
                  }}
                />
                <FieldHint>
                  Applied immediately to the storefront and admin header. JPEG,
                  PNG, WebP, GIF, SVG, or ICO up to 5MB.
                </FieldHint>
                {str(form["brand.logoUrl"]) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={str(form["brand.logoUrl"])}
                    alt=""
                    className="mt-2 h-12 object-contain"
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Favicon</Label>
                <Input
                  type="file"
                  accept="image/*,.svg,.ico"
                  disabled={uploadingBrand !== null}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    await persistBrandAsset("brand.faviconUrl", file);
                  }}
                />
                <FieldHint>
                  Applied immediately as the browser tab icon. Hard-refresh if
                  the old icon is cached. JPEG, PNG, WebP, GIF, SVG, or ICO up
                  to 5MB.
                </FieldHint>
                {str(form["brand.faviconUrl"]) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={str(form["brand.faviconUrl"])}
                    alt=""
                    className="mt-2 h-8 w-8 object-contain"
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label required>System email address</Label>
                <Input
                  type="email"
                  value={str(form["system.email"])}
                  onChange={(e) => set("system.email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Terms of service URL</Label>
                <Input
                  placeholder="Leave blank to disable"
                  value={str(form["legal.termsUrl"])}
                  onChange={(e) => set("legal.termsUrl", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Captcha</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={str(form["captcha.provider"], "disabled")}
                  onChange={(e) => set("captcha.provider", e.target.value)}
                >
                  <option value="disabled">Disabled</option>
                  <option value="recaptcha_v2">Google Recaptcha v2</option>
                  <option value="recaptcha_v3">Google Recaptcha v3</option>
                  <option value="turnstile">Cloudflare Turnstile</option>
                  <option value="hcaptcha">hCaptcha</option>
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Captcha Site Key</Label>
                  <Input
                    name="apex-captcha-site-key"
                    readOnly
                    onFocus={unlockAutofill}
                    {...noLoginAutofill}
                    value={str(form["captcha.siteKey"])}
                    onChange={(e) => set("captcha.siteKey", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Captcha Secret</Label>
                  <Input
                    type="password"
                    name="apex-captcha-secret"
                    readOnly
                    onFocus={unlockAutofill}
                    {...noLoginAutofillSecret}
                    value={str(form["captcha.secret"])}
                    onChange={(e) => set("captcha.secret", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Trusted proxies</Label>
                <ProxyChipList
                  values={proxies}
                  onChange={(next) => set("security.trustedProxies", next)}
                />
                <FieldHint>
                  Proxy IPs or CIDRs trusted for X-Forwarded-For client IP
                  detection.
                </FieldHint>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                ["google", "Google"],
                ["github", "GitHub"],
                ["discord", "Discord"],
              ] as const
            ).map(([id, label]) => (
              <Card key={id}>
                <CardHeader>
                  <CardTitle>{label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ToggleField
                    label="Enabled"
                    checked={bool(form[`oauth.${id}.enabled`])}
                    onChange={(v) => set(`oauth.${id}.enabled`, v)}
                  />
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input
                      name={`apex-oauth-${id}-client-id`}
                      readOnly
                      onFocus={unlockAutofill}
                      {...noLoginAutofill}
                      value={str(form[`oauth.${id}.clientId`])}
                      onChange={(e) =>
                        set(`oauth.${id}.clientId`, e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input
                      type="password"
                      name={`apex-oauth-${id}-client-secret`}
                      readOnly
                      onFocus={unlockAutofill}
                      {...noLoginAutofillSecret}
                      value={str(form[`oauth.${id}.clientSecret`])}
                      onChange={(e) =>
                        set(`oauth.${id}.clientSecret`, e.target.value)
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle>Tax</CardTitle>
              <FieldHint>
                Exclusive adds tax on top; inclusive embeds it in prices.
              </FieldHint>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleField
                label="Tax enabled"
                checked={bool(form["tax.enabled"])}
                onChange={(v) => set("tax.enabled", v)}
              />
              <div className="space-y-2">
                <Label required>Tax rate (%)</Label>
                <Input
                  inputMode="decimal"
                  value={str(form["tax.rate"], "0")}
                  onChange={(e) => set("tax.rate", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label required>Tax type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={str(form["tax.type"], "exclusive")}
                  onChange={(e) => set("tax.type", e.target.value)}
                >
                  <option value="inclusive">
                    Inclusive (Price includes tax)
                  </option>
                  <option value="exclusive">
                    Exclusive (Price does not include tax)
                  </option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mail">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Mail</CardTitle>
                  <FieldHint>
                    SMTP is required for invoice and ticket emails in
                    production. Save changes before testing.
                  </FieldHint>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={testMail.isPending || save.isPending}
                  onClick={() => testMail.mutate()}
                >
                  {testMail.isPending ? "Sending..." : "Test mail settings"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <ToggleField
                  label="Users must verify email before buying"
                  checked={bool(form["mail.requireVerifiedEmail"])}
                  onChange={(v) => set("mail.requireVerifiedEmail", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  value={str(form["smtp.host"])}
                  onChange={(e) => set("smtp.host", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  inputMode="numeric"
                  value={str(form["smtp.port"], "587")}
                  onChange={(e) => set("smtp.port", Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  name="apex-smtp-user"
                  readOnly
                  onFocus={unlockAutofill}
                  {...noLoginAutofill}
                  value={str(form["smtp.user"])}
                  onChange={(e) => set("smtp.user", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  name="apex-smtp-pass"
                  readOnly
                  onFocus={unlockAutofill}
                  {...noLoginAutofillSecret}
                  value={str(form["smtp.pass"])}
                  onChange={(e) => set("smtp.pass", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Encryption</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={str(form["smtp.encryption"], "tls")}
                  onChange={(e) => set("smtp.encryption", e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Mail from address</Label>
                <Input
                  value={str(form["smtp.from"])}
                  onChange={(e) => set("smtp.from", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mail from name</Label>
                <Input
                  value={str(form["smtp.fromName"])}
                  onChange={(e) => set("smtp.fromName", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mail header HTML</Label>
                <textarea
                  className="min-h-40 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
                  value={str(form["mail.headerHtml"])}
                  onChange={(e) => set("mail.headerHtml", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mail footer HTML</Label>
                <textarea
                  className="min-h-40 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
                  value={str(form["mail.footerHtml"])}
                  onChange={(e) => set("mail.footerHtml", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mail CSS</Label>
                <textarea
                  className="min-h-48 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
                  value={str(form["mail.css"])}
                  onChange={(e) => set("mail.css", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <ToggleField
                label="Enable tickets system"
                checked={bool(form["tickets.enabled"], true)}
                onChange={(v) => set("tickets.enabled", v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cron">
          <Card>
            <CardHeader>
              <CardTitle>Cronjob</CardTitle>
              <FieldHint>
                Daily job time for renewals and overdue suspensions.
              </FieldHint>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label required>Cron job time</Label>
                <Input
                  type="time"
                  value={str(form["cron.time"], "00:00")}
                  onChange={(e) => set("cron.time", e.target.value)}
                />
              </div>
              {(
                [
                  ["cron.invoiceDueDays", "Send invoice if due date is x days away"],
                  [
                    "cron.invoiceReminderDays",
                    "Send invoice reminder if due date is x days away",
                  ],
                  [
                    "cron.cancelPendingOrderDays",
                    "Cancel order if pending for x days",
                  ],
                  [
                    "cron.suspendOverdueDays",
                    "Suspend server if invoice is x days overdue",
                  ],
                  [
                    "cron.suspensionWarningDays",
                    "Send suspension warning x days before suspend",
                  ],
                  [
                    "cron.deleteOverdueDays",
                    "Delete server if invoice is x days overdue",
                  ],
                  [
                    "cron.deleteEmailLogsDays",
                    "Delete email logs older than x days",
                  ],
                  [
                    "cron.closeTicketDays",
                    "Close tickets if no response for x days",
                  ],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label required>{label}</Label>
                  <Input
                    inputMode="numeric"
                    value={str(form[key])}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <CardTitle>Credits</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-3">
                <ToggleField
                  label="Enable credits system"
                  checked={bool(form["credits.enabled"])}
                  onChange={(v) => set("credits.enabled", v)}
                />
                <ToggleField
                  label="Automatically use credits"
                  checked={bool(form["credits.autoUse"], true)}
                  onChange={(v) => set("credits.autoUse", v)}
                />
                <ToggleField
                  label="Enable credits on service downgrade"
                  checked={bool(form["credits.onDowngrade"], true)}
                  onChange={(v) => set("credits.onDowngrade", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum deposit (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={str(form["credits.minDeposit"])}
                  onChange={(e) =>
                    set("credits.minDeposit", Number(e.target.value))
                  }
                />
                <FieldHint>Example: 5.00 for a five-dollar minimum.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Maximum deposit (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={str(form["credits.maxDeposit"])}
                  onChange={(e) =>
                    set("credits.maxDeposit", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum credit balance (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={str(form["credits.maxBalance"])}
                  onChange={(e) =>
                    set("credits.maxBalance", Number(e.target.value))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affiliates">
          <Card>
            <CardHeader>
              <CardTitle>Affiliates</CardTitle>
              <FieldHint>
                Control enrollment, commission rates, recurring earnings, and
                milestone scaling.
              </FieldHint>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-3">
                <ToggleField
                  label="Enable affiliate system"
                  checked={bool(form["affiliates.enabled"], true)}
                  onChange={(v) => set("affiliates.enabled", v)}
                />
                <ToggleField
                  label="Repeat earnings on renewals"
                  checked={bool(form["affiliates.repeatEarnings"])}
                  onChange={(v) => set("affiliates.repeatEarnings", v)}
                />
                <FieldHint>
                  When enabled, affiliates earn their percentage on each paid
                  renewal invoice for referred subscribers — not only the first
                  order.
                </FieldHint>
                <ToggleField
                  label="Enable earning % scaling"
                  checked={bool(form["affiliates.scalingEnabled"])}
                  onChange={(v) => set("affiliates.scalingEnabled", v)}
                />
              </div>
              <div className="space-y-2">
                <Label>Default earning %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={str(form["affiliates.defaultCommission"], "10")}
                  onChange={(e) =>
                    set("affiliates.defaultCommission", Number(e.target.value))
                  }
                />
                <FieldHint>
                  Used for new enrollments and as the base rate before milestones.
                </FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Referral cookie days</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  value={str(form["affiliates.cookieDays"], "30")}
                  onChange={(e) =>
                    set("affiliates.cookieDays", Number(e.target.value))
                  }
                />
                <FieldHint>
                  How long affiliate referral cookies remain valid after a visit.
                </FieldHint>
              </div>
              <div className="md:col-span-2 space-y-3">
                <Label>Scaling milestones</Label>
                <FieldHint>
                  When scaling is enabled, the highest matching milestone sets
                  the earning % (based on unique referred clients).
                </FieldHint>
                {(Array.isArray(form["affiliates.scalingMilestones"])
                  ? (form["affiliates.scalingMilestones"] as Array<{
                      referrals: number;
                      percent: number;
                    }>)
                  : []
                ).map((row, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-end gap-2 rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Referrals
                      </p>
                      <Input
                        type="number"
                        min={1}
                        className="w-28"
                        value={String(row.referrals ?? "")}
                        onChange={(e) => {
                          const milestones = [
                            ...(Array.isArray(
                              form["affiliates.scalingMilestones"],
                            )
                              ? (form[
                                  "affiliates.scalingMilestones"
                                ] as Array<{
                                  referrals: number;
                                  percent: number;
                                }>)
                              : []),
                          ];
                          milestones[index] = {
                            ...milestones[index],
                            referrals: Number(e.target.value),
                          };
                          set("affiliates.scalingMilestones", milestones);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Earning %
                      </p>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="w-28"
                        value={String(row.percent ?? "")}
                        onChange={(e) => {
                          const milestones = [
                            ...(Array.isArray(
                              form["affiliates.scalingMilestones"],
                            )
                              ? (form[
                                  "affiliates.scalingMilestones"
                                ] as Array<{
                                  referrals: number;
                                  percent: number;
                                }>)
                              : []),
                          ];
                          milestones[index] = {
                            ...milestones[index],
                            percent: Number(e.target.value),
                          };
                          set("affiliates.scalingMilestones", milestones);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const milestones = (
                          Array.isArray(form["affiliates.scalingMilestones"])
                            ? (form["affiliates.scalingMilestones"] as Array<{
                                referrals: number;
                                percent: number;
                              }>)
                            : []
                        ).filter((_, i) => i !== index);
                        set("affiliates.scalingMilestones", milestones);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const milestones = [
                      ...(Array.isArray(form["affiliates.scalingMilestones"])
                        ? (form["affiliates.scalingMilestones"] as Array<{
                            referrals: number;
                            percent: number;
                          }>)
                        : []),
                      { referrals: 100, percent: 15 },
                    ];
                    set("affiliates.scalingMilestones", milestones);
                  }}
                >
                  Add milestone
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={str(form["theme.id"], "default")}
                    onChange={(e) => set("theme.id", e.target.value)}
                  >
                    {(
                      Array.isArray(form["theme.packages"])
                        ? (form["theme.packages"] as Array<{
                            id: string;
                            name: string;
                          }>)
                        : [{ id: "default", name: "Default" }]
                    ).map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Logo display</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={str(form["theme.logoDisplay"], "logo_name")}
                    onChange={(e) => set("theme.logoDisplay", e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="logo">Logo only</option>
                    <option value="logo_name">Logo and Name</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <ToggleField
                  label="Direct checkout"
                  checked={bool(form["theme.directCheckout"])}
                  onChange={(v) => set("theme.directCheckout", v)}
                />
                <ToggleField
                  label="Small images"
                  checked={bool(form["theme.smallImages"])}
                  onChange={(v) => set("theme.smallImages", v)}
                />
                <ToggleField
                  label="Show category description"
                  checked={bool(form["theme.showCategoryDescription"], true)}
                  onChange={(v) => set("theme.showCategoryDescription", v)}
                />
              </div>
              <MarkdownEditor
                label="Home page text"
                value={str(form["theme.homeMarkdown"])}
                onChange={(v) => set("theme.homeMarkdown", v)}
                hint="Markdown shown on the store home page."
              />
              <div>
                <h3 className="mb-3 text-sm font-medium">Light colors</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {COLOR_KEYS.map(([key, label]) => (
                    <ColorField
                      key={`l-${key}`}
                      label={label}
                      value={light[key] ?? "#000000"}
                      onChange={(v) => setColor("light", key, v)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium">Dark colors</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {COLOR_KEYS.map(([key, label]) => (
                    <ColorField
                      key={`d-${key}`}
                      label={label}
                      value={dark[key] ?? "#000000"}
                      onChange={(v) => setColor("dark", key, v)}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fx">
          <Card>
            <CardHeader>
              <CardTitle>Currency &amp; FX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xs space-y-2">
                <Label required>Base currency</Label>
                <Input
                  maxLength={3}
                  value={str(form.currency, "USD").toUpperCase()}
                  onChange={(e) =>
                    set("currency", e.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Exchange rates (JSON)</Label>
                <textarea
                  className="min-h-32 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm"
                  value={JSON.stringify(
                    form["currency.rates"] &&
                      typeof form["currency.rates"] === "object"
                      ? form["currency.rates"]
                      : { USD: 1, EUR: 0.92, GBP: 0.79 },
                    null,
                    2,
                  )}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as Record<
                        string,
                        number
                      >;
                      set("currency.rates", parsed);
                    } catch {
                      /* keep typing */
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Rates are units of each currency per 1 unit of a conceptual
                  USD base (USD should be 1). Used by FX helpers when converting
                  display amounts.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>From / company details</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={str(form["invoice.billTo"])}
                  onChange={(e) => set("invoice.billTo", e.target.value)}
                  placeholder={"Example LLC\n123 Main St\nCity, ST 00000"}
                />
                <p className="text-xs text-muted-foreground">
                  Shown as the seller “From” block on invoice PDFs. Bill to is
                  always the client on the invoice.
                </p>
              </div>
              <div className="space-y-2">
                <Label required>Next invoice number</Label>
                <Input
                  inputMode="numeric"
                  value={str(form["invoice.nextNumber"], "1")}
                  onChange={(e) =>
                    set("invoice.nextNumber", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label required>Invoice number padding</Label>
                <Input
                  inputMode="numeric"
                  value={str(form["invoice.numberPadding"], "5")}
                  onChange={(e) =>
                    set("invoice.numberPadding", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label required>Invoice number format</Label>
                <Input
                  value={str(
                    form["invoice.numberFormat"],
                    "INV-{year}-{number}",
                  )}
                  onChange={(e) =>
                    set("invoice.numberFormat", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{number}"}, {"{year}"}, {"{month}"}, {"{day}"}. Must
                  include {"{number}"}.
                </p>
              </div>
              <ToggleField
                label="Proforma invoices"
                checked={bool(form["invoice.proforma"])}
                onChange={(v) => set("invoice.proforma", v)}
              />
              <ToggleField
                label="Invoice snapshot"
                description="Save name, address, and related details on the invoice when paid."
                checked={bool(form["invoice.snapshotOnPay"], true)}
                onChange={(v) => set("invoice.snapshotOnPay", v)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other">
          <Card>
            <CardHeader>
              <CardTitle>Other</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label required>Pagination</Label>
                <Input
                  inputMode="numeric"
                  value={str(form["ui.pageSize"], "25")}
                  onChange={(e) => set("ui.pageSize", Number(e.target.value))}
                />
              </div>
              <ToggleField
                label="Debug mode"
                checked={bool(form["app.debug"])}
                onChange={(v) => set("app.debug", v)}
              />
              <ToggleField
                label="Disable user registration"
                checked={bool(form["auth.disableRegistration"])}
                onChange={(v) => set("auth.disableRegistration", v)}
              />
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Staff notifications</p>
                <div className="space-y-3">
                  <ToggleField
                    label="Notify on new orders"
                    checked={bool(form["ops.notifyStaffOnOrder"])}
                    onChange={(v) => set("ops.notifyStaffOnOrder", v)}
                  />
                  <ToggleField
                    label="Notify on new tickets"
                    checked={bool(form["ops.notifyStaffOnTicket"])}
                    onChange={(v) => set("ops.notifyStaffOnTicket", v)}
                  />
                  <ToggleField
                    label="Notify on fraud review"
                    checked={bool(form["ops.notifyStaffOnFraud"])}
                    onChange={(v) => set("ops.notifyStaffOnFraud", v)}
                  />
                </div>
                <FieldHint>
                  Sends a short email to the system email address and all admin
                  users when enabled.
                </FieldHint>
              </div>
              <ToggleField
                label="Multi-tenant mode"
                description="Scope clients by tenantId using the default tenant below."
                checked={bool(form["multiTenant.enabled"])}
                onChange={(v) => set("multiTenant.enabled", v)}
              />
              <div className="max-w-xs space-y-2">
                <Label>Default tenant id</Label>
                <Input
                  value={str(form["multiTenant.defaultTenantId"], "default")}
                  onChange={(e) =>
                    set("multiTenant.defaultTenantId", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-end gap-2 border-t pt-4">
        <Button
          variant="outline"
          onClick={async () => {
            const result = await refetch();
            if (result.data) setForm(result.data);
            toast.message("Changes discarded");
          }}
          disabled={save.isPending}
        >
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </PageMotion>
  );
}
