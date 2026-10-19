import React, { useState } from 'react';
import {
  RoomState,
  Player,
  TEA_BASES,
  TOPPINGS,
  SNACKS,
  SIZE_PRICES,
  TeaBase,
  CupSize,
  SweetnessLevel,
  IceLevel,
  ToppingId,
  SnackId,
  Order,
} from '../../shared/types.ts';
import { sounds } from '../audio/soundEffects.ts';
import {
  Coffee,
  Bell,
  Clock,
  AlertTriangle,
  Gamepad2,
  Sparkles,
  ShoppingBag,
  DollarSign,
  Flame,
  CheckCircle,
  PauseCircle,
} from 'lucide-react';

interface CustomerUIProps {
  room: RoomState;
  myPlayer: Player;
  onPlaceOrder: (drink?: any, snack?: any) => void;
  onRushOrder: (orderId: string) => void;
  onRingBell?: (reason?: string) => void;
  onOpenMiniGame: () => void;
}

export const CustomerUI: React.FC<CustomerUIProps> = ({
  room,
  myPlayer,
  onPlaceOrder,
  onRushOrder,
  onRingBell,
  onOpenMiniGame,
}) => {
  const [isOrdering, setIsOrdering] = useState(false);
  const [isBellRinging, setIsBellRinging] = useState(false);
  const [bellFeedback, setBellFeedback] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<CupSize>('M');
  const [selectedTea, setSelectedTea] = useState<TeaBase>('tra_sua');
  const [selectedSweetness, setSelectedSweetness] = useState<SweetnessLevel>('70%');
  const [selectedIce, setSelectedIce] = useState<IceLevel>('100%');
  const [selectedToppings, setSelectedToppings] = useState<ToppingId[]>(['tran_chau_den']);
  const [selectedSnack, setSelectedSnack] = useState<SnackId | null>(null);

  // Active unserved orders for this customer
  const activeOrders = room.orders.filter(
    (o) =>
      o.customerId === myPlayer.id &&
      (o.status === 'queued' || o.status === 'in_progress' || o.status === 'ready' || o.status === 'delivering')
  );

  const primaryOrder = activeOrders[0];

  // Dedicated bell ringing action (Ding-ding! Clean, crisp bell sound for customer, no noisy alarm)
  const handleRingDeskBell = (customReason?: string) => {
    sounds.playBell();
    setIsBellRinging(true);
    const reason = customReason || (primaryOrder ? `Hối đơn #${primaryOrder.orderNumber}` : 'Gọi phục vụ / Đặt món');
    setBellFeedback(`Đã reng chuông gọi bên bán (${reason})!`);

    if (onRingBell) {
      onRingBell(reason);
    } else if (primaryOrder) {
      onRushOrder(primaryOrder.id);
    }

    setTimeout(() => setIsBellRinging(false), 900);
    setTimeout(() => setBellFeedback(null), 4000);
  };

  // Calculate prices
  let currentDrinkPrice = SIZE_PRICES[selectedSize].price;
  let currentDrinkCost = SIZE_PRICES[selectedSize].cost + TEA_BASES[selectedTea].cost;
  selectedToppings.forEach((topId) => {
    currentDrinkPrice += TOPPINGS[topId].price;
    currentDrinkCost += TOPPINGS[topId].cost;
  });

  const currentSnackPrice = selectedSnack ? SNACKS[selectedSnack].price : 0;
  const currentSnackCost = selectedSnack ? SNACKS[selectedSnack].cost : 0;
  const totalCartPrice = currentDrinkPrice + currentSnackPrice;
  const totalCartCost = currentDrinkCost + currentSnackCost;

  const toggleTopping = (topId: ToppingId) => {
    sounds.playToppingPlop(); // Âm thanh múc trân châu/thạch vào ly
    if (selectedToppings.includes(topId)) {
      setSelectedToppings(selectedToppings.filter((t) => t !== topId));
    } else {
      setSelectedToppings([...selectedToppings, topId]);
    }
  };

  const handleRingBellOrder = () => {
    sounds.playBell();
    const drinkItem = {
      size: selectedSize,
      teaBase: selectedTea,
      sweetness: selectedSweetness,
      ice: selectedIce,
      toppings: selectedToppings,
      price: currentDrinkPrice,
      cost: currentDrinkCost,
    };

    const snackItem = selectedSnack
      ? {
          snackId: selectedSnack,
          price: currentSnackPrice,
          cost: currentSnackCost,
        }
      : undefined;

    onPlaceOrder(drinkItem, snackItem);
    setIsOrdering(false);
  };

  const handleRush = (ord: Order) => {
    handleRingDeskBell(`Hối đơn #${ord.orderNumber} làm nhanh!`);
  };

  return (
    <div className="space-y-4">
      {/* Customer Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/90 backdrop-blur rounded-2xl border-2 border-emerald-300 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow">
            {myPlayer.name.charAt(0)}
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Giao Diện Khách Hàng: <span className="text-emerald-950 font-black">{myPlayer.name}</span>
            </div>
            <div className="text-xs text-slate-600">
              Vị trí: Bàn {myPlayer.tableId || 1} • Ghế Đôn #{((myPlayer.stoolIndex || 0) + 1)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Wallet Balance */}
          <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <div>
              <span className="text-[10px] text-emerald-700 font-bold block leading-none">Số Dư Ví:</span>
              <span className="text-base font-black text-emerald-900">
                {myPlayer.wallet.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>
          </div>

          {/* Mini-Game Button while waiting */}
          <button
            onClick={onOpenMiniGame}
            className="px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs md:text-sm rounded-xl shadow transition flex items-center gap-1.5 active:scale-95 animate-pulse cursor-pointer"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Mini-game Kiếm Tiền</span>
          </button>
        </div>
      </div>

      {/* 🔔 DEDICATED DESK SERVICE BELL ("NÚT BẤM RENG CHUÔNG") */}
      <div className="p-4 bg-gradient-to-r from-amber-100 via-orange-100 to-amber-200 rounded-3xl border-3 border-amber-400 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-600 text-white rounded-xl shadow">
              <Bell className="w-5 h-5 text-yellow-200" />
            </span>
            <div>
              <h4 className="font-black text-sm text-amber-950 uppercase tracking-tight">
                Nút Bấm Reng Chuông Gọi Phục Vụ & Hối Đơn (Bàn #{myPlayer.tableId || 1})
              </h4>
              <p className="text-[11px] text-amber-800">
                Bấm chuông để bên bán nhận được tín hiệu cảnh báo tức thì qua Socket.io
              </p>
            </div>
          </div>
          {bellFeedback && (
            <span className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-black shadow animate-pulse">
              {bellFeedback}
            </span>
          )}
        </div>

        {/* 3D-Styled Brass Desk Bell Button */}
        <div className="bg-white/80 rounded-2xl p-4 border border-amber-300 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* The Bell Graphics Button */}
            <button
              type="button"
              onClick={() => handleRingDeskBell()}
              className={`group relative flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
                isBellRinging ? 'scale-110' : 'hover:scale-105'
              }`}
              title="Bấm chuông reng reng để gọi phục vụ / hối đơn!"
            >
              {/* Sound ripple rings when active */}
              {isBellRinging && (
                <span className="absolute -top-3 -right-3 -bottom-3 -left-3 rounded-full border-4 border-yellow-400 animate-ping pointer-events-none" />
              )}
              {/* Plunger on top */}
              <div className="w-4 h-3 bg-gradient-to-b from-slate-200 to-slate-400 rounded-t-sm shadow-xs border border-slate-500" />
              {/* Golden Bell Dome */}
              <div className="w-16 h-10 bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 rounded-t-full shadow-lg border-2 border-amber-600 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1 left-3 w-5 h-2 bg-white/60 rounded-full blur-[1px]" />
                <span className="text-xl drop-shadow">🛎️</span>
              </div>
              {/* Pedestal Base */}
              <div className="w-20 h-3.5 bg-gradient-to-b from-slate-800 to-slate-950 rounded-b-lg shadow-md border-t border-yellow-500 flex items-center justify-center">
                <span className="text-[8px] font-black tracking-widest text-yellow-300 uppercase">RENG CHUÔNG</span>
              </div>
            </button>

            <div>
              <div className="font-black text-sm text-slate-800">
                Chuông Bấm Kim Loại Để Bàn (Service Bell)
              </div>
              <div className="text-xs text-slate-600">
                {primaryOrder
                  ? `Đơn #${primaryOrder.orderNumber} đang pha chế (${Math.floor(primaryOrder.elapsedSeconds)}s). Bấm chuông để hối quán làm nhanh!`
                  : 'Bấm chuông để quán chú ý phục vụ bạn nhanh chóng.'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleRingDeskBell('Gọi phục vụ / Đặt món')}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-4 h-4 text-yellow-200" />
              <span>Reng Chuông Gọi Quán</span>
            </button>

            <button
              type="button"
              onClick={() => handleRingDeskBell('Hối làm nhanh gấp!')}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Flame className="w-4 h-4 text-yellow-300" />
              <span>Reng Chuông Hối Làm Nhanh!</span>
            </button>
          </div>
        </div>
      </div>

      {/* Break mode notification banner */}
      {!room.isAcceptingOrders && (
        <div className="p-3.5 bg-amber-100 border-2 border-amber-400 rounded-2xl flex items-center gap-3 text-xs font-bold text-amber-950 shadow-sm animate-pulse">
          <PauseCircle className="w-5 h-5 text-amber-700 shrink-0" />
          <span>
            ☕ Quán đang trong thời gian <b>TẠM NGHỈ TAY</b> (Chưa nhận thêm đơn mới). Khi người bán sẵn sàng mở bán lại, bạn sẽ có thể gửi đơn hàng ngay!
          </span>
        </div>
      )}

      {/* Active Order Card & Rush Button ("HỐI NGƯỜI BÁN") */}
      {primaryOrder ? (
        <div
          className={`p-5 rounded-2xl border-3 transition-all ${
            primaryOrder.elapsedSeconds > 60
              ? 'border-red-500 bg-red-50/95 shadow-xl animate-bounce-subtle'
              : 'border-amber-300 bg-amber-50/90 shadow-md'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-orange-600" />
              <span className="font-black text-base text-amber-950">
                Đơn Hàng #{primaryOrder.orderNumber}
              </span>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  primaryOrder.status === 'queued'
                    ? 'bg-amber-200 text-amber-900'
                    : primaryOrder.status === 'in_progress'
                    ? 'bg-blue-200 text-blue-900'
                    : primaryOrder.status === 'ready'
                    ? 'bg-green-200 text-green-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {primaryOrder.status === 'queued'
                  ? 'Đang chờ pha chế'
                  : primaryOrder.status === 'in_progress'
                  ? 'Người bán đang pha chế'
                  : primaryOrder.status === 'ready'
                  ? 'Món đã xong tại quầy'
                  : 'Phục vụ đang mang ra bàn'}
              </span>
            </div>

            {/* Elapsed Timer */}
            <div className="flex items-center gap-2 font-mono font-bold text-sm text-slate-700">
              <Clock className="w-4 h-4 text-orange-500" />
              <span>Thời gian chờ: {Math.floor(primaryOrder.elapsedSeconds)}s / 60s tiêu chuẩn</span>
            </div>
          </div>

          {/* Details */}
          <div className="text-xs text-slate-700 space-y-1 mb-4 bg-white/70 p-3 rounded-xl border border-amber-200">
            {primaryOrder.drink && (
              <div>
                🧋 <b>{primaryOrder.drink.size === 'M' ? 'Size Vừa (M)' : 'Size Lớn (L)'}</b> •{' '}
                {TEA_BASES[primaryOrder.drink.teaBase].name} • Đường {primaryOrder.drink.sweetness} • Đá {primaryOrder.drink.ice}
                {primaryOrder.drink.toppings.length > 0 && (
                  <div className="text-slate-600 mt-0.5">
                    Topping: {primaryOrder.drink.toppings.map((t) => TOPPINGS[t].name).join(', ')}
                  </div>
                )}
              </div>
            )}
            {primaryOrder.snack && (
              <div className="text-amber-800">
                🍗 Đồ ăn kèm: <b>{SNACKS[primaryOrder.snack.snackId].name}</b>
              </div>
            )}
          </div>

          {/* Prompt Feature: When time > 1 minute (60s), show "HỐI NGƯỜI BÁN" button */}
          {primaryOrder.elapsedSeconds > 60 ? (
            <div className="p-3 bg-red-100 rounded-xl border border-red-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-red-700 font-bold">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                <span>Đã quá 1 phút quy định! Bạn có thể giục Người bán làm nhanh hơn!</span>
              </div>
              <button
                onClick={() => handleRush(primaryOrder)}
                className="px-5 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-sm rounded-xl shadow-lg flex items-center gap-2 animate-pulse"
              >
                <Flame className="w-5 h-5 text-yellow-300" />
                <span>HỐI NGƯỜI BÁN LÀM NHANH! (Lần {primaryOrder.rushCount + 1})</span>
              </button>
            </div>
          ) : (
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (primaryOrder.elapsedSeconds / 60) * 100)}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        /* Call to Order Button if no active order */
        <div className="p-6 bg-white/90 rounded-2xl border-2 border-emerald-300 text-center shadow-md">
          <Coffee className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-xl font-black text-slate-800 font-['Comfortaa',sans-serif]">
            Bạn Đang Ngồi Vào Ghế Đôn Tròn Quán Trà Sữa
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto mt-1 mb-4">
            Hãy chọn ly trà sữa yêu thích cùng món ăn vặt giòn rụm rồi bấm Rung Chuông để gửi đơn sang Người Bán!
          </p>
          <button
            onClick={() => setIsOrdering(true)}
            className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-base rounded-2xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 mx-auto"
          >
            <Bell className="w-5 h-5" />
            <span>MỞ MENU & ĐẶT MÓN (ORDER)</span>
          </button>
        </div>
      )}

      {/* Order Menu Modal */}
      {isOrdering && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-2xl bg-amber-50 rounded-3xl p-5 md:p-6 border-4 border-amber-300 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-amber-200 pb-3">
              <div>
                <h3 className="text-xl font-black text-amber-950 font-['Comfortaa',sans-serif]">
                  Menu Pha Chế Trà Sữa & Đồ Ăn Vặt
                </h3>
                <span className="text-xs text-amber-800">
                  Tùy biến ly trà sữa theo khẩu vị chính xác của bạn
                </span>
              </div>
              <button
                onClick={() => setIsOrdering(false)}
                className="w-8 h-8 rounded-full bg-amber-200 text-amber-900 font-black hover:bg-amber-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* 1. Chọn Size Ly */}
            <div>
              <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                1. Chọn Size Ly (M: Vừa / L: Lớn):
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playCupPickup();
                    setSelectedSize('M');
                  }}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between transition active:scale-95 ${
                    selectedSize === 'M'
                      ? 'border-orange-500 bg-orange-100 text-orange-950 font-black shadow'
                      : 'border-slate-200 bg-white text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-orange-200 flex items-center justify-center font-black">
                      M
                    </span>
                    <span>Ly Vừa (Medium)</span>
                  </div>
                  <span className="text-xs font-black text-orange-700">30,000 VNĐ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playCupPickup();
                    setSelectedSize('L');
                  }}
                  className={`p-3 rounded-xl border-2 flex items-center justify-between transition active:scale-95 ${
                    selectedSize === 'L'
                      ? 'border-orange-500 bg-orange-100 text-orange-950 font-black shadow'
                      : 'border-slate-200 bg-white text-slate-700 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-orange-300 flex items-center justify-center font-black">
                      L
                    </span>
                    <span>Ly Lớn (Large)</span>
                  </div>
                  <span className="text-xs font-black text-orange-700">42,000 VNĐ</span>
                </button>
              </div>
            </div>

            {/* 2. Chọn Loại Trà Cốt */}
            <div>
              <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                2. Chọn Loại Trà Cốt:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(TEA_BASES) as TeaBase[]).map((teaKey) => {
                  const meta = TEA_BASES[teaKey];
                  const isSelected = selectedTea === teaKey;
                  return (
                    <button
                      key={teaKey}
                      type="button"
                      onClick={() => {
                        sounds.playPourTea(0.4);
                        setSelectedTea(teaKey);
                      }}
                      className={`p-2.5 rounded-xl border-2 text-left flex items-center gap-2 transition active:scale-95 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 text-orange-950 font-black shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 font-medium'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-slate-400 shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-xs">{meta.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Tùy Chỉnh Mức Đường & Đá */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                  3. Mức Đường:
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {(['0%', '30%', '50%', '70%', '100%'] as SweetnessLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        sounds.playPump();
                        setSelectedSweetness(lvl);
                      }}
                      className={`py-2 rounded-lg border text-xs font-bold transition active:scale-95 ${
                        selectedSweetness === lvl
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                  4. Mức Đá:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['0%', '50%', '100%'] as IceLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        sounds.playIceScoop();
                        setSelectedIce(lvl);
                      }}
                      className={`py-2 rounded-lg border text-xs font-bold transition active:scale-95 ${
                        selectedIce === lvl
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      {lvl === '0%' ? 'Không đá' : lvl === '50%' ? 'Ít đá' : 'Đá chuẩn'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Thêm Topping (Mỗi loại có giá tiền riêng) */}
            <div>
              <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                5. Thêm Topping (Có tính giá riêng):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(TOPPINGS) as ToppingId[]).map((topId) => {
                  const meta = TOPPINGS[topId];
                  const hasTop = selectedToppings.includes(topId);
                  return (
                    <button
                      key={topId}
                      type="button"
                      onClick={() => toggleTopping(topId)}
                      className={`p-2.5 rounded-xl border-2 text-left flex items-center justify-between transition ${
                        hasTop
                          ? 'border-orange-500 bg-orange-100 text-orange-950 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-xs">{meta.name}</span>
                      </div>
                      <span className="text-[10px] text-orange-700 font-bold">
                        +{meta.price.toLocaleString()}đ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Chọn Món Ăn Vặt Kèm Theo */}
            <div>
              <label className="block text-xs font-black text-amber-900 uppercase tracking-wider mb-1.5">
                6. Đồ Ăn Vặt Kèm Theo (Tùy chọn):
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(SNACKS) as SnackId[]).map((sId) => {
                  const meta = SNACKS[sId];
                  const isSelected = selectedSnack === sId;
                  return (
                    <button
                      key={sId}
                      type="button"
                      onClick={() => {
                        sounds.playPlateClink();
                        setSelectedSnack(isSelected ? null : sId);
                      }}
                      className={`p-3 rounded-xl border-2 flex items-center justify-between transition ${
                        isSelected
                          ? 'border-amber-600 bg-amber-100 font-black text-amber-950 shadow'
                          : 'border-slate-200 bg-white text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{sId === 'ga_ran' ? '🍗' : '🍡'}</span>
                        <span className="text-xs">{meta.name}</span>
                      </div>
                      <span className="text-xs font-bold text-amber-800">
                        +{meta.price.toLocaleString()}đ
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Order Total & "RUNG CHUÔNG" Submit Button */}
            <div className="pt-4 border-t border-amber-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-amber-800 font-bold block">Tổng tiền đơn này:</span>
                <span className="text-2xl font-black text-orange-600">
                  {totalCartPrice.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOrdering(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 bg-white"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  disabled={!room.isAcceptingOrders || myPlayer.wallet < totalCartPrice}
                  onClick={handleRingBellOrder}
                  className={`px-6 py-3 font-black text-sm rounded-xl shadow-lg flex items-center gap-2 transition active:scale-95 ${
                    !room.isAcceptingOrders
                      ? 'bg-slate-400 text-white cursor-not-allowed opacity-80'
                      : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 text-white cursor-pointer'
                  }`}
                >
                  <Bell className="w-5 h-5 text-yellow-200 animate-bounce" />
                  <span>
                    {!room.isAcceptingOrders
                      ? 'QUÁN ĐANG TẠM NGHỈ TAY'
                      : 'RUNG CHUÔNG GỬI ĐƠN HÀNG'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
