import { create } from 'zustand'

type FeedFilter = 'forYou' | 'following'

interface VideoStore {
    activeVideoId: string | null
    activeVideoLikes: number
    activeVideoComments: number
    feedFilter: FeedFilter
    autoPlayEnabled: boolean
    isMuted: boolean
    setActiveVideo: (id: string, likes: number, comments: number) => void
    setCommentCount: (count: number) => void
    incrementCommentCount: () => void
    incrementLikeCount: () => void
    decrementLikeCount: () => void
    setFeedFilter: (filter: FeedFilter) => void
    setAutoPlayEnabled: (enabled: boolean) => void
    setMuted: (value: boolean) => void
    currentIndex: number
    setCurrentIndex: (index: number) => void
}

export const useVideoStore = create<VideoStore>((set) => ({
    activeVideoId: null,
    activeVideoLikes: 0,
    activeVideoComments: 0,
    feedFilter: 'forYou',
    autoPlayEnabled: true,
    isMuted: true,
    currentIndex: 0,

    setActiveVideo: (id, likes, comments) =>
        set({ activeVideoId: id, activeVideoLikes: likes, activeVideoComments: comments }),

    setCommentCount: (count) =>
        set({ activeVideoComments: count }),

    incrementCommentCount: () =>
        set((state) => ({ activeVideoComments: state.activeVideoComments + 1 })),

    incrementLikeCount: () =>
        set((state) => ({ activeVideoLikes: state.activeVideoLikes + 1 })),

    decrementLikeCount: () =>
        set((state) => ({ activeVideoLikes: Math.max(0, state.activeVideoLikes - 1) })),

    setFeedFilter: (filter) =>
        set({ feedFilter: filter }),

    setAutoPlayEnabled: (enabled) =>
        set({ autoPlayEnabled: enabled }),

    setMuted: (value) =>
        set({ isMuted: value }),

    setCurrentIndex: (index) =>
        set({ currentIndex: index }),
}))
