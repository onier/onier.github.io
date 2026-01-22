// 创建一个具有科技感的动态粒子背景
class TechBackground {
  constructor() {
    // 创建Canvas元素
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'tech-background';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '-1';
    document.body.prepend(this.canvas);
    
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.particleCount = 100;
    this.maxDistance = 200;
    this.mousePosition = { x: null, y: null };
    
    // 设置Canvas大小
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // 跟踪鼠标位置
    document.addEventListener('mousemove', (e) => {
      this.mousePosition.x = e.clientX;
      this.mousePosition.y = e.clientY;
    });
    
    // 初始化粒子
    this.init();
    
    // 开始动画
    this.animate();
  }
  
  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  init() {
    // 创建粒子
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 1,
        speedX: Math.random() * 1 - 0.5,
        speedY: Math.random() * 1 - 0.5,
        color: this.getRandomColor()
      });
    }
  }
  
  getRandomColor() {
    // 返回科技蓝色调的随机颜色
    const blueShades = [
      'rgba(0, 195, 255, 0.7)',
      'rgba(0, 132, 255, 0.7)',
      'rgba(89, 51, 255, 0.7)',
      'rgba(0, 255, 217, 0.7)',
      'rgba(65, 105, 225, 0.7)'
    ];
    return blueShades[Math.floor(Math.random() * blueShades.length)];
  }
  
  animate() {
    // 清除画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制和更新每个粒子
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      // 更新位置
      p.x += p.speedX;
      p.y += p.speedY;
      
      // 边界检查
      if (p.x > this.canvas.width || p.x < 0) {
        p.speedX = -p.speedX;
      }
      if (p.y > this.canvas.height || p.y < 0) {
        p.speedY = -p.speedY;
      }
      
      // 绘制粒子
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      
      // 连接粒子
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const distance = Math.sqrt(
          Math.pow(p.x - p2.x, 2) + Math.pow(p.y - p2.y, 2)
        );
        
        if (distance < this.maxDistance) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = `rgba(0, 195, 255, ${1 - distance / this.maxDistance})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
      
      // 与鼠标的互动
      if (this.mousePosition.x && this.mousePosition.y) {
        const mouseDistance = Math.sqrt(
          Math.pow(p.x - this.mousePosition.x, 2) + 
          Math.pow(p.y - this.mousePosition.y, 2)
        );
        
        if (mouseDistance < 120) {
          // 绘制从鼠标到粒子的连线
          this.ctx.beginPath();
          this.ctx.strokeStyle = `rgba(0, 255, 217, ${1 - mouseDistance / 120})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(this.mousePosition.x, this.mousePosition.y);
          this.ctx.stroke();
          
          // 鼠标附近的粒子略微加速移动
          const forceFactor = 0.1;
          const angle = Math.atan2(this.mousePosition.y - p.y, this.mousePosition.x - p.x);
          p.x += Math.cos(angle) * forceFactor;
          p.y += Math.sin(angle) * forceFactor;
        }
      }
    }
    
    // 添加辉光效果
    this.drawGlow();
    
    // 循环动画
    requestAnimationFrame(() => this.animate());
  }
  
  drawGlow() {
    // 创建渐变的辉光效果在画布的几个随机位置
    const glowPoints = [
      { x: this.canvas.width * 0.2, y: this.canvas.height * 0.3, radius: 150 },
      { x: this.canvas.width * 0.7, y: this.canvas.height * 0.7, radius: 180 },
      { x: this.canvas.width * 0.5, y: this.canvas.height * 0.2, radius: 120 }
    ];
    
    // 为每个辉光点创建径向渐变
    for (const point of glowPoints) {
      const gradient = this.ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, point.radius
      );
      
      gradient.addColorStop(0, 'rgba(0, 195, 255, 0.03)');
      gradient.addColorStop(0.5, 'rgba(0, 132, 255, 0.01)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      this.ctx.beginPath();
      this.ctx.fillStyle = gradient;
      this.ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // 创建一个全局的微弱辉光效果
    const time = Date.now() * 0.0005;
    const x = Math.sin(time) * this.canvas.width * 0.5 + this.canvas.width * 0.5;
    const y = Math.cos(time) * this.canvas.height * 0.5 + this.canvas.height * 0.5;
    
    const gradient = this.ctx.createRadialGradient(
      x, y, 0,
      x, y, Math.max(this.canvas.width, this.canvas.height) * 0.7
    );
    
    gradient.addColorStop(0, 'rgba(89, 51, 255, 0.02)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    this.ctx.beginPath();
    this.ctx.fillStyle = gradient;
    this.ctx.arc(x, y, Math.max(this.canvas.width, this.canvas.height) * 0.7, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

// 在文档加载完成后初始化背景
document.addEventListener('DOMContentLoaded', function() {
  // 创建背景动画
  new TechBackground();
  
  // 修改body背景，确保与动态背景效果协调
  document.body.style.backgroundImage = 'url("https://images.unsplash.com/photo-1635776062127-d379bfcba9f8?q=80&w=2832&auto=format&fit=crop")';
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center center';
  document.body.style.backgroundAttachment = 'fixed';
  document.body.style.backgroundBlendMode = 'color-dodge';
  document.body.style.backgroundColor = 'rgba(10, 17, 40, 0.97)';
});