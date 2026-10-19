import React, { useState, useEffect, useRef } from 'react';
import { sounds } from '../audio/soundEffects.ts';
import confetti from 'canvas-confetti';
import { Trophy, Clock, Sparkles, Gamepad2, ArrowLeft, ArrowRight, DollarSign } from 'lucide-react';

interface MiniGameModalProps {
  onClose: () => void;
  onReward: (amount: number) => void;
}

interface FallingItem {
  id: number;
  x: number;
  y: number;
  type: 'black' | 'white' | 'gold' | 'pudding' | 'bomb';
  points: number;
  speed: number;
}

export const MiniGameModal: React.FC<MiniGameModalProps> = ({ onClose, onReward }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [cupX, setCupX] = useState(200); // 0 to 400
  const [items, setItems] = useState<FallingItem[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Start mini game
  const handleStart = () => {
    setIsPlaying(true);
    setIsGameOver(false);
    setScore(0);
    setCombo(0);
    setTimeLeft(25);
    setItems([]);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setCupX((prev) => Math.max(30, prev - 30));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setCupX((prev) => Math.min(370, prev + 30));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Touch / mouse drag controls
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPlaying) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    setCupX(Math.max(30, Math.min(370, x)));
  };

  // Main game tick: items falling & timer
  useEffect(() => {
    if (!isPlaying || isGameOver) return;

    // Countdown timer
    const timerInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          setIsGameOver(true);
          setIsPlaying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Item spawner & physics loop
    let animId: number;
    let spawnCounter = 0;

    const gameLoop = () => {
      spawnCounter++;
      // Spawn new item every ~30 frames
      if (spawnCounter % 28 === 0) {
        const roll = Math.random();
        let type: FallingItem['type'] = 'black';
        let pts = 10;
        if (roll < 0.15) {
          type = 'bomb';
          pts = -20;
        } else if (roll < 0.4) {
          type = 'pudding';
          pts = 30;
        } else if (roll < 0.6) {
          type = 'gold';
          pts = 25;
        } else if (roll < 0.8) {
          type = 'white';
          pts = 15;
        }

        setItems((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            x: 20 + Math.random() * 360,
            y: 0,
            type,
            points: pts,
            speed: 3 + Math.random() * 2.5,
          },
        ]);
      }

      // Move items down & check collision with cup at y = 280
      setItems((prev) => {
        const remaining: FallingItem[] = [];
        prev.forEach((it) => {
          const nextY = it.y + it.speed;
          // Check collision with cup (cup is at x: cupX, width ~60, y: 280-320)
          if (nextY >= 270 && nextY <= 310 && Math.abs(it.x - cupX) < 40) {
            // Caught!
            if (it.type === 'bomb') {
              sounds.playBuzz();
              setCombo(0);
              setScore((s) => Math.max(0, s + it.points));
            } else {
              sounds.playPop();
              setCombo((c) => c + 1);
              setScore((s) => s + it.points);
            }
          } else if (nextY < 330) {
            remaining.push({ ...it, y: nextY });
          }
        });
        return remaining;
      });

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      clearInterval(timerInterval);
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, isGameOver, cupX]);

  // When game over, trigger celebration & award money to Customer
  useEffect(() => {
    if (isGameOver) {
      sounds.playSuccess();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      // Convert points to real VND reward (1 point = 500 VND)
      const cashReward = Math.max(5000, score * 500);
      onReward(cashReward);
    }
  }, [isGameOver]);

  const earnedCash = Math.max(5000, score * 500);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-lg bg-gradient-to-b from-purple-50 to-indigo-100 rounded-3xl p-5 md:p-6 border-4 border-purple-400 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-purple-950 font-['Comfortaa',sans-serif]">
                Hứng Trân Châu Tích Lũy Tiền
              </h3>
              <p className="text-xs text-purple-800">
                Chơi mini-game trong lúc chờ đơn hàng để nhận thêm tiền vào ví!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-purple-200 text-purple-900 font-black hover:bg-purple-300 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/80 rounded-xl border border-purple-200 text-xs font-bold text-slate-800">
          <div className="flex items-center gap-1.5 text-orange-600 font-mono text-sm">
            <Trophy className="w-4 h-4" /> Điểm: <b>{score}</b> {combo > 2 && `(Combo x${combo}!)`}
          </div>
          <div className="flex items-center gap-1.5 text-purple-700 font-mono text-sm">
            <Clock className="w-4 h-4" /> Thời gian: <b>{timeLeft}s</b>
          </div>
        </div>

        {/* Game Canvas Area */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          className="relative w-full h-[320px] bg-gradient-to-b from-sky-100 to-indigo-200 rounded-2xl border-2 border-indigo-400 overflow-hidden shadow-inner cursor-ew-resize select-none touch-none"
        >
          {!isPlaying && !isGameOver && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 text-white z-20">
              <Sparkles className="w-12 h-12 text-yellow-300 mb-2 animate-pulse" />
              <h4 className="text-xl font-black mb-1">Quy Tắc Mini-Game</h4>
              <p className="text-xs text-slate-200 max-w-xs mb-4">
                Dùng phím mũi tên hoặc kéo ngón tay để di chuyển Ly trà sữa hứng Trân Châu, Pudding và né Băng Hỏng!
              </p>
              <button
                onClick={handleStart}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-sm rounded-xl shadow-lg transition active:scale-95"
              >
                BẮT ĐẦU CHƠI NGAY
              </button>
            </div>
          )}

          {isGameOver && (
            <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4 text-white z-20">
              <Trophy className="w-14 h-14 text-yellow-400 mb-2 animate-bounce" />
              <h4 className="text-2xl font-black text-yellow-300">HOÀN THÀNH MINI-GAME!</h4>
              <p className="text-sm text-slate-200 mt-1">
                Điểm số đạt được: <b>{score} điểm</b>
              </p>
              <div className="my-3 px-4 py-2 bg-emerald-600/90 rounded-xl border border-emerald-400 flex items-center gap-2 text-base font-black">
                <DollarSign className="w-5 h-5 text-yellow-300" />
                <span>+ {earnedCash.toLocaleString('vi-VN')} VNĐ vào Ví!</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleStart}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow"
                >
                  Chơi Lại Lần Nữa
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow"
                >
                  Đóng & Xem Đơn Hàng
                </button>
              </div>
            </div>
          )}

          {/* Falling Boba Items */}
          {items.map((it) => (
            <div
              key={it.id}
              className={`absolute rounded-full border shadow transform -translate-x-1/2 -translate-y-1/2 transition-none flex items-center justify-center text-[10px] font-bold ${
                it.type === 'black'
                  ? 'w-7 h-7 bg-slate-900 border-slate-700 text-white'
                  : it.type === 'white'
                  ? 'w-7 h-7 bg-white border-slate-300 text-slate-800'
                  : it.type === 'gold'
                  ? 'w-8 h-8 bg-amber-400 border-yellow-200 text-amber-950 font-black animate-pulse'
                  : it.type === 'pudding'
                  ? 'w-9 h-9 bg-yellow-300 border-amber-400 text-amber-950 font-black'
                  : 'w-7 h-7 bg-red-600 border-red-800 text-white font-black'
              }`}
              style={{
                left: `${(it.x / 400) * 100}%`,
                top: `${(it.y / 320) * 100}%`,
              }}
            >
              {it.type === 'bomb' ? '💣' : it.type === 'pudding' ? '🍮' : '●'}
            </div>
          ))}

          {/* Player Boba Cup at bottom */}
          <div
            className="absolute bottom-2 transform -translate-x-1/2 flex flex-col items-center pointer-events-none transition-none"
            style={{ left: `${(cupX / 400) * 100}%` }}
          >
            {/* Straw */}
            <div className="w-2.5 h-6 bg-red-500 rounded-t transform rotate-12 -mb-1 shadow" />
            {/* Cup */}
            <div className="w-14 h-16 bg-gradient-to-b from-white/90 to-amber-200/90 border-2 border-slate-700 rounded-b-xl shadow-lg flex items-center justify-center text-xs font-black text-slate-800">
              🧋
            </div>
          </div>
        </div>

        {/* Touch / Mouse navigation buttons for mobile */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => setCupX((prev) => Math.max(30, prev - 35))}
            className="flex-1 py-2.5 bg-white hover:bg-purple-50 text-purple-900 font-bold text-xs rounded-xl border border-purple-300 shadow flex items-center justify-center gap-1 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" /> Di chuyển Trái
          </button>
          <button
            onClick={() => setCupX((prev) => Math.min(370, prev + 35))}
            className="flex-1 py-2.5 bg-white hover:bg-purple-50 text-purple-900 font-bold text-xs rounded-xl border border-purple-300 shadow flex items-center justify-center gap-1 active:scale-95"
          >
            Di chuyển Phải <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
