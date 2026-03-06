import { fetchGraphqlWithGatewayFallback } from '@/lib/arweave-gateway'

const MEMORIES_QUERY = `query GetMemories($after: String) {
    transactions(
        tags: [
            {name: "App-Name", values: ["Memories-App"]}
            {name: "App-Version", values: ["1.0.3"]}
            {name: "App-Env", values: ["Prod"]}
            {name: "Visibility", values: ["Public"]}
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
                return Array.isArray(edges) && edges.length > 0
            },
        }
    )

    return { data }
}
