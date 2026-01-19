/**
 * js/core.js
 * 核心桌面系统：负责管理应用注册、窗口生命周期、任务栏
 */

const DesktopSystem = {
    apps: {},      // 注册的应用配置 { 'editor': { ...config } }
    instances: {}, // 运行中的窗口实例 { 'instance_1701': WinBoxObj }
    
    init() {
        // 渲染桌面图标（此时可能还没有应用注册，通常由应用加载后自动刷新或手动调用）
        // 这里我们等待 DOM 加载完成后再渲染
        document.addEventListener('DOMContentLoaded', () => {
            this.renderDesktop();
        });
    },

    /**
     * 🔌 注册应用接口
     * 外部 JS 文件调用此方法添加应用
     */
    registerApp(config) {
        if (!config.id || !config.title) {
            console.error('App registration failed: Missing id or title');
            return;
        }
        this.apps[config.id] = config;
        console.log(`App registered: ${config.title}`);
        
        // 如果系统已经初始化，重新渲染桌面图标
        if (document.getElementById('desktop')) {
            this.renderDesktop();
        }
    },

    // 1. 渲染桌面图标
    renderDesktop() {
        const desktop = document.getElementById('desktop');
        desktop.innerHTML = ''; // 清空现有图标

        Object.values(this.apps).forEach(app => {
            const icon = document.createElement('div');
            icon.className = 'desktop-icon';
            icon.innerHTML = `
                <div class="icon-img">${app.icon || '📦'}</div>
                <div class="icon-text">${app.title}</div>
            `;
            // 点击图标：创建新实例
            icon.onclick = () => this.createWindow(app.id);
            desktop.appendChild(icon);
        });
    },

    // 2. 创建窗口实例 (支持多开)
    createWindow(appId) {
        const app = this.apps[appId];
        if (!app) return;

        // 生成唯一的实例 ID
        const instanceId = `${appId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // 获取应用的内容 (支持函数动态生成或静态字符串)
        const content = typeof app.content === 'function' ? app.content(instanceId) : app.content;

        // 创建 WinBox
        const winConfig = {
            title: app.title,
            icon: false,
            background: app.color || '#0078d7',
            border: 4,
            width: app.width || '60%',
            height: app.height || '60%',
            x: 'center',
            y: 'center',
            bottom: 0,
            
            // 核心生命周期绑定
            onclose: () => {
                this.closeInstance(instanceId);
                return false; // 允许关闭
            }
        };

        // 根据类型注入内容
        if (app.type === 'url') {
            winConfig.url = app.url;
        } else {
            winConfig.html = content;
        }

        // 实例化 WinBox
        const win = new WinBox(winConfig);
        
        // 存入实例列表
        this.instances[instanceId] = {
            winbox: win,
            appId: appId
        };
    },

    // 3. 关闭实例清理
    closeInstance(instanceId) {
        delete this.instances[instanceId];
    },


    /**
     * 根据实例ID获取窗口对象
     * @param {string} instanceId - 窗口实例ID
     * @returns {Object|null} 窗口对象或null
     */
    getWindowById(instanceId) {
        return this.instances[instanceId] || null;
    }
};

// 立即初始化系统
DesktopSystem.init();
