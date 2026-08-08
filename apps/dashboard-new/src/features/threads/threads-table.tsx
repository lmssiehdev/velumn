import type { ColumnDef } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Pin,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ThreadListItem } from "@/features/dashboard/contracts"

import type { ThreadsSearch } from "./search"

type SortKey = NonNullable<ThreadsSearch["sort"]>

export function ThreadsTable({
  threads,
  search,
  onSort,
}: {
  threads: Array<ThreadListItem>
  search: ThreadsSearch
  onSort: (sort: SortKey) => void
}) {
  const columns: Array<ColumnDef<ThreadListItem>> = [
    {
      accessorKey: "title",
      header: () => (
        <SortHeader
          label="Thread"
          sortKey="title"
          search={search}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors group-hover:border-primary/20 group-hover:text-primary">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <a
                href={row.original.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-medium text-foreground transition-colors hover:text-primary hover:underline"
              >
                {row.original.title}
              </a>
              {row.original.pinned && (
                <span title="Pinned thread" className="text-amber-600">
                  <Pin className="size-3.5 fill-current" />
                  <span className="sr-only">Pinned</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground sm:hidden">
              #{row.original.parentChannel.name}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "parentChannel",
      header: () => (
        <SortHeader
          label="Channel"
          sortKey="parentChannel"
          search={search}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => (
        <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          #{row.original.parentChannel.name}
        </span>
      ),
    },
    {
      id: "messageCount",
      header: () => (
        <SortHeader
          label="Messages"
          sortKey="messageCount"
          search={search}
          onSort={onSort}
          align="right"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          <span className="font-medium">
            {row.original.messageCount.toLocaleString()}
          </span>
          <span className="ml-1 hidden text-xs text-muted-foreground lg:inline">
            messages
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: () => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Published
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                />
              }
            >
              <MoreHorizontal />
              <span className="sr-only">Open thread actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    row.original.publicUrl,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <ExternalLink /> View public page
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    row.original.discordUrl,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <MessageCircle /> View in Discord
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]
  const table = useReactTable({
    data: threads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  })

  return (
    <Table className="min-w-[640px]">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => {
              return (
                <TableHead
                  key={header.id}
                  className={getResponsiveColumnClassName(header.column.id)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} className="group">
            {row.getVisibleCells().map((cell) => {
              return (
                <TableCell
                  key={cell.id}
                  className={getResponsiveColumnClassName(cell.column.id)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function getResponsiveColumnClassName(columnId: string) {
  if (columnId === "parentChannel") return "hidden sm:table-cell"
  if (columnId === "status") return "hidden md:table-cell"
  return undefined
}

function SortHeader({
  label,
  sortKey,
  search,
  onSort,
  align = "left",
}: {
  label: string
  sortKey: SortKey
  search: ThreadsSearch
  onSort: (sort: SortKey) => void
  align?: "left" | "right"
}) {
  const active = search.sort === sortKey
  const Icon = active
    ? search.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 hover:text-foreground ${align === "right" ? "w-full justify-end" : ""}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <Icon
        className={active ? "size-3.5 text-foreground" : "size-3.5 opacity-40"}
      />
    </button>
  )
}
