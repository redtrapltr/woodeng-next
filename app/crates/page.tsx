import CrateOpen from "@/contexts/components/CrateOpen";


export default function Page() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6 flex items-center justify-center">
      <div className="space-y-8 w-full max-w-5xl">
        <h1 className="text-2xl font-semibold">Loyalty Crates (Preview)</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <CrateOpen tier="bronze" title="Bronze" />
          <CrateOpen tier="silver" title="Silver" />
          <CrateOpen tier="gold" title="Gold" />
          <CrateOpen tier="diamond" title="Diamond" />
        </div>
      </div>
    </main>
  );
}
