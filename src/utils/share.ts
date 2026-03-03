export const getMemoryShareUrl = (id: string) => `${window.location.origin}/#/view/${id}`

export const getMemoryTweetText = (title: string, shareUrl: string) => {
    return `Check out this memory "${title || 'Memory'}" preserved forever! 🌟\n\nView it at: ${shareUrl}\n\n(paste the copied image here and remove this text)`
}
