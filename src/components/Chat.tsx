import { useRef, useEffect } from 'react'
import styles from './Chat.module.css'
import type { ChatMessage, GameState } from '../types'

interface ChatProps {
  history: ChatMessage[];
  gameState: GameState;
}

export default function Chat({ history, gameState }: ChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const getCharacterName = (id: string) => {
    if (id === 'Narrator') return 'Narrator'
    const char = gameState.characters.find(c => c.id === id)
    return char ? char.stats.name : 'Unknown'
  }

  const getCharacterInitials = (id: string) => {
    if (id === 'Narrator') return 'N'
    const char = gameState.characters.find(c => c.id === id)
    return char ? char.stats.name.charAt(0).toUpperCase() : '?'
  }

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) {
      return timeStr; // Fallback cho phép nhập cả chữ như "Sáng sớm", "4/4/2026 - 6:00"
    }
    return d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
  }

  // Hàm render text in đậm khi nằm trong dấu *
  const renderFormattedText = (text: string | undefined) => {
    if (!text) return null;
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <b key={index}>{part.slice(1, -1)}</b>;
      }
      return <span key={index}>{part}</span>;
    });
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.header}>
        <div className={styles.brandTitle}>10 Ethereal</div>
        <div className={styles.headerInfo}>
          <h2 className={styles.worldTopic}>{gameState.world.current_topic}</h2>
        </div>
      </div>

      <div className={styles.messagesArea}>
        <div className={styles.scenarioBanner}>
          {gameState.world.scenario}
        </div>
        
        {history.map((msg) => {
          if (msg.characterId === 'Narrator') {
            return (
              <div key={msg.id} className={styles.narratorWrapper}>
                <div className={styles.narratorText}>
                   {renderFormattedText(msg.dialogue)}
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`${styles.messageWrapper} ${msg.characterId === 'char_A' ? styles.alignLeft : styles.alignRight}`}>
              <div className={styles.characterHeader}>
                <div className={styles.characterAvatar}>
                  {getCharacterInitials(msg.characterId)}
                </div>
                <div className={styles.characterName}>
                  {getCharacterName(msg.characterId)}
                  <span className={styles.messageTime}> • {formatTime(msg.timestamp)}</span>
                </div>
              </div>
              
              {msg.thought && (
                <div className={styles.thoughtBubble}>
                  <span className={styles.thoughtText}>{msg.thought}</span>
                </div>
              )}
              
              {msg.dialogues && msg.dialogues.length > 0 ? (
                <div className={styles.bubbleGroup}>
                  {msg.dialogues.map((dlg, idx) => (
                    <div key={idx} className={styles.dialogueBubble}>
                      {renderFormattedText(dlg)}
                    </div>
                  ))}
                </div>
              ) : msg.dialogue ? (
                <div className={styles.dialogueBubble}>
                  {renderFormattedText(msg.dialogue)}
                </div>
              ) : null}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
