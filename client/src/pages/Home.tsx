import { type CaseStudy } from "@/lib/caseStudies";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, Heart, LogOut, Moon, Pencil, Plus, Repeat, Search, Share2, Sparkles, Sun, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AddCaseModal } from "@/components/AddCaseModal";
import { CaseDetailModal } from "@/components/CaseDetailModal";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { AIConsultButton } from "@/components/AIConsultButton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Category =
  | "all"
  | "liked"
  | "prompt"
  | "automation"
  | "tools"
  | "business"
  | "activation";

type SortOption = "default" | "createdDesc" | "createdAsc" | "updatedDesc";
type SharePayload = {
  id: number;
  title: string;
  authorName: string;
};

const categories = [
  { id: "all" as Category, label: "ALL" },
  { id: "liked" as Category, label: "❤️お気に入り" },
  { id: "prompt" as Category, label: "プロンプト集" },
  { id: "automation" as Category, label: "自動化" },
  { id: "tools" as Category, label: "ツール活用" },
  { id: "business" as Category, label: "業務活用" },
  { id: "activation" as Category, label: "活性化施策" },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { isAuthenticated, user, logout } = useAuth();
  const isMobile = useIsMobile();
  const canPost = isAuthenticated && user?.loginMethod === "google";
  const listQuery = trpc.caseStudies.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const cases: CaseStudy[] = listQuery.data ?? [];
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("default");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryTitle, setInquiryTitle] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);
  const [celebrationPayload, setCelebrationPayload] = useState<SharePayload | null>(null);
  const { theme, toggleTheme, switchable } = useTheme();
  const toggleFavoriteMutation = trpc.caseStudies.toggleFavorite.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const pinToTopMutation = trpc.caseStudies.pinToTop.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const deleteMutation = trpc.caseStudies.delete.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const submitInquiryMutation = trpc.inquiries.submit.useMutation();
  const selectedCase = selectedCaseId
    ? cases.find((item) => item.id === selectedCaseId) ?? null
    : null;
  const editingCase = editingCaseId
    ? cases.find((item) => item.id === editingCaseId) ?? null
    : null;
  const canManageSelected =
    Boolean(selectedCase) &&
    Boolean(user) &&
    selectedCase?.userId === user?.id;
  const canEditSelected = canManageSelected && user?.loginMethod === "google";
  const canDeleteSelected =
    Boolean(selectedCase) &&
    Boolean(user) &&
    (selectedCase?.userId === user?.id || user?.role === "admin");
  const canPinSelected = Boolean(selectedCase) && Boolean(user?.isOwner);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = sharePayload ? `${origin}/?caseId=${sharePayload.id}` : "";
  const shareMessage = sharePayload
    ? `${sharePayload.authorName}さんが「${sharePayload.title}」をCAI LIBRARYに追加しました！あなたもログインしてチェックしよう！`
    : "";
  const shareText = sharePayload ? `${shareMessage}\n${shareUrl}` : "";

  const filteredCases = useMemo(() => {
    const filtered = cases.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "all" ||
        (activeCategory === "liked" ? c.isFavorite : c.category === activeCategory);
      return matchesSearch && matchesCategory;
    });

    return filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      if (sortOption === "default") {
        const getPriority = (item: CaseStudy) => {
          if (item.authorIsOwner) return 2;
          if (item.authorRole === "admin") return 1;
          return 0;
        };
        const priorityDiff = getPriority(b) - getPriority(a);
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      }
      if (sortOption === "createdAsc") {
        return a.createdAt - b.createdAt;
      }
      if (sortOption === "updatedDesc") {
        const aUpdatedAt = typeof a.updatedAt === "number" ? a.updatedAt : a.createdAt;
        const bUpdatedAt = typeof b.updatedAt === "number" ? b.updatedAt : b.createdAt;
        return bUpdatedAt - aUpdatedAt;
      }
      return b.createdAt - a.createdAt;
    });
  }, [cases, searchQuery, activeCategory, sortOption]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      all: cases.length,
      liked: 0,
      prompt: 0,
      automation: 0,
      tools: 0,
      business: 0,
      activation: 0,
    };

    for (const item of cases) {
      counts[item.category] += 1;
      if (item.isFavorite) counts.liked += 1;
    }

    return counts;
  }, [cases]);

  const handleFavoriteClick = async (e: React.MouseEvent, caseId: number) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      await toggleFavoriteMutation.mutateAsync({ caseStudyId: caseId });
    } catch (error) {
      console.error(error);
      toast.error("お気に入りの更新に失敗しました");
    }
  };

  const handleFavoriteToggle = async (caseId: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      await toggleFavoriteMutation.mutateAsync({ caseStudyId: caseId });
    } catch (error) {
      console.error(error);
      toast.error("お気に入りの更新に失敗しました");
    }
  };

  const handleDeleteCase = async (caseId: number) => {
    if (!window.confirm("Delete this case study?")) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      const result = await deleteMutation.mutateAsync({ id: caseId });
      if (result?.success) {
        setSelectedCaseId(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("削除に失敗しました");
    }
  };

  const handleAddClick = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (user?.loginMethod !== "google") {
      toast.error("Google login required to post.");
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleEditCase = (caseId: number) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("caseId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    setSelectedCaseId(null);
    setEditingCaseId(caseId);
  };
  const buildSharePayload = (caseId: number): SharePayload | null => {
    const found = cases.find((item) => item.id === caseId);
    if (!found) return null;
    return {
      id: found.id,
      title: found.title,
      authorName: found.authorName || "だれか",
    };
  };
  const openCaseDetail = (caseId: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("caseId", String(caseId));
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    setSelectedCaseId(caseId);
  };
  const closeCaseDetail = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("caseId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    setSelectedCaseId(null);
  };
  const handleCopyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error("コピーに失敗しました");
    }
  };
  const openShareDialog = (caseId: number) => {
    const payload = buildSharePayload(caseId);
    if (!payload) {
      toast.error("共有対象の事例が見つかりませんでした");
      return;
    }
    setSharePayload(payload);
    setIsShareModalOpen(true);
  };
  const handleShareCase = async (caseId: number) => {
    openShareDialog(caseId);
  };
  const handleNativeShare = async () => {
    if (!sharePayload) return;
    if (!navigator.share) {
      toast.error("この端末はシステム共有に対応していません");
      return;
    }
    try {
      await navigator.share({
        title: sharePayload.title,
        text: shareMessage,
        url: shareUrl,
      });
    } catch (error) {
      // User-cancelled share should be silent.
      if (error instanceof Error && error.name === "AbortError") return;
      console.error(error);
      toast.error("共有に失敗しました");
    }
  };
  const handlePinCase = async (caseId: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!user?.isOwner) return;
    try {
      await pinToTopMutation.mutateAsync({ id: caseId });
      toast.success("事例を最上部に固定しました");
    } catch (error) {
      console.error(error);
      toast.error("固定に失敗しました");
    }
  };

  const handleAuthorClick = (e: React.MouseEvent, userId: number) => {
    e.stopPropagation();
    setProfileUserId(userId);
  };

  const handleLoginClick = () => {
    window.location.href = getLoginUrl();
  };

  const handleLogoutClick = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
      toast.error("ログアウトに失敗しました");
    }
  };

  const handleSwitchAccountClick = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    } finally {
      window.location.href = getLoginUrl({ selectAccount: true });
    }
  };
  const handleOpenInquiry = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setInquiryTitle("");
    setInquiryContent("");
    setIsInquiryModalOpen(true);
  };
  const handleSubmitInquiry = async () => {
    const title = inquiryTitle.trim();
    const content = inquiryContent.trim();
    if (!title || !content) {
      toast.error("件名と内容を入力してください");
      return;
    }
    try {
      await submitInquiryMutation.mutateAsync({ title, content });
      toast.success("問い合わせを送信しました");
      setIsInquiryModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("問い合わせ送信に失敗しました");
    }
  };
  useEffect(() => {
    if (cases.length === 0) return;
    const caseIdParam = new URLSearchParams(window.location.search).get("caseId");
    const caseId = Number(caseIdParam);
    if (!Number.isInteger(caseId) || caseId <= 0) return;
    const exists = cases.some((item) => item.id === caseId);
    if (!exists) return;
    setSelectedCaseId(caseId);
  }, [cases]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="container py-3 md:py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <img
                src="/logo.png"
                alt="CAI Library logo"
                className="w-40 h-14 rounded-xl object-cover md:w-50 md:h-20"
              />
            </div>

            {/* Search Bar */}
            <div className="w-full md:flex-1 md:max-w-xl md:mx-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="検索する"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-2.5 md:py-3 bg-muted border-border rounded-full"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full md:w-auto flex items-center gap-2 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
              {switchable && (
                <div className="shrink-0 flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-2">
                  <Sun
                    className={`w-4 h-4 ${
                      theme === "light" ? "text-foreground" : "text-muted-foreground"
                    }`}
                  />
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={() => toggleTheme?.()}
                    aria-label="Toggle dark mode"
                  />
                  <Moon
                    className={`w-4 h-4 ${
                      theme === "dark" ? "text-foreground" : "text-muted-foreground"
                    }`}
                  />
                </div>
              )}
              <AIConsultButton
                iconNormal="/icon-normal.png"
                iconHeart="/icon-heart.png"
                href="/ai-consult"
              />

              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="outline" className="rounded-full shrink-0">
                    <span className="text-sm">管理者ページ</span>
                  </Button>
                </Link>
              )}
              {isAuthenticated && user?.role !== "admin" && (
                <Button onClick={handleOpenInquiry} variant="outline" className="rounded-full shrink-0">
                  <span className="text-sm">問い合わせ</span>
                </Button>
              )}

              {!isAuthenticated ? (
                <Button
                  onClick={handleLoginClick}
                  variant="outline"
                  className="flex items-center gap-2 rounded-full shrink-0"
                >
                  <span className="text-sm">Googleでログイン</span>
                </Button>
              ) : (
                <>
                  {canPost && (
                    <Button
                      onClick={handleAddClick}
                      variant="outline"
                      className="flex items-center gap-2 rounded-full shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">事例を追加</span>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 rounded-full shrink-0">
                        <span className="text-sm">アカウント管理</span>
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onSelect={() => setLocation("/profile")}>
                        <User className="w-4 h-4" />
                        プロフィール
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleSwitchAccountClick}>
                        <Repeat className="w-4 h-4" />
                        アカウント切り替え
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={handleLogoutClick}>
                        <LogOut className="w-4 h-4" />
                        ログアウト
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mt-4 md:mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1 overflow-x-auto scrollbar-hide pb-1">
              <div className="flex items-center gap-3">
                {categories.map((category) => {
                  const isActive = activeCategory === category.id;
                  return (
                    <Button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      variant={isActive ? "default" : "outline"}
                      className={`rounded-full whitespace-nowrap ${
                        isActive
                          ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                          : ""
                      }`}
                    >
                      {category.label} ({categoryCounts[category.id] ?? 0})
                    </Button>
                  );
                })}
              </div>
            </div>
            {isMobile ? (
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="並び替え"
              >
                <option value="default">デフォルト</option>
                <option value="createdDesc">投稿日が新しい順</option>
                <option value="createdAsc">投稿日が古い順</option>
                <option value="updatedDesc">編集日が新しい順</option>
              </select>
            ) : (
              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="並び替え" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">デフォルト</SelectItem>
                  <SelectItem value="createdDesc">投稿日が新しい順</SelectItem>
                  <SelectItem value="createdAsc">投稿日が古い順</SelectItem>
                  <SelectItem value="updatedDesc">編集日が新しい順</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6 md:py-12">
        {listQuery.isLoading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">読み込み中...</p>
          </div>
        ) : filteredCases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {filteredCases.map((caseStudy) => {
              const isEdited =
                typeof caseStudy.updatedAt === "number" &&
                caseStudy.updatedAt > caseStudy.createdAt;
              return (
                <Card
                  key={caseStudy.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow group"
                  onClick={() => openCaseDetail(caseStudy.id)}
                >
                  {caseStudy.thumbnailUrl && (
                    <div className="relative w-full h-52 md:h-64 overflow-hidden rounded-t-lg">
                      <img
                        src={caseStudy.thumbnailUrl}
                        alt={caseStudy.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg md:text-xl">{caseStudy.title}</CardTitle>
                        {isEdited && <Badge variant="outline">編集済み</Badge>}
                      </div>
                      <div className="flex items-center shrink-0">
                        {user?.loginMethod === "google" && caseStudy.userId === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCase(caseStudy.id);
                            }}
                            aria-label="Edit case study"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleFavoriteClick(e, caseStudy.id)}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              caseStudy.isFavorite ? "fill-red-500 text-red-500" : ""
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleShareCase(caseStudy.id);
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{caseStudy.description}</CardDescription>
                    <p className="text-xs text-muted-foreground mt-2">
                      作成者:
                      <button
                        type="button"
                        className="ml-1 underline underline-offset-2 hover:text-foreground"
                        onClick={(e) => handleAuthorClick(e, caseStudy.userId)}
                      >
                        {caseStudy.authorName || "不明"}
                      </button>
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {caseStudy.tools.map((tool: string) => (
                        <Badge key={tool} variant="secondary">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                    {caseStudy.isRecommended === 1 && (
                      <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-blue-500">
                        おすすめ
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">該当する事例が見つかりませんでした</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedCaseId && (
        <CaseDetailModal
          caseStudy={selectedCase}
          onClose={closeCaseDetail}
          onFavoriteToggle={handleFavoriteToggle}
          onEdit={handleEditCase}
          onDelete={handleDeleteCase}
          onPin={handlePinCase}
          onShare={handleShareCase}
          onAuthorClick={(userId) => setProfileUserId(userId)}
          canEdit={canEditSelected}
          canDelete={canDeleteSelected}
          canPin={canPinSelected}
        />
      )}

      <UserProfileDialog
        userId={profileUserId}
        open={profileUserId !== null}
        onClose={() => setProfileUserId(null)}
      />

      {isAddModalOpen && (
        <AddCaseModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(result) => {
            setIsAddModalOpen(false);
            utils.caseStudies.list.invalidate();
            if (result.mode === "create" && result.id) {
              const payload: SharePayload = {
                id: result.id,
                title: result.title,
                authorName: (user?.name ?? "").trim() || "だれか",
              };
              setCelebrationPayload(payload);
              setIsCelebrationModalOpen(true);
            }
          }}
        />
      )}

      {editingCase && (
        <AddCaseModal
          mode="edit"
          caseStudy={editingCase}
          onClose={() => setEditingCaseId(null)}
          onSuccess={(_result) => {
            setEditingCaseId(null);
            utils.caseStudies.list.invalidate();
          }}
        />
      )}

      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>事例を共有</DialogTitle>
            <DialogDescription>
              SNSやSlackで共有しやすい文面を用意しました。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm whitespace-pre-wrap break-words">{shareText}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={() => handleCopyText(shareUrl, "共有リンクをコピーしました")}>
                リンクをコピー
              </Button>
              <Button variant="outline" onClick={() => handleCopyText(shareText, "紹介文をコピーしました")}>
                紹介文をコピー
              </Button>
              {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                <Button className="sm:col-span-2" variant="secondary" onClick={handleNativeShare}>
                  端末の共有機能を使う
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCelebrationModalOpen} onOpenChange={setIsCelebrationModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <span>🎉 事例の投稿ありがとうございます！ 🎉</span>
            </DialogTitle>
            <DialogDescription>
              すばらしい投稿です！この勢いでシェアして、チームに広めましょう。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-100 p-3">
              <p className="text-sm font-medium break-words">{celebrationPayload?.title}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  if (!celebrationPayload) return;
                  setSharePayload(celebrationPayload);
                  setIsShareModalOpen(true);
                  setIsCelebrationModalOpen(false);
                }}
              >
                共有オプションを開く
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!celebrationPayload) return;
                  openCaseDetail(celebrationPayload.id);
                  setIsCelebrationModalOpen(false);
                }}
              >
                投稿を開く
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInquiryModalOpen} onOpenChange={setIsInquiryModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>管理者へ問い合わせ</DialogTitle>
            <DialogDescription>
              問題報告や改善要望を送信できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={inquiryTitle}
              onChange={(event) => setInquiryTitle(event.target.value)}
              placeholder="件名"
              maxLength={120}
            />
            <Textarea
              value={inquiryContent}
              onChange={(event) => setInquiryContent(event.target.value)}
              placeholder="内容"
              rows={8}
              maxLength={3000}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsInquiryModalOpen(false)}
                disabled={submitInquiryMutation.isPending}
              >
                キャンセル
              </Button>
              <Button onClick={handleSubmitInquiry} disabled={submitInquiryMutation.isPending}>
                送信
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


