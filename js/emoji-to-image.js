/**
 * Emoji 转 Base64 图片工具
 * 使用 Twemoji 的 CDN 图片
 */

const EmojiToImage = {
    // 使用 jsdelivr CDN（更好的 CORS 支持）
    TWEMOJI_BASE: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/',
    
    // 缓存已转换的 emoji base64
    cache: new Map(),
    
    // 检测 emoji 的正则（简化版，覆盖常用 emoji）
    emojiRegex: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu,
    
    // 获取 emoji 的 Unicode code point
    getCodePoint(emoji) {
        // 处理复合 emoji（如国旗、肤色修饰符）
        const codePoints = [];
        for (const char of emoji) {
            const cp = char.codePointAt(0);
            // 跳过零宽连接符和肤色修饰符的辅助处理
            if (cp !== 0x200D && !(cp >= 0xFE00 && cp <= 0xFE0F)) {
                codePoints.push(cp.toString(16));
            }
        }
        return codePoints.join('-');
    },
    
    // 下载图片并转为 base64
    async fetchAsBase64(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Fetch failed');
            
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('Failed to fetch emoji image:', url, e);
            return null;
        }
    },
    
    // 获取 emoji 的 base64 图片
    async getEmojiBase64(emoji) {
        // 检查缓存
        if (this.cache.has(emoji)) {
            return this.cache.get(emoji);
        }
        
        const codePoint = this.getCodePoint(emoji);
        const url = `${this.TWEMOJI_BASE}${codePoint}.png`;
        
        const base64 = await this.fetchAsBase64(url);
        if (base64) {
            this.cache.set(emoji, base64);
        }
        
        return base64;
    },
    
    // 将文本中的 emoji 替换为图片标签
    async replaceEmojisWithImages(text, options = {}) {
        const { size = '16px', className = 'emoji-img' } = options;
        
        const emojis = text.match(this.emojiRegex);
        if (!emojis) return text;
        
        let result = text;
        const uniqueEmojis = [...new Set(emojis)];
        
        for (const emoji of uniqueEmojis) {
            const base64 = await this.getEmojiBase64(emoji);
            if (base64) {
                const imgTag = `<img src="${base64}" class="${className}" alt="${emoji}" style="width:${size};height:${size};vertical-align:middle;display:inline-block;">`;
                result = result.split(emoji).join(imgTag);
            }
        }
        
        return result;
    },
    
    // 批量预加载常用 emoji（可选）
    async preloadCommonEmojis() {
        const commonEmojis = ['⚙️', '📝', '📊', '📂', '💻', '📄', '🔌', '⚡', '✅', '❌', '⚠️', 'ℹ️', '➡️', '⬅️', '⬆️', '⬇️', '🔍', '🔧', '📁', '📂'];
        
        for (const emoji of commonEmojis) {
            await this.getEmojiBase64(emoji);
        }
        console.log('Common emojis preloaded:', this.cache.size);
    },
    
    // 清理缓存
    clearCache() {
        this.cache.clear();
    }
};

// 导出
window.EmojiToImage = EmojiToImage;
