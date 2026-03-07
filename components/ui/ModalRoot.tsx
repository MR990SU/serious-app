'use client'

import { createPortal } from "react-dom"
import { useEffect, useState } from "react"

export default function ModalRoot({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const portal = document.getElementById("modal-root")
    if (!portal) return null

    return createPortal(children, portal)
}
