import React, { useState, useEffect, useRef } from 'react';
import { Maximize, Minimize } from 'lucide-react';

interface TabletControlsProps {
  className?: string;
  compact?: boolean;
  variant?: 'dark' | 'light';
}

export function TabletControls({ className = '', compact = true, variant = 'dark' }: TabletControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const wakeLockRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync Fullscreen state with browser events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Request native Screen Wake Lock (API support)
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('Native Wake Lock failed:', err);
      }
    }
  };

  // Trigger video playback for hardware media wake-lock
  const triggerPlay = () => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current
        .play()
        .catch(() => {});
    }
  };

  // Generate continuous 30fps MediaStream video track (YouTube Live style)
  const startLiveVideoStream = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let count = 0;
    const draw = () => {
      count++;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = count % 2 === 0 ? '#10b981' : '#3b82f6';
      ctx.fillRect(0, 0, 16, 16);
      animRef.current = requestAnimationFrame(draw);
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    draw();

    try {
      if (!streamRef.current && (canvas as any).captureStream) {
        streamRef.current = (canvas as any).captureStream(30);
      }
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        triggerPlay();
      }
    } catch (err) {
      console.warn('captureStream error:', err);
    }
  };

  const stopLiveVideoStream = () => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const startStayAwake = async () => {
    startLiveVideoStream();
    await requestWakeLock();
  };

  const stopStayAwake = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (e) {}
    }
    stopLiveVideoStream();
  };

  // Run Stay Awake automatically 100% of the time in the background
  useEffect(() => {
    startStayAwake();

    const handleGlobalUserTouch = () => {
      triggerPlay();
      requestWakeLock();
    };

    window.addEventListener('touchstart', handleGlobalUserTouch, { passive: true });
    window.addEventListener('pointerdown', handleGlobalUserTouch, { passive: true });
    window.addEventListener('click', handleGlobalUserTouch, { passive: true });

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        startLiveVideoStream();
        triggerPlay();
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('touchstart', handleGlobalUserTouch);
      window.removeEventListener('pointerdown', handleGlobalUserTouch);
      window.removeEventListener('click', handleGlobalUserTouch);
      document.removeEventListener('visibilitychange', handleVisibility);
      stopStayAwake();
    };
  }, []);

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Fullscreen button styling based on header background
  const fullActiveStyle =
    variant === 'light'
      ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm hover:bg-amber-200'
      : 'bg-amber-500/30 border-amber-400/50 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.3)] hover:bg-amber-500/40';

  const fullInactiveStyle =
    variant === 'light'
      ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
      : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white';

  const iconFullColor = variant === 'light' ? 'text-amber-700' : 'text-amber-300';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Invisible off-screen canvas & video elements handling background YouTube-style media wake-lock */}
      <canvas ref={canvasRef} width={16} height={16} className="hidden pointer-events-none" />
      <video
        ref={videoRef}
        playsInline
        autoPlay
        loop
        muted
        controls={false}
        className="fixed top-0 left-0 w-1 h-1 opacity-0 pointer-events-none z-[-1]"
      />

      {/* Fullscreen Toggle Button */}
      <button
        onClick={toggleFullscreen}
        className={`h-9 flex items-center justify-center gap-1.5 ${
          compact ? 'w-9 px-0' : 'px-3'
        } rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
          isFullscreen ? fullActiveStyle : fullInactiveStyle
        }`}
        title={isFullscreen ? 'Keluar dari Fullscreen (ESC)' : 'Mode Fullscreen (Layar Penuh Tablet/HP)'}
      >
        {isFullscreen ? (
          <>
            <Minimize className={`w-4 h-4 ${iconFullColor}`} />
            {!compact && <span className="whitespace-nowrap">Exit Fullscreen</span>}
          </>
        ) : (
          <>
            <Maximize className="w-4 h-4" />
            {!compact && <span className="whitespace-nowrap">Fullscreen</span>}
          </>
        )}
      </button>
    </div>
  );
}
