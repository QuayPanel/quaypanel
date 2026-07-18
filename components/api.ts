"use client";

import { useQuery } from "@tanstack/react-query";

function portalHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const path = window.location.pathname;
  if (path.startsWith("/client")) return { "X-Quay-Portal": "client" };
  if (path.startsWith("/admin")) return { "X-Quay-Portal": "admin" };
  return {};
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...portalHeader(),
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Request failed");
  }
  return json.data as T;
}

export function useApiQuery<T>(
  key: string[],
  path: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<T>(path),
    enabled: options?.enabled,
  });
}
