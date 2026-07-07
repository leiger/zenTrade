'use client';

import { Suspense, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { QuantHeader } from '@/components/modules/musk-quant/QuantHeader';
import { MarketOverview } from '@/components/modules/musk-quant/MarketOverview';
import { ProbabilityAnalysis } from '@/components/modules/musk-quant/ProbabilityAnalysis';
import { MorphologyCompare } from '@/components/modules/musk-quant/MorphologyCompare';
import { RhythmHeatmap } from '@/components/modules/musk-quant/RhythmHeatmap';
import { PositionManager } from '@/components/modules/musk-quant/PositionManager';
import { StrategyGuide } from '@/components/modules/musk-quant/StrategyGuide';
import { useMuskQuantStore } from '@/lib/musk-quant-store';

export default function MuskQuantPage() {
  return (
    <Suspense>
      <MuskQuantContent />
    </Suspense>
  );
}

function MuskQuantContent() {
  const { events, loading, error, initialize } = useMuskQuantStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load market data: {error}
        </div>
      )}

      <QuantHeader />

      <Separator className="bg-border/50" />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Market Overview</TabsTrigger>
          <TabsTrigger value="analysis">Probability</TabsTrigger>
          <TabsTrigger value="morphology">Morphology</TabsTrigger>
          <TabsTrigger value="heatmap">Rhythm Heatmap</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="guide">Strategy Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <MarketOverview />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <ProbabilityAnalysis />
        </TabsContent>

        <TabsContent value="morphology" className="space-y-4">
          <MorphologyCompare />
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-4">
          <RhythmHeatmap />
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <PositionManager />
        </TabsContent>

        <TabsContent value="guide" className="space-y-4">
          <StrategyGuide />
        </TabsContent>
      </Tabs>
    </div>
  );
}
