import { useState } from 'react'
import styles from './Sidebar.module.css'
import type { GameState, Character } from '../types'

interface SidebarProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const getCategories = () => [
  {
    title: "1. Thông Tin Cá Nhân (Hồ sơ)",
    keys: [
      { key: "job", label: "Công việc (Job)", type: "string" },
      { key: "position", label: "Vị trí hiện tại", type: "string" },
      { key: "relationship_list", label: "DS Mối quan hệ", type: "string" },
      { key: "fortune", label: "Tài sản", type: "string" },
      { key: "faith", label: "Niềm tin", type: "string" },
      { key: "passion", label: "Ước mơ / Đam mê", type: "string" },
      { key: "emotional_pain", label: "Vết thương tâm lý", type: "string" },
      { key: "love_hates", label: "Yêu / Ghét", type: "string" },
      { key: "pros_cons", label: "Điểm mạnh / Yếu", type: "string" },
    ]
  },
  {
    title: "Trạng Thái Bề Ngoài",
    grid: true,
    keys: [
      { key: "health", label: "Sức khỏe", type: "number" },
      { key: "look", label: "Ngoại hình", type: "number" },
      { key: "iq", label: "IQ", type: "number" },
      { key: "eq", label: "EQ", type: "number" },
    ]
  },
  {
    title: "2. Bản Sắc",
    grid: true,
    keys: [
      { key: "openness", label: "Cởi mở (Bảo thủ - Sáng tạo)", type: "number" },
      { key: "dedicate", label: "Tận tâm (Tùy hứng - Kỷ luật)", type: "number" },
      { key: "tendency", label: "Khuynh hướng (Hướng nội - Sáng tạo)", type: "number" },
      { key: "sociable", label: "Hòa đồng (Hung ác - Hiền lành)", type: "number" },
      { key: "stability", label: "Ổn định (Lo âu - Bình thản)", type: "number" },
    ]
  },
  {
    title: "3. Sinh Lý",
    grid: true,
    keys: [
      { key: "energy", label: "Năng lượng", type: "number" },
      { key: "nutrient", label: "Dinh dưỡng", type: "number" },
      { key: "temperature", label: "Thân nhiệt", type: "number" },
      { key: "comfortable", label: "Sự thoải mái", type: "number" },
      { key: "stress", label: "Stress", type: "number" },
      { key: "excitement", label: "Hưng phấn", type: "number" },
    ]
  },
  {
    title: "4. Tâm Lý",
    grid: true,
    keys: [
      { key: "pleasure", label: "Niềm vui", type: "number" },
      { key: "arousal", label: "Sự kích thích", type: "number" },
      { key: "domination", label: "Sự thống trị", type: "number" },
      { key: "will_power", label: "Ý chí", type: "number" },
      { key: "faith_index", label: "Độ kiên định (Niềm tin)", type: "number" },
    ]
  },
  {
    title: "5. Nhận Thức",
    grid: true,
    keys: [
      { key: "logic_emotion", label: "Cán cân Lý trí / Cảm xúc", type: "number" },
      { key: "focus_spain", label: "Độ tập trung", type: "number" },
      { key: "bias", label: "Thiên kiến xác nhận", type: "number" },
      { key: "thinking_type", label: "Xu hướng suy diễn", type: "number" },
      { key: "awareness_time", label: "Nhạy cảm thời gian", type: "boolean" },
    ]
  },
  {
    title: "6. Xã Hội",
    grid: true,
    keys: [
      { key: "position_len", label: "Cảm nhận vị thế", type: "number" },
      { key: "social_bias", label: "Nhu cầu xã hội", type: "number" },
      { key: "environment_skeptical", label: "Hoài nghi môi trường", type: "number" },
    ]
  },
  {
    title: "7. Nâng Cao",
    keys: [
      { key: "long_term_intention", label: "Ý định dài hạn", type: "string" },
      { key: "stick_index", label: "Độ duy trì chủ đề", type: "number" },
      { key: "next_intention", label: "Mục tiêu kế tiếp", type: "string" },
    ]
  }
]

const matrixKeys = [
  { key: "relationship", label: "Mối quan hệ", type: "string" },
  { key: "title", label: "Xưng hô", type: "string" },
  { key: "interaction", label: "Tương tác", type: "number" },
  { key: "trust", label: "Độ tin tưởng", type: "number" },
  { key: "affection", label: "Độ thiện cảm", type: "number" },
  { key: "intimacy", label: "Độ thân mật", type: "number" },
  { key: "obligation", label: "Ân huệ", type: "number" },
  { key: "interest", label: "Toan tính", type: "number" },
]

export default function Sidebar({ gameState, setGameState, sidebarOpen, toggleSidebar }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'World'>('A')

  const charA = gameState.characters[0]
  const charB = gameState.characters[1]

  const handleChange = (characterIndex: number, section: string, field: string, value: string | number | boolean) => {
    const newState = { ...gameState }
    const char = newState.characters[characterIndex] as any
    char[section][field] = value
    setGameState(newState)
  }

  const renderField = (index: number, section: string, field: any, char: any) => {
    const val = char[section][field.key]
    
    if (field.type === 'string') {
      return (
        <div key={field.key} className={styles.formGroup}>
          <label className={styles.formLabel}>{field.label}</label>
          {field.key.includes("intention") || field.key.includes("pain") || field.key.includes("passion") || field.key.includes("list") || field.key.includes("hates") || field.key.includes("pros_cons") ? (
            <textarea className={styles.formTextarea} value={val || ""} onChange={e => handleChange(index, section, field.key, e.target.value)} />
          ) : (
            <input className={styles.formInput} value={val || ""} onChange={e => handleChange(index, section, field.key, e.target.value)} />
          )}
        </div>
      )
    }

    if (field.type === 'number') {
      return (
        <div key={field.key} className={styles.formGroup}>
          <label className={styles.formLabel}>{field.label}</label>
          <div className={styles.sliderContainer}>
            <input type="range" min="0" max="100" className={styles.slider} value={val || 0} onChange={e => handleChange(index, section, field.key, parseInt(e.target.value))} />
            <span className={styles.sliderValue}>{val}</span>
          </div>
        </div>
      )
    }

    if (field.type === 'boolean') {
      return (
        <div key={field.key} className={styles.formGroup} style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <label className={styles.formLabel}>{field.label}</label>
          <input type="checkbox" checked={val} onChange={e => handleChange(index, section, field.key, e.target.checked)} />
        </div>
      )
    }
  }

  const renderCharacterForm = (character: Character, index: number) => {
    return (
      <div className={styles.formSection}>
        <hr style={{borderColor: 'var(--color-border)', margin: '10px 0', opacity: 0.5}} />
        
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Roleplay Prompt (Bí mật)</label>
          <textarea 
            className={styles.formTextarea} 
            value={character.roleplay_prompt}
            onChange={(e) => {
               const newState = { ...gameState }
               newState.characters[index].roleplay_prompt = e.target.value
               setGameState(newState)
            }}
          />
        </div>

        {getCategories().map((cat, i) => (
          <div key={i}>
            <h4 className={styles.title} style={{marginTop: 24, fontSize: 16}}>{cat.title}</h4>
            <div style={{ display: cat.grid ? 'grid' : 'flex', flexDirection: cat.grid ? 'unset' : 'column', gridTemplateColumns: cat.grid ? 'minmax(0, 1fr)' : 'none', gap: '12px' }}>
              {cat.keys.map(k => renderField(index, 'stats', k, character))}
            </div>
          </div>
        ))}

        <h4 className={styles.title} style={{marginTop: 30, fontSize: 17, color: 'var(--color-text-accent)'}}>
          II. Matrix Connection (Với {index === 0 ? charB.stats.name : charA.stats.name})
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {matrixKeys.map(k => renderField(index, 'matrix_to_other', k, character))}
        </div>

        <div style={{marginTop: 30, marginBottom: 50}}>
           <button className={styles.saveButton} onClick={() => alert("Chỉ số đã được ghi nhận. Trong bản thật dữ liệu tự lưu vào JSON bởi github action hoặc server.")} >
             LƯU TRẠNG THÁI AI
           </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <button className={styles.toggleBtn} onClick={toggleSidebar}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
        {sidebarOpen && (
          <div className={styles.headerTitles}>
            <h2 className={styles.title}>Bảng Điều Khiển</h2>
            <p className={styles.subtitle}>Thiết lập Toàn Bộ Tham Số Môi Trường</p>
          </div>
        )}
      </div>

      <div className={`${styles.tabs} ${!sidebarOpen ? styles.tabsVertical : ''}`}>
        <button className={`${styles.tab} ${activeTab === 'A' ? styles.active : ''}`} onClick={() => { setActiveTab('A'); if(!sidebarOpen) toggleSidebar(); }}>
          <span className={styles.tabIcon}>A</span>
          {sidebarOpen && <span>{charA.stats.name}</span>}
        </button>
        <button className={`${styles.tab} ${activeTab === 'B' ? styles.active : ''}`} onClick={() => { setActiveTab('B'); if(!sidebarOpen) toggleSidebar(); }}>
          <span className={styles.tabIcon}>B</span>
          {sidebarOpen && <span>{charB.stats.name}</span>}
        </button>
        <button className={`${styles.tab} ${activeTab === 'World' ? styles.active : ''}`} onClick={() => { setActiveTab('World'); if(!sidebarOpen) toggleSidebar(); }}>
          <span className={styles.tabIcon}>W</span>
          {sidebarOpen && <span>Quản Trò</span>}
        </button>
      </div>

      <div style={{ display: sidebarOpen ? 'flex' : 'none', flexDirection: 'column', flexGrow: 1, overflowY: 'auto' }}>
        {activeTab === 'A' && renderCharacterForm(charA, 0)}
        {activeTab === 'B' && renderCharacterForm(charB, 1)}
        {activeTab === 'World' && (
        <div className={styles.formSection}>
          <h4 className={styles.title}>Quản Trò (Game Master)</h4>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Thời Gian Thực/Ảo</label>
            <input className={styles.formInput} value={gameState.world.time} onChange={(e) => setGameState({...gameState, world: {...gameState.world, time: e.target.value}})} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Môi Trường Hiện Tại</label>
            <textarea className={styles.formTextarea} value={gameState.world.environment} onChange={(e) => setGameState({...gameState, world: {...gameState.world, environment: e.target.value}})} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Chủ Đề (Topic)</label>
            <input className={styles.formInput} value={gameState.world.current_topic} onChange={(e) => setGameState({...gameState, world: {...gameState.world, current_topic: e.target.value}})} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Lệnh Tới Nhân Vật Tiep Theo: {gameState.world.next_speaker}</label>
            <input className={styles.formInput} title="Tone" value={gameState.world.next_tone} onChange={(e) => setGameState({...gameState, world: {...gameState.world, next_tone: e.target.value}})} />
            <br />
            <input className={styles.formInput} title="Độ dài" value={gameState.world.next_length} onChange={(e) => setGameState({...gameState, world: {...gameState.world, next_length: e.target.value}})} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Kịch Bản Tương Lai</label>
            <textarea className={styles.formTextarea} style={{minHeight: 150}} value={gameState.world.scenario} onChange={(e) => setGameState({...gameState, world: {...gameState.world, scenario: e.target.value}})} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Quy luật thế giới</label>
            <textarea className={styles.formTextarea} value={gameState.world.rules} onChange={(e) => setGameState({...gameState, world: {...gameState.world, rules: e.target.value}})} />
          </div>
          <button className={styles.saveButton} onClick={() => alert("Dữ liệu thế giới đã lưu!")} >
            LƯU THẾ GIỚI
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
