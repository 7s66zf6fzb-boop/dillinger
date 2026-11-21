import { test, expect } from "@playwright/test";

const seededDocument = {
  id: "panes-doc",
  title: "Panes.md",
  body: "# Panes\n\nCollapse either side.",
  createdAt: "2026-03-10T00:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((documentState) => {
    window.localStorage.setItem("files", JSON.stringify([documentState]));
    window.localStorage.setItem("currentDocument", JSON.stringify(documentState));
  }, seededDocument);
});

test("editor and preview panes collapse and expand independently", async ({ page }) => {
  await page.goto("/");

  const editorPane = page.locator("#editor-pane");
  const previewPane = page.locator("#preview-pane");
  await expect(editorPane).toBeVisible();
  await expect(previewPane).toBeVisible();

  // No collapse rails on the pane edges any more; the toggles live in the navbar
  await expect(page.getByRole("button", { name: /Collapse (editor|preview)/ })).toHaveCount(0);

  // Hide the editor: it slides out and the preview fills the space
  await page.getByRole("button", { name: "Hide editor" }).click();
  await expect(editorPane).toBeHidden();
  await expect(previewPane).toBeVisible();
  const full = page.viewportSize()!.width;
  await expect.poll(async () => (await previewPane.boundingBox())!.width).toBeGreaterThan(full * 0.9);

  await page.getByRole("button", { name: "Show editor" }).click();
  await expect(editorPane).toBeVisible();
  await expect(previewPane).toBeVisible();

  // Hide the preview: it slides out and the editor fills the space
  await page.getByRole("button", { name: "Hide preview" }).click();
  await expect(previewPane).toBeHidden();
  await expect(editorPane).toBeVisible();
  await expect.poll(async () => (await editorPane.boundingBox())!.width).toBeGreaterThan(full * 0.9);

  await page.getByRole("button", { name: "Show preview" }).click();
  await expect(previewPane).toBeVisible();
});
