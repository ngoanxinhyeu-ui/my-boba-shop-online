import React, { useEffect, useRef } from 'react';
import { RoomState, Player, Role, Order, TEA_BASES } from '../../shared/types.ts';

interface BobaCanvasProps {
  room: RoomState;
  myPlayerId: string;
  myRole: Role;
  onSelectSeat?: (tableId: number, stoolIndex: number) => void;
  onOpenStation?: (station: 'tea' | 'topping' | 'fryer' | 'pos') => void;
}

export const BobaCanvas: React.FC<BobaCanvasProps> = ({
  room,
  myPlayerId,
  myRole,
  onSelectSeat,
  onOpenStation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Table definitions matching the prompt requirements:
  // - All stools are GHẾ KHÔNG TỰA (round stools without backrest)
  // - Table 1: Bàn Tròn (Round Table) with most stools around (8 stools)
  // - Table 2: Bàn Vuông (Square Table) with 4 stools
  // - Table 3: Bàn Chữ Nhật (Rectangular Table) with 6 stools
  // - Table 4: Bàn Vuông (Square Table) with 4 stools
  const tables = [
    {
      id: 1,
      name: 'Bàn Tròn Đại Gia Đình',
      type: 'round',
      cx: 430,
      cy: 210,
      radius: 46,
      stools: [
        { angle: 0, r: 76 },
        { angle: Math.PI / 4, r: 76 },
        { angle: Math.PI / 2, r: 76 },
        { angle: (3 * Math.PI) / 4, r: 76 },
        { angle: Math.PI, r: 76 },
        { angle: (5 * Math.PI) / 4, r: 76 },
        { angle: (3 * Math.PI) / 2, r: 76 },
        { angle: (7 * Math.PI) / 4, r: 76 },
      ],
    },
    {
      id: 2,
      name: 'Bàn Vuông 4 Người A',
      type: 'square',
      x: 370,
      y: 370,
      w: 80,
      h: 80,
      stools: [
        { x: 340, y: 410 }, // Left
        { x: 480, y: 410 }, // Right
        { x: 410, y: 340 }, // Top
        { x: 410, y: 480 }, // Bottom
      ],
    },
    {
      id: 3,
      name: 'Bàn Chữ Nhật 6 Người',
      type: 'rect',
      x: 560,
      y: 360,
      w: 140,
      h: 70,
      stools: [
        { x: 585, y: 330 },
        { x: 630, y: 330 },
        { x: 675, y: 330 },
        { x: 585, y: 460 },
        { x: 630, y: 460 },
        { x: 675, y: 460 },
      ],
    },
    {
      id: 4,
      name: 'Bàn Vuông 4 Người B',
      type: 'square',
      x: 620,
      y: 160,
      w: 74,
      h: 74,
      stools: [
        { x: 590, y: 197 },
        { x: 724, y: 197 },
        { x: 657, y: 130 },
        { x: 657, y: 264 },
      ],
    },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tickCount = 0;

    const render = () => {
      tickCount++;
      const width = canvas.width;
      const height = canvas.height;

      // 1. Draw Floor
      // Dining Area: Warm wooden tiles
      ctx.fillStyle = '#fef3c7'; // amber-100
      ctx.fillRect(0, 0, width, height);

      // Wood plank pattern
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Kitchen Area Floor: Cool tiled checkered kitchen
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 270, height);
      ctx.fillStyle = '#e2e8f0';
      for (let x = 0; x < 270; x += 30) {
        for (let y = 0; y < height; y += 30) {
          if ((x / 30 + y / 30) % 2 === 0) {
            ctx.fillRect(x, y, 30, 30);
          }
        }
      }

      // Border partition between kitchen & dining
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(268, 0, 4, height);

      // --- KITCHEN WORKSTATIONS ---
      // 1. Quầy Thu Ngân & Máy Tính Đơn Hàng (POS Station)
      ctx.save();
      ctx.fillStyle = '#334155'; // Dark slate counter
      ctx.fillRect(15, 20, 110, 80);
      ctx.fillStyle = '#475569';
      ctx.fillRect(20, 25, 100, 70);
      // POS Screen
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(35, 35, 70, 40);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px monospace';
      const queuedCount = room.orders.filter((o) => o.status === 'queued').length;
      ctx.fillText(`POS: ${queuedCount} ĐƠN`, 40, 52);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`DOANH THU`, 40, 64);
      // Cashier label
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('1. THU NGÂN', 25, 88);
      ctx.restore();

      // 2. Khu Vực Trả Món (Serving Counter)
      ctx.save();
      ctx.fillStyle = '#d97706'; // Amber wood hatch
      ctx.fillRect(140, 20, 115, 80);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(145, 25, 105, 70);
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('TRẢ MÓN', 170, 45);
      // Bell
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(195, 65, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Completed drink tray indicator
      const readyOrders = room.orders.filter((o) => o.status === 'ready');
      if (readyOrders.length > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(235, 35, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${readyOrders.length}`, 232, 39);
      }
      ctx.restore();

      // 3. Khu Quầy Trà (Tea Taps)
      ctx.save();
      ctx.fillStyle = '#64748b';
      ctx.fillRect(15, 130, 240, 95);
      ctx.fillStyle = '#475569';
      ctx.fillRect(20, 135, 230, 85);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('2. QUẦY VÒI TRÀ (ẤN GIỮ ĐÚNG VẠCH XANH)', 25, 150);

      // Draw 5 distinct tea taps
      const tapKeys = Object.keys(TEA_BASES) as (keyof typeof TEA_BASES)[];
      tapKeys.forEach((key, idx) => {
        const meta = TEA_BASES[key];
        const tapX = 35 + idx * 46;
        const tapY = 160;

        // Dispenser box
        ctx.fillStyle = meta.color;
        ctx.fillRect(tapX, tapY, 32, 45);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tapX, tapY, 32, 45);

        // Tap nozzle
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(tapX + 11, tapY + 45, 10, 8);

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        const shortName = key === 'tra_sua' ? 'SỮA' : key === 'hong_tra' ? 'HỒNG' : key === 'luc_tra' ? 'LỤC' : key === 'olong' ? 'ÔLONG' : 'THÁI';
        ctx.fillText(shortName, tapX + 4, tapY + 26);
      });
      ctx.restore();

      // 4. Khu Pha Ly, Khay Đường, Tủ Đá & Khay Topping
      ctx.save();
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(15, 245, 240, 125);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(20, 250, 230, 115);
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('3. KHAY ĐƯỜNG, TỦ ĐÁ & TOPPING', 25, 266);

      // 1. Tủ Đá (Ice Machine)
      ctx.fillStyle = room.equipment.iceMachineBroken ? '#f87171' : '#bae6fd';
      ctx.fillRect(24, 274, 42, 84);
      ctx.strokeStyle = '#0284c7';
      ctx.strokeRect(24, 274, 42, 84);
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('TỦ ĐÁ', 28, 292);
      ctx.fillText(`${room.equipment.iceRemaining}%`, 30, 308);
      // Ice cubes pattern
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(28, 318, 12, 12);
      ctx.fillRect(44, 326, 14, 14);

      // 2. KHAY ĐỊNH LƯỢNG ĐƯỜNG NƯỚC (Sugar Syrup Dispenser)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(72, 274, 46, 84);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(72, 274, 46, 84);

      // Syrup cylinder
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(77, 288, 36, 46);
      ctx.strokeStyle = '#ca8a04';
      ctx.strokeRect(77, 288, 36, 46);

      // Sugar pump nozzle on top
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(89, 276, 12, 10);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(93, 271, 4, 6);

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('KHAY', 80, 303);
      ctx.fillText('ĐƯỜNG', 78, 316);
      ctx.font = '7px sans-serif';
      ctx.fillStyle = '#b45309';
      ctx.fillText('0-100%', 80, 328);
      ctx.fillText('BƠM', 84, 350);

      // 3. Khay Topping (6 ô)
      const topColors = ['#1f1b18', '#eaeef5', '#dfa344', '#f87171', '#fbbf24', '#332924'];
      const topNames = ['TC Đen', 'TC Trắng', 'TC Sợi', 'Thạch', 'Pudding', 'S.Sáo'];
      for (let i = 0; i < 6; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const bx = 124 + col * 39;
        const by = 274 + row * 41;

        ctx.fillStyle = topColors[i];
        ctx.fillRect(bx, by, 36, 35);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, 36, 35);

        ctx.fillStyle = i === 1 || i === 4 ? '#000000' : '#ffffff';
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText(topNames[i], bx + 2, by + 21);
      }
      ctx.restore();

      // 5. Khu Đồ Ăn & Nồi Chiên Ngập Dầu (Fryer & Snack Station)
      ctx.save();
      ctx.fillStyle = '#b45309';
      ctx.fillRect(15, 385, 240, 115);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(20, 390, 230, 105);
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('4. BẾP CHIÊN NGẬP DẦU (GÀ RÁN & CÁ VIÊN)', 25, 408);

      // Two Fryer vats
      room.fryerSlots.forEach((slot, idx) => {
        const vx = 35 + idx * 110;
        const vy = 420;
        ctx.fillStyle = slot.state === 'frying' ? '#f59e0b' : slot.state === 'cooked' ? '#84cc16' : slot.state === 'burnt' ? '#1c1917' : '#d1d5db';
        ctx.fillRect(vx, vy, 95, 65);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.strokeRect(vx, vy, 95, 65);

        // Bubbling oil effect if frying
        if (slot.state === 'frying') {
          ctx.fillStyle = '#fef08a';
          for (let b = 0; b < 4; b++) {
            const bx = vx + 15 + ((tickCount * 2 + b * 20) % 65);
            const by = vy + 15 + ((b * 12) % 35);
            ctx.beginPath();
            ctx.arc(bx, by, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle = slot.state === 'burnt' ? '#f87171' : '#1e293b';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(slot.snackId === 'ga_ran' ? 'NỒI 1: GÀ RÁN' : 'NỒI 2: CÁ VIÊN', vx + 8, vy + 20);
        ctx.fillText(`Trạng thái: ${slot.state.toUpperCase()}`, vx + 8, vy + 36);
        if (slot.state === 'frying') {
          ctx.fillText(`TG: ${slot.elapsedSec}s / ${slot.targetSec}s`, vx + 8, vy + 52);
        } else if (slot.state === 'cooked') {
          ctx.fillStyle = '#15803d';
          ctx.fillText(`CHÍN VÀNG! NHẤC RA!`, vx + 8, vy + 52);
        } else if (slot.state === 'burnt') {
          ctx.fillStyle = '#dc2626';
          ctx.fillText(`ĐÃ CHÁY KHÉT!`, vx + 8, vy + 52);
        }
      });
      ctx.restore();

      // --- DINING AREA: TABLES & GHẾ ĐÔN TRÒN KHÔNG TỰA ---
      tables.forEach((tbl) => {
        ctx.save();
        if (tbl.type === 'round') {
          // Bàn tròn lớn (Round Table)
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.arc(tbl.cx!, tbl.cy!, tbl.radius!, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 4;
          ctx.stroke();

          // Table center pattern
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(tbl.cx!, tbl.cy!, tbl.radius! - 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('BÀN TRÒN', tbl.cx!, tbl.cy! - 4);
          ctx.font = '8px sans-serif';
          ctx.fillText('(8 Ghế Đôn)', tbl.cx!, tbl.cy! + 8);

          // 8 Ghế đôn tròn xung quanh (Round Stools without backrest)
          tbl.stools.forEach((st, idx) => {
            const sx = tbl.cx! + Math.cos((st as any).angle) * (st as any).r;
            const sy = tbl.cy! + Math.sin((st as any).angle) * (st as any).r;

            drawRoundStool(ctx, sx, sy, tbl.id, idx, room, myPlayerId);
          });
        } else {
          // Bàn Vuông hoặc Chữ Nhật (Square or Rectangular Table)
          ctx.fillStyle = '#b45309';
          ctx.fillRect(tbl.x!, tbl.y!, tbl.w!, tbl.h!);
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.strokeRect(tbl.x!, tbl.y!, tbl.w!, tbl.h!);

          // Inner wood finish
          ctx.fillStyle = '#d97706';
          ctx.fillRect(tbl.x! + 6, tbl.y! + 6, tbl.w! - 12, tbl.h! - 12);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(tbl.name.slice(0, 9), tbl.x! + tbl.w! / 2, tbl.y! + tbl.h! / 2);

          // Stools around square/rect table
          tbl.stools.forEach((st, idx) => {
            drawRoundStool(ctx, (st as any).x, (st as any).y, tbl.id, idx, room, myPlayerId);
          });
        }
        ctx.restore();
      });

      // --- DRAW NPC WAITER (Nhân viên phục vụ) ---
      const waiter = room.waiter;
      ctx.save();
      // Waiter shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(waiter.x, waiter.y + 16, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (Green uniform)
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(waiter.x, waiter.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#047857';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Waiter Cap / Apron
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.arc(waiter.x, waiter.y - 6, 8, Math.PI, Math.PI * 2);
      ctx.fill();

      // If carrying food/drink tray
      if (waiter.carryingOrderId) {
        ctx.fillStyle = '#f59e0b'; // Tray
        ctx.fillRect(waiter.x - 12, waiter.y - 18, 24, 6);
        // Cup on tray
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(waiter.x - 4, waiter.y - 26, 8, 8);
      }

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PHỤC VỤ', waiter.x, waiter.y + 28);

      // Display 5-second delivery status bubble when delivering to customer table
      if (waiter.status === 'delivering') {
        const sec = waiter.deliveryTimerSec ?? 5;
        // Speech / status bubble
        ctx.fillStyle = 'rgba(4, 120, 87, 0.95)';
        ctx.beginPath();
        ctx.roundRect(waiter.x - 56, waiter.y - 54, 112, 24, 6);
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🚚 Bưng món tới bàn (${sec}s)`, waiter.x, waiter.y - 41);

        // Mini 5-second countdown progress bar
        const pct = Math.max(0, Math.min(1, (5 - sec) / 5));
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(waiter.x - 46, waiter.y - 36, 92, 4);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(waiter.x - 46, waiter.y - 36, 92 * pct, 4);
      }
      ctx.restore();

      // --- DRAW RUSH WARNING IF ACTIVE ---
      if (room.rushAlert.active && (tickCount % 30 < 20)) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillRect(280, 15, 450, 36);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(280, 15, 450, 36);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🚨 CẢNH BÁO: ${room.rushAlert.message}`, 505, 38);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [room, myPlayerId]);

  // Helper to draw a round stool without backrest and any seated customer
  const drawRoundStool = (
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    tableId: number,
    stoolIdx: number,
    rm: RoomState,
    currentPid: string
  ) => {
    // 1. Stool Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 3, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Round Stool Body (Ghế đôn tròn vỉa hè)
    ctx.fillStyle = '#e2e8f0'; // Metallic light grey frame
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fill();

    // Stool cushion (warm terracotta circle)
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();

    // Check if any player or AI is sitting here
    const seatedPlayer = Object.values(rm.players).find(
      (p) => p.tableId === tableId && p.stoolIndex === stoolIdx
    );

    if (seatedPlayer) {
      const isMe = seatedPlayer.id === currentPid;
      // Draw Customer Avatar
      ctx.fillStyle = isMe ? '#3b82f6' : seatedPlayer.isAI ? '#ec4899' : '#8b5cf6';
      ctx.beginPath();
      ctx.arc(sx, sy - 2, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Smile face
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx - 4, sy - 5, 2, 0, Math.PI * 2);
      ctx.arc(sx + 4, sy - 5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Customer Name Tag
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isMe ? 'BẠN' : seatedPlayer.name.slice(0, 8),
        sx,
        sy - 18
      );

      // Check if this seated customer has an active order
      const playerOrder = rm.orders.find(
        (o) =>
          o.customerId === seatedPlayer.id &&
          (o.status === 'queued' || o.status === 'in_progress' || o.status === 'ready' || o.status === 'delivering')
      );

      if (playerOrder) {
        // Floating order bubble
        ctx.fillStyle = playerOrder.elapsedSeconds > 60 ? '#ef4444' : '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(sx - 18, sy - 42, 36, 18, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = playerOrder.elapsedSeconds > 60 ? '#ffffff' : '#0f172a';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(`Đơn #${playerOrder.orderNumber}`, sx, sy - 30);
      }
    }
  };

  // Canvas click interaction: Select Stool or Workstation
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    // Check click on workstations if Seller
    if (clickX < 268 && onOpenStation) {
      if (clickY >= 20 && clickY <= 100) {
        onOpenStation(clickX < 130 ? 'pos' : 'pos');
      } else if (clickY >= 130 && clickY <= 230) {
        onOpenStation('tea');
      } else if (clickY >= 245 && clickY <= 370) {
        onOpenStation('topping');
      } else if (clickY >= 385 && clickY <= 500) {
        onOpenStation('fryer');
      }
      return;
    }

    // Check click on stools if Customer
    if (myRole === 'customer' && onSelectSeat) {
      tables.forEach((tbl) => {
        if (tbl.type === 'round') {
          tbl.stools.forEach((st, idx) => {
            const sx = tbl.cx! + Math.cos((st as any).angle) * (st as any).r;
            const sy = tbl.cy! + Math.sin((st as any).angle) * (st as any).r;
            const dist = Math.hypot(clickX - sx, clickY - sy);
            if (dist < 20) {
              onSelectSeat(tbl.id, idx);
            }
          });
        } else {
          tbl.stools.forEach((st, idx) => {
            const sx = (st as any).x;
            const sy = (st as any).y;
            const dist = Math.hypot(clickX - sx, clickY - sy);
            if (dist < 20) {
              onSelectSeat(tbl.id, idx);
            }
          });
        }
      });
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl border-4 border-amber-900/20 bg-slate-900 flex justify-center items-center">
      <canvas
        ref={canvasRef}
        width={750}
        height={520}
        onClick={handleCanvasClick}
        className="w-full max-w-[750px] aspect-[750/520] cursor-pointer"
      />
      {/* Visual Guide Overlay */}
      <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-slate-200 border border-slate-700 pointer-events-none flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Sơ đồ quán 2D: Quầy Barista (Trái) & Phòng Trà Ghế Đôn (Phải)</span>
      </div>
    </div>
  );
};
