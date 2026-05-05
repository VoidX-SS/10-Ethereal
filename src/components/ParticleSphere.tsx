import { useRef, useEffect } from 'react';

export default function ParticleSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: any[] = [];
    const numParticles = 150; // Tăng mật độ từ 150 lên 400
    const sphereRadius = Math.min(width, height) * 0.38;
    const centerX = width / 2;
    const centerY = height / 2;

    // Generate particles on a sphere
    for (let i = 0; i < numParticles; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
      const y = sphereRadius * Math.sin(phi) * Math.sin(theta);
      const z = sphereRadius * Math.cos(phi);

      particles.push({ x, y, z, originX: x, originY: y, originZ: z });
    }

    let angleX = 0;
    let angleY = 0;

    const render = () => {
      // Clear canvas with transparent background
      ctx.clearRect(0, 0, width, height);

      angleX += 0.001;
      angleY += 0.002;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);

      const projected = particles.map(p => {
        // Rotate around X
        let y1 = p.y * cosX - p.z * sinX;
        let z1 = p.y * sinX + p.z * cosX;

        // Rotate around Y
        let x2 = p.x * cosY + z1 * sinY;
        let z2 = -p.x * sinY + z1 * cosY;

        // Perspective projection
        const distance = 1000;
        const z = distance / (distance - z2);
        const px = centerX + x2 * z;
        const py = centerY + y1 * z;

        return { px, py, z, rawZ: z2 };
      });

      // Draw connections
      ctx.lineWidth = 0.5;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].px - projected[j].px;
          const dy = projected[i].py - projected[j].py;
          const distSq = dx * dx + dy * dy;

          if (distSq < 25000) { // Tăng khoảng cách kết nối để trông dày đặc hơn
            const alpha = (1 - distSq / 25000) * 0.6; // Tăng độ sáng đường kẻ
            // Dòng kết nối màu trắng sáng hơn
            ctx.strokeStyle = `rgba(220, 220, 220, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].px, projected[i].py);
            ctx.lineTo(projected[j].px, projected[j].py);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const size = Math.max(1, p.z * 2.2); // Tăng kích thước hạt
        // Tăng độ sáng cơ bản (min alpha 0.4)
        const alpha = Math.max(0.4, (p.rawZ + sphereRadius) / (2 * sphereRadius));

        ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`; // Chuyển sang trắng tinh khiết
        ctx.beginPath();
        ctx.arc(p.px, p.py, size, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
}
