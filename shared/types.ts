export type Role = 'seller' | 'customer';

export type CupSize = 'M' | 'L';

export type TeaBase = 'tra_sua' | 'hong_tra' | 'luc_tra' | 'olong' | 'tra_thai';

export type SweetnessLevel = '0%' | '30%' | '50%' | '70%' | '100%';

export type IceLevel = '0%' | '50%' | '100%';

export type ToppingId =
  | 'tran_chau_den'
  | 'tran_chau_trang'
  | 'tran_chau_soi'
  | 'thach'
  | 'pudding'
  | 'suong_sao';

export type SnackId = 'ga_ran' | 'ca_vien';

export interface ToppingMeta {
  id: ToppingId;
  name: string;
  price: number;
  cost: number;
  color: string;
}

export interface TeaBaseMeta {
  id: TeaBase;
  name: string;
  color: string;
  cost: number;
}

export interface SnackMeta {
  id: SnackId;
  name: string;
  price: number;
  cost: number;
  fryTimeSec: number;
  burnTimeSec: number;
  color: string;
}

export const TEA_BASES: Record<TeaBase, TeaBaseMeta> = {
  tra_sua: { id: 'tra_sua', name: 'Trà Sữa Truyền Thống', color: '#c59b6d', cost: 7000 },
  hong_tra: { id: 'hong_tra', name: 'Hồng Trà Thượng Hạng', color: '#883120', cost: 5000 },
  luc_tra: { id: 'luc_tra', name: 'Lục Trà Hoa Lài', color: '#8fa85b', cost: 5000 },
  olong: { id: 'olong', name: 'Trà Ô Long Rang Đậm', color: '#aa713c', cost: 6000 },
  tra_thai: { id: 'tra_thai', name: 'Trà Thái Đỏ Thơm Béo', color: '#d9642e', cost: 7000 },
};

export const TOPPINGS: Record<ToppingId, ToppingMeta> = {
  tran_chau_den: { id: 'tran_chau_den', name: 'Trân châu đen', price: 5000, cost: 2000, color: '#1f1b18' },
  tran_chau_trang: { id: 'tran_chau_trang', name: 'Trân châu trắng', price: 7000, cost: 3000, color: '#eaeef5' },
  tran_chau_soi: { id: 'tran_chau_soi', name: 'Trân châu sợi', price: 8000, cost: 3500, color: '#dfa344' },
  thach: { id: 'thach', name: 'Thạch trái cây', price: 6000, cost: 2500, color: '#f87171' },
  pudding: { id: 'pudding', name: 'Pudding trứng', price: 9000, cost: 4000, color: '#fbbf24' },
  suong_sao: { id: 'suong_sao', name: 'Sương sáo thảo mộc', price: 6000, cost: 2500, color: '#332924' },
};

export const SNACKS: Record<SnackId, SnackMeta> = {
  ga_ran: { id: 'ga_ran', name: 'Gà Rán Giòn Rụm', price: 35000, cost: 15000, fryTimeSec: 4, burnTimeSec: 9, color: '#ea580c' },
  ca_vien: { id: 'ca_vien', name: 'Cá Viên Chiên Thập Cẩm', price: 25000, cost: 10000, fryTimeSec: 4, burnTimeSec: 9, color: '#f59e0b' },
};

export const SIZE_PRICES: Record<CupSize, { price: number; cost: number }> = {
  M: { price: 30000, cost: 5000 },
  L: { price: 42000, cost: 7000 },
};

export interface OrderItemDrink {
  size: CupSize;
  teaBase: TeaBase;
  sweetness: SweetnessLevel;
  ice: IceLevel;
  toppings: ToppingId[];
  price: number;
  cost: number;
}

export interface OrderItemSnack {
  snackId: SnackId;
  price: number;
  cost: number;
}

export type OrderStatus =
  | 'queued' // in line
  | 'in_progress' // seller brewing
  | 'ready' // finished at serving hatch
  | 'delivering' // NPC waiter carrying to table
  | 'completed' // delivered and consumed
  | 'cancelled';

export interface Order {
  id: string;
  orderNumber: number;
  customerId: string;
  customerName: string;
  tableId: number;
  stoolIndex: number;
  drink?: OrderItemDrink;
  snack?: OrderItemSnack;
  totalPrice: number;
  totalCost: number;
  createdAt: number; // timestamp
  elapsedSeconds: number;
  status: OrderStatus;
  rushCount: number; // how many times customer rushed
  servedAt?: number;
  qualityScore?: number; // 0-100% accuracy in pouring/toppings/frying
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  ready: boolean;
  isAI?: boolean;
  wallet: number; // money balance
  tableId?: number;
  stoolIndex?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  role: Role;
  text: string;
  timestamp: number;
  type: 'global' | 'whisper';
  recipientId?: string; // for whisper
}

export type BreakdownType = 'ice_machine' | 'tea_tap' | 'fryer';

export interface EquipmentState {
  iceMachineBroken: boolean;
  iceRemaining: number; // 0 - 100%
  teaTapJammed: boolean;
  fryerOverheating: boolean;
}

export interface FryerSlot {
  id: number;
  snackId: SnackId;
  orderId: string;
  startedAt: number;
  elapsedSec: number;
  targetSec: number;
  burnSec: number;
  state: 'empty' | 'frying' | 'cooked' | 'burnt';
}

export interface FinancialRecord {
  day: number;
  totalRevenue: number;
  miniGameRewardTotal: number;
  ingredientCostTotal: number;
  wastePenaltyTotal: number;
  netProfit: number;
  ordersCompleted: number;
  ordersFailed: number;
  rushCountTotal: number;
}

export interface WaiterState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  carryingOrderId?: string;
  status: 'idle' | 'walking_to_counter' | 'delivering' | 'returning';
  deliveryTimerSec?: number; // 5s delivery walk duration
}

export interface TableLayout {
  id: number;
  type: 'round' | 'square' | 'rect';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stoolCount: number;
}

export interface RoomState {
  roomId: string;
  day: number;
  dayDurationSeconds: number;
  dayTimeRemaining: number;
  isDayActive: boolean;
  isAcceptingOrders: boolean; // true: mở bán dồn dập; false: tạm nghỉ tay không nhận đơn
  players: Record<string, Player>;
  orders: Order[];
  currentServingOrder?: Order;
  equipment: EquipmentState;
  financials: FinancialRecord;
  waiter: WaiterState;
  fryerSlots: FryerSlot[];
  rushAlert: {
    active: boolean;
    orderId?: string;
    tableId?: number;
    message?: string;
    timestamp?: number;
  };
}
