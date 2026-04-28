import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);
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

// USING PRO MODEL FOR DEEP THINKING
const model = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-lite-preview',
  generationConfig: {
    temperature: 1.8,
    //thinking_level: "high",
    responseMimeType: "application/json"
  }
});

// Hàm bọc tự động thử lại 1 lần nếu LLM bị lỗi
async function generateWithRetry(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.warn("LLM Error, retrying once...", error.message);
    const retryResult = await model.generateContent(prompt);
    return JSON.parse(retryResult.response.text());
  }
}

async function processWorld(worldId, gameState) {
  console.log(`\n===========================================`);
  console.log(`[${worldId}] Bắt đầu xử lý thế giới...`);

  const historyDoc = await db.collection('history').doc(worldId).get();
  let chatHistory = historyDoc.exists ? historyDoc.data().messages : [];

  let speakerId = gameState.world.next_speaker || 'char_A';
  let speaker = gameState.characters.find(c => c.id === speakerId);
  
  // HOTFIX: Đề phòng trường hợp next_speaker bị lưu nhầm thành Tên nhân vật (vd: "Mizi") thay vì ID ("char_B")
  if (!speaker) {
    speaker = gameState.characters.find(c => c.stats.name === speakerId);
    if (speaker) speakerId = speaker.id;
    else {
      speakerId = 'char_A';
      speaker = gameState.characters.find(c => c.id === speakerId);
    }
  }
  
  const other = gameState.characters.find(c => c.id !== speakerId);

  // ==========================================
  // PHASE 1: CHARACTER THINKS AND SPEAKS
  // ==========================================
  const charPrompt = `
  Chỉ thị bí mật (Roleplay): ${speaker.roleplay_prompt}
  Bạn đang nhập vai nhân vật: ${speaker.stats.name}.
  
  RÀNG BUỘC TUYỆT ĐỐI VỀ GIỚI TÍNH VÀ XƯNG HÔ:
  - Giới tính của bạn là: ${speaker.stats.gender || "Không rõ"}. Tuổi: ${speaker.stats.age || speaker.stats.date_of_birth}.
  - Giới tính của đối phương (${other.stats.name}) là: ${other.stats.gender || "Không rõ"}. Tuổi: ${other.stats.age || other.stats.date_of_birth}.
  TỪ KHÓA BẮT BUỘC: Bạn phải chọn ĐẠI TỪ NHÂN XƯNG và TỪ VỰNG miêu tả chính xác tuyệt đối với giới tính trên. (Ví dụ: Nếu đối phương là Nam thì không được gọi là 'cô ấy', 'chị ấy'; nếu bản thân là Nữ thì không xưng 'anh').
  
  CHI TIẾT MÔI TRƯỜNG:
  Môi trường hiện tại: ${gameState.world.environment}. Thời gian: ${gameState.world.time}.
  Chủ đề câu chuyện: ${gameState.world.current_topic}.
  Sự kiện ngầm vừa xảy ra khoảng thời gian qua (Nếu có): ${gameState.world.last_event || "Không có"}. (Lưu ý: Nếu có sự kiện ngầm được đề cập, hãy suy luận cảm xúc của bạn từ sự kiện này!).
  
  CHI TIẾT TOÀN BỘ CHỈ SỐ CÁ NHÂN CỦA BẠN (HÃY BÁM SÁT VÀO ĐÂY ĐỂ ĐỘNG NÃO LẬP LUẬN):
  - Hồ sơ: Tuổi: ${speaker.stats.age || speaker.stats.date_of_birth}, C/V: ${speaker.stats.job} (CÔNG VIỆC ẢNH HƯỞNG ĐỜI SỐNG), Vị trí/Tư thế hiện tại: ${speaker.stats.position} (VỊ TRÍ ẢNH HƯỞNG QUYẾT ĐỊNH VÀ ĐỜI SỐNG).
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
  
  Lịch sử 20 thoại gần đây (Bối cảnh ngay lúc này):
  ${JSON.stringify(chatHistory.slice(-20))}

  NHIỆM VỤ (Vai diễn của bạn):
  Giữ vững đúng character tính cách, trả về JSON gồm:
  - Một dòng 'thought' (suy nghĩ ngầm, bạn đang tính toán gì dựa trên các đặc điểm thống kê và chỉ số cảm xúc trên của bản thân?).
  - Một mảng 'dialogues' chứa các câu nói VÀ hành động được băm nhỏ thành từng phần liên tiếp. QUAN TRỌNG: Mọi hành động, miêu tả cơ thể phải được bọc trong dấu * (ví dụ: *siết chặt tay*).
  
  Định dạng JSON cần trả ra (TUYỆT ĐỐI không có text nào nằm ngoài JSON bracket):
  {
    "thought": "Suy nghĩ...",
    "dialogues": [
      "*Tôi siết chặt những ngón tay trên vai cô...*",
      "Logic của cô thật sắc bén.",
      "Nhưng hãy nhớ điều này..."
    ]
  }
  `;

  console.log(`[${worldId}] Calling Character Engine [${speaker.stats.name}]...`);
  const charAction = await generateWithRetry(charPrompt);

  const newMessage = {
    id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: gameState.world.time,
    characterId: speakerId,
    thought: charAction.thought,
    dialogues: charAction.dialogues
  };
  chatHistory.push(newMessage);

  // ==========================================
  // PHASE 1.5: GỌI LÕI TÂM LÝ PYTHON ĐỂ ĐÁNH GIÁ (PPM CORE)
  // ==========================================
  let ppmCoreStatus = "Bình thường";
  let isCatastrophe = false;
  let retrievedMemory = "";
  
  try {
    console.log(`[${worldId}] Calling Python Psychophysical Core...`);
    
    // Map thông số nhân vật sang mảng số cho Python Core
    const mlWeights = gameState.world.ml_weights || null;
    const speakerStats = speaker.stats;
    const speakerMatrix = speaker.matrix_to_other;
    
    const obs_seq = [[
      (speakerStats.health || 50)/100.0, 
      (speakerStats.stress || 50)/100.0, 
      (speakerStats.pleasure || 50)/100.0, 
      (speakerMatrix.affection || 50)/100.0, 
      (speakerMatrix.trust || 50)/100.0
    ]];
    const R_t = [(speakerStats.pleasure || 50)/100.0, (speakerMatrix.affection || 50)/100.0, (speakerStats.comfortable || 50)/100.0];
    const V_S_t = [(speakerStats.will_power || 50)/100.0, (speakerStats.faith_index || 50)/100.0, (speakerMatrix.trust || 50)/100.0];
    const pred_probs = [(speakerStats.bias || 50)/100.0, (speakerStats.logic_emotion || 50)/100.0, (speakerStats.openness || 50)/100.0];
    const core_probs = [0.5, 0.5, 0.5]; // Trạng thái cân bằng lý tưởng
    
    // Gom toàn bộ thoại làm query text để truy xuất ký ức
    const query_text = chatHistory.slice(-4).map(m => m.dialogue || m.thought).join(" ");
    
    const pythonArgsObj = {
      speaker: speakerId,
      ml_weights: mlWeights,
      obs_seq: obs_seq,
      R_t: R_t,
      V_S_t: V_S_t,
      V_S_t_plus_1: V_S_t, // Giả định kỳ vọng không đổi trước mắt
      pred_probs: pred_probs,
      core_probs: core_probs,
      query_text: query_text
    };
    
    const pythonArgs = JSON.stringify(pythonArgsObj);
    const cmd = `python psychophysical_machine_core.py "${pythonArgs.replace(/"/g, '\\"')}"`;
    // Dùng execAsync để song song hóa giữa các thế giới
    const { stdout, stderr } = await execAsync(cmd, { encoding: 'utf-8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    if (stderr) console.error(`[${worldId}] Python Core Stderr:`, stderr);

    const lines = stdout.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const ppmData = JSON.parse(lines[i]);
        if (ppmData.status) {
          ppmCoreStatus = ppmData.status;
          isCatastrophe = ppmData.catastrophe_triggered;
          if (ppmData.retrieved_memory) retrievedMemory = ppmData.retrieved_memory;
          if (ppmData.new_weights) gameState.world.ml_weights = ppmData.new_weights; // Lưu trọng số tiến hóa vào database
          break;
        }
      } catch (e) { }
    }
    console.log(`[${worldId}] [PPM Core] Status: ${ppmCoreStatus} | Catastrophe: ${isCatastrophe}`);
  } catch (error) {
    console.warn(`[${worldId}] Lỗi khi chạy Python Core:`, error.message);
  }

  // ==========================================
  // PHASE 2: GAME MASTER EVALUATES
  // ==========================================
  const gmPrompt = `
  Bạn là Quản Trò toàn năng của thế giới 10 Ethereal. 
  Quy luật thế giới: ${gameState.world.rules}
  Kịch bản tổng thời điểm này: ${gameState.world.scenario}
  
  RÀNG BUỘC VỀ GIỚI TÍNH CỦA NHÂN VẬT (Khi viết 'narrator_message', BẠN PHẢI DÙNG CHÍNH XÁC ĐẠI TỪ NHÂN XƯNG DỰA VÀO GIỚI TÍNH):
  Nhân vật ${speaker.stats.name} (Người vừa nói) -> Giới tính: ${speaker.stats.gender || "Không rõ"}, Tuổi: ${speaker.stats.age || speaker.stats.date_of_birth}
  Nhân vật ${other.stats.name} (Người kia) -> Giới tính: ${other.stats.gender || "Không rõ"}, Tuổi: ${other.stats.age || other.stats.date_of_birth}

  Lịch sử cuộc trò chuyện (Hành động vừa xảy ra là của ${speaker.stats.name}):
  ${JSON.stringify(chatHistory.slice(-21))}

  TRẠNG THÁI HIỆN TẠI (Trước khi có hành động/lời nói trên):
  Thời gian: ${gameState.world.time}
  Môi trường: ${gameState.world.environment}
  Chủ đề: ${gameState.world.current_topic}
  Nhân vật ${speaker.stats.name} -> Chỉ số: ${JSON.stringify(speaker.stats)}, Matrix: ${JSON.stringify(speaker.matrix_to_other)}
  Nhân vật ${other.stats.name} -> Chỉ số: ${JSON.stringify(other.stats)}, Matrix: ${JSON.stringify(other.matrix_to_other)}

  KẾT QUẢ ĐÁNH GIÁ TỪ LÕI VẬT LÝ TÂM LÝ (PPM CORE):
  Tình trạng: ${ppmCoreStatus} (Đã bị sụp đổ tâm lý Amygdala Hijack? ${isCatastrophe})
  Ký ức mơ hồ vừa truy xuất được từ tiềm thức (có thể dùng để tạo Milestone hoặc Implicit Event): "${retrievedMemory || "Không có"}"

  NHIỆM VỤ QUẢN TRÒ (QUAN TRỌNG NHẤT LÀ CẬP NHẬT TRIỆT ĐỂ MATRIX, THỜI GIAN, TRẠNG THÁI):
  1. LẬP LUẬN (gm_reasoning) & SỰ KIỆN NGẦM (implicit_event): Phân tích bối cảnh để nhảy thời gian sao cho hợp lý. NẾU nhảy thời gian dài (ví dụ: ngủ qua đêm) HOẶC có sự kiện lớn, BẮT BUỘC phải viết 1 đoạn 'narrator_message' mang tính nghệ thuật để chuyển cảnh. Nếu đang nói chuyện liên tiếp, narrator_message = null.
  2. BẮT BUỘC TUÂN THỦ CATASTROPHE: Nếu lõi Python báo CATASTROPHE_TRIGGERED = true, BẠN BẮT BUỘC PHẢI KHỞI TẠO MỘT CÚ SỐC.
  3. TẠO CẢNH CỘT MỐC (MILESTONES): Nếu matrix tình cảm (affection, trust...) đạt đỉnh cao hoặc đáy thấp, BẠN PHẢI CHỈ ĐẠO nhân vật kế tiếp thực hiện tỏ tình/phản bội thông qua 'next_tone' và 'narrator_message'.
  4. DELTA CHỈ SỐ SỐ HỌC (stats_delta): Đánh giá toàn bộ Sinh lý - Tâm lý - Xã hội và MỌI TIÊU CHÍ MATRIX.
  5. GHI ĐÈ STRING (string_updates): Cập nhật lại Cách xưng hô (matrix_title) và Mối quan hệ (matrix_relationship) nếu cần.
  
  Định dạng JSON Quản trò cần trả về:
  {
    "gm_reasoning": "Tại sao lại nhảy thời lượng X? Tại sao chỉ số biến thiên như vậy?",
    "implicit_event": "Sự kiện ngầm vừa trôi qua (vd: '30 phút im lặng khi cả hai ăn cơm.')",
    "narrator_message": "Lời kể chuyện chuyển cảnh nghệ thuật (nếu có time skip hoặc milestone, ngược lại để null)",
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
       "tone_instruction": "Tông giọng gợi ý cho lượt tới (Bắt buộc phải mãnh liệt nếu có CATASTROPHE)",
       "length_instruction": "Độ dài yêu cầu cho lượt tới"
    }
  }
  `;

  console.log(`[${worldId}] Calling Game Master Engine (Evaluating Implicit Event & Deep Matrix Update)...`);
  const gmDecision = await generateWithRetry(gmPrompt);

  if (gmDecision.narrator_message && gmDecision.narrator_message !== "null") {
    chatHistory.push({
      id: `msg_narrator_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: gmDecision.world_update.new_time,
      characterId: "Narrator",
      dialogue: gmDecision.narrator_message
    });
  }

  // Thế giới cập nhật
  gameState.world.time = gmDecision.world_update.new_time;
  gameState.world.environment = gmDecision.world_update.new_environment;
  gameState.world.current_topic = gmDecision.world_update.new_topic;

  // Implicit event
  if (gmDecision.implicit_event && gmDecision.implicit_event !== "null" && gmDecision.implicit_event !== "") {
    gameState.world.last_event = gmDecision.implicit_event;
  } else {
    gameState.world.last_event = null;
  }

  gameState.world.next_speaker = gmDecision.next_turn.next_speaker_id;
  gameState.world.next_tone = gmDecision.next_turn.tone_instruction;
  gameState.world.next_length = gmDecision.next_turn.length_instruction;

  // Áp dụng Cập nhật Mọi Chỉ số
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

  await db.collection('worlds').doc(worldId).set(gameState);
  await db.collection('history').doc(worldId).set({ messages: chatHistory });

  console.log(`\n===========================================`);
  console.log(`[${worldId}] Turn completed and fully saved.`);
}

async function runCron() {
  console.log("Starting 10 Ethereal Cron Job (MULTI-WORLD)...");
  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY");
    process.exit(1);
  }

  // 1. Kiểm tra Worlds, migration nếu cần
  const worldsSnapshot = await db.collection('worlds').get();
  let worldsToProcess = [];

  if (worldsSnapshot.empty) {
    console.log("Không tìm thấy world nào. Cố gắng di chuyển dữ liệu cũ từ game_data...");
    const oldState = await db.collection('game_data').doc('state').get();
    const oldHistory = await db.collection('game_data').doc('history').get();

    if (oldState.exists) {
      await db.collection('worlds').doc('world_1').set(oldState.data());
      if (oldHistory.exists) {
        await db.collection('history').doc('world_1').set(oldHistory.data());
      }
      console.log("Di chuyển dữ liệu thành công sang world_1!");
      worldsToProcess.push({ id: 'world_1', data: oldState.data() });
    } else {
      console.log("Không có dữ liệu cũ. Cần mở trình duyệt và lưu lại world_1.");
      return;
    }
  } else {
    worldsSnapshot.forEach(doc => {
      worldsToProcess.push({ id: doc.id, data: doc.data() });
    });
  }

  // 2. Chạy tất cả các world SONG SONG
  console.log(`Tìm thấy ${worldsToProcess.length} worlds. Bắt đầu xử lý đồng thời...`);
  await Promise.all(worldsToProcess.map(world => processWorld(world.id, world.data)));

  console.log("Tất cả các world đã chạy xong.");
}

runCron().catch(console.error);
