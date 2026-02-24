import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Role = "user" | "admin";

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.users.list.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchOnWindowFocus: false,
  });
  const inviteCodeQuery = trpc.admin.settings.getInviteCode.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchOnWindowFocus: false,
  });
  const setInviteCodeMutation = trpc.admin.settings.setInviteCode.useMutation({
    onSuccess: () => {
      utils.admin.settings.getInviteCode.invalidate();
    },
  });
  const updateRoleMutation = trpc.admin.users.updateRole.useMutation({
    onSuccess: () => {
      utils.admin.users.list.invalidate();
      utils.auth.me.invalidate();
    },
  });
  const deleteUserMutation = trpc.admin.users.delete.useMutation({
    onSuccess: () => {
      utils.admin.users.list.invalidate();
      utils.caseStudies.list.invalidate();
    },
  });

  const users = usersQuery.data ?? [];

  const currentInviteCode = inviteCodeQuery.data?.inviteCode ?? "";

  useEffect(() => {
    setInviteCode(currentInviteCode);
  }, [currentInviteCode]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter(item => {
      const name = (item.name ?? "").toLowerCase();
      const email = (item.email ?? "").toLowerCase();
      const openId = item.openId.toLowerCase();
      return (
        name.includes(keyword) ||
        email.includes(keyword) ||
        openId.includes(keyword)
      );
    });
  }, [users, search]);

  const handleRoleChange = async (userId: number, role: Role) => {
    try {
      setPendingUserId(userId);
      await updateRoleMutation.mutateAsync({ userId, role });
      toast.success("ロールを更新しました");
    } catch (error) {
      console.error(error);
      toast.error("ロール更新に失敗しました");
    } finally {
      setPendingUserId(null);
    }
  };

  const handleDeleteUser = async (
    userId: number,
    deleteCaseStudies: boolean,
    displayName: string
  ) => {
    const actionText = deleteCaseStudies
      ? "登録アカウントと事例を削除"
      : "登録アカウントを削除（事例は管理者に移管）";
    const confirmed = window.confirm(
      `${displayName} を ${actionText} します。よろしいですか？`
    );
    if (!confirmed) return;

    try {
      setPendingDeleteUserId(userId);
      await deleteUserMutation.mutateAsync({ userId, deleteCaseStudies });
      toast.success("ユーザーを削除しました");
    } catch (error) {
      console.error(error);
      toast.error("ユーザー削除に失敗しました");
    } finally {
      setPendingDeleteUserId(null);
    }
  };

  const handleSaveInviteCode = async () => {
    try {
      await setInviteCodeMutation.mutateAsync({ inviteCode: inviteCode.trim() });
      toast.success("招待コードを更新しました");
    } catch (error) {
      console.error(error);
      toast.error("招待コードの更新に失敗しました");
    }
  };

  const handleCopyInviteCode = async () => {
    if (!currentInviteCode) {
      toast.error("招待コードが未設定です");
      return;
    }
    try {
      await navigator.clipboard.writeText(currentInviteCode);
      toast.success("招待コードをコピーしました");
    } catch (error) {
      console.error(error);
      toast.error("コピーに失敗しました");
    }
  };

  if (loading) {
    return (
      <main className="container py-12">
        <p className="text-muted-foreground">読み込み中...</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="container py-12">
        <Card>
          <CardHeader>
            <CardTitle>管理者ページ</CardTitle>
            <CardDescription>ログインが必要です。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>ホームに戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="container py-12">
        <Card>
          <CardHeader>
            <CardTitle>403 Forbidden</CardTitle>
            <CardDescription>このページは管理者専用です。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>ホームに戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container py-12 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">管理者ページ</h1>
        <Link href="/">
          <Button variant="outline">ホームに戻る</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>招待コード設定</CardTitle>
          <CardDescription>
            @cyberagent.co.jp 以外のメールアドレスでログインする際に必要です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">現在の招待コード</p>
            <p className="text-sm font-medium break-all">
              {currentInviteCode || "未設定"}
            </p>
          </div>
          <Input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="新しい招待コードを入力（空の場合は対象外メールを拒否）"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSaveInviteCode}
              disabled={setInviteCodeMutation.isPending}
            >
              設定・変更
            </Button>
            <Button variant="outline" onClick={handleCopyInviteCode}>
              コピー
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ユーザーアカウント管理</CardTitle>
          <CardDescription>
            管理者ロールの付与/剥奪、ユーザー削除（事例を削除 or 管理者へ移管）ができます（オーナーは固定）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="名前・メール・OpenIDで検索"
          />

          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">ユーザー一覧を取得中...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">対象ユーザーがいません。</p>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map(item => {
                const isSelf = item.id === user.id;
                const isLocked = item.isOwner || isSelf;
                const isPending = pendingUserId === item.id;
                const isDeletePending = pendingDeleteUserId === item.id;
                const isDeleteLocked = isLocked || isDeletePending;
                const labelName = item.name ?? item.email ?? `user-${item.id}`;

                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.name ?? "(no name)"}</p>
                        <Badge variant={item.role === "admin" ? "default" : "secondary"}>
                          {item.role}
                        </Badge>
                        {item.isOwner && <Badge variant="outline">owner</Badge>}
                        {isSelf && <Badge variant="outline">you</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.email ?? "no email"}</p>
                      <p className="text-xs text-muted-foreground break-all">{item.openId}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={item.role === "admin" ? "default" : "outline"}
                        disabled={
                          item.role === "admin" || isLocked || isPending || isDeletePending
                        }
                        onClick={() => handleRoleChange(item.id, "admin")}
                      >
                        管理者にする
                      </Button>
                      <Button
                        variant={item.role === "user" ? "default" : "outline"}
                        disabled={
                          item.role === "user" || isLocked || isPending || isDeletePending
                        }
                        onClick={() => handleRoleChange(item.id, "user")}
                      >
                        一般ユーザーにする
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isDeleteLocked}
                        onClick={() => handleDeleteUser(item.id, false, labelName)}
                      >
                        事例を残して削除
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={isDeleteLocked}
                        onClick={() => handleDeleteUser(item.id, true, labelName)}
                      >
                        事例ごと削除
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
