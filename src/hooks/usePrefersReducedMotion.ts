/**
 * P2 #4：prefers-reduced-motion 探测 hook
 *
 * 用途：JS 侧（framer-motion 之外）需要根据系统"减少动效"设置做分支判断时使用。
 * 例：自动播放视频、触发轮播滚动、JS 动画等场景。
 *
 * 与 CSS @media (prefers-reduced-motion: reduce) 的关系：
 *  - CSS 侧：全局禁用 animate-* 与 transition-*（已在 styles/index.css 落地）
 *  - JS 侧：本 hook 用于"还需要继续做事，只是不用动画过渡"的场景
 *
 * 与 framer-motion 的关系：
 *  - MotionConfig reducedMotion="user" 已自动读取同一系统设置并调整 spring/tween
 *  - 本 hook 不替代 MotionConfig，仅为非 framer-motion 场景补位
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const getInitial = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
};

export const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    // 兼容新旧 API
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return reduced;
};
