import { fetchGraphqlWithGatewayFallback } from '@/lib/arweave-gateway'
import { buildMemoryFetchTagFilters } from './memory-tags'

const MEMORY_FETCH_TAGS = buildMemoryFetchTagFilters()
const MEMORY_FETCH_TAGS_GQL = MEMORY_FETCH_TAGS
    .map((tag) => `{name: "${tag.name}", values: [${tag.values.map((value) => `"${value}"`).join(', ')}]}`)
    .join('\n            ')

const MEMORIES_QUERY = `query GetMemories($after: String) {
    transactions(
        tags: [
            ${MEMORY_FETCH_TAGS_GQL}
        ],
        after: $after
        first: 50
    ) {
        edges {
            cursor
            node {
                id
                tags {
                    name
                    value
                }
            }
        }
        pageInfo {
            hasNextPage
        }
    }
}`

export interface ArweaveTransaction {
    id: string
    tags: Array<{
        name: string
        value: string
    }>
}

interface TransactionEdge {
    cursor: string
    node: ArweaveTransaction
}

export interface MemoriesResponse {
    data: {
        transactions: {
            edges: TransactionEdge[]
            pageInfo: {
                hasNextPage: boolean
            }
        }
    }
}

export const fetchMemories = async (cursor?: string): Promise<MemoriesResponse> => {
    const { data } = await fetchGraphqlWithGatewayFallback<MemoriesResponse['data']>(
        MEMORIES_QUERY,
        cursor ? { after: cursor } : {},
        {
            validateData: (responseData) => {
                const edges = responseData?.transactions?.edges
                return Array.isArray(edges)
            },
        }
    )

    return { data }
}
