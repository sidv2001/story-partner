import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { EDIT_LENSES, SAMPLE_LINE, createExampleProject } from "./domain/project";
import { STORAGE_KEY } from "./storage/local";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("the offline writing desk", () => {
  it("rejects, accepts, and undoes without any model network request", async () => {
    const user = userEvent.setup();
    const original = createExampleProject().draft;
    render(<App />);
    const scene = screen.getByRole("textbox", { name: "Scene draft" });

    await user.click(screen.getByRole("button", { name: "Select example sentence" }));
    await user.click(screen.getByRole("button", { name: "Show offline suggestion" }));
    expect(screen.getByRole("button", { name: "Accept edit" })).toBeInTheDocument();
    expect(scene).toHaveValue(original);

    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(scene).toHaveValue(original);
    await user.click(screen.getByRole("button", { name: "Select example sentence" }));
    await user.click(screen.getByRole("button", { name: "Show offline suggestion" }));
    await user.click(screen.getByRole("button", { name: "Accept edit" }));
    expect(scene).toHaveValue(original.replace(SAMPLE_LINE, EDIT_LENSES.plain.suggestion));

    await user.click(screen.getByRole("button", { name: "Undo scene revision" }));
    expect(scene).toHaveValue(original);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("refuses stale proposals in the UI and keeps the writer's draft", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Select example sentence" }));
    await user.click(screen.getByRole("button", { name: "Show offline suggestion" }));
    const scene = screen.getByRole("textbox", { name: "Scene draft" });
    await user.type(scene, " Extra");
    const dirtyText = (scene as HTMLTextAreaElement).value;

    await user.click(screen.getByRole("button", { name: "Accept edit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("stale");
    expect(scene).toHaveValue(dirtyText);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(scene).toHaveValue(dirtyText);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("records a writer rewrite and lets the writer control a note", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole("textbox", { name: "Your note" }), "Keep verbs concrete");
    await user.click(screen.getByRole("checkbox", { name: "Attach this note to future requests" }));
    await user.click(screen.getByRole("button", { name: "Save note" }));
    expect(screen.getByRole("checkbox", { name: "Attach note to requests: Keep verbs concrete" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Select example sentence" }));
    await user.click(screen.getByRole("button", { name: "Show offline suggestion" }));
    expect(screen.getByText(/Notes attached at request: Keep verbs concrete/)).toBeInTheDocument();
    const ownWords = "The first stone went under before she could reach it.";
    await user.type(screen.getByRole("textbox", { name: "Or write your own line" }), ownWords);
    await user.click(screen.getByRole("button", { name: "Use my rewrite" }));
    expect(screen.getByRole("textbox", { name: "Scene draft" })).toHaveValue(
      createExampleProject().draft.replace(SAMPLE_LINE, ownWords),
    );
    expect(screen.getByText("Writer rewrite informed by offline proposal")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete note: Keep verbs concrete" }));
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain("Keep verbs concrete"));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("has an accessible static timeline and keyboard-operable request controls", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("img", { name: "An illustrative, writer-led revision path" })).toBeInTheDocument();
    expect(screen.getByText("Suggestion A branches from scene v1 and is rejected; the scene stays as it was.")).toBeInTheDocument();

    const selectButton = screen.getByRole("button", { name: "Select example sentence" });
    selectButton.focus();
    await user.keyboard("{Enter}");
    const scene = screen.getByRole("textbox", { name: "Scene draft" }) as HTMLTextAreaElement;
    expect(scene.value.slice(scene.selectionStart, scene.selectionEnd)).toBe(SAMPLE_LINE);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not overwrite an unreadable local project during recovery", () => {
    window.localStorage.setItem(STORAGE_KEY, "{broken");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Your saved project needs attention." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download unreadable copy" })).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("{broken");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
