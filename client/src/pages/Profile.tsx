import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

export default function Profile() {
  const MAX_AVATAR_WIDTH = 512;
  const MAX_AVATAR_HEIGHT = 512;
  const JPEG_QUALITY = 0.82;
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
  });
  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation();

  const [name, setName] = useState("");
  const [departmentRole, setDepartmentRole] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!profileQuery.data) return;
    setName(profileQuery.data.user.name ?? "");
    setDepartmentRole(profileQuery.data.user.departmentRole ?? "");
    setAvatarPreview(profileQuery.data.user.avatarUrl || null);
  }, [profileQuery.data]);

  const canSave = useMemo(
    () =>
      name.trim().length > 0 &&
      !updateMutation.isPending &&
      !uploadAvatarMutation.isPending,
    [name, updateMutation.isPending, uploadAvatarMutation.isPending]
  );

  const readFileAsDataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image."));
      reader.readAsDataURL(file);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = src;
    });

  const compressImage = async (file: File) => {
    const originalDataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(originalDataUrl);

    const scale = Math.min(
      1,
      MAX_AVATAR_WIDTH / img.width,
      MAX_AVATAR_HEIGHT / img.height
    );
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context.");
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    if (!blob) {
      throw new Error("Failed to compress image.");
    }

    return readFileAsDataUrl(blob);
  };

  const extractBase64Data = (dataUrl: string) => {
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex < 0) throw new Error("Invalid data URL.");
    return dataUrl.slice(commaIndex + 1);
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setAvatarPreview(compressedDataUrl);
    } catch (error) {
      console.error(error);
      toast.error("画像の圧縮に失敗しました");
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    try {
      let avatarUrlToSave = avatarPreview || "";

      if (avatarPreview?.startsWith("data:")) {
        try {
          const uploaded = await uploadAvatarMutation.mutateAsync({
            filename: "avatar.jpg",
            contentType: "image/jpeg",
            base64Data: extractBase64Data(avatarPreview),
          });
          avatarUrlToSave = uploaded.url;
        } catch (uploadError) {
          console.error(uploadError);
          // Fallback: keep compressed data URL when storage upload is unavailable.
          avatarUrlToSave = avatarPreview;
        }
      }

      await updateMutation.mutateAsync({
        name: name.trim(),
        departmentRole: departmentRole.trim(),
        avatarUrl: avatarUrlToSave,
      });
    } catch (error) {
      console.error(error);
      toast.error("プロフィールの保存に失敗しました");
    }
  };

  return (
    <main className="container py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">プロフィール</h1>
          <p className="text-sm text-muted-foreground mt-1">
            表示名・部署情報・アイコン画像を登録できます
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
            <p className="text-sm font-medium">プロフィール画像</p>
            <div className="flex items-center gap-4">
              <Avatar className="size-20 border">
                <AvatarImage src={avatarPreview ?? undefined} alt="プロフィール画像" />
                <AvatarFallback>{(name || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <label htmlFor="avatar-upload">
                  <Button type="button" variant="outline" asChild>
                    <span className="inline-flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      画像を選択
                    </span>
                  </Button>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAvatarPreview(null)}
                  disabled={!avatarPreview}
                >
                  画像を削除
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              PNG/JPG推奨。保存時に円形アイコンとして表示されます。
            </p>
          </div>
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
            {updateMutation.isPending || uploadAvatarMutation.isPending ? "保存中..." : "保存する"}
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
