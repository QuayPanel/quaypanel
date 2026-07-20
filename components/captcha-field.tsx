"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useApiQuery } from "@/components/api";

export type CaptchaProvider =
  | "disabled"
  | "recaptcha_v2"
  | "recaptcha_v3"
  | "turnstile"
  | "hcaptcha";

export type CaptchaFieldHandle = {
  /** Returns a fresh/current token, or undefined when captcha is disabled. */
  execute: () => Promise<string | undefined>;
  reset: () => void;
};

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        el: HTMLElement,
        opts: Record<string, unknown>,
      ) => number;
      getResponse: (id?: number) => string;
      reset: (id?: number) => void;
      execute: (
        siteKey: string,
        opts: { action: string },
      ) => Promise<string>;
    };
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: Record<string, unknown>,
      ) => string;
      reset: (id: string) => void;
      getResponse: (id: string) => string;
      remove: (id: string) => void;
    };
    hcaptcha?: {
      render: (
        el: HTMLElement,
        opts: Record<string, unknown>,
      ) => string;
      reset: (id: string) => void;
      getResponse: (id: string) => string;
      remove: (id: string) => void;
    };
  }
}

function loadScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load captcha")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load captcha"));
    document.head.appendChild(script);
  });
}

export const CaptchaField = forwardRef<CaptchaFieldHandle>(
  function CaptchaField(_props, ref) {
    const { data: settings } = useApiQuery<Record<string, unknown>>(
      ["public-settings"],
      "/api/v1/settings?public=1",
    );
    const provider = String(
      settings?.["captcha.provider"] || "disabled",
    ) as CaptchaProvider;
    const siteKey = String(settings?.["captcha.siteKey"] || "").trim();
    const enabled =
      provider !== "disabled" &&
      Boolean(siteKey) &&
      (provider === "recaptcha_v2" ||
        provider === "recaptcha_v3" ||
        provider === "turnstile" ||
        provider === "hcaptcha");

    const mountRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | number | null>(null);
    const tokenRef = useRef<string>("");
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
      tokenRef.current = "";
      const id = widgetIdRef.current;
      try {
        if (provider === "recaptcha_v2" && typeof id === "number") {
          window.grecaptcha?.reset(id);
        } else if (provider === "turnstile" && typeof id === "string") {
          window.turnstile?.reset(id);
        } else if (provider === "hcaptcha" && typeof id === "string") {
          window.hcaptcha?.reset(id);
        }
      } catch {
        /* ignore */
      }
    }, [provider]);

    useImperativeHandle(
      ref,
      () => ({
        execute: async () => {
          if (!enabled) return undefined;

          if (provider === "recaptcha_v3") {
            await new Promise<void>((resolve) => {
              window.grecaptcha?.ready(() => resolve());
            });
            const token = await window.grecaptcha!.execute(siteKey, {
              action: "submit",
            });
            tokenRef.current = token;
            return token;
          }

          let token = tokenRef.current;
          if (!token && provider === "recaptcha_v2" && typeof widgetIdRef.current === "number") {
            token = window.grecaptcha?.getResponse(widgetIdRef.current) || "";
          }
          if (!token && provider === "turnstile" && typeof widgetIdRef.current === "string") {
            token = window.turnstile?.getResponse(widgetIdRef.current) || "";
          }
          if (!token && provider === "hcaptcha" && typeof widgetIdRef.current === "string") {
            token = window.hcaptcha?.getResponse(widgetIdRef.current) || "";
          }

          if (!token) {
            throw new Error("Please complete the captcha");
          }
          return token;
        },
        reset,
      }),
      [enabled, provider, siteKey, reset],
    );

    useEffect(() => {
      if (!enabled) return;
      let cancelled = false;

      async function mount() {
        setError(null);
        setReady(false);
        try {
          if (provider === "recaptcha_v3") {
            await loadScript(
              `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`,
              "recaptcha-v3-script",
            );
            if (!cancelled) setReady(true);
            return;
          }

          if (!mountRef.current) return;

          if (provider === "recaptcha_v2") {
            await loadScript(
              "https://www.google.com/recaptcha/api.js?render=explicit",
              "recaptcha-v2-script",
            );
            if (cancelled || !mountRef.current) return;
            await new Promise<void>((resolve) => {
              window.grecaptcha?.ready(() => resolve());
            });
            if (cancelled || !mountRef.current) return;
            mountRef.current.innerHTML = "";
            widgetIdRef.current = window.grecaptcha!.render(mountRef.current, {
              sitekey: siteKey,
              callback: (token: string) => {
                tokenRef.current = token;
              },
              "expired-callback": () => {
                tokenRef.current = "";
              },
            });
          } else if (provider === "turnstile") {
            await loadScript(
              "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
              "turnstile-script",
            );
            if (cancelled || !mountRef.current) return;
            mountRef.current.innerHTML = "";
            widgetIdRef.current = window.turnstile!.render(mountRef.current, {
              sitekey: siteKey,
              callback: (token: string) => {
                tokenRef.current = token;
              },
              "expired-callback": () => {
                tokenRef.current = "";
              },
            });
          } else if (provider === "hcaptcha") {
            await loadScript(
              "https://js.hcaptcha.com/1/api.js?render=explicit",
              "hcaptcha-script",
            );
            if (cancelled || !mountRef.current) return;
            mountRef.current.innerHTML = "";
            widgetIdRef.current = window.hcaptcha!.render(mountRef.current, {
              sitekey: siteKey,
              callback: (token: string) => {
                tokenRef.current = token;
              },
              "expired-callback": () => {
                tokenRef.current = "";
              },
            });
          }
          if (!cancelled) setReady(true);
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Captcha failed to load",
            );
          }
        }
      }

      void mount();
      return () => {
        cancelled = true;
        const id = widgetIdRef.current;
        try {
          if (provider === "turnstile" && typeof id === "string") {
            window.turnstile?.remove(id);
          } else if (provider === "hcaptcha" && typeof id === "string") {
            window.hcaptcha?.remove(id);
          }
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
        tokenRef.current = "";
      };
    }, [enabled, provider, siteKey]);

    if (!enabled) return null;

    return (
      <div className="space-y-1">
        {provider === "recaptcha_v3" ? (
          <p className="text-xs text-muted-foreground">
            Protected by reCAPTCHA
          </p>
        ) : (
          <div ref={mountRef} className="min-h-10" />
        )}
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : !ready && provider !== "recaptcha_v3" ? (
          <p className="text-xs text-muted-foreground">Loading captcha…</p>
        ) : null}
      </div>
    );
  },
);
