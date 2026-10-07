import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Smartphone, Monitor, BookOpen, FileEdit, BarChart3, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';

export type ActiveTab = 'host' | 'player' | 'async' | 'builder' | 'reports';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isDualView: boolean;
  onToggleDualView: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  isDualView,
  onToggleDualView,
}) => {
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [volume, setVolume] = useState(sound.getVolume());

  useEffect(() => {
    setIsMuted(sound.getMuted());
  }, []);

  const handleToggleSound = () => {
    const nextMute = !isMuted;
    sound.setMuted(nextMute);
    setIsMuted(nextMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    sound.setVolume(val);
    setVolume(val);
    if (isMuted && val > 0) {
      sound.setMuted(false);
      setIsMuted(false);
    }
  };

  return (
    <header className="bg-[#008049] text-white shadow-md border-b-2 border-[#FFCC00] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('host')}>
            <div className="w-10 h-10 rounded-lg bg-[#004D2C] border-2 border-[#FFCC00] flex items-center justify-center shadow-inner">
              <span className="text-xl text-[#FFCC00] font-black drop-shadow">★</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-wider text-white">BIDV</span>
                <span className="bg-[#FFCC00] text-[#004D2C] font-black text-xs px-1.5 py-0.5 rounded tracking-normal">
                  EduPlay
                </span>
              </div>
              <p className="text-[11px] text-[#E8F5E9] font-medium hidden sm:block">
                Hệ thống tương tác thời gian thực LMS
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-[#004D2C]/40 p-1 rounded-xl border border-white/10">
            <button
              id="tab-host-btn"
              onClick={() => onTabChange('host')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'host'
                  ? 'bg-[#FFCC00] text-[#004D2C] shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Phòng Host (Trình chiếu)</span>
            </button>
            <button
              id="tab-player-btn"
              onClick={() => onTabChange('player')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'player'
                  ? 'bg-[#FFCC00] text-[#004D2C] shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Học Viên (Thi đấu)</span>
            </button>
            <button
              id="tab-async-btn"
              onClick={() => onTabChange('async')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'async'
                  ? 'bg-[#FFCC00] text-[#004D2C] shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Tự Học (Async)</span>
            </button>
            <button
              id="tab-builder-btn"
              onClick={() => onTabChange('builder')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'builder'
                  ? 'bg-[#FFCC00] text-[#004D2C] shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <FileEdit className="w-4 h-4" />
              <span>Quản Trị (Admin)</span>
            </button>
            <button
              id="tab-reports-btn"
              onClick={() => onTabChange('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'reports'
                  ? 'bg-[#FFCC00] text-[#004D2C] shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Báo Cáo LMS</span>
            </button>
          </nav>

          {/* Quick controls: Dual Screen & Audio */}
          <div className="flex items-center gap-3">
            {/* Dual view button */}
            <button
              id="toggle-dual-view-btn"
              onClick={onToggleDualView}
              title="Chế độ màn hình kép (Host + Học viên song song)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                isDualView
                  ? 'bg-[#FFCC00] text-[#004D2C] border-[#FFCC00]'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFCC00]" />
              <span className="hidden sm:inline">Màn hình kép</span>
            </button>

            {/* Audio volume & toggle */}
            <div className="flex items-center gap-2 bg-[#004D2C]/60 px-2.5 py-1 rounded-lg border border-white/10">
              <button
                id="toggle-sound-btn"
                onClick={handleToggleSound}
                className="text-white hover:text-[#FFCC00] transition-colors"
                title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-300" /> : <Volume2 className="w-4 h-4 text-[#FFCC00]" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 accent-[#FFCC00] cursor-pointer hidden sm:block"
                title="Âm lượng"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile subnav */}
      <div className="md:hidden flex overflow-x-auto gap-1 px-3 py-2 bg-[#004D2C] border-t border-white/10 text-xs">
        <button
          onClick={() => onTabChange('host')}
          className={`whitespace-nowrap px-2.5 py-1 rounded-md font-bold ${
            activeTab === 'host' ? 'bg-[#FFCC00] text-[#004D2C]' : 'text-white'
          }`}
        >
          Host Trình Chiếu
        </button>
        <button
          onClick={() => onTabChange('player')}
          className={`whitespace-nowrap px-2.5 py-1 rounded-md font-bold ${
            activeTab === 'player' ? 'bg-[#FFCC00] text-[#004D2C]' : 'text-white'
          }`}
        >
          Học Viên
        </button>
        <button
          onClick={() => onTabChange('async')}
          className={`whitespace-nowrap px-2.5 py-1 rounded-md font-bold ${
            activeTab === 'async' ? 'bg-[#FFCC00] text-[#004D2C]' : 'text-white'
          }`}
        >
          Tự Học
        </button>
        <button
          onClick={() => onTabChange('builder')}
          className={`whitespace-nowrap px-2.5 py-1 rounded-md font-bold ${
            activeTab === 'builder' ? 'bg-[#FFCC00] text-[#004D2C]' : 'text-white'
          }`}
        >
          Admin Soạn Đề
        </button>
        <button
          onClick={() => onTabChange('reports')}
          className={`whitespace-nowrap px-2.5 py-1 rounded-md font-bold ${
            activeTab === 'reports' ? 'bg-[#FFCC00] text-[#004D2C]' : 'text-white'
          }`}
        >
          Báo Cáo
        </button>
      </div>
    </header>
  );
};
