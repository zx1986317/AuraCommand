import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import { I18nProvider } from './i18n/I18nContext'
import { applyStoredTheme } from './i18n/ThemeSwitcher'
import './styles/index.css'

// P3 任务 1：在 React 挂载前先应用 localStorage 中的主题，避免首屏闪白/闪黑
applyStoredTheme();

// P2 #4：reducedMotion="user" 让 framer-motion 跟随系统"减少动效"设置。
// CSS 侧的 animate-* / transition-* 由 styles/index.css 的
// @media (prefers-reduced-motion: reduce) 全局禁用。
//
// P2 #6：i18n 顶层 Provider，包裹整个 App 让所有子组件共享语言状态
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </I18nProvider>
  </React.StrictMode>,
)

// Remove Preload-Script loading screen
window.postMessage({ payload: 'removeLoading' }, '*')
