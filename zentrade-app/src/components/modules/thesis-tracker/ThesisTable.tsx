'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    ColumnDef,
    Row,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
    VisibilityState,
} from '@tanstack/react-table';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow, subDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
    GripVertical,
    ArrowUpDown,
    MessageSquareText,
    Clock,
    Plus,
    Settings2,
    ChevronDown,
    CircleCheck,
    CircleX,
    CircleMinus,
    Target,
    Search,
} from 'lucide-react';

import { Thesis, ThesisStatus } from '@/types/thesis';
import { useThesisStore } from '@/lib/store';
import { getCategoryConfig } from '@/constants/assets';
import { collectAllTags, collectThesisTags, getAccuracyStats, getReminderSummary } from '@/lib/thesis-tracker';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ThesisStatusBadge } from './ThesisStatusBadge';

// --- Sortable Row Component ---

interface SortableRowProps {
    row: Row<Thesis>;
    onClick: () => void;
}

function SortableRow({ row, onClick }: SortableRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: row.original.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn('group cursor-pointer', isDragging && 'bg-muted shadow-lg')}
            onClick={onClick}
        >
            {row.getVisibleCells()
                .filter((cell) => cell.column.getIsVisible())
                .map((cell) => (
                    <TableCell key={cell.id}>
                        {cell.column.id === 'drag-handle' ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
                                aria-label="拖拽排序"
                                {...attributes}
                                {...listeners}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <GripVertical className="h-4 w-4" />
                            </Button>
                        ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                    </TableCell>
                ))}
        </TableRow>
    );
}

// --- Main ThesisTable Component ---

interface ThesisTableProps {
    onCreateClick?: () => void;
}

export function ThesisTable({ onCreateClick }: ThesisTableProps) {
    const dndId = React.useId();
    const router = useRouter();
    const theses = useThesisStore((s) => s.theses);
    const reorderTheses = useThesisStore((s) => s.reorderTheses);

    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | ThesisStatus>('all');
    const [reviewFilter, setReviewFilter] = React.useState<'all' | 'needs-review' | 'reviewed' | 'no-snapshots'>('all');
    const [tagFilter, setTagFilter] = React.useState<'all' | string>('all');
    const [timeFilter, setTimeFilter] = React.useState<'all' | '7d' | '30d' | '90d'>('all');

    const allTags = React.useMemo(() => collectAllTags(theses), [theses]);
    const filteredTheses = React.useMemo(() => {
        const keyword = search.trim().toLowerCase();
        const timeThreshold = timeFilter === 'all'
            ? null
            : subDays(new Date(), Number.parseInt(timeFilter, 10));

        return theses.filter((thesis) => {
            if (statusFilter !== 'all' && thesis.status !== statusFilter) {
                return false;
            }

            if (reviewFilter === 'needs-review' && getReminderSummary([thesis]).pending.length === 0) {
                return false;
            }

            if (reviewFilter === 'reviewed' && getAccuracyStats(thesis.snapshots).reviewed.length === 0) {
                return false;
            }

            if (reviewFilter === 'no-snapshots' && thesis.snapshots.length > 0) {
                return false;
            }

            if (tagFilter !== 'all' && !collectThesisTags(thesis).some((tag) => tag.id === tagFilter)) {
                return false;
            }

            if (timeThreshold && new Date(thesis.updatedAt) < timeThreshold) {
                return false;
            }

            if (!keyword) {
                return true;
            }

            const haystack = [
                thesis.name,
                thesis.asset,
                thesis.description,
                ...collectThesisTags(thesis).map((tag) => tag.label),
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(keyword);
        });
    }, [reviewFilter, search, statusFilter, tagFilter, theses, timeFilter]);

    const columns = React.useMemo<ColumnDef<Thesis>[]>(
        () => [
            {
                id: 'drag-handle',
                header: '',
                cell: () => null, // Handled inside SortableRow
                enableHiding: false,
            },
            {
                accessorKey: 'name',
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-accent"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        资产名称
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => {
                    const thesis = row.original;
                    const catConfig = getCategoryConfig(thesis.category);
                    return (
                        <div className="flex items-center gap-3 min-w-[140px]">
                            <span className="text-lg flex-shrink-0">{catConfig?.icon ?? '📁'}</span>
                            <div className="flex flex-col gap-0.5">
                                <span className="font-semibold text-foreground">{thesis.name}</span>
                                <div className="flex items-center gap-1.5">
                                    {thesis.asset && (
                                        <Badge variant="secondary" className="text-[10px] font-mono font-normal px-1.5 py-0">
                                            {thesis.asset}
                                        </Badge>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">
                                        {catConfig?.label ?? thesis.category}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'category',
                header: '大类',
                cell: ({ row }) => {
                    const catConfig = getCategoryConfig(row.original.category);
                    return (
                        <Badge variant="outline" className="text-xs font-normal gap-1 whitespace-nowrap">
                            <span>{catConfig?.icon ?? '📁'}</span>
                            {catConfig?.label ?? row.original.category}
                        </Badge>
                    );
                },
            },
            {
                accessorKey: 'status',
                header: '状态',
                cell: ({ row }) => <ThesisStatusBadge status={row.original.status} />,
            },
            {
                accessorKey: 'snapshots',
                header: ({ column }) => (
                    <div className="text-center">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                        >
                            快照
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="text-center">
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                            <MessageSquareText className="h-3 w-3" />
                            <span>{row.original.snapshots.length}</span>
                        </div>
                    </div>
                ),
            },
            {
                id: 'accuracy',
                header: () => (
                    <div className="text-center">
                        <span className="font-medium">正确率</span>
                    </div>
                ),
                cell: ({ row }) => {
                    const snapshots = row.original.snapshots;
                    const { reviewed, correct, wrong, neutral, rate } = getAccuracyStats(snapshots);
                    if (reviewed.length === 0) {
                        return (
                            <div className="text-center text-xs text-muted-foreground/40">—</div>
                        );
                    }
                    const safeRate = rate ?? 0;
                    return (
                        <div className="flex flex-col items-center gap-0.5">
                            <div className={cn(
                                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                                safeRate >= 60 ? 'bg-emerald-500/10 text-emerald-500' :
                                    safeRate >= 40 ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-rose-500/10 text-rose-500'
                            )}>
                                <Target className="h-3 w-3" />
                                {safeRate}%
                            </div>
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-0.5 text-emerald-500"><CircleCheck className="h-2.5 w-2.5" />{correct}</span>
                                <span className="flex items-center gap-0.5 text-rose-500"><CircleX className="h-2.5 w-2.5" />{wrong}</span>
                                <span className="flex items-center gap-0.5 text-amber-500"><CircleMinus className="h-2.5 w-2.5" />{neutral}</span>
                            </div>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'updatedAt',
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        更新于
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => (
                    <div className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span suppressHydrationWarning>
                            {formatDistanceToNow(new Date(row.original.updatedAt), {
                                addSuffix: true,
                                locale: zhCN,
                            })}
                        </span>
                    </div>
                ),
            },
        ],
        []
    );

    const table = useReactTable({
        data: filteredTheses,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnVisibility,
        },
    });

    // --- Drag and Drop Logic ---

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Avoid accidental drags when clicking
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = theses.findIndex((t) => t.id === active.id);
            const newIndex = theses.findIndex((t) => t.id === over.id);
            if (oldIndex >= 0 && newIndex >= 0) {
                reorderTheses(arrayMove(theses, oldIndex, newIndex));
            }
        }
    }

    return (
        <div className="space-y-4">
            {/* Table Header / Toolbar */}
            <div className="flex flex-col gap-3 py-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">看法列表</h2>
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                        {filteredTheses.length}/{theses.length}
                    </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    视图展示
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[150px]">
                                <DropdownMenuLabel>展示列</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.id !== 'drag-handle' && column.id !== 'actions' && column.getCanHide())
                                    .map((column) => {
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                            >
                                                {column.id === 'name' ? '资产名称' :
                                                    column.id === 'category' ? '大类' :
                                                        column.id === 'status' ? '状态' :
                                                            column.id === 'snapshots' ? '快照数' :
                                                                column.id === 'accuracy' ? '正确率' :
                                                                    column.id === 'updatedAt' ? '更新时间' : column.id}
                                            </DropdownMenuCheckboxItem>
                                        );
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {onCreateClick && (
                            <Button size="sm" className="h-8 gap-1.5" onClick={onCreateClick}>
                                <Plus className="h-3.5 w-3.5" />
                                新建看法
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_150px_150px_160px_150px]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="搜索名称、代码、描述、标签…"
                            className="pl-9"
                            name="thesis-search"
                            autoComplete="off"
                            aria-label="搜索 thesis"
                        />
                    </div>

                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | ThesisStatus)}>
                        <SelectTrigger className="w-full" aria-label="按生命周期筛选">
                            <SelectValue placeholder="生命周期" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部状态</SelectItem>
                            <SelectItem value="active">进行中</SelectItem>
                            <SelectItem value="paused">暂停</SelectItem>
                            <SelectItem value="archived">归档</SelectItem>
                            <SelectItem value="invalidated">证伪</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as 'all' | 'needs-review' | 'reviewed' | 'no-snapshots')}>
                        <SelectTrigger className="w-full" aria-label="按回顾状态筛选">
                            <SelectValue placeholder="回顾状态" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部回顾状态</SelectItem>
                            <SelectItem value="needs-review">待回顾</SelectItem>
                            <SelectItem value="reviewed">已复盘</SelectItem>
                            <SelectItem value="no-snapshots">无快照</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={tagFilter} onValueChange={(value) => setTagFilter(value)}>
                        <SelectTrigger className="w-full" aria-label="按标签筛选">
                            <SelectValue placeholder="标签" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部标签</SelectItem>
                            {allTags.map((tag) => (
                                <SelectItem key={tag.id} value={tag.id}>
                                    {tag.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={timeFilter} onValueChange={(value) => setTimeFilter(value as 'all' | '7d' | '30d' | '90d')}>
                        <SelectTrigger className="w-full" aria-label="按更新时间筛选">
                            <SelectValue placeholder="更新时间" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部时间</SelectItem>
                            <SelectItem value="7d">最近 7 天</SelectItem>
                            <SelectItem value="30d">最近 30 天</SelectItem>
                            <SelectItem value="90d">最近 90 天</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-xl border bg-background/50 shadow-sm overflow-hidden">
                <DndContext
                    id={dndId}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                    {headerGroup.headers
                                        .filter((header) => header.column.getIsVisible())
                                        .map((header) => (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            <SortableContext
                                items={filteredTheses.map((t) => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {table.getRowModel().rows?.length ? (
                                    table
                                        .getRowModel()
                                        .rows.map((row) => (
                                            <SortableRow
                                                key={row.id}
                                                row={row}
                                                onClick={() => router.push(`/thesis/${row.original.id}`)}
                                            />
                                        ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-24 text-center">
                                            未找到相关记录
                                        </TableCell>
                                    </TableRow>
                                )}
                            </SortableContext>
                        </TableBody>
                    </Table>
                </DndContext>
            </div>
        </div>
    );
}
