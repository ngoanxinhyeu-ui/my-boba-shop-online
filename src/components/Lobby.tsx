import React, { useState } from 'react';
import { RoomState, Role, Player } from '../../shared/types.ts';
import {
  CheckCircle2,
  Bot,
  Users,
  Coffee,
  User,
  Sparkles,
  Play,
  ArrowRight,
  ShieldCheck,
  Home,
  Wifi,
  Radio,
  Server,
  Layers,
  Terminal,
} from 'lucide-react';

interface LobbyProps {
  room: RoomState | null;
  myPlayerId: string;
  onCreateRoom: (name: string, role: Role) => void;
  onJoinRoom: (roomId: string, name: string) => void;
  onSwitchRole: (role: Role) => void;
  onToggleReady: () => void;
  onToggleAI: () => void;
  onStartGame: () => void;
  onLeaveRoom?: () => void;
  socketLogs?: { id: string; time: string; event: string; type: 'emit' | 'recv' | 'system'; data?: any }[];
}

export const Lobby: React.FC<LobbyProps> = ({
  room,
  myPlayerId,
  onCreateRoom,
  onJoinRoom,
  onSwitchRole,
  onToggleReady,
  onToggleAI,
  onStartGame,
  onLeaveRoom,
  socketLogs = [],
}) => {
  const [playerName, setPlayerName] = useState('Trà Sữa Lover');
  const [joinCode, setJoinCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('seller');
  const [showSocketLogs, setShowSocketLogs] = useState(false);

  const myPlayer = room?.players[myPlayerId];
  const players = room ? Object.values(room.players) : [];
  const seller = players.find((p) => p.role === 'seller');
  const customer = players.find((p) => p.role === 'customer');

  const canStart =
    players.length >= 2 &&
    players.every((p) => p.ready);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* 1. Real-time Socket.IO Protocol Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/95 text-white rounded-2xl border-2 border-emerald-400 shadow-md text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-400 font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <Radio className="w-3.5 h-3.5" />
            <span>SOCKET.IO PROTOCOL: CONNECTED</span>
          </span>
          <span className="text-slate-300 font-mono">
            Client Socket ID: <b className="text-yellow-300">{myPlayerId || 'Đang kết nối...'}</b>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono hidden sm:inline">Engine: Socket.io v4 • ws://</span>
          <button
            type="button"
            onClick={() => setShowSocketLogs(!showSocketLogs)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-yellow-300 rounded-lg font-mono text-[11px] flex items-center gap-1 border border-slate-600 transition"
          >
            <Terminal className="w-3 h-3" />
            <span>{showSocketLogs ? 'Ẩn Socket Console' : 'Xem Socket Console'}</span>
          </button>
        </div>
      </div>

      {/* Socket Console Dropdown (Optional Inspector) */}
      {showSocketLogs && (
        <div className="p-3 bg-black/95 text-green-400 font-mono text-xs rounded-2xl border-2 border-emerald-500/60 shadow-inner max-h-48 overflow-y-auto space-y-1">
          <div className="text-[11px] text-slate-400 pb-1 border-b border-slate-800 flex justify-between">
            <span>⚡ NHẬT KÝ SỰ KIỆN SOCKET.IO REAL-TIME (EVENT LOGGER):</span>
            <span className="text-emerald-500">PORT 3000 • AUTHORITATIVE SERVER</span>
          </div>
          {socketLogs.length === 0 ? (
            <div className="text-slate-500 italic">Đang lắng nghe các sự kiện socket...</div>
          ) : (
            socketLogs.map((log) => (
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
            ))
          )}
        </div>
      )}

      {/* Main Container */}
      <div className="p-4 md:p-6 bg-gradient-to-b from-amber-50 to-orange-100 rounded-3xl shadow-2xl border-4 border-amber-300">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-200 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
            <Coffee className="w-4 h-4 text-amber-700" /> Hệ Thống Phòng Socket.IO Thời Gian Thực
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-amber-950 font-['Comfortaa',sans-serif] tracking-tight">
            Tiệm Trà Sữa Nhỏ <span className="text-orange-600">Online</span>
          </h1>
          <p className="text-amber-800 text-xs md:text-sm mt-1 max-w-xl mx-auto">
            Giao diện <b>Khách Hàng</b> và <b>Bên Bán</b> tách biệt độc lập • Reng chuông gọi phục vụ & hối đơn tức thì qua Socket.IO!
          </p>
        </div>

        {!room ? (
          /* Create or Join Room UI */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/90 backdrop-blur-md p-6 rounded-2xl border border-amber-200 shadow-lg">
            {/* Create Room Form (socket: room:create) */}
            <div className="space-y-4 border-b md:border-b-0 md:border-r border-amber-200 pb-6 md:pb-0 md:pr-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-amber-950 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <span>1. Tạo Phòng Socket Mới</span>
                </h2>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                  socket.emit('room:create')
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">Tên Người Chơi Của Bạn:</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-amber-300 focus:outline-none focus:border-orange-500 font-bold text-amber-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-2">Chọn Vai Trò Ban Đầu Của Bạn:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('seller')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedRole === 'seller'
                        ? 'border-orange-600 bg-orange-100 text-orange-950 font-black shadow-md ring-2 ring-orange-400'
                        : 'border-slate-200 hover:border-amber-300 text-slate-700 font-medium bg-white'
                    }`}
                  >
                    <Coffee className="w-6 h-6 text-orange-600" />
                    <span>Giao Diện Bên Bán</span>
                    <span className="text-[10px] text-amber-700 font-normal">Quầy Barista & Bếp Chiên</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('customer')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedRole === 'customer'
                        ? 'border-emerald-600 bg-emerald-100 text-emerald-950 font-black shadow-md ring-2 ring-emerald-400'
                        : 'border-slate-200 hover:border-amber-300 text-slate-700 font-medium bg-white'
                    }`}
                  >
                    <User className="w-6 h-6 text-emerald-600" />
                    <span>Giao Diện Khách Hàng</span>
                    <span className="text-[10px] text-emerald-700 font-normal">Ngồi bàn & Nút Reng Chuông</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => onCreateRoom(playerName, selectedRole)}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-yellow-200" />
                <span>Tạo Phòng Socket & Nhận Mã Phòng</span>
              </button>
            </div>

            {/* Join Room Form (socket: room:join) */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-black text-amber-950 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-600" />
                    <span>2. Gia Nhập Phòng Đã Có</span>
                  </h2>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                    socket.emit('room:join')
                  </span>
                </div>
                <p className="text-xs text-amber-800 mb-4">
                  Nhập mã phòng 4 chữ cái để kết nối trực tiếp vào kênh phòng Socket.IO của bạn bè.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1">Mã Phòng (4 Ký Tự):</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="VD: ABCD"
                      className="w-full px-4 py-3 rounded-xl border-2 border-amber-300 focus:outline-none focus:border-orange-500 font-mono font-black text-center text-3xl tracking-widest text-amber-950 uppercase bg-amber-50"
                    />
                  </div>
                </div>
              </div>

              <button
                disabled={joinCode.trim().length !== 4}
                onClick={() => onJoinRoom(joinCode, playerName)}
                className="w-full py-3.5 bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-black rounded-xl shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-orange-400"
              >
                <span>Kết Nối Socket Vào Phòng</span>
                <ArrowRight className="w-5 h-5 text-yellow-300" />
              </button>
            </div>
          </div>
        ) : (
          /* Inside Room Lobby */
          <div className="space-y-6">
            {/* Room Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/95 rounded-2xl border-2 border-amber-300 shadow-md">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition active:scale-95 border-2 border-orange-400 cursor-pointer"
                  title="Rời khỏi phòng này và quay lại giao diện ban đầu"
                >
                  <Home className="w-4 h-4 text-yellow-300" />
                  <span>Rời Phòng</span>
                </button>
                <div>
                  <span className="text-[11px] font-bold text-amber-700 uppercase">
                    Mã Phòng Socket (Room ID):
                  </span>
                  <div className="text-3xl font-black font-mono tracking-widest text-orange-600">
                    {room.roomId}
                  </div>
                </div>
              </div>
              <div className="text-xs text-amber-900 bg-amber-100 px-3 py-2 rounded-xl border border-amber-200">
                💡 Chia sẻ mã <b>{room.roomId}</b> cho bạn bè vào vai còn lại, hoặc bấm <b>Bật AI Bot</b> để chơi đơn!
              </div>
            </div>

            {/* Separated Role Portals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Seller Role Card */}
              <div
                className={`p-5 rounded-2xl border-3 transition-all relative ${
                  seller
                    ? 'border-orange-500 bg-orange-50/90 shadow-lg'
                    : 'border-dashed border-amber-300 bg-white/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-500 text-white rounded-xl shadow">
                      <Coffee className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-amber-950 flex items-center gap-1.5">
                        Giao Diện: Bên Bán (Barista)
                        {seller && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 inline-block fill-emerald-100" />
                        )}
                      </h3>
                      <p className="text-xs text-amber-800">
                        Vòi rót trà, định lượng đường đá, topping, bếp chiên 4s, nhận cảnh báo khi khách hối.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-200 flex items-center justify-between">
                  {seller ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-950">
                        {seller.isAI ? '🤖 ' + seller.name : '👤 ' + seller.name}
                      </span>
                      {seller.id === myPlayerId && (
                        <span className="text-[10px] bg-orange-200 text-orange-900 px-2 py-0.5 rounded-full font-bold">
                          (Bạn)
                        </span>
                      )}
                      {seller.ready && (
                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> SẴN SÀNG
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-amber-700 italic">Đang trống vị trí Bên Bán...</span>
                  )}

                  {myPlayer?.role !== 'seller' && (
                    <button
                      onClick={() => onSwitchRole('seller')}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer"
                    >
                      Chọn Vai Bên Bán
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Role Card */}
              <div
                className={`p-5 rounded-2xl border-3 transition-all relative ${
                  customer
                    ? 'border-emerald-500 bg-emerald-50/90 shadow-lg'
                    : 'border-dashed border-amber-300 bg-white/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-600 text-white rounded-xl shadow">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-emerald-950 flex items-center gap-1.5">
                        Giao Diện: Khách Hàng (Customer)
                        {customer && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 inline-block fill-emerald-100" />
                        )}
                      </h3>
                      <p className="text-xs text-emerald-800">
                        Vốn 500k, chọn bàn ghế đôn, order món tùy chỉnh, <b>nút bấm reng chuông gọi quán & hối đơn</b>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-200 flex items-center justify-between">
                  {customer ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-950">
                        {customer.isAI ? '🤖 ' + customer.name : '👤 ' + customer.name}
                      </span>
                      {customer.id === myPlayerId && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                          (Bạn)
                        </span>
                      )}
                      {customer.ready && (
                        <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> SẴN SÀNG
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-700 italic">Đang trống vị trí Khách Hàng...</span>
                  )}

                  {myPlayer?.role !== 'customer' && (
                    <button
                      onClick={() => onSwitchRole('customer')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow cursor-pointer"
                    >
                      Chọn Vai Khách Hàng
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2-Player Human Mode Notification or AI Bot Status */}
            {players.filter((p) => !p.isAI).length >= 2 ? (
              <div className="p-3 bg-emerald-100 border-2 border-emerald-500 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-emerald-950 shadow-sm">
                <Users className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <span className="font-black uppercase text-emerald-900">
                    Chế độ 2 Người Chơi (Bạn và Bạn bè):
                  </span>{' '}
                  AI Bot đã được <b>TẮT HOÀN TOÀN</b>. Khách hàng sẽ tự do chọn món theo sở thích, không có đơn hàng tự động nào xuất hiện!
                </div>
              </div>
            ) : players.some((p) => p.isAI) ? (
              <div className="p-2.5 bg-indigo-50 border border-indigo-300 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-indigo-950">
                <span>🤖 Đang bật AI Bot hỗ trợ cho chế độ chơi đơn (Bấm nút bên dưới để Hủy/Tắt)</span>
                <span className="text-[11px] text-indigo-700 font-mono">1 Người + 1 AI</span>
              </div>
            ) : (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900">
                ✨ Đang chờ bạn bè tham gia qua mã phòng <b>{room.roomId}</b>. Khách hàng tự gọi món theo ý thích, người bán tự chuẩn bị.
              </div>
            )}

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/90 rounded-2xl border border-amber-200 shadow">
              <div className="flex items-center gap-3">
                {/* Toggle AI Button (Only visible/allowed in single-player mode) */}
                {players.filter((p) => !p.isAI).length < 2 && (
                  <button
                    type="button"
                    onClick={onToggleAI}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold rounded-xl shadow flex items-center gap-2 transition cursor-pointer ${
                      players.some((p) => p.isAI)
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                    <span>
                      {players.some((p) => p.isAI) ? 'Hủy / Tắt AI Bot' : 'Bật AI Bot (Chơi Đơn)'}
                    </span>
                  </button>
                )}

                {/* Ready Button */}
                {myPlayer && (
                  <button
                    onClick={onToggleReady}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow transition flex items-center gap-1.5 cursor-pointer ${
                      myPlayer.ready
                        ? 'bg-amber-100 border-2 border-emerald-500 text-emerald-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{myPlayer.ready ? 'Đã Sẵn Sàng (Hủy)' : 'Bấm Sẵn Sàng'}</span>
                  </button>
                )}
              </div>

              {/* Start Game Button (Enabled when both are ready) */}
              <button
                disabled={!canStart}
                onClick={onStartGame}
                className={`px-8 py-3 rounded-xl font-black text-sm md:text-base shadow-xl flex items-center gap-2 transition-all cursor-pointer ${
                  canStart
                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white scale-105 animate-pulse'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>BẮT ĐẦU VÀO CA TRÀ SỮA</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
