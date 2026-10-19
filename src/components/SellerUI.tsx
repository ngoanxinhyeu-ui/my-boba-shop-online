import React, { useState, useEffect, useRef } from 'react';
import {
  RoomState,
  Player,
  Order,
  TEA_BASES,
  TOPPINGS,
  SNACKS,
  TeaBase,
  CupSize,
  SweetnessLevel,
  IceLevel,
  ToppingId,
  SnackId,
  FryerSlot,
} from '../../shared/types.ts';
import { sounds } from '../audio/soundEffects.ts';
import {
  CheckCircle2,
  AlertTriangle,
  Flame,
  Wrench,
  ShoppingBag,
  RotateCcw,
  Check,
  Trash2,
  Droplets,
  Layers,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  PauseCircle,
  PlayCircle,
  Sparkles,
} from 'lucide-react';

interface SellerUIProps {
  room: RoomState;
  myPlayer: Player;
  onStartBrewOrder: (orderId: string) => void;
  onCompletePrep: (orderId: string, qualityScore: number) => void;
  onInsertFryer: (slotId: number, snackId: SnackId, orderId: string) => void;
  onRemoveFryer: (slotId: number) => void;
  onRepairEquipment: (type: 'ice_machine' | 'tea_tap' | 'fryer') => void;
  onToggleAcceptingOrders: () => void;
}

interface CupPrepState {
  size: CupSize;
  teaBase: TeaBase;
  sweetness: SweetnessLevel;
  ice: IceLevel;
  toppings: ToppingId[];
  pourProgress: number;
  pourQuality: 'idle' | 'perfect' | 'missed';
  cookedSnackOnPlate: SnackId | null;
}

const defaultCupState = (): CupPrepState => ({
  size: 'M',
  teaBase: 'tra_sua',
  sweetness: '0%',
  ice: '100%',
  toppings: [],
  pourProgress: 0,
  pourQuality: 'idle',
  cookedSnackOnPlate: null,
});

export const SellerUI: React.FC<SellerUIProps> = ({
  room,
  myPlayer: _myPlayer,
  onStartBrewOrder,
  onCompletePrep,
  onInsertFryer,
  onRemoveFryer,
  onRepairEquipment,
  onToggleAcceptingOrders,
}) => {
  // Tab navigation: 'barista' (All-in-one Barista Bench), 'fryer' (Kitchen Fryer), 'pos' (Cashier & Queue)
  const [activeTab, setActiveTab] = useState<'barista' | 'fryer' | 'pos'>('barista');

  // Multi-order management: Support up to 3 concurrent orders with custom priority order
  const [activeOrderIds, setActiveOrderIds] = useState<string[]>([]);
  const [focusedOrderId, setFocusedOrderId] = useState<string>('');

  // Individual cup prep state for each active order
  const [prepStates, setPrepStates] = useState<Record<string, CupPrepState>>({});

  // Tea pouring interval ref
  const [isPouring, setIsPouring] = useState<boolean>(false);
  const pourIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync active order list with room orders
  useEffect(() => {
    const validOrders = room.orders.filter(
      (o) => o.status === 'in_progress' || (activeOrderIds.includes(o.id) && o.status === 'queued')
    );

    let nextIds = [...activeOrderIds].filter((id) =>
      validOrders.some((o) => o.id === id && (o.status === 'queued' || o.status === 'in_progress'))
    );

    // If fewer than 3 active orders, auto-fill from queued orders if available
    const queuedOrders = room.orders.filter(
      (o) => o.status === 'queued' && !nextIds.includes(o.id)
    );

    while (nextIds.length < 3 && queuedOrders.length > 0) {
      const ord = queuedOrders.shift()!;
      nextIds.push(ord.id);
      onStartBrewOrder(ord.id);
    }

    setActiveOrderIds(nextIds);

    // Ensure focused order is valid
    if (!nextIds.includes(focusedOrderId)) {
      setFocusedOrderId(nextIds[0] || '');
    }
  }, [room.orders]);

  // Ensure prep state exists for each active order
  useEffect(() => {
    setPrepStates((prev) => {
      const updated = { ...prev };
      activeOrderIds.forEach((id) => {
        if (!updated[id]) {
          const ord = room.orders.find((o) => o.id === id);
          updated[id] = {
            ...defaultCupState(),
            size: ord?.drink?.size || 'M',
            teaBase: ord?.drink?.teaBase || 'tra_sua',
          };
        }
      });
      return updated;
    });
  }, [activeOrderIds]);

  // Current focused order & its prep state
  const currentFocusedOrder = room.orders.find((o) => o.id === focusedOrderId);
  const currentPrepState = (focusedOrderId && prepStates[focusedOrderId]) || defaultCupState();

  const updateCurrentPrep = (updates: Partial<CupPrepState>) => {
    if (!focusedOrderId) return;
    setPrepStates((prev) => ({
      ...prev,
      [focusedOrderId]: {
        ...(prev[focusedOrderId] || defaultCupState()),
        ...updates,
      },
    }));
  };

  // Reorder priorities
  const movePriorityUp = (index: number) => {
    if (index <= 0) return;
    const next = [...activeOrderIds];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setActiveOrderIds(next);
  };

  const movePriorityDown = (index: number) => {
    if (index >= activeOrderIds.length - 1) return;
    const next = [...activeOrderIds];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setActiveOrderIds(next);
  };

  const handleAcceptOrder = (orderId: string) => {
    if (activeOrderIds.length >= 3) {
      sounds.playBuzz();
      return;
    }
    sounds.playCoin();
    onStartBrewOrder(orderId);
    setActiveOrderIds((prev) => [...prev, orderId]);
    setFocusedOrderId(orderId);
  };

  // Tea Tap Hold to Pour logic with Green Zone (75% - 90%)
  const startPouring = (teaKey: TeaBase) => {
    if (room.equipment.teaTapJammed) {
      sounds.playBuzz();
      return;
    }
    updateCurrentPrep({ teaBase: teaKey, pourQuality: 'idle' });
    setIsPouring(true);
    // Authentic flowing water sound stream
    sounds.startWaterStream();

    pourIntervalRef.current = setInterval(() => {
      setPrepStates((prev) => {
        if (!focusedOrderId) return prev;
        const current = prev[focusedOrderId] || defaultCupState();
        if (current.pourProgress >= 100) {
          clearInterval(pourIntervalRef.current!);
          setIsPouring(false);
          sounds.stopWaterStream();
          sounds.playBuzz();
          return {
            ...prev,
            [focusedOrderId]: {
              ...current,
              pourProgress: 100,
              pourQuality: 'missed',
            },
          };
        }
        return {
          ...prev,
          [focusedOrderId]: {
            ...current,
            pourProgress: current.pourProgress + 2.5,
          },
        };
      });
    }, 50);
  };

  const stopPouring = () => {
    if (!isPouring) return;
    setIsPouring(false);
    sounds.stopWaterStream();
    if (pourIntervalRef.current) {
      clearInterval(pourIntervalRef.current);
      pourIntervalRef.current = null;
    }

    const state = prepStates[focusedOrderId];
    if (!state) return;

    // Check green zone (75% - 90%)
    if (state.pourProgress >= 75 && state.pourProgress <= 90) {
      updateCurrentPrep({ pourQuality: 'perfect' });
      sounds.playCoin();
    } else {
      updateCurrentPrep({ pourQuality: 'missed' });
      sounds.playBuzz();
    }
  };

  // Submit completed prep for focused order to serving hatch
  const handleServeOrder = (ordToServe?: Order) => {
    const targetOrd = ordToServe || currentFocusedOrder;
    if (!targetOrd) return;

    const prep = prepStates[targetOrd.id] || defaultCupState();
    let score = 100;

    // Check drink
    if (targetOrd.drink) {
      if (prep.pourProgress < 75 || prep.pourProgress > 90) score -= 30;
      if (prep.teaBase !== targetOrd.drink.teaBase) score -= 25;
      if (prep.size !== targetOrd.drink.size) score -= 15;
      if (prep.sweetness !== targetOrd.drink.sweetness) score -= 20; // Phạt nếu sai mức đường
      if (prep.ice !== targetOrd.drink.ice) score -= 10;

      // Check toppings
      const reqTops = targetOrd.drink.toppings;
      const missedTops = reqTops.filter((t) => !prep.toppings.includes(t));
      const extraTops = prep.toppings.filter((t) => !reqTops.includes(t));
      score -= (missedTops.length + extraTops.length) * 10;
    }

    // Check snack
    if (targetOrd.snack) {
      if (prep.cookedSnackOnPlate !== targetOrd.snack.snackId) {
        score -= 40;
      }
    }

    score = Math.max(0, score);
    sounds.playSuccess();
    onCompletePrep(targetOrd.id, score);

    // Free slot
    setActiveOrderIds((prev) => prev.filter((id) => id !== targetOrd.id));
    setPrepStates((prev) => {
      const copy = { ...prev };
      delete copy[targetOrd.id];
      return copy;
    });
  };

  // Fryer slot actions
  const handleDropFoodToFryer = (slot: FryerSlot, sId: SnackId) => {
    if (room.equipment.fryerOverheating) {
      sounds.playBuzz();
      return;
    }
    sounds.playFryDrop(); // Âm thanh rớt đồ vào dầu sôi
    sounds.playSizzle(4.0); // Âm thanh rán xì xèo chuẩn 4 giây
    onInsertFryer(slot.id, sId, focusedOrderId || '');
  };

  const handlePickFoodFromFryer = (slot: FryerSlot) => {
    if (slot.state === 'cooked') {
      sounds.playPlateClink(); // Âm thanh gắp đồ ăn chiên để vào đĩa sứ
      updateCurrentPrep({ cookedSnackOnPlate: slot.snackId });
      onRemoveFryer(slot.id);
    } else if (slot.state === 'burnt') {
      sounds.playBuzz();
      onRemoveFryer(slot.id);
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Risk / Breakdown Banner */}
      {(room.equipment.iceMachineBroken ||
        room.equipment.teaTapJammed ||
        room.equipment.fryerOverheating) && (
        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-2 border-2 border-yellow-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
            <div>
              <span className="font-black uppercase">Sự cố thiết bị: </span>
              <span>
                {room.equipment.iceMachineBroken && 'Tủ đá bị hết! '}
                {room.equipment.teaTapJammed && 'Vòi rót trà kẹt van! '}
                {room.equipment.fryerOverheating && 'Nồi chiên quá nhiệt! '}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {room.equipment.iceMachineBroken && (
              <button
                type="button"
                onClick={() => onRepairEquipment('ice_machine')}
                className="px-2.5 py-1 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-lg shadow flex items-center gap-1 text-[11px]"
              >
                <Wrench className="w-3.5 h-3.5" /> Nạp Tủ Đá
              </button>
            )}
            {room.equipment.teaTapJammed && (
              <button
                type="button"
                onClick={() => onRepairEquipment('tea_tap')}
                className="px-2.5 py-1 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-lg shadow flex items-center gap-1 text-[11px]"
              >
                <Wrench className="w-3.5 h-3.5" /> Thông Vòi Trà
              </button>
            )}
            {room.equipment.fryerOverheating && (
              <button
                type="button"
                onClick={() => onRepairEquipment('fryer')}
                className="px-2.5 py-1 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-lg shadow flex items-center gap-1 text-[11px]"
              >
                <Wrench className="w-3.5 h-3.5" /> Xả Van Chiên
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1b. URGENT CUSTOMER RUSH & BELL ALERT BANNER (BÊN BÁN BỊ HỐI) */}
      {room.rushAlert?.active && (
        <div className="p-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border-2 border-yellow-300 animate-pulse text-xs">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-yellow-400 text-red-950 rounded-xl font-black text-sm shadow">
              🔔
            </span>
            <div>
              <div className="font-black text-xs uppercase tracking-wider text-yellow-200 flex items-center gap-1">
                <span>🚨 KHÁCH ĐANG RUNG CHUÔNG HỐI BÊN BÁN!</span>
              </div>
              <div className="text-[11px] font-bold mt-0.5 text-white">
                {room.rushAlert.message || `Khách Bàn #${room.rushAlert.tableId} đang rung chuông giục làm nhanh!`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {room.rushAlert.orderId && (
              <button
                type="button"
                onClick={() => {
                  sounds.playCoin();
                  if (room.rushAlert.orderId) {
                    if (!activeOrderIds.includes(room.rushAlert.orderId)) {
                      handleAcceptOrder(room.rushAlert.orderId);
                    } else {
                      setFocusedOrderId(room.rushAlert.orderId);
                    }
                  }
                }}
                className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black rounded-xl text-xs shadow transition active:scale-95 cursor-pointer"
              >
                ⚡ Ưu Tiên Đơn Này Ngay
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. COMPACT 3-ORDER PRIORITY BAR (Gọn gàng, xếp 3 đơn song song, không chiếm diện tích) */}
      <div className="p-3 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 rounded-2xl border-2 border-amber-300 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1 bg-orange-600 text-white rounded-lg shadow font-black text-xs">
              <ListOrdered className="w-3.5 h-3.5" />
            </span>
            <span className="font-black text-xs text-amber-950 uppercase tracking-tight">
              3 Slot Nhận Đơn Đồng Thời ({activeOrderIds.length}/3)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleAcceptingOrders}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black shadow transition active:scale-95 flex items-center gap-1 cursor-pointer ${
                room.isAcceptingOrders
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
              }`}
              title={room.isAcceptingOrders ? 'Bấm để tạm nghỉ tay' : 'Bấm để mở bán dồn dập'}
            >
              {room.isAcceptingOrders ? (
                <>
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Tạm Nghỉ Tay</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Mở Bán Lại</span>
                </>
              )}
            </button>
            <span className="text-[11px] font-bold text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded-lg">
              Đợi: {room.orders.filter((o) => o.status === 'queued').length} đơn
            </span>
          </div>
        </div>

        {/* 3 Compact Slots side-by-side */}
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((slotIndex) => {
            const orderId = activeOrderIds[slotIndex];
            const ord = orderId ? room.orders.find((o) => o.id === orderId) : null;
            const isFocused = orderId && orderId === focusedOrderId;
            const prep = orderId ? prepStates[orderId] : null;

            if (!ord) {
              return (
                <div
                  key={`empty_slot_${slotIndex}`}
                  onClick={() => setActiveTab('pos')}
                  className="p-2 rounded-xl border border-dashed border-amber-300 bg-white/70 hover:bg-white flex flex-col items-center justify-center text-center cursor-pointer min-h-[58px]"
                  title="Bấm để mở sổ Thu Ngân nhận thêm đơn vào slot này"
                >
                  <span className="text-[10px] font-black text-amber-800">Slot #{slotIndex + 1} Trống</span>
                  <span className="text-[9px] text-orange-600 font-bold">+ Nhận đơn</span>
                </div>
              );
            }

            return (
              <div
                key={ord.id}
                onClick={() => setFocusedOrderId(ord.id)}
                className={`p-2 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between text-left ${
                  isFocused
                    ? 'border-orange-600 bg-white shadow-md ring-2 ring-orange-400'
                    : 'border-amber-300 bg-amber-50/90 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${
                      isFocused ? 'bg-orange-600 text-white' : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    #{slotIndex + 1} {isFocused ? 'Đang pha' : ''}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {slotIndex > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          movePriorityUp(slotIndex);
                        }}
                        className="w-4 h-4 rounded bg-amber-200 text-amber-900 flex items-center justify-center hover:bg-amber-300 text-[10px]"
                        title="Làm đơn này trước"
                      >
                        <ArrowUp className="w-2.5 h-2.5" />
                      </button>
                    )}
                    {slotIndex < activeOrderIds.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          movePriorityDown(slotIndex);
                        }}
                        className="w-4 h-4 rounded bg-amber-200 text-amber-900 flex items-center justify-center hover:bg-amber-300 text-[10px]"
                        title="Để đơn này làm sau"
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="font-black text-[11px] text-amber-950 truncate mt-0.5">
                  Đơn #{ord.orderNumber} • Bàn {ord.tableId}
                </div>

                <div className="text-[10px] text-slate-600 truncate">
                  Trà {prep?.pourProgress.toFixed(0)}% • Đg {prep?.sweetness}
                </div>
              </div>
            );
          })}
        </div>

        {/* PINNED WORKSTATION RECIPE & PRIMARY SERVE BUTTON (Luôn hiển thị ở trên cùng, không phải cuộn để bấm trả món) */}
        {currentFocusedOrder && (
          <div className="p-2.5 bg-white rounded-xl border border-orange-300 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-orange-950 text-xs">
                  👉 ĐƠN #{currentFocusedOrder.orderNumber} (Bàn {currentFocusedOrder.tableId}):
                </span>
                {currentFocusedOrder.drink && (
                  <span className="text-slate-800 font-semibold text-xs">
                    Size <b className="text-blue-700">{currentFocusedOrder.drink.size}</b> •{' '}
                    <b className="text-orange-800">{TEA_BASES[currentFocusedOrder.drink.teaBase].name}</b> •{' '}
                    Đường <b className="text-amber-700">{currentFocusedOrder.drink.sweetness}</b> •{' '}
                    Đá <b className="text-blue-600">{currentFocusedOrder.drink.ice}</b>
                    {currentFocusedOrder.drink.toppings.length > 0 && (
                      <span className="text-slate-700">
                        {' '}• Topping:{' '}
                        <b className="text-purple-800">
                          {currentFocusedOrder.drink.toppings.map((t) => TOPPINGS[t].name).join(', ')}
                        </b>
                      </span>
                    )}
                  </span>
                )}
                {currentFocusedOrder.snack && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[11px] border border-amber-300">
                    🍗 Kèm: {SNACKS[currentFocusedOrder.snack.snackId].name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  updateCurrentPrep({
                    pourProgress: 0,
                    pourQuality: 'idle',
                    sweetness: '0%',
                    toppings: [],
                    cookedSnackOnPlate: null,
                  })
                }
                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition flex items-center gap-1 border border-slate-300"
                title="Đổ ly làm lại từ đầu"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Đổ ly</span>
              </button>

              <button
                type="button"
                onClick={() => handleServeOrder()}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>TRẢ MÓN (ĐƠN #{currentFocusedOrder.orderNumber})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. NAVIGATION STATION TABS */}
      <div className="flex items-center justify-between gap-1.5 p-1 bg-slate-200/90 rounded-xl border border-slate-300">
        <button
          type="button"
          onClick={() => setActiveTab('barista')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'barista'
              ? 'bg-orange-600 text-white shadow'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" />
          <span>Quầy Pha Chế (Trà • Đường • Đá • Topping)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fryer')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'fryer'
              ? 'bg-amber-600 text-white shadow'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Bếp Chiên (4s)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'pos'
              ? 'bg-slate-800 text-white shadow'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Thu Ngân ({room.orders.filter((o) => o.status === 'queued').length})</span>
        </button>
      </div>

      {/* 4. STATION CONTENT */}

      {/* --- TAB 1: ALL-IN-ONE BARISTA BENCH (KHOA HỌC, CHIA Ô ĐỀU, KHÔNG PHẢI CUỘN LÊN XUỐNG) --- */}
      {activeTab === 'barista' && (
        <div className="space-y-3">
          {/* KHU VÒI RÓT CỐT TRÀ (5 TAPS + METER) */}
          <div className="p-3 bg-white rounded-2xl border-2 border-orange-300 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-amber-950 flex items-center gap-1">
                <Droplets className="w-4 h-4 text-orange-600" />
                <span>1. Vòi Rót Trà: Ấn Giữ Vòi & Nhả Ở Vạch Xanh (75% - 90%)</span>
              </span>
              {currentPrepState.pourQuality === 'perfect' && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[11px] rounded-lg flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" /> Đúng vạch xanh!
                </span>
              )}
              {currentPrepState.pourQuality === 'missed' && (
                <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 font-black text-[11px] rounded-lg">
                  Lệch vạch (Chưa chuẩn)
                </span>
              )}
            </div>

            {/* Precision Meter with Target Green Zone */}
            <div className="relative w-full h-6 bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
              <div
                className="absolute top-0 bottom-0 bg-emerald-400/70 border-x-2 border-emerald-600 z-10 flex items-center justify-center text-[9px] font-black text-emerald-950"
                style={{ left: '75%', width: '15%' }}
              >
                VẠCH XANH (75%-90%)
              </div>
              <div
                className={`h-full transition-none ${
                  currentPrepState.pourProgress >= 75 && currentPrepState.pourProgress <= 90
                    ? 'bg-emerald-500'
                    : currentPrepState.pourProgress > 90
                    ? 'bg-red-500'
                    : 'bg-amber-600'
                }`}
                style={{ width: `${currentPrepState.pourProgress}%` }}
              />
            </div>

            {/* 5 Tea Dispenser Taps - Chia đều 5 cột */}
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(TEA_BASES) as TeaBase[]).map((teaKey) => {
                const meta = TEA_BASES[teaKey];
                const isTargetTea = currentFocusedOrder?.drink?.teaBase === teaKey;
                const isSelected = currentPrepState.teaBase === teaKey && currentPrepState.pourProgress > 0;
                return (
                  <button
                    key={teaKey}
                    type="button"
                    disabled={room.equipment.teaTapJammed || !focusedOrderId}
                    onMouseDown={() => startPouring(teaKey)}
                    onMouseUp={stopPouring}
                    onMouseLeave={stopPouring}
                    onTouchStart={() => startPouring(teaKey)}
                    onTouchEnd={stopPouring}
                    className={`p-1.5 rounded-xl border-2 flex flex-col items-center justify-between text-center transition-all select-none cursor-pointer ${
                      isPouring && currentPrepState.teaBase === teaKey
                        ? 'border-orange-600 bg-orange-100 scale-95 ring-2 ring-orange-500'
                        : isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : isTargetTea
                        ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-300'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className="w-full h-4 rounded-md border border-slate-700 flex items-center justify-center text-[8px] font-black text-white"
                      style={{ backgroundColor: meta.color }}
                    >
                      VÒI
                    </div>
                    <div className="text-[10px] font-black text-slate-800 leading-tight truncate w-full mt-1">
                      {meta.name}
                    </div>
                    <span
                      className={`text-[8px] font-bold px-1 py-0.2 rounded mt-1 uppercase w-full ${
                        isPouring && currentPrepState.teaBase === teaKey
                          ? 'bg-orange-600 text-white animate-pulse'
                          : isTargetTea
                          ? 'bg-orange-200 text-orange-900'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isPouring && currentPrepState.teaBase === teaKey ? 'ĐANG RÓT...' : 'GIỮ RÓT'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 KHAY NGUYÊN LIỆU CHIA ĐỀU TỈ LỆ 1:1:1 (LY ĐÁ, ĐƯỜNG NƯỚC, TOPPING - HOÀN TOÀN CÂN XỨNG VÀ DỄ BẤM) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-stretch">
            {/* CỘT 1: TỦ LY & ĐÁ */}
            <div className="p-3 bg-white rounded-2xl border-2 border-blue-300 shadow-sm flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                <span className="font-black text-xs text-blue-950 flex items-center gap-1">
                  <span>🧊</span>
                  <span>2. Ly & Mức Đá</span>
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  Đá: {room.equipment.iceRemaining}%
                </span>
              </div>

              {/* Size Ly */}
              <div>
                <div className="text-[10px] font-bold text-slate-600 mb-1 flex justify-between">
                  <span>Size Ly:</span>
                  <span className="text-blue-800 font-black">Khách: {currentFocusedOrder?.drink?.size || 'M'}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['M', 'L'] as CupSize[]).map((sz) => {
                    const isSelected = currentPrepState.size === sz;
                    const isTarget = currentFocusedOrder?.drink?.size === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          sounds.playCupPickup();
                          updateCurrentPrep({ size: sz });
                        }}
                        className={`py-2 rounded-xl border-2 text-xs font-black transition-all active:scale-95 flex flex-col items-center cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : isTarget
                            ? 'border-blue-400 bg-blue-50 text-blue-900 ring-1 ring-blue-300'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span>Size {sz}</span>
                        <span className="text-[9px] opacity-80">{sz === 'M' ? 'Vừa' : 'Lớn'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mức Đá */}
              <div>
                <div className="text-[10px] font-bold text-slate-600 mb-1 flex justify-between">
                  <span>Mức Đá:</span>
                  <span className="text-blue-800 font-black">Khách: {currentFocusedOrder?.drink?.ice || '100%'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['0%', '50%', '100%'] as IceLevel[]).map((lvl) => {
                    const isSelected = currentPrepState.ice === lvl;
                    const isTarget = currentFocusedOrder?.drink?.ice === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          sounds.playIceScoop();
                          updateCurrentPrep({ ice: lvl });
                        }}
                        className={`py-1.5 rounded-lg border-2 text-[10px] font-black transition-all active:scale-95 flex flex-col items-center cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-500 text-white shadow-xs'
                            : isTarget
                            ? 'border-blue-400 bg-blue-50 text-blue-900 ring-1 ring-blue-300'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span>{lvl}</span>
                        <span className="text-[8px] opacity-80">
                          {lvl === '0%' ? 'Ko đá' : lvl === '50%' ? 'Ít đá' : 'Chuẩn'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CỘT 2: KHAY ĐƯỜNG ĐỊNH LƯỢNG (KÍCH THƯỚC CÂN ĐỐI TUYỆT ĐỐI VỚI KHAY 1 & 3, KHÔNG CÒN BỊ QUÁ TO!) */}
            <div className="p-3 bg-white rounded-2xl border-2 border-amber-300 shadow-sm flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                <span className="font-black text-xs text-amber-950 flex items-center gap-1">
                  <span>🍯</span>
                  <span>3. Khay Bơm Đường</span>
                </span>
                <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Khách: {currentFocusedOrder?.drink?.sweetness || '70%'}
                </span>
              </div>

              <div className="text-[10px] text-slate-500 leading-tight">
                Bơm siro đường vào ly: Đang là{' '}
                <b className="text-amber-900">{currentPrepState.sweetness}</b>{' '}
                {currentPrepState.sweetness === (currentFocusedOrder?.drink?.sweetness || '70%') ? (
                  <span className="text-emerald-700 font-bold">✅ Đã đúng!</span>
                ) : (
                  <span className="text-orange-600 font-bold">⚠️ Cần khớp</span>
                )}
              </div>

              {/* 5 Nút Bơm Đường chia đều đặn */}
              <div className="grid grid-cols-5 gap-1">
                {(['0%', '30%', '50%', '70%', '100%'] as SweetnessLevel[]).map((lvl) => {
                  const isSelected = currentPrepState.sweetness === lvl;
                  const isTarget = currentFocusedOrder?.drink?.sweetness === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        sounds.playPump();
                        updateCurrentPrep({ sweetness: lvl });
                      }}
                      className={`py-2 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'border-amber-600 bg-amber-500 text-white font-black shadow-sm'
                          : isTarget
                          ? 'border-amber-400 bg-amber-50 text-amber-950 font-black ring-1 ring-amber-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span className="text-xs">{lvl === '0%' ? '⚪' : '🍯'}</span>
                      <span className="text-[10px] font-black">{lvl}</span>
                      <span className="text-[8px] opacity-80 uppercase leading-none">
                        {isSelected ? 'ĐÃ BƠM' : isTarget ? 'ĐƠN' : 'CHỌN'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-1.5 bg-amber-50 rounded-xl border border-amber-200 text-center text-[10px] font-bold text-amber-900">
                {currentPrepState.sweetness === (currentFocusedOrder?.drink?.sweetness || '70%')
                  ? '✨ Mức đường đã sẵn sàng'
                  : `Bấm chọn mức ${currentFocusedOrder?.drink?.sweetness || '70%'} theo đơn khách`}
              </div>
            </div>

            {/* CỘT 3: KHAY TOPPING ĐA NGĂN (RỘNG RÃI, KHÔNG CHEN CHÚC, DỄ BẤM) */}
            <div className="p-3 bg-white rounded-2xl border-2 border-purple-300 shadow-sm flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                <span className="font-black text-xs text-purple-950 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span>4. Khay Topping (6 Loại)</span>
                </span>
                <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded">
                  Đã thêm: {currentPrepState.toppings.length}
                </span>
              </div>

              {/* Lưới 6 Khay Topping đều đặn 2 cột x 3 dòng */}
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(TOPPINGS) as ToppingId[]).map((topId) => {
                  const meta = TOPPINGS[topId];
                  const isAdded = currentPrepState.toppings.includes(topId);
                  const isOrdered = currentFocusedOrder?.drink?.toppings.includes(topId);

                  return (
                    <button
                      key={topId}
                      type="button"
                      onClick={() => {
                        sounds.playToppingPlop();
                        const nextTops = isAdded
                          ? currentPrepState.toppings.filter((t) => t !== topId)
                          : [...currentPrepState.toppings, topId];
                        updateCurrentPrep({ toppings: nextTops });
                      }}
                      className={`p-1.5 rounded-xl border-2 flex items-center justify-between transition-all active:scale-95 cursor-pointer text-left ${
                        isAdded
                          ? 'border-purple-600 bg-purple-100 font-black shadow-xs ring-1 ring-purple-400'
                          : isOrdered
                          ? 'border-orange-400 bg-orange-50 hover:bg-orange-100 ring-1 ring-orange-300'
                          : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-400 shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-[10px] font-bold text-slate-800 truncate">
                          {meta.name}
                        </span>
                      </div>

                      {isAdded ? (
                        <Check className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                      ) : isOrdered ? (
                        <span className="text-[8px] bg-orange-200 text-orange-900 font-bold px-1 rounded shrink-0">
                          Cần
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] text-purple-900 text-center font-bold">
                {currentFocusedOrder?.drink?.toppings.length === 0
                  ? 'Đơn này không yêu cầu topping'
                  : `Yêu cầu: ${currentFocusedOrder?.drink?.toppings.map((t) => TOPPINGS[t].name).join(', ')}`}
              </div>
            </div>
          </div>

          {/* Quick Snack notification if this order requires fried food */}
          {currentFocusedOrder?.snack && (
            <div className="p-2.5 bg-amber-50 rounded-xl border-2 border-amber-300 flex items-center justify-between gap-2 shadow-xs text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">🍗</span>
                <div>
                  <span className="font-black text-amber-950">
                    Đơn này có món ăn kèm: {SNACKS[currentFocusedOrder.snack.snackId].name} (4s chiên)
                  </span>
                  <div className="text-[11px] text-slate-600">
                    {currentPrepState.cookedSnackOnPlate === currentFocusedOrder.snack.snackId ? (
                      <span className="text-emerald-700 font-black">✅ Đã có trên đĩa sẵn sàng phục vụ!</span>
                    ) : (
                      <span className="text-amber-800 font-bold">👉 Chưa có trên đĩa! Hãy thả vào nồi chiên 4s.</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('fryer')}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-lg text-xs transition flex items-center gap-1 shadow cursor-pointer shrink-0"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Mở Bếp Chiên (4s)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: KHU BẾP CHIÊN (THỜI GIAN 4 GIÂY) --- */}
      {activeTab === 'fryer' && (
        <div className="p-4 bg-white rounded-2xl border-2 border-amber-300 shadow-md space-y-3">
          <div className="border-b border-amber-200 pb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-sm text-amber-950 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-600" />
                <span>Bếp Chiên Ngập Dầu (Thời Gian Chiên: 4 Giây)</span>
              </h3>
              <p className="text-[11px] text-slate-600">
                Thả món vào dầu sôi, <b>chỉ 4 giây là chín vàng</b>! Nhấc ra đĩa ngay, để quá 9 giây sẽ <b>Cháy Khét</b>!
              </p>
            </div>
            {currentPrepState.cookedSnackOnPlate && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs rounded-xl flex items-center gap-1">
                🍽️ Đã vớt ra đĩa: {SNACKS[currentPrepState.cookedSnackOnPlate].name}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {room.fryerSlots.map((slot) => {
              const meta = SNACKS[slot.snackId];
              return (
                <div
                  key={slot.id}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col justify-between gap-2.5 ${
                    slot.state === 'frying'
                      ? 'border-yellow-500 bg-yellow-50 shadow-md'
                      : slot.state === 'cooked'
                      ? 'border-green-500 bg-green-50 shadow-md animate-pulse'
                      : slot.state === 'burnt'
                      ? 'border-red-600 bg-red-100'
                      : 'border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-slate-800">
                      Nồi Chiên #{slot.id}: {meta.name}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                        slot.state === 'empty'
                          ? 'bg-slate-200 text-slate-600'
                          : slot.state === 'frying'
                          ? 'bg-yellow-200 text-yellow-900'
                          : slot.state === 'cooked'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {slot.state === 'empty'
                        ? 'Đang trống'
                        : slot.state === 'frying'
                        ? 'Đang rán xì xèo...'
                        : slot.state === 'cooked'
                        ? 'Chín vàng (4s)!'
                        : 'CHÁY KHÉT!'}
                    </span>
                  </div>

                  {slot.state !== 'empty' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>TG: {slot.elapsedSec}s / 4s chín (Khét ở {slot.burnSec}s)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-2.5 transition-all ${
                            slot.state === 'cooked'
                              ? 'bg-emerald-500'
                              : slot.state === 'burnt'
                              ? 'bg-slate-900'
                              : 'bg-yellow-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (slot.elapsedSec / slot.burnSec) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between">
                    {slot.state === 'empty' ? (
                      <div className="flex gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => handleDropFoodToFryer(slot, 'ga_ran')}
                          className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition active:scale-95"
                        >
                          🍗 Gà Rán (4s)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDropFoodToFryer(slot, 'ca_vien')}
                          className="flex-1 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition active:scale-95"
                        >
                          🍡 Cá Viên (4s)
                        </button>
                      </div>
                    ) : slot.state === 'cooked' ? (
                      <button
                        type="button"
                        onClick={() => handlePickFoodFromFryer(slot)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md animate-bounce cursor-pointer"
                      >
                        🍽️ VỚT RA ĐĨA NGAY (4S CHÍN VÀNG)!
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePickFoodFromFryer(slot)}
                        className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" /> VỨT ĐỒ KHÉT VÀO THÙNG RÁC
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB 3: THU NGÂN / HÀNG ĐỢI --- */}
      {activeTab === 'pos' && (
        <div className="p-4 bg-white rounded-2xl border-2 border-slate-300 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-slate-700" />
              <span>Hàng Đợi Đơn Hàng (Tối đa nhận 3 đơn cùng lúc)</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">
              Đang làm: {activeOrderIds.length}/3 đơn
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
            {room.orders.map((ord) => {
              const isOvertime = ord.elapsedSeconds > 60;
              const isCurrentlyActive = activeOrderIds.includes(ord.id);
              return (
                <div
                  key={ord.id}
                  className={`p-3 rounded-xl border-2 transition ${
                    isCurrentlyActive
                      ? 'border-orange-500 bg-orange-50'
                      : isOvertime
                      ? 'border-red-400 bg-red-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-slate-900">
                          #{ord.orderNumber} • Bàn {ord.tableId}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                            ord.status === 'queued'
                              ? 'bg-amber-200 text-amber-900'
                              : ord.status === 'in_progress'
                              ? 'bg-blue-200 text-blue-900'
                              : 'bg-green-200 text-green-900'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
                        {ord.drink ? `${ord.drink.size} • ${TEA_BASES[ord.drink.teaBase].name}` : ''}
                        {ord.snack ? ` + ${SNACKS[ord.snack.snackId].name}` : ''}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-xs text-amber-950">
                        {ord.totalPrice.toLocaleString('vi-VN')}đ
                      </span>
                      <div className="text-[10px] text-slate-500">{ord.elapsedSeconds}s trôi qua</div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Khách: {ord.customerName}</span>
                    {ord.status === 'queued' && (
                      <button
                        type="button"
                        disabled={activeOrderIds.length >= 3}
                        onClick={() => handleAcceptOrder(ord.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-black shadow transition active:scale-95 cursor-pointer ${
                          activeOrderIds.length >= 3
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }`}
                      >
                        {activeOrderIds.length >= 3 ? 'Hết slot (3/3)' : 'Nhận đơn này'}
                      </button>
                    )}
                    {isCurrentlyActive && (
                      <span className="text-[10px] font-black text-orange-600 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Đang trong 3 slot làm món
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
