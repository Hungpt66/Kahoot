import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Sparkles,
  Code2,
  HelpCircle,
  CheckCircle,
  Clock,
  Eye,
  Copy,
  Edit3,
  MoveUp,
  MoveDown,
  Search,
  RotateCcw,
  CheckSquare,
  ToggleLeft,
  X,
  BookOpen,
  Image as ImageIcon,
  Tag,
  Play,
  AlertCircle,
  HelpCircle as QuestionIcon,
} from 'lucide-react';
import { Quiz, Question, QuestionType, OptionItem } from '../types';
import { SAMPLE_EXTERNAL_MINI_GAME_HTML } from '../data/sampleQuizzes';
import { sound } from '../utils/audio';

interface QuizBuilderViewProps {
  onQuizCreated: (quiz: Quiz) => void;
  onQuizUpdated?: (quiz: Quiz) => void;
  onQuizDeleted?: (quizId: string) => void;
  onResetDefaults?: (quizzes: Quiz[]) => void;
  existingQuizzes: Quiz[];
  initialQuizId?: string | null;
  onLaunchLiveHost?: (quizId: string) => void;
}

const PRESET_IMAGES = [
  {
    name: 'SmartBanking Mobile App',
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Bảo Mật Sinh Trắc & Số',
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Thanh Toán Thẻ Contactless',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Dịch Vụ Khách Hàng & Tác Phong',
    url: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Biểu Đồ Tài Chính',
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80',
  },
];

const OPTION_COLORS = [
  { bg: 'bg-red-500', border: 'border-red-600', text: 'text-red-700', label: 'A' },
  { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-blue-700', label: 'B' },
  { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-amber-700', label: 'C' },
  { bg: 'bg-emerald-600', border: 'border-emerald-700', text: 'text-emerald-700', label: 'D' },
  { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-purple-700', label: 'E' },
  { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-pink-700', label: 'F' },
];

export const QuizBuilderView: React.FC<QuizBuilderViewProps> = ({
  onQuizCreated,
  onQuizUpdated,
  onQuizDeleted,
  onResetDefaults,
  existingQuizzes,
  initialQuizId,
  onLaunchLiveHost,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'editor' | 'bank' | 'external' | 'ai'>('editor');
  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    initialQuizId || (existingQuizzes[0]?.id ?? '')
  );
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);

  const [quizId, setQuizId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Nghiệp vụ BIDV');
  const [coverImage, setCoverImage] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isNewQuizMode, setIsNewQuizMode] = useState(false);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [questionToDelete, setQuestionToDelete] = useState<number | null>(null);
  const [showDeleteQuizModal, setShowDeleteQuizModal] = useState(false);
  const [showResetDefaultsModal, setShowResetDefaultsModal] = useState(false);

  const [previewQuestionModal, setPreviewQuestionModal] = useState<Question | null>(null);
  const [testEmbedModalHtml, setTestEmbedModalHtml] = useState<string | null>(null);

  const [embedHtml, setEmbedHtml] = useState(SAMPLE_EXTERNAL_MINI_GAME_HTML);
  const [externalTitle, setExternalTitle] = useState('Thử Thách Tương Tác Google AI Studio');

  const [aiTopic, setAiTopic] = useState('Bảo mật thanh toán sinh trắc học và phòng chống lừa đảo trực tuyến BIDV');
  const [aiQuestionCount, setAiQuestionCount] = useState(4);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const [bankSearch, setBankSearch] = useState('');
  const [bankCategoryFilter, setBankCategoryFilter] = useState('all');
  const [bankTypeFilter, setBankTypeFilter] = useState('all');

  useEffect(() => {
    if (initialQuizId) {
      setSelectedQuizId(initialQuizId);
    }
  }, [initialQuizId]);

  useEffect(() => {
    if (isNewQuizMode) return;
    const targetQuiz = existingQuizzes.find((q) => q.id === selectedQuizId) || existingQuizzes[0];
    if (targetQuiz) {
      setQuizId(targetQuiz.id);
      setTitle(targetQuiz.title);
      setDescription(targetQuiz.description || '');
      setCategory(targetQuiz.category || 'Nghiệp vụ BIDV');
      setCoverImage(targetQuiz.coverImage || '');

      const sanitized = (targetQuiz.questions || []).map((q) => {
        if (q.type === 'fill_blank') {
          const mainAnswer = (q.correctText || 'BIDV SmartBanking').split(',')[0].trim();
          return {
            ...q,
            type: 'multiple_choice' as QuestionType,
            options: [
              { id: 'opt_1', text: mainAnswer, isCorrect: true },
              { id: 'opt_2', text: 'Ngân hàng truyền thống', isCorrect: false },
              { id: 'opt_3', text: 'Hệ thống giấy tờ', isCorrect: false },
              { id: 'opt_4', text: 'Thanh toán trực tiếp', isCorrect: false },
            ],
            correctText: undefined,
          };
        }
        return q;
      });
      setQuestions(JSON.parse(JSON.stringify(sanitized)));
      setActiveQuestionIndex(0);
    }
  }, [selectedQuizId, existingQuizzes, isNewQuizMode]);

  const currentQuestion: Question | undefined = questions[activeQuestionIndex];

  const handleStartNewQuiz = () => {
    setIsNewQuizMode(true);
    setQuizId('quiz_' + Date.now());
    setTitle('Bộ Đề Trắc Nghiệm Mới Giảng Viên BIDV');
    setDescription('Mô tả mục tiêu và đối tượng tham gia khóa học...');
    setCategory('Nghiệp vụ BIDV');
    setCoverImage(PRESET_IMAGES[0].url);

    const initialQ: Question = {
      id: 'q_' + Date.now(),
      type: 'multiple_choice',
      title: 'Nội dung câu hỏi trắc nghiệm 1...',
      timeLimit: 20,
      points: 1000,
      options: [
        { id: 'opt_1', text: 'Phương án A (Chính xác)', isCorrect: true },
        { id: 'opt_2', text: 'Phương án B', isCorrect: false },
        { id: 'opt_3', text: 'Phương án C', isCorrect: false },
        { id: 'opt_4', text: 'Phương án D', isCorrect: false },
      ],
      description: 'Ghi chú giải thích chi tiết sau khi học viên trả lời',
    };
    setQuestions([initialQ]);
    setActiveQuestionIndex(0);
    setActiveAdminTab('editor');
  };

  const handleAddNewQuestion = (type: QuestionType = 'multiple_choice') => {
    const newId = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    let newQ: Question;

    if (type === 'true_false') {
      newQ = {
        id: newId,
        type: 'true_false',
        title: 'Nhận định sau Đúng hay Sai: [Nội dung nhận định]...',
        timeLimit: 15,
        points: 1000,
        options: [
          { id: 'tf_1', text: 'Đúng', isCorrect: true },
          { id: 'tf_2', text: 'Sai', isCorrect: false },
        ],
        description: 'Giải thích lý do nhận định này Đúng hay Sai',
      };
    } else if (type === 'external_embed') {
      newQ = {
        id: newId,
        type: 'external_embed',
        title: 'Vòng Thử Thách Mini-Game Nhúng Google AI Studio',
        timeLimit: 45,
        points: 1000,
        externalGameConfig: {
          sourceType: 'ai_studio_html',
          embedHtml: embedHtml,
          title: externalTitle,
          instruction: 'Tương tác trực tiếp trên khung game để hoàn thành nhiệm vụ LMS.',
          maxScore: 1000,
          timeLimitSeconds: 45,
        },
      };
    } else {
      newQ = {
        id: newId,
        type: 'multiple_choice',
        title: 'Nội dung câu hỏi trắc nghiệm mới...',
        timeLimit: 20,
        points: 1000,
        options: [
          { id: 'opt_1', text: 'Lựa chọn A (Chính xác)', isCorrect: true },
          { id: 'opt_2', text: 'Lựa chọn B', isCorrect: false },
          { id: 'opt_3', text: 'Lựa chọn C', isCorrect: false },
          { id: 'opt_4', text: 'Lựa chọn D', isCorrect: false },
        ],
        description: 'Giải thích tóm tắt kiến thức bổ trợ cho học viên',
      };
    }

    const updated = [...questions, newQ];
    setQuestions(updated);
    setActiveQuestionIndex(updated.length - 1);
  };

  const handleDuplicateQuestion = (idx: number) => {
    if (!questions[idx]) return;
    const cloned = JSON.parse(JSON.stringify(questions[idx])) as Question;
    cloned.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    cloned.title = cloned.title + ' (Bản sao)';
    const updated = [...questions];
    updated.splice(idx + 1, 0, cloned);
    setQuestions(updated);
    setActiveQuestionIndex(idx + 1);
  };

  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const updated = [...questions];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated);
    setActiveQuestionIndex(targetIdx);
  };

  const handleDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) {
      setSaveErrorMsg('Bộ đề thi phải có ít nhất 1 câu hỏi, không thể xóa hết.');
      setTimeout(() => setSaveErrorMsg(''), 4000);
      return;
    }
    setQuestionToDelete(idx);
  };

  const executeDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) {
      setSaveErrorMsg('Bộ đề thi phải có ít nhất 1 câu hỏi.');
      setQuestionToDelete(null);
      return;
    }
    const qTitle = questions[idx]?.title || `Câu hỏi #${idx + 1}`;
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setActiveQuestionIndex(Math.max(0, Math.min(activeQuestionIndex, updated.length - 1)));
    setQuestionToDelete(null);
    setSaveSuccessMsg(`Đã xóa câu hỏi: "${qTitle.slice(0, 35)}..." khỏi danh sách.`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleUpdateActiveQuestion = (patch: Partial<Question>) => {
    if (!currentQuestion) return;
    const updated = [...questions];
    updated[activeQuestionIndex] = { ...updated[activeQuestionIndex], ...patch };
    setQuestions(updated);
  };

  const handleToggleCorrectOptionIndex = (optIdx: number) => {
    if (!currentQuestion?.options) return;
    const currentOpts = currentQuestion.options;
    const currentCorrectCount = currentOpts.filter((o) => o.isCorrect).length;

    if (currentOpts[optIdx]?.isCorrect && currentCorrectCount <= 1) {
      setSaveErrorMsg('Cần giữ ít nhất 1 đáp án đúng.');
      setTimeout(() => setSaveErrorMsg(''), 3000);
      return;
    }

    const updatedOpts = currentOpts.map((opt, idx) => ({
      ...opt,
      isCorrect: idx === optIdx ? !opt.isCorrect : opt.isCorrect,
    }));
    handleUpdateActiveQuestion({ options: updatedOpts });
    sound.playTick(false);
  };

  const handleSetTrueFalseCorrect = (isTrue: boolean) => {
    if (!currentQuestion) return;
    const currentOpts = currentQuestion.options || [
      { id: 'tf_1', text: 'Đúng', isCorrect: true },
      { id: 'tf_2', text: 'Sai', isCorrect: false },
    ];
    const updatedOpts = [
      {
        ...currentOpts[0],
        id: currentOpts[0]?.id || 'tf_1',
        text: currentOpts[0]?.text || 'Đúng',
        isCorrect: isTrue,
      },
      {
        ...currentOpts[1],
        id: currentOpts[1]?.id || 'tf_2',
        text: currentOpts[1]?.text || 'Sai',
        isCorrect: !isTrue,
      },
    ];
    handleUpdateActiveQuestion({ options: updatedOpts });
    sound.playTick(false);
  };

  const handleChangeQuestionType = (newType: QuestionType) => {
    if (!currentQuestion || currentQuestion.type === newType) return;
    const updated = [...questions];
    const q = { ...updated[activeQuestionIndex], type: newType };

    if (newType === 'true_false') {
      q.options = [
        { id: 'tf_1', text: 'Đúng', isCorrect: true },
        { id: 'tf_2', text: 'Sai', isCorrect: false },
      ];
      delete q.correctText;
      delete q.pairs;
      delete q.externalGameConfig;
    } else if (newType === 'external_embed') {
      q.externalGameConfig = {
        sourceType: 'ai_studio_html',
        embedHtml: embedHtml,
        title: externalTitle,
        instruction: 'Tương tác trực tiếp trên khung game để hoàn thành nhiệm vụ.',
        maxScore: 1000,
        timeLimitSeconds: 45,
      };
      delete q.options;
      delete q.correctText;
      delete q.pairs;
    } else {
      q.type = 'multiple_choice';
      q.options = [
        { id: 'opt_1', text: 'Phương án A (Đúng)', isCorrect: true },
        { id: 'opt_2', text: 'Phương án B', isCorrect: false },
        { id: 'opt_3', text: 'Phương án C', isCorrect: false },
        { id: 'opt_4', text: 'Phương án D', isCorrect: false },
      ];
      delete q.correctText;
      delete q.pairs;
      delete q.externalGameConfig;
    }

    updated[activeQuestionIndex] = q;
    setQuestions(updated);
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      setSaveErrorMsg('Vui lòng nhập tiêu đề cho bộ đề.');
      setTimeout(() => setSaveErrorMsg(''), 4000);
      return;
    }
    if (questions.length === 0) {
      setSaveErrorMsg('Bộ đề thi cần có ít nhất 1 câu hỏi.');
      setTimeout(() => setSaveErrorMsg(''), 4000);
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg('');
    setSaveErrorMsg('');

    const payload: Quiz = {
      id: quizId || 'quiz_' + Date.now(),
      title: title.trim(),
      description: description.trim() || 'Bộ đề đào tạo nghiệp vụ BIDV',
      category: category.trim(),
      coverImage: coverImage || PRESET_IMAGES[0].url,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions,
    };

    try {
      let res: globalThis.Response;
      if (isNewQuizMode) {
        res = await fetch('/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/quizzes/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success && data.quiz) {
        if (isNewQuizMode) {
          onQuizCreated(data.quiz);
          setIsNewQuizMode(false);
          setSelectedQuizId(data.quiz.id);
        } else if (onQuizUpdated) {
          onQuizUpdated(data.quiz);
        } else {
          onQuizCreated(data.quiz);
        }
        sound.playCorrect();
        setSaveSuccessMsg('Đã lưu thành công bộ đề trắc nghiệm vào hệ thống LMS!');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        setSaveErrorMsg(data.error || 'Lỗi khi lưu đề');
      }
    } catch (err: any) {
      console.error('Error saving quiz:', err);
      setSaveErrorMsg('Lỗi mạng khi lưu đề');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloneQuiz = async () => {
    if (!selectedQuizId) return;
    try {
      const res = await fetch(`/api/quizzes/${selectedQuizId}/clone`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.quiz) {
        onQuizCreated(data.quiz);
        setSelectedQuizId(data.quiz.id);
        setIsNewQuizMode(false);
        setSaveSuccessMsg(`Nhân bản thành công "${data.quiz.title}"!`);
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error cloning quiz:', err);
    }
  };

  const handleDeleteQuiz = () => {
    if (existingQuizzes.length <= 1) {
      setSaveErrorMsg('Không thể xóa bộ đề cuối cùng trong hệ thống.');
      setTimeout(() => setSaveErrorMsg(''), 4000);
      return;
    }
    setShowDeleteQuizModal(true);
  };

  const executeDeleteQuiz = async () => {
    setShowDeleteQuizModal(false);
    try {
      const res = await fetch(`/api/quizzes/${selectedQuizId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        if (onQuizDeleted) {
          onQuizDeleted(selectedQuizId);
        }
        const remaining = existingQuizzes.filter((q) => q.id !== selectedQuizId);
        if (remaining.length > 0) {
          setSelectedQuizId(remaining[0].id);
        }
        setSaveSuccessMsg('Đã xóa bộ đề thi khỏi LMS.');
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error deleting quiz:', err);
      setSaveErrorMsg('Lỗi khi xóa bộ đề thi');
    }
  };

  const handleResetDefaults = () => {
    setShowResetDefaultsModal(true);
  };

  const executeResetDefaults = async () => {
    setShowResetDefaultsModal(false);
    try {
      const res = await fetch('/api/quizzes/reset-defaults', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.quizzes) {
        if (onResetDefaults) {
          onResetDefaults(data.quizzes);
        }
        setSelectedQuizId(data.quizzes[0].id);
        setIsNewQuizMode(false);
        setSaveSuccessMsg('Khôi phục thành công các bộ đề chuẩn ban đầu!');
        setTimeout(() => setSaveSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error resetting quizzes:', err);
      setSaveErrorMsg('Lỗi khi khôi phục đề mẫu');
    }
  };

  const handleGenerateAiQuiz = async () => {
    if (!aiTopic.trim()) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), questionCount: aiQuestionCount }),
      });
      const data = await res.json();
      if (data.success && data.quiz) {
        setTitle(data.quiz.title);
        setDescription(data.quiz.description);
        setCategory(data.quiz.category);
        setQuestions(data.quiz.questions);
        setActiveQuestionIndex(0);
        setActiveAdminTab('editor');
        setIsNewQuizMode(true);
        setQuizId('quiz_ai_' + Date.now());
        setSaveSuccessMsg('Trợ lý AI Gemini đã tạo thành công bộ trắc nghiệm! Hãy duyệt và chỉnh sửa trước khi lưu.');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        setSaveErrorMsg(data.error || 'Lỗi khi tạo đề bằng AI');
        setTimeout(() => setSaveErrorMsg(''), 4000);
      }
    } catch (err) {
      console.error('AI quiz generation error:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const allBankQuestions = useMemo(() => {
    const list: { question: Question; quizTitle: string; quizCategory: string }[] = [];
    existingQuizzes.forEach((qz) => {
      qz.questions.forEach((q) => {
        if (q.type !== 'fill_blank') {
          list.push({
            question: q,
            quizTitle: qz.title,
            quizCategory: qz.category,
          });
        }
      });
    });
    return list;
  }, [existingQuizzes]);

  const filteredBankQuestions = useMemo(() => {
    return allBankQuestions.filter((item) => {
      const matchSearch =
        !bankSearch ||
        item.question.title.toLowerCase().includes(bankSearch.toLowerCase()) ||
        item.quizTitle.toLowerCase().includes(bankSearch.toLowerCase());
      const matchCategory =
        bankCategoryFilter === 'all' || item.quizCategory === bankCategoryFilter;
      const matchType =
        bankTypeFilter === 'all' || item.question.type === bankTypeFilter;
      return matchSearch && matchCategory && matchType;
    });
  }, [allBankQuestions, bankSearch, bankCategoryFilter, bankTypeFilter]);

  const handleImportQuestionFromBank = (bankQ: Question) => {
    const copy = JSON.parse(JSON.stringify(bankQ)) as Question;
    copy.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const updated = [...questions, copy];
    setQuestions(updated);
    setActiveQuestionIndex(updated.length - 1);
    setActiveAdminTab('editor');
    setSaveSuccessMsg(`Đã nạp câu hỏi "${copy.title.slice(0, 35)}..." vào đề!`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
      {/* Top Banner & Title Bar */}
      <div className="bg-gradient-to-r from-[#004D2C] to-[#008049] rounded-3xl p-6 text-white shadow-lg mb-6 border-b-4 border-[#FFCC00]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFCC00] text-[#004D2C] uppercase tracking-wide">
                Hệ Thống Quản Trị Giảng Viên (Admin)
              </span>
              <span className="text-xs text-emerald-100 font-semibold">
                Trung tâm biên tập & chuẩn hóa ngân hàng đề thi trắc nghiệm BIDV
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
              <Edit3 className="w-7 h-7 text-[#FFCC00]" />
              <span>Chỉnh Sửa &amp; Quản Trị Đề Thi Trắc Nghiệm</span>
            </h1>
          </div>

          {/* Quick Global Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleStartNewQuiz}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FFCC00] text-[#004D2C] hover:bg-yellow-300 shadow transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 font-black" />
              <span>Tạo đề mới</span>
            </button>
            <button
              onClick={handleCloneQuiz}
              disabled={isNewQuizMode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Nhân bản bộ đề thi"
            >
              <Copy className="w-3.5 h-3.5 text-[#FFCC00]" />
              <span>Nhân bản</span>
            </button>
            {onLaunchLiveHost && (
              <button
                onClick={() => onLaunchLiveHost(selectedQuizId)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white shadow transition-all cursor-pointer"
                title="Khởi tạo phòng chơi trực tiếp"
              >
                <Play className="w-3.5 h-3.5 fill-current text-white" />
                <span>Mở phòng Live</span>
              </button>
            )}
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-black/20 hover:bg-black/30 text-emerald-200 border border-white/10 transition-all cursor-pointer"
              title="Khôi phục các đề thi mẫu ban đầu của BIDV EduPlay"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi Phục Mẫu</span>
            </button>
          </div>
        </div>

        {/* Quiz Selector bar */}
        <div className="mt-5 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-bold text-emerald-100 whitespace-nowrap">
              Đang chọn đề thi:
            </label>
            <select
              value={isNewQuizMode ? 'new' : selectedQuizId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'new') {
                  handleStartNewQuiz();
                } else {
                  setIsNewQuizMode(false);
                  setSelectedQuizId(val);
                }
              }}
              className="bg-white text-[#004D2C] font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow border-2 border-[#FFCC00] outline-none flex-1 max-w-xl cursor-pointer"
            >
              {isNewQuizMode && <option value="new">[Đề Thi Mới Đang Soạn] {title}</option>}
              {existingQuizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.questions.length} câu) - [{q.category}]
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-900/60 text-[#FFCC00] font-bold px-2.5 py-1 rounded-lg border border-white/10">
              Tổng: {questions.length} câu trắc nghiệm
            </span>
            <span className="text-emerald-100 hidden sm:inline">
              Thời lượng ước tính: ~{Math.round(questions.reduce((sum, q) => sum + (q.timeLimit || 20), 0) / 60)} phút
            </span>
          </div>
        </div>
      </div>

      {/* Admin Mode Switcher Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveAdminTab('editor')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeAdminTab === 'editor'
              ? 'bg-[#008049] text-white shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Edit3 className="w-4 h-4 text-[#FFCC00]" />
          <span>Biên Tập Chi Tiết Đề ({questions.length})</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('bank')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeAdminTab === 'bank'
              ? 'bg-[#008049] text-white shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#FFCC00]" />
          <span>Kho Ngân Hàng Câu Hỏi LMS ({allBankQuestions.length})</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('external')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeAdminTab === 'external'
              ? 'bg-[#008049] text-white shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Code2 className="w-4 h-4 text-[#FFCC00]" />
          <span>Hướng B: Nhúng Mini-Game AI Studio</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeAdminTab === 'ai'
              ? 'bg-[#FFCC00] text-[#004D2C] shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Trợ Lý Gemini AI</span>
        </button>
      </div>

      {/* Notifications / Feedback alerts */}
      {saveSuccessMsg && (
        <div className="mb-6 bg-emerald-50 text-[#008049] font-bold text-sm p-4 rounded-2xl border-2 border-emerald-300 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#008049]" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveErrorMsg && (
        <div className="mb-6 bg-red-50 text-red-700 font-bold text-sm p-4 rounded-2xl border-2 border-red-300 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span>{saveErrorMsg}</span>
          </div>
          <button onClick={() => setSaveErrorMsg('')} className="text-red-700 hover:text-red-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================== TAB 1: QUESTION STUDIO & EDITOR ===================== */}
      {activeAdminTab === 'editor' && (
        <div className="space-y-6">
          {/* Metadata Card: Title, Category, Description */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <span className="text-xs font-black uppercase text-[#004D2C] tracking-wider flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#008049]" />
                Thông Tin Chung Của Bộ Đề
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteQuiz}
                  className="text-red-600 hover:text-red-700 text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-red-50 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Xóa bộ đề này khỏi LMS"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa bộ đề</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Tiêu đề đề thi / bài học
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Kiểm Tra Kiến Thức Nghiệp Vụ Ngân Hàng Số & SmartBanking"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-sm focus:border-[#008049] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Danh mục nghiệp vụ
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-sm bg-white focus:border-[#008049] outline-none cursor-pointer"
                >
                  <option value="Nghiệp vụ BIDV">Nghiệp vụ BIDV</option>
                  <option value="Ngân hàng số BIDV">Ngân hàng số BIDV</option>
                  <option value="Bảo mật & Tuân thủ">Bảo mật & Tuân thủ</option>
                  <option value="Văn hóa & Tác phong">Văn hóa & Tác phong</option>
                  <option value="Tín dụng & Thanh toán">Tín dụng & Thanh toán</option>
                  <option value="Thẻ & Ngoại hối">Thẻ & Ngoại hối</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Mô tả / Hướng dẫn học viên
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả phạm vi kiến thức, mục tiêu đánh giá năng lực học viên..."
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium focus:border-[#008049] outline-none"
                />
              </div>
            </div>
          </div>

          {/* TWO-COLUMN QUESTION STUDIO: LEFT NAVIGATOR + RIGHT DETAILED EDITOR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Question Navigator */}
            <div className="lg:col-span-4 bg-white rounded-3xl p-5 shadow-sm border border-gray-200 space-y-4 sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#004D2C] text-[#FFCC00] font-black text-xs flex items-center justify-center">
                    {questions.length}
                  </span>
                  <h3 className="font-black text-sm text-[#004D2C]">Danh Sách Câu Hỏi</h3>
                </div>

                {/* Add question menu */}
                <div className="relative group">
                  <button className="flex items-center gap-1 bg-[#008049] hover:bg-[#006037] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow transition-all cursor-pointer">
                    <Plus className="w-4 h-4 text-[#FFCC00]" />
                    <span>Thêm câu</span>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 py-1.5 z-30 hidden group-hover:block hover:block">
                    <button
                      onClick={() => handleAddNewQuestion('multiple_choice')}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-[#008049] flex items-center gap-2.5 cursor-pointer"
                    >
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div>Trắc nghiệm 4 đáp án</div>
                        <div className="text-[10px] text-gray-400 font-normal">Nhiều lựa chọn (Chuẩn Kahoot)</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAddNewQuestion('true_false')}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-[#008049] flex items-center gap-2.5 cursor-pointer"
                    >
                      <ToggleLeft className="w-4 h-4 text-blue-600" />
                      <div>
                        <div>Trắc nghiệm Đúng / Sai</div>
                        <div className="text-[10px] text-gray-400 font-normal">2 phương án Đúng hoặc Sai</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleAddNewQuestion('external_embed')}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-emerald-50 hover:text-[#008049] flex items-center gap-2.5 border-t border-gray-100 cursor-pointer"
                    >
                      <Code2 className="w-4 h-4 text-amber-600" />
                      <div>
                        <div>Vòng nhúng AI Studio</div>
                        <div className="text-[10px] text-gray-400 font-normal">Mini-game HTML xuất ngoài</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable question items */}
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isActive = idx === activeQuestionIndex;
                  return (
                    <div
                      key={q.id || idx}
                      onClick={() => setActiveQuestionIndex(idx)}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                        isActive
                          ? 'border-[#008049] bg-emerald-50/70 shadow-sm ring-2 ring-[#008049]/20'
                          : 'border-gray-200 hover:border-emerald-300 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${
                              isActive ? 'bg-[#008049] text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase">
                            {q.type === 'multiple_choice'
                              ? 'Trắc nghiệm 4 đáp án'
                              : q.type === 'true_false'
                              ? 'Đúng / Sai'
                              : 'Game nhúng'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            className="p-1 text-gray-400 hover:text-[#008049] disabled:opacity-30 disabled:hover:text-gray-400 cursor-pointer"
                            title="Di chuyển lên trước"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === questions.length - 1}
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            className="p-1 text-gray-400 hover:text-[#008049] disabled:opacity-30 disabled:hover:text-gray-400 cursor-pointer"
                            title="Di chuyển xuống dưới"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateQuestion(idx)}
                            className="p-1 text-gray-400 hover:text-blue-600 cursor-pointer"
                            title="Nhân bản câu này"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {questions.length > 1 && (
                            <button
                              onClick={() => handleDeleteQuestion(idx)}
                              className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                              title="Xóa câu này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs font-bold text-gray-800 line-clamp-2">{q.title}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500 pt-1.5 border-t border-gray-200/60">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {q.timeLimit}s
                        </span>
                        <span className="font-semibold text-emerald-800">{q.points} điểm</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setPreviewQuestionModal(currentQuestion || null)}
                  className="flex items-center gap-1 text-xs font-bold text-[#008049] hover:underline cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Xem trước câu đang chọn</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Question Detailed Editor */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-gray-200 space-y-6">
              {currentQuestion ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-[#004D2C] text-[#FFCC00] font-black text-sm flex items-center justify-center shadow">
                        #{activeQuestionIndex + 1}
                      </span>
                      <div>
                        <h2 className="font-black text-base text-[#004D2C]">
                          Chỉnh Sửa Câu Hỏi Trắc Nghiệm
                        </h2>
                        <span className="text-[11px] text-gray-500">
                          ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{currentQuestion.id}</code>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={currentQuestion.type}
                        onChange={(e) => handleChangeQuestionType(e.target.value as QuestionType)}
                        className="bg-emerald-50 text-[#008049] font-bold text-xs px-3 py-2 rounded-xl border border-emerald-300 outline-none cursor-pointer"
                      >
                        <option value="multiple_choice">Trắc nghiệm 4 lựa chọn</option>
                        <option value="true_false">Trắc nghiệm Đúng / Sai</option>
                        <option value="external_embed">Nhúng Mini-Game AI Studio</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDuplicateQuestion(activeQuestionIndex)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-2 rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                        title="Nhân bản"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Nhân bản</span>
                      </button>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(activeQuestionIndex)}
                          className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-2 rounded-xl border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                          title="Xóa câu này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Xóa câu</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider">
                      NỘI DUNG ĐỀ BÀI / CÂU HỎI TRẮC NGHIỆM
                    </label>
                    <textarea
                      rows={3}
                      value={currentQuestion.title}
                      onChange={(e) => handleUpdateActiveQuestion({ title: e.target.value })}
                      placeholder="Nhập nội dung câu hỏi trắc nghiệm hiển thị cho học viên..."
                      className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 font-bold text-sm sm:text-base focus:border-[#008049] outline-none text-gray-900 resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#008049]" />
                        <span>Thời gian suy nghĩ</span>
                      </label>
                      <select
                        value={currentQuestion.timeLimit}
                        onChange={(e) => handleUpdateActiveQuestion({ timeLimit: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-gray-300 font-bold text-xs text-gray-800 outline-none cursor-pointer"
                      >
                        <option value={10}>10 giây (Tốc độ cao)</option>
                        <option value={15}>15 giây</option>
                        <option value={20}>20 giây (Chuẩn Kahoot)</option>
                        <option value={30}>30 giây</option>
                        <option value={45}>45 giây</option>
                        <option value={60}>60 giây (1 phút)</option>
                        <option value={90}>90 giây</option>
                        <option value={120}>120 giây (2 phút)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Điểm tối đa</span>
                      </label>
                      <select
                        value={currentQuestion.points}
                        onChange={(e) => handleUpdateActiveQuestion({ points: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-gray-300 font-bold text-xs text-gray-800 outline-none cursor-pointer"
                      >
                        <option value={500}>500 điểm</option>
                        <option value={1000}>1,000 điểm (Chuẩn)</option>
                        <option value={1500}>1,500 điểm</option>
                        <option value={2000}>2,000 điểm (Nhân đôi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Hình minh họa</span>
                      </label>
                      <select
                        value={currentQuestion.mediaUrl || ''}
                        onChange={(e) => handleUpdateActiveQuestion({ mediaUrl: e.target.value || undefined })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-gray-300 font-bold text-xs text-gray-800 outline-none cursor-pointer"
                      >
                        <option value="">Không dùng hình</option>
                        {PRESET_IMAGES.map((img, i) => (
                          <option key={i} value={img.url}>
                            {img.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {currentQuestion.mediaUrl && (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 max-h-48 bg-black/5 flex items-center justify-center">
                      <img
                        src={currentQuestion.mediaUrl}
                        alt="Media Preview"
                        className="w-full h-48 object-cover"
                      />
                      <button
                        onClick={() => handleUpdateActiveQuestion({ mediaUrl: undefined })}
                        className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-1 rounded-full text-xs cursor-pointer"
                        title="Gỡ ảnh này"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* MULTIPLE CHOICE */}
                  {currentQuestion.type === 'multiple_choice' && (() => {
                    const correctOptIdx = currentQuestion.options?.findIndex((o) => o.isCorrect) ?? 0;
                    const correctLetter = correctOptIdx >= 0 ? String.fromCharCode(65 + correctOptIdx) : 'A';
                    const correctOptText = currentQuestion.options?.[correctOptIdx]?.text || '';
                    return (
                      <div className="space-y-4">
                        <div className="bg-emerald-50/90 border-2 border-[#008049] rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-[#008049]" />
                              <span className="text-xs font-black uppercase text-[#004D2C] tracking-wider">
                                LỰA CHỌN ĐÁP ÁN ĐÚNG (A, B, C HOẶC D)
                              </span>
                            </div>
                            <span className="text-xs font-bold text-emerald-900 bg-white px-3 py-1 rounded-xl border border-emerald-300 shadow-xs">
                              Đang chọn: <strong className="text-[#008049] text-sm font-black">Phương án {correctLetter}</strong>
                              {correctOptText ? ` ("${correctOptText.slice(0, 25)}${correctOptText.length > 25 ? '...' : ''}")` : ''}
                            </span>
                          </div>
                          <p className="text-xs text-emerald-800">
                            Bấm chọn trực tiếp chữ cái <strong>A, B, C hoặc D</strong> bên dưới để đổi đáp án chính xác cho học viên:
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {currentQuestion.options?.map((opt, optIdx) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const isSelected = opt.isCorrect;
                              const col = OPTION_COLORS[optIdx % OPTION_COLORS.length];
                              return (
                                <button
                                  key={opt.id || optIdx}
                                  type="button"
                                  onClick={() => handleToggleCorrectOptionIndex(optIdx)}
                                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-black text-xs sm:text-sm transition-all shadow-sm cursor-pointer border-2 ${
                                    isSelected
                                      ? 'bg-[#008049] text-white border-[#FFCC00] ring-4 ring-[#FFCC00]/50 scale-[1.02] shadow-md'
                                      : 'bg-white text-gray-700 hover:bg-emerald-100/70 border-gray-300 hover:border-emerald-400'
                                  }`}
                                  title={`Chọn ${letter} là đáp án chính xác`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                        isSelected ? 'bg-[#FFCC00] text-[#004D2C]' : `${col.bg} text-white`
                                      }`}
                                    >
                                      {letter}
                                    </span>
                                    <span>Đáp án {letter}</span>
                                  </div>
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                      isSelected
                                        ? 'bg-[#FFCC00] text-[#004D2C]'
                                        : 'border-2 border-gray-300 text-transparent'
                                    }`}
                                  >
                                    ✔
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                              NỘI DUNG CHI TIẾT TỪNG PHƯƠNG ÁN
                            </label>
                            <span className="text-[11px] text-gray-500">
                              (Có thể chỉnh sửa nội dung hoặc thêm bớt phương án)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {currentQuestion.options?.map((opt, optIdx) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const col = OPTION_COLORS[optIdx % OPTION_COLORS.length];
                              const isSelected = opt.isCorrect;
                              return (
                                <div
                                  key={opt.id || optIdx}
                                  className={`flex flex-col gap-2 p-3.5 rounded-2xl border-2 transition-all bg-white ${
                                    isSelected
                                      ? 'border-[#008049] ring-2 ring-[#008049]/30 bg-emerald-50/50 shadow-sm'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shadow-xs ${
                                          isSelected ? 'bg-[#008049] text-[#FFCC00]' : `${col.bg} text-white`
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <span className="text-xs font-black text-gray-700">
                                        Phương án {letter}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleCorrectOptionIndex(optIdx)}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#008049] text-white shadow-xs font-black'
                                          : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-[#008049]'
                                      }`}
                                      title={`Chọn phương án ${letter} là đúng`}
                                    >
                                      <div
                                        className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center text-[8px] ${
                                          isSelected ? 'border-white bg-[#FFCC00] text-[#004D2C]' : 'border-gray-400 bg-white'
                                        }`}
                                      >
                                        {isSelected && '✔'}
                                      </div>
                                      <span>{isSelected ? 'Đúng' : 'Chọn đúng'}</span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-2 pt-1">
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) => {
                                        const updatedOpts = [...(currentQuestion.options || [])];
                                        updatedOpts[optIdx] = { ...updatedOpts[optIdx], text: e.target.value };
                                        handleUpdateActiveQuestion({ options: updatedOpts });
                                      }}
                                      placeholder={`Nhập nội dung phương án ${letter}...`}
                                      className="flex-1 font-bold text-xs sm:text-sm bg-gray-50/50 hover:bg-white focus:bg-white px-3 py-2 rounded-xl border border-gray-200 focus:border-[#008049] outline-none text-gray-800 transition-colors"
                                    />

                                    {(currentQuestion.options?.length || 0) > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedOpts = (currentQuestion.options || []).filter((_, i) => i !== optIdx);
                                          if (opt.isCorrect && updatedOpts.length > 0) {
                                            updatedOpts[0].isCorrect = true;
                                          }
                                          handleUpdateActiveQuestion({ options: updatedOpts });
                                        }}
                                        className="text-gray-300 hover:text-red-500 p-1 transition-colors cursor-pointer"
                                        title="Xóa phương án này"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {(currentQuestion.options?.length || 0) < 6 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newOptIdx = (currentQuestion.options?.length || 0) + 1;
                              const newLetter = String.fromCharCode(64 + newOptIdx);
                              const newOpt: OptionItem = {
                                id: 'opt_' + Date.now(),
                                text: `Phương án lựa chọn ${newLetter}`,
                                isCorrect: false,
                              };
                              handleUpdateActiveQuestion({
                                options: [...(currentQuestion.options || []), newOpt],
                              });
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-dashed border-gray-300 text-xs font-bold text-gray-600 hover:border-[#008049] hover:text-[#008049] transition-all bg-white cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-[#008049]" />
                            <span>Thêm phương án lựa chọn ({String.fromCharCode(65 + (currentQuestion.options?.length || 0))})</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* TRUE / FALSE */}
                  {currentQuestion.type === 'true_false' && (() => {
                    const isTrueCorrect = Boolean(currentQuestion.options?.[0]?.isCorrect);
                    const trueText = currentQuestion.options?.[0]?.text || 'Đúng';
                    const falseText = currentQuestion.options?.[1]?.text || 'Sai';
                    return (
                      <div className="space-y-4">
                        <div className="bg-emerald-50/90 border-2 border-[#008049] rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-[#008049]" />
                              <span className="text-xs font-black uppercase text-[#004D2C] tracking-wider">
                                LỰA CHỌN: ĐÚNG HOẶC SAI
                              </span>
                            </div>
                            <span className="text-xs font-bold text-emerald-900 bg-white px-3 py-1 rounded-xl border border-emerald-300 shadow-xs">
                              Đáp án chính xác:{' '}
                              <strong className={isTrueCorrect ? 'text-[#008049] text-sm font-black' : 'text-red-600 text-sm font-black'}>
                                {isTrueCorrect ? 'ĐÚNG' : 'SAI'}
                              </strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => handleSetTrueFalseCorrect(true)}
                              className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer border-2 ${
                                isTrueCorrect
                                  ? 'bg-[#008049] text-white border-[#FFCC00] ring-4 ring-[#FFCC00]/50 scale-[1.02] shadow-md'
                                  : 'bg-white text-gray-700 hover:bg-emerald-100/70 border-gray-300 hover:border-emerald-400'
                              }`}
                              title="Chọn ĐÚNG là đáp án chính xác"
                            >
                              <span className="text-lg">✔</span>
                              <span>ĐÚNG</span>
                              {isTrueCorrect && (
                                <span className="bg-[#FFCC00] text-[#004D2C] text-[10px] px-2 py-0.5 rounded-full font-black">
                                  CHỌN ĐÚNG
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetTrueFalseCorrect(false)}
                              className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer border-2 ${
                                !isTrueCorrect
                                  ? 'bg-red-600 text-white border-[#FFCC00] ring-4 ring-[#FFCC00]/50 scale-[1.02] shadow-md'
                                  : 'bg-white text-gray-700 hover:bg-red-50 border-gray-300 hover:border-red-300'
                              }`}
                              title="Chọn SAI là đáp án chính xác"
                            >
                              <span className="text-lg">✖</span>
                              <span>SAI</span>
                              {!isTrueCorrect && (
                                <span className="bg-[#FFCC00] text-[#004D2C] text-[10px] px-2 py-0.5 rounded-full font-black">
                                  CHỌN SAI
                                </span>
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black uppercase text-gray-600 tracking-wider">
                              CHI TIẾT NHÃN HIỂN THỊ
                            </label>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div
                              onClick={() => handleSetTrueFalseCorrect(true)}
                              className={`p-5 rounded-2xl border-3 cursor-pointer text-center transition-all bg-white ${
                                isTrueCorrect
                                  ? 'border-[#008049] bg-emerald-50/70 shadow-md ring-2 ring-[#008049]/30'
                                  : 'border-gray-200 hover:border-emerald-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                <span className="text-xs font-black text-[#008049] uppercase">
                                  Phương án
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    isTrueCorrect
                                      ? 'bg-[#008049] text-white'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {isTrueCorrect ? 'Đúng' : 'Nhấp chọn'}
                                </span>
                              </div>
                              <div className="text-2xl font-black text-[#008049] mb-3">ĐÚNG</div>
                              <input
                                type="text"
                                value={trueText}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const updatedOpts = [
                                    { id: 'tf_1', text: e.target.value, isCorrect: isTrueCorrect },
                                    { id: 'tf_2', text: falseText, isCorrect: !isTrueCorrect },
                                  ];
                                  handleUpdateActiveQuestion({ options: updatedOpts });
                                }}
                                placeholder="Nhập nhãn phương án đúng..."
                                className="w-full text-center font-bold text-xs px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#008049] outline-none"
                              />
                            </div>

                            <div
                              onClick={() => handleSetTrueFalseCorrect(false)}
                              className={`p-5 rounded-2xl border-3 cursor-pointer text-center transition-all bg-white ${
                                !isTrueCorrect
                                  ? 'border-red-500 bg-red-50/70 shadow-md ring-2 ring-red-400/30'
                                  : 'border-gray-200 hover:border-red-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                <span className="text-xs font-black text-red-600 uppercase">
                                  Phương án
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    !isTrueCorrect
                                      ? 'bg-red-600 text-white'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}
                                >
                                  {!isTrueCorrect ? 'Đúng' : 'Nhấp chọn'}
                                </span>
                              </div>
                              <div className="text-2xl font-black text-red-600 mb-3">SAI</div>
                              <input
                                type="text"
                                value={falseText}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const updatedOpts = [
                                    { id: 'tf_1', text: trueText, isCorrect: isTrueCorrect },
                                    { id: 'tf_2', text: e.target.value, isCorrect: !isTrueCorrect },
                                  ];
                                  handleUpdateActiveQuestion({ options: updatedOpts });
                                }}
                                placeholder="Nhập nhãn phương án Sai..."
                                className="w-full text-center font-bold text-xs px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 focus:border-red-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* EXTERNAL EMBED MINI-GAME */}
                  {currentQuestion.type === 'external_embed' && (
                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-300 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-[#004D2C] flex items-center gap-1.5">
                          <Code2 className="w-4 h-4 text-[#008049]" />
                          CẤU HÌNH MINI-GAME NHÚNG GOOGLE AI STUDIO
                        </span>
                        <button
                          type="button"
                          onClick={() => setTestEmbedModalHtml(currentQuestion.externalGameConfig?.embedHtml || embedHtml)}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 hover:bg-emerald-100 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Chạy thử Sandbox</span>
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Tiêu đề mini-game hiển thị
                        </label>
                        <input
                          type="text"
                          value={currentQuestion.externalGameConfig?.title || ''}
                          onChange={(e) => {
                            const cfg = currentQuestion.externalGameConfig || {
                              sourceType: 'ai_studio_html',
                              title: '',
                              instruction: '',
                              maxScore: 1000,
                              timeLimitSeconds: 45,
                            };
                            handleUpdateActiveQuestion({
                              externalGameConfig: { ...cfg, title: e.target.value },
                            });
                          }}
                          className="w-full px-3 py-2 bg-white rounded-xl border border-gray-300 font-bold text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Mã nguồn HTML Game (Hỗ trợ postMessage về LMS):
                        </label>
                        <textarea
                          rows={6}
                          value={currentQuestion.externalGameConfig?.embedHtml || ''}
                          onChange={(e) => {
                            const cfg = currentQuestion.externalGameConfig || {
                              sourceType: 'ai_studio_html',
                              title: '',
                              instruction: '',
                              maxScore: 1000,
                              timeLimitSeconds: 45,
                            };
                            handleUpdateActiveQuestion({
                              externalGameConfig: { ...cfg, embedHtml: e.target.value },
                            });
                          }}
                          className="w-full font-mono text-xs p-3 bg-slate-900 text-emerald-400 rounded-xl border border-gray-300"
                        />
                      </div>
                    </div>
                  )}

                  {/* PEDAGOGICAL EXPLANATION */}
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-600 mb-1.5 tracking-wider flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      LỜI GIẢI THÍCH &amp; GHI CHÚ KIẾN THỨC BỔ TRỢ
                    </label>
                    <textarea
                      rows={2}
                      value={currentQuestion.description || ''}
                      onChange={(e) => handleUpdateActiveQuestion({ description: e.target.value })}
                      placeholder="Nội dung giải thích này sẽ hiển thị cho học viên sau khi kết thúc đếm ngược hoặc trong phòng tổng kết..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 outline-none focus:border-[#008049]"
                    />
                  </div>

                  {/* SAVE & PREVIEW BOTTOM ACTION BAR */}
                  <div className="pt-5 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewQuestionModal(currentQuestion)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-emerald-600" />
                      <span>Xem Trước Trải Nghiệm Học Viên</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuiz}
                      disabled={isSaving}
                      className="flex items-center gap-2 bg-[#008049] hover:bg-[#006037] text-white px-7 py-3 rounded-2xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-5 h-5 text-[#FFCC00]" />
                      <span>{isSaving ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI VÀO LMS'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <QuestionIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="font-bold">Chưa chọn câu hỏi để chỉnh sửa.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: CENTRAL QUESTION BANK ===================== */}
      {activeAdminTab === 'bank' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <span className="text-xs font-black uppercase text-[#004D2C] tracking-wider">
                Kho Học Liệu Tập Trung
              </span>
              <h2 className="text-xl font-black text-[#004D2C]">
                Ngân Hàng Câu Hỏi Trắc Nghiệm BIDV ({allBankQuestions.length} câu)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Tìm kiếm, tái sử dụng và nạp nhanh câu hỏi vào bộ đề đang biên soạn
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600">Đang soạn:</span>
              <span className="text-xs font-black bg-emerald-50 text-[#008049] px-2.5 py-1 rounded-lg border border-emerald-200">
                {title} ({questions.length} câu)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Tìm câu hỏi, từ khóa, khái niệm..."
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-gray-300 text-xs font-bold outline-none"
              />
            </div>

            <select
              value={bankCategoryFilter}
              onChange={(e) => setBankCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-white rounded-xl border border-gray-300 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="all">Tất cả danh mục nghiệp vụ</option>
              <option value="Nghiệp vụ BIDV">Nghiệp vụ BIDV</option>
              <option value="Ngân hàng số BIDV">Ngân hàng số BIDV</option>
              <option value="Bảo mật & Tuân thủ">Bảo mật & Tuân thủ</option>
              <option value="Văn hóa & Tác phong">Văn hóa & Tác phong</option>
            </select>

            <select
              value={bankTypeFilter}
              onChange={(e) => setBankTypeFilter(e.target.value)}
              className="px-3 py-2 bg-white rounded-xl border border-gray-300 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="all">Tất cả loại trắc nghiệm</option>
              <option value="multiple_choice">Trắc nghiệm 4 đáp án</option>
              <option value="true_false">Trắc nghiệm Đúng / Sai</option>
              <option value="external_embed">Mini-Game nhúng</option>
            </select>
          </div>

          <div className="space-y-3">
            {filteredBankQuestions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-bold text-sm">Không tìm thấy câu hỏi phù hợp bộ lọc.</p>
              </div>
            ) : (
              filteredBankQuestions.map((item, idx) => {
                const q = item.question;
                return (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-2xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#004D2C] text-[#FFCC00]">
                          {item.quizCategory}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                          Thuộc: {item.quizTitle}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700">
                          {q.type === 'multiple_choice'
                            ? 'Trắc nghiệm 4 đáp án'
                            : q.type === 'true_false'
                            ? 'Đúng/Sai'
                            : 'Nhúng AI Studio'}
                        </span>
                        <span className="text-[10px] text-gray-400">• {q.timeLimit}s</span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900">{q.title}</h4>
                      {q.description && (
                        <p className="text-xs text-gray-500 italic">Ghi chú: {q.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPreviewQuestionModal(q)}
                        className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer"
                        title="Xem trước"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleImportQuestionFromBank(q)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#008049] hover:bg-[#006037] text-white font-bold text-xs shadow transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#FFCC00]" />
                        <span>Nạp vào đề này</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 3: EXTERNAL EMBED IMPORT (HƯỚNG B) ===================== */}
      {activeAdminTab === 'external' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#004D2C] text-[#FFCC00]">
              Hướng B: Game Nhúng Từ Bên Ngoài
            </span>
            <h2 className="text-xl font-black text-[#004D2C] mt-1">
              Nhúng Mini-Game Tương Tác Google AI Studio (HTML Export)
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Giảng viên có thể nhúng các mini-game do Google AI Studio tạo dạng link/HTML export, gắn vào các vòng chơi xen kẽ câu hỏi trắc nghiệm thông thường. Kết quả tự động trả về qua giao thức <code>postMessage</code> để cộng điểm thời gian thực.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Tên vòng chơi / thử thách
              </label>
              <input
                type="text"
                value={externalTitle}
                onChange={(e) => setExternalTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Mã nguồn HTML Game (Đã tích hợp postMessage gửi điểm về LMS):
              </label>
              <textarea
                rows={10}
                value={embedHtml}
                onChange={(e) => setEmbedHtml(e.target.value)}
                className="w-full font-mono text-xs p-4 bg-slate-900 text-emerald-400 rounded-2xl border border-gray-300"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTestEmbedModalHtml(embedHtml)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-[#008049]" />
                <span>Chạy Thử Nghiệm Sandbox</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddNewQuestion('external_embed');
                  setActiveAdminTab('editor');
                }}
                className="flex items-center gap-2 bg-[#008049] hover:bg-[#006037] text-white px-5 py-2.5 rounded-xl font-black text-xs shadow transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FFCC00]" />
                <span>Thêm Vào Vòng Chơi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: GEMINI AI ASSISTANT ===================== */}
      {activeAdminTab === 'ai' && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 shadow-sm border border-amber-200 space-y-6">
          <div className="border-b border-amber-200/80 pb-4">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-200 text-amber-900">
              Trợ Lý Tạo Sinh Câu Hỏi
            </span>
            <h2 className="text-xl font-black text-[#004D2C] mt-1 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-600" />
              <span>Sinh Tự Động Đề Thi Trắc Nghiệm Với Gemini AI</span>
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Nhập chủ đề chuyên môn ngân hàng hoặc tình huống tác nghiệp, AI sẽ tự động phân tích và tạo bộ câu hỏi trắc nghiệm hoàn chỉnh cho giảng viên tinh chỉnh và giảng dạy.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Chủ đề hoặc tình huống nghiệp vụ cần kiểm tra:
              </label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="VD: Kiểm tra quy trình mở tài khoản đẹp qua BIDV SmartBanking và tính năng gửi tiết kiệm online"
                className="w-full px-4 py-3 bg-white rounded-2xl border-2 border-amber-300 font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-700">Số lượng câu hỏi:</label>
              <select
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer"
              >
                <option value={3}>3 câu hỏi</option>
                <option value={4}>4 câu hỏi (Chuẩn)</option>
                <option value={6}>6 câu hỏi</option>
                <option value={8}>8 câu hỏi</option>
              </select>
            </div>

            <div>
              <button
                type="button"
                disabled={isAiGenerating}
                onClick={handleGenerateAiQuiz}
                className="flex items-center gap-2 bg-[#008049] hover:bg-[#006037] text-white px-7 py-3.5 rounded-2xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                <span>{isAiGenerating ? 'GEMINI ĐANG PHÂN TÍCH & TẠO CÂU HỎI TRẮC NGHIỆM...' : 'SINH ĐỀ TRẮC NGHIỆM BẰNG GEMINI AI'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: QUESTION LIVE PREVIEW ===================== */}
      {previewQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border-4 border-[#008049] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#004D2C] text-[#FFCC00]">
                  Xem Trước (Live Preview)
                </span>
                <span className="text-xs text-gray-500 font-bold">
                  {previewQuestionModal.type === 'multiple_choice'
                    ? 'Trắc nghiệm 4 đáp án'
                    : previewQuestionModal.type === 'true_false'
                    ? 'Đúng / Sai'
                    : 'Mini-Game nhúng'}
                </span>
              </div>
              <button
                onClick={() => setPreviewQuestionModal(null)}
                className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gradient-to-b from-[#004D2C] to-[#008049] rounded-2xl p-6 text-white text-center space-y-3">
              <span className="text-xs font-black text-[#FFCC00] uppercase tracking-wider">
                Thời gian: {previewQuestionModal.timeLimit}s | Điểm: {previewQuestionModal.points}
              </span>
              <h3 className="text-lg sm:text-xl font-black">{previewQuestionModal.title}</h3>
              {previewQuestionModal.mediaUrl && (
                <img
                  src={previewQuestionModal.mediaUrl}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-xl border border-white/20 mx-auto"
                />
              )}
            </div>

            {previewQuestionModal.type === 'multiple_choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {previewQuestionModal.options?.map((opt, i) => {
                  const col = OPTION_COLORS[i % OPTION_COLORS.length];
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border-2 font-bold text-xs flex items-center justify-between ${
                        opt.isCorrect
                          ? 'border-[#008049] bg-emerald-50 text-[#008049]'
                          : 'border-gray-200 bg-white text-gray-700'
                      }`}
                    >
                      <span>
                        <strong className="mr-1.5">{col.label}.</strong> {opt.text}
                      </span>
                      {opt.isCorrect && <span className="text-emerald-600 font-black">✔ Đúng</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {previewQuestionModal.type === 'true_false' && (
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`p-4 rounded-xl border-2 text-center font-bold text-sm ${
                    previewQuestionModal.options?.[0]?.isCorrect
                      ? 'border-[#008049] bg-emerald-50 text-[#008049]'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  ✔ ĐÚNG {previewQuestionModal.options?.[0]?.isCorrect && '(Đáp án đúng)'}
                </div>
                <div
                  className={`p-4 rounded-xl border-2 text-center font-bold text-sm ${
                    previewQuestionModal.options?.[1]?.isCorrect
                      ? 'border-red-500 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  ✖ SAI {previewQuestionModal.options?.[1]?.isCorrect && '(Đáp án đúng)'}
                </div>
              </div>
            )}

            {previewQuestionModal.description && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900">
                <strong>Giải thích sau câu hỏi:</strong> {previewQuestionModal.description}
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setPreviewQuestionModal(null)}
                className="bg-[#008049] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Đóng xem trước
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: SANDBOX TEST MINI-GAME ===================== */}
      {testEmbedModalHtml && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border-4 border-[#008049] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <h3 className="font-black text-sm text-[#004D2C] flex items-center gap-1.5">
                <Play className="w-4 h-4 fill-current text-emerald-600" />
                <span>Chạy Thử Nghiệm Sandbox Mini-Game (Iframe Isolation)</span>
              </h3>
              <button onClick={() => setTestEmbedModalHtml(null)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="border border-gray-300 rounded-2xl overflow-hidden min-h-[380px] bg-slate-900">
              <iframe
                title="Sandbox Mini-Game Test"
                srcDoc={testEmbedModalHtml}
                className="w-full h-[380px] border-none"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setTestEmbedModalHtml(null)}
                className="bg-[#008049] text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Đóng Sandbox
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CONFIRM DELETE QUESTION ===================== */}
      {questionToDelete !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-red-200">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-center text-gray-900 mb-1">
              Xóa Câu Hỏi #{questionToDelete + 1}?
            </h3>
            <p className="text-xs text-gray-600 text-center mb-3 line-clamp-3 bg-gray-50 p-3 rounded-xl border border-gray-200 font-medium">
              "{questions[questionToDelete]?.title || 'Câu hỏi này'}"
            </p>
            <p className="text-xs text-red-600 text-center font-bold mb-6">
              Hành động này sẽ xóa hoàn toàn câu hỏi khỏi đề thi.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setQuestionToDelete(null)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                id="btn-confirm-delete-question"
                onClick={() => executeDeleteQuestion(questionToDelete)}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-lg transition-colors cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CONFIRM DELETE QUIZ ===================== */}
      {showDeleteQuizModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-red-200">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-center text-gray-900 mb-1">
              Xóa Toàn Bộ Đề Thi?
            </h3>
            <p className="text-xs text-gray-600 text-center mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200 font-bold">
              "{title}"
            </p>
            <p className="text-xs text-red-600 text-center font-bold mb-6">
              Toàn bộ {questions.length} câu hỏi trong đề này sẽ bị xóa khỏi LMS.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteQuizModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={executeDeleteQuiz}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-lg transition-colors cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: CONFIRM RESET DEFAULTS ===================== */}
      {showResetDefaultsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-amber-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-center text-gray-900 mb-1">
              Khôi Phục Đề Thi Mẫu?
            </h3>
            <p className="text-xs text-gray-600 text-center mb-6 leading-relaxed">
              Hệ thống sẽ tải lại toàn bộ các bộ đề chuẩn ban đầu của BIDV EduPlay.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetDefaultsModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={executeResetDefaults}
                className="flex-1 py-3 rounded-xl bg-[#008049] hover:bg-[#006037] text-white font-black text-xs shadow-lg transition-colors cursor-pointer"
              >
                Khôi phục ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
