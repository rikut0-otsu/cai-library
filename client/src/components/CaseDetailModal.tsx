import { type CaseStudy } from "@/lib/caseStudies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, ExternalLink, Heart, Pencil, Pin, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const REFERENCE_LINK_PREFIX = "__reference_link__:";

interface CaseDetailModalProps {
  caseStudy: CaseStudy | null;
  onClose: () => void;
  onFavoriteToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
  onAuthorClick: (userId: number) => void;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  onPin: (id: number) => void;
  onShare: (id: number) => void;
}

export function CaseDetailModal({
  caseStudy,
  onClose,
  onFavoriteToggle,
  onDelete,
  onEdit,
  onAuthorClick,
  canEdit,
  canDelete,
  canPin,
  onPin,
  onShare,
}: CaseDetailModalProps) {

  if (!caseStudy) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">事例が見つかりませんでした</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleFavoriteClick = () => {
    onFavoriteToggle(caseStudy.id);
  };

  const handleDeleteClick = () => {
    onDelete(caseStudy.id);
  };

  const handleEditClick = () => {
    onEdit(caseStudy.id);
  };
  const handlePinClick = () => {
    onPin(caseStudy.id);
  };
  const handleShareClick = () => {
    onShare(caseStudy.id);
  };

  const isEdited =
    typeof caseStudy.updatedAt === "number" &&
    caseStudy.updatedAt > caseStudy.createdAt;
  const formatDateTime = (timestamp: number) =>
    new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  const referenceLinkFromSteps = caseStudy.steps.find((item) =>
    item.startsWith(REFERENCE_LINK_PREFIX)
  );
  const referenceLink =
    caseStudy.category === "tools"
      ? (caseStudy.steps[0] ?? "")
      : (referenceLinkFromSteps?.slice(REFERENCE_LINK_PREFIX.length).trim() ?? "");
  const stepText =
    caseStudy.category === "tools"
      ? ""
      : caseStudy.steps
          .filter((item) => !item.startsWith(REFERENCE_LINK_PREFIX))
          .join("\n");
  const canOpenReferenceLink = /^https?:\/\//i.test(referenceLink);

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label}をコピーしました`);
    } catch (error) {
      console.error(error);
      toast.error("コピーに失敗しました");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <DialogTitle className="text-2xl leading-tight break-words">
                {caseStudy.title}
              </DialogTitle>
              {isEdited && <Badge variant="outline">編集済み</Badge>}
            </div>
            <div className="hidden items-center justify-end gap-2 shrink-0 sm:flex sm:self-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFavoriteClick}
                aria-label="Toggle favorite"
              >
                <Heart
                  className={`w-5 h-5 ${
                    caseStudy.isFavorite ? "fill-red-500 text-red-500" : ""
                  }`}
                />
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEditClick}
                  aria-label="Edit case study"
                >
                  <Pencil className="w-5 h-5" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteClick}
                  className="text-destructive hover:text-destructive"
                  aria-label="Delete case study"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              )}
              {canPin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePinClick}
                  aria-label="Pin case study to top"
                >
                  <Pin className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShareClick}
                aria-label="Share case study"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <DialogDescription className="text-base text-left">
            {caseStudy.description}
          </DialogDescription>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                作成者:
                <button
                  type="button"
                  onClick={() => onAuthorClick(caseStudy.userId)}
                  className="ml-1 underline underline-offset-2 hover:text-foreground"
                >
                  {caseStudy.authorName || "不明"}
                </button>
              </p>
              <p className="text-xs text-muted-foreground">
                投稿日: {formatDateTime(caseStudy.createdAt)}
              </p>
              {isEdited && (
                <p className="text-xs text-muted-foreground">
                  編集日: {formatDateTime(caseStudy.updatedAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 sm:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleFavoriteClick}
                aria-label="Toggle favorite"
              >
                <Heart
                  className={`w-4 h-4 ${
                    caseStudy.isFavorite ? "fill-red-500 text-red-500" : ""
                  }`}
                />
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleEditClick}
                  aria-label="Edit case study"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={handleDeleteClick}
                  aria-label="Delete case study"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              {canPin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePinClick}
                  aria-label="Pin case study to top"
                >
                  <Pin className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleShareClick}
                aria-label="Share case study"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Thumbnail */}
          {caseStudy.thumbnailUrl && (
            <div className="w-full rounded-lg overflow-hidden">
              <img
                src={caseStudy.thumbnailUrl}
                alt={caseStudy.title}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Tools */}
          <div>
            <h3 className="font-semibold text-lg mb-2">使用ツール</h3>
            <div className="flex flex-wrap gap-2">
              {caseStudy.tools.map((tool: string) => (
                <Badge key={tool} variant="secondary">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>

          {/* Challenge */}
          <div>
            <h3 className="font-semibold text-lg mb-2">解決したい課題</h3>
            <p className="text-foreground leading-relaxed">{caseStudy.challenge}</p>
          </div>

          {/* Solution */}
          <div>
            <h3 className="font-semibold text-lg mb-2">解決策</h3>
            <p className="text-foreground leading-relaxed">{caseStudy.solution}</p>
          </div>

          {/* Steps / Category-specific field */}
          {caseStudy.category === "prompt" ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold text-lg">実際のプロンプト</h3>
                {stepText.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(stepText, "実際のプロンプト")}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    コピー
                  </Button>
                )}
              </div>
              {stepText.trim() ? (
                <pre className="text-foreground leading-relaxed whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
                  {stepText}
                </pre>
              ) : (
                <p className="text-muted-foreground">未設定</p>
              )}
            </div>
          ) : caseStudy.category === "tools" ? (
            <div>
              <h3 className="font-semibold text-lg mb-2">参考リンク</h3>
              {referenceLink ? (
                canOpenReferenceLink ? (
                  <a
                    href={referenceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline break-all"
                  >
                    {referenceLink}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <p className="text-muted-foreground break-all">
                    {referenceLink}
                  </p>
                )
              ) : (
                <p className="text-muted-foreground">未設定</p>
              )}
            </div>
          ) : caseStudy.category === "activation" ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold text-lg">詳細プログラム</h3>
                {stepText.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(stepText, "詳細プログラム")}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    コピー
                  </Button>
                )}
              </div>
              {stepText.trim() ? (
                <pre className="text-foreground leading-relaxed whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
                  {stepText}
                </pre>
              ) : (
                <p className="text-muted-foreground">未設定</p>
              )}
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-lg mb-2">実装ステップ</h3>
              <ol className="list-decimal list-inside space-y-2">
                {caseStudy.steps.map((step: string, index: number) => (
                  <li key={index} className="text-foreground leading-relaxed">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {caseStudy.category !== "tools" && (
            <div>
              <h3 className="font-semibold text-lg mb-2">参考リンク</h3>
              {referenceLink ? (
                canOpenReferenceLink ? (
                  <a
                    href={referenceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline break-all"
                  >
                    {referenceLink}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <p className="text-muted-foreground break-all">{referenceLink}</p>
                )
              ) : (
                <p className="text-muted-foreground">未設定</p>
              )}
            </div>
          )}

          {/* Impact */}
          {caseStudy.impact && (
            <div>
              <h3 className="font-semibold text-lg mb-2">効果・インパクト</h3>
              <p className="text-foreground leading-relaxed font-medium text-purple-600">
                {caseStudy.impact}
              </p>
            </div>
          )}

          {/* Tags */}
          <div>
            <h3 className="font-semibold text-lg mb-2">タグ</h3>
            <div className="flex flex-wrap gap-2">
              {caseStudy.tags.map((tag: string) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
