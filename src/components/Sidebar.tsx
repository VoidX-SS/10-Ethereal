import { useState } from 'react'
import { Menu, User, Edit3, Settings, ArrowLeft, Trash2 } from 'lucide-react'
import styles from './Sidebar.module.css'
import BigEditModal from './BigEditModal'
import type { GameState } from '../types'

interface SidebarProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  currentWorldId: string;
  setCurrentWorldId: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
}

export default function Sidebar({ gameState, setGameState, sidebarOpen, toggleSidebar, currentWorldId, setCurrentWorldId, onDeleteCharacter }: SidebarProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<string>('World');

  const openModal = (tab: string) => {
    setInitialTab(tab);
    setModalOpen(true);
  };

  const handleAddCharacter = () => {
    const newCharId = `char_${String.fromCharCode(65 + gameState.characters.length)}`; // e.g. char_C
    const newChar = {
      id: newCharId,
      roleplay_prompt: "",
      stats: {
        name: `Nhân vật ${gameState.characters.length + 1}`,
        date_of_birth: "",
        age: "",
        gender: "",
        job: "",
        position: "",
        relationship_list: "",
        fortune: "",
        health: 100, look: 50, iq: 100, eq: 100,
        faith: "", passion: "", emotional_pain: "", love_hates: "", pros_cons: "",
        openness: 50, dedicate: 50, tendency: 50, sociable: 50, stability: 50,
        energy: 100, nutrient: 100, temperature: 37, comfortable: 100, stress: 0, excitement: 50,
        pleasure: 50, arousal: 50, domination: 50, will_power: 50, faith_index: 50,
        logic_emotion: 50, focus_spain: 50, bias: 0, thinking_type: 50, awareness_time: true,
        position_len: 50, social_bias: 50, environment_skeptical: 50,
        long_term_intention: "", stick_index: 50, next_intention: "Ngủ"
      },
      relationships: {}
    };
    
    setGameState({
      ...gameState,
      characters: [...gameState.characters, newChar]
    });
  };

  return (
    <>
      <div className={`${styles.sidebar} ${!sidebarOpen ? styles.collapsed : ''}`}>
        <div className={styles.header}>
          <button className={styles.toggleBtn} onClick={toggleSidebar}>
            <Menu size={24} />
          </button>
        </div>

        <div className={styles.entityList}>
          {/* Game Master */}
          <div className={styles.entityCard} onClick={() => openModal('World')}>
            <div className={styles.avatar}>
              <Settings size={20} />
            </div>
            {sidebarOpen && (
              <div className={styles.entityInfo}>
                <span className={styles.entityName}>Game Master</span>
                <span className={styles.entityRole}>World State</span>
              </div>
            )}
            {sidebarOpen && (
              <button className={styles.editBtn}>
                <Edit3 size={16} />
              </button>
            )}
          </div>

          {gameState.characters.map((char, index) => (
            <div key={char.id} className={styles.entityCard} onClick={() => openModal(char.id)}>
              <div className={styles.avatar}>
                <User size={20} />
              </div>
              {sidebarOpen && (
                <div className={styles.entityInfo}>
                  <span className={styles.entityName}>{char.stats.name}</span>
                  <span className={styles.entityRole}>Character {String.fromCharCode(65 + index)}</span>
                </div>
              )}
              {sidebarOpen && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className={styles.editBtn}>
                    <Edit3 size={16} />
                  </button>
                  <button 
                    className={styles.deleteBtn} 
                    onClick={(e) => { e.stopPropagation(); onDeleteCharacter(char.id); }}
                    title="Xóa nhân vật"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {sidebarOpen && (
            <div className={styles.addCharBtn} onClick={handleAddCharacter}>
              + Thêm nhân vật
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.backBtn} onClick={() => setCurrentWorldId("")} title="Back to Multiverse">
            <ArrowLeft size={24} />
            {sidebarOpen && <span className={styles.backText}>Exit World</span>}
          </button>
        </div>
      </div>

      {modalOpen && (
        <BigEditModal 
          gameState={gameState}
          setGameState={setGameState}
          currentWorldId={currentWorldId}
          onClose={() => setModalOpen(false)}
          initialTab={initialTab}
        />
      )}
    </>
  )
}
