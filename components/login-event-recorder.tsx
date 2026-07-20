"use client";

import { useEffect, useRef } from "react";
import { apiFetch } from "@/components/api";

const STORAGE_KEY = "quaypanel-login-event";

export function LoginEventRecorder() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    sent.current = true;
    apiFetch("/api/v1/me/login-event", { method: "POST" })
      .then(() => {
        sessionStorage.setItem(STORAGE_KEY, "1");
      })
      .catch(() => {
        sent.current = false;
      });
  }, []);

  return null;
}
