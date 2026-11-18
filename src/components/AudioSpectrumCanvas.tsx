import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface AudioSpectrumCanvasProps {
  analyserRef: RefObject<AnalyserNode | null>;
  isPlaying: boolean;
  barCount?: number;
  height?: number;
  className?: string;
}

export function AudioSpectrumCanvas({
  analyserRef,
  isPlaying,
  barCount = 44,
  height = 84,
  className = '',
}: AudioSpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<Float32Array>(new Float32Array(barCount));
  const smoothRef = useRef<Float32Array>(new Float32Array(barCount));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let dataArray: Uint8Array<ArrayBuffer> | null = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      const width = canvas.getBoundingClientRect().width || 300;
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      if (analyser && !dataArray) {
        dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }
      if (analyser && dataArray && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      }

      const gap = 3;
      const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);

      // Subtle horizon baseline
      ctx.fillStyle = 'rgba(30, 38, 56, 0.8)';
      ctx.fillRect(0, height - 1, width, 1);

      for (let i = 0; i < barCount; i += 1) {
        let target = 0.04;
        if (isPlaying && dataArray && dataArray.length > 0) {
          const binIndex = Math.min(
            dataArray.length - 1,
            Math.floor((i / barCount) * (dataArray.length * 0.85))
          );
          target = Math.max(0.05, dataArray[binIndex] / 255);
        } else {
          // Calm architectural idle curve
          const wave = Math.sin((i / barCount) * Math.PI) * 0.08 + 0.03;
          target = wave;
        }

        const prev = smoothRef.current[i] || 0;
        const smoothing = prefersReducedMotion ? 0.5 : 0.28;
        const val = prev + (target - prev) * smoothing;
        smoothRef.current[i] = val;

        if (val > peaksRef.current[i]) {
          peaksRef.current[i] = val;
        } else {
          peaksRef.current[i] = Math.max(val, peaksRef.current[i] - 0.009);
        }

        const barH = Math.max(2, val * (height - 10));
        const x = i * (barWidth + gap);
        const y = height - barH - 2;

        const grad = ctx.createLinearGradient(0, height, 0, y);
        grad.addColorStop(0, 'rgba(6, 229, 245, 0.18)');
        grad.addColorStop(0.65, 'rgba(6, 229, 245, 0.72)');
        grad.addColorStop(1, val > 0.72 ? '#F43F5E' : '#06E5F5');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barH);

        // Crisp peak hold cap
        const peakY = height - Math.max(3, peaksRef.current[i] * (height - 10)) - 4;
        ctx.fillStyle = peaksRef.current[i] > 0.72 ? 'rgba(244, 63, 94, 0.85)' : 'rgba(6, 229, 245, 0.9)';
        ctx.fillRect(x, peakY, barWidth, 1.5);
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [analyserRef, barCount, height, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className={`w-full block ${className}`}
      aria-label="Live audio frequency spectrum"
    />
  );
}
