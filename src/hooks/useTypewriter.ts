import { useState, useEffect, useRef } from 'react';

export function useTypewriter(text: string, enabled: boolean = true, speed: number = 10) {
  const [displayedText, setDisplayedText] = useState(enabled ? "" : text);
  const index = useRef(enabled ? 0 : text.length);

  // If enabled changes to false, show full text immediately
  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      index.current = text.length;
    }
  }, [enabled, text]);

  // Reset if text shrinks (e.g. new conversation loaded but component reused?)
  // Although typically component would be unmounted. 
  // But strictly, if text.length < index.current, we should reset.
  useEffect(() => {
    if (text.length < index.current) {
        index.current = text.length;
        setDisplayedText(text);
    }
  }, [text]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (index.current < text.length) {
        // Calculate jump to catch up if falling behind.
        // We want it smooth but responsive. 
        // If 100 chars behind, jump 5 chars.
        const lag = text.length - index.current;
        // If lag is huge, jump more.
        const jump = Math.max(1, Math.ceil(lag / 25)); 
        
        index.current = Math.min(index.current + jump, text.length);
        setDisplayedText(text.slice(0, index.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, enabled]);

  return displayedText;
}
