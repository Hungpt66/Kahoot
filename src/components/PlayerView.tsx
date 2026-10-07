import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  ArrowRight,
  LogOut,
  Clock,
  Sparkles,
  Wifi,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { GameRoom, Player } from '../types';
import { sound } from '../utils/audio';

const AVATAR_OPTIONS = ['🦊', '🐼', '🦁', '🐯', '🐨', '🦄', '🦅', '🐬', '🐙', '🦖', '🚀', '⭐'];

const KAHOOT_STYLES = [
  { bg: 'bg-[#E03E36] active:bg-[#B82B24]', border: 'border-[#B82B24]', shape: '▲', label: 'A', name: 'Đỏ' },
  { bg: 'bg-[#FFCC00] text-[#004D2C] active:bg-[#DDAA00]', border: 'border-[#CCA300]', shape: '◆', label: 'B', name: 'Vàng' },
  { bg: 'bg-[#008049] active:bg-[#005a33]', border: 'border-[#005a33]', shape: '●', label: 'C', name: 'Xanh lục' },
  { bg: 'bg-[#0A66C2] active:bg-[#084e96]', border: 'border-[#084e96]', shape: '■', label: 'D', name: 'Xanh dương' },
];

interface PlayerViewProps {
  initialPin?: string;
  onExit?: () => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ initialPin = '', onExit }) => {
  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Player session
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [hasAnsweredCurrentQ, setHasAnsweredCurrentQ] = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);

  // Local phone countdown timer
  const [phoneTimeRemaining, setPhoneTimeRemaining] = useState<number>(20);
  const timerRef = useRef<number | null>(null);

  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    streak: number;
    rank?: number;
  } | null>(null);

  const questionStartTimeRef = useRef<number>(Date.now());

  const [previewRoomTitle, setPreviewRoomTitle] = useState<string | null>(null);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);

  // Live pre-check room existence as soon as PIN is entered/loaded
  useEffect(() => {
    const clean = pin.trim().replace(/\D/g, '');
    if (clean.length >= 4) {
      setIsCheckingRoom(true);
      fetch(`/api/rooms/${clean}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.pin && data.quizTitle) {
            setPreviewRoomTitle(data.quizTitle);
            setErrorMsg('');
          } else {
            setPreviewRoomTitle(null);
          }
        })
        .catch(() => {
          setPreviewRoomTitle(null);
        })
        .finally(() => {
          setIsCheckingRoom(false);
        });
    } else {
      setPreviewRoomTitle(null);
    }
  }, [pin]);

  // Restore session from sessionStorage or prioritize new URL/QR pin
  useEffect(() => {
    try {
      const currentUrlPin = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('pin')?.replace(/\D/g, '') : '') || initialPin;
      const savedPin = sessionStorage.getItem('bidv_player_pin');
      const savedPlayerId = sessionStorage.getItem('bidv_player_id');
      const savedName = sessionStorage.getItem('bidv_player_name');
      const savedAvatar = sessionStorage.getItem('bidv_player_avatar');

      if (currentUrlPin) {
        setPin(currentUrlPin);
        if (savedPin && savedPin !== currentUrlPin) {
          // User scanned a NEW room PIN! Clear old room session
          sessionStorage.removeItem('bidv_player_pin');
          sessionStorage.removeItem('bidv_player_id');
          setCurrentPlayer(null);
          setCurrentRoom(null);
        } else if (savedPin === currentUrlPin && savedPlayerId) {
          fetch(`/api/rooms/${currentUrlPin}`)
            .then((r) => r.json())
            .then((roomData: GameRoom) => {
              if (roomData && roomData.players && roomData.players[savedPlayerId]) {
                setCurrentPlayer(roomData.players[savedPlayerId]);
                setCurrentRoom(roomData);
              }
            })
            .catch(() => {});
        }
      } else if (savedPin && savedPlayerId) {
        setPin(savedPin);
        fetch(`/api/rooms/${savedPin}`)
          .then((r) => r.json())
          .then((roomData: GameRoom) => {
            if (roomData && roomData.players && roomData.players[savedPlayerId]) {
              setCurrentPlayer(roomData.players[savedPlayerId]);
              setCurrentRoom(roomData);
            }
          })
          .catch(() => {});
      }

      if (savedName) setNickname(savedName);
      if (savedAvatar) setSelectedAvatar(savedAvatar);
    } catch {
      // Ignore sessionStorage exceptions
    }
  }, [initialPin]);

  // Dual-Channel Sync: SSE + Fallback Polling (crucial for mobile network reliability)
  useEffect(() => {
    if (!pin || !currentPlayer) return;

    let eventSource: EventSource | null = null;
    let pollInterval: number | null = null;
    let isSubscribed = true;

    // Helper to process updated room data
    const handleRoomData = (roomData: GameRoom) => {
      if (!isSubscribed) return;
      setCurrentRoom(roomData);
      if (currentPlayer && roomData.players[currentPlayer.id]) {
        setCurrentPlayer(roomData.players[currentPlayer.id]);
      }
    };

    // 1. Setup Server-Sent Events (SSE)
    try {
      eventSource = new EventSource(`/api/rooms/${pin}/events`);
      eventSource.onmessage = (event) => {
        try {
          const roomData: GameRoom = JSON.parse(event.data);
          handleRoomData(roomData);
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };
      eventSource.onerror = () => {
        // SSE dropped or sleeping, polling will seamlessly cover it
      };
    } catch (err) {
      console.warn('SSE not supported or blocked, falling back to polling:', err);
    }

    // 2. Secondary Polling Fallback (runs every 1.5s to ensure phone never freezes)
    pollInterval = window.setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const res = await fetch(`/api/rooms/${pin}`);
        if (res.ok) {
          const roomData: GameRoom = await res.json();
          handleRoomData(roomData);
        }
      } catch {
        // Ignore network glitches
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pin, currentPlayer?.id]);

  // Handle countdown timer on phone when question starts
  useEffect(() => {
    if (currentRoom?.status === 'question') {
      setHasAnsweredCurrentQ(false);
      setSelectedAnswerIndex(null);
      setLastResult(null);
      questionStartTimeRef.current = Date.now();

      const timeLimit = currentRoom.currentQuestionMeta?.timeLimit || 20;
      setPhoneTimeRemaining(timeLimit);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setPhoneTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          const next = prev - 1;
          sound.playTick(next <= 5);
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentRoom?.status, currentRoom?.currentQuestionIndex]);

  // Handle postMessage from embedded Google AI Studio mini-game (HTML embed)
  useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      if (e.data && e.data.type === 'game_complete') {
        const score = e.data.score || 0;
        sound.playCorrect();
        setHasAnsweredCurrentQ(true);
        try {
          await fetch(`/api/rooms/${pin}/external-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: currentPlayer?.id,
              score,
              details: e.data.details,
            }),
          });
        } catch (err) {
          console.error('Submit external result error:', err);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pin, currentPlayer?.id]);

  // Submit join form
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().replace(/\D/g, '');
    const cleanNickname = nickname.trim();

    if (!cleanPin || cleanPin.length < 4) {
      setErrorMsg('Vui lòng nhập đúng mã PIN phòng (6 chữ số)');
      return;
    }
    if (!cleanNickname) {
      setErrorMsg('Vui lòng nhập họ tên hoặc biệt danh học viên');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const savedPlayerId = sessionStorage.getItem('bidv_player_id') || undefined;
      let res = await fetch(`/api/rooms/${encodeURIComponent(cleanPin)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: cleanNickname,
          avatar: selectedAvatar,
          existingPlayerId: savedPlayerId,
        }),
      });
      let data = await res.json();

      // If 404, wait 800ms and retry once (handles room sync / race conditions)
      if (!data.success && res.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        res = await fetch(`/api/rooms/${encodeURIComponent(cleanPin)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nickname: cleanNickname,
            avatar: selectedAvatar,
            existingPlayerId: savedPlayerId,
          }),
        });
        data = await res.json();
      }

      if (data.success && data.player && data.room) {
        setCurrentPlayer(data.player);
        setCurrentRoom(data.room);
        setPin(cleanPin);

        // Save session for seamless reconnects on mobile
        try {
          sessionStorage.setItem('bidv_player_pin', cleanPin);
          sessionStorage.setItem('bidv_player_id', data.player.id);
          sessionStorage.setItem('bidv_player_name', cleanNickname);
          sessionStorage.setItem('bidv_player_avatar', selectedAvatar);
        } catch {}
      } else {
        setErrorMsg(data.error || 'Không thể tham gia phòng. Vui lòng kiểm tra lại mã PIN với Giảng viên.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ. Vui lòng kiểm tra kết nối mạng 4G/WiFi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Leave room / Switch account
  const handleLeaveRoom = () => {
    try {
      sessionStorage.removeItem('bidv_player_pin');
      sessionStorage.removeItem('bidv_player_id');
    } catch {}
    setCurrentPlayer(null);
    setCurrentRoom(null);
    setHasAnsweredCurrentQ(false);
    setLastResult(null);
    if (onExit) onExit();
  };

  // Submit answer for standard questions
  const handleSubmitAnswer = async (payload: {
    selectedOptionIndex?: number;
    selectedOptionId?: string;
  }) => {
    if (!currentPlayer || !pin || hasAnsweredCurrentQ) return;
    setHasAnsweredCurrentQ(true);
    if (typeof payload.selectedOptionIndex === 'number') {
      setSelectedAnswerIndex(payload.selectedOptionIndex);
    }

    const elapsedMs = Date.now() - questionStartTimeRef.current;

    try {
      const res = await fetch(`/api/rooms/${pin}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          timeElapsedMs: elapsedMs,
          ...payload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.isCorrect) {
          sound.playCorrect();
          if (data.streak > 1) {
            setTimeout(() => sound.playStreak(), 400);
          }
        } else {
          sound.playWrong();
        }
        setLastResult({
          isCorrect: data.isCorrect,
          pointsEarned: data.pointsEarned,
          streak: data.streak,
          rank: data.rank,
        });
      }
    } catch (err) {
      console.error('Answer submit error:', err);
    }
  };

  // 1. JOIN SCREEN (Optimized for Mobile Keyboards & Touch)
  if (!currentPlayer) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-b from-[#004D2C] via-[#005a33] to-[#008049]">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border-4 border-[#FFCC00]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#008049] rounded-2xl mx-auto flex items-center justify-center border-2 border-[#FFCC00] shadow-md mb-3">
              <span className="text-3xl text-[#FFCC00] font-black">★</span>
            </div>
            <h1 className="text-2xl font-black text-[#004D2C]">BIDV EduPlay</h1>
            <p className="text-xs text-gray-500 font-bold mt-1">
              Phòng Thi Đấu Trực Tuyến Trên Điện Thoại
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 text-xs font-bold p-3.5 rounded-2xl mb-4 border border-red-200 text-center animate-fade-in">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            {/* PIN Input */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider">
                MÃ PIN PHÒNG (6 CHỮ SỐ)
              </label>
              <input
                id="join-pin-input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ví dụ: 582194"
                className="w-full text-center text-3xl font-black tracking-widest px-4 py-3.5 rounded-2xl border-2 border-gray-300 focus:border-[#008049] focus:ring-4 focus:ring-emerald-100 outline-none text-[#004D2C] bg-gray-50"
                required
              />

              {previewRoomTitle && (
                <div className="mt-2 text-center text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 py-1.5 px-3 rounded-xl animate-fade-in flex items-center justify-center gap-1.5">
                  <span className="text-emerald-600 text-sm">✔</span>
                  <span>Phòng hợp lệ: <strong>{previewRoomTitle}</strong></span>
                </div>
              )}

              {!previewRoomTitle && isCheckingRoom && (
                <div className="mt-2 text-center text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 py-1.5 px-3 rounded-xl animate-pulse">
                  Đang kiểm tra phòng...
                </div>
              )}
            </div>

            {/* Nickname Input */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider">
                HỌ TÊN / BIỆT DANH HỌC VIÊN
              </label>
              <input
                id="join-nickname-input"
                type="text"
                maxLength={24}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="VD: Nguyễn Văn A (CN Hà Nội)"
                className="w-full text-center font-bold text-base px-4 py-3.5 rounded-2xl border-2 border-gray-300 focus:border-[#008049] focus:ring-4 focus:ring-emerald-100 outline-none bg-gray-50"
                required
              />
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider text-center">
                CHỌN AVATAR NHẬN DIỆN
              </label>
              <div className="grid grid-cols-6 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(emoji)}
                    className={`text-2xl p-1.5 rounded-xl transition-all cursor-pointer ${
                      selectedAvatar === emoji
                        ? 'bg-[#FFCC00] scale-110 shadow ring-2 ring-[#008049]'
                        : 'hover:bg-gray-200'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="join-room-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-[#008049] hover:bg-[#00683a] text-white font-black text-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{isLoading ? 'Đang vào phòng...' : 'VÀO PHÒNG CHƠI'}</span>
              <ArrowRight className="w-5 h-5 text-[#FFCC00]" />
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
            <span className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              Tự động kết nối trực tuyến theo thời gian thực
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. LOBBY WAITING SCREEN
  if (currentRoom?.status === 'lobby') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-[#004D2C] via-[#005a33] to-[#008049] text-white text-center">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-[#FFCC00] mx-auto flex items-center justify-center text-5xl shadow-xl mb-3 animate-bounce">
            {currentPlayer.avatar}
          </div>
          <h2 className="text-2xl font-black text-white">{currentPlayer.nickname}</h2>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-black bg-[#FFCC00] text-[#004D2C]">
            <span>PHÒNG PIN: {pin}</span>
          </div>

          <div className="my-6 py-4 bg-black/20 rounded-2xl border border-white/10 text-emerald-100 text-xs sm:text-sm">
            <p className="font-bold text-base text-[#FFCC00] animate-pulse">Bạn đã vào phòng!</p>
            <p className="text-white/80 mt-1">
              Hãy nhìn lên màn hình Giảng viên để theo dõi khi bắt đầu câu hỏi đầu tiên.
            </p>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="flex items-center justify-center gap-1.5 text-xs text-white/70 hover:text-white mx-auto py-1 px-3 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Rời phòng / Đổi tên</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. QUESTION SCREEN - MOBILE-FIRST TOUCH INTERACTION
  if (currentRoom?.status === 'question') {
    const meta = currentRoom.currentQuestionMeta;
    const isTrueFalse = meta?.type === 'true_false';
    const isExternalGame = meta?.type === 'external_embed';
    const options = meta?.options || [];

    // If player already answered: show waiting feedback banner
    if (hasAnsweredCurrentQ && lastResult) {
      return (
        <div
          className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 sm:p-6 text-white text-center ${
            lastResult.isCorrect ? 'bg-[#008049]' : 'bg-[#E03E36]'
          }`}
        >
          <div className="max-w-sm w-full bg-black/25 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl animate-fade-in">
            {lastResult.isCorrect ? (
              <>
                <CheckCircle2 className="w-20 h-20 text-[#FFCC00] mx-auto mb-3 animate-pulse" />
                <h2 className="text-3xl font-black">CHÍNH XÁC!</h2>
                <div className="text-4xl font-black text-[#FFCC00] my-3">
                  +{lastResult.pointsEarned.toLocaleString()}
                </div>
                {lastResult.streak > 1 && (
                  <div className="inline-flex items-center gap-1 bg-[#FFCC00] text-[#004D2C] px-3.5 py-1.5 rounded-full text-xs font-black mb-2 shadow">
                    <Flame className="w-4 h-4 fill-current text-orange-600" />
                    <span>Chuỗi {lastResult.streak} câu đúng</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 text-white mx-auto mb-3 opacity-90" />
                <h2 className="text-3xl font-black">CHƯA ĐÚNG!</h2>
                <p className="text-sm text-white/80 mt-2">Cố gắng ở câu tiếp theo nhé!</p>
              </>
            )}

            <div className="mt-6 pt-4 border-t border-white/20 text-xs font-bold text-white/90">
              Đang đợi Giảng viên tổng kết kết quả...
            </div>
          </div>
        </div>
      );
    }

    // SPECIAL: External Mini-Game Round (Google AI Studio HTML Sandbox)
    if (isExternalGame) {
      return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#004D2C] p-3 flex flex-col">
          {/* Header */}
          <div className="bg-white/10 backdrop-blur-md text-white p-3 rounded-2xl mb-2 flex items-center justify-between text-xs">
            <span className="font-bold text-[#FFCC00]">VÒNG ĐẶC BIỆT: {meta?.title || 'Mini-Game'}</span>
            <span className="bg-[#FFCC00] text-[#004D2C] px-2 py-0.5 rounded-full font-black">
              Điểm: {currentPlayer.score.toLocaleString()}
            </span>
          </div>

          <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-xl flex flex-col">
            <iframe
              srcDoc={meta?.externalGameConfig?.embedHtml || ''}
              title="Mini Game Phone Container"
              className="w-full flex-1 border-none min-h-[460px]"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      );
    }

    // STANDARD KAHOOT MOBILE INTERFACE
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7F6] flex flex-col justify-between p-3 sm:p-4">
        {/* Top Player Info & Timer Bar */}
        <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-gray-200 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentPlayer.avatar}</span>
            <div>
              <span className="text-xs font-black text-gray-900 block truncate max-w-[110px]">
                {currentPlayer.nickname}
              </span>
              <span className="text-[10px] text-gray-400 font-bold">
                Câu {currentRoom.currentQuestionIndex + 1}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer countdown circle */}
            <div className="flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              <Clock className="w-3.5 h-3.5 text-[#008049]" />
              <span
                className={`font-mono text-xs font-black ${
                  phoneTimeRemaining <= 5 ? 'text-red-600 animate-pulse' : 'text-[#008049]'
                }`}
              >
                {phoneTimeRemaining}s
              </span>
            </div>

            {/* Score */}
            <div className="text-right">
              <span className="text-xs font-black text-[#008049]">
                {currentPlayer.score.toLocaleString()} đ
              </span>
            </div>
          </div>
        </div>

        {/* Question Title on Phone (Allows student to read comfortably) */}
        {meta?.title && (
          <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-200 mb-3 text-center">
            <h3 className="font-extrabold text-xs sm:text-sm text-[#004D2C] leading-snug">
              {meta.title}
            </h3>
            {meta.mediaUrl && (
              <img
                src={meta.mediaUrl}
                alt="Question"
                className="max-h-24 mx-auto mt-2 rounded-lg object-contain"
              />
            )}
          </div>
        )}

        {/* BUTTONS: TRUE / FALSE (2 Large Buttons) */}
        {isTrueFalse ? (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
            {/* ĐÚNG Button */}
            <button
              id="player-tf-true-btn"
              onClick={() =>
                handleSubmitAnswer({
                  selectedOptionIndex: 0,
                  selectedOptionId: options[0]?.id || 'tf_1',
                })
              }
              className="bg-[#008049] hover:bg-[#00683a] active:scale-95 rounded-3xl p-6 flex flex-col items-center justify-center text-white shadow-lg transition-transform cursor-pointer border-b-4 border-[#005a33] touch-manipulation"
            >
              <span className="text-4xl sm:text-5xl font-black mb-1">✔</span>
              <span className="text-xl sm:text-2xl font-black">
                {options[0]?.text || 'ĐÚNG'}
              </span>
            </button>

            {/* SAI Button */}
            <button
              id="player-tf-false-btn"
              onClick={() =>
                handleSubmitAnswer({
                  selectedOptionIndex: 1,
                  selectedOptionId: options[1]?.id || 'tf_2',
                })
              }
              className="bg-[#E03E36] hover:bg-[#c02820] active:scale-95 rounded-3xl p-6 flex flex-col items-center justify-center text-white shadow-lg transition-transform cursor-pointer border-b-4 border-[#B82B24] touch-manipulation"
            >
              <span className="text-4xl sm:text-5xl font-black mb-1">✖</span>
              <span className="text-xl sm:text-2xl font-black">
                {options[1]?.text || 'SAI'}
              </span>
            </button>
          </div>
        ) : (
          /* BUTTONS: MULTIPLE CHOICE (4 Kahoot Buttons with option texts) */
          <div className="flex-1 grid grid-cols-2 gap-3 pb-2">
            {(options.length > 0
              ? options
              : [
                  { id: 'opt_1', text: 'Phương án A' },
                  { id: 'opt_2', text: 'Phương án B' },
                  { id: 'opt_3', text: 'Phương án C' },
                  { id: 'opt_4', text: 'Phương án D' },
                ]
            ).map((opt, idx) => {
              const style = KAHOOT_STYLES[idx % KAHOOT_STYLES.length];
              return (
                <button
                  key={opt.id || idx}
                  id={`player-opt-${idx}-btn`}
                  onClick={() =>
                    handleSubmitAnswer({
                      selectedOptionIndex: idx,
                      selectedOptionId: opt.id,
                    })
                  }
                  className={`${style.bg} rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-center text-white shadow-lg border-b-4 ${style.border} transition-transform active:scale-95 touch-manipulation cursor-pointer text-center`}
                >
                  <span className="text-3xl sm:text-4xl font-black drop-shadow-sm select-none mb-1">
                    {style.shape}
                  </span>
                  <span className="text-xs sm:text-sm font-bold line-clamp-2 leading-tight px-1 opacity-95">
                    {opt.text}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] font-bold text-gray-500 py-1">
          Chạm vào ô bạn chọn để gửi câu trả lời
        </p>
      </div>
    );
  }

  // 4. RESULTS & LEADERBOARD WAIT STATE
  if (currentRoom?.status === 'question_result' || currentRoom?.status === 'leaderboard') {
    const sorted = Object.values(currentRoom.players || {}).sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === currentPlayer.id) + 1;

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#004D2C] to-[#008049] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <span className="text-xs font-bold text-[#FFCC00] uppercase tracking-widest block mb-2">
            VỊ TRÍ CỦA BẠN
          </span>
          <div className="text-6xl font-black text-[#FFCC00] mb-2">#{myRank || 1}</div>
          <p className="text-sm font-bold text-white mb-4">
            Tổng điểm: <span className="text-[#FFCC00] text-lg font-black">{currentPlayer.score.toLocaleString()}</span>
          </p>
          <div className="p-4 bg-black/20 rounded-2xl text-xs text-emerald-100">
            Hãy nhìn lên màn hình lớn để xem phân tích đáp án và bảng xếp hạng
          </div>
        </div>
      </div>
    );
  }

  // 5. FINISHED CELEBRATION (Podium)
  if (currentRoom?.status === 'finished') {
    const sorted = Object.values(currentRoom.players || {}).sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === currentPlayer.id) + 1;

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#004D2C] to-[#008049] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <Trophy className="w-16 h-16 text-[#FFCC00] mx-auto mb-3 animate-bounce" />
          <h2 className="text-2xl font-black">HOÀN THÀNH BUỔI HỌC!</h2>
          <div className="text-5xl font-black text-[#FFCC00] my-3">#{myRank}</div>
          <p className="text-base font-bold mb-4">
            Tổng điểm: <span className="text-[#FFCC00]">{currentPlayer.score.toLocaleString()}</span>
          </p>
          <div className="p-4 bg-black/20 rounded-2xl text-xs text-emerald-100 leading-relaxed mb-4">
            Kết quả của bạn đã được ghi nhận tự động vào sổ điểm LMS BIDV. Chúc mừng bạn!
          </div>

          <button
            onClick={handleLeaveRoom}
            className="w-full py-3 bg-[#FFCC00] text-[#004D2C] font-black rounded-xl text-sm shadow hover:bg-yellow-300 transition-colors cursor-pointer"
          >
            Chơi phiên khác
          </button>
        </div>
      </div>
    );
  }

  return null;
};
