import React from 'react';
import { Smartphone, Monitor, X } from 'lucide-react';
import { GameRoom, Quiz } from '../types';
import { LiveHostView } from './LiveHostView';
import { PlayerView } from './PlayerView';

interface DualScreenContainerProps {
  quizzes: Quiz[];
  activeRoom: GameRoom | null;
  onRoomCreated: (room: GameRoom) => void;
  onRoomUpdated: (room: GameRoom) => void;
  onCloseDualView: () => void;
}

export const DualScreenContainer: React.FC<DualScreenContainerProps> = ({
  quizzes,
  activeRoom,
  onRoomCreated,
  onRoomUpdated,
  onCloseDualView,
}) => {
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-slate-900">
      {/* Left: Host Screen (Projector View) */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto border-r-2 border-emerald-950">
        <div className="bg-[#004D2C] text-[#FFCC00] px-4 py-2 flex items-center justify-between text-xs font-bold shrink-0">
          <div className="flex items-center gap-1.5">
            <Monitor className="w-4 h-4" />
            <span>MÀN HÌNH CHÍNH CỦA GIẢNG VIÊN (TRÌNH CHIẾU MÁY CHIẾU)</span>
          </div>
          <span className="text-white/80 font-normal">
            {activeRoom ? `MÃ PIN: ${activeRoom.pin} | Trạng thái: ${activeRoom.status}` : 'Chưa tạo phòng'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F5F7F6]">
          <LiveHostView
            quizzes={quizzes}
            activeRoom={activeRoom}
            onRoomCreated={onRoomCreated}
            onRoomUpdated={onRoomUpdated}
          />
        </div>
      </div>

      {/* Right: Simulated Smartphone Frame for Student */}
      <div className="w-full lg:w-[420px] bg-slate-950 p-3 sm:p-4 flex flex-col shrink-0 items-center justify-center border-t lg:border-t-0 border-white/10">
        <div className="w-full flex items-center justify-between text-white text-xs mb-2 px-1">
          <div className="flex items-center gap-1.5 font-bold text-[#FFCC00]">
            <Smartphone className="w-4 h-4" />
            <span>THIẾT BỊ HỌC VIÊN (MOBILE)</span>
          </div>
          <button
            onClick={onCloseDualView}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng chế độ kép"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Smartphone mockup bezel */}
        <div className="w-full max-w-[360px] h-[580px] sm:h-[640px] bg-black rounded-[40px] p-3 shadow-2xl border-4 border-slate-700 flex flex-col relative">
          {/* Phone notch */}
          <div className="w-32 h-4 bg-slate-800 rounded-b-xl mx-auto mb-1 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700"></div>
          </div>

          {/* Phone screen inner */}
          <div className="flex-1 rounded-[28px] overflow-y-auto bg-white flex flex-col">
            <PlayerView initialPin={activeRoom?.pin || ''} />
          </div>

          {/* Home indicator bar */}
          <div className="w-28 h-1 bg-slate-600 rounded-full mx-auto mt-2 shrink-0"></div>
        </div>
      </div>
    </div>
  );
};
