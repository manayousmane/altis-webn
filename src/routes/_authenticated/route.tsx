import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.organization_id && location.pathname !== "/bienvenue") {
      throw redirect({ to: "/bienvenue" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
