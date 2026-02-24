import { useAuth } from "@/_core/hooks/useAuth";
import type { ReactNode } from "react";

type RequireAuthProps = {
  children: ReactNode;
};

export default function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });

  if (loading || !isAuthenticated) {
    return (
      <main className="container py-12">
        <p className="text-muted-foreground">読み込み中...</p>
      </main>
    );
  }

  return <>{children}</>;
}
