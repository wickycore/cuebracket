import { expect, test } from "@playwright/test";

test.describe("authenticated organizer, club and alerts smoke test", () => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "Set dedicated CueBracket E2E account credentials.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("opens organizer libraries and notification controls", async ({ page }) => {
    await page.goto("/tournaments");
    await expect(page.getByRole("heading", { name: /Every event in one command shelf/i })).toBeVisible();
    await page.goto("/clubs");
    await expect(page.getByRole("heading", { name: /Your local pool scene/i })).toBeVisible();
    await page.goto("/following");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.goto("/notifications");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
