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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Role = "user" | "admin";
type UserSortOption =
  | "createdDesc"
  | "createdAsc"
  | "nameAsc"
  | "nameDesc"
  | "lastSignedInDesc"
  | "roleAdminFirst";

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<number | null>(null);
  const [userSort, setUserSort] = useState<UserSortOption>("createdDesc");
  const [userPage, setUserPage] = useState(1);
  const [inquiryTab, setInquiryTab] = useState<"open" | "resolved">("open");
  const [inquiryPage, setInquiryPage] = useState(1);
  const [pendingInquiryId, setPendingInquiryId] = useState<number | null>(null);
  const [dashboardPage, setDashboardPage] = useState(1);

  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.users.list.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchOnWindowFocus: false,
  });
  const inviteCodeQuery = trpc.admin.settings.getInviteCode.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchOnWindowFocus: false,
  });
  const inquiriesQuery = trpc.admin.inquiries.list.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
    refetchOnWindowFocus: false,
  });
  const dashboardQuery = trpc.admin.dashboard.metrics.useQuery(undefined, {
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
  const updateInquiryStatusMutation = trpc.admin.inquiries.updateStatus.useMutation({
    onSuccess: () => {
      utils.admin.inquiries.list.invalidate();
    },
  });
  const deleteInquiryMutation = trpc.admin.inquiries.delete.useMutation({
    onSuccess: () => {
      utils.admin.inquiries.list.invalidate();
    },
  });

  const users = usersQuery.data ?? [];

  const currentInviteCode = inviteCodeQuery.data?.inviteCode ?? "";
  const inquiries = inquiriesQuery.data ?? [];
  const dashboardMetrics = dashboardQuery.data;
  const popularCaseStudies = dashboardMetrics?.popularCaseStudies ?? [];
  const dashboardTotals = dashboardMetrics?.totals ?? {
    users: 0,
    caseStudies: 0,
    favorites: 0,
  };
  const dashboardPageSize = 5;
  const dashboardTotalPages = Math.max(
    1,
    Math.ceil(popularCaseStudies.length / dashboardPageSize)
  );
  const pagedPopularCaseStudies = useMemo(() => {
    const start = (dashboardPage - 1) * dashboardPageSize;
    return popularCaseStudies.slice(start, start + dashboardPageSize);
  }, [popularCaseStudies, dashboardPage]);

  useEffect(() => {
    setInviteCode(currentInviteCode);
  }, [currentInviteCode]);
  useEffect(() => {
    setInquiryPage(1);
  }, [inquiryTab]);

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
  const sortedUsers = useMemo(() => {
    const items = [...filteredUsers];
    switch (userSort) {
      case "createdAsc":
        return items.sort((a, b) => a.createdAt - b.createdAt);
      case "nameAsc":
        return items.sort((a, b) =>
          (a.name ?? a.email ?? a.openId).localeCompare(
            b.name ?? b.email ?? b.openId,
            "ja"
          )
        );
      case "nameDesc":
        return items.sort((a, b) =>
          (b.name ?? b.email ?? b.openId).localeCompare(
            a.name ?? a.email ?? a.openId,
            "ja"
          )
        );
      case "lastSignedInDesc":
        return items.sort((a, b) => b.lastSignedIn - a.lastSignedIn);
      case "roleAdminFirst":
        return items.sort((a, b) => {
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return b.createdAt - a.createdAt;
        });
      case "createdDesc":
      default:
        return items.sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [filteredUsers, userSort]);
  const userPageSize = 10;
  const userTotalPages = Math.max(1, Math.ceil(sortedUsers.length / userPageSize));
  const pagedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return sortedUsers.slice(start, start + userPageSize);
  }, [sortedUsers, userPage]);
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((item) =>
      inquiryTab === "open" ? item.isResolved !== 1 : item.isResolved === 1
    );
  }, [inquiries, inquiryTab]);
  const inquiryPageSize = 3;
  const inquiryTotalPages = Math.max(1, Math.ceil(filteredInquiries.length / inquiryPageSize));
  const pagedInquiries = useMemo(() => {
    const start = (inquiryPage - 1) * inquiryPageSize;
    return filteredInquiries.slice(start, start + inquiryPageSize);
  }, [filteredInquiries, inquiryPage]);
  useEffect(() => {
    setInquiryPage((prev) => Math.min(prev, inquiryTotalPages));
  }, [inquiryTotalPages]);
  useEffect(() => {
    setUserPage(1);
  }, [search, userSort]);
  useEffect(() => {
    setUserPage((prev) => Math.min(prev, userTotalPages));
  }, [userTotalPages]);
  useEffect(() => {
    setDashboardPage((prev) => Math.min(prev, dashboardTotalPages));
  }, [dashboardTotalPages]);

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
  const handleInquiryStatusChange = async (id: number, checked: boolean) => {
    try {
      setPendingInquiryId(id);
      await updateInquiryStatusMutation.mutateAsync({ id, isResolved: checked });
      toast.success(checked ? "問い合わせを完了にしました" : "問い合わせを確認中に戻しました");
    } catch (error) {
      console.error(error);
      toast.error("問い合わせ状態の更新に失敗しました");
    } finally {
      setPendingInquiryId(null);
    }
  };
  const handleDeleteInquiry = async (id: number, title: string) => {
    if (!user?.isOwner) return;
    const confirmed = window.confirm(`問い合わせ「${title}」を削除します。よろしいですか？`);
    if (!confirmed) return;
    try {
      setPendingInquiryId(id);
      await deleteInquiryMutation.mutateAsync({ id });
      toast.success("問い合わせを削除しました");
    } catch (error) {
      console.error(error);
      toast.error("問い合わせ削除に失敗しました");
    } finally {
      setPendingInquiryId(null);
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
          <CardTitle>問い合わせ一覧</CardTitle>
          <CardDescription>一般ユーザーから送られた報告内容を確認できます。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Tabs
              value={inquiryTab}
              onValueChange={(value) => setInquiryTab(value as "open" | "resolved")}
            >
              <TabsList>
                <TabsTrigger value="open">確認中</TabsTrigger>
                <TabsTrigger value="resolved">完了</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {filteredInquiries.length} 件
            </p>
          </div>
          {inquiriesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">問い合わせを取得中...</p>
          ) : filteredInquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground">問い合わせはありません。</p>
          ) : (
            <div className="space-y-3">
              {pagedInquiries.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.isResolved === 1}
                        disabled={pendingInquiryId === item.id}
                        onCheckedChange={(checked) =>
                          handleInquiryStatusChange(item.id, checked === true)
                        }
                        aria-label="Mark inquiry as resolved"
                      />
                      <p className="font-medium break-all">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.isResolved === 1 ? "default" : "secondary"}>
                        {item.isResolved === 1 ? "完了" : "確認中"}
                      </Badge>
                      <Badge variant="outline">
                        {new Date(item.createdAt).toLocaleString("ja-JP")}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    送信者: {item.userName || "不明"} {item.userEmail ? `(${item.userEmail})` : ""}
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">{item.content}</p>
                  {user?.isOwner && (
                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pendingInquiryId === item.id}
                        onClick={() => handleDeleteInquiry(item.id, item.title)}
                      >
                        問い合わせを削除
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {inquiryTotalPages > 1 && (
                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={inquiryPage <= 1}
                    onClick={() => setInquiryPage((prev) => Math.max(1, prev - 1))}
                  >
                    前へ
                  </Button>
                  <p className="text-xs text-muted-foreground min-w-16 text-center">
                    {inquiryPage} / {inquiryTotalPages}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={inquiryPage >= inquiryTotalPages}
                    onClick={() =>
                      setInquiryPage((prev) => Math.min(inquiryTotalPages, prev + 1))
                    }
                  >
                    次へ
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ダッシュボード</CardTitle>
          <CardDescription>
            人気投稿ランキングと全体のお気に入り数を確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboardQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">ダッシュボードを取得中...</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">総お気に入り数</p>
                  <p className="text-2xl font-semibold">{dashboardTotals.favorites}</p>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">投稿数</p>
                  <p className="text-2xl font-semibold">{dashboardTotals.caseStudies}</p>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">登録ユーザー数</p>
                  <p className="text-2xl font-semibold">{dashboardTotals.users} 人</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">人気投稿ランキング（お気に入り数）</p>
                  <p className="text-xs text-muted-foreground">
                    {popularCaseStudies.length} 件中
                  </p>
                </div>
                {popularCaseStudies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">人気投稿データはありません。</p>
                ) : (
                  <div className="space-y-2">
                    {pagedPopularCaseStudies.map((item, index) => (
                      <div key={item.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {(dashboardPage - 1) * dashboardPageSize + index + 1}. {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            投稿者: {item.authorName} / {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                          </p>
                        </div>
                        <Badge variant="outline">{item.favoriteCount} お気に入り</Badge>
                      </div>
                    ))}
                    {dashboardTotalPages > 1 && (
                      <div className="pt-2 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={dashboardPage <= 1}
                          onClick={() => setDashboardPage((prev) => Math.max(1, prev - 1))}
                        >
                          前へ
                        </Button>
                        <p className="text-xs text-muted-foreground min-w-16 text-center">
                          {dashboardPage} / {dashboardTotalPages}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={dashboardPage >= dashboardTotalPages}
                          onClick={() =>
                            setDashboardPage((prev) => Math.min(dashboardTotalPages, prev + 1))
                          }
                        >
                          次へ
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ユーザーアカウント管理
            <Badge variant="outline">合計 {users.length} 人</Badge>
          </CardTitle>
          <CardDescription>
            管理者ロールの付与/剥奪、ユーザー削除（事例を削除 or 管理者へ移管）ができます（オーナーは固定）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="名前・メール・OpenIDで検索"
              className="md:max-w-md"
            />
            <div className="flex items-center gap-2 md:shrink-0">
              <p className="text-xs text-muted-foreground">並び替え</p>
              <Select
                value={userSort}
                onValueChange={(value) => setUserSort(value as UserSortOption)}
              >
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="並び替え" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdDesc">登録日が新しい順</SelectItem>
                  <SelectItem value="createdAsc">登録日が古い順</SelectItem>
                  <SelectItem value="lastSignedInDesc">最終ログインが新しい順</SelectItem>
                  <SelectItem value="nameAsc">名前 A-Z</SelectItem>
                  <SelectItem value="nameDesc">名前 Z-A</SelectItem>
                  <SelectItem value="roleAdminFirst">管理者を先頭</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {sortedUsers.length} 件表示中
          </p>

          {usersQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">ユーザー一覧を取得中...</p>
          ) : sortedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">対象ユーザーがいません。</p>
          ) : (
            <div className="space-y-3">
              {pagedUsers.map(item => {
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

                    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto">
                      <Button
                        variant={item.role === "admin" ? "default" : "outline"}
                        className="w-full"
                        disabled={
                          item.role === "admin" || isLocked || isPending || isDeletePending
                        }
                        onClick={() => handleRoleChange(item.id, "admin")}
                      >
                        管理者にする
                      </Button>
                      <Button
                        variant={item.role === "user" ? "default" : "outline"}
                        className="w-full"
                        disabled={
                          item.role === "user" || isLocked || isPending || isDeletePending
                        }
                        onClick={() => handleRoleChange(item.id, "user")}
                      >
                        一般ユーザーにする
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={isDeleteLocked}
                        onClick={() => handleDeleteUser(item.id, false, labelName)}
                      >
                        事例を残して削除
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={isDeleteLocked}
                        onClick={() => handleDeleteUser(item.id, true, labelName)}
                      >
                        事例ごと削除
                      </Button>
                    </div>
                  </div>
                );
              })}
              {userTotalPages > 1 && (
                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                  >
                    前へ
                  </Button>
                  <p className="text-xs text-muted-foreground min-w-16 text-center">
                    {userPage} / {userTotalPages}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={userPage >= userTotalPages}
                    onClick={() =>
                      setUserPage((prev) => Math.min(userTotalPages, prev + 1))
                    }
                  >
                    次へ
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
