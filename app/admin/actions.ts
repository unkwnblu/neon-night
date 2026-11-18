"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { fulfilSale } from "@/lib/fulfil";
import { redirect } from "next/navigation";
import { endAdminSession, isAdminConfigured, requireAdmin, roleForPassword, startSession } from "@/lib/admin-auth";
import { recordSale, refundSale } from "@/lib/sales";
import { parseSaleForm, parseTierForm, type FieldErrors, type SaleErrors } from "@/lib/ticket-types";
import { createTier, deleteTier, TIERS_TAG, updateTier } from "@/lib/tickets";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!isAdminConfigured()) {
    return { error: "Admin sign-in isn't set up yet: ADMIN_PASSWORD and ADMIN_SESSION_SECRET are missing." };
  }
  const role = roleForPassword(String(form.get("password") ?? ""));
  if (!role) {
    // Slows down password guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "That password isn't right." };
  }
  await startSession(role);
  redirect(role === "door" ? "/admin/scan" : "/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}

/** `values` echoes the submission back on failure, because React clears the form after every submit. */
export type TierFormState = { errors?: FieldErrors; saved?: number; values?: Record<string, string> };

const echo = (form: FormData) =>
  Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

export async function saveTier(_prev: TierFormState, form: FormData): Promise<TierFormState> {
  await requireAdmin();
  const { input, errors } = parseTierForm(form);
  if (errors) return { errors, values: echo(form) };
  const id = String(form.get("id") ?? "");
  try {
    if (id) await updateTier(id, input);
    else await createTier(input);
  } catch (e) {
    return { errors: { form: `Couldn't save: ${(e as Error).message}` }, values: echo(form) };
  }
  updateTag(TIERS_TAG);
  refresh();
  return { saved: Date.now() };
}

export type DeleteState = { error?: string };

export async function removeTier(_prev: DeleteState, form: FormData): Promise<DeleteState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return {};
  try {
    await deleteTier(id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  updateTag(TIERS_TAG);
  refresh();
  return {};
}

export type SaleFormState = { errors?: SaleErrors; saved?: number; values?: Record<string, string> };

export async function recordSaleAction(_prev: SaleFormState, form: FormData): Promise<SaleFormState> {
  await requireAdmin();
  const { input, errors } = parseSaleForm(form);
  if (errors) return { errors, values: echo(form) };
  let saleId: string;
  try {
    saleId = await recordSale(input);
  } catch (e) {
    return { errors: { form: (e as Error).message }, values: echo(form) };
  }
  // Tickets + emails after the response, so the admin isn't kept waiting; failures show on the Sales page.
  after(() => fulfilSale(saleId).catch((e) => console.error(`Emails for sale ${saleId} failed:`, e)));
  // Sales change how many tickets are left on the public page.
  updateTag(TIERS_TAG);
  refresh();
  return { saved: Date.now() };
}

export async function refundSaleAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await refundSale(id);
  updateTag(TIERS_TAG);
  refresh();
}

export async function resendEmailsAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  try {
    await fulfilSale(id, { force: true });
  } catch (e) {
    console.error(`Resending emails for sale ${id} failed:`, e);
  }
  refresh();
}
