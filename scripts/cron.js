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
    temperature: 0.7,
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

  // INJECT COMMAND INTERCEPTOR
  const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
  if (lastMsg && lastMsg.characterId === "System" && lastMsg.dialogue.startsWith("[INJECT] /")) {
    console.log(`[${worldId}] Bắt được lệnh Injected Command: ${lastMsg.dialogue}`);

    const rawInject = lastMsg.dialogue.replace("[INJECT] ", "");
    const parts = rawInject.split(" ");
    const commandType = parts[0];
    const commandContent = parts.slice(1).join(" ");

    // Process commands
    if (commandType === '/ask' || commandType === '/opinion' || commandType === '/summarize' || commandType === '/free') {
      const isNarrator = commandType === '/opinion';
      const actorName = isNarrator ? "Narrator" : "Game Master";

      const cmdPrompt = `
      Bạn là ${actorName} của thế giới 10 Ethereal.
      Quy luật thế giới: ${gameState.world.rules}
      Kịch bản hiện tại: ${gameState.world.scenario}
      Chủ đề: ${gameState.world.current_topic}
      Môi trường: ${gameState.world.environment}
      Lịch sử chat gần đây:
      ${JSON.stringify(chatHistory.slice(-15))}
      
      Người dùng vừa dùng lệnh ${commandType} với nội dung: "${commandContent}".
      Hãy trả lời trực tiếp lệnh này bằng ngôn ngữ tự nhiên. Bạn phải trả về định dạng JSON:
      {
        "reply_message": "Câu trả lời của bạn..."
      }
      `;

      console.log(`[${worldId}] Đang xử lý lệnh ${commandType}...`);
      const cmdResult = await generateWithRetry(cmdPrompt);

      if (cmdResult && cmdResult.reply_message) {
        chatHistory.push({
          id: `msg_cmdreply_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
          characterId: isNarrator ? "Narrator" : "System",
          dialogue: `*[${actorName} Reply]:* ${cmdResult.reply_message}`
        });
        await db.collection('history').doc(worldId).set({ messages: chatHistory });
      }

      // Stop further processing for this tick to let user read the reply
      return;
    } else if (commandType === '/disrupt' || commandType === '/act') {
      // Just let it pass to the normal cycle, the frontend already saved it to last_event / history.
      console.log(`[${worldId}] Lệnh ${commandType} được thông qua để các nhân vật tự phản ứng.`);
      // To prevent loop on next tick since it wasn't processed and returned
      lastMsg.dialogue = lastMsg.dialogue.replace("[INJECT] ", "[PROCESSED] ");
      await db.collection('history').doc(worldId).set({ messages: chatHistory });
    }
  }

  if (gameState.world.is_together === undefined) {
    gameState.world.is_together = true;
  }

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
  // PHASE 1.5: GỌI LÕI TÂM LÝ PYTHON ĐỂ ĐÁNH GIÁ (PPM CORE)
  // ==========================================
  let ppmCoreStatus = "Bình thường";
  let isCatastrophe = false;
  let ppmKlDiv = 0;
  let ppmIntent = 'Bình thường';
  let retrievedMemory = "";
  let rashomonTriggered = false;

  try {
    console.log(`[${worldId}] Calling Python Psychophysical Core...`);

    // Map thông số nhân vật sang mảng số cho Python Core
    let mlWeights = gameState.world.ml_weights || null;
    if (typeof mlWeights === 'string') {
      try { mlWeights = JSON.parse(mlWeights); } catch (e) { mlWeights = null; }
    }

    const speakerStats = speaker.stats;
    let speakerMatrix = { interaction: 50, trust: 50, affection: 50, intimacy: 50, obligation: 0, interest: 0 };
    if (speaker.relationships && Object.keys(speaker.relationships).length > 0) {
      speakerMatrix = speaker.relationships[Object.keys(speaker.relationships)[0]];
    }

    const obs_seq = [[
      (speakerStats.health || 50) / 100.0,
      (speakerStats.stress || 50) / 100.0,
      (speakerStats.pleasure || 50) / 100.0,
      (speakerMatrix.affection || 50) / 100.0,
      (speakerMatrix.trust || 50) / 100.0
    ]];
    const R_t = [(speakerStats.pleasure || 50) / 100.0, (speakerMatrix.affection || 50) / 100.0, (speakerStats.comfortable || 50) / 100.0];
    const V_S_t = [(speakerStats.will_power || 50) / 100.0, (speakerStats.faith_index || 50) / 100.0, (speakerMatrix.trust || 50) / 100.0];
    const pred_probs = [(speakerStats.bias || 50) / 100.0, (speakerStats.logic_emotion || 50) / 100.0, (speakerStats.openness || 50) / 100.0];
    const core_probs = [0.5, 0.5, 0.5]; // Trạng thái cân bằng lý tưởng

    // Gom toàn bộ thoại làm query text để truy xuất ký ức
    const query_text = chatHistory.slice(-4).map(m => m.dialogue || m.thought).join(" ");

    const getFlatStats = (char) => {
      const s = char.stats;
      let m = { interaction: 50, trust: 50, affection: 50, intimacy: 50 };
      if (char.relationships && Object.keys(char.relationships).length > 0) {
        m = char.relationships[Object.keys(char.relationships)[0]];
      }
      return [
        (s.health || 50) / 100, (s.look || 50) / 100, (s.iq || 100) / 200, (s.eq || 100) / 200,
        (s.openness || 50) / 100, (s.dedicate || 50) / 100, (s.tendency || 50) / 100, (s.sociable || 50) / 100, (s.stability || 50) / 100,
        (s.energy || 50) / 100, (s.nutrient || 50) / 100, Math.max(0, Math.min(1, ((s.temperature || 37) - 35) / 7)), (s.comfortable || 50) / 100, (s.stress || 50) / 100, (s.excitement || 50) / 100,
        (s.pleasure || 50) / 100, (s.arousal || 50) / 100, (s.domination || 50) / 100, (s.will_power || 50) / 100, (s.faith_index || 50) / 100,
        (s.logic_emotion || 50) / 100, (s.focus_spain || 50) / 100, (s.bias || 50) / 100, (s.thinking_type || 50) / 100,
        (s.social_bias || 50) / 100, (s.environment_skeptical || 50) / 100,
        (m.interaction || 50) / 100, (m.trust || 50) / 100, (m.affection || 50) / 100, (m.intimacy || 50) / 100
      ];
    };

    let dt = gameState.world.time_skip || 1.0;

    const pythonArgsObj = {
      world_id: worldId,
      speaker: speakerId,
      ml_weights: mlWeights,
      obs_seq: obs_seq,
      R_t: R_t,
      V_S_t: V_S_t,
      V_S_t_plus_1: V_S_t, // Giả định kỳ vọng không đổi trước mắt
      pred_probs: pred_probs,
      core_probs: core_probs,
      query_text: query_text,
      flat_stats: getFlatStats(speaker),
      listener_stats: getFlatStats(other),
      dt: dt
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
          rashomonTriggered = ppmData.rashomon_triggered || false;
          if (ppmData.retrieved_memory) retrievedMemory = ppmData.retrieved_memory;
          if (ppmData.kl_div !== undefined) ppmKlDiv = ppmData.kl_div;
          if (ppmData.intent_vector_dominant) ppmIntent = ppmData.intent_vector_dominant;
          if (ppmData.new_weights) gameState.world.ml_weights = JSON.stringify(ppmData.new_weights); // Lưu dưới dạng chuỗi để tránh lỗi nested array của Firestore
          break;
        }
      } catch (e) { }
    }
    console.log(`[${worldId}] [PPM Core] Status: ${ppmCoreStatus} | Catastrophe: ${isCatastrophe}`);
  } catch (error) {
    console.warn(`[${worldId}] Lỗi khi chạy Python Core:`, error.message);
  }

  // ==========================================
  // PHASE 1: CHARACTER THINKS AND SPEAKS (Chỉ khi is_together = true)
  // ==========================================
  let charAction = null;
  if (gameState.world.is_together) {
    const charPrompt = `
    Chỉ thị bí mật (Roleplay): ${speaker.roleplay_prompt}
    Bạn đang nhập vai nhân vật: ${speaker.stats.name}.
    
    RÀNG BUỘC TUYỆT ĐỐI VỀ GIỚI TÍNH VÀ XƯNG HÔ:
    - Giới tính của bạn là: ${speaker.stats.gender || "Không rõ"}. Tuổi: ${speaker.stats.age || speaker.stats.date_of_birth}.
    CÁC NHÂN VẬT KHÁC CÓ MẶT (Hãy gọi đúng nhân xưng giới tính của họ):
    ${gameState.characters.filter(c => c.id !== speakerId).map(c => `- ${c.stats.name}: Giới tính ${c.stats.gender || "Không rõ"}, Tuổi ${c.stats.age || c.stats.date_of_birth}`).join('\n    ')}
    TỪ KHÓA BẮT BUỘC: Bạn phải chọn ĐẠI TỪ NHÂN XƯNG và TỪ VỰNG miêu tả chính xác tuyệt đối với giới tính trên. (Ví dụ: Nếu đối phương là Nam thì không được gọi là 'cô ấy', 'chị ấy'; nếu bản thân là Nữ thì không xưng 'anh').
    
    CHI TIẾT MÔI TRƯỜNG:
    Môi trường hiện tại: ${gameState.world.environment}. Thời gian: ${gameState.world.time}.
    Chủ đề câu chuyện: ${gameState.world.current_topic}.
    Sự kiện ngầm vừa xảy ra khoảng thời gian qua (Nếu có): ${gameState.world.last_event || "Không có"}. (Lưu ý: Nếu có sự kiện ngầm được đề cập, hãy suy luận cảm xúc của bạn từ sự kiện này!).
    

    [META-PROMPT: NEURO-DIRECTOR CUE]
    [THÔNG SỐ NỘI MÔI - ẨN]:
    Mức độ Bất hòa Nhận thức (KL Divergence): ${ppmKlDiv}
    Cảnh báo Amygdala Hijack: ${isCatastrophe}
    Ý định ngầm (Markov Hidden State): ${ppmIntent}

    [CHỈ ĐẠO DIỄN XUẤT TỪ ĐẠO DIỄN]:
    Bạn không phải là một AI thân thiện. Bạn là một thực thể sinh học đang chịu áp lực tâm lý.
    ${isCatastrophe ? 'Nếu Cảnh báo Amygdala = TRUE: Bạn ĐANG BỊ SỐC HOẶC BẤT ỔN TÂM LÝ. Hãy để lộ sự bối rối hoặc ngập ngừng trong suy nghĩ và hành động, nhưng CÂU CHỮ VẪN PHẢI MẠCH LẠC VÀ ĐẦY ĐỦ Ý NGHĨA. Không được trả lời quá ngắn gọn.' : ''}
    ${ppmKlDiv > 1.5 ? 'Nếu Bất hòa Nhận thức > 1.5: Lời nói của bạn phải đi ngược lại hoàn toàn với hành động vật lý của bạn. Bạn nói bạn ổn, nhưng hãy miêu tả một vi hành vi (micro-expression) cho thấy bạn đang cào rách da mình.' : ''}
    Hãy sinh ra phản ứng tiếp theo. Không giải thích. Chỉ diễn.
    CHI TIẾT TOÀN BỘ CHỈ SỐ CÁ NHÂN CỦA BẠN (HÃY BÁM SÁT VÀO ĐÂY ĐỂ ĐỘNG NÃO LẬP LUẬN):
    - Hồ sơ: Tuổi: ${speaker.stats.age || speaker.stats.date_of_birth}, C/V: ${speaker.stats.job} (CÔNG VIỆC ẢNH HƯỞNG ĐỜI SỐNG), Vị trí/Tư thế hiện tại: ${speaker.stats.position} (VỊ TRÍ ẢNH HƯỞNG QUYẾT ĐỊNH VÀ ĐỜI SỐNG).
    - Trạng thái: Health: ${speaker.stats.health} (THỂ HIỆN KHẢ NĂNG HÀNH VI HIỆN TẠI), Look: ${speaker.stats.look} (THỂ HIỆN BẢN THÂN VÀ ẢNH HƯỞNG NGƯỜI XUNG QUANH), IQ: ${speaker.stats.iq} (THỂ HIỆN TRÍ THÔNG MINH HIỆN TẠI), EQ: ${speaker.stats.eq} (KHẢ NĂNG GIAO TIẾP XÃ HỘI).
    - Sâu thẳm: Niềm tin: ${speaker.stats.faith}, Ước mơ: ${speaker.stats.passion}, Vết thương lòng: ${speaker.stats.emotional_pain}. Yêu/Ghét: ${speaker.stats.love_hates}. Điểm mạnh/Điểm yếu: ${speaker.stats.pros_cons}. (TẤT CẢ NHỮNG ĐIỀU NÀY ẢNH HƯỞNG SÂU SẮC ĐẾN QUYẾT ĐỊNH VÀ ĐỜI SỐNG LÂU DÀI).
    - Bản sắc: Cởi mở ${speaker.stats.openness} (THẤP BẢO THỦ, CAO SÁNG TẠO), Tận tâm ${speaker.stats.dedicate} (THẤP TÙY HỨNG, CAO KỶ LUẬT), Khuynh hướng ${speaker.stats.tendency} (THẤP HƯỚNG NỘI, CAO HƯỚNG NGOẠI), Hòa đồng ${speaker.stats.sociable} (THẤP HUNG ÁC, CAO HIỀN LÀNH), Ổn định ${speaker.stats.stability} (THẤP LO ÂU, CAO BÌNH THẢN).
    - Sinh lý: Năng lượng ${speaker.stats.energy} (THẤP MỆT MỎI, CAO TỈNH TÁO), Dinh dưỡng ${speaker.stats.nutrient} (THẤP ĐÓI KHÁT, CAO NO), Nhiệt độ ${speaker.stats.temperature} (THẤP LẠNH, CAO NÓNG), Thoải mái ${speaker.stats.comfortable} (THẤP ĐAU ĐỚN, CAO DỄ CHỊU), Stress ${speaker.stats.stress} (THẤP THƯ GIÃN, CAO CĂNG THẲNG), Hưng phấn ${speaker.stats.excitement} (THẤP LƠ MƠ, CAO KÍCH ĐỘNG).
    - Tâm lý: Vui vẻ ${speaker.stats.pleasure} (THẤP BUỒN, CAO VUI), Kích thích ${speaker.stats.arousal} (THẤP CHÁN NẢN, CAO KÍCH THÍCH), Thống trị ${speaker.stats.domination} (THẤP SỢ HÃI, CAO TỰ TIN), Ý chí ${speaker.stats.will_power} (THẤP BUÔNG XUÔI, CAO KIÊN ĐỊNH), Niềm tin/Hy vọng ${speaker.stats.faith_index} (THẤP TUYỆT VỌNG, CAO CÓ HY VỌNG).
    - Nhận thức: Cán cân logic/cảm xúc ${speaker.stats.logic_emotion} (THẤP DÙNG LOGIC, CAO DÙNG CẢM TÍNH), Tập trung ${speaker.stats.focus_spain} (THẤP XAO NHÃNG, CAO SIÊU TẬP TRUNG), Thiên kiến ${speaker.stats.bias} (SUY LUẬN THEO THIÊN KIẾN: THẤP KHÔNG CÓ, CAO CỰC ĐOAN), Khuynh hướng suy diễn ${speaker.stats.thinking_type} (THẤP BỐC ĐỒNG, CAO SUY NGHĨ THÁI QUÁ).
    - Xã hội: Vị thế ${speaker.stats.position_len} (THẤP BỊ CÔ LẬP, CAO ĐƯỢC CÔNG NHẬN), Nhu cầu XH ${speaker.stats.social_bias} (THẤP MUỐN KÍN ĐÁO, CAO MUỐN NỔI BẬT), Hoài nghi MT ${speaker.stats.environment_skeptical} (THẤP CẢM THẤY AN TOÀN, CAO CẢM GIÁC NGUY HIỂM).

    MA TRẬN QUAN HỆ CỦA BẠN (Tầm nhìn chung với các nhân vật khác):
    ${speaker.relationships ? Object.entries(speaker.relationships).map(([tId, m]) => {
      const tName = gameState.characters.find(x => x.id === tId)?.stats?.name || tId;
      return `Với ${tName} (Gọi là "${m.title}"): Quan hệ "${m.relationship}". Tương tác: ${m.interaction}, Tin tưởng: ${m.trust}, Thiện cảm: ${m.affection}, Thân mật: ${m.intimacy}, Ân huệ: ${m.obligation}, Toan tính: ${m.interest}.`;
    }).join('\n    ') : "Không có kết nối."}
    
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
    charAction = await generateWithRetry(charPrompt);

    const newMessage = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: gameState.world.time,
      characterId: speakerId,
      thought: charAction.thought,
      dialogues: charAction.dialogues
    };
    chatHistory.push(newMessage);
  } else {
    console.log(`[${worldId}] Các nhân vật đang ở xa nhau (Offline). Bỏ qua Character Engine.`);
  }

  // ==========================================
  // PHASE 2: GAME MASTER EVALUATES & OFFLINE SIMULATION
  // ==========================================
  const gmPrompt = `
  Bạn là Quản Trò toàn năng (Game Master & Narrator) của thế giới 10 Ethereal. 
  Quy luật thế giới: ${gameState.world.rules}
  Kịch bản tổng thời điểm này: ${gameState.world.scenario}
  Trạng thái Không Gian: ${gameState.world.is_together ? "Các nhân vật ĐANG Ở CẠNH NHAU (Co-located)." : "Các nhân vật ĐANG Ở XA NHAU (Separated)."}
  
  RÀNG BUỘC VỀ GIỚI TÍNH CỦA NHÂN VẬT (Khi viết 'narrator_message', BẠN PHẢI DÙNG CHÍNH XÁC ĐẠI TỪ NHÂN XƯNG DỰA VÀO GIỚI TÍNH):
  ${gameState.characters.map(c => `- ${c.stats.name}: Giới tính ${c.stats.gender || "Không rõ"}, Tuổi ${c.stats.age || c.stats.date_of_birth}`).join('\n  ')}

  Lịch sử cuộc trò chuyện (Hành động vừa xảy ra là của ${speaker ? speaker.stats.name : 'Unknown'}):
  ${JSON.stringify(chatHistory.slice(-21))}

  TRẠNG THÁI HIỆN TẠI:
  Thời gian: ${gameState.world.time}
  Môi trường: ${gameState.world.environment}
  Chủ đề: ${gameState.world.current_topic}
  ${gameState.characters.map(c => {
    let relStr = "Không có kết nối";
    if (c.relationships) {
      relStr = Object.entries(c.relationships).map(([tId, st]) => {
        const tName = gameState.characters.find(x => x.id === tId)?.stats?.name || tId;
        return `Với ${tName}: ${JSON.stringify(st)}`;
      }).join(" | ");
    }
    return `Nhân vật ${c.stats.name} [ID: ${c.id}] -> Vị trí: ${c.stats.position}, Việc: ${c.stats.job}, Pleasure: ${c.stats.pleasure}/100, Stress: ${c.stats.stress}/100\n  Matrix: ${relStr}`;
  }).join('\n  ')}

  KẾT QUẢ ĐÁNH GIÁ TỪ LÕI VẬT LÝ TÂM LÝ (PPM CORE):
  Tình trạng: ${ppmCoreStatus} (Đã bị sụp đổ tâm lý Amygdala Hijack? ${isCatastrophe})
  Hiệu ứng Rashomon (Hiểu lầm ý định): ${rashomonTriggered ? "CÓ! Bắt buộc phải tạo kịch bản hiểu lầm (Sự thật 1 kiểu, người nghe hiểu 1 kiểu)." : "Không"}
  Ký ức mơ hồ vừa truy xuất được từ tiềm thức: "${retrievedMemory || "Không có"}"

  NHIỆM VỤ QUẢN TRÒ (Game Master & Narrator):
  1. LẬP LUẬN (gm_reasoning) & SỰ KIỆN NGẦM (implicit_event): Phân tích bối cảnh để quyết định bước nhảy thời gian (time_skip - số phút). 
  2. TÍNH TOÁN DESIRE TO SPEAK: Đánh giá xem ai là người khao khát/có khả năng cao nhất để lên tiếng hoặc hành động ở lượt tiếp theo.
  3. NARRATOR LOGIC: Trở thành người kể chuyện toàn tri (Generative Life). Bạn ĐƯỢC PHÉP miêu tả cảm xúc nội tâm sâu sắc, suy nghĩ thầm kín của các nhân vật và miêu tả chân thực những thay đổi (dù là nhỏ nhất) của môi trường xung quanh. Hãy set 'trigger_narrator' = true khi cần thiết.
  4. DELTA CHỈ SỐ SỐ HỌC (stats_delta): Cập nhật Sinh lý/Tâm lý dựa theo thời gian time_skip cho tất cả các nhân vật.
  
  Định dạng JSON Quản trò cần trả về:
  {
    "gm_reasoning": "Tại sao time skip X phút? Ai là người tiếp theo muốn nói?",
    "implicit_event": "Sự kiện ngầm (nếu có)",
    "trigger_narrator": true,
    "narrator_message": "Lời miêu tả toàn tri của Narrator về tâm lý, không gian, thời gian. Nếu không có gì đáng kể thì để null và trigger_narrator = false.",
    "time_skip": 1, 
    "is_together_next_turn": true,
    "character_evaluations": [
       { "char_id": "ID_nhân_vật_vd_char_A", "desire_to_speak": 85 }
    ],
    "stats_delta": {
       "char_A": { "pleasure": 2, "stress": -1, "energy": -5 } // Chỉ dùng các field số: openness, dedicate, tendency, sociable, stability, energy, nutrient, temperature, comfortable, stress, excitement, pleasure, arousal, domination, will_power, faith_index, logic_emotion, focus_spain, bias, thinking_type, position_len, social_bias, environment_skeptical. Chỉ liệt kê những field có biến động.
    },
    "matrix_delta": {
       "char_A": {
          "char_B": { "affection": 1, "trust": -3, "interaction": 2 } // Góc nhìn từ A -> B. Chỉ dùng: interaction, trust, affection, intimacy, obligation, interest.
       }
    },
    "string_updates": {
       "char_A": { "long_term_intention": "Bỏ trốn", "passion": "Săn bắn" } // Dùng cho các field chuỗi: faith, passion, emotional_pain, love_hates, pros_cons, long_term_intention, next_intention.
    },
    "matrix_string_updates": {
       "char_A": {
          "char_B": { "relationship": "Người yêu", "title": "Bé cưng" } // Cập nhật string góc nhìn A -> B: relationship, title.
       }
    },
    "world_update": {
       "new_time": "Vd: 08:30 AM",
       "new_environment": "Giữ nguyên hoặc đổi",
       "new_topic": "Chủ đề diễn ra"
    },
    "next_turn": {
       "tone_instruction": "Tông giọng gợi ý cho người nói lượt tới",
       "length_instruction": "Độ dài yêu cầu cho lượt tới"
    }
  }
  `;

  console.log(`[${worldId}] Calling Game Master Engine (Evaluating Implicit Event & Deep Matrix Update)...`);
  const gmDecision = await generateWithRetry(gmPrompt);

  if (gmDecision.trigger_narrator && gmDecision.narrator_message && gmDecision.narrator_message !== "null") {
    chatHistory.push({
      id: `msg_narrator_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: gmDecision.world_update.new_time,
      characterId: "Narrator",
      dialogue: gmDecision.narrator_message
    });
  }

  // Thế giới cập nhật
  gameState.world.time = gmDecision.world_update.new_time;
  gameState.world.is_together = gmDecision.is_together_next_turn !== undefined ? gmDecision.is_together_next_turn : true;
  gameState.world.time_skip = gmDecision.time_skip || 1.0;
  gameState.world.environment = gmDecision.world_update.new_environment;
  gameState.world.current_topic = gmDecision.world_update.new_topic;

  // Implicit event
  if (gmDecision.implicit_event && gmDecision.implicit_event !== "null" && gmDecision.implicit_event !== "") {
    gameState.world.last_event = gmDecision.implicit_event;
  } else {
    gameState.world.last_event = null;
  }

  // Determine next speaker based on desire_to_speak
  if (gmDecision.character_evaluations && gmDecision.character_evaluations.length > 0) {
    let highestScore = -Infinity;
    let nextSpk = speakerId;
    for (const evalObj of gmDecision.character_evaluations) {
      if (evalObj.desire_to_speak > highestScore) {
        highestScore = evalObj.desire_to_speak;
        nextSpk = evalObj.char_id;
      }
    }
    gameState.world.next_speaker = nextSpk;
  } else {
    gameState.world.next_speaker = speakerId; // fallback
  }

  gameState.world.next_tone = gmDecision.next_turn.tone_instruction;
  gameState.world.next_length = gmDecision.next_turn.length_instruction;

  // Áp dụng Cập nhật Mọi Chỉ số
  const applyUpdates = (charObj, deltas, strings, matrixDeltas, matrixStrings) => {
    if (deltas) {
      for (const [key, val] of Object.entries(deltas)) {
        if (typeof charObj.stats[key] === 'number') {
          let minLimit = 0;
          let maxLimit = 100;

          // Giới hạn Cap Limits mới
          if (key === 'temperature') { minLimit = 35; maxLimit = 42; }
          else if (key === 'iq' || key === 'eq') { minLimit = 0; maxLimit = 200; }

          charObj.stats[key] = Math.max(minLimit, Math.min(maxLimit, charObj.stats[key] + val));
        }
      }
    }
    if (strings) {
      for (const [key, val] of Object.entries(strings)) {
        charObj.stats[key] = val;
      }
    }

    if (!charObj.relationships) charObj.relationships = {};

    if (matrixDeltas) {
      for (const [targetId, fields] of Object.entries(matrixDeltas)) {
        if (!charObj.relationships[targetId]) {
          charObj.relationships[targetId] = { interaction: 0, trust: 50, affection: 50, intimacy: 0, obligation: 0, interest: 0, relationship: 'Người quen', title: '' };
        }
        for (const [key, val] of Object.entries(fields)) {
          if (typeof charObj.relationships[targetId][key] === 'number') {
            charObj.relationships[targetId][key] = Math.max(0, Math.min(100, charObj.relationships[targetId][key] + val));
          }
        }
      }
    }

    if (matrixStrings) {
      for (const [targetId, fields] of Object.entries(matrixStrings)) {
        if (!charObj.relationships[targetId]) {
          charObj.relationships[targetId] = { interaction: 0, trust: 50, affection: 50, intimacy: 0, obligation: 0, interest: 0, relationship: 'Người quen', title: '' };
        }
        for (const [key, val] of Object.entries(fields)) {
          charObj.relationships[targetId][key] = val;
        }
      }
    }
  };

  gameState.characters.forEach(char => {
    applyUpdates(char,
      gmDecision.stats_delta ? gmDecision.stats_delta[char.id] : null,
      gmDecision.string_updates ? gmDecision.string_updates[char.id] : null,
      gmDecision.matrix_delta ? gmDecision.matrix_delta[char.id] : null,
      gmDecision.matrix_string_updates ? gmDecision.matrix_string_updates[char.id] : null
    );
  });

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
  await Promise.all(worldsToProcess.map(world => {
    if (world.data && world.data.world && world.data.world.is_paused) {
      console.log(`[${world.id}] World is paused, skipping cron execution...`);
      return Promise.resolve();
    }
    return processWorld(world.id, world.data);
  }));

  console.log("Tất cả các world đã chạy xong.");
}

runCron().catch(console.error);
