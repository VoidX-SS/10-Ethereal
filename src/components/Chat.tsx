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
    const char = gameState.characters.find(c => c.id === id)
    return char ? char.stats.name : 'Unknown'
  }

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) {
      return timeStr; // Fallback cho phép nhập cả chữ như "Sáng sớm", "4/4/2026 - 6:00"
    }
    return d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
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
        
        {history.map((msg) => (
          <div key={msg.id} className={`${styles.messageWrapper} ${msg.characterId === 'char_A' ? styles.alignLeft : styles.alignRight}`}>
            <div className={styles.characterName}>
              {getCharacterName(msg.characterId)}
              <span className={styles.messageTime}> • {formatTime(msg.timestamp)}</span>
            </div>
            
            {msg.thought && (
              <div className={styles.thoughtBubble}>
                <span className={styles.thoughtText}>{msg.thought}</span>
              </div>
            )}
            
            <div className={styles.dialogueBubble}>
              {msg.dialogue}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
