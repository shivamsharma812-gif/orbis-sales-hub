import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Verify the caller is a system_admin. Throws 403 otherwise. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "system_admin",
  });
  if (error) throw new Response("Forbidden", { status: 403 });
  if (!data) throw new Response("Forbidden — system admin only", { status: 403 });
}


interface InviteInput {
  full_name: string;
  email: string;
  phone?: string | null;
  designation: string;
  department?: string;
  reports_to_user_id?: string | null;
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): InviteInput => {
    const d = raw as Record<string, unknown>;
    if (!d.full_name || typeof d.full_name !== "string") throw new Error("full_name required");
    if (!d.email || typeof d.email !== "string") throw new Error("email required");
    if (!d.designation || typeof d.designation !== "string")
      throw new Error("designation required");
    return {
      full_name: d.full_name.trim(),
      email: d.email.trim().toLowerCase(),
      phone: (d.phone as string) ?? null,
      designation: d.designation,
      department: (d.department as string) ?? "Sales",
      reports_to_user_id: (d.reports_to_user_id as string) || null,
    };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Find or create the public.users row
    let appUserId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, auth_user_id")
      .eq("email", data.email)
      .maybeSingle();

    if (existing) {
      appUserId = existing.id;
      if (existing.auth_user_id) {
        return { ok: false, error: "This user has already been invited." };
      }
    } else {
      const { data: created, error: createErr } = await supabaseAdmin
        .from("users")
        .insert({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          designation: data.designation,
          department: data.department ?? "Sales",
          reports_to_user_id: data.reports_to_user_id,
          status: "active",
        })
        .select("id")
        .single();
      if (createErr || !created) return { ok: false, error: createErr?.message ?? "Insert failed" };
      appUserId = created.id;
    }

    // 2. Send Supabase invite email
    const origin =
      process.env.PUBLIC_APP_URL ??
      `https://project--${process.env.SUPABASE_PROJECT_ID ?? ""}.lovable.app`;
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        redirectTo: `${origin}/auth/set-password`,
        data: { full_name: data.full_name },
      },
    );
    if (inviteErr || !invited?.user) {
      return { ok: false, error: inviteErr?.message ?? "Invite failed" };
    }

    // 3. Link auth user back to app user row
    await supabaseAdmin
      .from("users")
      .update({ auth_user_id: invited.user.id })
      .eq("id", appUserId);

    return { ok: true, app_user_id: appUserId, auth_user_id: invited.user.id };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = raw as { email: string };
    if (!d.email) throw new Error("email required");
    return { email: d.email.trim().toLowerCase() };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin =
      process.env.PUBLIC_APP_URL ??
      `https://project--${process.env.SUPABASE_PROJECT_ID ?? ""}.lovable.app`;
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: `${origin}/auth/set-password`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = raw as { user_id: string; status: "active" | "inactive" };
    if (!d.user_id) throw new Error("user_id required");
    if (d.status !== "active" && d.status !== "inactive") throw new Error("bad status");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Update our row
    const { data: row } = await supabaseAdmin
      .from("users")
      .update({ status: data.status })
      .eq("id", data.user_id)
      .select("auth_user_id")
      .single();
    // If inactive, ban auth login; if active, unban
    if (row?.auth_user_id) {
      await supabaseAdmin.auth.admin.updateUserById(row.auth_user_id, {
        ban_duration: data.status === "inactive" ? "876000h" : "none",
      });
    }
    return { ok: true };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const d = raw as { user_id: string; grant: boolean };
    if (!d.user_id) throw new Error("user_id required");
    return { user_id: d.user_id, grant: !!d.grant };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("users")
      .select("auth_user_id")
      .eq("id", data.user_id)
      .single();
    if (!row?.auth_user_id) return { ok: false, error: "User has no login yet." };
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: row.auth_user_id, role: "system_admin" });
      if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", row.auth_user_id)
        .eq("role", "system_admin");
    }
    return { ok: true };
  });
