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

    def retrieve(self, supabase_client, query_emb: list, match_threshold=0.6, match_count=3) -> list:
        if not supabase_client: return []
        try:
            res = supabase_client.rpc('match_documents', {
                'query_embedding': query_emb, 
                'match_threshold': match_threshold, 
                'match_count': match_count
            }).execute()
            
            memories = []
            for item in res.data:
                # Giả lập chấm điểm SRF đơn giản dựa trên similarity
                score = item['similarity'] * 1.5 # (S_similarity)
                memories.append({"content": item['content'], "score": score})
            memories.sort(key=lambda x: x["score"], reverse=True)
            return memories
        except Exception as e:
            return [{"error": str(e)}]

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
        Xử lý chuỗi quan sát để đoán ý định bằng Forward pass đơn giản.
        """
        # obs: tensor [obs_dim]
        obs = observation_window[-1] if len(observation_window.shape) > 1 else observation_window
        # Emission prob (num_states)
        emission = F.softmax(torch.matmul(self.B, obs), dim=0)
        # Intent prob (tích hợp Pi và Emission)
        intent_probs = F.softmax(self.pi * emission + torch.matmul(self.A, self.pi), dim=0)
        return intent_probs

class NetworkResonance:
    """7. Cộng Hưởng Mạng Lưới (Network Resonance)"""
    def run_cognirank(self, E_c: float, delta_t_magnitude: float):
        """Kích hoạt lây lan tín hiệu qua đỉnh mạng đồ thị (Entity Diffusion)"""
        pass

class GoalTreeOrchestrator:
    """Mạng Lưới Điều Phối Cây Mục Tiêu"""
    def execute_nodes(self, intent_vector: TensorTypes.Vector):
        intent_idx = torch.argmax(intent_vector).item()
        intents = [
            "Xu hướng phòng thủ, khép kín",
            "Xu hướng muốn kết nối, cởi mở",
            "Xu hướng thăm dò, tò mò"
        ]
        chosen_intent = intents[intent_idx] if intent_idx < len(intents) else "Bình thường"
        return f"GOAL_TREE_EXECUTING: {chosen_intent}"

class DeepBayesianToM(torch.nn.Module):
    """8. Deep Bayesian Theory of Mind (Hiệu ứng Rashomon)"""
    def __init__(self, num_stats: int):
        super().__init__()
        # Mạng dự đoán tham số Bayes từ chỉ số người nói và người nghe (ghép lại: 2 * num_stats)
        self.predictor = torch.nn.Linear(num_stats * 2, 2)
        
    def forward(self, speaker_stats: TensorTypes.Vector, listener_stats: TensorTypes.Vector) -> Tuple[bool, float]:
        # Ghép 2 vector
        combined_stats = torch.cat([speaker_stats, listener_stats], dim=0)
        # Dự đoán Prior và Sensitivity
        out = torch.sigmoid(self.predictor(combined_stats))
        prior_skepticism = out[0]
        sensitivity = out[1]
        
        # Áp dụng định lý Bayes (Đơn giản hóa)
        # Xác suất H (Hoài nghi) khi có bằng chứng E (Dấu hiệu dối trá)
        # P(H|E) = (P(E|H) * P(H)) / P(E)
        posterior = (sensitivity * prior_skepticism) / (
            (sensitivity * prior_skepticism) + ((1.0 - sensitivity) * (1.0 - prior_skepticism)) + 1e-9
        )
        
        # Nếu posterior quá cao, kích hoạt hiệu ứng Rashomon
        rashomon_triggered = bool(posterior.item() > 0.8)
        return rashomon_triggered, posterior

class GlobalProjectionNetwork(torch.nn.Module):
    """Mạng Chiếu Toàn Cục (Global Projection Network)"""
    def __init__(self, num_stats: int, target_dim: int):
        super().__init__()
        self.projection_R = torch.nn.Linear(num_stats, target_dim)
        self.projection_V = torch.nn.Linear(num_stats, target_dim)
        
    def forward(self, flat_stats: TensorTypes.Vector) -> Tuple[TensorTypes.Vector, TensorTypes.Vector]:
        R_t = torch.sigmoid(self.projection_R(flat_stats))
        V_S_t = torch.sigmoid(self.projection_V(flat_stats))
        return R_t, V_S_t

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
        self.srf = None # Chuyển thành method cục bộ hoặc class riêng
        
        self.num_stats = 30 # Mặc định 30 chỉ số (có thể tự resize nếu cần)
        self.projection_net = GlobalProjectionNetwork(self.num_stats, 3)
        self.bayesian_tom = DeepBayesianToM(self.num_stats)
        
        self.optimizer = torch.optim.Adam([
            self.hmm.A, self.hmm.B, self.hmm.pi, self.homeostasis.state
        ] + list(self.projection_net.parameters()) + list(self.bayesian_tom.parameters()), lr=0.01)

    def load_weights(self, weights_dict: dict):
        if not weights_dict: return
        try:
            if "hmm_A" in weights_dict: self.hmm.A.data = torch.tensor(weights_dict["hmm_A"])
            if "hmm_B" in weights_dict: self.hmm.B.data = torch.tensor(weights_dict["hmm_B"])
            if "hmm_pi" in weights_dict: self.hmm.pi.data = torch.tensor(weights_dict["hmm_pi"])
            if "homeostasis_state" in weights_dict: self.homeostasis.state.data = torch.tensor(weights_dict["homeostasis_state"])
            if "proj_R_weight" in weights_dict: self.projection_net.projection_R.weight.data = torch.tensor(weights_dict["proj_R_weight"])
            if "proj_R_bias" in weights_dict: self.projection_net.projection_R.bias.data = torch.tensor(weights_dict["proj_R_bias"])
            if "proj_V_weight" in weights_dict: self.projection_net.projection_V.weight.data = torch.tensor(weights_dict["proj_V_weight"])
            if "proj_V_bias" in weights_dict: self.projection_net.projection_V.bias.data = torch.tensor(weights_dict["proj_V_bias"])
            if "tom_predictor_weight" in weights_dict: self.bayesian_tom.predictor.weight.data = torch.tensor(weights_dict["tom_predictor_weight"])
            if "tom_predictor_bias" in weights_dict: self.bayesian_tom.predictor.bias.data = torch.tensor(weights_dict["tom_predictor_bias"])
        except Exception as e:
            pass

    def export_weights(self) -> dict:
        return {
            "hmm_A": self.hmm.A.detach().numpy().tolist(),
            "hmm_B": self.hmm.B.detach().numpy().tolist(),
            "hmm_pi": self.hmm.pi.detach().numpy().tolist(),
            "homeostasis_state": self.homeostasis.state.detach().numpy().tolist(),
            "proj_R_weight": self.projection_net.projection_R.weight.detach().numpy().tolist(),
            "proj_R_bias": self.projection_net.projection_R.bias.detach().numpy().tolist(),
            "proj_V_weight": self.projection_net.projection_V.weight.detach().numpy().tolist(),
            "proj_V_bias": self.projection_net.projection_V.bias.detach().numpy().tolist(),
            "tom_predictor_weight": self.bayesian_tom.predictor.weight.detach().numpy().tolist(),
            "tom_predictor_bias": self.bayesian_tom.predictor.bias.detach().numpy().tolist()
        }

    def event_loop_tick(
        self, 
        t: float, 
        dt: float, 
        obs_seq: TensorTypes.Matrix, 
        R_t: TensorTypes.HighDimVector, 
        V_S_t: TensorTypes.HighDimVector, 
        V_S_t_plus_1: TensorTypes.HighDimVector,
        pred_probs: TensorTypes.Vector,
        core_probs: TensorTypes.Vector,
        query_text: str = "",
        world_id: str = "unknown_world",
        flat_stats: Optional[TensorTypes.Vector] = None,
        listener_stats: Optional[TensorTypes.Vector] = None
    ) -> Dict[str, Any]:
        """
        Vòng lặp sự kiện (Event Loop) cốt lõi của PPM.
        """
        # 0. Global Projection & Bayesian ToM (Nếu có flat_stats)
        rashomon_triggered = False
        posterior_val = 0.0
        if flat_stats is not None:
            if flat_stats.shape[0] == self.num_stats:
                # TS sends 0-100, normalize to 0-1
                flat_stats = flat_stats / 100.0
                proj_R, proj_V = self.projection_net(flat_stats)
                # Tạm thời cập nhật R_t và V_S_t từ mạng nơ-ron (Ghi đè giá trị cũ)
                R_t = proj_R
                V_S_t = proj_V
                V_S_t_plus_1 = proj_V # Giả định tương lai gần
                
            if listener_stats is not None and listener_stats.shape[0] == self.num_stats:
                rashomon_triggered, posterior = self.bayesian_tom(flat_stats, listener_stats)
                posterior_val = posterior.item()

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
        
        alpha = torch.tensor([alpha_val.item()], requires_grad=True)
        beta = torch.tensor([beta_val.item()], requires_grad=True)
        
        # Kiểm tra phương trình Y^3 - βY - α = 0 thông qua biệt thức Δ
        catastrophe_triggered, delta_val = self.cusp_eval.calculate_bifurcation(alpha, beta)
        
        # 4. Routing & Gating (Chuyển mạch điều hướng)
        if catastrophe_triggered:
            CATASTROPHE_TRIGGERED = True
            action_executed = self.amygdala.trigger_interrupt("CATASTROPHE_FOLD")
            system_status = f"AMYGDALA_HIJACK_ACTIVE: {action_executed}"
        else:
            CATASTROPHE_TRIGGERED = False
            system_status = self.goal_tree.execute_nodes(I_t)
            
        intent_idx = torch.argmax(I_t).item()
        intents = [
            "Xu hướng phòng thủ, khép kín",
            "Xu hướng muốn kết nối, cởi mở",
            "Xu hướng thăm dò, tò tự"
        ]
        intent_vector_dominant = intents[intent_idx] if intent_idx < len(intents) else "Bình thường"
            
        # 5. Consolidation & Tối ưu hóa (Backpropagation)
        # De-lobotomize: Loại bỏ delta_t (RPE) khỏi hàm Loss để AI cảm nhận cú sốc thay vì ép nó về 0.
        self.optimizer.zero_grad()
        loss = kl_div + self.homeostasis.calculate_loss()
        loss.backward()
        self.optimizer.step()
        
        E_c = alpha_val.item() # Gán E(c) dựa trên cường độ Amygdala
        # Resonance: Ảnh hưởng nội bộ nhân vật (không lan truyền sang world khác)
        self.resonance.run_cognirank(E_c, torch.norm(delta_t).item())
        
        # 6. SRF Retrieval (Ký ức)
        retrieved_memory_text = ""
        # Tính toán Dynamic Threshold dựa trên mức độ Căng thẳng (Stress)
        current_stress_tensor = self.homeostasis.state[1].item()
        dynamic_threshold = 0.5 + (0.3 * current_stress_tensor)
        
        if supabase and gemini_client and query_text:
            try:
                emb_res = gemini_client.models.embed_content(model='gemini-embedding-2', contents=query_text)
                q_emb = emb_res.embeddings[0].values
                # SRF search (Dual-RAG: Semantic + Episodic)
                sem_res = supabase.rpc('match_semantic_documents', {
                    'query_embedding': q_emb, 
                    'filter_world_id': world_id,
                    'match_threshold': 0.6, 
                    'match_count': 2
                }).execute()
                epi_res = supabase.rpc('match_episodic_documents', {
                    'query_embedding': q_emb, 
                    'filter_world_id': world_id,
                    'match_threshold': dynamic_threshold, 
                    'match_count': 2
                }).execute()
                
                memories = []
                if sem_res.data:
                    memories.extend([f"[Kiến thức]: {d['content']}" for d in sem_res.data])
                if epi_res.data:
                    memories.extend([f"[Kinh nghiệm]: {d['event_description']} (Trọng số cảm xúc: {d['emotional_weight']})" for d in epi_res.data])
                
                if memories:
                    retrieved_memory_text = " | ".join(memories)
            except Exception as e:
                retrieved_memory_text = f"Lỗi truy xuất: {str(e)}"
        
        # Lưu vào Supabase (Dual-RAG Hybrid)
        def save_to_supabase_async():
            if not supabase: return
            try:
                # 1. Lưu Episodic Memory (Có nhúng Vector)
                event_desc = query_text if query_text else f"Tick {t}: Không có hội thoại. Trạng thái: {system_status}"
                epi_embedding = []
                if gemini_client and query_text:
                    epi_emb_res = gemini_client.models.embed_content(model='gemini-embedding-2', contents=event_desc)
                    epi_embedding = epi_emb_res.embeddings[0].values
                
                record_episodic = {
                    "world_id": world_id,
                    "event_description": event_desc,
                    "embedding": epi_embedding if epi_embedding else None,
                    "emotional_weight": E_c,
                    "associative_strength": 0.5,
                    "recency": float(t),
                    "drift": 0.0
                }
                supabase.table("episodic_memory").insert(record_episodic).execute()
                
                # 2. Lưu Semantic Memory (Có nhúng Vector, chứa kiến thức đúc kết)
                semantic_content = f"Sự kiện: {query_text}. Đánh giá đúc kết: Mức độ xung đột Dissonance nội tâm là {kl_div.item():.4f}. Phản ứng hệ thống: {system_status}."
                if gemini_client:
                    sem_emb_res = gemini_client.models.embed_content(
                        model='gemini-embedding-2',
                        contents=semantic_content
                    )
                    sem_embedding = sem_emb_res.embeddings[0].values
                    
                    record_semantic = {
                        "world_id": world_id,
                        "content": semantic_content,
                        "embedding": sem_embedding,
                        "metadata": {"dissonance": kl_div.item(), "tick": t}
                    }
                    supabase.table("semantic_memory").insert(record_semantic).execute()
                
                # 3. Lưu Procedural Memory (Không Vector, Chỉ có Rule)
                if CATASTROPHE_TRIGGERED:
                    rule_name = f"AMYGDALA_HIJACK_RULE_{int(t)}"
                    record_procedural = {
                        "world_id": world_id,
                        "rule_name": rule_name,
                        "condition_logic": {"stress_threshold": "high", "trigger": "amygdala_hijack"},
                        "action_result": action_executed,
                        "is_active": True
                    }
                    supabase.table("procedural_memory").insert(record_procedural).execute()
                    
            except Exception as e:
                import sys
                print(f"Supabase/Gemini Error in Background Thread: {e}", file=sys.stderr)
                
        # Fire and forget
        import threading
        if supabase:
            threading.Thread(target=save_to_supabase_async, daemon=False).start()
        
        return {
            "tick": t,
            "intent_vector": I_t.detach().numpy().tolist(),
            "intent_vector_dominant": intent_vector_dominant,
            "rpe_vector": delta_t.detach().numpy().tolist(),
            "kl_div": float(kl_div.item()),
            "catastrophe_delta": float(delta_val),
            "catastrophe_triggered": CATASTROPHE_TRIGGERED,
            "status": system_status,
            "rashomon_triggered": rashomon_triggered,
            "rashomon_posterior": posterior_val,
            "retrieved_memory": retrieved_memory_text,
            "new_weights": self.export_weights()
        }

if __name__ == "__main__":
    import sys
    import json
    
    # Khởi tạo lõi kiến trúc PPM
    ppm_core = PsychophysicalProcessingMachine()
    
    if len(sys.argv) > 1:
        try:
            input_data = json.loads(sys.argv[1])
            if "ml_weights" in input_data and input_data["ml_weights"]:
                ppm_core.load_weights(input_data["ml_weights"])
                
            obs_seq = torch.tensor(input_data.get("obs_seq", [[0.5]*5]))
            R_t = torch.tensor(input_data.get("R_t", [0.5]*3))
            V_S_t = torch.tensor(input_data.get("V_S_t", [0.5]*3))
            V_S_t_plus_1 = torch.tensor(input_data.get("V_S_t_plus_1", [0.5]*3))
            pred_probs = torch.tensor(input_data.get("pred_probs", [0.5]*3))
            core_probs = torch.tensor(input_data.get("core_probs", [0.5]*3))
            query_text = input_data.get("query_text", "")
            world_id = input_data.get("world_id", "unknown_world")
            
            flat_stats = None
            if "flat_stats" in input_data:
                flat_stats = torch.tensor(input_data["flat_stats"], dtype=torch.float32)
            listener_stats = None
            if "listener_stats" in input_data:
                listener_stats = torch.tensor(input_data["listener_stats"], dtype=torch.float32)
            
            result = ppm_core.event_loop_tick(
                t=time.time(), 
                dt=1.0, 
                obs_seq=obs_seq, 
                R_t=R_t, 
                V_S_t=V_S_t, 
                V_S_t_plus_1=V_S_t_plus_1, 
                pred_probs=pred_probs, 
                core_probs=core_probs,
                query_text=query_text,
                world_id=world_id,
                flat_stats=flat_stats,
                listener_stats=listener_stats
            )
            
            clean_result = {
                "catastrophe_triggered": result["catastrophe_triggered"],
                "status": result["status"],
                "catastrophe_delta": float(result["catastrophe_delta"]),
                "kl_div": float(result["kl_div"]),
                "intent_vector_dominant": result["intent_vector_dominant"],
                "retrieved_memory": result.get("retrieved_memory", ""),
                "new_weights": result["new_weights"]
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
