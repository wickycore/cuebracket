import { expect, test } from "@playwright/test";

test("home, public discovery and account boundaries remain reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Your next match starts here." }).or(page.getByRole("heading", { name: "Events are temporarily unavailable" }))).toBeVisible();
  await page.goto("/tournaments");
  await expect(page).toHaveURL(/\/auth\/login\?next=/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
});

test("closed navigation is inert and open navigation traps focus", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  const drawer = page.locator("#mobile-navigation");
  await expect(drawer).toHaveAttribute("inert", "");
  await menu.click();
  await expect(page.getByRole("button", { name: "Close navigation menu" }).last()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.locator(":focus")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(drawer).toHaveAttribute("inert", "");
});

test("unknown routes show the branded recovery page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByRole("heading", { name: "That shot missed the pocket." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Discover events" })).toBeVisible();
});

test("mobile respects browser text size instead of shrinking the whole app", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const rootFontSize = await page.locator("html").evaluate((element) => getComputedStyle(element).fontSize);
  expect(rootFontSize).toBe("16px");
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
});

test("public registration clearly explains name visibility", async ({ page }) => {
  test.skip(!process.env.E2E_REGISTRATION_ID, "Set E2E_REGISTRATION_ID to an open public event.");
  await page.goto(`/register/${process.env.E2E_REGISTRATION_ID}`);
  await expect(page.getByText(/tournament name will appear publicly/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Request my place" })).toBeVisible();
});
