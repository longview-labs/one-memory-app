import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from './admin-app'
import { fetchMemories, type ArweaveTransaction } from '@/utils/memories'
import { buildArweaveTransactionUrl } from '@/lib/arweave-gateway'
import ArweaveImage from '@/components/arweave-image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const BLACKLIST_API_URL = import.meta.env.VITE_BACKEND_API_URL

function truncateTxId(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

function getTag(tags: ArweaveTransaction['tags'], name: string) {
  return tags.find((t) => t.name === name)?.value ?? ''
}

export function DashboardPage() {
  const { apiKey, logout } = useAuth()
  const navigate = useNavigate()

  const [memories, setMemories] = useState<
    Array<{ cursor: string; node: ArweaveTransaction }>
  >([])
  const [blacklistedIds, setBlacklistedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [endCursor, setEndCursor] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchBlacklistedIds = useCallback(async () => {
    try {
      const res = await fetch(`${BLACKLIST_API_URL}/blacklist`)
      if (res.ok) {
        const data: { transactionIds: string[] } = await res.json()
        setBlacklistedIds(new Set(data.transactionIds))
      }
    } catch (err) {
      console.error('Failed to fetch blacklist:', err)
    }
  }, [])

  const loadMemories = useCallback(
    async (cursor?: string, append = false) => {
      try {
        if (!append) setIsLoading(true)
        else setIsLoadingMore(true)

        const response = await fetchMemories(cursor)
        const edges = response.data.transactions.edges

        if (append) {
          setMemories((prev) => [...prev, ...edges])
        } else {
          setMemories(edges)
        }

        const lastCursor =
          edges.length > 0 ? edges[edges.length - 1].cursor : null
        setHasNextPage(response.data.transactions.pageInfo.hasNextPage)
        setEndCursor(lastCursor)
      } catch (err) {
        console.error('Failed to load memories:', err)
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchBlacklistedIds()
    loadMemories()
  }, [fetchBlacklistedIds, loadMemories])

  const loadMore = useCallback(() => {
    if (hasNextPage && !isLoadingMore && endCursor) {
      loadMemories(endCursor, true)
    }
  }, [hasNextPage, isLoadingMore, endCursor, loadMemories])

  const handleBlock = async (txId: string) => {
    setTogglingId(txId)
    try {
      const res = await fetch(`${BLACKLIST_API_URL}/blacklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ transactionIds: [txId] }),
      })
      if (res.ok) {
        setBlacklistedIds((prev) => new Set(prev).add(txId))
      }
    } catch (err) {
      console.error('Failed to block:', err)
    } finally {
      setTogglingId(null)
    }
  }

  const handleUnblock = async (txId: string) => {
    setTogglingId(txId)
    try {
      const res = await fetch(`${BLACKLIST_API_URL}/blacklist/${txId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
      if (res.ok) {
        setBlacklistedIds((prev) => {
          const next = new Set(prev)
          next.delete(txId)
          return next
        })
      }
    } catch (err) {
      console.error('Failed to unblock:', err)
    } finally {
      setTogglingId(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const filtered = filter
    ? memories.filter((edge) =>
        edge.node.id.toLowerCase().includes(filter.toLowerCase())
      )
    : memories

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold">OneMemory Admin</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Filter */}
        <div className="mb-6">
          <Input
            placeholder="Filter by transaction ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        )}

        {/* Grid */}
        {!isLoading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((edge) => {
                const tx = edge.node
                const isBlocked = blacklistedIds.has(tx.id)
                const title = getTag(tx.tags, 'Title')
                const location = getTag(tx.tags, 'Location')
                const imageUrl = buildArweaveTransactionUrl(tx.id)

                return (
                  <Card key={tx.id} className="overflow-hidden py-0 gap-0">
                    <div className="relative aspect-square">
                      <ArweaveImage
                        src={imageUrl}
                        alt={title || tx.id}
                        className="w-full h-full object-cover"
                      />
                      {isBlocked && (
                        <Badge
                          variant="destructive"
                          className="absolute top-2 right-2"
                        >
                          Blocked
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <p
                        className="text-xs font-mono text-muted-foreground"
                        title={tx.id}
                      >
                        {truncateTxId(tx.id)}
                      </p>
                      {title && (
                        <p className="text-sm font-medium truncate">{title}</p>
                      )}
                      {location && (
                        <p className="text-xs text-muted-foreground truncate">
                          {location}
                        </p>
                      )}
                      <Button
                        variant={isBlocked ? 'outline' : 'destructive'}
                        size="sm"
                        className="w-full"
                        disabled={togglingId === tx.id}
                        onClick={() =>
                          isBlocked
                            ? handleUnblock(tx.id)
                            : handleBlock(tx.id)
                        }
                      >
                        {togglingId === tx.id
                          ? '...'
                          : isBlocked
                            ? 'Unblock'
                            : 'Block'}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Load more */}
            {hasNextPage && (
              <div className="flex justify-center py-8">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}

            {/* Empty state */}
            {filtered.length === 0 && !isLoading && (
              <p className="text-center text-muted-foreground py-20">
                {filter ? 'No memories match that filter.' : 'No memories found.'}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
