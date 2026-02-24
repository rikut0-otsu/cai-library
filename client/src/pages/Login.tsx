import { getLoginUrl, getOwnerContactHref } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, CircleHelp, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const ownerContactHref = getOwnerContactHref();
  const [inviteCode, setInviteCode] = useState("");
  const errorMessage = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("error") ?? "";
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleLoginClick = () => {
    window.location.href = getLoginUrl({ inviteCode });
  };

  const handleSelectAccountClick = () => {
    window.location.href = getLoginUrl({ selectAccount: true, inviteCode });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-14 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(59,130,246,0.12),transparent_45%)]" />

      <div className="container flex min-h-screen flex-col items-center justify-center py-10">
        <Card className="w-full max-w-xl border-slate-700/70 bg-slate-900/60 shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-5 text-center">
            <img
              src="/logo.png"
              alt="Service logo"
              className="mx-auto h-auto w-full max-w-sm object-contain"
            />
            <CardDescription className="text-sm leading-6 text-slate-300">
              このサービスはログインしたユーザーのみ利用できます。
              <br />
              Googleアカウントでサインインして開始してください。
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {errorMessage && (
              <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            )}
            <div className="space-y-2">
              <p className="text-sm text-slate-300">招待コード（対象外メールのみ必須）</p>
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="招待コードを入力"
                className="h-11 border-slate-600 bg-slate-800/70 text-slate-100 placeholder:text-slate-400"
              />
            </div>
            <Button
              onClick={handleLoginClick}
              className="h-11 w-full rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Googleでログイン
            </Button>
            <Button
              onClick={handleSelectAccountClick}
              variant="outline"
              className="h-11 w-full rounded-xl border-slate-600 bg-slate-800/70 text-slate-100 hover:bg-slate-700"
            >
              アカウントを選んでログイン
            </Button>

            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                <CircleHelp className="h-4 w-4" />
                ログインできない場合
              </div>

              {ownerContactHref ? (
                <a
                  href={ownerContactHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-cyan-300 underline underline-offset-4"
                >
                  オーナーへ問い合わせる
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-sm text-slate-400">
                  問い合わせ先は管理者にご確認ください。
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Google OAuthを利用してログインします
            </div>
          </CardContent>
        </Card>

        <footer className="mt-6 text-center text-xs text-slate-400">
          Created by Rikuto Otsu
        </footer>
      </div>
    </main>
  );
}
