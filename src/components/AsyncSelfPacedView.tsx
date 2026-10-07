import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  ChevronRight,
  Flame,
  Edit3,
} from 'lucide-react';
import { Quiz } from '../types';
import { calculateKahootScore } from '../utils/scoring';
import { sound } from '../utils/audio';

interface AsyncSelfPacedViewProps {
  quizzes: Quiz[];
  onEditQuiz?: (quizId: string) => void;
}

export const AsyncSelfPacedView: React.FC<AsyncSelfPacedViewProps> = ({ quizzes, onEditQuiz }) => {
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz>(quizzes[0]);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Question state
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [answeredCorrect, setAnsweredCorrect] = useState<boolean | null>(null);
  const [pointsEarnedThisQ, setPointsEarnedThisQ] = useState(0);

  const timerRef = useRef<number | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  const currentQ = selectedQuiz.questions[currentQIndex];

  // Start question timer
  useEffect(() => {
    if (!gameStarted || isFinished || !currentQ) return;
    setTimeRemaining(currentQ.timeLimit);
    setHasAnswered(false);
    setSelectedOptId(null);
    setAnsweredCorrect(null);
    questionStartTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeUp();
          return 0;
        }
        const next = prev - 1;
        sound.playTick(next <= 5);
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, currentQIndex, isFinished]);

  const handleTimeUp = () => {
    if (hasAnswered) return;
    setHasAnswered(true);
    setAnsweredCorrect(false);
    setStreak(0);
    sound.playWrong();
  };

  const handleAnswerMultipleChoice = (optId: string, isCorrect: boolean) => {
    if (hasAnswered) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setHasAnswered(true);
    setSelectedOptId(optId);
    setAnsweredCorrect(isCorrect);
    const elapsedMs = Date.now() - questionStartTimeRef.current;

    if (isCorrect) {
      sound.playCorrect();
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      const scoreData = calculateKahootScore(elapsedMs, currentQ.timeLimit, currentQ.points, nextStreak);
      setPointsEarnedThisQ(scoreData.points);
      setScore((prev) => prev + scoreData.points);
      if (nextStreak > 1) {
        setTimeout(() => sound.playStreak(), 400);
      }
    } else {
      sound.playWrong();
      setStreak(0);
      setPointsEarnedThisQ(0);
    }
  };

  const handleNextQuestion = () => {
    if (currentQIndex < selectedQuiz.questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
      sound.playPodiumFanfare();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#008049', '#FFCC00', '#004D2C'],
      });
    }
  };

  const handleRestart = () => {
    setCurrentQIndex(0);
    setScore(0);
    setStreak(0);
    setIsFinished(false);
    setGameStarted(true);
  };

  const OPTION_STYLES = [
    { bg: 'bg-[#E03E36]', hover: 'hover:bg-[#c42820]', border: 'border-[#B82B24]', shape: '▲' },
    { bg: 'bg-[#FFCC00] text-[#004D2C]', hover: 'hover:bg-[#e0b400]', border: 'border-[#CCA300]', shape: '◆' },
    { bg: 'bg-[#008049]', hover: 'hover:bg-[#006037]', border: 'border-[#005a33]', shape: '●' },
    { bg: 'bg-[#0A66C2]', hover: 'hover:bg-[#084e96]', border: 'border-[#084e96]', shape: '■' },
  ];

  // 1. SELECT QUIZ TO START ASYNC
  if (!gameStarted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#004D2C] text-[#FFCC00]">
              Chế Độ Tự Học (Async)
            </span>
            <span className="text-xs text-gray-500 font-semibold">Tự do luyện tập không cần Host trực tiếp</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-[#004D2C]">
            Luyện Tập & Thử Thách Cá Nhân
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Vẫn giữ nguyên cảm giác trường đấu: đếm ngược kịch tính, tính điểm thưởng tốc độ Kahoot và chuỗi streak combo.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-xs font-black uppercase text-gray-600 tracking-wider">
              Chọn chủ đề ôn tập:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  onClick={() => setSelectedQuiz(quiz)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedQuiz.id === quiz.id
                      ? 'border-[#008049] bg-emerald-50/60 shadow-md ring-2 ring-[#008049]/20'
                      : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#004D2C] text-[#FFCC00] uppercase">
                    {quiz.category}
                  </span>
                  <h3 className="font-bold text-base text-gray-900 mt-2">{quiz.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{quiz.description}</p>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{quiz.questions.length} câu hỏi</span>
                      <span>•</span>
                      <span className="text-[#008049] font-bold">{quiz.questions.length * 1000} điểm</span>
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
              ))}
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              id="start-async-game-btn"
              onClick={() => {
                setGameStarted(true);
                handleRestart();
              }}
              className="flex items-center gap-2 bg-[#008049] hover:bg-[#00683a] text-white px-8 py-4 rounded-2xl font-black text-base shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current text-[#FFCC00]" />
              <span>BẮT ĐẦU NGAY</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. FINISHED SUMMARY
  if (isFinished) {
    const totalMax = selectedQuiz.questions.length * 1000;
    const percent = Math.round((score / totalMax) * 100);

    return (
      <div className="max-w-xl mx-auto px-4 py-8 text-center">
        <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-[#FFCC00]">
          <Trophy className="w-20 h-20 text-[#FFCC00] mx-auto mb-3 animate-bounce" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block">
            KẾT QUẢ TỰ HỌC
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#004D2C] mt-1">
            Chúc Mừng Bạn Đã Hoàn Thành!
          </h2>
          <p className="text-xs text-gray-500 mt-1">{selectedQuiz.title}</p>

          <div className="my-6 bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
            <span className="text-xs font-bold text-gray-500 block">TỔNG ĐIỂM ĐẠT ĐƯỢC</span>
            <div className="text-5xl font-black text-[#008049] my-1">
              {score.toLocaleString()} <span className="text-xl font-bold text-gray-400">/ {totalMax}</span>
            </div>
            <span className="text-xs font-extrabold text-[#004D2C] bg-[#FFCC00] px-3 py-1 rounded-full inline-block mt-2">
              Độ chính xác & tốc độ: {percent}%
            </span>
          </div>

          <div className="flex items-center gap-3 justify-center">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 bg-[#008049] hover:bg-[#00683a] text-white px-6 py-3 rounded-2xl font-bold text-sm shadow transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Luyện tập lại</span>
            </button>
            <button
              onClick={() => setGameStarted(false)}
              className="px-6 py-3 rounded-2xl border border-gray-300 font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
            >
              Chọn chủ đề khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. ASYNC GAMEPLAY
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Top Status */}
      <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-[#004D2C] text-[#FFCC00]">
            Câu hỏi {currentQIndex + 1} / {selectedQuiz.questions.length}
          </span>
          {streak > 1 && (
            <span className="flex items-center gap-1 text-xs font-extrabold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>Chuỗi {streak}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span
              className={`font-mono text-base font-black ${
                timeRemaining <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-700'
              }`}
            >
              {timeRemaining}s
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400 font-bold block">Điểm</span>
            <span className="text-base font-black text-[#008049]">{score.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200 text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-[#004D2C] leading-snug">
          {currentQ.title}
        </h2>
        {currentQ.description && (
          <p className="text-xs text-gray-500 mt-2 font-medium">{currentQ.description}</p>
        )}
      </div>

      {/* Answer Options */}
      {currentQ.type === 'multiple_choice' && currentQ.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentQ.options.map((opt, idx) => {
            const style = OPTION_STYLES[idx % OPTION_STYLES.length];
            const isSelected = selectedOptId === opt.id;

            return (
              <button
                key={opt.id}
                disabled={hasAnswered}
                onClick={() => handleAnswerMultipleChoice(opt.id, opt.isCorrect)}
                className={`${style.bg} ${style.hover} text-white p-5 sm:p-6 rounded-2xl shadow-md border-b-4 ${
                  style.border
                } flex items-center gap-4 text-left transition-all cursor-pointer ${
                  hasAnswered
                    ? opt.isCorrect
                      ? 'ring-4 ring-emerald-400 scale-[1.02]'
                      : isSelected
                      ? 'opacity-60 ring-2 ring-red-400'
                      : 'opacity-40'
                    : 'active:scale-95'
                }`}
              >
                <span className="text-2xl font-black opacity-90">{style.shape}</span>
                <span className="text-base sm:text-lg font-bold flex-1">{opt.text}</span>
                {hasAnswered && opt.isCorrect && <CheckCircle2 className="w-6 h-6 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {currentQ.type === 'true_false' && currentQ.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentQ.options.map((opt, idx) => {
            const isTrue = idx === 0;
            const isSelected = selectedOptId === opt.id;

            return (
              <button
                key={opt.id}
                disabled={hasAnswered}
                onClick={() => handleAnswerMultipleChoice(opt.id, opt.isCorrect)}
                className={`${
                  isTrue ? 'bg-[#008049]' : 'bg-[#E03E36]'
                } text-white p-6 sm:p-8 rounded-2xl shadow-md border-b-4 flex items-center justify-center gap-4 text-xl font-black transition-all cursor-pointer ${
                  hasAnswered
                    ? opt.isCorrect
                      ? 'ring-4 ring-yellow-400'
                      : isSelected
                      ? 'opacity-60'
                      : 'opacity-40'
                    : 'active:scale-95'
                }`}
              >
                <span>{isTrue ? '✔' : '✖'}</span>
                <span>{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Answer Feedback Banner */}
      {hasAnswered && (
        <div
          className={`mt-6 p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fade-in ${
            answeredCorrect
              ? 'bg-emerald-50 border-emerald-300 text-[#004D2C]'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {answeredCorrect ? (
              <CheckCircle2 className="w-8 h-8 text-[#008049]" />
            ) : (
              <XCircle className="w-8 h-8 text-red-600" />
            )}
            <div>
              <span className="font-extrabold text-base block">
                {answeredCorrect ? 'CHÍNH XÁC!' : 'CHƯA CHÍNH XÁC!'}
              </span>
              <span className="text-xs">
                {answeredCorrect
                  ? `Bạn nhận được +${pointsEarnedThisQ} điểm tốc độ!`
                  : 'Hãy xem lại phần giải thích để ghi nhớ nhé.'}
              </span>
            </div>
          </div>

          <button
            id="async-next-q-btn"
            onClick={handleNextQuestion}
            className="flex items-center gap-1.5 bg-[#008049] hover:bg-[#006037] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow transition-all cursor-pointer"
          >
            <span>{currentQIndex < selectedQuiz.questions.length - 1 ? 'Câu tiếp theo' : 'Xem kết quả'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
