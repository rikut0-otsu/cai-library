import { useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import type { CaseStudy } from "@/lib/caseStudies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface AddCaseModalProps {
  onClose: () => void;
  onSuccess: () => void;
  caseStudy?: CaseStudy | null;
  mode?: "create" | "edit";
}

type Category = "prompt" | "automation" | "tools" | "business" | "activation";

const categories = [
  { id: "prompt" as Category, label: "プロンプト集" },
  { id: "automation" as Category, label: "自動化" },
  { id: "tools" as Category, label: "ツール活用" },
  { id: "business" as Category, label: "業務活用" },
  { id: "activation" as Category, label: "活性化施策" },
];

function getStepFieldConfig(category: Category) {
  switch (category) {
    case "prompt":
      return {
        label: "実際のプロンプト",
        required: true,
        placeholder:
          "例: あなたは会議ファシリテーターです。以下の議事メモを整理し、ToDoと担当者を抽出してください...",
      };
    case "tools":
      return {
        label: "参考リンク",
        required: false,
        placeholder:
          "例: https://example.com (任意・1件。登録後はクリックして開けます)",
      };
    case "activation":
      return {
        label: "詳細プログラム",
        required: false,
        placeholder:
          "例: 1週目: 基礎研修 2週目: 実践ワークショップ... (任意・登録後はコピーできます)",
      };
    default:
      return {
        label: "実装ステップ",
        required: true,
        placeholder:
          "各ステップを改行で区切って入力\n例:\n1. Google Docsに会議中のメモを記録\n2. GASでドキュメントの内容を取得\n3. ChatGPT APIに送信...",
      };
  }
}

export function AddCaseModal({
  onClose,
  onSuccess,
  caseStudy,
  mode = "create",
}: AddCaseModalProps) {
  const MAX_IMAGE_WIDTH = 1200;
  const MAX_IMAGE_HEIGHT = 900;
  const JPEG_QUALITY = 0.82;
  const isEditMode = mode === "edit" && Boolean(caseStudy);

  const [formData, setFormData] = useState(() => ({
    title: caseStudy?.title ?? "",
    description: caseStudy?.description ?? "",
    category: (caseStudy?.category ?? "automation") as Category,
    tools: caseStudy?.tools?.join(", ") ?? "",
    challenge: caseStudy?.challenge ?? "",
    solution: caseStudy?.solution ?? "",
    steps: caseStudy?.steps?.join("\n") ?? "",
    impact: caseStudy?.impact ?? "",
  }));
  const [imagePreview, setImagePreview] = useState<string | null>(
    caseStudy?.thumbnailUrl ?? null
  );

  const [isSaving, setIsSaving] = useState(false);
  const stepFieldConfig = getStepFieldConfig(formData.category);
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const createMutation = trpc.caseStudies.create.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const updateMutation = trpc.caseStudies.update.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });

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
      MAX_IMAGE_WIDTH / img.width,
      MAX_IMAGE_HEIGHT / img.height
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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setImagePreview(compressedDataUrl);
    } catch (error) {
      console.error(error);
      console.error(error);
      toast.error("画像の圧縮に失敗しました");
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!isAuthenticated) {
      toast.error("ログインが必要です");
      window.location.href = getLoginUrl();
      return;
    }
    if (user?.loginMethod !== "google") {
      toast.error("Google login required to post.");
      return;
    }
    setIsSaving(true);

    const toolsArray = formData.tools
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    let stepsArray: string[] = [];
    if (formData.category === "prompt" || formData.category === "activation") {
      const text = formData.steps.trim();
      stepsArray = text ? [text] : [];
    } else if (formData.category === "tools") {
      const link = formData.steps.trim();
      stepsArray = link ? [link] : [];
    } else {
      stepsArray = formData.steps
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    if ((formData.category === "prompt" || stepFieldConfig.required) && stepsArray.length === 0) {
      toast.error(`${stepFieldConfig.label}を入力してください`);
      setIsSaving(false);
      return;
    }

    const thumbnailUrl = imagePreview ?? undefined;

    try {
      if (isEditMode && caseStudy) {
        await updateMutation.mutateAsync({
          id: caseStudy.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tools: toolsArray,
          challenge: formData.challenge,
          solution: formData.solution,
          steps: stepsArray,
          impact: formData.impact || undefined,
          thumbnailUrl,
          thumbnailKey: caseStudy.thumbnailKey ?? undefined,
        });

        toast.success("事例を更新しました");
        onSuccess();
      } else {
        await createMutation.mutateAsync({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tools: toolsArray,
          challenge: formData.challenge,
          solution: formData.solution,
          steps: stepsArray,
          impact: formData.impact || undefined,
          thumbnailUrl,
        });

        toast.success("事例を追加しました");
        onSuccess();
      }
    } catch (error) {
      toast.error(
        isEditMode ? "事例の更新に失敗しました" : "事例の追加に失敗しました"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <DialogTitle>
              {isEditMode ? "事例を編集" : "新しい事例を追加"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditMode
              ? "事例の内容を更新します"
              : "AI活用事例を共有して、チーム全体のナレッジを蓄積しましょう"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">
              タイトル <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例: 議事録を自動で構造化"
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">
              簡単な説明 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="description"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="例: 会議メモをAIが自動で整理・分類"
              className="mt-2"
            />
          </div>

          {/* Category */}
          <div>
            <Label>
              カテゴリ <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: category.id })}
                  variant={formData.category === category.id ? "default" : "outline"}
                  className={`rounded-full ${
                    formData.category === category.id
                      ? "bg-gradient-to-r from-purple-500 to-blue-500"
                      : ""
                  }`}
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div>
            <Label htmlFor="tools">
              使用ツール <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tools"
              required
              value={formData.tools}
              onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
              placeholder="例: ChatGPT, GAS (カンマ区切り)"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              カンマで区切って複数入力できます
            </p>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <Label htmlFor="thumbnail">図解・サムネイル</Label>
            <div className="mt-2">
              <input
                id="thumbnail"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="thumbnail"
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer block"
              >
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      クリックして画像を変更
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-foreground">
                      クリックまたはドラッグして画像をアップロード
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG (推奨: 1200x900px)
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Challenge */}
          <div>
            <Label htmlFor="challenge">
              解決したい課題 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="challenge"
              required
              value={formData.challenge}
              onChange={(e) => setFormData({ ...formData, challenge: e.target.value })}
              placeholder="例: 週次会議の議事録作成に毎回30分かかっており..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Solution */}
          <div>
            <Label htmlFor="solution">
              解決策 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="solution"
              required
              value={formData.solution}
              onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
              placeholder="例: Google Docsにメモしたラフな会議内容を、ChatGPT APIで..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Steps */}
          <div>
            <Label htmlFor="steps">
              {stepFieldConfig.label}
              {stepFieldConfig.required && (
                <span className="text-red-500"> *</span>
              )}
              {!stepFieldConfig.required && (
                <span className="text-muted-foreground"> (任意)</span>
              )}
            </Label>
            <Textarea
              id="steps"
              required={stepFieldConfig.required}
              value={formData.steps}
              onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
              placeholder={stepFieldConfig.placeholder}
              rows={5}
              className="mt-2"
            />
          </div>

          {/* Impact */}
          <div>
            <Label htmlFor="impact">効果・インパクト(任意)</Label>
            <Input
              id="impact"
              value={formData.impact}
              onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
              placeholder="例: 議事録作成時間が30分→5分に短縮"
              className="mt-2"
            />
          </div>

          {/* Info Note */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">
                <p className="font-medium mb-1">👀 登録後は...</p>
                <p className="text-muted-foreground">
                  タグは自動生成され、ギャラリーに公開されます。
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              キャンセル
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
              disabled={isSaving}
            >
              {isSaving
                ? "保存中..."
                : isEditMode
                  ? "更新する"
                  : "追加する"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
