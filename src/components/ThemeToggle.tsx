import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem('ethereal_theme') as Theme) || 'system'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.classList.remove('light', 'dark');
      localStorage.removeItem('ethereal_theme');
    } else {
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      localStorage.setItem('ethereal_theme', theme);
    }
  }, [theme]);

  const cycleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  const getIcon = () => {
    if (theme === 'system') return <Monitor size={18} />;
    if (theme === 'dark') return <Moon size={18} />;
    return <Sun size={18} />;
  };

  const getTitle = () => {
    if (theme === 'system') return 'Giao diện: Hệ thống';
    if (theme === 'dark') return 'Giao diện: Tối';
    return 'Giao diện: Sáng';
  };

  return (
    <button 
      onClick={cycleTheme} 
      title={getTitle()}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--color-text-muted)',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-hover)';
        e.currentTarget.style.color = 'var(--color-text-main)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--color-text-muted)';
      }}
    >
      {getIcon()}
    </button>
  );
}
