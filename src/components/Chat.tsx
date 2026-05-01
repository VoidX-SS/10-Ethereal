import React, { useRef, useEffect, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Trash2, PlusCircle, PauseCircle, PlayCircle, Eye, Trash, Edit2, Check, X } from 'lucide-react'
import styles from './Chat.module.css'
import ThemeToggle from './ThemeToggle'
import type { ChatMessage, GameState } from '../types'

interface ChatProps {
  history: ChatMessage[];
  gameState: GameState;
  currentWorldId: string;
  onBack: () => void;
}

export default function Chat({ history, gameState, currentWorldId }: ChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [injectText, setInjectText] = useState('')
  const [lastReadId, setLastReadId] = useState<string | null>(localStorage.getItem(`lastRead_${currentWorldId}`))

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<any>({})

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const getCharacterName = (id: string) => {
    if (id === 'Narrator') return 'Narrator'
    const char = gameState.characters.find(c => c.id === id)
    return char ? char.stats.name : 'Observer'
  }

  const getCharacterInitials = (id: string) => {
    if (id === 'Narrator') return 'N'
    const char = gameState.characters.find(c => c.id === id)
    return char ? char.stats.name.charAt(0).toUpperCase() : '?'
  }

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

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

  const handleEditClick = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditContent({
      dialogue: msg.dialogue || '',
      thought: msg.thought || '',
      dialogues: msg.dialogues ? [...msg.dialogues] : []
    });
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent(null);
  }

  const handleSaveEdit = async (msgId: string) => {
    const newHistory = history.map(m => {
      if (m.id === msgId) {
        return {
          ...m,
          dialogue: editContent?.dialogue || undefined,
          thought: editContent?.thought || undefined,
          dialogues: editContent?.dialogues && editContent.dialogues.length > 0 ? editContent.dialogues : undefined
        };
      }
      return m;
    });
    // Loại bỏ các trường undefined để Firebase không báo lỗi (nếu có)
    const cleanedHistory = newHistory.map(m => JSON.parse(JSON.stringify(m)));
    await setDoc(doc(db, 'history', currentWorldId), { messages: cleanedHistory });
    setEditingMessageId(null);
    setEditContent(null);
  }

  const handleDeleteMessage = async (msgId: string) => {
    if (!window.confirm("Delete this message?")) return;
    const newHistory = history.filter(m => m.id !== msgId);
    await setDoc(doc(db, 'history', currentWorldId), { messages: newHistory });
  }

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear the entire chat history?")) return;
    await setDoc(doc(db, 'history', currentWorldId), { messages: [] });
  }

  const handleTogglePause = async () => {
    await setDoc(doc(db, 'worlds', currentWorldId), {
      ...gameState,
      world: {
        ...gameState.world,
        is_paused: !gameState.world.is_paused
      }
    });
  }

  const handleMarkAsRead = (msgId: string) => {
    setLastReadId(msgId);
    localStorage.setItem(`lastRead_${currentWorldId}`, msgId);
  }

  const handleInject = async () => {
    if (!injectText.trim()) return;

    // Default mode logic (will be expanded for commands later)
    const newMsg = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      characterId: "System",
      dialogue: `${injectText}`
    };

    const newHistory = [...history, newMsg];
    await setDoc(doc(db, 'history', currentWorldId), { messages: newHistory });

    // Save to last event
    await setDoc(doc(db, 'worlds', currentWorldId), {
      ...gameState,
      world: {
        ...gameState.world,
        last_event: injectText
      }
    });

    setInjectText('');
  }

  const handleJumpToUnread = () => {
    if (lastReadId) {
      document.getElementById(`msg_${lastReadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  const hasUnread = lastReadId && history.findIndex(m => m.id === lastReadId) < history.length - 1;

  return (
    <div className={styles.chatContainer}>
      <div className={styles.header}>
        {/* Left Column */}
        <div className={styles.brandTitleWrapper}>
          <span className={styles.logoText}>10 ETHEREAL</span>
        </div>

        {/* Middle Column */}
        <div className={styles.headerCenter}>
          <div className={styles.brandTitle}>
            {gameState.world.name || "Unknown World"}
            {gameState.world.is_paused && <span className={styles.pausedBadge}>PAUSED</span>}
          </div>
          <h2 className={styles.worldTopic}>{gameState.world.current_topic}</h2>
        </div>

        {/* Right Column */}
        <div className={styles.toolbar}>
          <ThemeToggle />
          <button className={styles.toolBtn} onClick={handleTogglePause} title={gameState.world.is_paused ? "Resume Auto" : "Pause Auto"}>
            {gameState.world.is_paused ? <PlayCircle size={18} /> : <PauseCircle size={18} />}
          </button>
          <button className={`${styles.toolBtn} ${styles.dangerBtn}`} onClick={handleClearHistory} title="Clear Chat History">
            <Trash size={18} />
          </button>
        </div>
      </div>

      <div className={styles.messagesArea}>
        <div className={styles.scenarioBanner}>
          {gameState.world.scenario}
        </div>

        {history.map((msg, index) => {
          const isLastRead = msg.id === lastReadId;
          const isCatastrophe = msg.thought?.includes("CATASTROPHE") || msg.dialogue?.includes("CATASTROPHE");
          const isRashomon = msg.thought?.includes("RASHOMON") || msg.dialogue?.includes("RASHOMON");

          return (
            <React.Fragment key={msg.id}>
              {msg.characterId === 'Narrator' ? (
                <div id={`msg_${msg.id}`} className={styles.narratorWrapper}>
                  <div className={styles.narratorText}>
                    {editingMessageId === msg.id ? (
                      <div className={styles.editContainer}>
                        <textarea
                          className={styles.editTextarea}
                          value={editContent?.dialogue || ''}
                          onChange={e => setEditContent({ ...editContent, dialogue: e.target.value })}
                        />
                        <div className={styles.editActions}>
                          <button onClick={() => handleSaveEdit(msg.id)}><Check size={16} /></button>
                          <button onClick={handleCancelEdit}><X size={16} /></button>
                        </div>
                      </div>
                    ) : (
                      renderFormattedText(msg.dialogue)
                    )}
                  </div>
                  <div className={styles.messageActions}>
                    <button className={styles.actionBtn} onClick={() => handleEditClick(msg)} title="Edit"><Edit2 size={14} /></button>
                    <button className={styles.actionBtn} onClick={() => handleMarkAsRead(msg.id)} title="Mark as Read"><Eye size={14} /></button>
                    <button className={styles.actionBtn} onClick={() => handleDeleteMessage(msg.id)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ) : (
                <div id={`msg_${msg.id}`} className={`${styles.messageWrapper} ${msg.characterId === 'char_A' ? styles.alignLeft : styles.alignRight} ${isCatastrophe || isRashomon ? styles.breakthrough : ''}`}>
                  <div className={styles.characterHeader}>
                    <div className={`${styles.characterAvatar} ${msg.characterId === 'System' ? styles.observerAvatar : ''}`}>
                      {getCharacterInitials(msg.characterId)}
                    </div>
                    <div className={styles.characterName}>
                      {getCharacterName(msg.characterId)}
                      <span className={styles.messageTime}> • <strong>{formatTime(msg.timestamp)}</strong></span>
                    </div>

                    <div className={styles.messageActions}>
                      <button className={styles.actionBtn} onClick={() => handleEditClick(msg)} title="Edit"><Edit2 size={14} /></button>
                      <button className={styles.actionBtn} onClick={() => handleMarkAsRead(msg.id)} title="Mark as Read"><Eye size={14} /></button>
                      <button className={styles.actionBtn} onClick={() => handleDeleteMessage(msg.id)} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {editingMessageId === msg.id ? (
                    <div className={styles.editContainer}>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: 4 }}>Suy nghĩ (Thought)</div>
                      <textarea
                        className={styles.editTextarea}
                        style={{ minHeight: 80 }}
                        value={editContent?.thought || ''}
                        onChange={e => setEditContent({ ...editContent, thought: e.target.value })}
                      />

                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 12, marginBottom: 4 }}>Hành động / Lời nói (Dialogues)</div>
                      {editContent?.dialogues?.map((dlg: string, idx: number) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <textarea
                            className={styles.editTextarea}
                            style={{ flex: 1, minHeight: 120 }}
                            value={dlg}
                            onChange={e => {
                              const newDialogues = [...editContent.dialogues];
                              newDialogues[idx] = e.target.value;
                              setEditContent({ ...editContent, dialogues: newDialogues });
                            }}
                          />
                          <button onClick={() => {
                            const newDialogues = editContent.dialogues.filter((_: any, i: number) => i !== idx);
                            setEditContent({ ...editContent, dialogues: newDialogues });
                          }} className={styles.actionBtn} style={{ alignSelf: 'flex-start', padding: 8 }}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        className={styles.actionBtn}
                        style={{ marginTop: 8, padding: '6px 12px', border: '1px solid var(--color-border)' }}
                        onClick={() => setEditContent({ ...editContent, dialogues: [...(editContent.dialogues || []), ''] })}
                      >
                        + Thêm đoạn thoại
                      </button>

                      <div className={styles.editActions}>
                        <button onClick={() => handleSaveEdit(msg.id)}><Check size={16} /></button>
                        <button onClick={handleCancelEdit}><X size={16} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              )}

              {isLastRead && index < history.length - 1 && (
                <div className={styles.lastReadDivider}>
                  <span>New Messages Below</span>
                </div>
              )}
            </React.Fragment>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.injectorArea}>
        {hasUnread && (
          <button className={styles.jumpUnreadBtn} onClick={handleJumpToUnread} title="Jump to marked message">
            Jump to Unread
          </button>
        )}

        {injectText.startsWith('/') && !injectText.includes(' ') && (
          <div className={styles.commandPalette}>
            {[
              { cmd: '/ask', desc: 'Hỏi Quản Trò' },
              { cmd: '/opinion', desc: 'Hỏi cảm nghĩ của Quản Trò về tình hình' },
              { cmd: '/summarize', desc: 'Tóm tắt câu chuyện' },
              { cmd: '/act', desc: 'Tham gia làm nhân vật' },
              { cmd: '/disrupt', desc: 'Thêm sự kiện mới vào câu chuyện' },
              { cmd: '/free', desc: 'Hỏi tự do' }
            ].filter(c => c.cmd.startsWith(injectText)).map(c => (
              <div
                key={c.cmd}
                className={styles.commandItem}
                onClick={() => setInjectText(c.cmd + ' ')}
              >
                <span className={styles.cmdName}>{c.cmd}</span>
                <span className={styles.cmdDesc}>{c.desc}</span>
              </div>
            ))}
          </div>
        )}

        <input
          className={styles.injectorInput}
          placeholder="Dùng lệnh '/' hoặc đóng vai bằng cách nhập không dùng lệnh"
          value={injectText}
          onChange={e => setInjectText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInject()}
        />
        <button className={styles.injectBtn} onClick={handleInject}>
          <PlusCircle size={20} />
        </button>
      </div>
    </div>
  )
}
