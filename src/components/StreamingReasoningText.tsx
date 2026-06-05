import React, { useState, useEffect } from 'react';

const StreamingReasoningText: React.FC<{ text: string; animate: boolean }> = ({ text, animate }) => {
  const normalizedText = String(text || '');
  const [displayLength, setDisplayLength] = useState(animate ? 0 : normalizedText.length);

  useEffect(() => {
    if (!animate) {
      setDisplayLength(normalizedText.length);
      return;
    }
    setDisplayLength(prev => Math.min(prev, normalizedText.length));
  }, [animate, normalizedText]);

  useEffect(() => {
    if (!animate || displayLength >= normalizedText.length) return;
    const remaining = normalizedText.length - displayLength;
    const step = remaining > 160 ? 8 : remaining > 80 ? 4 : remaining > 30 ? 2 : 1;
    const timer = window.setTimeout(() => {
      setDisplayLength(prev => Math.min(normalizedText.length, prev + step));
    }, 16);
    return () => window.clearTimeout(timer);
  }, [animate, displayLength, normalizedText.length]);

  const visibleText = animate ? normalizedText.slice(0, displayLength) : normalizedText;
  return (
    <>
      {visibleText}
      {animate && displayLength < normalizedText.length && (
        <span className="ml-0.5 inline-block animate-pulse text-amber-700/70">|</span>
      )}
    </>
  );
};

export default StreamingReasoningText;
