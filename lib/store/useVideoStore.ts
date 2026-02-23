import { create } from 'zustand'

interface VideoStore {
    activeVideoId: string | null
    activeVideoLikes: number
    activeVideoComments: number
    setActiveVideo: (id: string, likes: number, comments: number) => void
    setCommentCount: (count: number) => void
    incrementCommentCount: () => void
    incrementLikeCount: () => void
    decrementLikeCount: () => void
}

export const useVideoStore = create<VideoStore>((set) => ({
    activeVideoId: null,
    activeVideoLikes: 0,
    activeVideoComments: 0,

    setActiveVideo: (id, likes, comments) =>
        set({ activeVideoId: id, activeVideoLikes: likes, activeVideoComments: comments }),

    setCommentCount: (count) =>
        set({ activeVideoComments: count }),

    incrementCommentCount: () =>
        set((state) => ({ activeVideoComments: state.activeVideoComments + 1 })),

    incrementLikeCount: () =>
        set((state) => ({ activeVideoLikes: state.activeVideoLikes + 1 })),

    decrementLikeCount: () =>
        set((state) => ({ activeVideoLikes: Math.max(0, state.activeVideoLikes - 1) }))
}))
