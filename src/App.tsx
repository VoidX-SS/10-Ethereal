import { useState, useEffect } from 'react'
import { doc, onSnapshot, collection } from 'firebase/firestore'
import { db } from './firebase'
import styles from './App.module.css'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import MultiverseManager from './components/MultiverseManager'
import type { GameState, ChatMessage } from './types'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [currentWorldId, setCurrentWorldId] = useState<string | null>(null)
  const [worldsList, setWorldsList] = useState<{id: string, name: string, is_paused?: boolean}[]>([])

  useEffect(() => {
    const unsubWorlds = onSnapshot(collection(db, 'worlds'), (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().world?.name || doc.id,
        is_paused: doc.data().world?.is_paused || false
      }))
      setWorldsList(list)
    })
    return () => unsubWorlds()
  }, [])

  useEffect(() => {
    if (!currentWorldId) return;

    // Lắng nghe dữ liệu theo World ID đang chọn
    const unsubState = onSnapshot(doc(db, 'worlds', currentWorldId), (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data() as GameState)
      } else {
        console.warn(`Chưa có dữ liệu state cho ${currentWorldId}! Đang sao chép làm template...`)
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
  }, [currentWorldId])

  const handleCreateWorld = async () => {
    const newId = `world_${Date.now()}`;
    const emptyState: GameState = {
      characters: [],
      world: {
        name: "Thế giới trống",
        scenario: "Một thế giới mới được hình thành, chưa có quy luật nào.",
        current_topic: "Chưa có",
        environment: "Không gian trắng vô tận",
        time: "00:00",
        rules: "Tự do tuyệt đối.",
        next_speaker: "",
        next_tone: "Bình thường",
        next_length: "Ngắn"
      }
    };
    
    // Tạo trực tiếp trên Firestore
    await import('firebase/firestore').then(({ setDoc, doc }) => {
      setDoc(doc(db, 'worlds', newId), emptyState);
      setDoc(doc(db, 'history', newId), { messages: [] });
    });
    
    setCurrentWorldId(newId);
  };

  const handleDeleteWorld = async (id: string) => {
    if (window.confirm("Bạn có chắc muốn xoá thế giới này không? Hành động này không thể hoàn tác!")) {
      await import('firebase/firestore').then(({ deleteDoc, doc }) => {
        deleteDoc(doc(db, 'worlds', id));
        deleteDoc(doc(db, 'history', id));
      });
    }
  };

  const handleDeleteCharacter = (charId: string) => {
    if (!gameState || !currentWorldId) return;
    const char = gameState.characters.find(c => c.id === charId);
    const charName = char ? char.stats.name : "nhân vật này";
    
    if (window.confirm(`Bạn có chắc muốn xóa ${charName}? Hành động này sẽ xóa vĩnh viễn dữ liệu của nhân vật trong thế giới này.`)) {
      const newCharacters = gameState.characters.filter(c => c.id !== charId);
      const newState = { ...gameState, characters: newCharacters };
      
      // Cập nhật Firestore
      import('firebase/firestore').then(({ setDoc, doc }) => {
        setDoc(doc(db, 'worlds', currentWorldId), newState);
      });
    }
  };

  if (!currentWorldId) {
    return <MultiverseManager worlds={worldsList} onSelectWorld={setCurrentWorldId} onCreateWorld={handleCreateWorld} onDeleteWorld={handleDeleteWorld} />
  }

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
          onDeleteCharacter={handleDeleteCharacter}
        />
      </div>
      
      <div className={styles.rightPanel}>
        <Chat 
          history={history} 
          gameState={gameState} 
          currentWorldId={currentWorldId}
          onBack={() => setCurrentWorldId(null)}
        />
      </div>
    </div>
  )
}

export default App
