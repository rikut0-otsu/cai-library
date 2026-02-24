import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserProfileDialogProps = {
  userId: number | null;
  open: boolean;
  onClose: () => void;
};

export function UserProfileDialog({ userId, open, onClose }: UserProfileDialogProps) {
  const query = trpc.profile.getByUserId.useQuery(
    { userId: userId ?? 1 },
    {
      enabled: open && userId !== null,
      refetchOnWindowFocus: false,
    }
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ユーザープロフィール</DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : !query.data ? (
          <p className="text-sm text-muted-foreground">ユーザーが見つかりませんでした</p>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">{query.data.user.name}</p>
                {query.data.user.role === "admin" && <Badge>管理者</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                部署・職種: {query.data.user.departmentRole || "未設定"}
              </p>
            </div>

            <div>
              <p className="font-medium mb-2">登録した事例 ({query.data.caseStudies.length})</p>
              {query.data.caseStudies.length === 0 ? (
                <p className="text-sm text-muted-foreground">まだ事例はありません</p>
              ) : (
                <div className="space-y-2">
                  {query.data.caseStudies.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
