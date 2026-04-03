export interface Statistic {
  // 1. Hồ sơ
  name: string;
  date_of_birth: string;
  gender: string;
  job: string;
  position: string;
  relationship_list: string;
  fortune: string;
  
  // Status
  health: number;
  look: number;
  iq: number;
  eq: number;
  
  // Thông tin bản thân
  faith: string;
  passion: string;
  emotional_pain: string;
  love_hates: string;
  pros_cons: string;

  // 2. Bản sắc (0-100)
  openness: number;
  dedicate: number;
  tendency: number;
  sociable: number;
  stability: number;

  // 3. Sinh lý (0-100)
  energy: number;
  nutrient: number;
  temperature: number;
  comfortable: number;
  stress: number;
  excitement: number;

  // 4. Tâm lý (0-100)
  pleasure: number;
  arousal: number;
  domination: number;
  will_power: number;
  faith_index: number;

  // 5. Nhận thức (0-100)
  logic_emotion: number;
  focus_spain: number;
  bias: number;
  thinking_type: number;
  awareness_time: boolean;

  // 6. Xã hội (0-100)
  position_len: number;
  social_bias: number;
  environment_skeptical: number;

  // 7. Nâng cao
  long_term_intention: string;
  stick_index: number;
  next_intention: string;
}

export interface MatrixConnection {
  interaction: number;
  trust: number;
  affection: number;
  intimacy: number;
  obligation: number;
  interest: number;
  relationship: string;
  title: string;
}

export interface World {
  scenario: string;
  current_topic: string;
  environment: string;
  time: string;
  rules: string;
  next_speaker: string;
  next_tone: string;
  next_length: string;
}

export interface Character {
  id: string;
  roleplay_prompt: string; 
  stats: Statistic;
  matrix_to_other: MatrixConnection;
}

export interface GameState {
  characters: Character[];
  world: World;
}

export interface ChatMessage {
  id: string;
  timestamp: string;
  characterId: string;
  thought: string;
  dialogue: string;
}
