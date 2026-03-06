'use client';

import { useState } from 'react';
import { ThesisTag, TimelineOption } from '@/types/thesis';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TagSelector } from './TagSelector';
import { TimelineSelector } from './TimelineSelector';
import { useThesisStore, getReviewDate } from '@/lib/store';
import { Camera } from 'lucide-react';

interface SnapshotFormProps {
    thesisId: string;
    onSuccess?: () => void;
}

export function SnapshotForm({ thesisId, onSuccess }: SnapshotFormProps) {
    const addSnapshot = useThesisStore((s) => s.addSnapshot);
    const [content, setContent] = useState('');
    const [tags, setTags] = useState<ThesisTag[]>([]);
    const [timeline, setTimeline] = useState<TimelineOption>('1W');

    const isValid = content.trim().length > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        const reviewDate = getReviewDate(timeline);

        addSnapshot(thesisId, {
            content: content.trim(),
            tags,
            timeline,
            expectedReviewDate: reviewDate.toISOString(),
        });

        setContent('');
        setTags([]);
        setTimeline('1W');
        onSuccess?.();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
                <Label htmlFor="snapshot-content">看法记录 *</Label>
                <Textarea
                    id="snapshot-content"
                    placeholder="记录你当前对这个分区的判断和逻辑..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    className="bg-background resize-none"
                />
            </div>

            <div className="space-y-1.5">
                <Label>关联标签</Label>
                <TagSelector selectedTags={tags} onChange={setTags} />
            </div>

            <div className="space-y-1.5">
                <Label>回顾时间轴</Label>
                <TimelineSelector value={timeline} onChange={setTimeline} />
            </div>

            <Button type="submit" disabled={!isValid} className="w-full gap-2">
                <Camera className="h-4 w-4" />
                记录快照
            </Button>
        </form>
    );
}
