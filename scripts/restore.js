import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

let adminApp;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  adminApp = initializeApp({ credential: cert(serviceAccount) });
} else {
  adminApp = initializeApp();
}
const db = getFirestore(adminApp);

async function restore() {
  const worldId = 'world_1777344668501';
  
  const worldDoc = await db.collection('worlds').doc(worldId).get();
  let suaId = 'char_A';
  if (worldDoc.exists) {
      const sua = worldDoc.data().characters.find(c => c.stats.name.toLowerCase().includes('sua'));
      if (sua) suaId = sua.id;
  }

  const historyRef = db.collection('history').doc(worldId);
  const doc = await historyRef.get();
  let messages = doc.exists ? doc.data().messages || [] : [];
  
  messages.push({
    id: "msg_restored_" + Date.now(),
    timestamp: new Date().toISOString(),
    characterId: suaId,
    thought: "Chứng kiến sự ồn ào bên ngoài, mình cảm thấy khó chịu vì nó phá vỡ không gian riêng, nhưng việc quan sát Mizi ở đây lại khiến mình muốn rút cạn những lớp mặt nạ logic khô khan để tìm kiếm sự kết nối thật sự.",
    dialogues: [
      "*Tôi nhìn Mizi, hơi thở uể oải, tay tự giác gạt mấy lọn tóc rối sang một bên.*",
      "Bên ngoài kia đúng là một đống hỗn độn không cần thiết, 'Bến đò' à.",
      "*Tôi hơi nghiêng đầu, đôi mắt phản chiếu sự trống rỗng đầy toan tính nhưng sâu thẳm lại khát khao hơi ấm từ cô ấy.*",
      "Thật phiền phức khi phải đối mặt với thế giới này, chỉ có ngồi yên ở đây với cô là tôi thấy logic của mình bớt vô nghĩa đi đôi chút."
    ]
  });
  
  await historyRef.set({ messages });
  console.log("Đã khôi phục tin nhắn thành công!");
  process.exit(0);
}

restore();
