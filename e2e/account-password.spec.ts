import { test, expect } from "@playwright/test";
import { prepare } from "./helpers/scouting";

test("password changes enforce eight characters and preserve credentials after a rejected attempt", async ({ page }) => {
  await prepare(page);
  const attempts: unknown[] = [];
  await page.route("**/api/users/me/password", async (route) => {
    attempts.push(route.request().postDataJSON());
    await route.fulfill({ status: attempts.length === 1 ? 400 : 200, json: attempts.length === 1
      ? { error: "Current password is incorrect" } : { success: true } });
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Competition Scout/ }).click();
  await page.getByRole("menuitem", { name: "Account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const current = dialog.getByLabel("Current Password", { exact: true });
  const next = dialog.getByLabel("New Password", { exact: true });
  const confirm = dialog.getByLabel("Confirm New Password", { exact: true });
  const submit = dialog.getByRole("button", { name: "Change Password", exact: true });

  await expect(next).toHaveAttribute("placeholder", "Enter new password (min 8 characters)");
  await current.fill("old-password");
  await next.fill("1234567");
  await confirm.fill("1234567");
  await submit.click();
  await expect(page.getByText("Password must be at least 8 characters", { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(0);

  await next.fill("12345678");
  await confirm.fill("different");
  await submit.click();
  await expect(page.getByText("New passwords do not match", { exact: true })).toBeVisible();
  expect(attempts).toHaveLength(0);

  await confirm.fill("12345678");
  await submit.click();
  await expect(page.getByText("Current password is incorrect", { exact: true })).toBeVisible();
  await expect(current).toHaveValue("old-password");
  await expect(next).toHaveValue("12345678");
  await expect(submit).toBeEnabled();
  await current.fill("correct-password");
  await submit.click();
  await expect(page.getByText("Password changed successfully", { exact: true })).toBeVisible();
  expect(attempts).toEqual([
    { currentPassword: "old-password", newPassword: "12345678" },
    { currentPassword: "correct-password", newPassword: "12345678" },
  ]);
  await expect(current).toHaveValue("");
  await expect(next).toHaveValue("");
  await expect(confirm).toHaveValue("");
});
