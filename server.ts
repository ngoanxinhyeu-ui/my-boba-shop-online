import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  Role,
  RoomState,
  Player,
  Order,
  ChatMessage,
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
  FryerSlot,
} from './shared/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const rooms: Record<string, RoomState> = {};
const roomTimers: Record<string, NodeJS.Timeout> = {};

// Helper to generate 4-letter room codes
function generateRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

// Initialise default room state
function createDefaultRoomState(roomId: string): RoomState {
  return {
    roomId,
    day: 1,
    dayDurationSeconds: 300, // 5 minutes per day shift
    dayTimeRemaining: 300,
    isDayActive: false,
    isAcceptingOrders: true,
    players: {},
    orders: [],
    equipment: {
      iceMachineBroken: false,
      iceRemaining: 100,
      teaTapJammed: false,
      fryerOverheating: false,
    },
    financials: {
      day: 1,
      totalRevenue: 0,
      miniGameRewardTotal: 0,
      ingredientCostTotal: 0,
      wastePenaltyTotal: 0,
      netProfit: 0,
      ordersCompleted: 0,
      ordersFailed: 0,
      rushCountTotal: 0,
    },
    waiter: {
      x: 180,
      y: 200,
      targetX: 180,
      targetY: 200,
      status: 'idle',
    },
    fryerSlots: [
      { id: 1, snackId: 'ga_ran', orderId: '', startedAt: 0, elapsedSec: 0, targetSec: 4, burnSec: 9, state: 'empty' },
      { id: 2, snackId: 'ca_vien', orderId: '', startedAt: 0, elapsedSec: 0, targetSec: 4, burnSec: 9, state: 'empty' },
    ],
    rushAlert: {
      active: false,
    },
  };
}

// Table positions on canvas for NPC & customer seating
const TABLE_SEATS: Record<number, { x: number; y: number }[]> = {
  1: [ // Round Table (8 stools)
    { x: 420, y: 140 }, { x: 470, y: 155 }, { x: 500, y: 200 }, { x: 490, y: 250 },
    { x: 440, y: 280 }, { x: 390, y: 270 }, { x: 360, y: 230 }, { x: 370, y: 170 },
  ],
  2: [ // Square Table 1 (4 stools)
    { x: 370, y: 380 }, { x: 450, y: 380 }, { x: 370, y: 460 }, { x: 450, y: 460 },
  ],
  3: [ // Rectangular Table (6 stools)
    { x: 560, y: 370 }, { x: 620, y: 370 }, { x: 680, y: 370 },
    { x: 560, y: 470 }, { x: 620, y: 470 }, { x: 680, y: 470 },
  ],
  4: [ // Square Table 2 (4 stools)
    { x: 620, y: 160 }, { x: 680, y: 160 }, { x: 620, y: 240 }, { x: 680, y: 240 },
  ],
};

// Start or resume game loop for a room
function ensureRoomGameLoop(roomId: string) {
  if (roomTimers[roomId]) return;

  roomTimers[roomId] = setInterval(() => {
    const room = rooms[roomId];
    if (!room) {
      clearInterval(roomTimers[roomId]);
      delete roomTimers[roomId];
      return;
    }

    if (!room.isDayActive) return;

    // 1. Advance day timer
    if (room.dayTimeRemaining > 0) {
      room.dayTimeRemaining -= 1;
    } else {
      // Day ended!
      room.isDayActive = false;
      io.to(roomId).emit('day:ended', {
        financials: room.financials,
        day: room.day,
      });
      return;
    }

    // 2. Increment elapsed time for queued and in_progress orders
    let hasRushed = false;
    room.orders.forEach((ord) => {
      if (ord.status === 'queued' || ord.status === 'in_progress') {
        ord.elapsedSeconds += 1;
        // Check if customer is AI and needs to rush!
        const cust = room.players[ord.customerId];
        if (cust?.isAI && ord.elapsedSeconds > 60 && ord.elapsedSeconds % 12 === 0) {
          ord.rushCount += 1;
          room.financials.rushCountTotal += 1;
          room.rushAlert = {
            active: true,
            orderId: ord.id,
            tableId: ord.tableId,
            message: `[AI Khách Bàn ${ord.tableId}] HỐI NGƯỜI BÁN: Làm nhanh giùm tôi với, đã hơn 1 phút rồi!`,
            timestamp: Date.now(),
          };
          hasRushed = true;
          io.to(roomId).emit('order:rushed', {
            orderId: ord.id,
            rushCount: ord.rushCount,
            alert: room.rushAlert,
          });
        }
      }
    });

    // 3. Update fryer slots
    room.fryerSlots.forEach((slot) => {
      if (slot.state === 'frying') {
        slot.elapsedSec += 1;
        if (slot.elapsedSec >= slot.burnSec) {
          slot.state = 'burnt';
          room.financials.wastePenaltyTotal += 15000;
          room.financials.netProfit =
            room.financials.totalRevenue +
            room.financials.miniGameRewardTotal -
            room.financials.ingredientCostTotal -
            room.financials.wastePenaltyTotal;
          io.to(roomId).emit('fryer:burnt', { slotId: slot.id });
        } else if (slot.elapsedSec >= slot.targetSec) {
          slot.state = 'cooked';
        }
      }
    });

    // 4. Waiter NPC movement (Exactly 5 seconds delivery walk to customer table)
    const waiter = room.waiter;
    const readyOrder = room.orders.find((o) => o.status === 'ready');

    if (waiter.status === 'idle') {
      if (readyOrder) {
        // Pick up at hatch and immediately start 5-second delivery walk
        readyOrder.status = 'delivering';
        waiter.carryingOrderId = readyOrder.id;
        waiter.status = 'delivering';
        waiter.deliveryTimerSec = 5; // Exactly 5 seconds to deliver to customer table!
        waiter.x = 230;
        waiter.y = 130;
        const seats = TABLE_SEATS[readyOrder.tableId] || TABLE_SEATS[1];
        const seat = seats[readyOrder.stoolIndex % seats.length];
        waiter.targetX = seat.x - 25;
        waiter.targetY = seat.y - 25;
      }
    } else if (waiter.status === 'delivering') {
      // 5-second delivery walk across dining room
      if (waiter.deliveryTimerSec !== undefined && waiter.deliveryTimerSec > 0) {
        waiter.deliveryTimerSec -= 1;
        const dx = waiter.targetX - waiter.x;
        const dy = waiter.targetY - waiter.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          const step = dist / Math.max(1, waiter.deliveryTimerSec + 1);
          waiter.x += (dx / dist) * step;
          waiter.y += (dy / dist) * step;
        }
      }

      if (waiter.deliveryTimerSec === undefined || waiter.deliveryTimerSec <= 0) {
        const order = room.orders.find((o) => o.id === waiter.carryingOrderId);
        if (order) {
          order.status = 'completed';
          order.servedAt = Date.now();
          room.financials.ordersCompleted += 1;
          io.to(roomId).emit('order:delivered', { orderId: order.id });
        }
        waiter.carryingOrderId = undefined;
        waiter.deliveryTimerSec = undefined;
        waiter.status = 'returning';
        waiter.targetX = 180;
        waiter.targetY = 200;
      }
    } else if (waiter.status === 'returning') {
      const dx = waiter.targetX - waiter.x;
      const dy = waiter.targetY - waiter.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 20) {
        waiter.status = 'idle';
      } else {
        waiter.x += (dx / dist) * 22;
        waiter.y += (dy / dist) * 22;
      }
    }

    // 5. Equipment Breakdown Random Event (3% chance every 10 seconds if healthy)
    if (Math.random() < 0.03) {
      const eq = room.equipment;
      if (!eq.iceMachineBroken && !eq.teaTapJammed && !eq.fryerOverheating) {
        const roll = Math.random();
        if (roll < 0.35) {
          eq.iceMachineBroken = true;
          eq.iceRemaining = 0;
          io.to(roomId).emit('equipment:breakdown', { type: 'ice_machine', message: 'Tủ đá bị hết đá! Cần nạp lại!' });
        } else if (roll < 0.7) {
          eq.teaTapJammed = true;
          io.to(roomId).emit('equipment:breakdown', { type: 'tea_tap', message: 'Vòi rót trà bị kẹt van! Cần thông tắc!' });
        } else {
          eq.fryerOverheating = true;
          io.to(roomId).emit('equipment:breakdown', { type: 'fryer', message: 'Nồi chiên ngập dầu quá nhiệt! Cần xả van an toàn!' });
        }
      }
    }

    // 6. AI Logic:
    // Check human players
    const humanCustomers = Object.values(room.players).filter((p) => p.role === 'customer' && !p.isAI);
    const humanPlayerCount = Object.values(room.players).filter((p) => !p.isAI).length;

    // RULE: When 2 humans are playing together OR whenever there is a human customer,
    // PURGE all AI bots and NEVER generate any automatic orders! Khách hàng tự gọi món theo sở thích.
    if (humanPlayerCount >= 2 || humanCustomers.length > 0) {
      Object.keys(room.players).forEach((id) => {
        if (room.players[id].isAI) {
          delete room.players[id];
        }
      });
    }

    // AI customer is ONLY active if strictly 1-player mode (no human customer) AND AI bot was explicitly requested
    const custPlayer = (humanPlayerCount < 2 && humanCustomers.length === 0)
      ? Object.values(room.players).find((p) => p.role === 'customer' && p.isAI)
      : undefined;

    if (custPlayer && room.isAcceptingOrders) {
      if (custPlayer.wallet < 60000) {
        custPlayer.wallet = 500000;
      }

      const activeCustOrders = room.orders.filter(
        (o) => o.status === 'queued' || o.status === 'in_progress'
      );
      // Continuous rushing orders: when accepting orders, if queue has room, place orders rapidly!
      const shouldOrder =
        activeCustOrders.length === 0 ||
        (activeCustOrders.length < 3 && Math.random() < 0.8) ||
        (activeCustOrders.length < 5 && Math.random() < 0.35);

      if (shouldOrder) {
        // Place an AI order!
        const teaKeys: TeaBase[] = ['tra_sua', 'hong_tra', 'luc_tra', 'olong', 'tra_thai'];
        const chosenTea = teaKeys[Math.floor(Math.random() * teaKeys.length)];
        const size: CupSize = Math.random() > 0.5 ? 'L' : 'M';
        const sweetness: SweetnessLevel = ['30%', '50%', '70%', '100%'][Math.floor(Math.random() * 4)] as SweetnessLevel;
        const ice: IceLevel = ['0%', '50%', '100%'][Math.floor(Math.random() * 3)] as IceLevel;

        const allToppings: ToppingId[] = ['tran_chau_den', 'tran_chau_trang', 'pudding', 'thach', 'tran_chau_soi'];
        const selectedToppings: ToppingId[] = [];
        const numToppings = Math.floor(Math.random() * 3);
        for (let i = 0; i < numToppings; i++) {
          const t = allToppings[Math.floor(Math.random() * allToppings.length)];
          if (!selectedToppings.includes(t)) selectedToppings.push(t);
        }

        let drinkPrice = SIZE_PRICES[size].price;
        let drinkCost = SIZE_PRICES[size].cost + TEA_BASES[chosenTea].cost;
        selectedToppings.forEach((topId) => {
          drinkPrice += TOPPINGS[topId].price;
          drinkCost += TOPPINGS[topId].cost;
        });

        // Snack?
        let snackItem = undefined;
        let snackPrice = 0;
        let snackCost = 0;
        if (Math.random() < 0.5) {
          const snackKeys: SnackId[] = ['ga_ran', 'ca_vien'];
          const sId = snackKeys[Math.floor(Math.random() * snackKeys.length)];
          snackPrice = SNACKS[sId].price;
          snackCost = SNACKS[sId].cost;
          snackItem = { snackId: sId, price: snackPrice, cost: snackCost };
        }

        const totalOrderPrice = drinkPrice + snackPrice;
        const totalOrderCost = drinkCost + snackCost;

        const tableChoices = [1, 2, 3, 4];
        const chosenTbl = tableChoices[Math.floor(Math.random() * tableChoices.length)];
        const seats = TABLE_SEATS[chosenTbl] || TABLE_SEATS[1];
        const chosenStl = Math.floor(Math.random() * seats.length);

        if (custPlayer.wallet >= totalOrderPrice) {
          custPlayer.wallet -= totalOrderPrice;
          const orderNum = room.orders.length + 1;
          const newOrder: Order = {
            id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            orderNumber: orderNum,
            customerId: custPlayer.id,
            customerName: `Khách Bàn ${chosenTbl}`,
            tableId: chosenTbl,
            stoolIndex: chosenStl,
            drink: {
              size,
              teaBase: chosenTea,
              sweetness,
              ice,
              toppings: selectedToppings,
              price: drinkPrice,
              cost: drinkCost,
            },
            snack: snackItem,
            totalPrice: totalOrderPrice,
            totalCost: totalOrderCost,
            createdAt: Date.now(),
            elapsedSeconds: 0,
            status: 'queued',
            rushCount: 0,
          };
          room.orders.push(newOrder);

          // Update seller financials
          room.financials.totalRevenue += totalOrderPrice;
          room.financials.ingredientCostTotal += totalOrderCost;
          room.financials.netProfit =
            room.financials.totalRevenue +
            room.financials.miniGameRewardTotal -
            room.financials.ingredientCostTotal -
            room.financials.wastePenaltyTotal;

          io.to(roomId).emit('order:placed', { order: newOrder, financials: room.financials });
        }
      }
    }

    // AI Seller: If Seller player is AI
    const sellerPlayer = Object.values(room.players).find((p) => p.role === 'seller' && p.isAI);
    if (sellerPlayer) {
      // Check if equipment needs fix
      if (room.equipment.iceMachineBroken) room.equipment.iceMachineBroken = false;
      if (room.equipment.teaTapJammed) room.equipment.teaTapJammed = false;
      if (room.equipment.fryerOverheating) room.equipment.fryerOverheating = false;

      // Check queued order
      const nextOrder = room.orders.find((o) => o.status === 'queued');
      if (nextOrder && !room.currentServingOrder) {
        nextOrder.status = 'in_progress';
        room.currentServingOrder = nextOrder;
      } else if (room.currentServingOrder && room.currentServingOrder.status === 'in_progress') {
        // AI simulates quick perfect preparation
        room.currentServingOrder.status = 'ready';
        room.currentServingOrder.qualityScore = 95;
        io.to(roomId).emit('order:prepared', { order: room.currentServingOrder });
        room.currentServingOrder = undefined;
      }
    }

    // Broadcast live sync
    io.to(roomId).emit('game:tick', {
      dayTimeRemaining: room.dayTimeRemaining,
      waiter: room.waiter,
      orders: room.orders,
      equipment: room.equipment,
      fryerSlots: room.fryerSlots,
      rushAlert: room.rushAlert,
    });
  }, 1000);
}

// Socket handlers
io.on('connection', (socket) => {
  let currentRoomId: string | null = null;
  let currentPlayerId: string = socket.id;

  // 1. Create room
  socket.on('room:create', ({ playerName, role }: { playerName: string; role: Role }) => {
    let roomId = generateRoomCode();
    while (rooms[roomId]) {
      roomId = generateRoomCode();
    }

    const room = createDefaultRoomState(roomId);
    const player: Player = {
      id: socket.id,
      name: playerName || (role === 'seller' ? 'Chủ Quán' : 'Khách Dễ Thương'),
      role: role || 'seller',
      ready: true,
      wallet: role === 'customer' ? 500000 : 200000,
      tableId: role === 'customer' ? 1 : undefined,
      stoolIndex: 0,
    };

    room.players[socket.id] = player;
    rooms[roomId] = room;
    currentRoomId = roomId;

    socket.join(roomId);
    socket.emit('room:created', { room, playerId: socket.id });
    io.to(roomId).emit('room:updated', { room });
  });

  // 2. Join room
  socket.on('room:join', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const code = roomId.toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      socket.emit('error:message', { message: 'Không tìm thấy phòng với mã: ' + code });
      return;
    }

    // When a human joins, purge any lingering AI bots and AI orders so 2 humans play together cleanly!
    Object.keys(room.players).forEach((id) => {
      if (room.players[id].isAI) {
        delete room.players[id];
      }
    });
    room.orders = room.orders.filter((o) => !o.customerId.startsWith('ai_bot_'));

    // Determine role: if seller is taken, become customer, else seller
    const existingRoles = Object.values(room.players).map((p) => p.role);
    let role: Role = 'customer';
    if (!existingRoles.includes('seller')) {
      role = 'seller';
    }

    const player: Player = {
      id: socket.id,
      name: playerName || (role === 'seller' ? 'Chủ Quán' : 'Khách Dễ Thương'),
      role,
      ready: false,
      wallet: role === 'customer' ? 500000 : 200000,
      tableId: role === 'customer' ? 1 : undefined,
      stoolIndex: 0,
    };

    room.players[socket.id] = player;
    currentRoomId = code;
    socket.join(code);

    socket.emit('room:joined', { room, playerId: socket.id });
    io.to(code).emit('room:updated', { room });
  });

  // 3. Switch role
  socket.on('player:switch_role', ({ role }: { role: Role }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (player) {
      player.role = role;
      player.wallet = role === 'customer' ? 500000 : 200000;
      if (role === 'customer') {
        player.tableId = player.tableId || 1;
        player.stoolIndex = 0;
      }
      io.to(currentRoomId).emit('room:updated', { room });
    }
  });

  // 4. Toggle ready
  socket.on('player:toggle_ready', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (player) {
      player.ready = !player.ready;
      io.to(currentRoomId).emit('room:updated', { room });
    }
  });

  // 5. Select seat / table
  socket.on('customer:select_seat', ({ tableId, stoolIndex }: { tableId: number; stoolIndex: number }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (player) {
      player.tableId = tableId;
      player.stoolIndex = stoolIndex;
      io.to(currentRoomId).emit('room:updated', { room });
    }
  });

  // 6. Toggle AI bot for missing role or single-player mode
  socket.on('room:toggle_ai', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];

    // Find if AI exists
    const aiPlayer = Object.values(room.players).find((p) => p.isAI);
    if (aiPlayer) {
      delete room.players[aiPlayer.id];
      // Clean out any AI-generated orders
      room.orders = room.orders.filter((o) => !o.customerId.startsWith('ai_bot_'));
    } else {
      // Only allow AI bot if single-player (less than 2 human players)
      const humans = Object.values(room.players).filter((p) => !p.isAI);
      if (humans.length < 2) {
        const human = humans[0];
        const aiRole: Role = human?.role === 'seller' ? 'customer' : 'seller';
        const aiId = `ai_bot_${Date.now()}`;
        room.players[aiId] = {
          id: aiId,
          name: aiRole === 'seller' ? 'AI Barista Pro' : 'AI Khách Nghiện Trà Sữa',
          role: aiRole,
          ready: true,
          isAI: true,
          wallet: aiRole === 'customer' ? 500000 : 200000,
          tableId: aiRole === 'customer' ? 1 : undefined,
          stoolIndex: 1,
        };
      }
    }
    io.to(currentRoomId).emit('room:updated', { room });
  });

  // 7. Start Day / Game
  socket.on('game:start', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];

    // If 2 humans are playing, guarantee all AI bots and AI orders are purged!
    const humanPlayers = Object.values(room.players).filter((p) => !p.isAI);
    if (humanPlayers.length >= 2) {
      Object.keys(room.players).forEach((id) => {
        if (room.players[id].isAI) {
          delete room.players[id];
        }
      });
      room.orders = room.orders.filter((o) => !o.customerId.startsWith('ai_bot_'));
    }

    room.isDayActive = true;
    room.dayTimeRemaining = room.dayDurationSeconds;
    ensureRoomGameLoop(currentRoomId);
    io.to(currentRoomId).emit('game:started', { room });
  });

  // 8. Customer Order placement (with bell ring!)
  socket.on('order:place', ({ drink, snack }: { drink?: any; snack?: any }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (!player) return;

    if (!room.isAcceptingOrders) {
      socket.emit('error:message', { message: 'Quán đang tạm nghỉ tay, hiện không nhận thêm đơn mới!' });
      return;
    }

    let totalPrice = 0;
    let totalCost = 0;

    if (drink) {
      totalPrice += drink.price;
      totalCost += drink.cost;
    }
    if (snack) {
      totalPrice += snack.price;
      totalCost += snack.cost;
    }

    if (player.wallet < totalPrice) {
      socket.emit('error:message', { message: 'Bạn không đủ số dư để đặt đơn này!' });
      return;
    }

    player.wallet -= totalPrice;
    const orderNumber = room.orders.length + 1;
    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      orderNumber,
      customerId: player.id,
      customerName: player.name,
      tableId: player.tableId || 1,
      stoolIndex: player.stoolIndex || 0,
      drink,
      snack,
      totalPrice,
      totalCost,
      createdAt: Date.now(),
      elapsedSeconds: 0,
      status: 'queued',
      rushCount: 0,
    };

    room.orders.push(newOrder);
    room.financials.totalRevenue += totalPrice;
    room.financials.ingredientCostTotal += totalCost;
    room.financials.netProfit =
      room.financials.totalRevenue +
      room.financials.miniGameRewardTotal -
      room.financials.ingredientCostTotal -
      room.financials.wastePenaltyTotal;

    // Broadcast bell chime and order creation!
    io.to(currentRoomId).emit('order:placed', { order: newOrder, financials: room.financials, playerWallet: player.wallet });
  });

  // 9a. Customer Dedicated Service Bell ("NÚT BẤM RENG CHUÔNG")
  socket.on('customer:ring_bell', ({ tableId, reason }: { tableId?: number; reason?: string }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    const tbl = tableId || player?.tableId || 1;
    const custName = player?.name || `Khách Bàn ${tbl}`;

    const activeOrder = room.orders.find(
      (o) => o.customerId === socket.id && (o.status === 'queued' || o.status === 'in_progress')
    );
    if (activeOrder) {
      activeOrder.rushCount += 1;
      room.financials.rushCountTotal += 1;
    }

    const bellReason = reason || (activeOrder ? `Hối đơn #${activeOrder.orderNumber}` : 'Gọi phục vụ / Đặt món');
    room.rushAlert = {
      active: true,
      orderId: activeOrder?.id,
      tableId: tbl,
      message: `🔔 [RENG CHUÔNG] ${custName} đang rung chuông: ${bellReason}!`,
      timestamp: Date.now(),
    };

    io.to(currentRoomId).emit('customer:bell_rung', {
      tableId: tbl,
      customerId: socket.id,
      customerName: custName,
      reason: bellReason,
      orderId: activeOrder?.id,
      rushCount: activeOrder?.rushCount || 1,
      alert: room.rushAlert,
    });
  });

  // 9b. Customer Rush Button ("HỐI NGƯỜI BÁN")
  socket.on('order:rush', ({ orderId }: { orderId: string }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const order = room.orders.find((o) => o.id === orderId);
    if (!order) return;

    order.rushCount += 1;
    room.financials.rushCountTotal += 1;
    room.rushAlert = {
      active: true,
      orderId: order.id,
      tableId: order.tableId,
      message: `Khách Bàn ${order.tableId} đang HỐI LÀM NHANH! Đã chờ ${Math.floor(order.elapsedSeconds)} giây!`,
      timestamp: Date.now(),
    };

    io.to(currentRoomId).emit('order:rushed', {
      orderId: order.id,
      rushCount: order.rushCount,
      alert: room.rushAlert,
    });
  });

  // 10. Seller sets active order to brew
  socket.on('order:start_brew', ({ orderId }: { orderId: string }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const order = room.orders.find((o) => o.id === orderId);
    if (order && order.status === 'queued') {
      order.status = 'in_progress';
      room.currentServingOrder = order;
      io.to(currentRoomId).emit('order:updated', { order });
    }
  });

  // 11. Seller finishes prep and places at serving counter
  socket.on('order:complete_prep', ({ orderId, qualityScore }: { orderId: string; qualityScore: number }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const order = room.orders.find((o) => o.id === orderId);
    if (order) {
      order.status = 'ready';
      order.qualityScore = qualityScore;
      if (qualityScore < 50) {
        // Bad quality penalty
        room.financials.wastePenaltyTotal += 10000;
        room.financials.netProfit =
          room.financials.totalRevenue +
          room.financials.miniGameRewardTotal -
          room.financials.ingredientCostTotal -
          room.financials.wastePenaltyTotal;
      }
      room.currentServingOrder = undefined;
      io.to(currentRoomId).emit('order:prepared', { order, financials: room.financials });
    }
  });

  // 12. Deep Fryer actions
  socket.on('fryer:insert', ({ slotId, snackId, orderId }: { slotId: number; snackId: SnackId; orderId: string }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const slot = room.fryerSlots.find((s) => s.id === slotId);
    if (slot && slot.state === 'empty') {
      slot.snackId = snackId;
      slot.orderId = orderId;
      slot.startedAt = Date.now();
      slot.elapsedSec = 0;
      slot.targetSec = SNACKS[snackId].fryTimeSec;
      slot.burnSec = SNACKS[snackId].burnTimeSec;
      slot.state = 'frying';
      io.to(currentRoomId).emit('fryer:updated', { slots: room.fryerSlots });
    }
  });

  socket.on('fryer:remove', ({ slotId }: { slotId: number }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const slot = room.fryerSlots.find((s) => s.id === slotId);
    if (slot && slot.state !== 'empty') {
      const prevState = slot.state;
      slot.state = 'empty';
      slot.orderId = '';
      io.to(currentRoomId).emit('fryer:updated', { slots: room.fryerSlots, removedSlotId: slotId, state: prevState });
    }
  });

  // 13. Equipment repair
  socket.on('equipment:repair', ({ type }: { type: 'ice_machine' | 'tea_tap' | 'fryer' }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    if (type === 'ice_machine') {
      room.equipment.iceMachineBroken = false;
      room.equipment.iceRemaining = 100;
    } else if (type === 'tea_tap') {
      room.equipment.teaTapJammed = false;
    } else if (type === 'fryer') {
      room.equipment.fryerOverheating = false;
    }
    io.to(currentRoomId).emit('equipment:repaired', { equipment: room.equipment, type });
  });

  // 14. Mini-game reward for Customer
  socket.on('minigame:reward', ({ amount }: { amount: number }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[socket.id];
    if (player && player.role === 'customer') {
      player.wallet += amount;
      room.financials.miniGameRewardTotal += amount;
      room.financials.netProfit =
        room.financials.totalRevenue +
        room.financials.miniGameRewardTotal -
        room.financials.ingredientCostTotal -
        room.financials.wastePenaltyTotal;
      io.to(currentRoomId).emit('minigame:rewarded', {
        playerId: player.id,
        amount,
        newWallet: player.wallet,
        financials: room.financials,
      });
    }
  });

  // 15. Next Day / Reset
  socket.on('day:next', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    room.day += 1;
    room.dayTimeRemaining = room.dayDurationSeconds;
    room.isDayActive = true;
    room.orders = [];
    room.rushAlert = { active: false };
    room.currentServingOrder = undefined;
    // reset customer wallet for new day if depleted
    Object.values(room.players).forEach((p) => {
      if (p.role === 'customer' && p.wallet < 100000) {
        p.wallet = 500000;
      }
    });
    // Reset day financials
    room.financials = {
      day: room.day,
      totalRevenue: 0,
      miniGameRewardTotal: 0,
      ingredientCostTotal: 0,
      wastePenaltyTotal: 0,
      netProfit: 0,
      ordersCompleted: 0,
      ordersFailed: 0,
      rushCountTotal: 0,
    };
    ensureRoomGameLoop(currentRoomId);
    io.to(currentRoomId).emit('day:started', { room });
  });

  // 16. Chat messages: Global & Whisper
  socket.on('chat:send', ({ text, type, recipientId }: { text: string; type: 'global' | 'whisper'; recipientId?: string }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const sender = room.players[socket.id];
    if (!sender || !text.trim()) return;

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      senderId: socket.id,
      senderName: sender.name,
      role: sender.role,
      text: text.trim(),
      timestamp: Date.now(),
      type,
      recipientId,
    };

    if (type === 'whisper') {
      // Send only to sender and recipient (or all sellers/customers if whisper to counter)
      if (recipientId && room.players[recipientId]) {
        io.to(recipientId).emit('chat:received', message);
        socket.emit('chat:received', message);
      } else {
        // Find other counterpart
        const counterpart = Object.values(room.players).find((p) => p.role !== sender.role);
        if (counterpart) {
          io.to(counterpart.id).emit('chat:received', message);
          socket.emit('chat:received', message);
        } else {
          socket.emit('chat:received', message);
        }
      }
    } else {
      io.to(currentRoomId).emit('chat:received', message);
    }
  });

  // 17. Toggle accepting new orders (Tạm nghỉ tay / Tiếp tục mở bán dồn dập)
  socket.on('room:toggle_accepting_orders', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    room.isAcceptingOrders = !room.isAcceptingOrders;
    io.to(currentRoomId).emit('room:updated', { room });
    io.to(currentRoomId).emit('shop:status_changed', {
      isAcceptingOrders: room.isAcceptingOrders,
      message: room.isAcceptingOrders
        ? '🔔 Quán đã MỞ BÁN TRỞ LẠI! Tiếp tục nhận đơn dồn dập!'
        : '⏸️ Quán đang TẠM NGHỈ TAY! Tạm dừng nhận thêm đơn mới!',
    });
  });

  // 18. Leave room completely to return to initial welcome screen
  socket.on('room:leave', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      const room = rooms[currentRoomId];
      delete room.players[socket.id];
      socket.leave(currentRoomId);
      currentRoomId = null;
      const humanCount = Object.values(room.players).filter((p) => !p.isAI).length;
      if (humanCount === 0) {
        if (roomTimers[room.roomId]) {
          clearInterval(roomTimers[room.roomId]);
          delete roomTimers[room.roomId];
        }
        delete rooms[room.roomId];
      } else {
        io.to(room.roomId).emit('room:updated', { room });
      }
      socket.emit('room:left');
    }
  });

  // Disconnection
  socket.on('disconnect', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      const room = rooms[currentRoomId];
      delete room.players[socket.id];
      const humanCount = Object.values(room.players).filter((p) => !p.isAI).length;
      if (humanCount === 0) {
        if (roomTimers[currentRoomId]) {
          clearInterval(roomTimers[currentRoomId]);
          delete roomTimers[currentRoomId];
        }
        delete rooms[currentRoomId];
      } else {
        io.to(currentRoomId).emit('room:updated', { room });
      }
    }
  });
});

// Vite middleware integration for full-stack dev / production serve
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
