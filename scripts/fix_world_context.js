import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let adminApp;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  adminApp = initializeApp({ credential: cert(serviceAccount) });
} else {
  adminApp = initializeApp();
}
const db = getFirestore(adminApp);

async function fixWorldContext(worldId) {
  console.log(`Đang kiểm tra và dọn dẹp ngữ cảnh cho ${worldId}...`);
  
  try {
    // 1. Cập nhật state (Xóa bối cảnh của Ethan/Mia)
    const worldRef = db.collection('worlds').doc(worldId);
    const doc = await worldRef.get();
    
    if (!doc.exists) {
      console.log(`Không tìm thấy ${worldId} trên database.`);
      return;
    }
    
    const data = doc.data();
    
    console.log("Tìm thấy thế giới. Đang kiểm tra tên nhân vật...");
    const charNames = data.characters.map(c => c.stats.name).join(' và ');
    console.log(`Nhân vật trong thế giới này: ${charNames}`);
    
    // Reset bối cảnh để AI không bị nhầm lẫn
    data.world.scenario = `Kịch bản khởi tạo dành cho ${charNames}. Hãy tự xây dựng câu chuyện dựa vào tính cách của hai người.`;
    data.world.environment = "Một không gian trống trải, yên tĩnh.";
    data.world.current_topic = "Sự khởi đầu mới";
    data.world.last_event = null; // Xóa sự kiện ngầm cũ
    
    await worldRef.set(data);
    console.log(`✅ Đã reset 'scenario' và 'environment' của ${worldId} thành bối cảnh mặc định cho ${charNames}.`);
    
    // 2. Lọc lịch sử chat cũ (history) bị lỗi thay vì xóa trắng
    const historyRef = db.collection('history').doc(worldId);
    const historyDoc = await historyRef.get();
    
    if (historyDoc.exists) {
      const messages = historyDoc.data().messages || [];
      // Chỉ lọc bỏ những tin nhắn nào mà AI vô tình nhắc tới Ethan hoặc Mia
      const cleanedMessages = messages.filter(msg => {
        const text = (msg.dialogue || '') + ' ' + (msg.thought || '');
        return !text.includes('Ethan') && !text.includes('Mia');
      });
      
      if (messages.length !== cleanedMessages.length) {
        await historyRef.set({ messages: cleanedMessages });
        console.log(`✅ Đã tìm thấy và lọc bỏ ${messages.length - cleanedMessages.length} tin nhắn bị dính tên Ethan/Mia. Giữ lại ${cleanedMessages.length} tin nhắn hợp lệ.`);
      } else {
        console.log(`✅ Lịch sử hội thoại không dính tên Ethan/Mia, giữ nguyên toàn bộ ${messages.length} tin nhắn.`);
      }
    }
    console.log(`\nHoàn thành sửa lỗi cho ${worldId}. Lần chạy AI Loop tiếp theo, hệ thống sẽ nhận ngữ cảnh hoàn toàn sạch sẽ!`);
    process.exit(0);
  } catch (error) {
    console.error("Lỗi:", error);
    process.exit(1);
  }
}

// Lấy world_id từ command line (Mặc định là world_2)
const targetWorld = process.argv[2] || 'world_2';
fixWorldContext(targetWorld);
