'use client';

import { useState } from 'react';
import { ThesisTag } from '@/types/thesis';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagSelector } from './TagSelector';
import { ZONE_PRESETS } from '@/constants/tags';
import { useThesisStore } from '@/lib/store';
import { Sparkles } from 'lucide-react';

interface ThesisFormProps {
    onSuccess?: () => void;
}

export function ThesisForm({ onSuccess }: ThesisFormProps) {
    const addThesis = useThesisStore((s) => s.addThesis);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [zone, setZone] = useState('');
    const [tags, setTags] = useState<ThesisTag[]>([]);

    const isValid = name.trim() && zone;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        addThesis({
            name: name.trim(),
            description: description.trim(),
            zone,
            tags,
        });

        // 重置表单
        setName('');
        setDescription('');
        setZone('');
        setTags([]);
        onSuccess?.();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
                <Label htmlFor="thesis-name">看法名称 *</Label>
                <Input
                    id="thesis-name"
                    placeholder="例如：BTC 长线持仓"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="thesis-zone">投资分区 *</Label>
                <Select value={zone} onValueChange={setZone}>
                    <SelectTrigger id="thesis-zone" className="bg-background">
                        <SelectValue placeholder="选择投资分区" />
                    </SelectTrigger>
                    <SelectContent>
                        {ZONE_PRESETS.map((z) => (
                            <SelectItem key={z} value={z}>
                                {z}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="thesis-description">看法描述</Label>
                <Textarea
                    id="thesis-description"
                    placeholder="描述你的投资逻辑和核心判断..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="bg-background resize-none"
                />
            </div>

            <div className="space-y-1.5">
                <Label>关联标签</Label>
                <TagSelector selectedTags={tags} onChange={setTags} />
            </div>

            <Button type="submit" disabled={!isValid} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                创建看法
            </Button>
        </form>
    );
}
