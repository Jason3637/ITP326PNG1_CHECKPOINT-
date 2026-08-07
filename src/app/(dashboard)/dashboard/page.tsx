import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Card className="text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="mt-2 text-sm text-neutral-500">Coming soon</p>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
