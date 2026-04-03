import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config(); // Loads .env if testing locally

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const statePath = path.join(__dirname, '../public/data/state.json');
const historyPath = path.join(__dirname, '../public/data/history.json');

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

  const gameState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const chatHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

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
  
  CHI TIẾT TOÀN BỘ CHỈ SỐ CÁ NHÂN CỦA BẠN (HÃY BÁM SÁT VÀO ĐÂY ĐỂ ĐỘNG NÃO):
  - Hồ sơ: Tuổi/DOB: ${speaker.stats.date_of_birth}, C/V: ${speaker.stats.job}, Vị trí/Tư thế: ${speaker.stats.position}.
  - Trạng thái: Health: ${speaker.stats.health}, Look: ${speaker.stats.look}, IQ: ${speaker.stats.iq}, EQ: ${speaker.stats.eq}.
  - Sâu thẳm: Niềm tin: ${speaker.stats.faith}, Ước mơ: ${speaker.stats.passion}, Vết thương lòng: ${speaker.stats.emotional_pain}. Yêu/Ghét: ${speaker.stats.love_hates}. ĐM/ĐY: ${speaker.stats.pros_cons}.
  - Bản sắc: Cởi mở ${speaker.stats.openness}, Tận tâm ${speaker.stats.dedicate}, Sáng tạo ${speaker.stats.tendency}, Hòa đồng ${speaker.stats.sociable}, Ổn định ${speaker.stats.stability}.
  - Sinh lý: Năng lượng ${speaker.stats.energy}, Nhiệt độ ${speaker.stats.temperature}, Thoải mái ${speaker.stats.comfortable}, Căng thẳng ${speaker.stats.stress}, Hưng phấn ${speaker.stats.excitement}.
  - Tâm lý: Vui vẻ ${speaker.stats.pleasure}, Kích thích ${speaker.stats.arousal}, Thống trị ${speaker.stats.domination}, Ý chí ${speaker.stats.will_power}, Độ hi vọng (niềm tin) ${speaker.stats.faith_index}.
  - Nhận thức: Cán cân logic/cảm xúc ${speaker.stats.logic_emotion}, Tập trung ${speaker.stats.focus_spain}, Thiên kiến ${speaker.stats.bias}, Khuynh hướng suy diễn ${speaker.stats.thinking_type}.
  - Xã hội: Vị thế ${speaker.stats.position_len}, Nhu cầu XH ${speaker.stats.social_bias}, Hoài nghi MT ${speaker.stats.environment_skeptical}.
  - Ý định: Dài hạn: ${speaker.stats.long_term_intention}, Duy trì chủ đề ${speaker.stats.stick_index}, Mục tiêu sắp tới tỏng đầu (bí mật): ${speaker.stats.next_intention}.

  MA TRẬN QUAN HỆ CỦA BẠN ĐỐI VỚI ${other.stats.name}:
  Tương tác: ${speaker.matrix_to_other.interaction}, Tin tưởng: ${speaker.matrix_to_other.trust}, Thiện cảm: ${speaker.matrix_to_other.affection}, 
  Thân mật: ${speaker.matrix_to_other.intimacy}, Ân huệ: ${speaker.matrix_to_other.obligation}, Toan tính: ${speaker.matrix_to_other.interest}.
  Bạn coi họ là: ${speaker.matrix_to_other.relationship}. Bạn hay dùng từ xưng hô: "${speaker.matrix_to_other.title}".
  
  QUẢN TRÒ ĐIỀU PHỐI LUỒNG HỘI THOẠI YÊU CẦU: 
  Sắc thái biểu đạt (Tránh lan man sai chủ đề): "${gameState.world.next_tone}".
  Độ dài phát ngôn: "${gameState.world.next_length}".
  
  Lịch sử 4 thoại gần đây (Bối cảnh ngay lúc này):
  ${JSON.stringify(chatHistory.slice(-4))}

  NHIỆM VỤ (Vai diễn của bạn):
  Giữ vững đúng character tính cách, trả về JSON gồm:
  - Một dòng 'thought' (suy nghĩ bí mật lúc này).
  - Một 'dialogue' (câu nói / hoặc hành động đáp lại ngoài đời thực đúng với độ dài và tông giọng Quản trò yêu cầu).
  
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
  // PHASE 2: GAME MASTER EVALUATES AND CẬP NHẬT TỪNG CHỈ SỐ MỘT
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

  NHIỆM VỤ QUẢN TRÒ (QUAN TRỌNG NHẤT LÀ CẬP NHẬT TẤT CẢ CHỈ SỐ TỪNG CÁI MỘT LÊN XUỐNG DỰA TRÊN LOGIC KẾT QUẢ):
  1. CẬP NHẬT CHỈ SỐ: Dựa vào câu nói cuối cùng, hai nhân vật đã thay đổi gì về mặt sức khỏe (thân nhiệt, stress, hưng phấn) và tâm lý (affection, trust, pleasure...)? Trả về một block 'stats_delta' biểu diễn thay đổi bằng các con số bù trừ (+ / -). Chú ý không bỏ sót nếu có thông số nào hợp logic thay đổi. (ví dụ "pleasure": 2, "stress": -5).
  2. BỐI CẢNH: Rất chân thực - thời gian qua đi bao nhiêu phút? Có đổi chủ đề không? Môi trường có gì mới lạ (tiếng gió, đèn tắt...)?
  3. NGƯỜI TIẾP THEO: Điểu phối ai nói. Phải ra lệnh tông giọng (Mỉm cười, lảng tránh, cáu gắt...) và độ dài (Ngắn, im lặng, vài từ) cho người đó.
  
  Định dạng JSON Quản trò cần trả về:
  {
    "stats_delta": {
       "${speakerId}": { "pleasure": 2, "arousal": 1, "stress": -1 },
       "${other.id}": { "affection": 1, "intimacy": 2, "excitement": 3 }
    },
    "world_update": {
       "new_time": "Vd: 2026-10-15T20:15:00Z",
       "new_environment": "Giữ nguyên hoặc cập nhật bối cảnh",
       "new_topic": "Chủ đề đang diễn ra"
    },
    "next_turn": {
       "next_speaker_id": "${other.id} hoặc ${speakerId}",
       "tone_instruction": "Tông giọng gợi ý cho lượt tới",
       "length_instruction": "Độ dài yêu cầu cho lượt tới"
    }
  }
  `;

  console.log("Calling Game Master Engine (Updating Environment & All Stats)...");
  const gmResult = await model.generateContent(gmPrompt);
  const gmDecision = JSON.parse(gmResult.response.text());

  // Áp dụng Cập nhật World
  gameState.world.time = gmDecision.world_update.new_time;
  gameState.world.environment = gmDecision.world_update.new_environment;
  gameState.world.current_topic = gmDecision.world_update.new_topic;
  
  gameState.world.next_speaker = gmDecision.next_turn.next_speaker_id;
  gameState.world.next_tone = gmDecision.next_turn.tone_instruction;
  gameState.world.next_length = gmDecision.next_turn.length_instruction;

  // Áp dụng Cập nhật Mọi Chỉ số thay đổi
  const applyDeltas = (charObj, deltas) => {
    if (!deltas) return;
    for (const [key, val] of Object.entries(deltas)) {
      if (typeof charObj.stats[key] === 'number') {
        charObj.stats[key] = Math.max(0, Math.min(100, charObj.stats[key] + val));
      } else if (typeof charObj.matrix_to_other[key] === 'number') {
        charObj.matrix_to_other[key] = Math.max(0, Math.min(100, charObj.matrix_to_other[key] + val));
      }
    }
  };

  applyDeltas(speaker, gmDecision.stats_delta[speakerId]);
  applyDeltas(other, gmDecision.stats_delta[other.id]);

  fs.writeFileSync(statePath, JSON.stringify(gameState, null, 2));
  fs.writeFileSync(historyPath, JSON.stringify(chatHistory, null, 2));

  console.log(`\n=======================`);
  console.log(`[${newMessage.timestamp}] ${speaker.stats.name}:`);
  console.log(`THOUGHT: ${newMessage.thought}`);
  console.log(`SAYS: ${newMessage.dialogue}`);
  console.log(`=======================\n`);
  console.log(`GM Decided Next: [${gameState.world.next_speaker}], Tone: ${gameState.world.next_tone}, Length: ${gameState.world.next_length}`);
  console.log("Turn completed and fully saved.");
}

runCron().catch(console.error);
