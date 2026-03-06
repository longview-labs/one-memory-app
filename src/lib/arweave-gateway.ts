const ARWEAVE_GATEWAYS = [
    'https://arweave.net',
    'https://turbo-gateway.com',
    'https://ardrive.net',
] as const

const ARWEAVE_GRAPHQL_GATEWAYS = [
    'https://arweave.net',
    'https://arweave-search.goldsky.com',
    'https://ardrive.net',
    'https://ar.io',
    'https://turbo-gateway.com',
] as const

type Gateway = (typeof ARWEAVE_GATEWAYS)[number]

const ARWEAVE_GATEWAY_HOSTS = new Set(
    ARWEAVE_GATEWAYS.map((gateway) => new URL(gateway).hostname)
)

const normalizePath = (value: string) => (value.startsWith('/') ? value : `/${value}`)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function getArweaveGateways(): readonly Gateway[] {
    return ARWEAVE_GATEWAYS
}

export function getArweaveGraphqlGateways(): readonly string[] {
    return ARWEAVE_GRAPHQL_GATEWAYS
}

export function buildArweaveTransactionUrl(transactionId: string, gateway: string = ARWEAVE_GATEWAYS[0]): string {
    return `${gateway}${normalizePath(transactionId)}`
}

export function toGatewayUrl(pathOrUrl: string, gateway: string): string {
    try {
        const parsed = new URL(pathOrUrl)
        if (!ARWEAVE_GATEWAY_HOSTS.has(parsed.hostname)) {
            return pathOrUrl
        }

        return `${gateway}${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
        return `${gateway}${normalizePath(pathOrUrl)}`
    }
}

export function getGatewayFallbackUrls(pathOrUrl: string, gateways: readonly string[] = ARWEAVE_GATEWAYS): string[] {
    const candidates = gateways.map((gateway) => toGatewayUrl(pathOrUrl, gateway))
    return Array.from(new Set(candidates))
}

interface FallbackFetchOptions {
    gateways?: readonly string[]
    shouldAccept?: (response: Response) => boolean
}

interface GraphqlFallbackOptions<TData> {
    gateways?: readonly string[]
    validateData?: (data: TData) => boolean
    headers?: Record<string, string>
}

function isGraphqlRequest(pathOrUrl: string): boolean {
    try {
        return new URL(pathOrUrl).pathname === '/graphql'
    } catch {
        return normalizePath(pathOrUrl) === '/graphql'
    }
}

export async function fetchWithGatewayFallback(
    pathOrUrl: string,
    init: RequestInit,
    options: FallbackFetchOptions = {}
): Promise<{ response: Response; url: string; gateway: string }> {
    const gateways = options.gateways
        ?? (isGraphqlRequest(pathOrUrl) ? ARWEAVE_GRAPHQL_GATEWAYS : ARWEAVE_GATEWAYS)
    const shouldAccept = options.shouldAccept ?? ((response: Response) => response.ok)
    const failures: string[] = []

    for (const gateway of gateways) {
        const url = toGatewayUrl(pathOrUrl, gateway)

        try {
            const response = await fetch(url, init)
            if (shouldAccept(response)) {
                return { response, url, gateway }
            }

            failures.push(`${gateway}: HTTP ${response.status}`)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown fetch error'
            failures.push(`${gateway}: ${message}`)
        }
    }

    throw new Error(`All Arweave gateways failed for ${pathOrUrl}. ${failures.join(' | ')}`)
}

export async function fetchGraphqlWithGatewayFallback<TData = any>(
    query: string,
    variables?: Record<string, unknown>,
    options: GraphqlFallbackOptions<TData> = {}
): Promise<{ data: TData; url: string; gateway: string }> {
    const gateways = options.gateways ?? ARWEAVE_GRAPHQL_GATEWAYS
    const validateData = options.validateData ?? (() => true)
    const failures: string[] = []
    let fallbackData: TData | undefined
    let fallbackGateway: string = gateways[0]

    for (const gateway of gateways) {
        const url = `${gateway}/graphql`

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers ?? {})
                },
                body: JSON.stringify({ query, variables: variables ?? {} })
            })

            if (!response.ok) {
                failures.push(`${gateway}: HTTP ${response.status}`)
                continue
            }

            const json = await response.json()
            const data = json?.data as TData | undefined

            if (data !== undefined) {
                fallbackData = data
                fallbackGateway = gateway
            }

            if (data && validateData(data)) {
                return { data, url, gateway }
            }

            failures.push(`${gateway}: GraphQL returned empty or invalid data`)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown fetch error'
            failures.push(`${gateway}: ${message}`)
        }
    }

    console.warn(`All GraphQL gateways failed validation for query. Returning fallback data. ${failures.join(' | ')}`)

    if (fallbackData !== undefined) {
        return {
            data: fallbackData,
            url: `${fallbackGateway}/graphql`,
            gateway: fallbackGateway
        }
    }

    return {
        data: {} as TData,
        url: `${gateways[0]}/graphql`,
        gateway: gateways[0]
    }
}

export function isLikelyImageContentType(contentType: string | null): boolean {
    if (!contentType) return false

    const normalized = contentType.toLowerCase()
    return normalized.startsWith('image/') || normalized.includes('application/octet-stream')
}

export async function validateArweaveImageWithFallback(
    transactionId: string,
    maxRetries = 10,
    retryDelay = 3000
): Promise<{ isValid: boolean; imageUrl?: string }> {
    const txPath = normalizePath(transactionId)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fetchWithGatewayFallback(
                txPath,
                {
                    method: 'HEAD',
                    cache: 'no-cache'
                },
                {
                    shouldAccept: (response) => response.ok && isLikelyImageContentType(response.headers.get('content-type'))
                }
            )

            return {
                isValid: true,
                imageUrl: result.url
            }
        } catch {
            if (attempt < maxRetries) {
                await sleep(retryDelay)
            }
        }
    }

    return { isValid: false }
}
