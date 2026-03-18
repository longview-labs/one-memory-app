import type { HandlePlatform } from '@/utils/handle-links'

const STORAGE_KEY = 'memories_user_uploads'

export interface LocalMemory {
    id: string
    title: string
    location: string
    handle: string
    handlePlatform: HandlePlatform
    description?: string
    imageUrl: string
    date: string
    isPublic: boolean
}

export function getLocalMemories(): LocalMemory[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        return JSON.parse(raw) as LocalMemory[]
    } catch {
        return []
    }
}

export function saveLocalMemory(memory: LocalMemory): void {
    const memories = getLocalMemories()
    const index = memories.findIndex(m => m.id === memory.id)
    if (index >= 0) {
        memories[index] = memory
    } else {
        memories.unshift(memory)
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memories))
    } catch (e) {
        console.error('Failed to save local memory:', e)
    }
}

export function removeLocalMemory(id: string): void {
    const memories = getLocalMemories().filter(m => m.id !== id)
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memories))
    } catch (e) {
        console.error('Failed to remove local memory:', e)
    }
}
