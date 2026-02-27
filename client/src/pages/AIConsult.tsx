import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function AIConsult() {
  return (
    <main className="container py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">AIに相談する</h1>
        <Link href="/">
          <Button variant="outline">ホームに戻る</Button>
        </Link>
      </div>

      <div className="rounded-lg border overflow-hidden bg-background">
        <iframe
          src="https://udify.app/chatbot/C8bSk9qsSV34CAOI"
          style={{ width: "100%", height: "100%", minHeight: "700px" }}
          frameBorder="0"
          allow="microphone"
          title="Dify Chatbot"
        />
      </div>
    </main>
  );
}
