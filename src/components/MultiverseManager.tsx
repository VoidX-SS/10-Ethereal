
import styles from './MultiverseManager.module.css';
import ParticleSphere from './ParticleSphere';

interface WorldItem {
  id: string;
  name: string;
  lastUpdated?: string;
  is_paused?: boolean;
}

interface MultiverseManagerProps {
  worlds: WorldItem[];
  onSelectWorld: (id: string) => void;
  onCreateWorld: () => void;
  onDeleteWorld?: (id: string) => void;
}

export default function MultiverseManager({ worlds, onSelectWorld, onCreateWorld, onDeleteWorld }: MultiverseManagerProps) {
  return (
    <div className={styles.container}>
      <div className={styles.stars}></div>
      <ParticleSphere />
      <div className={styles.content}>
        <h1 className={styles.title}>Generative Storytelling Multiverse</h1>
        <p className={styles.subtitle}>Chọn một thế giới để quan sát hoặc tạo một thế giới mới</p>

        <div className={styles.grid}>
          {worlds.map((world, index) => (
            <div
              key={world.id}
              className={styles.worldCard}
              onClick={() => onSelectWorld(world.id)}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={styles.orbit}>
                <div className={`${styles.planet} ${world.is_paused ? styles.planetPaused : ''}`}></div>
              </div>
              <div className={styles.info}>
                <h3 className={styles.worldName}>
                  {world.name || "Unknown World"}
                </h3>
                {world.lastUpdated && (
                  <p className={styles.updated}>Last sync: {world.lastUpdated}</p>
                )}
                {onDeleteWorld && (
                  <button
                    className={styles.deleteWorldBtn}
                    onClick={(e) => { e.stopPropagation(); onDeleteWorld(world.id); }}
                    title="Xóa thế giới"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}

          <div
            className={`${styles.worldCard} ${styles.createCard}`}
            onClick={onCreateWorld}
            style={{ animationDelay: `${worlds.length * 0.1}s` }}
          >
            <div className={styles.createIcon}>+</div>
            <div className={styles.info}>
              <h3 className={styles.worldName}>Tạo Thế Giới</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
