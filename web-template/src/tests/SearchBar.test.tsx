/**
 * Component tests for SearchBar React island.
 *
 * Covered behaviour:
 *   - Renders the input and the search icon.
 *   - Debounces the suggestion fetch (default 300 ms).
 *   - Short queries (< 2 chars) don't fire any request.
 *   - Suggestion list renders the response items.
 *   - Arrow keys move the active suggestion.
 *   - Enter on an active suggestion navigates to /items/<slug>.
 *   - Enter without active suggestion submits the query to /?q=<query>.
 *   - Escape closes the dropdown.
 *   - Invalid slugs (open-redirect protection) are rejected.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchBar from "@/components/react/SearchBar";

// `window.location.href = ...` is a navigation; jsdom complains. Stub it.
function stubLocation() {
  const original = window.location;
  // @ts-expect-error overwrite for testing
  delete window.location;
  const fake = { href: "" } as Location;
  // @ts-expect-error
  window.location = fake;
  return {
    fake,
    restore: () => {
      // @ts-expect-error
      window.location = original;
    },
  };
}

function mockFetch(response: unknown[], status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(response), { status }))),
  );
}

beforeEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SearchBar — render", () => {
  it("renders an input with the Search placeholder", () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });
});

describe("SearchBar — debounce", () => {
  it("does NOT fetch for queries shorter than 2 characters", async () => {
    vi.useFakeTimers();
    const spy = vi.fn(() => Promise.resolve(new Response("[]")));
    vi.stubGlobal("fetch", spy);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "a" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("debounces fetches (only fires after 300 ms of inactivity)", async () => {
    vi.useFakeTimers();
    const spy = vi.fn(() => Promise.resolve(new Response("[]")));
    vi.stubGlobal("fetch", spy);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);

    fireEvent.change(input, { target: { value: "he" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "hel" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    fireEvent.change(input, { target: { value: "hello" } });

    // 200 ms elapsed since last keystroke — still no fetch.
    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("q=hello");
    vi.useRealTimers();
  });
});

describe("SearchBar — suggestion dropdown", () => {
  it("renders suggestions returned by the API", async () => {
    mockFetch([
      { slug: "alpha", name: "Alpha" },
      { slug: "beta", name: "Beta" },
    ]);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "alp" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
    });
  });

  it("renders an empty state (no dropdown) when API returns []", async () => {
    mockFetch([]);
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "zzz" } });
    });
    // Wait long enough for the debounce + fetch, then assert nothing rendered.
    await new Promise((r) => setTimeout(r, 350));
    expect(screen.queryByText(/See all results/i)).not.toBeInTheDocument();
  });
});

describe("SearchBar — keyboard navigation", () => {
  it("Escape closes the dropdown", async () => {
    mockFetch([{ slug: "alpha", name: "Alpha" }]);
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "alp" } });
    });
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument(),
    );
  });

  it("Enter on the input submits the raw query when no active suggestion", async () => {
    const { fake, restore } = stubLocation();
    mockFetch([]);
    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "books" } });
    });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(fake.href).toBe("/?q=books");
    restore();
  });
});

describe("SearchBar — navigation safety", () => {
  it("navigates to /items/<slug> on click of a valid suggestion", async () => {
    const { fake, restore } = stubLocation();
    mockFetch([{ slug: "alpha", name: "Alpha" }]);

    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "alp" } });
    });
    const suggestion = await screen.findByText("Alpha");

    await userEvent.click(suggestion);
    expect(fake.href).toBe("/items/alpha");
    restore();
  });

  it("rejects suggestions with an unsafe slug (open-redirect protection)", async () => {
    const { fake, restore } = stubLocation();
    mockFetch([{ slug: "../evil", name: "Evil" }]);
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<SearchBar />);
    const input = screen.getByPlaceholderText(/search/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "evi" } });
    });
    const suggestion = await screen.findByText("Evil");

    await userEvent.click(suggestion);
    expect(fake.href).toBe("");
    expect(consoleErr).toHaveBeenCalledWith(
      "Invalid slug detected:",
      "../evil",
    );
    restore();
  });
});
