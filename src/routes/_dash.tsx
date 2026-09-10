import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/lib/store";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/_dash")({ component: DashLayout });

function DashLayout() {
  const { data: session, isPending } = authClient.useSession();

  const user = useAppStore((s) => s.user);
  const hydrated = useAppStore((s) => s.hydrated);
  const setHydrated = useAppStore((s) => s.setHydrated);
  const login = useAppStore((s) => s.login);

  useEffect(() => {
    const finish = () => setHydrated();
    const unsub = useAppStore.persist.onFinishHydration(finish);

    if (useAppStore.persist.hasHydrated()) {
      finish();
    }

    return unsub;
  }, [setHydrated]);

  useEffect(() => {
    if (session?.user && !user) {
      login("employer");
    }
  }, [session?.user, user, login]);

  if (isPending || !hydrated || (session?.user && !user)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-sm text-muted">
        Loading workspace
      </div>
    );
  }

  if (!session?.user) {
    return <Navigate to="/" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}