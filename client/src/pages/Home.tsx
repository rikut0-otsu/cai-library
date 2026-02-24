import { type CaseStudy } from "@/lib/caseStudies";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, Heart, LogOut, Moon, Pencil, Plus, Repeat, Search, Sun, User } from "lucide-react";
import { useMemo, useState } from "react";
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
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Category =
  | "all"
  | "liked"
  | "prompt"
  | "automation"
  | "tools"
  | "business"
  | "activation";

type SortOption = "default" | "createdDesc" | "createdAsc" | "updatedDesc";

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
  const { theme, toggleTheme, switchable } = useTheme();
  const toggleFavoriteMutation = trpc.caseStudies.toggleFavorite.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const deleteMutation = trpc.caseStudies.delete.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
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
    setSelectedCaseId(null);
    setEditingCaseId(caseId);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="CAI Library logo"
                className="w-50 h-20 rounded-xl object-cover"
              />
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-xl mx-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="検索する"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-muted border-border rounded-full"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {switchable && (
                <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-2">
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
                href="https://notebooklm.google/"
                target="_blank"
                rel="noopener noreferrer"
              />

              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="outline" className="rounded-full">
                    <span className="text-sm">管理者ページ</span>
                  </Button>
                </Link>
              )}

              {!isAuthenticated ? (
                <Button
                  onClick={handleLoginClick}
                  variant="outline"
                  className="flex items-center gap-2 rounded-full"
                >
                  <span className="text-sm">Googleでログイン</span>
                </Button>
              ) : (
                <>
                  {canPost && (
                    <Button
                      onClick={handleAddClick}
                      variant="outline"
                      className="flex items-center gap-2 rounded-full"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">事例を追加</span>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 rounded-full">
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
          <div className="mt-6 flex items-center gap-3">
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
            <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="並び替え" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">デフォルト</SelectItem>
                <SelectItem value="createdDesc">投稿日が新しい順</SelectItem>
                <SelectItem value="createdAsc">投稿日が古い順</SelectItem>
                <SelectItem value="updatedDesc">編集日が新しい順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        {listQuery.isLoading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">読み込み中...</p>
          </div>
        ) : filteredCases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCases.map((caseStudy) => {
              const isEdited =
                typeof caseStudy.updatedAt === "number" &&
                caseStudy.updatedAt > caseStudy.createdAt;
              return (
                <Card
                  key={caseStudy.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow group"
                  onClick={() => setSelectedCaseId(caseStudy.id)}
                >
                  {caseStudy.thumbnailUrl && (
                    <div className="relative w-full h-64 overflow-hidden rounded-t-lg">
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
                        <CardTitle className="text-xl">{caseStudy.title}</CardTitle>
                        {isEdited && <Badge variant="outline">編集済み</Badge>}
                      </div>
                      <div className="flex items-center">
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
          onClose={() => setSelectedCaseId(null)}
          onFavoriteToggle={handleFavoriteToggle}
          onEdit={handleEditCase}
          onDelete={handleDeleteCase}
          onAuthorClick={(userId) => setProfileUserId(userId)}
          canEdit={canEditSelected}
          canDelete={canDeleteSelected}
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
          onSuccess={() => {
            setIsAddModalOpen(false);
            utils.caseStudies.list.invalidate();
          }}
        />
      )}

      {editingCase && (
        <AddCaseModal
          mode="edit"
          caseStudy={editingCase}
          onClose={() => setEditingCaseId(null)}
          onSuccess={() => {
            setEditingCaseId(null);
            utils.caseStudies.list.invalidate();
          }}
        />
      )}
    </div>
  );
}


