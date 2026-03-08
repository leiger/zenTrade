'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
    ColumnFiltersState,
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
import { formatDistanceToNow } from 'date-fns';
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
} from 'lucide-react';

import { Thesis } from '@/types/thesis';
import { useThesisStore } from '@/lib/store';
import { getCategoryConfig } from '@/constants/assets';
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
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// --- Sortable Row Component ---

interface SortableRowProps {
    row: any;
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
                .filter((cell: any) => cell.column.getIsVisible())
                .map((cell: any) => (
                    <TableCell key={cell.id}>
                        {cell.column.id === 'drag-handle' ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
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
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

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
                    const reviewed = snapshots.filter((s) => s.followUp);
                    if (reviewed.length === 0) {
                        return (
                            <div className="text-center text-xs text-muted-foreground/40">—</div>
                        );
                    }
                    const correct = reviewed.filter((s) => s.followUp!.verdict === 'correct').length;
                    const wrong = reviewed.filter((s) => s.followUp!.verdict === 'wrong').length;
                    const neutral = reviewed.filter((s) => s.followUp!.verdict === 'neutral').length;
                    const rate = Math.round((correct / reviewed.length) * 100);
                    return (
                        <div className="flex flex-col items-center gap-0.5">
                            <div className={cn(
                                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                                rate >= 60 ? 'bg-emerald-500/10 text-emerald-500' :
                                    rate >= 40 ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-rose-500/10 text-rose-500'
                            )}>
                                <Target className="h-3 w-3" />
                                {rate}%
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
        [router]
    );

    const table = useReactTable({
        data: theses,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnFilters,
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
            reorderTheses(arrayMove(theses, oldIndex, newIndex));
        }
    }

    return (
        <div className="space-y-4">
            {/* Table Header / Toolbar */}
            <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">看法列表</h2>
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                        {theses.length}
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
                                items={theses.map((t) => t.id)}
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
