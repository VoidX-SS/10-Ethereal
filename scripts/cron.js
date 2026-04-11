import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config(); // Loads .env if testing locally

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const statePath = path.join(__dirname, '../public/data/state.json');
const historyPath = path.join(__dirname, '../public/data/history.json');

let adminApp;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  adminApp = initializeApp({ credential: cert(serviceAccount) });
} else {
  adminApp = initializeApp();
}
const db = getFirestore(adminApp);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// USING RAW SPECIFIED MODEL: gemini-3.1-flash-lite-preview
const model = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-lite-preview',
  generationConfig: { responseMimeType: "application/json" }
});

async function runCron() {
  console.log("Starting 10 Ethereal Cron Job with gemini-3.1-flash-lite-preview...");
  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  const stateDoc = await db.collection('game_data').doc('state').get();
  let gameState = stateDoc.data();
  if (!gameState || !gameState.world) {
    gameState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }

  const historyDoc = await db.collection('game_data').doc('history').get();
  let chatHistory = historyDoc.exists ? historyDoc.data().messages : null;
  if (!chatHistory) {
    chatHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }

  const speakerId = gameState.world.next_speaker || 'char_A';
  const speaker = gameState.characters.find(c => c.id === speakerId);
  const other = gameState.characters.find(c => c.id !== speakerId);

  // ==========================================
  // PHASE 1: CHARACTER THINKS AND SPEAKS
  // ==========================================
  const charPrompt = `
  Chỉ thị bí mật (Roleplay): ${speaker.roleplay_prompt}
  Bạn đang nhập vai nhân vật: ${speaker.stats.name}.
  
  CHI TIẾT MÔI TRƯỜNG:
  Môi trường hiện tại: ${gameState.world.environment}. Thời gian: ${gameState.world.time}.
  Chủ đề câu chuyện: ${gameState.world.current_topic}.
  Sự kiện ngầm vừa xảy ra khoảng thời gian qua (Nếu có): ${gameState.world.last_event || "Không có"}. (Lưu ý: Nếu có sự kiện ngầm được đề cập, hãy suy luận cảm xúc của bạn từ sự kiện này!).
  
  CHI TIẾT TOÀN BỘ CHỈ SỐ CÁ NHÂN CỦA BẠN (HÃY BÁM SÁT VÀO ĐÂY ĐỂ ĐỘNG NÃO LẬP LUẬN):
  - Hồ sơ: Tuổi/DOB: ${speaker.stats.date_of_birth}, C/V: ${speaker.stats.job} (CÔNG VIỆC ẢNH HƯỞNG ĐỜI SỐNG), Vị trí/Tư thế hiện tại: ${speaker.stats.position} (VỊ TRÍ ẢNH HƯỞNG QUYẾT ĐỊNH VÀ ĐỜI SỐNG).
  - Trạng thái: Health: ${speaker.stats.health} (THỂ HIỆN KHẢ NĂNG HÀNH VI HIỆN TẠI), Look: ${speaker.stats.look} (THỂ HIỆN BẢN THÂN VÀ ẢNH HƯỞNG NGƯỜI XUNG QUANH), IQ: ${speaker.stats.iq} (THỂ HIỆN TRÍ THÔNG MINH HIỆN TẠI), EQ: ${speaker.stats.eq} (KHẢ NĂNG GIAO TIẾP XÃ HỘI).
  - Sâu thẳm: Niềm tin: ${speaker.stats.faith}, Ước mơ: ${speaker.stats.passion}, Vết thương lòng: ${speaker.stats.emotional_pain}. Yêu/Ghét: ${speaker.stats.love_hates}. Điểm mạnh/Điểm yếu: ${speaker.stats.pros_cons}. (TẤT CẢ NHỮNG ĐIỀU NÀY ẢNH HƯỞNG SÂU SẮC ĐẾN QUYẾT ĐỊNH VÀ ĐỜI SỐNG LÂU DÀI).
  - Bản sắc: Cởi mở ${speaker.stats.openness} (THẤP BẢO THỦ, CAO SÁNG TẠO), Tận tâm ${speaker.stats.dedicate} (THẤP TÙY HỨNG, CAO KỶ LUẬT), Khuynh hướng ${speaker.stats.tendency} (THẤP HƯỚNG NỘI, CAO HƯỚNG NGOẠI), Hòa đồng ${speaker.stats.sociable} (THẤP HUNG ÁC, CAO HIỀN LÀNH), Ổn định ${speaker.stats.stability} (THẤP LO ÂU, CAO BÌNH THẢN).
  - Sinh lý: Năng lượng ${speaker.stats.energy} (THẤP MỆT MỎI, CAO TỈNH TÁO), Dinh dưỡng ${speaker.stats.nutrient} (THẤP ĐÓI KHÁT, CAO NO), Nhiệt độ ${speaker.stats.temperature} (THẤP LẠNH, CAO NÓNG), Thoải mái ${speaker.stats.comfortable} (THẤP ĐAU ĐỚN, CAO DỄ CHỊU), Stress ${speaker.stats.stress} (THẤP THƯ GIÃN, CAO CĂNG THẲNG), Hưng phấn ${speaker.stats.excitement} (THẤP LƠ MƠ, CAO KÍCH ĐỘNG).
  - Tâm lý: Vui vẻ ${speaker.stats.pleasure} (THẤP BUỒN, CAO VUI), Kích thích ${speaker.stats.arousal} (THẤP CHÁN NẢN, CAO KÍCH THÍCH), Thống trị ${speaker.stats.domination} (THẤP SỢ HÃI, CAO TỰ TIN), Ý chí ${speaker.stats.will_power} (THẤP BUÔNG XUÔI, CAO KIÊN ĐỊNH), Niềm tin/Hy vọng ${speaker.stats.faith_index} (THẤP TUYỆT VỌNG, CAO CÓ HY VỌNG).
  - Nhận thức: Cán cân logic/cảm xúc ${speaker.stats.logic_emotion} (THẤP DÙNG LOGIC, CAO DÙNG CẢM TÍNH), Tập trung ${speaker.stats.focus_spain} (THẤP XAO NHÃNG, CAO SIÊU TẬP TRUNG), Thiên kiến ${speaker.stats.bias} (SUY LUẬN THEO THIÊN KIẾN: THẤP KHÔNG CÓ, CAO CỰC ĐOAN), Khuynh hướng suy diễn ${speaker.stats.thinking_type} (THẤP BỐC ĐỒNG, CAO SUY NGHĨ THÁI QUÁ).
  - Xã hội: Vị thế ${speaker.stats.position_len} (THẤP BỊ CÔ LẬP, CAO ĐƯỢC CÔNG NHẬN), Nhu cầu XH ${speaker.stats.social_bias} (THẤP MUỐN KÍN ĐÁO, CAO MUỐN NỔI BẬT), Hoài nghi MT ${speaker.stats.environment_skeptical} (THẤP CẢM THẤY AN TOÀN, CAO CẢM GIÁC NGUY HIỂM).

  MA TRẬN QUAN HỆ CỦA BẠN ĐỐI VỚI ${other.stats.name}:
  Tương tác: ${speaker.matrix_to_other.interaction} (THẤP LÀ XA LẠ, CAO LÀ HIỂU RÕ VỀ NHAU), Tin tưởng: ${speaker.matrix_to_other.trust} (THẤP HOÀI NGHI, CAO QUÁ TIN TƯỞNG), Thiện cảm: ${speaker.matrix_to_other.affection} (THẤP LÀ GHÉT, CAO LÀ YÊU/THÍCH), Thân mật: ${speaker.matrix_to_other.intimacy} (THẤP LÀ KHÔNG CẢM XÚC, CAO LÀ CỰC KỲ THÂN MẬT), Ân huệ: ${speaker.matrix_to_other.obligation} (THẤP KHÔNG NỢ NHAU, CAO MUỐN BÁO ĐÁP), Toan tính: ${speaker.matrix_to_other.interest} (THẤP KHÔNG CÓ, CAO MUỐN LỢI DỤNG).
  Bạn đang coi họ là: ${speaker.matrix_to_other.relationship}. 
  Biệt danh/Từ xưng hô bạn đang sử dụng: "${speaker.matrix_to_other.title}".
  
  QUẢN TRÒ ĐIỀU PHỐI LUỒNG HỘI THOẠI YÊU CẦU: 
  Sắc thái biểu đạt (Tránh lan man sai chủ đề): "${gameState.world.next_tone}".
  Độ dài phát ngôn: "${gameState.world.next_length}".
  
  Lịch sử 4 thoại gần đây (Bối cảnh ngay lúc này):
  ${JSON.stringify(chatHistory.slice(-4))}

  NHIỆM VỤ (Vai diễn của bạn):
  Giữ vững đúng character tính cách, trả về JSON gồm:
  - Một dòng 'thought' (suy nghĩ ngầm, bạn đang tính toán gì dựa trên các đặc điểm thống kê và chỉ số cảm xúc trên của bản thân?).
  - Một 'dialogue' (câu nói / hoặc hành động đáp lại chân thực với độ dài và tông giọng Quản trò yêu cầu).
  
  Định dạng JSON cần trả ra (TUYỆT ĐỐI không có text nào nằm ngoài JSON bracket):
  {
    "thought": "Suy nghĩ...",
    "dialogue": "Lời nói hoặc hành động..."
  }
  `;

  console.log(`Calling Character Engine [${speaker.stats.name}]...`);
  const charResult = await model.generateContent(charPrompt);
  const charAction = JSON.parse(charResult.response.text());

  const newMessage = {
    id: `msg_${Date.now()}`,
    timestamp: gameState.world.time,
    characterId: speakerId,
    thought: charAction.thought,
    dialogue: charAction.dialogue
  };
  chatHistory.push(newMessage);

  // ==========================================
  // PHASE 2: GAME MASTER EVALUATES TOÀN QUANG (NUMBERS & STRINGS)
  // ==========================================
  const gmPrompt = `
  Bạn là Quản Trò toàn năng của thế giới 10 Ethereal. 
  Quy luật thế giới: ${gameState.world.rules}
  Kịch bản tổng thời điểm này: ${gameState.world.scenario}
  
  Lịch sử cuộc trò chuyện (Hành động vừa xảy ra là của ${speaker.stats.name}):
  ${JSON.stringify(chatHistory.slice(-5))}

  TRẠNG THÁI HIỆN TẠI (Trước khi có hành động/lời nói trên):
  Thời gian: ${gameState.world.time}
  Môi trường: ${gameState.world.environment}
  Chủ đề: ${gameState.world.current_topic}
  Nhân vật ${speaker.stats.name} (Người vừa nói) -> Chỉ số: ${JSON.stringify(speaker.stats)}, Matrix: ${JSON.stringify(speaker.matrix_to_other)}
  Nhân vật ${other.stats.name} (Người kia) -> Chỉ số: ${JSON.stringify(other.stats)}, Matrix: ${JSON.stringify(other.matrix_to_other)}

  NHIỆM VỤ QUẢN TRÒ (QUAN TRỌNG NHẤT LÀ CẬP NHẬT TRIỆT ĐỂ MATRIX, THỜI GIAN, TRẠNG THÁI):
  1. LẬP LUẬN (gm_reasoning) & SỰ KIỆN NGẦM (implicit_event): Phân tích bối cảnh để nhảy thời gian sao cho hợp lý không bị tuyến tính. Nếu họ đang ở lớp và vừa xong 1 câu, có thể họ im lặng học bài -> tg nhảy 1 tiếng. Nếu ở ngữ cảnh nhắn tin, cách nhau chỉ 3 phút. Nếu bối cảnh khiến tâm lý thay đổi (như im lặng chịu tiếng trách mắng, hay hào hứng đợi xem phim), hãy tóm tắt tạo ra một sự kiện ngầm (implicit_event) tương đương để 2 nhân vật lấy đó làm cơ sở thay đổi cảm xúc cho lượt sau! Trả về "null" cho implicit_event nếu đối thoại xảy ra liên tục vài giây một lần.
  2. DELTA CHỈ SỐ SỐ HỌC (stats_delta): Đánh giá toàn bộ Sinh lý - Tâm lý - Xã hội và MỌI TIÊU CHÍ MATRIX (interaction, affection, trust, intimacy, obligation, interest). Tính độ dời (+ / -). TUYỆT ĐỐI KHÔNG BỎ QUÊN MATRIX VẬN ĐỘNG THEO LỜI NÓI! (Lưu ý: đặt tiền tố 'matrix_' cho biến thuộc matrix: vd: "matrix_affection": 1).
  3. GHI ĐÈ STRING (string_updates): Nếu tình cảm tăng cao / đổ vỡ bất ngờ, hãy lập tức cập nhật lại Cách xưng hô (matrix_title) và Mối quan hệ (matrix_relationship) hoặc Vị trí/Hành động hiện tại (position).
  4. ĐIỀU PHỐI (next_turn): Gợi ý tông giọng phải liên kết chặt chẽ với hậu quả của sự kiện ngầm + biến số tâm lý.
  
  Định dạng JSON Quản trò cần trả về:
  {
    "gm_reasoning": "Tại sao lại nhảy thời lượng X? Tại sao chỉ số biến thiên như vậy?",
    "implicit_event": "Sự kiện ngầm vừa trôi qua (vd: '30 phút im lặng khi cả hai ăn cơm.')",
    "stats_delta": {
       "${speakerId}": { "pleasure": 2, "stress": -1, "matrix_affection": 1, "matrix_intimacy": 2 },
       "${other.id}": { "matrix_trust": -3, "arousal": 1 }
    },
    "string_updates": {
       "${speakerId}": { "matrix_title": "tôi_cô", "matrix_relationship": "Người yêu" },
       "${other.id}": { "matrix_title": "tôi_anh", "position": "Đang khóc nấc" }
    },
    "world_update": {
       "new_time": "Vd: Cập nhật thời gian trôi qua, bám sát format hiện tại.",
       "new_environment": "Giữ nguyên hoặc đổi",
       "new_topic": "Chủ đề đang diễn ra"
    },
    "next_turn": {
       "next_speaker_id": "${other.id} hoặc ${speakerId}",
       "tone_instruction": "Tông giọng gợi ý cho lượt tới (gắn liền với implicit_event)",
       "length_instruction": "Độ dài yêu cầu cho lượt tới"
    }
  }
  `;

  console.log("Calling Game Master Engine (Evaluating Implicit Event & Deep Matrix Update)...");
  const gmResult = await model.generateContent(gmPrompt);
  const gmDecision = JSON.parse(gmResult.response.text());

  // Thế giới cập nhật
  gameState.world.time = gmDecision.world_update.new_time;
  gameState.world.environment = gmDecision.world_update.new_environment;
  gameState.world.current_topic = gmDecision.world_update.new_topic;
  
  // Implicit event
  if (gmDecision.implicit_event && gmDecision.implicit_event !== "null" && gmDecision.implicit_event !== "") {
    gameState.world.last_event = gmDecision.implicit_event;
  } else {
    gameState.world.last_event = null; // Reset nếu không có sự kiện ngầm
  }

  gameState.world.next_speaker = gmDecision.next_turn.next_speaker_id;
  gameState.world.next_tone = gmDecision.next_turn.tone_instruction;
  gameState.world.next_length = gmDecision.next_turn.length_instruction;

  // Áp dụng Cập nhật Mọi Chỉ số (Số học Delta + String Overwrite)
  const applyUpdates = (charObj, deltas, strings) => {
    if (deltas) {
      for (const [key, val] of Object.entries(deltas)) {
        if (key.startsWith('matrix_')) {
          const matrixKey = key.replace('matrix_', '');
          if (typeof charObj.matrix_to_other[matrixKey] === 'number') {
            charObj.matrix_to_other[matrixKey] = Math.max(0, Math.min(100, charObj.matrix_to_other[matrixKey] + val));
          }
        } else {
          if (typeof charObj.stats[key] === 'number') {
            charObj.stats[key] = Math.max(0, Math.min(100, charObj.stats[key] + val));
          }
        }
      }
    }
    if (strings) {
      for (const [key, val] of Object.entries(strings)) {
        if (key.startsWith('matrix_')) {
          const matrixKey = key.replace('matrix_', '');
          charObj.matrix_to_other[matrixKey] = val;
        } else {
          charObj.stats[key] = val;
        }
      }
    }
  };

  applyUpdates(speaker, gmDecision.stats_delta ? gmDecision.stats_delta[speakerId] : null, gmDecision.string_updates ? gmDecision.string_updates[speakerId] : null);
  applyUpdates(other, gmDecision.stats_delta ? gmDecision.stats_delta[other.id] : null, gmDecision.string_updates ? gmDecision.string_updates[other.id] : null);

  await db.collection('game_data').doc('state').set(gameState);
  await db.collection('game_data').doc('history').set({ messages: chatHistory });

  // Fallback save to local for debug
  fs.writeFileSync(statePath, JSON.stringify(gameState, null, 2));
  fs.writeFileSync(historyPath, JSON.stringify(chatHistory, null, 2));

  console.log(`\n=======================`);
  console.log(`[${newMessage.timestamp}] ${speaker.stats.name}:`);
  console.log(`THOUGHT: ${newMessage.thought}`);
  console.log(`SAYS: ${newMessage.dialogue}`);
  console.log(`=======================\n`);
  console.log(`GM Reasoning (Implicit Event): ${gmDecision.implicit_event || "None"}`);
  console.log(`GM Decided Next: [${gameState.world.next_speaker}], Tone: ${gameState.world.next_tone}, Length: ${gameState.world.next_length}`);
  console.log(`World Changed: Time -> ${gmDecision.world_update.new_time} | Topic -> ${gmDecision.world_update.new_topic}`);
  console.log(`Deep Stats & Matrix Deltas:`, JSON.stringify(gmDecision.stats_delta, null, 2));
  console.log("Turn completed and fully saved.");
}

runCron().catch(console.error);
