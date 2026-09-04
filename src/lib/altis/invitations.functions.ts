import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(16).max(64) });

const acceptSchema = z.object({
  token: z.string().min(16).max(64),
  password: z.string().min(8).max(72),
});

export const getInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("id, first_name, last_name, email, kind, activated_at, organization_id")
      .eq("invite_token", data.token)
      .maybeSingle();

    if (!member) return { found: false as const };

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", member.organization_id)
      .maybeSingle();

    return {
      found: true as const,
      firstName: member.first_name,
      lastName: member.last_name,
      email: member.email,
      kind: member.kind,
      organizationName: org?.name ?? "",
      activated: member.activated_at !== null,
    };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .inputValidator((input) => acceptSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await supabaseAdmin
      .from("members")
      .select("id, first_name, last_name, email, kind, organization_id, user_id, activated_at")
      .eq("invite_token", data.token)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!member) return { ok: false as const, message: "Cette invitation n'est plus valide." };
    if (member.activated_at)
      return { ok: false as const, message: "Cette invitation a déjà été utilisée." };

    const created = await supabaseAdmin.auth.admin.createUser({
      email: member.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: member.first_name, last_name: member.last_name },
    });

    let userId = created.data.user?.id ?? null;

    if (!userId) {
      // Le compte existe déjà : on réutilise l'identité et on met le mot de passe à jour.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users.find(
        (u) => (u.email ?? "").toLowerCase() === member.email.toLowerCase(),
      );
      if (!existing) {
        return {
          ok: false as const,
          message: created.error?.message ?? "Impossible de créer le compte.",
        };
      }
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        email_confirm: true,
      });
      userId = existing.id;
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: member.email,
        first_name: member.first_name,
        last_name: member.last_name,
        organization_id: member.organization_id,
      },
      { onConflict: "id" },
    );

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: userId, role: member.kind, organization_id: member.organization_id },
        { onConflict: "user_id,role" },
      );

    await supabaseAdmin
      .from("members")
      .update({
        user_id: userId,
        activated_at: new Date().toISOString(),
        invite_token: null,
      })
      .eq("id", member.id);

    return { ok: true as const, email: member.email };
  });
