import type { Page } from "@playwright/test"

export type RoleSelector = Parameters<Page["getByRole"]>
