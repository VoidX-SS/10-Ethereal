import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import styles from './App.module.css'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import type { GameState, ChatMessage } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [history, setHistory] = useState<ChatMessage[]>([])

  useEffect(() => {
    const unsubState = onSnapshot(doc(db, 'game_data', 'state'), (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data() as GameState)
      } else {
        console.warn("Chưa có dữ liệu state trên Firestore!")
      }
    }, (error) => {
      console.error("Error listening to state", error)
    })

    const unsubHistory = onSnapshot(doc(db, 'game_data', 'history'), (docSnap) => {
      if (docSnap.exists()) {
        setHistory(docSnap.data().messages as ChatMessage[])
      } else {
        console.warn("Chưa có dữ liệu history trên Firestore!")
      }
    }, (error) => {
      console.error("Error listening to history", error)
    })

    return () => {
      unsubState()
      unsubHistory()
    }
  }, [])

  if (!gameState) return <div style={{ padding: 40, fontFamily: 'var(--font-serif)' }}>Gathering the notes...</div>

  return (
    <div className={styles.appContainer}>
      <div className={`${styles.leftPanel} ${!sidebarOpen ? styles.collapsed : ''}`}>
        <Sidebar gameState={gameState} setGameState={setGameState} sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      </div>
      
      <div className={styles.rightPanel}>
        <Chat 
          history={history} 
          gameState={gameState} 
        />
      </div>
    </div>
  )
}

export default App
