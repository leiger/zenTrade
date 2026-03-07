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
    MoreHorizontal,
    ArrowUpDown,
    MessageSquareText,
    Clock,
    Layers,
    Trash2,
    ExternalLink,
    Settings2,
    ChevronDown,
} from 'lucide-react';

import { Thesis } from '@/types/thesis';
import { useThesisStore } from '@/lib/store';
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
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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

export function ThesisTable() {
    const router = useRouter();
    const theses = useThesisStore((s) => s.theses);
    const deleteThesis = useThesisStore((s) => s.deleteThesis);
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
                        看法名称
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => {
                    const thesis = row.original;
                    return (
                        <div className="flex flex-col gap-1 min-w-[200px]">
                            <span className="font-semibold text-foreground">{thesis.name}</span>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                                    <Layers className="h-2.5 w-2.5 mr-0.5" />
                                    {thesis.zone}
                                </Badge>
                            </div>
                        </div>
                    );
                },
            },
            {
                accessorKey: 'description',
                header: '核心逻辑',
                cell: ({ row }) => (
                    <div className="max-w-[300px] text-muted-foreground text-xs line-clamp-2 leading-relaxed">
                        {row.original.description}
                    </div>
                ),
            },
            {
                accessorKey: 'tags',
                header: '关联标签',
                cell: ({ row }) => {
                    const tags = row.original.tags;
                    if (tags.length === 0) return <span className="text-muted-foreground/30">-</span>;
                    return (
                        <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant={tag.category === 'buy' ? 'secondary' : 'outline'}
                                    className={cn(
                                        'text-[10px] px-1.5 py-0 font-normal whitespace-nowrap',
                                        tag.category === 'sell' && 'text-destructive border-destructive/20'
                                    )}
                                >
                                    {tag.label}
                                </Badge>
                            ))}
                            {tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
                            )}
                        </div>
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
            {
                id: 'actions',
                enableHiding: false,
                cell: ({ row }) => {
                    const thesis = row.original;
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                    <span className="sr-only">打开菜单</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[160px]">
                                <DropdownMenuLabel>操作</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => router.push(`/thesis/${thesis.id}`)}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    查看详情
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('确定要删除这个看法吗？')) {
                                            deleteThesis(thesis.id);
                                        }
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除看法
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                },
            },
        ],
        [router, deleteThesis]
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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-auto h-8 gap-2">
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
                                        {column.id === 'name' ? '看法名称' :
                                            column.id === 'description' ? '核心逻辑' :
                                                column.id === 'tags' ? '关联标签' :
                                                    column.id === 'snapshots' ? '快照数' :
                                                        column.id === 'updatedAt' ? '更新时间' : column.id}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="rounded-xl border bg-background/50 shadow-sm overflow-hidden">
                <DndContext
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
