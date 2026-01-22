/**
 * js/apps/mermaid.js
 * Mermaid Editor Pro (AMD 冲突修复版)
 * 修复：loader.min.js 导致的 define 冲突
 */

(function() {
    // ==========================================
    // 1. 配置与常量
    // ==========================================
    const CONFIG = {
        // 依然使用 v9.4.3，兼容性最好
        cdn: 'https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js',
        defaultTheme: 'default',
        debounceTime: 500,
        mermaid: {
            startOnLoad: false,
            securityLevel: 'loose',
            flowchart: { htmlLabels: true, curve: 'basis' }
        }
    };

    const TEMPLATES = {
        flowchart: `graph TD\n    A[Start] --> B{Is it?}\n    B -- Yes --> C[OK]\n    C --> D[Rethink]\n    D --> B\n    B -- No --> E[End]`,
        sequence: `sequenceDiagram\n    Alice->>John: Hello John, how are you?\n    John-->>Alice: Great!\n    Alice-)John: See you later!`,
        class: `classDiagram\n    class Animal{\n        +int age\n        +String gender\n        +isMammal()\n        +mate()\n    }\n    class Duck{\n        +String beakColor\n        +swim()\n        +quack()\n    }\n    Animal <|-- Duck`,
        gantt: `gantt\n    title A Gantt Diagram\n    dateFormat  YYYY-MM-DD\n    section Section\n    A task           :a1, 2014-01-01, 30d\n    Another task     :after a1  , 20d`,
        er: `erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains`
    };

    // ==========================================
    // 2. 核心服务 - 修复了加载器冲突
    // ==========================================
    
    const LibraryLoader = {
        status: 'idle', 
        queue: [],

        load() {
            return new Promise((resolve, reject) => {
                // 1. 如果已存在，直接返回
                if (window.mermaid) {
                    this.status = 'loaded';
                    return resolve(window.mermaid);
                }
                
                // 2. 处理队列
                if (this.status === 'loaded') return resolve(window.mermaid);
                if (this.status === 'loading') {
                    this.queue.push({ resolve, reject });
                    return;
                }

                this.status = 'loading';
                console.log('[Mermaid] Loading library...');
                
                // ============================================================
                // 核心修复：绕过 AMD 加载器 (RequireJS/Monaco loader)
                // ============================================================
                const __define = window.define; // 保存原有的 define
                window.define = undefined;      // 暂时屏蔽 define，强制 UMD 走 window 挂载模式
                
                const script = document.createElement('script');
                script.src = CONFIG.cdn;
                
                script.onload = () => {
                    // 恢复环境
                    window.define = __define;
                    
                    if (window.mermaid) {
                        console.log('[Mermaid] Library loaded successfully.');
                        try {
                            window.mermaid.initialize(CONFIG.mermaid);
                            this.status = 'loaded';
                            resolve(window.mermaid);
                            this.processQueue(null, window.mermaid);
                        } catch (e) {
                            this.handleError(e);
                        }
                    } else {
                        this.handleError(new Error('Mermaid script loaded but window.mermaid is missing'));
                    }
                };
                
                script.onerror = (err) => {
                    window.define = __define; // 出错也要恢复环境
                    this.handleError(err);
                };
                
                document.head.appendChild(script);
            });
        },

        processQueue(err, result) {
            this.queue.forEach(task => err ? task.reject(err) : task.resolve(result));
            this.queue = [];
        },

        handleError(err) {
            console.error('[Mermaid] Load failed:', err);
            this.status = 'error';
            this.processQueue(err);
        }
    };

    const FileSystem = {
        async open() {
            if (!window.showOpenFilePicker) throw new Error('Browser not supported');
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Mermaid File', accept: { 'text/plain': ['.mmd', '.mermaid', '.txt'] } }]
            });
            const file = await handle.getFile();
            const content = await file.text();
            return { handle, content, name: file.name };
        },
        async save(handle, content) {
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
        },
        async saveAs(content) {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'diagram.mmd',
                types: [{ description: 'Mermaid File', accept: { 'text/plain': ['.mmd'] } }]
            });
            await this.save(handle, content);
            return handle;
        }
    };

    // ==========================================
    // 3. 编辑器类
    // ==========================================

    class MermaidEditor {
        constructor(instanceId) {
            this.id = instanceId;
            this.fileHandle = null;
            this.isDirty = false;
            this.currentTheme = CONFIG.defaultTheme;
            this.scale = 1;
            this.transform = { x: 0, y: 0 };
            
            this.render = this.render.bind(this);
            this.handleInput = this.handleInput.bind(this);
        }

        getHTML() {
            this.injectStyles();
            return `
            <div class="mermaid-layout" id="app-${this.id}">
                <div class="mermaid-toolbar" id="toolbar-${this.id}">
                    <!-- 文件操作组 -->
                    <div class="toolbar-section file-actions">
                        <div class="section-label">文件</div>
                        <div class="btn-group">
                            <button class="m-btn primary" data-action="new" title="新建文件">
                                <span class="btn-icon">📄</span>
                                <span class="btn-text">新建</span>
                            </button>
                            <button class="m-btn" data-action="open" title="打开文件">
                                <span class="btn-icon">📂</span>
                                <span class="btn-text">打开</span>
                            </button>
                            <button class="m-btn" data-action="save" title="保存文件" disabled>
                                <span class="btn-icon">💾</span>
                                <span class="btn-text">保存</span>
                            </button>
                            <button class="m-btn" data-action="saveAs" title="另存为">
                                <span class="btn-icon">📝</span>
                                <span class="btn-text">另存为</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="toolbar-divider"></div>
                    
                    <!-- 编辑功能组 -->
                    <div class="toolbar-section edit-actions">
                        <div class="section-label">编辑</div>
                        <div class="btn-group">
                            <div class="select-wrapper">
                                <select class="m-select" data-action="theme" title="选择主题">
                                    <option value="default">默认主题</option>
                                    <option value="dark">暗色主题</option>
                                    <option value="forest">森林主题</option>
                                    <option value="neutral">中性主题</option>
                                    <option value="base">基础主题</option>
                                </select>
                                <span class="select-arrow">▼</span>
                            </div>
                            <div class="select-wrapper">
                                <select class="m-select" data-action="template" title="插入模板">
                                    <option value="">插入模板...</option>
                                    ${Object.keys(TEMPLATES).map(k => `<option value="${k}">${k.charAt(0).toUpperCase() + k.slice(1)}</option>`).join('')}
                                </select>
                                <span class="select-arrow">▼</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="toolbar-divider"></div>
                    
                    <!-- 导出功能组 -->
                    <div class="toolbar-section export-actions">
                        <div class="section-label">导出</div>
                        <div class="btn-group">
                            <button class="m-btn success" data-action="exportSvg" title="导出为SVG">
                                <span class="btn-icon">🖼️</span>
                                <span class="btn-text">SVG</span>
                            </button>
                            <button class="m-btn success" data-action="exportPng" title="导出为PNG">
                                <span class="btn-icon">📸</span>
                                <span class="btn-text">PNG</span>
                            </button>
                            <button class="m-btn" data-action="copy" title="复制代码">
                                <span class="btn-icon">📋</span>
                                <span class="btn-text">复制</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="toolbar-spacer"></div>
                    
                    <!-- 状态显示 -->
                    <div class="toolbar-section status-section">
                        <div class="status-container">
                            <span class="status-text" id="status-${this.id}">初始化中...</span>
                            <div class="status-indicator"></div>
                        </div>
                    </div>
                </div>

                <div class="mermaid-workspace">
                    <div class="editor-pane">
                        <div class="pane-header">Code</div>
                        <textarea id="editor-${this.id}" class="code-editor" spellcheck="false" placeholder="Enter Mermaid code..."></textarea>
                    </div>
                    <div class="preview-pane" id="preview-pane-${this.id}">
                        <div class="pane-header">
                            Preview
                            <button class="mini-btn" data-action="resetZoom">Reset View</button>
                        </div>
                        <div class="preview-viewport" id="viewport-${this.id}">
                            <div class="preview-content" id="content-${this.id}">
                                <div id="diagram-${this.id}" class="mermaid-diagram"></div>
                            </div>
                        </div>
                        <div class="zoom-tools">
                            <button class="mini-btn" data-action="zoomIn">➕</button>
                            <button class="mini-btn" data-action="zoomOut">➖</button>
                        </div>
                        <div id="error-${this.id}" class="error-box"></div>
                    </div>
                </div>

                <div class="mermaid-footer">
                    <span id="stats-${this.id}">Chars: 0 | Lines: 1</span>
                    <span>Mermaid v9.4.3 Fix</span>
                </div>
            </div>`;
        }

        mount() {
            this.dom = {
                app: document.getElementById(`app-${this.id}`),
                editor: document.getElementById(`editor-${this.id}`),
                diagram: document.getElementById(`diagram-${this.id}`),
                viewport: document.getElementById(`viewport-${this.id}`),
                content: document.getElementById(`content-${this.id}`),
                error: document.getElementById(`error-${this.id}`),
                status: document.getElementById(`status-${this.id}`),
                stats: document.getElementById(`stats-${this.id}`),
                saveBtn: document.querySelector(`#toolbar-${this.id} [data-action="save"]`)
            };

            if (!this.dom.editor) return;

            this.bindEvents();
            this.setStatus('正在加载核心库...', 'loading');
            
            LibraryLoader.load()
                .then(() => {
                    this.setStatus('就绪');
                    this.dom.editor.value = TEMPLATES.flowchart;
                    this.handleInput();
                })
                .catch(err => {
                    this.setStatus('核心库加载失败', 'error');
                    this.showError(err.message);
                });
        }

        bindEvents() {
            const toolbar = document.getElementById(`toolbar-${this.id}`);
            toolbar.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action && this.actions[action]) this.actions[action].call(this, e);
            });
            toolbar.addEventListener('change', (e) => {
                const action = e.target.dataset.action;
                if (action === 'theme') this.setTheme(e.target.value);
                if (action === 'template') this.loadTemplate(e.target.value);
            });

            const previewPane = document.getElementById(`preview-pane-${this.id}`);
            previewPane.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'zoomIn') this.zoom(0.1);
                if (action === 'zoomOut') this.zoom(-0.1);
                if (action === 'resetZoom') this.resetView();
            });

            this.dom.editor.addEventListener('input', this.handleInput);
            this.dom.editor.addEventListener('keydown', (e) => this.handleKeydown(e));
            this.bindViewControls();
        }

        bindViewControls() {
            const el = this.dom.viewport;
            let isDragging = false;
            let start = { x: 0, y: 0 };

            el.addEventListener('wheel', (e) => {
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.zoom(e.deltaY > 0 ? -0.1 : 0.1);
                }
            });

            el.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                isDragging = true;
                start = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
                el.style.cursor = 'grabbing';
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                this.transform.x = e.clientX - start.x;
                this.transform.y = e.clientY - start.y;
                this.updateTransform();
            });

            window.addEventListener('mouseup', () => {
                isDragging = false;
                el.style.cursor = 'grab';
            });
        }

        handleKeydown(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.actions.save.call(this);
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.dom.editor.selectionStart;
                const end = this.dom.editor.selectionEnd;
                this.dom.editor.value = this.dom.editor.value.substring(0, start) + "    " + this.dom.editor.value.substring(end);
                this.dom.editor.selectionStart = this.dom.editor.selectionEnd = start + 4;
                this.handleInput();
            }
        }

        handleInput() {
            const content = this.dom.editor.value;
            this.dom.stats.textContent = `Chars: ${content.length} | Lines: ${content.split('\n').length}`;
            if (!this.isDirty) {
                this.isDirty = true;
                this.dom.saveBtn.disabled = false;
            }
            if (this.renderTimer) clearTimeout(this.renderTimer);
            this.renderTimer = setTimeout(this.render, CONFIG.debounceTime);
        }

        async render() {
            const content = this.dom.editor.value.trim();
            if (!content) {
                this.dom.diagram.innerHTML = '';
                this.dom.error.style.display = 'none';
                return;
            }

            try {
                window.mermaid.initialize({ ...CONFIG.mermaid, theme: this.currentTheme });
                const id = `graph-${this.id}-${Date.now()}`;
                
                // v9 兼容渲染
                window.mermaid.render(id, content, (svgCode) => {
                    this.dom.diagram.innerHTML = svgCode;
                    this.dom.error.style.display = 'none';
                    this.setStatus('渲染成功', 'success');
                });
            } catch (err) {
                console.warn('Render warning:', err);
                this.showError(err.message || 'Syntax Error');
                this.setStatus('语法错误', 'error');
            }
        }

        actions = {
            new: function() {
                if (this.isDirty && !confirm('放弃未保存的更改？')) return;
                this.dom.editor.value = '';
                this.fileHandle = null;
                this.isDirty = false;
                this.dom.saveBtn.disabled = true;
                this.resetView();
                this.handleInput();
                this.setStatus('已新建');
            },
            open: async function() {
                try {
                    const { handle, content, name } = await FileSystem.open();
                    this.fileHandle = handle;
                    this.dom.editor.value = content;
                    this.isDirty = false;
                    this.dom.saveBtn.disabled = true;
                    this.resetView();
                    this.handleInput();
                    this.setStatus(`已打开: ${name}`, 'success');
                } catch (e) {
                    if (e.name !== 'AbortError') this.setStatus('打开失败: ' + e.message, 'error');
                }
            },
            save: async function() {
                if (!this.fileHandle) return this.actions.saveAs.call(this);
                try {
                    this.setStatus('正在保存...', 'loading');
                    await FileSystem.save(this.fileHandle, this.dom.editor.value);
                    this.isDirty = false;
                    this.dom.saveBtn.disabled = true;
                    this.setStatus('保存成功', 'success');
                } catch (e) {
                    this.setStatus('保存失败', 'error');
                }
            },
            saveAs: async function() {
                try {
                    const handle = await FileSystem.saveAs(this.dom.editor.value);
                    this.fileHandle = handle;
                    this.isDirty = false;
                    this.dom.saveBtn.disabled = true;
                    this.setStatus(`已保存: ${handle.name}`, 'success');
                } catch (e) {
                    if (e.name !== 'AbortError') console.error(e);
                }
            },
            exportSvg: function() {
                const svg = this.dom.diagram.querySelector('svg');
                if (!svg) return alert('没有可导出的图表');
                const data = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
                this.download(URL.createObjectURL(blob), `mermaid-${Date.now()}.svg`);
            },
            exportPng: function() {
                const svg = this.dom.diagram.querySelector('svg');
                if (!svg) return alert('没有可导出的图表');
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const data = new XMLSerializer().serializeToString(svg);
                const img = new Image();
                const bbox = svg.getBoundingClientRect();
                const scale = 2;
                canvas.width = bbox.width * scale;
                canvas.height = bbox.height * scale;
                img.onload = () => {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    this.download(canvas.toDataURL('image/png'), `mermaid-${Date.now()}.png`);
                };
                img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
            },
            copy: function() {
                navigator.clipboard.writeText(this.dom.editor.value)
                    .then(() => this.setStatus('源码已复制', 'success'));
            }
        };

        setTheme(theme) {
            this.currentTheme = theme;
            this.render();
        }

        loadTemplate(key) {
            if (!key || !TEMPLATES[key]) return;
            if (this.dom.editor.value.trim() && !confirm('覆盖当前内容？')) return;
            this.dom.editor.value = TEMPLATES[key];
            this.resetView();
            this.handleInput();
        }

        zoom(delta) {
            this.scale = Math.max(0.1, Math.min(5, this.scale + delta));
            this.updateTransform();
            this.setStatus(`缩放: ${Math.round(this.scale * 100)}%`);
        }

        resetView() {
            this.scale = 1;
            this.transform = { x: 0, y: 0 };
            this.updateTransform();
        }

        updateTransform() {
            this.dom.content.style.transform = 
                `translate(${this.transform.x}px, ${this.transform.y}px) scale(${this.scale})`;
        }

        setStatus(msg, type = 'normal') {
            if (!this.dom.status) return;
            this.dom.status.textContent = msg;
            this.dom.status.className = 'status-text status-' + type;
        }

        showError(msg) {
            this.dom.error.textContent = msg;
            this.dom.error.style.display = 'block';
        }

        download(url, name) {
            const a = document.createElement('a');
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }

        injectStyles() {
            if (document.getElementById('mermaid-pro-styles')) return;
            const css = `
                .mermaid-layout { 
                    display: flex; 
                    flex-direction: column; 
                    height: 100%; 
                    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
                    font-family: 'Segoe UI', 'Inter', -apple-system, sans-serif; 
                }
                
                /* 工具栏主容器 */
                .mermaid-toolbar { 
                    padding: 10px 16px; 
                    background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
                    border-bottom: 1px solid #e2e8f0; 
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                    display: flex; 
                    align-items: center; 
                    gap: 12px; 
                    flex-wrap: wrap;
                    min-height: 56px;
                    box-sizing: border-box;
                }
                
                /* 工具栏分区 */
                .toolbar-section {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 8px;
                    border-radius: 6px;
                    background: rgba(241, 245, 249, 0.5);
                    transition: background 0.2s;
                }
                
                .toolbar-section:hover {
                    background: rgba(226, 232, 240, 0.7);
                }
                
                .section-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    padding: 2px 6px;
                    background: #e2e8f0;
                    border-radius: 4px;
                    white-space: nowrap;
                }
                
                /* 按钮组 */
                .btn-group {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                /* 按钮样式 */
                .m-btn { 
                    padding: 6px 12px; 
                    border: 1px solid #cbd5e1; 
                    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
                    border-radius: 6px; 
                    cursor: pointer; 
                    font-size: 12px; 
                    display: flex; 
                    align-items: center; 
                    gap: 6px; 
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    color: #334155;
                    font-weight: 500;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    position: relative;
                    overflow: hidden;
                }
                
                .m-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                
                .m-btn:hover:not(:disabled) { 
                    background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
                    border-color: #94a3b8; 
                    transform: translateY(-1px);
                    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
                }
                
                .m-btn:active:not(:disabled) {
                    transform: translateY(0);
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .m-btn.primary {
                    background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
                    border-color: #1d4ed8;
                    color: white;
                }
                
                .m-btn.primary:hover:not(:disabled) {
                    background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
                    border-color: #1e40af;
                }
                
                .m-btn.success {
                    background: linear-gradient(180deg, #10b981 0%, #059669 100%);
                    border-color: #047857;
                    color: white;
                }
                
                .m-btn.success:hover:not(:disabled) {
                    background: linear-gradient(180deg, #059669 0%, #047857 100%);
                    border-color: #065f46;
                }
                
                .m-btn:disabled { 
                    opacity: 0.5; 
                    cursor: not-allowed;
                    transform: none !important;
                    box-shadow: none !important;
                }
                
                .btn-icon {
                    font-size: 14px;
                    line-height: 1;
                }
                
                .btn-text {
                    white-space: nowrap;
                }
                
                /* 选择框样式 */
                .select-wrapper {
                    position: relative;
                    display: inline-block;
                }
                
                .m-select { 
                    padding: 6px 28px 6px 10px; 
                    border: 1px solid #cbd5e1; 
                    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
                    border-radius: 6px; 
                    font-size: 12px; 
                    color: #334155;
                    font-weight: 500;
                    cursor: pointer;
                    appearance: none;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    transition: all 0.2s;
                    min-width: 120px;
                }
                
                .m-select:hover {
                    border-color: #94a3b8;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
                }
                
                .m-select:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .select-arrow {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 10px;
                    color: #64748b;
                    pointer-events: none;
                }
                
                /* 分隔符 */
                .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: linear-gradient(180deg, transparent 0%, #cbd5e1 50%, transparent 100%);
                    margin: 0 4px;
                }
                
                /* 间距 */
                .toolbar-spacer {
                    flex: 1;
                }
                
                /* 状态区域 */
                .status-container {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 10px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                }
                
                .status-text { 
                    font-size: 12px; 
                    color: #475569;
                    font-weight: 500;
                    white-space: nowrap;
                }
                
                .status-success { color: #059669; }
                .status-error { color: #dc2626; }
                .status-loading { color: #2563eb; }
                
                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #94a3b8;
                    animation: pulse 2s infinite;
                }
                
                .status-success .status-indicator { background: #10b981; }
                .status-error .status-indicator { background: #ef4444; }
                .status-loading .status-indicator { 
                    background: #3b82f6;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* 工作区样式 */
                .mermaid-workspace { 
                    flex: 1; 
                    display: flex; 
                    overflow: hidden; 
                    padding: 12px; 
                    gap: 12px; 
                    background: transparent;
                }
                
                .mermaid-footer { 
                    padding: 8px 16px; 
                    background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%);
                    border-top: 1px solid #e2e8f0; 
                    font-size: 11px; 
                    color: #64748b; 
                    display: flex; 
                    justify-content: space-between;
                    font-weight: 500;
                }
                
                /* 编辑器面板 */
                .editor-pane, .preview-pane { 
                    flex: 1; 
                    background: #ffffff; 
                    border: 1px solid #e2e8f0; 
                    border-radius: 8px; 
                    display: flex; 
                    flex-direction: column; 
                    overflow: hidden; 
                    position: relative;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                }
                
                .pane-header { 
                    padding: 8px 12px; 
                    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
                    border-bottom: 1px solid #e2e8f0; 
                    font-size: 12px; 
                    font-weight: 600; 
                    color: #475569; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .code-editor { 
                    flex: 1; 
                    border: none; 
                    padding: 12px; 
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace; 
                    font-size: 13px; 
                    line-height: 1.6; 
                    resize: none; 
                    outline: none;
                    background: #ffffff;
                    color: #334155;
                }
                
                .code-editor:focus {
                    background: #fafafa;
                }
                
                .preview-viewport { 
                    flex: 1; 
                    overflow: hidden; 
                    position: relative; 
                    cursor: grab; 
                    background: #ffffff;
                }
                
                .preview-content { 
                    transform-origin: 0 0; 
                    padding: 24px; 
                    min-height: 100%; 
                    box-sizing: border-box;
                    background: #ffffff;
                }
                
                .mermaid-diagram { 
                    width: 100%; 
                    height: 100%; 
                }
                
                .zoom-tools { 
                    position: absolute; 
                    bottom: 12px; 
                    right: 12px; 
                    display: flex; 
                    flex-direction: column; 
                    gap: 4px; 
                }
                
                .mini-btn { 
                    padding: 4px 8px; 
                    background: rgba(255,255,255,0.95); 
                    border: 1px solid #cbd5e1; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    font-size: 11px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    transition: all 0.2s;
                }
                
                .mini-btn:hover {
                    background: #f1f5f9;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
                }
                
                .error-box { 
                    position: absolute; 
                    bottom: 0; 
                    left: 0; 
                    right: 0; 
                    background: #fef2f2; 
                    color: #dc2626; 
                    padding: 10px; 
                    font-size: 11px; 
                    border-top: 1px solid #fecaca; 
                    display: none; 
                    max-height: 100px; 
                    overflow-y: auto;
                    font-family: 'Consolas', monospace;
                    border-radius: 0 0 8px 8px;
                }
            `;
            const style = document.createElement('style');
            style.id = 'mermaid-pro-styles';
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    // 注册到 DesktopSystem
    window.MermaidEditorFactory = { create: (id) => new MermaidEditor(id) };

    if (typeof DesktopSystem !== 'undefined') {
        DesktopSystem.registerApp({
            id: 'mermaid-editor',
            title: 'Mermaid Editor Pro',
            icon: '📊',
            width: 1000,
            height: 700,
            content: (instanceId) => {
                const editor = window.MermaidEditorFactory.create(instanceId);
                setTimeout(() => editor.mount(), 0);
                return editor.getHTML();
            }
        });
    }

})();
