# Hoàn thiện Mâu thuẫn Hệ thống Psychophysical (PPM) & Tích hợp Neuro-Director

Bản kế hoạch này giải quyết 3 mâu thuẫn cốt lõi trong luồng thông tin của hệ thống 10 Ethereal và tích hợp Meta-Prompt để điều phối LLM sinh thoại dựa trên chỉ số sinh học.

## User Review Required

> [!WARNING]
> **Về việc chạy Python Core & Sinh thoại (Phase 1 vs Phase 1.5)**
> Hiện tại `cron.js` chạy theo thứ tự: **1.** Character nghĩ và nói -> **2.** Python Core phân tích -> **3.** Game Master. 
> Để Character có thể sử dụng `kl_div`, `catastrophe_triggered` làm đầu vào (Meta-Prompt), tôi sẽ lưu kết quả phân tích của Python Core từ tick trước vào `gameState.world.ppm_state`, sau đó tiêm vào prompt của Character ở tick sau. Bạn có đồng ý với luồng này không? (Nếu muốn Character phản ứng ngay trong cùng 1 tick thì chúng ta sẽ phải đảo vị trí gọi Python Core lên trước Phase 1).

## Proposed Changes

### Pipeline 1 & 2: Rút gọn I/O & Dynamic Thresholding (Python Core)

#### [MODIFY] [psychophysical_machine_core.py](file:///c:/Users/namng/OneDrive/文档/10%20Ethereal/psychophysical_machine_core.py)
- **Chuẩn hóa TS -> Python**: Thêm lớp chuẩn hóa `flat_stats = flat_stats / 100.0` ngay khi nhận dữ liệu trong `event_loop_tick` để khớp với Tensor không gian [0, 1].
- **Dynamic Thresholding**: 
  - Tính toán `stress_tensor = self.homeostasis.state[1].item()`
  - Thay thế giá trị cứng `0.6` trong RAG Episodic bằng `dynamic_threshold = 0.5 + (0.3 * stress_tensor)`.
- **Rút gọn I/O**:
  - Đưa toàn bộ block `# Lưu vào Supabase (Dual-RAG Hybrid)` vào trong một hàm chạy ngầm qua `threading.Thread` để vòng lặp trả kết quả ngay lập tức (dưới 50ms).
- **Xuất Payload cho Prompt**:
  - Trả thêm `kl_div` và `intent_vector_dominant` trong dict kết quả của vòng lặp để Node.js có thể lấy.

---

### Pipeline 3: Cơ chế Phân rã Ký ức (Memory Decay)

#### [NEW] [cron_neuroplasticity.py](file:///c:/Users/namng/OneDrive/文档/10%20Ethereal/scripts/cron_neuroplasticity.py)
- Viết script chạy độc lập kết nối đến Supabase.
- Lấy toàn bộ bản ghi trong `episodic_memory`.
- Áp dụng phương trình quên lãng Ebbinghaus để cập nhật lại `associative_strength`.
- Ký ức nào quá mờ nhạt có thể từ từ giảm trọng số.

---

### Phase 3: Meta-Prompt (TS/JS)

#### [MODIFY] [cron.js](file:///c:/Users/namng/OneDrive/文档/10%20Ethereal/scripts/cron.js)
- **Phase 1 (Character Prompt)**: 
  - Đọc `gameState.world.ppm_state` (nếu có).
  - Tiêm `[META-PROMPT: NEURO-DIRECTOR CUE]` vào trong `charPrompt` để ép AI "diễn" trạng thái hoảng loạn / đứt đoạn cú pháp nếu `catastrophe_triggered` là `true`, và diễn vi hành vi nếu `kl_div > 1.5`.
- **Phase 1.5 (PPM Core)**:
  - Lưu các giá trị mới (`kl_div`, `catastrophe_triggered`, `intent_vector`) trả về từ Python vào `gameState.world.ppm_state` trước khi lưu vào Firestore, để dùng cho tick kế tiếp.

## Verification Plan

### Automated Tests
1. Chạy `node scripts/cron.js` sau khi cập nhật để kiểm tra xem Meta-Prompt có được tiêm thành công không.
2. Kiểm tra log Python Core xem thời gian thực thi có giảm xuống nhờ Threading (I/O bất đồng bộ) không.
3. Chạy tay `python scripts/cron_neuroplasticity.py` để quan sát sự suy giảm của `associative_strength` trên Supabase.

### Manual Verification
1. Xem trên Firestore phần `worlds.world_1.ppm_state` xem có lưu đúng `kl_div` và trạng thái Amygdala không.
2. Kiểm tra log sinh thoại của LLM xem nhân vật có thay đổi độ dài câu từ (đứt đoạn) khi bị sốc tâm lý không.
