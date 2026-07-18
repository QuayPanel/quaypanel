"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

/** Search input that commits after idle delay, on Enter, or immediately when cleared. */
export function useDeferredSearch(delayMs = 1200) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const next = input.trim();
    if (next === query) return;
    if (!next) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => setQuery(next), delayMs);
    return () => window.clearTimeout(timer);
  }, [input, query, delayMs]);

  function commit() {
    const next = input.trim();
    if (next !== query) setQuery(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return {
    input,
    setInput,
    query,
    searching: query.length > 0,
    onKeyDown,
  };
}
