import { PadelSimulator } from "@/components/padel-simulator"

export default function Page() {
  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Padel Tactical Simulator</h1>
          <p className="text-muted-foreground">Create, visualize, and analyze padel game scenarios</p>
        </header>
        <main className="rounded-lg border bg-card shadow-sm">
          <PadelSimulator />
        </main>
        <footer className="text-center text-sm text-muted-foreground">
          <p>Use the toolbox below to create player movements and ball trajectories</p>
        </footer>
      </div>
    </div>
  )
}
