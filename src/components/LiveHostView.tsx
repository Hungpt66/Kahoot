import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  SkipForward,
  Trophy,
  Award,
  BarChart,
  Copy,
  Check,
  Sparkles,
  Bot,
  Save,
  Download,
  RotateCcw,
  Edit3,
} from 'lucide-react';
import { GameRoom, Quiz, RoomStatus, LMSReport } from '../types';
import { sound } from '../utils/audio';

interface LiveHostViewProps {
  quizzes: Quiz[];
  activeRoom: GameRoom | null;
  onRoomCreated: (room: GameRoom) => void;
  onRoomUpdated: (room: GameRoom) => void;
  onOpenPlayerWithPin?: (pin: string) => void;
  onEditQuiz?: (quizId: string) => void;
}

export const LiveHostView: React.FC<LiveHostViewProps> = ({
  quizzes,
  activeRoom,
  onRoomCreated,
  onRoomUpdated,
  onOpenPlayerWithPin,
  onEditQuiz,
}) => {
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id || '');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [serverAppUrl, setServerAppUrl] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSimulatingBots, setIsSimulatingBots] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Local timer state for Host projection
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number>(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Selected quiz object
  const currentQuiz = quizzes.find((q) => q.id === (activeRoom ? activeRoom.quizId : selectedQuizId)) || quizzes[0];
  const currentQuestion = currentQuiz?.questions[activeRoom?.currentQuestionIndex || 0];

  // Fetch public server app info on mount
  useEffect(() => {
    fetch('/api/app-info')
      .then((res) => res.json())
      .then((data) => {
        if (data.detectedUrl) setServerAppUrl(data.detectedUrl);
        else if (data.appUrl) setServerAppUrl(data.appUrl);
      })
      .catch(() => {});
  }, []);

  // Compute effective base URL: always use current browser origin first to guarantee host and player connect to the SAME server
  const currentOrigin = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
    ? window.location.origin
    : serverAppUrl;
  const effectiveBaseUrl = customUrl.trim() || currentOrigin || serverAppUrl || '';
  const joinUrl = activeRoom?.pin && effectiveBaseUrl ? `${effectiveBaseUrl.replace(/\/$/, '')}/?pin=${activeRoom.pin}` : '';

  // Continuous sync of active room from Host to server (guarantees server never loses room)
  useEffect(() => {
    if (!activeRoom?.pin) return;

    const syncRoom = () => {
      fetch('/api/rooms/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: activeRoom }),
      }).catch(() => {});
    };

    // Immediate sync
    syncRoom();

    // Heartbeat sync every 4 seconds
    const interval = window.setInterval(syncRoom, 4000);
    return () => clearInterval(interval);
  }, [activeRoom?.pin, activeRoom?.status, activeRoom?.currentQuestionIndex]);

  // Generate QR code whenever room PIN or effectiveBaseUrl changes
  useEffect(() => {
    if (activeRoom?.pin && effectiveBaseUrl) {
      const url = `${effectiveBaseUrl.replace(/\/$/, '')}/?pin=${activeRoom.pin}`;
      QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: '#004D2C', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      })
        .then((dataUrl) => setQrCodeDataUrl(dataUrl))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [activeRoom?.pin, effectiveBaseUrl]);

  // Audio & Timer controller for Question state
  useEffect(() => {
    if (!activeRoom) return;

    if (activeRoom.status === 'lobby') {
      sound.startLobbyMusic();
    } else {
      sound.stopLobbyMusic();
    }

    if (activeRoom.status === 'question' && currentQuestion) {
      setLocalTimeRemaining(currentQuestion.timeLimit);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      timerIntervalRef.current = window.setInterval(() => {
        setLocalTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            // Auto transition to result when time is up
            handleUpdateStatus('question_result');
            return 0;
          }
          const next = prev - 1;
          sound.playTick(next <= 5);
          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    if (activeRoom.status === 'finished') {
      sound.playPodiumFanfare();
      // Trigger confetti
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#008049', '#FFCC00', '#004D2C', '#FFFFFF'],
      });
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      sound.stopLobbyMusic();
    };
  }, [activeRoom?.status, activeRoom?.currentQuestionIndex]);

  // Handle creating room
  const handleCreateRoom = async () => {
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: selectedQuizId }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        onRoomCreated(data.room);
      }
    } catch (err) {
      console.error('Error creating room:', err);
    }
  };

  // Handle updating room status
  const handleUpdateStatus = async (status: RoomStatus, nextQuestionIndex?: number) => {
    if (!activeRoom) return;
    try {
      const res = await fetch(`/api/rooms/${activeRoom.pin}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, currentQuestionIndex: nextQuestionIndex }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        onRoomUpdated(data.room);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Simulate bot students
  const handleSimulateBots = async (count: number = 5) => {
    if (!activeRoom) return;
    setIsSimulatingBots(true);
    try {
      await fetch(`/api/rooms/${activeRoom.pin}/simulate-bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
    } catch (err) {
      console.error('Simulate bot error:', err);
    } finally {
      setIsSimulatingBots(false);
    }
  };

  const handleCopyLink = () => {
    if (!activeRoom) return;
    const url = joinUrl || `${window.location.origin}/?pin=${activeRoom.pin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Save report to LMS
  const handleSaveToLMS = async () => {
    if (!activeRoom || !currentQuiz) return;
    const sortedPlayers = Object.values(activeRoom.players).sort((a, b) => b.score - a.score);
    const totalScore = sortedPlayers.reduce((acc, p) => acc + p.score, 0);
    const avgScore = sortedPlayers.length > 0 ? Math.round(totalScore / sortedPlayers.length) : 0;

    const questionStats = currentQuiz.questions.map((q, idx) => {
      const qAnswers = activeRoom.answers.filter((a) => a.questionIndex === idx);
      const correct = qAnswers.filter((a) => a.isCorrect).length;
      return {
        questionIndex: idx + 1,
        title: q.title,
        correctCount: correct,
        totalAnswers: qAnswers.length,
        accuracyPercent: qAnswers.length > 0 ? Math.round((correct / qAnswers.length) * 100) : 0,
      };
    });

    const detailedPlayerResults = sortedPlayers.map((p) => {
      const pAnswers = activeRoom.answers.filter((a) => a.playerId === p.id);
      const correctCount = pAnswers.filter((a) => a.isCorrect).length;
      const totalTime = pAnswers.reduce((acc, a) => acc + a.timeMs, 0);
      return {
        nickname: p.nickname,
        score: p.score,
        correctAnswersCount: correctCount,
        totalQuestions: currentQuiz.questions.length,
        averageResponseTimeMs: pAnswers.length > 0 ? Math.round(totalTime / pAnswers.length) : 0,
      };
    });

    const report: LMSReport = {
      id: 'lms_' + Date.now(),
      roomPin: activeRoom.pin,
      quizTitle: currentQuiz.title,
      completedAt: new Date().toISOString(),
      totalPlayers: sortedPlayers.length,
      averageScore: avgScore,
      topPlayers: sortedPlayers.slice(0, 5).map((p, idx) => ({
        rank: idx + 1,
        nickname: p.nickname,
        score: p.score,
        avatar: p.avatar,
      })),
      questionStats,
      detailedPlayerResults,
    };

    try {
      const res = await fetch('/api/lms/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving LMS report:', err);
    }
  };

  // Export CSV report
  const handleExportCSV = () => {
    if (!activeRoom || !currentQuiz) return;
    const sortedPlayers = Object.values(activeRoom.players).sort((a, b) => b.score - a.score);
    let csv = 'Hang,Ten Hoc Vien,Diem So,So Cau Dung,Tong So Cau\n';
    sortedPlayers.forEach((p, idx) => {
      const pAnswers = activeRoom.answers.filter((a) => a.playerId === p.id);
      const correct = pAnswers.filter((a) => a.isCorrect).length;
      csv += `${idx + 1},"${p.nickname}",${p.score},${correct},${currentQuiz.questions.length}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ket_qua_LMS_BIDV_${activeRoom.pin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate answer counts for current question
  const currentQAnswers = activeRoom?.answers.filter(
    (a) => a.questionIndex === activeRoom.currentQuestionIndex
  ) || [];
  const totalPlayersCount = Object.keys(activeRoom?.players || {}).length;
  const answeredPercent = totalPlayersCount > 0
    ? Math.round((currentQAnswers.length / totalPlayersCount) * 100)
    : 0;

  // Option styling matching BIDV-Kahoot palette
  const OPTION_STYLES = [
    { bg: 'bg-[#E03E36]', text: 'text-white', border: 'border-[#B82B24]', shape: '▲' },
    { bg: 'bg-[#FFCC00]', text: 'text-[#004D2C]', border: 'border-[#CCA300]', shape: '◆' },
    { bg: 'bg-[#008049]', text: 'text-white', border: 'border-[#005a33]', shape: '●' },
    { bg: 'bg-[#0A66C2]', text: 'text-white', border: 'border-[#084e96]', shape: '■' },
  ];

  // 1. NO ACTIVE ROOM - SELECT QUIZ & START
  if (!activeRoom) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-900/10 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#008049]">
                  Giảng Viên / Host Live
                </span>
                <span className="text-xs text-gray-500">Màn hình trình chiếu chính</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#004D2C]">
                Khởi Tạo Buổi Tương Tác Trực Tiếp
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Chiếu mã PIN phòng và QR cho học viên quét tham gia bằng điện thoại
              </p>
            </div>
            <button
              id="start-session-btn"
              onClick={handleCreateRoom}
              className="flex items-center justify-center gap-2 bg-[#008049] hover:bg-[#00683a] text-white px-6 py-3.5 rounded-xl font-bold text-base shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current text-[#FFCC00]" />
              <span>Khởi Tạo Phiên Chơi</span>
            </button>
          </div>

          {/* Quizzes list */}
          <h2 className="text-lg font-bold text-[#004D2C] mb-4 flex items-center gap-2">
            <span>Chọn bộ đề giảng dạy:</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
              {quizzes.length} bộ
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map((quiz) => {
              const isSelected = selectedQuizId === quiz.id;
              const hasExternalGame = quiz.questions.some((q) => q.type === 'external_embed');

              return (
                <div
                  key={quiz.id}
                  onClick={() => setSelectedQuizId(quiz.id)}
                  className={`relative rounded-xl p-5 border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#008049] bg-emerald-50/50 shadow-md ring-2 ring-[#008049]/20'
                      : 'border-gray-200 hover:border-emerald-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-[#004D2C] text-[#FFCC00]">
                          {quiz.category}
                        </span>
                        {hasExternalGame && (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 text-amber-900 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Nhúng Mini-Game AI Studio
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-gray-900 line-clamp-1">{quiz.title}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{quiz.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#008049] text-white flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <span>{quiz.questions.length} câu hỏi</span>
                      <span>•</span>
                      <span className="font-medium text-emerald-800">
                        ~
                        {Math.round(
                          quiz.questions.reduce((acc, q) => acc + q.timeLimit, 0) / 60
                        )}{' '}
                        phút
                      </span>
                    </div>

                    {onEditQuiz && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditQuiz(quiz.id);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-all shadow-sm"
                        title="Chỉnh sửa câu hỏi trong bộ đề"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Sửa đề</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 2. LOBBY STATE
  if (activeRoom.status === 'lobby') {
    const playersList = Object.values(activeRoom.players);

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#004D2C] via-[#005a33] to-[#008049] text-white p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
        {/* Top bar with PIN & join instructions */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl max-w-5xl mx-auto w-full">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Join instructions */}
            <div className="text-center md:text-left">
              <span className="text-xs font-bold tracking-wider text-[#FFCC00] uppercase">
                Tham gia trực tiếp trên điện thoại
              </span>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                Quét mã QR hoặc truy cập nhập mã PIN
              </h2>

              {/* Direct Join Link & Controls */}
              <div className="mt-3 text-xs text-emerald-100 flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-emerald-200">Đường dẫn tham gia:</span>
                <code className="bg-black/30 px-2.5 py-1 rounded-lg text-[#FFCC00] font-mono text-xs select-all break-all border border-white/10">
                  {joinUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/?pin=${activeRoom.pin}`}
                </code>
              </div>

              {showCustomUrlInput && (
                <div className="mt-2 p-2 bg-black/30 rounded-xl border border-white/10 max-w-md">
                  <label className="block text-[11px] text-emerald-200 font-bold mb-1">
                    Tùy chỉnh Domain / Địa chỉ máy chủ (mặc định theo trình duyệt hiện tại):
                  </label>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder={currentOrigin || 'https://...'}
                    className="w-full text-xs font-mono px-3 py-1.5 rounded-lg bg-black/40 text-white border border-white/20 outline-none"
                  />
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 flex-wrap justify-center md:justify-start">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#FFCC00]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Đã sao chép link!' : 'Sao chép link tham gia'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                  className="text-[11px] text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {showCustomUrlInput ? '✕ Đóng đổi domain' : '⚙ Đổi domain/IP'}
                </button>
                {onOpenPlayerWithPin && (
                  <button
                    type="button"
                    onClick={() => onOpenPlayerWithPin(activeRoom.pin)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCC00] text-[#004D2C] text-xs font-bold shadow transition-all hover:bg-yellow-300 cursor-pointer"
                  >
                    <span>Mở tab Học Viên (Test cùng máy)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Middle: Big 6-digit PIN */}
            <div className="bg-white text-[#004D2C] px-6 py-4 rounded-2xl shadow-2xl border-4 border-[#FFCC00] text-center">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider">MÃ PIN PHÒNG</span>
              <div className="text-4xl sm:text-5xl font-black tracking-widest text-[#008049]">
                {activeRoom.pin}
              </div>
            </div>

            {/* Right: QR Code for mobile scan */}
            {qrCodeDataUrl && (
              <div className="bg-white p-2.5 rounded-xl shadow-lg border-2 border-[#FFCC00] shrink-0 text-center">
                <img src={qrCodeDataUrl} alt="QR Code" className="w-28 h-28 mx-auto" />
                <span className="text-[10px] font-bold text-[#004D2C] block mt-1">Quét bằng Camera</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Realtime Student Lobby */}
        <div className="max-w-5xl mx-auto w-full my-6 flex-1 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FFCC00]" />
              <span className="text-lg font-bold">
                Học viên đã vào phòng: <span className="text-[#FFCC00] text-xl font-black">{playersList.length}</span>
              </span>
            </div>

            {/* Simulate bots button */}
            <button
              onClick={() => handleSimulateBots(5)}
              disabled={isSimulatingBots}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/20 transition-all cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-[#FFCC00]" />
              <span>{isSimulatingBots ? 'Đang thêm...' : '+5 Học viên giả lập (Demo)'}</span>
            </button>
          </div>

          {/* Avatars Grid */}
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-6 border border-white/10 min-h-[220px] flex items-center justify-center">
            {playersList.length === 0 ? (
              <div className="text-center text-emerald-100/70 animate-pulse">
                <Users className="w-12 h-12 mx-auto mb-2 text-[#FFCC00]" />
                <p className="font-semibold text-base">Đang chờ học viên nhập mã PIN hoặc quét mã QR...</p>
                <p className="text-xs text-white/60 mt-1">
                  (Bấm nút "+5 Học viên giả lập" để trải nghiệm ngay lập tức)
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full max-h-72 overflow-y-auto pr-1">
                {playersList.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/15 hover:bg-white/25 rounded-xl p-2.5 flex items-center gap-2 border border-white/20 transition-all transform hover:scale-105"
                  >
                    <span className="text-2xl select-none">{player.avatar}</span>
                    <span className="text-xs font-bold truncate text-white">{player.nickname}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar with Start Button */}
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-white/80">
            <span>Bộ đề: </span>
            <span className="font-bold text-[#FFCC00]">{currentQuiz.title}</span>
            <span className="ml-2">({currentQuiz.questions.length} câu)</span>
          </div>

          <button
            id="host-start-game-btn"
            onClick={() => handleUpdateStatus('question', 0)}
            disabled={playersList.length === 0}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-lg shadow-xl transition-all cursor-pointer ${
              playersList.length > 0
                ? 'bg-[#FFCC00] text-[#004D2C] hover:bg-yellow-300 hover:scale-105 active:scale-95'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
            }`}
          >
            <Play className="w-6 h-6 fill-current" />
            <span>BẮT ĐẦU BUỔI CHƠI</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. QUESTION SCREEN
  if (activeRoom.status === 'question' && currentQuestion) {
    // If it's an external embed round
    if (currentQuestion.type === 'external_embed') {
      return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7F6] p-4 md:p-6 flex flex-col justify-between">
          <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
            {/* Top header */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#004D2C] text-[#FFCC00]">
                  Vòng Chơi Đặc Biệt (Google AI Studio)
                </span>
                <h2 className="text-xl font-black text-[#004D2C] mt-1">{currentQuestion.title}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <span className="text-xs text-gray-500 font-semibold block">ĐÃ HOÀN THÀNH</span>
                  <span className="text-2xl font-black text-[#008049]">
                    {currentQAnswers.length}/{totalPlayersCount}
                  </span>
                </div>
                <button
                  onClick={() => handleUpdateStatus('question_result')}
                  className="bg-[#008049] hover:bg-[#00683a] text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>Tổng kết vòng</span>
                </button>
              </div>
            </div>

            {/* Embed container */}
            <div className="flex-1 bg-white rounded-2xl shadow-md border-2 border-[#008049]/20 overflow-hidden flex flex-col">
              <div className="bg-[#004D2C] text-[#FFCC00] px-4 py-2 text-xs font-bold flex items-center justify-between">
                <span>Khung chạy an toàn (Sandbox Container) - Google AI Studio Mini-Game</span>
                <span className="text-white/80 font-normal">Đồng bộ điểm qua postMessage API</span>
              </div>
              <iframe
                srcDoc={currentQuestion.externalGameConfig?.embedHtml || ''}
                title="External Mini-Game"
                className="w-full flex-1 min-h-[460px] border-none"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      );
    }

    // Standard Kahoot Question View on Host Big Screen
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7F6] p-4 md:p-6 flex flex-col justify-between">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col justify-between">
          {/* Top Question Header */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-900/10 text-center relative">
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-[#004D2C] text-[#FFCC00]">
                Câu hỏi {activeRoom.currentQuestionIndex + 1} / {currentQuiz.questions.length}
              </span>
              <button
                onClick={() => handleUpdateStatus('question_result')}
                className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#008049] px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#008049] transition-all cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Bỏ qua / Kết thúc câu</span>
              </button>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#004D2C] leading-snug max-w-4xl mx-auto">
              {currentQuestion.title}
            </h2>
            {currentQuestion.description && (
              <p className="text-sm text-gray-500 mt-2 font-medium">{currentQuestion.description}</p>
            )}
            {currentQuestion.mediaUrl && (
              <img
                src={currentQuestion.mediaUrl}
                alt="Question Media"
                className="max-h-48 mx-auto mt-3 rounded-xl object-contain border border-gray-100"
              />
            )}
          </div>

          {/* Middle: Timer & Answers submitted counter */}
          <div className="flex items-center justify-between my-6 px-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-black text-2xl sm:text-3xl border-4 transition-all shadow-md ${
                  localTimeRemaining <= 5
                    ? 'bg-red-500 border-red-600 text-white animate-pulse'
                    : 'bg-[#004D2C] border-[#FFCC00] text-[#FFCC00]'
                }`}
              >
                {localTimeRemaining}
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">
                Giây
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-gray-500 uppercase block tracking-wider">
                Đã trả lời
              </span>
              <div className="text-3xl sm:text-4xl font-black text-[#008049]">
                {currentQAnswers.length} <span className="text-lg font-bold text-gray-400">/ {totalPlayersCount}</span>
              </div>
              <div className="w-36 sm:w-48 bg-gray-200 rounded-full h-2 mt-1.5 overflow-hidden">
                <div
                  className="bg-[#008049] h-full rounded-full transition-all duration-300"
                  style={{ width: `${answeredPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bottom: 4 Kahoot Options Grid or True/False */}
          {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt, idx) => {
                const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                return (
                  <div
                    key={opt.id}
                    className={`${style.bg} ${style.text} p-5 sm:p-6 rounded-2xl shadow-md border-b-4 ${style.border} flex items-center gap-4 transition-transform`}
                  >
                    <span className="text-2xl sm:text-3xl font-black opacity-90">{style.shape}</span>
                    <span className="text-base sm:text-lg md:text-xl font-bold leading-tight">{opt.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'true_false' && currentQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt, idx) => {
                const isTrue = idx === 0;
                return (
                  <div
                    key={opt.id}
                    className={`${
                      isTrue ? 'bg-[#008049] text-white border-[#005a33]' : 'bg-[#E03E36] text-white border-[#B82B24]'
                    } p-6 sm:p-8 rounded-2xl shadow-md border-b-4 flex items-center justify-center gap-4`}
                  >
                    <span className="text-3xl font-black">{isTrue ? '✔' : '✖'}</span>
                    <span className="text-xl sm:text-2xl font-black">{opt.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. QUESTION RESULT SCREEN
  if (activeRoom.status === 'question_result' && currentQuestion) {
    const optionCounts: Record<string, number> = {};
    if (currentQuestion.options) {
      currentQuestion.options.forEach((opt) => (optionCounts[opt.id] = 0));
      currentQAnswers.forEach((a) => {
        if (a.selectedOptionId && optionCounts[a.selectedOptionId] !== undefined) {
          optionCounts[a.selectedOptionId]++;
        }
      });
    }
    const maxCount = Math.max(1, ...Object.values(optionCounts));

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7F6] p-4 md:p-6 flex flex-col justify-between">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-between">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block mb-1">
              KẾT QUẢ CÂU HỎI {activeRoom.currentQuestionIndex + 1}
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#004D2C]">{currentQuestion.title}</h2>
            {currentQuestion.description && (
              <p className="text-xs text-gray-500 mt-2 italic">{currentQuestion.description}</p>
            )}
          </div>

          <div className="my-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold text-gray-600 mb-6 flex items-center gap-2">
              <BarChart className="w-4 h-4 text-[#008049]" />
              <span>Biểu đồ câu trả lời trực tiếp:</span>
            </h3>

            {currentQuestion.options && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end h-64 px-4 pb-2 border-b border-gray-200">
                {currentQuestion.options.map((opt, idx) => {
                  const count = optionCounts[opt.id] || 0;
                  const heightPercent = Math.max(12, Math.round((count / maxCount) * 100));
                  const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                  return (
                    <div key={opt.id} className="flex flex-col items-center h-full justify-end">
                      <span className="text-sm font-black text-gray-700 mb-1">{count}</span>
                      <div
                        className={`w-full ${style.bg} rounded-t-xl transition-all duration-700 relative flex items-center justify-center ${
                          opt.isCorrect ? 'ring-4 ring-emerald-500 shadow-lg' : 'opacity-80'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      >
                        {opt.isCorrect && (
                          <span className="absolute -top-4 bg-emerald-700 text-white rounded-full p-1 shadow">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="text-white text-xl font-black">{style.shape}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-600 mt-2 truncate w-full text-center">
                        {opt.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              id="show-leaderboard-btn"
              onClick={() => handleUpdateStatus('leaderboard')}
              className="bg-[#008049] hover:bg-[#00683a] text-white px-8 py-3.5 rounded-2xl font-black text-base shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Trophy className="w-5 h-5 text-[#FFCC00]" />
              <span>Xem Bảng Xếp Hạng</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. LEADERBOARD SCREEN
  if (activeRoom.status === 'leaderboard') {
    const sortedPlayers = Object.values(activeRoom.players).sort((a, b) => b.score - a.score);
    const topFive = sortedPlayers.slice(0, 5);
    const isLastQuestion = activeRoom.currentQuestionIndex >= currentQuiz.questions.length - 1;

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#004D2C] via-[#005a33] to-[#008049] text-white p-4 md:p-8 flex flex-col justify-between">
        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-between">
          <div className="text-center">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FFCC00] text-[#004D2C] uppercase tracking-wider inline-block mb-2">
              Bảng Xếp Hạng Trực Tiếp
            </span>
            <h2 className="text-3xl font-black">Top Học Viên Dẫn Đầu</h2>
          </div>

          <div className="my-6 space-y-3">
            {topFive.map((player, idx) => (
              <div
                key={player.id}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center justify-between shadow-lg transition-all transform hover:scale-[1.01]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                      idx === 0
                        ? 'bg-[#FFCC00] text-[#004D2C]'
                        : idx === 1
                        ? 'bg-gray-200 text-gray-800'
                        : idx === 2
                        ? 'bg-amber-600 text-white'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                  <span className="text-3xl">{player.avatar}</span>
                  <div>
                    <span className="font-bold text-lg text-white block">{player.nickname}</span>
                    {player.streak > 1 && (
                      <span className="text-xs font-bold text-[#FFCC00] flex items-center gap-1">
                        🔥 Chuỗi {player.streak} câu đúng
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#FFCC00]">{player.score.toLocaleString()}</span>
                  <span className="text-xs text-white/60 block">điểm</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            {isLastQuestion ? (
              <button
                id="finish-game-btn"
                onClick={() => handleUpdateStatus('finished')}
                className="bg-[#FFCC00] text-[#004D2C] hover:bg-yellow-300 px-8 py-4 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <Award className="w-6 h-6" />
                <span>Xem Bục Vinh Quang (Podium)</span>
              </button>
            ) : (
              <button
                id="next-question-btn"
                onClick={() => handleUpdateStatus('question', activeRoom.currentQuestionIndex + 1)}
                className="bg-[#FFCC00] text-[#004D2C] hover:bg-yellow-300 px-8 py-4 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Câu hỏi tiếp theo</span>
                <SkipForward className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 6. FINISHED PODIUM & LMS EXPORT
  if (activeRoom.status === 'finished') {
    const sortedPlayers = Object.values(activeRoom.players).sort((a, b) => b.score - a.score);
    const p1 = sortedPlayers[0];
    const p2 = sortedPlayers[1];
    const p3 = sortedPlayers[2];

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#004D2C] via-[#005a33] to-[#008049] text-white p-4 md:p-8 flex flex-col justify-between">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-between">
          <div className="text-center pt-2">
            <span className="text-xs font-bold text-[#FFCC00] uppercase tracking-widest block mb-1">
              KẾT QUẢ CHUNG CUỘC
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white">Bục Vinh Quang BIDV EduPlay</h1>
            <p className="text-xs sm:text-sm text-emerald-100 mt-1">{currentQuiz.title}</p>
          </div>

          {/* 3D-Style Podium (Rank 2 - Rank 1 - Rank 3) */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end my-8 max-w-3xl mx-auto w-full px-2">
            {/* Rank 2 (Left) */}
            <div className="flex flex-col items-center">
              {p2 && (
                <div className="text-center mb-3">
                  <span className="text-4xl sm:text-5xl block">{p2.avatar}</span>
                  <span className="font-extrabold text-sm sm:text-base text-white block mt-1 truncate max-w-[110px]">
                    {p2.nickname}
                  </span>
                  <span className="text-xs font-bold text-[#FFCC00]">{p2.score.toLocaleString()} điểm</span>
                </div>
              )}
              <div className="w-full h-36 sm:h-48 bg-slate-300 text-slate-800 rounded-t-2xl flex flex-col items-center justify-center font-black shadow-lg border-t-4 border-slate-100">
                <span className="text-3xl sm:text-4xl">🥈</span>
                <span className="text-xl sm:text-2xl font-black">HẠNG 2</span>
              </div>
            </div>

            {/* Rank 1 (Center, Highest) */}
            <div className="flex flex-col items-center">
              {p1 && (
                <div className="text-center mb-3">
                  <span className="text-2xl text-[#FFCC00] font-black block animate-bounce">👑</span>
                  <span className="text-5xl sm:text-6xl block">{p1.avatar}</span>
                  <span className="font-black text-base sm:text-lg text-white block mt-1 truncate max-w-[130px]">
                    {p1.nickname}
                  </span>
                  <span className="text-sm font-black text-[#FFCC00]">{p1.score.toLocaleString()} điểm</span>
                </div>
              )}
              <div className="w-full h-52 sm:h-64 bg-[#FFCC00] text-[#004D2C] rounded-t-2xl flex flex-col items-center justify-center font-black shadow-2xl border-t-4 border-yellow-200">
                <span className="text-4xl sm:text-5xl">🥇</span>
                <span className="text-2xl sm:text-3xl font-black">HẠNG 1</span>
              </div>
            </div>

            {/* Rank 3 (Right) */}
            <div className="flex flex-col items-center">
              {p3 && (
                <div className="text-center mb-3">
                  <span className="text-4xl sm:text-5xl block">{p3.avatar}</span>
                  <span className="font-extrabold text-sm sm:text-base text-white block mt-1 truncate max-w-[110px]">
                    {p3.nickname}
                  </span>
                  <span className="text-xs font-bold text-[#FFCC00]">{p3.score.toLocaleString()} điểm</span>
                </div>
              )}
              <div className="w-full h-28 sm:h-36 bg-amber-700 text-amber-100 rounded-t-2xl flex flex-col items-center justify-center font-black shadow-lg border-t-4 border-amber-600">
                <span className="text-3xl sm:text-4xl">🥉</span>
                <span className="text-lg sm:text-xl font-black">HẠNG 3</span>
              </div>
            </div>
          </div>

          {/* Action Bar: LMS Save, CSV Export, Restart */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <span className="font-bold text-sm block">Đồng bộ bảng điểm LMS</span>
              <span className="text-xs text-emerald-100">
                Ghi nhận lịch sử đào tạo và xếp hạng nhân viên
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <button
                id="save-lms-btn"
                onClick={handleSaveToLMS}
                className="flex items-center gap-2 bg-[#008049] hover:bg-[#00683a] text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow transition-all border border-white/20 cursor-pointer"
              >
                <Save className="w-4 h-4 text-[#FFCC00]" />
                <span>{saveSuccess ? 'Đã lưu thành công!' : 'Lưu vào LMS'}</span>
              </button>
              <button
                id="export-csv-btn"
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#FFCC00]" />
                <span>Xuất File CSV</span>
              </button>
              <button
                onClick={() => handleUpdateStatus('lobby')}
                className="flex items-center gap-2 bg-[#FFCC00] text-[#004D2C] hover:bg-yellow-300 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
