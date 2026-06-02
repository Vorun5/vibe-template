import { useState, useEffect, useRef, useCallback } from "react";
import { itemSuggest, type ItemSuggestion } from "@/lib/api";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Reject suggestion slugs that don't match a safe URL pattern. Prevents
 * an open-redirect via `window.location.href = /items/${slug}` if the API
 * is ever compromised.
 */
function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  return /^[a-z0-9-]+$/.test(slug);
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSuggestions = useCallback(async (raw: string) => {
    if (raw.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const results = await itemSuggest(raw);
      setSuggestions(results);
      setIsOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => fetchSuggestions(query),
      DEBOUNCE_MS,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = () => {
    if (query.trim().length < MIN_QUERY_LENGTH) return;
    window.location.href = `/?q=${encodeURIComponent(query.trim())}`;
  };

  const handleSelect = (suggestion: ItemSuggestion) => {
    if (!isValidSlug(suggestion.slug)) {
      console.error("Invalid slug detected:", suggestion.slug);
      return;
    }
    window.location.href = `/items/${suggestion.slug}`;
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else {
        handleSubmit();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute z-10 left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-base-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search…"
          className="w-full pl-10 pr-4 py-2 md:py-2.5 bg-surface backdrop-blur-md ring ring-border focus:ring focus:ring-primary rounded-md text-sm placeholder:text-text-base-muted focus:outline-none transition-all"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeOpacity="0.2"
                className="text-primary"
              />
              <path
                d="M8 2 A6 6 0 0 1 14 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-primary"
              />
            </svg>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          className="dropdown-enter absolute top-full mt-2 bg-surface rounded-lg border border-border overflow-hidden z-50 left-0 right-0 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <button
              type="button"
              tabIndex={0}
              key={s.slug}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors cursor-pointer ${
                i === activeIndex
                  ? "bg-primary text-white"
                  : "hover:bg-surface-muted"
              }`}
            >
              <span className="truncate font-medium">{s.name}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full px-4 py-2.5 text-sm text-primary font-medium border-t border-border text-center cursor-pointer hover:bg-surface-muted"
          >
            See all results for «{query}»
          </button>
        </div>
      )}
    </div>
  );
}
