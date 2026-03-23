import { ScanSearch } from 'lucide-react';

export default function WalletTrackerPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <ScanSearch className="h-16 w-16 stroke-1" />
        <div className="text-center space-y-1.5">
          <h2 className="text-lg font-semibold text-foreground">Wallet Tracker</h2>
          <p className="text-sm">
            Polymarket wallet address monitoring &amp; analysis — coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
