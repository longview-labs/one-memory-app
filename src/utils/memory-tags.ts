export interface ArweaveTag {
    name: string
    value: string
}

export interface GraphqlTagFilter {
    name: string
    values: string[]
}

export const MEMORY_APP_NAME = 'Memories-App'
export const MEMORY_APP_VERSION = '1.0.4'

export const getMemoryAppEnv = (): 'Dev' | 'Prod' => (import.meta.env.DEV ? 'Dev' : 'Prod')

export const buildMemoryBaseTags = (): ArweaveTag[] => [
    { name: 'App-Name', value: MEMORY_APP_NAME },
    { name: 'App-Version', value: MEMORY_APP_VERSION },
    { name: 'App-Env', value: getMemoryAppEnv() },
]

export const buildMemoryUploadTags = (file: File, extraTags: ArweaveTag[] = []): ArweaveTag[] => [
    ...buildMemoryBaseTags(),
    { name: 'Content-Type', value: file.type ?? 'application/octet-stream' },
    { name: 'Name', value: file.name ?? 'unknown' },
    ...extraTags,
]

export const buildMemoryFetchTagFilters = (): GraphqlTagFilter[] => [
    { name: 'App-Name', values: [MEMORY_APP_NAME] },
    { name: 'App-Version', values: [MEMORY_APP_VERSION] },
    { name: 'App-Env', values: [getMemoryAppEnv()] },
    { name: 'Visibility', values: ['Public'] },
]
