import React from 'react';
import { FinancialRecord } from '../../shared/types.ts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Coffee,
  Flame,
  Award,
  Play,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface DaySummaryModalProps {
  financials: FinancialRecord;
  day: number;
  onStartNextDay: () => void;
}

export const DaySummaryModal: React.FC<DaySummaryModalProps> = ({
  financials,
  day,
  onStartNextDay,
}) => {
  const isProfitable = financials.netProfit >= 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3">
      <div className="w-full max-w-xl bg-gradient-to-b from-amber-50 to-orange-100 rounded-3xl p-6 md:p-8 border-4 border-amber-400 shadow-2xl space-y-6 animate-scale-up">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-amber-200 text-amber-900 text-xs font-black uppercase tracking-wider">
            📊 KẾT THÚC NGÀY {day}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-amber-950 font-['Comfortaa',sans-serif]">
            Bảng Tổng Kết Thu Chi Chi Tiết
          </h2>
          <p className="text-xs text-amber-800">
            Báo cáo tài chính doanh số tiệm trà sữa và cân đối dòng tiền cho ngày tiếp theo
          </p>
        </div>

        {/* Financial Breakdown Table */}
        <div className="bg-white/90 rounded-2xl border-2 border-amber-200 p-4 divide-y divide-amber-100 shadow-sm text-sm">
          {/* 1. Doanh thu bán hàng */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <Coffee className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-slate-800 block">1. Doanh Thu Bán Hàng</span>
                <span className="text-[10px] text-slate-500">
                  Từ {financials.ordersCompleted} đơn trà sữa & đồ ăn vặt hoàn thành
                </span>
              </div>
            </div>
            <span className="font-black text-emerald-600 text-base">
              + {financials.totalRevenue.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>

          {/* 2. Tiền thưởng mini-game */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                <Award className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-slate-800 block">2. Tiền Thưởng Mini-Game</span>
                <span className="text-[10px] text-slate-500">
                  Khách hàng hứng trân châu tích lũy vào tài khoản
                </span>
              </div>
            </div>
            <span className="font-black text-purple-600 text-base">
              + {financials.miniGameRewardTotal.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>

          {/* 3. Chi phí nguyên liệu */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-orange-100 text-orange-700 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-slate-800 block">3. Chi Phí Nguyên Liệu</span>
                <span className="text-[10px] text-slate-500">
                  Cốt trà, sữa, topping, đá viên, gà rán & cá viên
                </span>
              </div>
            </div>
            <span className="font-black text-orange-600 text-base">
              - {financials.ingredientCostTotal.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>

          {/* 4. Tiền phạt làm sai / làm khét */}
          <div className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                <Flame className="w-4 h-4" />
              </span>
              <div>
                <span className="font-bold text-slate-800 block">4. Tiền Phạt Làm Sai / Cháy Khét</span>
                <span className="text-[10px] text-slate-500">
                  Rót trật vạch xanh, cháy khét đồ ăn hoặc đền bù đơn hỏng
                </span>
              </div>
            </div>
            <span className="font-black text-red-600 text-base">
              - {financials.wastePenaltyTotal.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>

          {/* 5. TỔNG KẾT LÃI / LỖ */}
          <div className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`p-2 rounded-xl text-white ${
                  isProfitable ? 'bg-emerald-600' : 'bg-red-600'
                }`}
              >
                {isProfitable ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
              </span>
              <div>
                <span className="font-black text-slate-900 text-base block uppercase">
                  {isProfitable ? 'KẾT QUẢ: KINH DOANH CÓ LÃI! 🎉' : 'KẾT QUẢ: KINH DOANH BỊ LỖ! ⚠️'}
                </span>
                <span className="text-xs text-slate-500">
                  Bị khách hối: {financials.rushCountTotal} lần
                </span>
              </div>
            </div>
            <span
              className={`font-black text-xl md:text-2xl ${
                isProfitable ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {isProfitable ? '+' : ''}
              {financials.netProfit.toLocaleString('vi-VN')} VNĐ
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onStartNextDay}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-base rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>BẮT ĐẦU NGÀY TIẾP THEO (NGÀY {day + 1})</span>
        </button>
      </div>
    </div>
  );
};
