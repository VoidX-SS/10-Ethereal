import os
from dotenv import load_dotenv
from supabase import create_client, Client
import math
from datetime import datetime, timezone

load_dotenv()
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")

def run_neuroplasticity_decay():
    print("===========================================")
    print(f"[{datetime.now().isoformat()}] Bắt đầu tiến trình Neuroplasticity (Memory Decay)...")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Lỗi: Không tìm thấy Supabase credentials.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 1. Lấy tất cả ký ức sự kiện
    # Trong môi trường production, có thể paginate nếu data lớn
    response = supabase.table("episodic_memory").select("id, created_at, associative_strength").execute()
    
    memories = response.data
    if not memories:
        print("Không có ký ức nào để phân rã.")
        return
        
    print(f"Đã tải {len(memories)} ký ức từ Episodic Memory.")
    
    now = datetime.now(timezone.utc)
    decay_rate = 0.05 # Tốc độ phân rã (S trong phương trình Ebbinghaus)
    updated_count = 0
    
    for memory in memories:
        try:
            # Parse datetime: '2026-05-01T07:59:25.000Z' hoặc tương tự
            created_at_str = memory['created_at']
            if created_at_str.endswith('Z'):
                created_at_str = created_at_str[:-1] + '+00:00'
                
            created_at = datetime.fromisoformat(created_at_str)
            hours_elapsed = (now - created_at).total_seconds() / 3600.0
            
            # Tính toán độ mạnh liên kết mới
            # Phương trình quên lãng: R = e^(-t/S) -> A_new = A_old * e^(-decay_rate * hours)
            old_strength = memory.get('associative_strength', 0.5)
            
            # Nếu ký ức mới tạo, t sẽ rất nhỏ, e^0 = 1.
            decay_factor = math.exp(-decay_rate * hours_elapsed)
            new_strength = old_strength * decay_factor
            
            # Chỉ cập nhật nếu có sự thay đổi đáng kể (> 0.01) để tránh call API quá nhiều
            if abs(old_strength - new_strength) > 0.01:
                # Cập nhật Supabase
                supabase.table("episodic_memory").update({
                    "associative_strength": new_strength
                }).eq("id", memory['id']).execute()
                updated_count += 1
                
        except Exception as e:
            print(f"Lỗi khi xử lý ký ức {memory.get('id')}: {e}")
            
    print(f"Tiến trình hoàn tất. Đã phân rã và cập nhật {updated_count}/{len(memories)} ký ức.")
    print("===========================================")

if __name__ == "__main__":
    run_neuroplasticity_decay()
