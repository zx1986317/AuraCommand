import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface ImagePreviewProps {
  src: string
  alt?: string
  className?: string
  children?: React.ReactNode
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ src, alt, className, children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleOpen = useCallback(() => {
    setIsOpen(true)
    setScale(1)
    setRotation(0)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = alt || 'ai-generated-image.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[ImagePreview] Download failed:', err)
      window.open(src, '_blank')
    }
  }, [src, alt])

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.25))
  }, [])

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
      if (e.key === '+' || e.key === '=') handleZoomIn()
      if (e.key === '-') handleZoomOut()
      if (e.key === 'r') handleRotate()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose, handleZoomIn, handleZoomOut, handleRotate])

  return (
    <>
      <span
        className="block my-3 not-prose cursor-zoom-in group"
        onClick={handleOpen}
      >
        {children || (
          <img
            src={src}
            alt={alt || 'AI生成图片'}
            className={`${className || 'max-w-full max-h-[512px]'} rounded-2xl border border-teal-900/10 shadow-sm object-contain transition-all group-hover:shadow-md group-hover:border-accent/20`}
            loading="lazy"
          />
        )}
        <span className="flex items-center justify-center gap-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn size={12} className="text-muted" />
          <span className="text-2xs text-muted">点击预览</span>
        </span>
      </span>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-all"
                  title="缩小 (-)"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="px-2 py-1 rounded-lg bg-black/50 text-white text-xs font-mono min-w-[50px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-all"
                  title="放大 (+)"
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-all"
                  title="旋转 (R)"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-all"
                  title="保存图片"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-all"
                  title="关闭 (Esc)"
                >
                  <X size={18} />
                </button>
              </div>

              <img
                src={src}
                alt={alt || 'AI生成图片'}
                className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
                draggable={false}
              />

              {alt && (
                <div className="mt-4 px-4 py-2 rounded-xl bg-black/50 text-white text-sm text-center max-w-lg">
                  {alt}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export const MarkdownImage: React.FC<{ src?: string | undefined; alt?: string | undefined }> = ({ src, alt }) => {
  if (!src) return null
  return (
    <ImagePreview src={src} alt={alt || 'AI生成图片'}>
      <img
        src={src}
        alt={alt || 'AI生成图片'}
        className="max-w-full max-h-[512px] rounded-2xl border border-teal-900/10 shadow-sm object-contain"
        loading="lazy"
      />
    </ImagePreview>
  )
}
