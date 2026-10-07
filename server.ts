import express, { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { GameRoom, Player, PlayerAnswerRecord, Quiz, LMSReport, RoomStatus } from './src/types';
import { INITIAL_QUIZZES } from './src/data/sampleQuizzes';
import { calculateKahootScore } from './src/utils/scoring';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Enable CORS for all origins & mobile devices
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// In-memory persistent data stores during server runtime
const quizzesStore = new Map<string, Quiz>();
INITIAL_QUIZZES.forEach((q) => quizzesStore.set(q.id, q));

const ROOMS_FILE_PATH = path.join('/tmp', 'bidv_rooms_store.json');
const PERSISTENT_ROOMS_FILE = path.join(process.cwd(), '.bidv_rooms_cache.json');

function loadRoomsFromDisk(): Map<string, GameRoom> {
  const map = new Map<string, GameRoom>();
  const files = [PERSISTENT_ROOMS_FILE, ROOMS_FILE_PATH];
  for (const filePath of files) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          data.forEach((r: GameRoom) => {
            if (r && r.pin) {
              const clean = String(r.pin).trim().replace(/\D/g, '');
              if (clean) map.set(clean, r);
            }
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to load rooms from ${filePath}:`, err);
    }
  }
  return map;
}

const roomsStore = loadRoomsFromDisk();

function saveRoomsToDisk() {
  try {
    const list = Array.from(roomsStore.values());
    const jsonStr = JSON.stringify(list, null, 2);
    try {
      fs.writeFileSync(PERSISTENT_ROOMS_FILE, jsonStr, 'utf-8');
    } catch (err) {
      console.warn('Failed to save rooms to persistent cache:', err);
    }
    try {
      fs.writeFileSync(ROOMS_FILE_PATH, jsonStr, 'utf-8');
    } catch (err) {
      console.warn('Failed to save rooms to /tmp:', err);
    }
  } catch (err) {
    console.warn('Failed to serialize rooms:', err);
  }
}

function getOrReloadRoom(pin: string): GameRoom | undefined {
  if (!pin) return undefined;
  const cleanPin = String(pin).trim().replace(/\D/g, '');
  if (!cleanPin) return undefined;

  // 1. Direct memory lookup
  let room = roomsStore.get(cleanPin);

  // 2. Loop match in memory (handles any format difference)
  if (!room) {
    for (const [key, r] of roomsStore.entries()) {
      if (key.trim().replace(/\D/g, '') === cleanPin) {
        room = r;
        break;
      }
    }
  }

  // 3. Disk reload if not in memory
  if (!room) {
    const diskRooms = loadRoomsFromDisk();
    room = diskRooms.get(cleanPin);
    if (!room) {
      for (const [key, r] of diskRooms.entries()) {
        if (key.trim().replace(/\D/g, '') === cleanPin) {
          room = r;
          break;
        }
      }
    }
    if (room) {
      roomsStore.set(cleanPin, room);
      console.log(`[BIDV EduPlay] Room ${cleanPin} reloaded from disk.`);
    }
  }

  return room;
}

const sseClients = new Map<string, Set<Response>>(); // pin -> Set of SSE Response objects
const lmsReportsStore: LMSReport[] = [];

// Broadcast helper for real-time room sync
function broadcastRoomUpdate(pin: string) {
  const room = roomsStore.get(pin);
  if (!room) return;
  saveRoomsToDisk();
  const clients = sseClients.get(pin);
  if (clients && clients.size > 0) {
    const payload = `data: ${JSON.stringify(room)}\n\n`;
    clients.forEach((client) => {
      try {
        client.write(payload);
      } catch (err) {
        console.error('SSE client write error:', err);
      }
    });
  }
}

// Generate unique 6-digit numeric PIN
function generatePIN(): string {
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  if (roomsStore.has(pin)) {
    return generatePIN();
  }
  return pin;
}

// Helper bot nicknames for simulation
const BOT_NAMES = [
  'Hà An (CN Hà Nội)',
  'Minh Tuấn (CN Ba Đình)',
  'Phương Anh (CN Hoàn Kiếm)',
  'Đức Thắng (CN Cầu Giấy)',
  'Khánh Linh (CN Đống Đa)',
  'Hoàng Nam (CN Sơn Tây)',
  'Thu Hà (CN Đông Đô)',
  'Bảo Ngọc (CN Bến Thành)',
  'Quang Dũng (CN Chợ Lớn)',
  'Ngọc Mai (CN Thăng Long)',
];

const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐨', '🦄', '🦅', '🐬', '🐙', '🦖', '🚀', '⭐'];

// ----------------- API ROUTES ----------------- //

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// App configuration & public URL info for mobile QR/join
app.get('/api/app-info', (req, res) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = typeof forwardedProto === 'string' ? forwardedProto.split(',')[0].trim() : req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || '';
  const detectedUrl = host ? `${protocol}://${host}` : '';
  const devUrl = process.env.APP_URL || detectedUrl;

  res.json({
    appUrl: devUrl,
    detectedUrl: detectedUrl || devUrl,
    activeRooms: Array.from(roomsStore.keys()),
  });
});

// Get all quizzes
app.get('/api/quizzes', (_req, res) => {
  res.json(Array.from(quizzesStore.values()));
});

// Get single quiz by ID
app.get('/api/quizzes/:id', (req, res) => {
  const { id } = req.params;
  const quiz = quizzesStore.get(id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
  }
  res.json(quiz);
});

// Save/create quiz
app.post('/api/quizzes', (req, res) => {
  const newQuiz = req.body as Quiz;
  if (!newQuiz.id) {
    newQuiz.id = 'quiz_' + Date.now();
  }
  newQuiz.updatedAt = new Date().toISOString();
  if (!newQuiz.createdAt) {
    newQuiz.createdAt = new Date().toISOString();
  }
  quizzesStore.set(newQuiz.id, newQuiz);
  res.json({ success: true, quiz: newQuiz });
});

// Update existing quiz and its questions
app.put('/api/quizzes/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body as Partial<Quiz>;
  const existing = quizzesStore.get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy đề để chỉnh sửa' });
  }
  const updatedQuiz: Quiz = {
    ...existing,
    ...updatedData,
    id, // preserve ID
    updatedAt: new Date().toISOString(),
  };
  quizzesStore.set(id, updatedQuiz);
  res.json({ success: true, quiz: updatedQuiz });
});

// Clone/Duplicate a quiz
app.post('/api/quizzes/:id/clone', (req, res) => {
  const { id } = req.params;
  const sourceQuiz = quizzesStore.get(id);
  if (!sourceQuiz) {
    return res.status(404).json({ error: 'Không tìm thấy đề nguồn' });
  }
  const clonedId = 'quiz_' + Date.now();
  const clonedQuiz: Quiz = {
    ...sourceQuiz,
    id: clonedId,
    title: `${sourceQuiz.title} (Bản sao)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPreset: false,
    questions: sourceQuiz.questions.map((q) => ({
      ...q,
      id: 'q_' + Math.random().toString(36).substring(2, 9),
    })),
  };
  quizzesStore.set(clonedId, clonedQuiz);
  res.json({ success: true, quiz: clonedQuiz });
});

// Update a specific question in a quiz
app.put('/api/quizzes/:id/questions/:questionId', (req, res) => {
  const { id, questionId } = req.params;
  const updatedQuestion = req.body;
  const quiz = quizzesStore.get(id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
  }
  const index = quiz.questions.findIndex((q) => q.id === questionId);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy câu hỏi trong đề' });
  }
  quiz.questions[index] = { ...quiz.questions[index], ...updatedQuestion, id: questionId };
  quiz.updatedAt = new Date().toISOString();
  quizzesStore.set(id, quiz);
  res.json({ success: true, question: quiz.questions[index], quiz });
});

// Add a question to an existing quiz
app.post('/api/quizzes/:id/questions', (req, res) => {
  const { id } = req.params;
  const newQuestion = req.body;
  const quiz = quizzesStore.get(id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
  }
  if (!newQuestion.id) {
    newQuestion.id = 'q_' + Date.now();
  }
  quiz.questions.push(newQuestion);
  quiz.updatedAt = new Date().toISOString();
  quizzesStore.set(id, quiz);
  res.json({ success: true, question: newQuestion, quiz });
});

// Delete a question from a quiz
app.delete('/api/quizzes/:id/questions/:questionId', (req, res) => {
  const { id, questionId } = req.params;
  const quiz = quizzesStore.get(id);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
  }
  quiz.questions = quiz.questions.filter((q) => q.id !== questionId);
  quiz.updatedAt = new Date().toISOString();
  quizzesStore.set(id, quiz);
  res.json({ success: true, quiz });
});

// Reset to default sample quizzes
app.post('/api/quizzes/reset-defaults', (_req, res) => {
  quizzesStore.clear();
  INITIAL_QUIZZES.forEach((q) => quizzesStore.set(q.id, JSON.parse(JSON.stringify(q))));
  res.json({ success: true, quizzes: Array.from(quizzesStore.values()) });
});

// Delete quiz
app.delete('/api/quizzes/:id', (req, res) => {
  const { id } = req.params;
  quizzesStore.delete(id);
  res.json({ success: true });
});

// Create a new Game Room
app.post('/api/rooms/create', (req, res) => {
  const { quizId, hostId = 'host_teacher' } = req.body;
  const quiz = quizzesStore.get(quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
  }
  const pin = generatePIN();
  const room: GameRoom = {
    pin,
    quizId,
    quizTitle: quiz.title,
    hostId,
    status: 'lobby',
    currentQuestionIndex: 0,
    questionStartedAt: 0,
    timeRemaining: 0,
    players: {},
    answers: [],
    createdAt: Date.now(),
  };
  roomsStore.set(pin, room);
  saveRoomsToDisk();
  console.log(`[BIDV EduPlay] Room created: PIN ${pin} for quiz "${quiz.title}"`);
  res.json({ success: true, pin, room });
});

// Sync / restore active room from Host browser
app.post('/api/rooms/sync', (req, res) => {
  const { room } = req.body as { room: GameRoom };
  if (!room || !room.pin) {
    return res.status(400).json({ error: 'Dữ liệu phòng không hợp lệ' });
  }
  const cleanPin = String(room.pin).trim().replace(/\D/g, '');
  const existing = roomsStore.get(cleanPin);
  if (!existing) {
    roomsStore.set(cleanPin, { ...room, pin: cleanPin });
    saveRoomsToDisk();
    console.log(`[BIDV EduPlay] Room ${cleanPin} restored from Host sync.`);
    return res.json({ success: true, action: 'restored', room: roomsStore.get(cleanPin) });
  } else {
    // If host has more up-to-date status or questions
    const merged = { ...existing, ...room, pin: cleanPin };
    roomsStore.set(cleanPin, merged);
    saveRoomsToDisk();
    return res.json({ success: true, action: 'updated', room: merged });
  }
});

// Get room by PIN
app.get('/api/rooms/:pin', (req, res) => {
  const rawPin = req.params.pin;
  const cleanPin = String(rawPin || '').trim().replace(/\D/g, '');
  let room = getOrReloadRoom(cleanPin);

  // If only one room currently exists in lobby/question, match it if pin is close
  if (!room && roomsStore.size === 1) {
    const singleRoom = Array.from(roomsStore.values())[0];
    if (singleRoom.status !== 'finished') {
      room = singleRoom;
    }
  }

  if (!room) {
    return res.status(404).json({
      error: 'Mã PIN phòng không hợp lệ hoặc đã kết thúc',
      queriedPin: cleanPin,
      availablePins: Array.from(roomsStore.keys()),
    });
  }
  res.json(room);
});

// SSE endpoint for live updates
app.get('/api/rooms/:pin/events', (req, res) => {
  const cleanPin = String(req.params.pin || '').trim().replace(/\D/g, '');
  let room = getOrReloadRoom(cleanPin);
  if (!room && roomsStore.size === 1) {
    room = Array.from(roomsStore.values())[0];
  }
  if (!room) {
    return res.status(404).send('Room not found');
  }

  const roomPin = room.pin;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial state immediately
  res.write(`data: ${JSON.stringify(room)}\n\n`);

  // Heartbeat ping every 10 seconds to keep mobile socket alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 10000);

  if (!sseClients.has(roomPin)) {
    sseClients.set(roomPin, new Set());
  }
  sseClients.get(roomPin)!.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(roomPin);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(roomPin);
      }
    }
  });
});

// Player joins room
app.post('/api/rooms/:pin/join', (req, res) => {
  const rawPin = req.params.pin;
  const cleanPin = String(rawPin || '').trim().replace(/\D/g, '');
  const { nickname, avatar, existingPlayerId } = req.body;
  
  console.log(`[BIDV EduPlay] Join request: PIN="${cleanPin}" (raw: "${rawPin}"), nickname="${nickname}"`);
  
  let room = getOrReloadRoom(cleanPin);

  // Fallback: If only 1 room currently in lobby
  if (!room) {
    const allRooms = Array.from(roomsStore.values());
    const lobbyRooms = allRooms.filter((r) => r.status === 'lobby');
    if (lobbyRooms.length === 1) {
      console.log(`[BIDV EduPlay] Fallback: joined only active lobby room ${lobbyRooms[0].pin}`);
      room = lobbyRooms[0];
    }
  }

  if (!room) {
    console.warn(`[BIDV EduPlay] Room not found for PIN "${cleanPin}". Known PINs:`, Array.from(roomsStore.keys()));
    return res.status(404).json({
      error: 'Mã PIN phòng không tồn tại hoặc đã hết hạn. Vui lòng kiểm tra lại mã PIN.',
      queriedPin: cleanPin,
      availablePins: Array.from(roomsStore.keys()),
    });
  }

  if (room.status === 'finished') {
    return res.status(400).json({ error: 'Buổi học này đã kết thúc, không thể tham gia.' });
  }

  // 1. If existingPlayerId provided and matches a player in room: reconnect
  if (existingPlayerId && room.players[existingPlayerId]) {
    broadcastRoomUpdate(room.pin);
    return res.json({ success: true, playerId: existingPlayerId, player: room.players[existingPlayerId], room });
  }

  // 2. If student reconnects with same nickname
  const trimmedName = nickname?.trim();
  if (trimmedName) {
    const matched = Object.values(room.players).find(
      (p) => p.nickname.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (matched) {
      broadcastRoomUpdate(room.pin);
      return res.json({ success: true, playerId: matched.id, player: matched, room });
    }
  }

  const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
  const player: Player = {
    id: playerId,
    nickname: trimmedName || 'Học viên ' + (Object.keys(room.players).length + 1),
    avatar: avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
    score: 0,
    streak: 0,
    joinedAt: Date.now(),
  };

  room.players[playerId] = player;
  broadcastRoomUpdate(room.pin);
  console.log(`[BIDV EduPlay] Player "${player.nickname}" (${player.id}) joined room ${room.pin}. Total: ${Object.keys(room.players).length}`);
  res.json({ success: true, playerId, player, room });
});

// Simulate bot players (For quick lecturer demo and evaluation)
app.post('/api/rooms/:pin/simulate-bots', (req, res) => {
  const { pin } = req.params;
  const { count = 5 } = req.body;
  const room = getOrReloadRoom(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }

  for (let i = 0; i < count; i++) {
    const botId = 'bot_' + Math.random().toString(36).substring(2, 9);
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ' #' + (i + 1);
    room.players[botId] = {
      id: botId,
      nickname: name,
      avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
      score: 0,
      streak: 0,
      joinedAt: Date.now(),
      isBot: true,
    };
  }

  broadcastRoomUpdate(pin);
  res.json({ success: true, playerCount: Object.keys(room.players).length });
});

// Host updates room status
app.post('/api/rooms/:pin/status', (req, res) => {
  const { pin } = req.params;
  const { status, currentQuestionIndex } = req.body as { status: RoomStatus; currentQuestionIndex?: number };
  const room = getOrReloadRoom(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }

  room.status = status;
  if (typeof currentQuestionIndex === 'number') {
    room.currentQuestionIndex = currentQuestionIndex;
  }

  const quiz = quizzesStore.get(room.quizId);

  if (status === 'question' && quiz) {
    const currentQ = quiz.questions[room.currentQuestionIndex];
    room.questionStartedAt = Date.now();
    room.timeRemaining = currentQ ? currentQ.timeLimit : 20;

    const correctCount = currentQ?.options?.filter((o) => o.isCorrect).length || 1;
    room.currentQuestionMeta = currentQ ? {
      type: currentQ.type,
      title: currentQ.title,
      description: currentQ.description,
      mediaUrl: currentQ.mediaUrl,
      optionsCount: currentQ.options?.length || 0,
      correctCount,
      allowMultiSelect: currentQ.type === 'multiple_choice' && correctCount > 1,
      timeLimit: currentQ.timeLimit,
      options: currentQ.options?.map((o) => ({ id: o.id, text: o.text })),
      externalGameConfig: currentQ.externalGameConfig,
    } : undefined;

    // Trigger auto bot answers if bots exist in room
    setTimeout(() => {
      const currentRoom = roomsStore.get(pin);
      if (!currentRoom || currentRoom.status !== 'question') return;

      Object.values(currentRoom.players).forEach((p) => {
        if (!p.isBot) return;

        // Random bot response time between 2s and 10s
        const randomDelay = 2000 + Math.random() * 8000;
        setTimeout(() => {
          if (currentRoom.status !== 'question' || currentRoom.currentQuestionIndex !== room.currentQuestionIndex) return;
          const q = quiz.questions[currentRoom.currentQuestionIndex];
          if (!q) return;

          const isCorrect = Math.random() > 0.3; // 70% bot accuracy
          let pointsEarned = 0;
          if (isCorrect) {
            p.streak = (p.streak || 0) + 1;
            const scoreCalc = calculateKahootScore(randomDelay, q.timeLimit, q.points, p.streak);
            pointsEarned = scoreCalc.points;
            p.score += pointsEarned;
          } else {
            p.streak = 0;
          }
          p.lastAnswerCorrect = isCorrect;
          p.lastPointsEarned = pointsEarned;

          // Pick bot options
          const correctOpts = q.options?.filter((o) => o.isCorrect) || [];
          const wrongOpts = q.options?.filter((o) => !o.isCorrect) || [];
          let botSelectedId = 'opt_1';
          if (isCorrect && correctOpts.length > 0) {
            botSelectedId = correctOpts[Math.floor(Math.random() * correctOpts.length)].id;
          } else if (!isCorrect && wrongOpts.length > 0) {
            botSelectedId = wrongOpts[Math.floor(Math.random() * wrongOpts.length)].id;
          } else if (q.options && q.options.length > 0) {
            botSelectedId = q.options[0].id;
          }

          currentRoom.answers.push({
            playerId: p.id,
            nickname: p.nickname,
            questionId: q.id,
            questionIndex: currentRoom.currentQuestionIndex,
            selectedOptionId: botSelectedId,
            selectedOptionIds: [botSelectedId],
            isCorrect,
            timeMs: randomDelay,
            pointsEarned,
            timestamp: Date.now(),
          });

          broadcastRoomUpdate(pin);
        }, randomDelay);
      });
    }, 500);
  }

  // Recalculate ranks if leaderboard or finished
  if (status === 'leaderboard' || status === 'finished' || status === 'question_result') {
    const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      p.rank = idx + 1;
    });
  }

  broadcastRoomUpdate(pin);
  res.json({ success: true, room });
});

// Player submits answer
app.post('/api/rooms/:pin/answer', (req, res) => {
  const { pin } = req.params;
  const {
    playerId,
    selectedOptionId,
    selectedOptionIds,
    selectedOptionIndex,
    answeredText,
    matchedPairs,
    timeElapsedMs,
  } = req.body;
  const room = getOrReloadRoom(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }
  const quiz = quizzesStore.get(room.quizId);
  if (!quiz) {
    return res.status(404).json({ error: 'Bộ đề không tồn tại' });
  }
  const currentQ = quiz.questions[room.currentQuestionIndex];
  if (!currentQ) {
    return res.status(400).json({ error: 'Không tìm thấy câu hỏi hiện tại' });
  }
  const player = room.players[playerId];
  if (!player) {
    return res.status(404).json({ error: 'Học viên không tồn tại trong phòng' });
  }

  // Check if player already answered this question
  const alreadyAnswered = room.answers.some(
    (a) => a.playerId === playerId && a.questionIndex === room.currentQuestionIndex
  );
  if (alreadyAnswered) {
    return res.status(400).json({ error: 'Bạn đã trả lời câu này rồi' });
  }

  // Grade answer
  let isCorrect = false;
  let canonicalOptionId = selectedOptionId;

  if (currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') {
    const correctOpts = currentQ.options?.filter((o) => o.isCorrect) || [];
    const correctOptIds = correctOpts.map((o) => o.id);

    // Primary: Check by selectedOptionIndex (most reliable from mobile taps)
    if (typeof selectedOptionIndex === 'number' && currentQ.options && currentQ.options[selectedOptionIndex]) {
      isCorrect = Boolean(currentQ.options[selectedOptionIndex].isCorrect);
      canonicalOptionId = currentQ.options[selectedOptionIndex].id;
    } else if (Array.isArray(selectedOptionIds) && selectedOptionIds.length > 0) {
      const hasInvalidOption = selectedOptionIds.some((id) => !correctOptIds.includes(id));
      const hasAtLeastOneCorrect = selectedOptionIds.some((id) => correctOptIds.includes(id));
      isCorrect = !hasInvalidOption && hasAtLeastOneCorrect;
    } else if (selectedOptionId) {
      if (correctOptIds.includes(selectedOptionId)) {
        isCorrect = true;
        canonicalOptionId = selectedOptionId;
      } else if (typeof selectedOptionId === 'string' && selectedOptionId.startsWith('opt_')) {
        // Fallback for hardcoded 'opt_1', 'opt_2' ...
        const optNum = parseInt(selectedOptionId.replace('opt_', ''), 10);
        if (!isNaN(optNum) && optNum >= 1 && currentQ.options && currentQ.options[optNum - 1]) {
          isCorrect = Boolean(currentQ.options[optNum - 1].isCorrect);
          canonicalOptionId = currentQ.options[optNum - 1].id;
        }
      }
    }
  } else if (currentQ.type === 'fill_blank') {
    const normalizedInput = (answeredText || '').trim().toLowerCase();
    const correctAnswers = (currentQ.correctText || '').split(',').map((s) => s.trim().toLowerCase());
    isCorrect = correctAnswers.includes(normalizedInput);
  } else if (currentQ.type === 'match_pairs') {
    if (currentQ.pairs && matchedPairs) {
      isCorrect = currentQ.pairs.every((pair) => matchedPairs[pair.id] === pair.right);
    }
  }

  // Calculate points
  let pointsEarned = 0;
  if (isCorrect) {
    player.streak = (player.streak || 0) + 1;
    const scoreCalc = calculateKahootScore(timeElapsedMs || 3000, currentQ.timeLimit, currentQ.points, player.streak);
    pointsEarned = scoreCalc.points;
    player.score += pointsEarned;
  } else {
    player.streak = 0;
  }

  player.lastAnswerCorrect = isCorrect;
  player.lastPointsEarned = pointsEarned;

  const answerRecord: PlayerAnswerRecord = {
    playerId,
    nickname: player.nickname,
    questionId: currentQ.id,
    questionIndex: room.currentQuestionIndex,
    selectedOptionId: canonicalOptionId || selectedOptionId || (selectedOptionIds?.[0]),
    selectedOptionIds: selectedOptionIds || (canonicalOptionId ? [canonicalOptionId] : undefined),
    answeredText,
    matchedPairs,
    isCorrect,
    timeMs: timeElapsedMs || 3000,
    pointsEarned,
    timestamp: Date.now(),
  };

  room.answers.push(answerRecord);

  // Recalculate rank
  const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
  sorted.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  broadcastRoomUpdate(pin);

  res.json({
    success: true,
    isCorrect,
    pointsEarned,
    totalScore: player.score,
    streak: player.streak,
    rank: player.rank,
  });
});

// External game completion endpoint (Google AI Studio HTML embed postMessage bridge)
app.post('/api/rooms/:pin/external-result', (req, res) => {
  const { pin } = req.params;
  const { playerId, score } = req.body;
  const room = getOrReloadRoom(pin);
  if (!room) {
    return res.status(404).json({ error: 'Phòng không tồn tại' });
  }

  const player = room.players[playerId];
  if (player) {
    const points = Math.min(1000, Math.max(0, Number(score) || 0));
    player.score += points;
    player.lastAnswerCorrect = points > 0;
    player.lastPointsEarned = points;

    room.answers.push({
      playerId,
      nickname: player.nickname,
      questionId: 'external_round_' + room.currentQuestionIndex,
      questionIndex: room.currentQuestionIndex,
      isCorrect: points > 0,
      timeMs: 15000,
      pointsEarned: points,
      timestamp: Date.now(),
    });

    const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    broadcastRoomUpdate(pin);
    return res.json({ success: true, totalScore: player.score, rank: player.rank });
  }
  res.json({ success: true });
});

// AI Quiz Generation using Gemini API
app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const { topic = 'Ngân hàng số BIDV & Bảo mật giao dịch', questionCount = 4 } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập trong Secrets của AI Studio.',
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Bạn là chuyên gia ra đề thi trắc nghiệm trực tuyến cho Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV).
Hãy tạo một bộ đề trắc nghiệm gồm ${questionCount} câu hỏi xoay quanh chủ đề: "${topic}".
Mỗi câu hỏi phải theo hình thức trắc nghiệm: trắc nghiệm 4 lựa chọn (multiple_choice) hoặc trắc nghiệm Đúng/Sai (true_false).
TUYỆT ĐỐI CHỈ TRẢ VỀ định dạng JSON hợp lệ (không kèm markdown, không thêm text ngoài JSON) theo cấu trúc sau:
{
  "title": "Tên bài thi trắc nghiệm...",
  "description": "Mô tả ngắn gọn về bộ đề...",
  "category": "Danh mục nghiệp vụ...",
  "questions": [
    {
      "id": "q_1",
      "type": "multiple_choice",
      "title": "Nội dung câu hỏi trắc nghiệm...",
      "timeLimit": 20,
      "points": 1000,
      "options": [
        { "id": "opt_1", "text": "Phương án A", "isCorrect": false },
        { "id": "opt_2", "text": "Phương án B (Chính xác)", "isCorrect": true },
        { "id": "opt_3", "text": "Phương án C", "isCorrect": false },
        { "id": "opt_4", "text": "Phương án D", "isCorrect": false }
      ]
    },
    {
      "id": "q_2",
      "type": "true_false",
      "title": "Nhận định sau Đúng hay Sai...",
      "timeLimit": 15,
      "points": 1000,
      "options": [
        { "id": "tf_1", "text": "Đúng", "isCorrect": true },
        { "id": "tf_2", "text": "Sai", "isCorrect": false }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);

    const newQuiz: Quiz = {
      id: 'quiz_ai_' + Date.now(),
      title: parsedData.title || `Trắc nghiệm ${topic}`,
      description: parsedData.description || `Bộ câu hỏi do AI tạo tự động về ${topic}`,
      category: parsedData.category || 'Tài chính Ngân hàng',
      coverImage: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: parsedData.questions || [],
    };

    quizzesStore.set(newQuiz.id, newQuiz);
    res.json({ success: true, quiz: newQuiz });
  } catch (error: any) {
    console.error('AI generate error:', error);
    res.status(500).json({ error: 'Lỗi khi tạo câu hỏi qua Gemini: ' + (error.message || error) });
  }
});

// LMS Integration: Save session report into LMS Gradebook
app.post('/api/lms/save-report', (req, res) => {
  const report = req.body as LMSReport;
  report.id = 'lms_report_' + Date.now();
  report.completedAt = new Date().toISOString();
  lmsReportsStore.unshift(report);
  res.json({ success: true, reportId: report.id });
});

// LMS Integration: Get saved reports
app.get('/api/lms/reports', (_req, res) => {
  res.json(lmsReportsStore);
});

// ----------------- VITE / STATIC SERVING ----------------- //

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(__dirname, 'index.html'))
      ? __dirname
      : path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BIDV EduPlay] Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
