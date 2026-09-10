import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Github } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/")({ component: Login });

function Login() {
  const { data: session, isPending } = authClient.useSession();
  const setHydrated = useAppStore((s) => s.setHydrated);
  const login = useAppStore((s) => s.login);
  const navigate = useNavigate();

useEffect(() => {
  setHydrated();
}, [setHydrated]);

useEffect(() => {
  if (session?.user) {
    login("employer");
    void navigate({ to: "/repos" });
  }
}, [session?.user, login, navigate]);

  if (isPending) {
    return null;
  }

  

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-md bg-accent text-lg font-semibold text-accent-fg">
          C
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Codeval</h1>

        <p className="mt-2 text-sm text-muted">
          Score, question, and staff from evidence in your GitHub org — not from vibes.
        </p>

        <div className="mt-8 space-y-2">
          <Button
            className="h-11 w-full"
            onClick={async () => {
              const { error } = await authClient.signIn.social({
                provider: "github",
                callbackURL: "/repos",
                errorCallbackURL: "/",
              });

              if (error) {
                console.error("GitHub sign-in failed:", error);
              }
            }}
          >
            <Github className="size-4" />
            Continue with GitHub
          </Button>

          <Button
            variant="secondary"
            className="h-11 w-full"
            onClick={() => {
              login("admin");
              void navigate({ to: "/repos" });
            }}
          >
            Continue as org admin
          </Button>
        </div>

        <p className="mt-4 text-[11px] text-subtle">
          Demo identities: Jordan Vale (employer) · Maya Chen (admin). Scoped to acme.
        </p>
      </div>
    </main>
  );
}