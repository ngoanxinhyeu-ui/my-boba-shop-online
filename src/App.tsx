import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  RoomState,
  Role,
  Player,
  ChatMessage,
  SnackId,
  Order,
} from '../shared/types.ts';
import { BobaCanvas } from './game/BobaCanvas.tsx';
import { Lobby } from './components/Lobby.tsx';
import { CustomerUI } from './components/CustomerUI.tsx';
import { SellerUI } from './components/SellerUI.tsx';
import { MiniGameModal } from './components/MiniGameModal.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { DaySummaryModal } from './components/DaySummaryModal.tsx';
import { sounds } from './audio/soundEffects.ts';
import {
  Coffee,
  Clock,
  TrendingUp,
  AlertOctagon,
  LogOut,
  Users,
  ArrowLeft,
  Home,
  PauseCircle,
  PlayCircle,
  Bell,
  Split,
  Eye,
  Radio,
  Terminal,
  User,
} from 'lucide-react';

let socket: Socket;

interface SocketLogItem {
  id: string;
  time: string;
  event: string;
  type: 'emit' | 'recv' | 'system';
  data?: any;
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showMiniGame, setShowMiniGame] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [socketLogs, setSocketLogs] = useState<SocketLogItem[]>([]);
  const [showSocketConsole, setShowSocketConsole] = useState(false);

  // View Mode: 'auto' (follow myRole), 'customer' (pure customer view), 'seller' (pure seller view), 'split' (side-by-side)
  const [viewMode, setViewMode] = useState<'auto' | 'customer' | 'seller' | 'split'>('auto');

  // Helper to append socket packets to debug log
  const addSocketLog = (event: string, type: 'emit' | 'recv' | 'system', data?: any) => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setSocketLogs((prev) => [
      { id: `log_${Date.now()}_${Math.random()}`, time, event, type, data },
      ...prev.slice(0, 49),
    ]);
  };

  // Keep a ref of current role to avoid stale socket closures
  const myPlayer = room?.players[myPlayerId];
  const myRole: Role = myPlayer?.role || 'seller';
  const myRoleRef = useRef<Role>(myRole);

  useEffect(() => {
    myRoleRef.current = myRole;
  }, [myRole]);

  // Show temporary toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4500);
  };

  useEffect(() => {
    socket = io();

    socket.on('connect', () => {
      setConnected(true);
      setMyPlayerId(socket.id || '');
      addSocketLog('connect', 'system', { socketId: socket.id, status: 'connected' });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addSocketLog('disconnect', 'system', { status: 'disconnected' });
    });

    socket.on('room:created', ({ room: r, playerId }) => {
      setRoom(r);
      setMyPlayerId(playerId);
      addSocketLog('room:created', 'recv', { roomId: r.roomId, playerId });
      showToast(`Đã tạo phòng [${r.roomId}]. Mời người chơi thứ 2 qua mã phòng!`);
    });

    socket.on('room:joined', ({ room: r, playerId }) => {
      setRoom(r);
      setMyPlayerId(playerId);
      addSocketLog('room:joined', 'recv', { roomId: r.roomId, playerId });
      showToast(`Đã tham gia phòng [${r.roomId}] qua Socket.io!`);
    });

    socket.on('room:updated', ({ room: r }) => {
      setRoom(r);
      addSocketLog('room:updated', 'recv', { playersCount: Object.keys(r.players).length });
    });

    socket.on('game:started', ({ room: r }) => {
      setRoom(r);
      setShowSummary(false);
      sounds.playSuccess();
      addSocketLog('game:started', 'recv', { day: r.day });
      showToast(`🔔 Ca bán trà sữa Ngày ${r.day} đã chính thức bắt đầu!`);
    });

    socket.on('game:tick', ({ dayTimeRemaining, waiter, orders, equipment, fryerSlots, rushAlert }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          dayTimeRemaining,
          waiter,
          orders,
          equipment,
          fryerSlots,
          rushAlert,
        };
      });
    });

    socket.on('order:placed', ({ order, financials, playerWallet }) => {
      sounds.playBell();
      addSocketLog('order:placed', 'recv', { orderNumber: order.orderNumber, tableId: order.tableId });
      showToast(`🛎️ [Rung Chuông] Có đơn hàng mới #${order.orderNumber} từ bàn ${order.tableId}!`);
      setRoom((prev) => {
        if (!prev) return null;
        const updatedPlayers = { ...prev.players };
        if (updatedPlayers[order.customerId] && playerWallet !== undefined) {
          updatedPlayers[order.customerId].wallet = playerWallet;
        }
        return {
          ...prev,
          orders: [...prev.orders.filter((o) => o.id !== order.id), order],
          financials,
          players: updatedPlayers,
        };
      });
    });

    // 🛎️ CUSTOMER DEDICATED DESK SERVICE BELL
    socket.on('customer:bell_rung', ({ tableId, customerName, reason, orderId, alert }) => {
      addSocketLog('customer:bell_rung', 'recv', { tableId, customerName, reason });
      // Distinct audio & alert behavior:
      // Seller gets urgent alert sirens & bell!
      // Customer gets pleasant brass desk bell chime without noise!
      if (myRoleRef.current === 'seller') {
        sounds.playRushAlert();
        sounds.playBell();
        showToast(`🚨 [KHÁCH RENG CHUÔNG HỐI ĐƠN] ${customerName} (Bàn ${tableId}) vừa rung chuông: ${reason}!`);
      } else {
        sounds.playBell();
        showToast(`🛎️ Đã reng chuông gọi quán (${reason})!`);
      }

      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          rushAlert: alert,
        };
      });
    });

    // CUSTOMER RUSH ORDER ALERT
    socket.on('order:rushed', ({ orderId, rushCount, alert }) => {
      addSocketLog('order:rushed', 'recv', { orderId, rushCount });
      if (myRoleRef.current === 'seller') {
        sounds.playRushAlert();
        sounds.playBell();
        showToast(`🚨 KHÁCH ĐANG HỐI LÀM NHANH! Đơn hàng đã quá 1 phút!`);
      } else {
        sounds.playBell();
        showToast(`⚡ Đã gửi yêu cầu hối làm nhanh sang người bán!`);
      }

      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          rushAlert: alert,
        };
      });
    });

    socket.on('order:prepared', ({ order, financials }) => {
      sounds.playCoin();
      addSocketLog('order:prepared', 'recv', { orderId: order.id });
      showToast(`✅ Đơn #${order.orderNumber} đã pha chế xong và chuyển ra quầy trả món!`);
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          financials: financials || prev.financials,
        };
      });
    });

    socket.on('order:delivered', ({ orderId }) => {
      sounds.playSuccess();
      addSocketLog('order:delivered', 'recv', { orderId });
      showToast(`🎉 Nhân viên phục vụ đã giao món đến tận bàn khách thành công!`);
    });

    socket.on('equipment:breakdown', ({ message }) => {
      sounds.playBuzz();
      addSocketLog('equipment:breakdown', 'recv', { message });
      showToast(`⚠️ SỰ CỐ: ${message}`);
    });

    socket.on('equipment:repaired', ({ equipment, type }) => {
      sounds.playCoin();
      addSocketLog('equipment:repaired', 'recv', { type });
      showToast(`🔧 Đã sửa chữa và nạp lại thiết bị thành công!`);
      setRoom((prev) => (prev ? { ...prev, equipment } : null));
    });

    socket.on('fryer:burnt', () => {
      sounds.playBuzz();
      addSocketLog('fryer:burnt', 'recv');
      showToast(`🔥 Nồi chiên đã để quá lâu và BỊ CHÁY KHÉT! Bị phạt tiền nguyên liệu!`);
    });

    socket.on('minigame:rewarded', ({ playerId, amount, newWallet, financials }) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updatedPlayers = { ...prev.players };
        if (updatedPlayers[playerId]) {
          updatedPlayers[playerId].wallet = newWallet;
        }
        return {
          ...prev,
          players: updatedPlayers,
          financials,
        };
      });
    });

    socket.on('day:ended', ({ financials, day }) => {
      sounds.playSuccess();
      addSocketLog('day:ended', 'recv', { day });
      setShowSummary(true);
    });

    socket.on('day:started', ({ room: r }) => {
      setRoom(r);
      setShowSummary(false);
      addSocketLog('day:started', 'recv', { day: r.day });
      showToast(`☀️ Bắt đầu Ngày mới ${r.day}!`);
    });

    socket.on('chat:received', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('error:message', ({ message }) => {
      sounds.playBuzz();
      addSocketLog('error:message', 'recv', { message });
      showToast(`Lỗi: ${message}`);
    });

    socket.on('shop:status_changed', ({ isAcceptingOrders, message }) => {
      if (isAcceptingOrders) {
        sounds.playBell();
      } else {
        sounds.playCoin();
      }
      showToast(message);
    });

    socket.on('room:left', () => {
      setRoom(null);
      addSocketLog('room:left', 'recv');
      showToast('Đã rời phòng và quay về giao diện ban đầu!');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Socket Actions
  const handleCreateRoom = (name: string, role: Role) => {
    addSocketLog('room:create', 'emit', { name, role });
    socket.emit('room:create', { playerName: name, role });
  };

  const handleJoinRoom = (roomId: string, name: string) => {
    addSocketLog('room:join', 'emit', { roomId, name });
    socket.emit('room:join', { roomId, playerName: name });
  };

  const handleSwitchRole = (role: Role) => {
    addSocketLog('player:switch_role', 'emit', { role });
    socket.emit('player:switch_role', { role });
  };

  const handleToggleReady = () => {
    addSocketLog('player:toggle_ready', 'emit');
    socket.emit('player:toggle_ready');
  };

  const handleToggleAI = () => {
    addSocketLog('room:toggle_ai', 'emit');
    socket.emit('room:toggle_ai');
  };

  const handleStartGame = () => {
    addSocketLog('game:start', 'emit');
    socket.emit('game:start');
  };

  const handleSelectSeat = (tableId: number, stoolIndex: number) => {
    sounds.playCoin();
    addSocketLog('customer:select_seat', 'emit', { tableId, stoolIndex });
    socket.emit('customer:select_seat', { tableId, stoolIndex });
    showToast(`Đã chọn ngồi vào Bàn ${tableId} - Ghế Đôn #${stoolIndex + 1}!`);
  };

  const handlePlaceOrder = (drink?: any, snack?: any) => {
    addSocketLog('order:place', 'emit', { drink, snack });
    socket.emit('order:place', { drink, snack });
  };

  const handleRushOrder = (orderId: string) => {
    addSocketLog('order:rush', 'emit', { orderId });
    socket.emit('order:rush', { orderId });
  };

  const handleRingBell = (reason?: string) => {
    addSocketLog('customer:ring_bell', 'emit', { tableId: myPlayer?.tableId || 1, reason });
    socket.emit('customer:ring_bell', { tableId: myPlayer?.tableId || 1, reason });
  };

  const handleStartBrew = (orderId: string) => {
    addSocketLog('order:start_brew', 'emit', { orderId });
    socket.emit('order:start_brew', { orderId });
  };

  const handleCompletePrep = (orderId: string, qualityScore: number) => {
    addSocketLog('order:complete_prep', 'emit', { orderId, qualityScore });
    socket.emit('order:complete_prep', { orderId, qualityScore });
  };

  const handleInsertFryer = (slotId: number, snackId: SnackId, orderId: string) => {
    addSocketLog('fryer:insert', 'emit', { slotId, snackId, orderId });
    socket.emit('fryer:insert', { slotId, snackId, orderId });
  };

  const handleRemoveFryer = (slotId: number) => {
    addSocketLog('fryer:remove', 'emit', { slotId });
    socket.emit('fryer:remove', { slotId });
  };

  const handleRepairEquipment = (type: 'ice_machine' | 'tea_tap' | 'fryer') => {
    addSocketLog('equipment:repair', 'emit', { type });
    socket.emit('equipment:repair', { type });
  };

  const handleMiniGameReward = (amount: number) => {
    addSocketLog('minigame:reward', 'emit', { amount });
    socket.emit('minigame:reward', { amount });
  };

  const handleStartNextDay = () => {
    addSocketLog('day:next', 'emit');
    socket.emit('day:next');
  };

  const handleSendMessage = (text: string, type: 'global' | 'whisper', recipientId?: string) => {
    addSocketLog('chat:send', 'emit', { text, type });
    socket.emit('chat:send', { text, type, recipientId });
  };

  const handleBackToRoomLobby = () => {
    sounds.playCoin();
    setRoom((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        isDayActive: false,
      };
    });
    showToast(`Đã quay về Sảnh Chờ Phòng [${room?.roomId}]!`);
  };

  const handleLeaveRoomCompletely = () => {
    sounds.playCoin();
    socket.emit('room:leave');
    setRoom(null);
    showToast('Đã quay về Giao Diện Khởi Đầu Ban Đầu!');
  };

  const handleToggleAcceptingOrders = () => {
    sounds.playCoin();
    addSocketLog('room:toggle_accepting_orders', 'emit');
    socket.emit('room:toggle_accepting_orders');
  };

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Effective display mode
  const currentView = viewMode === 'auto' ? myRole : viewMode;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-2 md:p-4 text-slate-800 flex flex-col justify-between">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border-2 border-orange-400 flex items-center gap-3 animate-slide-in max-w-md">
          <span className="text-xl">🔔</span>
          <span className="text-xs font-bold leading-snug">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-bold ml-auto cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full space-y-4">
        {/* If Not in Room or Day Not Active -> Show Lobby */}
        {!room || !room.isDayActive ? (
          <div className="py-4">
            <Lobby
              room={room}
              myPlayerId={myPlayerId}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onSwitchRole={handleSwitchRole}
              onToggleReady={handleToggleReady}
              onToggleAI={handleToggleAI}
              onStartGame={handleStartGame}
              onLeaveRoom={handleLeaveRoomCompletely}
              socketLogs={socketLogs}
            />
          </div>
        ) : (
          /* Active Gameplay Screen */
          <div className="space-y-4">
            {/* Top Navigation & View Switcher Bar */}
            <header className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/95 backdrop-blur-md rounded-2xl border-2 border-amber-300 shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Mũi tên quay lại sảnh phòng */}
                <button
                  type="button"
                  onClick={handleBackToRoomLobby}
                  className="px-3 py-2 bg-gradient-to-r from-amber-800 to-orange-950 hover:from-amber-900 hover:to-black text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 border border-amber-500/50 cursor-pointer"
                  title="Quay lại sảnh phòng"
                >
                  <ArrowLeft className="w-4 h-4 text-yellow-300" />
                  <span>Sảnh ({room.roomId})</span>
                </button>

                {/* 2. Nút bấm quay hẳn về giao diện ban đầu */}
                <button
                  type="button"
                  onClick={handleLeaveRoomCompletely}
                  className="px-3 py-2 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 border-2 border-orange-400 cursor-pointer"
                  title="Rời phòng hoàn toàn"
                >
                  <Home className="w-4 h-4 text-orange-400" />
                  <span className="hidden sm:inline">Giao Diện Ban Đầu</span>
                </button>

                {/* 3. Nút Tạm Nghỉ Tay / Mở Bán */}
                <button
                  type="button"
                  onClick={handleToggleAcceptingOrders}
                  className={`px-3 py-2 rounded-xl font-black text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer border-2 ${
                    room.isAcceptingOrders
                      ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-400'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400 animate-pulse'
                  }`}
                  title={room.isAcceptingOrders ? 'Bấm để tạm nghỉ tay' : 'Bấm để mở bán dồn dập'}
                >
                  {room.isAcceptingOrders ? (
                    <>
                      <PauseCircle className="w-4 h-4 text-amber-200" />
                      <span>Tạm Nghỉ Tay</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 text-emerald-200" />
                      <span>Mở Bán Tiếp</span>
                    </>
                  )}
                </button>
              </div>

              {/* 4. VIEW MODE SELECTOR (TÁCH BIỆT GIAO DIỆN KHÁCH HÀNG & BÊN BÁN) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                <span className="text-[10px] font-black text-slate-500 uppercase px-2 hidden md:inline">
                  Chế Độ Xem:
                </span>
                <button
                  type="button"
                  onClick={() => setViewMode('customer')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                    currentView === 'customer' && viewMode !== 'split'
                      ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Xem riêng biệt giao diện Khách Hàng (Bàn ăn, Reng chuông, Menu)"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Khách Hàng</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('seller')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                    currentView === 'seller' && viewMode !== 'split'
                      ? 'bg-orange-600 text-white shadow-sm ring-1 ring-orange-500'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Xem riêng biệt giao diện Bên Bán (Vòi rót trà, Bếp chiên, Cảnh báo hối)"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Bên Bán</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                    viewMode === 'split'
                      ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                  title="Xem song song 2 bên Khách Hàng và Bên Bán để kiểm tra socket đồng thời"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Song Song (Split)</span>
                </button>
              </div>

              {/* Day Timer & Finance */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="px-3 py-1 bg-amber-100 rounded-xl border border-amber-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-orange-600" />
                  <span className="font-mono font-black text-xs text-amber-950">
                    {formatTime(room.dayTimeRemaining)}
                  </span>
                </div>

                <div className="px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span
                    className={`text-xs font-black ${
                      room.financials.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {room.financials.netProfit >= 0 ? '+' : ''}
                    {room.financials.netProfit.toLocaleString('vi-VN')}đ
                  </span>
                </div>

                <button
                  onClick={() => setShowSummary(true)}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Kết Thúc Ca
                </button>
              </div>
            </header>

            {/* Socket Header Info Bar */}
            <div className="px-4 py-2 bg-slate-900/90 text-white rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono border border-slate-700">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>Socket.io Room: [{room.roomId}]</span>
                </span>
                <span className="text-slate-300">
                  Vai trò của bạn: <b className="text-yellow-300 uppercase">{myRole === 'seller' ? 'Người Bán' : 'Khách Hàng'}</b>
                </span>
                <button
                  type="button"
                  onClick={() => handleSwitchRole(myRole === 'seller' ? 'customer' : 'seller')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-yellow-300 rounded border border-slate-600 text-[10px] cursor-pointer"
                  title="Chuyển vai trò socket ngay lập tức"
                >
                  ⇄ Đổi vai sang {myRole === 'seller' ? 'Khách Hàng' : 'Người Bán'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSocketConsole(!showSocketConsole)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-slate-600 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <Terminal className="w-3 h-3" />
                  <span>{showSocketConsole ? 'Đóng Socket Logs' : 'Xem Socket Logs'}</span>
                </button>
              </div>
            </div>

            {/* Socket Console Dropdown */}
            {showSocketConsole && (
              <div className="p-3 bg-black/95 text-green-400 font-mono text-xs rounded-2xl border-2 border-emerald-500/60 shadow-inner max-h-48 overflow-y-auto space-y-1">
                <div className="text-[11px] text-slate-400 pb-1 border-b border-slate-800 flex justify-between">
                  <span>⚡ REAL-TIME SOCKET.IO PACKET INSPECTOR:</span>
                  <span className="text-emerald-500">ROOM [{room.roomId}]</span>
                </div>
                {socketLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-slate-500 text-[10px] shrink-0">[{log.time}]</span>
                    <span
                      className={`px-1 rounded text-[9px] font-bold uppercase shrink-0 ${
                        log.type === 'emit'
                          ? 'bg-blue-900 text-blue-200'
                          : log.type === 'recv'
                          ? 'bg-green-900 text-green-200'
                          : 'bg-amber-900 text-amber-200'
                      }`}
                    >
                      {log.type}
                    </span>
                    <span className="text-yellow-200 font-bold">{log.event}</span>
                    {log.data && (
                      <span className="text-slate-400 truncate text-[11px]">
                        {typeof log.data === 'string' ? log.data : JSON.stringify(log.data)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 5. GAMEPLAY RENDER ACCORDING TO VIEW MODE */}
            {viewMode === 'split' ? (
              /* SPLIT SCREEN: CUSTOMER SIDE (LEFT) & SELLER SIDE (RIGHT) */
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* LEFT: PURE CUSTOMER VIEW */}
                <div className="p-4 bg-emerald-50/70 rounded-3xl border-3 border-emerald-400 space-y-4 shadow-lg">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>GIAO DIỆN KHÁCH HÀNG (CUSTOMER SIDE)</span>
                    </span>
                    <span className="bg-emerald-700 px-2 py-0.5 rounded text-[10px]">
                      Có nút bấm reng chuông
                    </span>
                  </div>

                  <CustomerUI
                    room={room}
                    myPlayer={myPlayer || { id: myPlayerId, name: 'Khách Hàng', role: 'customer', ready: true, wallet: 500000, tableId: 1, stoolIndex: 0 }}
                    onPlaceOrder={handlePlaceOrder}
                    onRushOrder={handleRushOrder}
                    onRingBell={handleRingBell}
                    onOpenMiniGame={() => setShowMiniGame(true)}
                  />

                  {/* 2D Dining Room Canvas for customer */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-emerald-950 uppercase">
                      Bản Đồ Quán & Ghế Ngồi Khách Hàng:
                    </div>
                    <BobaCanvas
                      room={room}
                      myPlayerId={myPlayerId}
                      myRole="customer"
                      onSelectSeat={handleSelectSeat}
                    />
                  </div>
                </div>

                {/* RIGHT: PURE SELLER VIEW */}
                <div className="p-4 bg-orange-50/70 rounded-3xl border-3 border-orange-400 space-y-4 shadow-lg">
                  <div className="p-2.5 bg-orange-600 text-white rounded-xl font-black text-xs uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Coffee className="w-4 h-4" />
                      <span>GIAO DIỆN BÊN BÁN (SELLER / BARISTA SIDE)</span>
                    </span>
                    <span className="bg-orange-700 px-2 py-0.5 rounded text-[10px]">
                      Bị hối khi khách rung chuông
                    </span>
                  </div>

                  <SellerUI
                    room={room}
                    myPlayer={myPlayer || { id: myPlayerId, name: 'Người Bán', role: 'seller', ready: true, wallet: 200000 }}
                    onStartBrewOrder={handleStartBrew}
                    onCompletePrep={handleCompletePrep}
                    onInsertFryer={handleInsertFryer}
                    onRemoveFryer={handleRemoveFryer}
                    onRepairEquipment={handleRepairEquipment}
                    onToggleAcceptingOrders={handleToggleAcceptingOrders}
                  />

                  <ChatPanel
                    room={room}
                    myPlayerId={myPlayerId}
                    myRole={myRole}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                  />
                </div>
              </div>
            ) : currentView === 'customer' ? (
              /* DEDICATED PURE CUSTOMER VIEW */
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="p-3 bg-white/90 rounded-2xl border-2 border-emerald-300 shadow-sm flex items-center justify-between text-xs">
                      <span className="font-black text-emerald-950 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>Không Gian Quán Trà Sữa (Bấm chọn ghế đôn tròn để đổi chỗ ngồi)</span>
                      </span>
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg">
                        Bàn {myPlayer?.tableId || 1} • Ghế #{(myPlayer?.stoolIndex || 0) + 1}
                      </span>
                    </div>

                    <BobaCanvas
                      room={room}
                      myPlayerId={myPlayerId}
                      myRole="customer"
                      onSelectSeat={handleSelectSeat}
                    />

                    <ChatPanel
                      room={room}
                      myPlayerId={myPlayerId}
                      myRole="customer"
                      messages={messages}
                      onSendMessage={handleSendMessage}
                    />
                  </div>

                  <div className="lg:col-span-5 space-y-4">
                    <CustomerUI
                      room={room}
                      myPlayer={myPlayer || { id: myPlayerId, name: 'Khách Hàng', role: 'customer', ready: true, wallet: 500000, tableId: 1, stoolIndex: 0 }}
                      onPlaceOrder={handlePlaceOrder}
                      onRushOrder={handleRushOrder}
                      onRingBell={handleRingBell}
                      onOpenMiniGame={() => setShowMiniGame(true)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* DEDICATED PURE SELLER VIEW */
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="p-3 bg-white/90 rounded-2xl border-2 border-orange-300 shadow-sm flex items-center justify-between text-xs">
                      <span className="font-black text-amber-950 flex items-center gap-1.5">
                        <Coffee className="w-4 h-4 text-orange-600" />
                        <span>Sơ Đồ Phòng Ăn & Đường Đi Giao Món Của Phục Vụ (5 giây tới bàn)</span>
                      </span>
                      <span className="font-bold text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-lg">
                        Quầy Pha Chế Barista
                      </span>
                    </div>

                    <BobaCanvas
                      room={room}
                      myPlayerId={myPlayerId}
                      myRole="seller"
                      onSelectSeat={handleSelectSeat}
                    />

                    <ChatPanel
                      room={room}
                      myPlayerId={myPlayerId}
                      myRole="seller"
                      messages={messages}
                      onSendMessage={handleSendMessage}
                    />
                  </div>

                  <div className="lg:col-span-5 space-y-4">
                    <SellerUI
                      room={room}
                      myPlayer={myPlayer || { id: myPlayerId, name: 'Chủ Quán', role: 'seller', ready: true, wallet: 200000 }}
                      onStartBrewOrder={handleStartBrew}
                      onCompletePrep={handleCompletePrep}
                      onInsertFryer={handleInsertFryer}
                      onRemoveFryer={handleRemoveFryer}
                      onRepairEquipment={handleRepairEquipment}
                      onToggleAcceptingOrders={handleToggleAcceptingOrders}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini-Game Modal */}
      {showMiniGame && (
        <MiniGameModal
          onClose={() => setShowMiniGame(false)}
          onReward={handleMiniGameReward}
        />
      )}

      {/* End-of-Day Financial Summary Modal */}
      {showSummary && room && (
        <DaySummaryModal
          financials={room.financials}
          day={room.day}
          onStartNextDay={handleStartNextDay}
        />
      )}

      {/* Footer */}
      <footer className="mt-6 text-center text-xs text-amber-900/60 font-medium">
        Tiệm Trà Sữa Nhỏ 2D • Real-time Multiplayer (Socket.io) • Giao diện Khách Hàng & Bên Bán tách biệt
      </footer>
    </div>
  );
}
