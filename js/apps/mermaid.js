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
                    <div class="btn-group">
                        <button class="m-btn" data-action="new" title="New">📄 新建</button>
                        <button class="m-btn" data-action="open" title="Open">📂 打开</button>
                        <button class="m-btn" data-action="save" title="Save" disabled>💾 保存</button>
                        <button class="m-btn" data-action="saveAs" title="Save As">📝 另存为</button>
                    </div>
                    <div class="separator"></div>
                    <select class="m-select" data-action="theme">
                        <option value="default">默认主题</option>
                        <option value="dark">暗色主题</option>
                        <option value="forest">森林主题</option>
                        <option value="neutral">中性主题</option>
                        <option value="base">基础主题</option>
                    </select>
                    <select class="m-select" data-action="template">
                        <option value="">插入模板...</option>
                        ${Object.keys(TEMPLATES).map(k => `<option value="${k}">${k.toUpperCase()}</option>`).join('')}
                    </select>
                    <div class="separator"></div>
                    <div class="btn-group">
                        <button class="m-btn" data-action="exportSvg">🖼️ SVG</button>
                        <button class="m-btn" data-action="exportPng">📸 PNG</button>
                        <button class="m-btn" data-action="copy">📋 复制</button>
                    </div>
                    <div class="spacer"></div>
                    <span class="status-text" id="status-${this.id}">初始化中...</span>
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
                .mermaid-layout { display: flex; flex-direction: column; height: 100%; background: #f9f9f9; font-family: 'Segoe UI', sans-serif; }
                .mermaid-toolbar { padding: 8px; background: #fff; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                .mermaid-workspace { flex: 1; display: flex; overflow: hidden; padding: 10px; gap: 10px; }
                .mermaid-footer { padding: 5px 12px; background: #fff; border-top: 1px solid #e0e0e0; font-size: 11px; color: #666; display: flex; justify-content: space-between; }
                .m-btn { padding: 5px 10px; border: 1px solid #dcdcdc; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: all 0.1s; }
                .m-btn:hover:not(:disabled) { background: #f0f0f0; border-color: #bbb; }
                .m-btn:disabled { opacity: 0.5; cursor: default; }
                .m-select { padding: 4px; border: 1px solid #dcdcdc; border-radius: 4px; font-size: 12px; }
                .separator { width: 1px; height: 18px; background: #e0e0e0; margin: 0 4px; }
                .spacer { flex: 1; }
                .editor-pane, .preview-pane { flex: 1; background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; display: flex; flex-direction: column; overflow: hidden; position: relative; }
                .pane-header { padding: 6px 10px; background: #f5f5f5; border-bottom: 1px solid #e0e0e0; font-size: 12px; font-weight: 600; color: #555; display: flex; justify-content: space-between; align-items: center; }
                .code-editor { flex: 1; border: none; padding: 10px; font-family: 'Consolas', monospace; font-size: 13px; line-height: 1.5; resize: none; outline: none; }
                .preview-viewport { flex: 1; overflow: hidden; position: relative; cursor: grab; background: #fff; }
                .preview-content { transform-origin: 0 0; padding: 20px; min-height: 100%; box-sizing: border-box; }
                .mermaid-diagram { width: 100%; height: 100%; }
                .zoom-tools { position: absolute; bottom: 10px; right: 10px; display: flex; flex-direction: column; gap: 4px; }
                .mini-btn { padding: 2px 6px; background: rgba(255,255,255,0.9); border: 1px solid #ccc; border-radius: 3px; cursor: pointer; font-size: 10px; }
                .status-text { font-size: 12px; color: #666; }
                .status-success { color: #28a745; }
                .status-error { color: #dc3545; }
                .status-loading { color: #007bff; }
                .error-box { position: absolute; bottom: 0; left: 0; right: 0; background: #fff0f0; color: #d00; padding: 8px; font-size: 11px; border-top: 1px solid #ffd0d0; display: none; max-height: 80px; overflow-y: auto; }
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
