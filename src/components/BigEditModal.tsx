import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Save, X, User, Globe, Hash, Fingerprint, Activity, ActivitySquare } from 'lucide-react'
import styles from './BigEditModal.module.css'
import type { GameState, Character } from '../types'

interface BigEditModalProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  currentWorldId: string;
  onClose: () => void;
  initialTab?: string;
}

const getCategories = () => [
  {
    title: "1. Hồ sơ cơ bản",
    tab: "Profile",
    keys: [
      { key: "name", label: "Tên nhân vật", type: "string" },
      { key: "age", label: "Tuổi", type: "string" },
      { key: "gender", label: "Giới tính", type: "select", options: ["Nam", "Nữ", "Phi nhị giới"] },
      { key: "job", label: "Công việc", type: "string" },
      { key: "position", label: "Vị trí hiện tại", type: "string" },
      { key: "relationship_list", label: "Danh sách Mối quan hệ", type: "string" },
    ]
  },
  {
    title: "Hồ sơ chi tiết",
    tab: "Strings",
    keys: [
      { key: "fortune", label: "Tài sản", type: "string" },
      { key: "faith", label: "Niềm tin", type: "string" },
      { key: "passion", label: "Ước mơ / Đam mê", type: "string" },
      { key: "emotional_pain", label: "Vết thương tâm lý", type: "string" },
      { key: "love_hates", label: "Yêu / Ghét", type: "string" },
      { key: "pros_cons", label: "Điểm mạnh / Yếu", type: "string" },
      { key: "long_term_intention", label: "Ý định dài hạn", type: "string" },
      { key: "next_intention", label: "Mục tiêu kế tiếp", type: "string" },
    ]
  },
  {
    title: "1. Trạng Thái",
    tab: "Stats",
    grid: true,
    keys: [
      { key: "health", label: "Sức khỏe", type: "number" },
      { key: "look", label: "Ngoại hình", type: "number" },
      { key: "iq", label: "IQ", type: "number", min: 0, max: 200 },
      { key: "eq", label: "EQ", type: "number", min: 0, max: 200 },
    ]
  },
  {
    title: "2. Bản Sắc",
    tab: "Stats",
    grid: true,
    keys: [
      { key: "openness", label: "Cởi mở (bảo thủ - sáng tạo)", type: "number" },
      { key: "dedicate", label: "Tận tâm (tùy hứng - kỷ luật)", type: "number" },
      { key: "tendency", label: "Hướng (Nội / Ngoại)", type: "number" },
      { key: "sociable", label: "Hòa đồng (ác - hiền lành)", type: "number" },
      { key: "stability", label: "Ổn định (lo âu - bình tĩnh)", type: "number" },
    ]
  },
  {
    title: "3. Sinh Lý",
    tab: "Stats",
    grid: true,
    keys: [
      { key: "energy", label: "Năng lượng", type: "number" },
      { key: "nutrient", label: "Dinh dưỡng", type: "number" },
      { key: "temperature", label: "Nhiệt độ", type: "number", min: 35, max: 42 },
      { key: "comfortable", label: "Thoải mái", type: "number" },
      { key: "stress", label: "Stress", type: "number" },
      { key: "excitement", label: "Hưng phấn", type: "number" },
    ]
  },
  {
    title: "4. Tâm Lý",
    tab: "Stats",
    grid: true,
    keys: [
      { key: "pleasure", label: "Vui vẻ", type: "number" },
      { key: "arousal", label: "Kích thích", type: "number" },
      { key: "domination", label: "Thống trị", type: "number" },
      { key: "will_power", label: "Ý chí", type: "number" },
      { key: "faith_index", label: "Kiên định (Niềm tin/Hy vọng)", type: "number" },
    ]
  },
  {
    title: "5. Nhận Thức",
    tab: "Stats",
    grid: true,
    keys: [
      { key: "logic_emotion", label: "Logic/Cảm tính", type: "number" },
      { key: "focus_spain", label: "Độ tập trung", type: "number" },
      { key: "bias", label: "Thiên kiến xác nhận", type: "number" },
      { key: "thinking_type", label: "Khuynh hướng suy diễn", type: "number" },
      { key: "awareness_time", label: "Nhận thức Thời Gian", type: "boolean" },
    ]
  },
  {
    title: "6. Xã Hội",
    tab: "Stats",
    grid: true,
    keys: [
      { key: "position_len", label: "Vị thế", type: "number" },
      { key: "social_bias", label: "Nhu cầu Xã hội", type: "number" },
      { key: "environment_skeptical", label: "Hoài nghi Môi Trường", type: "number" },
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

export default function BigEditModal({ gameState, setGameState, currentWorldId, onClose, initialTab }: BigEditModalProps) {
  const defaultTab = initialTab || (gameState.characters.length > 0 ? gameState.characters[0].id : 'World');
  const [activeEntity, setActiveEntity] = useState<string>(defaultTab)
  const [activeTab, setActiveTab] = useState<'Profile' | 'Strings' | 'Stats' | 'Matrix'>('Profile')
  const [isSaving, setIsSaving] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<{ source: string, target: string } | null>(null)

  const handleSaveToCloud = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, 'worlds', currentWorldId), gameState)
      alert("✓ Đã lưu thay đổi vào thế giới [" + currentWorldId + "] thành công!")
    } catch (error) {
      console.error(error)
      alert("⚠ Lỗi khi lưu, bạn có quyền ghi vào Firebase không?")
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (characterIndex: number, section: string, field: string, value: string | number | boolean) => {
    const newState = { ...gameState }
    const char = newState.characters[characterIndex] as any
    char[section][field] = value
    setGameState(newState)
  }

  const handleRelationshipChange = (sourceId: string, targetId: string, field: string, value: string | number) => {
    const newState = { ...gameState }
    const sourceChar = newState.characters.find(c => c.id === sourceId)
    if (sourceChar) {
      if (!sourceChar.relationships) sourceChar.relationships = {};
      if (!sourceChar.relationships[targetId]) {
        sourceChar.relationships[targetId] = {
          interaction: 50, trust: 50, affection: 50, intimacy: 50, obligation: 0, interest: 0,
          relationship: "Chưa rõ", title: "Cậu/Cô"
        }
      }
      (sourceChar.relationships[targetId] as any)[field] = value;
      setGameState(newState)
    }
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

    if (field.type === 'select') {
      return (
        <div key={field.key} className={styles.formGroup}>
          <label className={styles.formLabel}>{field.label}</label>
          <select
            className={styles.formInput}
            value={val || ""}
            onChange={e => handleChange(index, section, field.key, e.target.value)}
          >
            <option value="" disabled>-- Chọn --</option>
            {field.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      )
    }

    if (field.type === 'number') {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const percentage = Math.max(0, Math.min(100, ((val || min) - min) / (max - min) * 100));
      return (
        <div key={field.key} className={styles.formGroup}>
          <label className={styles.formLabel}>{field.label}</label>
          <div className={styles.sliderContainer}>
            <input
              type="range" min={min} max={max} className={styles.slider}
              value={val || min} onChange={e => handleChange(index, section, field.key, parseInt(e.target.value))}
              style={{ background: `linear-gradient(to right, var(--color-text-accent) ${percentage}%, var(--color-border) ${percentage}%)` }}
            />
            <span className={styles.sliderValue}>{val}</span>
          </div>
        </div>
      )
    }

    if (field.type === 'boolean') {
      return (
        <div key={field.key} className={styles.formGroup} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-bg-main)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
          <label className={styles.formLabel} style={{ margin: 0 }}>{field.label}</label>
          <label className={styles.toggleSwitch}>
            <input type="checkbox" className={styles.toggleInput} checked={val} onChange={e => handleChange(index, section, field.key, e.target.checked)} />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
      )
    }
  }

  const renderCharacterForm = (character: Character, index: number) => {
    return (
      <div className={styles.tabContentWrapper}>
        <div className={styles.innerTabs}>
          <button className={`${styles.innerTab} ${activeTab === 'Profile' ? styles.active : ''}`} onClick={() => setActiveTab('Profile')}>
            <Fingerprint size={16} /> Hồ Sơ
          </button>
          <button className={`${styles.innerTab} ${activeTab === 'Strings' ? styles.active : ''}`} onClick={() => setActiveTab('Strings')}>
            <Hash size={16} /> Hồ sơ chi tiết
          </button>
          <button className={`${styles.innerTab} ${activeTab === 'Stats' ? styles.active : ''}`} onClick={() => setActiveTab('Stats')}>
            <Activity size={16} /> Chỉ Số
          </button>
        </div>

        <div className={styles.scrollArea}>
          {activeTab === 'Strings' && (
            <div className={styles.formSection}>
              <div className={styles.formGroup} style={{ marginBottom: 24 }}>
                <label className={styles.formLabel}>Roleplay Prompt (Bí mật)</label>
                <textarea
                  className={styles.formTextarea}
                  style={{ minHeight: '300px' }}
                  value={character.roleplay_prompt}
                  onChange={(e) => {
                    const newState = { ...gameState }
                    newState.characters[index].roleplay_prompt = e.target.value
                    setGameState(newState)
                  }}
                />
              </div>

              {getCategories().filter(c => c.tab === 'Strings').map((cat, i) => (
                <div key={`str_${i}`}>
                  <h4 className={styles.sectionTitle}>{cat.title}</h4>
                  <div className={styles.flexContainer}>
                    {cat.keys.map(k => renderField(index, 'stats', k, character))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Profile' && (
            <div className={styles.formSection}>
              {getCategories().filter(c => c.tab === 'Profile').map((cat, i) => (
                <div key={i} className={styles.categoryBlock}>
                  <h4 className={styles.sectionTitle}>{cat.title}</h4>
                  <div className={styles.flexContainer}>
                    {cat.keys.map(k => renderField(index, 'stats', k, character))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Stats' && (
            <div className={styles.formSection}>
              {getCategories().filter(c => c.tab === 'Stats').map((cat, i) => (
                <div key={i} className={styles.categoryBlock}>
                  <h4 className={styles.sectionTitle}>{cat.title}</h4>
                  <div className={cat.grid ? styles.gridContainer : styles.flexContainer}>
                    {cat.keys.map(k => renderField(index, 'stats', k, character))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderNetworkMap = () => {
    const chars = gameState.characters;
    const radius = 150;
    const cx = 250;
    const cy = 250;

    const getNodePos = (index: number, total: number) => {
      const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    }

    const positions = chars.map((_, i) => getNodePos(i, chars.length));

    // Handle node click:
    // If no node selected, select it.
    // If a node is selected, clicking another node selects the EDGE between them.
    const onNodeClick = (charId: string) => {
      if (selectedNode === null) {
        setSelectedNode(charId);
        setSelectedEdge(null);
      } else if (selectedNode === charId) {
        setSelectedNode(null);
        setSelectedEdge(null);
      } else {
        setSelectedEdge({ source: selectedNode, target: charId });
        setSelectedNode(null); // Deselect node to focus on edge
      }
    }

    // Prepare fields renderer for Edge Editor
    const renderEdgeField = (sourceId: string, targetId: string, field: any, relData: any) => {
      const val = relData ? relData[field.key] : '';
      if (field.type === 'string') {
        return (
          <div key={field.key} className={styles.formGroup} style={{ marginBottom: 8 }}>
            <label className={styles.formLabel}>{field.label}</label>
            <input className={styles.formInput} value={val} onChange={e => handleRelationshipChange(sourceId, targetId, field.key, e.target.value)} />
          </div>
        )
      }
      if (field.type === 'number') {
        const percentage = Math.max(0, Math.min(100, (val || 0)));
        return (
          <div key={field.key} className={styles.formGroup} style={{ marginBottom: 8 }}>
            <label className={styles.formLabel}>{field.label}</label>
            <div className={styles.sliderContainer}>
              <input type="range" min={0} max={100} className={styles.slider} value={val || 0} onChange={e => handleRelationshipChange(sourceId, targetId, field.key, parseInt(e.target.value))}
                style={{ background: `linear-gradient(to right, var(--color-text-accent) ${percentage}%, var(--color-border) ${percentage}%)` }}
              />
              <span className={styles.sliderValue}>{val || 0}</span>
            </div>
          </div>
        )
      }
      return null;
    }

    return (
      <div className={styles.tabContentWrapper}>
        <div className={styles.scrollArea} style={{ padding: '24px', display: 'flex', gap: '24px', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Graph Area */}
          <div style={{ flex: '1 1 500px', minWidth: '300px', background: 'var(--color-bg-sidebar)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 12 }}>Relationship Map</h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 24 }}>
              Nhấp 2 nhân vật liên tiếp để truy cập mối quan hệ.
            </p>
            <svg width="100%" height="450" viewBox="0 0 500 500" style={{ overflow: 'visible', maxWidth: '500px' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="25" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-text-muted)" />
                </marker>
                <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="25" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-text-accent)" />
                </marker>
              </defs>

              {/* Draw all existing edges */}
              {chars.map((source, i) => {
                if (!source.relationships) return null;
                return Object.entries(source.relationships).map(([targetId, _]) => {
                  const targetIdx = chars.findIndex(c => c.id === targetId);
                  if (targetIdx === -1) return null;
                  const p1 = positions[i];
                  const p2 = positions[targetIdx];
                  const isSelected = selectedEdge && ((selectedEdge.source === source.id && selectedEdge.target === targetId) || (selectedEdge.target === source.id && selectedEdge.source === targetId));

                  return (
                    <line
                      key={`${source.id}-${targetId}`}
                      x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                      stroke={isSelected ? "var(--color-text-accent)" : "var(--color-border)"}
                      strokeWidth={isSelected ? 3 : 1.5}
                      markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                      onClick={() => setSelectedEdge({ source: source.id, target: targetId })}
                    />
                  )
                });
              })}

              {/* Draw nodes */}
              {chars.map((char, i) => {
                const pos = positions[i];
                const isSelected = selectedNode === char.id;
                const isEdgeTarget = selectedEdge && (selectedEdge.source === char.id || selectedEdge.target === char.id);

                return (
                  <g key={char.id} transform={`translate(${pos.x}, ${pos.y})`} style={{ cursor: 'pointer' }} onClick={() => onNodeClick(char.id)}>
                    <circle
                      r="24"
                      fill={isSelected ? "var(--color-text-accent)" : isEdgeTarget ? "rgba(234, 88, 12, 0.3)" : "var(--color-bg-main)"}
                      stroke={isSelected || isEdgeTarget ? "var(--color-text-accent)" : "var(--color-border)"}
                      strokeWidth="2"
                      style={{ transition: 'all 0.3s' }}
                    />
                    <text textAnchor="middle" dy="5" fontSize="14" fill={isSelected ? "#fff" : "var(--color-text-main)"} fontWeight="bold">
                      {char.stats.name.substring(0, 2).toUpperCase()}
                    </text>
                    <text textAnchor="middle" dy="40" fontSize="12" fill="var(--color-text-muted)">
                      {char.stats.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Edge Editor */}
          {selectedEdge && (() => {
            const charA = chars.find(c => c.id === selectedEdge.source);
            const charB = chars.find(c => c.id === selectedEdge.target);
            if (!charA || !charB) return null;

            const relAtoB = charA.relationships ? charA.relationships[charB.id] : null;
            const relBtoA = charB.relationships ? charB.relationships[charA.id] : null;

            return (
              <div className={styles.overlay} style={{ zIndex: 1010 }}>
                <div className={styles.modal}>
                  <div className={styles.header}>
                    <h3 style={{ margin: '20px 0', fontSize: '20px', color: 'var(--color-text-main)' }}>Chỉnh Sửa Mối Quan Hệ</h3>
                    <button className={styles.closeBtn} onClick={() => setSelectedEdge(null)}>
                      <X size={24} />
                    </button>
                  </div>
                  <div className={styles.body} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: 24, gap: 24, overflowY: 'auto' }}>
                    {/* A -> B */}
                    <div style={{ flex: 1, background: 'var(--color-bg-sidebar)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                      <h4 style={{ marginBottom: 16, color: 'var(--color-text-accent)' }}>Góc nhìn của {charA.stats.name} ➔ {charB.stats.name}</h4>
                      {!relAtoB ? (
                        <button className={styles.saveBtn} style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => handleRelationshipChange(charA.id, charB.id, 'relationship', 'Người quen')}>
                          + Khởi tạo góc nhìn của {charA.stats.name}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {matrixKeys.map(k => renderEdgeField(charA.id, charB.id, k, relAtoB))}
                        </div>
                      )}
                    </div>

                    {/* B -> A */}
                    <div style={{ flex: 1, background: 'var(--color-bg-sidebar)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                      <h4 style={{ marginBottom: 16, color: 'var(--color-text-accent)' }}>Góc nhìn của {charB.stats.name} ➔ {charA.stats.name}</h4>
                      {!relBtoA ? (
                        <button className={styles.saveBtn} style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => handleRelationshipChange(charB.id, charA.id, 'relationship', 'Người quen')}>
                          + Khởi tạo góc nhìn của {charB.stats.name}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {matrixKeys.map(k => renderEdgeField(charB.id, charA.id, k, relBtoA))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    )
  }

  const renderWorldForm = () => {
    return (
      <div className={styles.tabContentWrapper}>
        <div className={styles.scrollArea}>
          <div className={styles.formSection}>
            <h4 className={styles.sectionTitle}>Quản Trò - Game Master</h4>
            <div className={styles.categoryBlock}>
              <div className={styles.gridContainer}>
                <div className={styles.formGroup} style={{ marginBottom: 10 }}>
                  <label className={styles.formLabel}>Tên Thế giới (World Name)</label>
                  <input className={styles.formInput} value={gameState.world.name || currentWorldId} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, name: e.target.value } })} />
                </div>
                <div className={styles.formGroup} style={{ marginBottom: 24 }}>
                  <label className={styles.formLabel}>Thời Gian Thực/Ảo</label>
                  <input className={styles.formInput} value={gameState.world.time} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, time: e.target.value } })} />
                </div>
              </div>
            </div>

            <div className={styles.formGroup} style={{ marginBottom: 10 }}>
              <label className={styles.formLabel}>Môi Trường Hiện Tại</label>
              <textarea className={styles.formTextarea} value={gameState.world.environment} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, environment: e.target.value } })} />
            </div>

            <div className={styles.formGroup} style={{ marginBottom: 10 }}>
              <label className={styles.formLabel}>Chủ Đề (Topic)</label>
              <input className={styles.formInput} value={gameState.world.current_topic} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, current_topic: e.target.value } })} />
            </div>

            <div className={styles.gridContainer} style={{ marginBottom: 10 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Lệnh kế tiếp</label>
                <input className={styles.formInput} value={gameState.world.next_tone} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, next_tone: e.target.value } })} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Độ Dài chat kế tiếp</label>
                <input className={styles.formInput} value={gameState.world.next_length} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, next_length: e.target.value } })} />
              </div>
            </div>

            <div className={styles.formGroup} style={{ marginBottom: 10 }}>
              <label className={styles.formLabel}>Kịch Bản Tương Lai</label>
              <textarea className={styles.formTextarea} style={{ minHeight: 120 }} value={gameState.world.scenario} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, scenario: e.target.value } })} />
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 10 }}>
              <label className={styles.formLabel}>Quy luật thế giới</label>
              <textarea className={styles.formTextarea} style={{ minHeight: 120 }} value={gameState.world.rules} onChange={(e) => setGameState({ ...gameState, world: { ...gameState.world, rules: e.target.value } })} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.entityTabs}>
            <button className={`${styles.entityTab} ${activeEntity === 'World' ? styles.active : ''}`} onClick={() => setActiveEntity('World')}>
              <Globe size={18} /> World Settings
            </button>
            <button className={`${styles.entityTab} ${activeEntity === 'NetworkMap' ? styles.active : ''}`} onClick={() => setActiveEntity('NetworkMap')}>
              <ActivitySquare size={18} /> Network Map
            </button>
            {gameState.characters.map((char) => (
              <button
                key={char.id}
                className={`${styles.entityTab} ${activeEntity === char.id ? styles.active : ''}`}
                onClick={() => setActiveEntity(char.id)}
              >
                <User size={18} /> {char.stats.name}
              </button>
            ))}
          </div>
          <div className={styles.headerActions}>
            <button className={styles.saveBtn} onClick={handleSaveToCloud} disabled={isSaving}>
              <Save size={18} />
              {isSaving ? "Lưu..." : "Save"}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {activeEntity === 'World'
            ? renderWorldForm()
            : activeEntity === 'NetworkMap'
              ? renderNetworkMap()
              : renderCharacterForm(
                gameState.characters.find(c => c.id === activeEntity)!,
                gameState.characters.findIndex(c => c.id === activeEntity)
              )
          }
        </div>
      </div>
    </div>
  )
}
