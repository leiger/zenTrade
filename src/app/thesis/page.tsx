'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useThesisStore } from '@/lib/store';
import { ThesisCard } from '@/components/modules/thesis-tracker/ThesisCard';
import { ThesisForm } from '@/components/modules/thesis-tracker/ThesisForm';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, BrainCircuit } from 'lucide-react';

export default function ThesisPage() {
    const router = useRouter();
    const theses = useThesisStore((s) => s.theses);
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            {/* 页头 */}
            <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <BrainCircuit className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight">Thesis Tracker</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        记录投资逻辑，追踪认知偏差，实现"预测-执行-复盘"闭环
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            新建看法
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>创建新看法</DialogTitle>
                            <DialogDescription>
                                为一个投资分区记录你的核心判断和逻辑。
                            </DialogDescription>
                        </DialogHeader>
                        <ThesisForm onSuccess={() => setDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            {/* 统计栏 */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">活跃看法</p>
                    <p className="text-2xl font-bold">{theses.length}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">总快照数</p>
                    <p className="text-2xl font-bold">
                        {theses.reduce((acc, t) => acc + t.snapshots.length, 0)}
                    </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">待回顾</p>
                    <p className="text-2xl font-bold text-amber-400">
                        {theses.reduce(
                            (acc, t) =>
                                acc +
                                t.snapshots.filter(
                                    (s) => new Date(s.expectedReviewDate) < new Date()
                                ).length,
                            0
                        )}
                    </p>
                </div>
            </div>

            {/* 看法列表 */}
            {theses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-full bg-muted p-6 mb-4">
                        <BrainCircuit className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">还没有看法记录</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        创建你的第一个投资看法，开始追踪你的认知和决策逻辑
                    </p>
                    <Button onClick={() => setDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        创建第一个看法
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {theses.map((thesis) => (
                        <ThesisCard
                            key={thesis.id}
                            thesis={thesis}
                            onClick={() => router.push(`/thesis/${thesis.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
