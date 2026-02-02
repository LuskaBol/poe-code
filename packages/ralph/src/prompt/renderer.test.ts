import { describe, it, expect } from "vitest";
import { renderPrompt } from "./renderer.js";

describe("renderPrompt", () => {
  it("replaces {{VARIABLE}} tokens with provided values", () => {
    const rendered = renderPrompt("Story: {{STORY_ID}}", {
      STORY_ID: "US-006"
    });

    expect(rendered).toBe("Story: US-006");
  });

  it("supports multiple substitutions and repeated variables", () => {
    const rendered = renderPrompt(
      "ID={{STORY_ID}} Title={{STORY_TITLE}} Again={{STORY_ID}}",
      {
        STORY_ID: "US-006",
        STORY_TITLE: "Implement prompt renderer"
      }
    );

    expect(rendered).toBe(
      "ID=US-006 Title=Implement prompt renderer Again=US-006"
    );
  });

  it("replaces missing variables with empty string", () => {
    const rendered = renderPrompt("Story: {{STORY_ID}}", {});

    expect(rendered).toBe("Story: ");
  });
});
