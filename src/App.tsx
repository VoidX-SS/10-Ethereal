import { useState, useEffect } from 'react'
import { doc, onSnapshot, collection } from 'firebase/firestore'
import { db } from './firebase'
import styles from './App.module.css'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import type { GameState, ChatMessage } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [currentWorldId, setCurrentWorldId] = useState<string>('world_1')
  const [worldsList, setWorldsList] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    const unsubWorlds = onSnapshot(collection(db, 'worlds'), (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().world?.name || doc.id
      }))
      setWorldsList(list)
    })
    return () => unsubWorlds()
  }, [])

  useEffect(() => {
    // Lắng nghe dữ liệu theo World ID đang chọn
    const unsubState = onSnapshot(doc(db, 'worlds', currentWorldId), (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data() as GameState)
      } else {
        console.warn(`Chưa có dữ liệu state cho ${currentWorldId}! Đang sao chép làm template...`)
        // Bắt giữ gameState hiện tại làm template thay vì xóa đi, người dùng có thể sửa và LƯU THẾ GIỚI
      }
    }, (error) => {
      console.error("Error listening to state", error)
    })

    const unsubHistory = onSnapshot(doc(db, 'history', currentWorldId), (docSnap) => {
      if (docSnap.exists()) {
        setHistory(docSnap.data().messages as ChatMessage[])
      } else {
        console.warn("Chưa có dữ liệu history trên Firestore!")
        setHistory([])
      }
    }, (error) => {
      console.error("Error listening to history", error)
    })

    return () => {
      unsubState()
      unsubHistory()
    }
  }, [currentWorldId]) // <-- Phụ thuộc vào currentWorldId

  if (!gameState) return <div style={{ padding: 40, fontFamily: 'var(--font-serif)' }}>Gathering the notes for {currentWorldId}...</div>

  return (
    <div className={styles.appContainer}>
      <div className={`${styles.leftPanel} ${!sidebarOpen ? styles.collapsed : ''}`}>
        <Sidebar 
          gameState={gameState} 
          setGameState={setGameState} 
          sidebarOpen={sidebarOpen} 
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
          currentWorldId={currentWorldId}
          setCurrentWorldId={setCurrentWorldId}
          worldsList={worldsList}
        />
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
