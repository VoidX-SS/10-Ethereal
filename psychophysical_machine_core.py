import torch
import torch.nn.functional as F
import time
from typing import Dict, Any, Tuple, Optional
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from google import genai

load_dotenv()
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    supabase = None
    print("Warning: Supabase credentials not found in .env")

# Khởi tạo Gemini Client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Warning: Failed to init Gemini Client: {e}")
else:
    print("Warning: GEMINI_API_KEY not found in .env")

# ==========================================
# CHỈ THỊ 2: ĐỊNH NGHĨA KIỂU DỮ LIỆU TENSOR
# ==========================================
class TensorTypes:
    """Định nghĩa cấu trúc tensor định kiểu mạnh (Strongly typed tensors)"""
    Vector = torch.Tensor       # Vector trạng thái 1D
    Matrix = torch.Tensor       # Ma trận 2D
    HighDimVector = torch.Tensor # Vector kỳ vọng đa chiều cho RPE

# ==========================================
# CÁC MODULE THẦN KINH - TOÁN HỌC CỐT LÕI
# ==========================================

def SRF_Retriever(
    query: TensorTypes.Vector, 
    context: TensorTypes.Vector, 
    E_weight: float, 
    A_weight: float, 
    recency_factor: float, 
    drift_penalty: float,
    S_similarity: float, 
    E_c: float, 
    A_c: float, 
    R_c: float, 
    D_c: float
) -> float:
    """
    Hàm tính toán truy xuất sinh học (Stone Retrieval Function - SRF).
    Phương trình: R = S(q,c) + αE(c) + βA(c) + γR(c) - δD(c)
    """
    R = S_similarity + (E_weight * E_c) + (A_weight * A_c) + (recency_factor * R_c) - (drift_penalty * D_c)
    return R

class HomeostaticRegulator:
    """1. Sự Điều Hòa Cân Bằng Nội Môi (Homeostatic Regulation)"""
    def __init__(self, decay_rate_lambda: float, setpoints: TensorTypes.Vector, weights: TensorTypes.Vector):
        self.decay_rate = decay_rate_lambda
        # setpoints: [Curiosity, Stress, Confidence]
        self.setpoints = setpoints
        self.weights = weights
        self.state = torch.zeros_like(setpoints, requires_grad=True)
        
    def integrate_decay(self, dt: float) -> TensorTypes.Vector:
        """Phương trình vi phân: dN(t)/dt = -λN(t) -> N(t) = N0 * e^(-λt)"""
        decay_factor = torch.exp(torch.tensor(-self.decay_rate * dt))
        # Vô hiệu hóa gradient khi cập nhật trạng thái trực tiếp
        with torch.no_grad():
            self.state.copy_(self.state * decay_factor)
        return self.state

    def calculate_loss(self) -> TensorTypes.Vector:
        """Tối ưu hóa hàm mất mát: Σ wi(xi - setpoint_i)^2"""
        deviations = (self.state - self.setpoints) ** 2
        loss = torch.sum(self.weights * deviations)
        return loss

class RPE_Calculator:
    """2. Tính Toán Lỗi Dự Đoán Phần Thưởng (Reward Prediction Error - RPE)"""
    def __init__(self, gamma: float):
        self.gamma = gamma

    def calculate_td_rpe(
        self, 
        R_t: TensorTypes.HighDimVector, 
        V_S_t: TensorTypes.HighDimVector, 
        V_S_t_plus_1: TensorTypes.HighDimVector
    ) -> TensorTypes.HighDimVector:
        """
        Vector RPE phương trình: δ_t = R_t + γV(S_{t+1}) - V(S_t)
        R_t, V(S) là các tensor đa chiều thay vì giá trị vô hướng.
        """
        delta_t = R_t + self.gamma * V_S_t_plus_1 - V_S_t
        return delta_t

class AmygdalaLogicGate:
    """3. Cổng Logic Hạch Hạnh Nhân (Amygdala Logic Gating)"""
    def __init__(self):
        self.max_interrupt_time_ms = 12.0 # Giới hạn tối đa 12ms
        self.LUT_bounded_action_space = {
            "CRITICAL_RPE": "Bảo vệ dữ liệu cốt lõi",
            "CATASTROPHE_FOLD": "Thoái lui khỏi môi trường",
            "STRESS_OVERLOAD": "Cắt đứt kết nối đa tác tử"
        }
        
    def trigger_interrupt(self, threat_pattern: str) -> str:
        """Lệnh ngắt cưỡng bức (Forced Interrupt)"""
        start = time.perf_counter()
        
        # Chặn đường truyền nhận thức top-down
        action = self.LUT_bounded_action_space.get(threat_pattern, "Bảo vệ dữ liệu cốt lõi")
        
        end = time.perf_counter()
        elapsed_ms = (end - start) * 1000.0
        assert elapsed_ms <= self.max_interrupt_time_ms, "Amygdala Hijack vượt quá 12ms!"
        return action

class CognitiveDissonanceProcessor:
    """4. Cơ Chế Bất Hòa Nhận Thức (Cognitive Dissonance)"""
    def evaluate_kl_divergence(
        self, 
        predicted_probs: TensorTypes.Vector, 
        core_rules_probs: TensorTypes.Vector
    ) -> TensorTypes.Vector:
        """Tính toán KL Divergence giữa dự đoán hiện tại và quy luật cốt lõi"""
        # Áp dụng log cho input của kl_div
        log_predicted = torch.log(predicted_probs + 1e-9)
        kl_div = F.kl_div(log_predicted, core_rules_probs, reduction='batchmean')
        return kl_div

class CuspCatastropheEvaluator:
    """5. Thuyết Thảm Họa (Cusp Catastrophe Theory)"""
    def calculate_bifurcation(self, alpha: TensorTypes.Vector, beta: TensorTypes.Vector) -> Tuple[bool, float]:
        """
        Đạo hàm hàm thế năng: dV/dY = Y^3 - βY - α = 0
        Biệt thức Delta (Δ) của phương trình bậc ba: Δ = 4β^3 - 27α^2
        """
        delta = 4 * (beta ** 3) - 27 * (alpha ** 2)
        
        # Thảm họa (Catastrophe) xảy ra khi rơi qua vùng nếp gấp (Fold Catastrophe)
        catastrophe_triggered = bool((delta <= 0) and (beta > 0))
        return catastrophe_triggered, delta.item()

class HMM_IntentRecognizer:
    """6. Mô Hình Markov Ẩn (HMM) Về Suy Luận Ý Định"""
    def __init__(self, num_states: int, num_observations: int):
        self.num_states = num_states
        # Tham số cấu trúc đa thức với Autograd
        self.A = torch.nn.Parameter(torch.rand(num_states, num_states)) # Ma trận Transition
        self.B = torch.nn.Parameter(torch.rand(num_states, num_observations)) # Ma trận Emission
        self.pi = torch.nn.Parameter(torch.rand(num_states))
        
    def infer_intent(self, observation_window: TensorTypes.Matrix) -> TensorTypes.Vector:
        """
        Thuật toán Viterbi / Forward-Backward xử lý mã hóa tốc độ thay đổi (Rate of change).
        Trả về vector xác suất ý định. (Mockup logic tensor)
        """
        # Tính toán tự động vi phân xác suất ý định
        intent_probs = F.softmax(torch.matmul(self.A, self.pi), dim=0)
        return intent_probs

class NetworkResonance:
    """7. Cộng Hưởng Mạng Lưới (Network Resonance)"""
    def run_cognirank(self, E_c: float, delta_t_magnitude: float):
        """Kích hoạt lây lan tín hiệu qua đỉnh mạng đồ thị (Entity Diffusion)"""
        pass

class GoalTreeOrchestrator:
    """Mạng Lưới Điều Phối Cây Mục Tiêu"""
    def execute_nodes(self):
        # Nút Sequence (->), Fallback (?), Parallel (=>)
        return "GOAL_TREE_EXECUTING_NORMAL_FLOW"

# ==========================================
# CHỈ THỊ 1: CẤU TRÚC DÒNG DỮ LIỆU THỜI GIAN THỰC
# ==========================================
class PsychophysicalProcessingMachine:
    def __init__(self):
        self.hmm = HMM_IntentRecognizer(num_states=3, num_observations=5)
        self.rpe_calc = RPE_Calculator(gamma=0.95)
        self.homeostasis = HomeostaticRegulator(
            decay_rate_lambda=0.01, 
            setpoints=torch.tensor([0.5, 0.2, 0.8]), # Tò mò, Căng thẳng, Tự tin
            weights=torch.tensor([1.0, 1.5, 1.0])
        )
        self.cog_diss = CognitiveDissonanceProcessor()
        self.cusp_eval = CuspCatastropheEvaluator()
        self.amygdala = AmygdalaLogicGate()
        self.goal_tree = GoalTreeOrchestrator()
        self.resonance = NetworkResonance()

    def event_loop_tick(
        self, 
        t: float, 
        dt: float, 
        obs_seq: TensorTypes.Matrix, 
        R_t: TensorTypes.HighDimVector, 
        V_S_t: TensorTypes.HighDimVector, 
        V_S_t_plus_1: TensorTypes.HighDimVector,
        pred_probs: TensorTypes.Vector,
        core_probs: TensorTypes.Vector
    ) -> Dict[str, Any]:
        """
        Vòng lặp sự kiện (Event Loop) cốt lõi của PPM.
        """
        # 1. Perception (Nhận thức)
        I_t = self.hmm.infer_intent(obs_seq)
        
        # 2. Homeostasis & Evaluation (Đánh giá tình trạng)
        delta_t = self.rpe_calc.calculate_td_rpe(R_t, V_S_t, V_S_t_plus_1)
        self.homeostasis.integrate_decay(dt)
        
        # 3. Conflict Resolution (Xử lý xung đột)
        kl_div = self.cog_diss.evaluate_kl_divergence(pred_probs, core_probs)
        
        # Cập nhật tham số Thuyết Thảm Họa (Auto-differentiated)
        alpha_val = torch.norm(I_t) + torch.abs(torch.min(delta_t, torch.zeros_like(delta_t))).sum()
        beta_val = self.homeostasis.state[1] + kl_div # Tích lũy Stress (index 1) và Dissonance
        
        alpha = torch.tensor([alpha_val], requires_grad=True)
        beta = torch.tensor([beta_val], requires_grad=True)
        
        # Kiểm tra phương trình Y^3 - βY - α = 0 thông qua biệt thức Δ
        catastrophe_triggered, delta_val = self.cusp_eval.calculate_bifurcation(alpha, beta)
        
        # 4. Routing & Gating (Chuyển mạch điều hướng)
        if catastrophe_triggered:
            CATASTROPHE_TRIGGERED = True
            action_executed = self.amygdala.trigger_interrupt("CATASTROPHE_FOLD")
            system_status = f"AMYGDALA_HIJACK_ACTIVE: {action_executed}"
        else:
            CATASTROPHE_TRIGGERED = False
            system_status = self.goal_tree.execute_nodes()
            
        # 5. Consolidation (Hợp nhất ký ức)
        E_c = alpha_val.item() # Gán E(c) dựa trên cường độ Amygdala
        self.resonance.run_cognirank(E_c, torch.norm(delta_t).item())
        
        # Lưu vào Supabase (Episodic Memory)
        if supabase:
            try:
                record_episodic = {
                    "event_description": f"Tick {t}: Intent={I_t.detach().numpy().tolist()}, Dissonance={kl_div.item():.4f}, Status={system_status}",
                    "emotional_weight": E_c,
                    "associative_strength": 0.5, # Giả lập giá trị
                    "recency": float(t),
                    "drift": 0.0
                }
                supabase.table("episodic_memory").insert(record_episodic).execute()
                
                # Lưu Semantic Memory (Embedding 3072 chiều với gemini-embedding-2)
                semantic_content = f"Tại tick {t}, nhân vật ghi nhận mức độ xung đột Dissonance: {kl_div.item():.4f}. Trạng thái hệ thống: {system_status}"
                if gemini_client:
                    response = gemini_client.models.embed_content(
                        model='gemini-embedding-2',
                        contents=semantic_content
                    )
                    embedding_vector = response.embeddings[0].values
                    
                    record_semantic = {
                        "content": semantic_content,
                        "embedding": embedding_vector,
                        "metadata": {"dissonance": kl_div.item(), "tick": t}
                    }
                    supabase.table("semantic_memory").insert(record_semantic).execute()
                
                # Lưu Procedural Memory nếu Catastrophe Triggered
                if CATASTROPHE_TRIGGERED:
                    rule_name = f"AMYGDALA_HIJACK_RULE_{int(t)}"
                    record_procedural = {
                        "rule_name": rule_name,
                        "condition_logic": {"stress_threshold": "high", "trigger": "amygdala_hijack"},
                        "action_result": action_executed,
                        "is_active": True
                    }
                    supabase.table("procedural_memory").insert(record_procedural).execute()
                    
            except Exception as e:
                pass # Bỏ qua print lỗi để stdout chỉ xuất json
        
        return {
            "tick": t,
            "intent_vector": I_t,
            "rpe_vector": delta_t,
            "catastrophe_delta": delta_val,
            "catastrophe_triggered": CATASTROPHE_TRIGGERED,
            "status": system_status
        }

if __name__ == "__main__":
    import sys
    import json
    
    # Khởi tạo lõi kiến trúc PPM
    ppm_core = PsychophysicalProcessingMachine()
    
    if len(sys.argv) > 1:
        try:
            input_data = json.loads(sys.argv[1])
            # Có thể lấy biến từ input_data để cập nhật seed
            # nhưng tạm thời sẽ dùng random để mô phỏng
            obs_seq = torch.rand(3, 5) 
            R_t = torch.rand(3)
            V_S_t = torch.rand(3)
            V_S_t_plus_1 = torch.rand(3)
            pred_probs = torch.tensor([0.2, 0.5, 0.3])
            core_probs = torch.tensor([0.3, 0.4, 0.3])
            
            result = ppm_core.event_loop_tick(
                t=time.time(), 
                dt=0.1, 
                obs_seq=obs_seq, 
                R_t=R_t, 
                V_S_t=V_S_t, 
                V_S_t_plus_1=V_S_t_plus_1, 
                pred_probs=pred_probs, 
                core_probs=core_probs
            )
            
            clean_result = {
                "catastrophe_triggered": result["catastrophe_triggered"],
                "status": result["status"],
                "catastrophe_delta": float(result["catastrophe_delta"])
            }
            print(json.dumps(clean_result))
        except Exception as e:
            print(json.dumps({"error": str(e), "catastrophe_triggered": False, "status": "Lỗi tích hợp Python"}))
    else:
        # Nếu gọi chay (không tham số) thì in test thông thường
        print("Psychophysical Processing Machine Core Bootstrapped.")
        print("Đang chạy thử nghiệm 1 vòng lặp Event Loop...")
        obs_seq = torch.rand(3, 5)
        R_t = torch.rand(3)
        V_S_t = torch.rand(3)
        V_S_t_plus_1 = torch.rand(3)
        pred_probs = torch.tensor([0.2, 0.5, 0.3])
        core_probs = torch.tensor([0.3, 0.4, 0.3])
        
        result = ppm_core.event_loop_tick(
            t=time.time(), 
            dt=0.1, 
            obs_seq=obs_seq, 
            R_t=R_t, 
            V_S_t=V_S_t, 
            V_S_t_plus_1=V_S_t_plus_1, 
            pred_probs=pred_probs, 
            core_probs=core_probs
        )
        print("Kết quả vòng lặp:", result)
