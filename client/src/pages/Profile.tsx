import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

export default function Profile() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const profileQuery = trpc.profile.me.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: async () => {
      toast.success("プロフィールを保存しました");
      await Promise.all([
        utils.profile.me.invalidate(),
        utils.auth.me.invalidate(),
        utils.caseStudies.list.invalidate(),
      ]);
    },
    onError: () => {
      toast.error("プロフィールの保存に失敗しました");
    },
  });

  const [name, setName] = useState("");
  const [departmentRole, setDepartmentRole] = useState("");

  useEffect(() => {
    if (!profileQuery.data) return;
    setName(profileQuery.data.user.name ?? "");
    setDepartmentRole(profileQuery.data.user.departmentRole ?? "");
  }, [profileQuery.data]);

  const canSave = useMemo(
    () => name.trim().length > 0 && !updateMutation.isPending,
    [name, updateMutation.isPending]
  );

  const handleSave = async () => {
    if (!canSave) return;
    await updateMutation.mutateAsync({
      name: name.trim(),
      departmentRole: departmentRole.trim(),
    });
  };

  return (
    <main className="container py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">プロフィール</h1>
          <p className="text-sm text-muted-foreground mt-1">
            表示名と部署・職種を登録できます
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">一覧に戻る</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>作成者表示に使われる情報です</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">名前</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="表示名を入力"
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">部署・職種</p>
            <Input
              value={departmentRole}
              onChange={(e) => setDepartmentRole(e.target.value)}
              placeholder="例: 営業部 / マネージャー"
              maxLength={120}
            />
          </div>
          {user?.email && (
            <p className="text-xs text-muted-foreground">ログイン中: {user.email}</p>
          )}
          <Button onClick={handleSave} disabled={!canSave}>
            保存する
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登録した事例</CardTitle>
          <CardDescription>
            {profileQuery.data?.caseStudies.length ?? 0} 件
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profileQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : (profileQuery.data?.caseStudies.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">まだ事例はありません</p>
          ) : (
            <div className="space-y-3">
              {profileQuery.data?.caseStudies.map((caseStudy) => (
                <div key={caseStudy.id} className="rounded-lg border p-3">
                  <p className="font-medium">{caseStudy.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{caseStudy.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {caseStudy.tools.map((tool) => (
                      <Badge key={tool} variant="secondary">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
