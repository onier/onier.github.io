/**
 * js/apps/vditor.js
 * Vditor Markdown Pro 编辑器 (修复版)
 * 
 * 修复内容：
 * 1. 解决 AMD/RequireJS 环境下的 define 冲突问题
 * 2. 增加对 this.editor 的空值检查，防止 setValue 报错
 * 3. 优化资源加载逻辑
 */

// SVG 图标库
const ICONS = {
    new: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>',
    open: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    save: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>',
    saveAs: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M12 18v-6"></path><path d="M9 15l3 3 3-3"></path></svg>',
    export: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    help: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
};

class VditorEditor {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.editor = null;
        this.fileHandle = null;
        this.isDirty = false;
        
        if (!this.container) return;

        this.init();
    }

    async init() {
        this.renderSkeleton();
        await this.loadDependencies();
        // 确保 Vditor 确实加载到了 window 对象上
        if (typeof window.Vditor !== 'undefined') {
            this.initEditor();
            this.bindEvents();
        } else {
            this.updateStatus('Vditor 加载失败', 'error');
        }
    }

    // 修复：加载资源时屏蔽 AMD/RequireJS
    async loadDependencies() {
        if (window.Vditor) return;

        this.updateStatus('正在加载资源...', 'loading');
        
        const loadScript = (src) => new Promise((resolve, reject) => {
            // 1. 备份现有的 define/require
            const _define = window.define;
            const _require = window.require;
            
            // 2. 暂时屏蔽 AMD，强制 Vditor 挂载到 window
            window.define = undefined;
            window.require = undefined;

            const script = document.createElement('script');
            script.src = src;
            
            script.onload = () => {
                // 3. 恢复环境
                window.define = _define;
                window.require = _require;
                resolve();
            };
            
            script.onerror = (e) => {
                window.define = _define;
                window.require = _require;
                reject(e);
            };
            
            document.head.appendChild(script);
        });

        const loadCSS = (href) => {
            if (document.querySelector(`link[href="${href}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        };

        try {
            loadCSS('https://cdn.jsdelivr.net/npm/vditor@3.9.3/dist/index.css');
            await loadScript('https://cdn.jsdelivr.net/npm/vditor@3.9.3/dist/index.min.js');
        } catch (e) {
            this.updateStatus('资源加载失败', 'error');
            console.error('Vditor load error:', e);
        }
    }

    renderSkeleton() {
        const id = this.containerId;
        this.container.innerHTML = `
            <div class="vd-app">
                <div class="vd-header">
                    <div class="vd-title-bar">
                        <div class="vd-file-info">
                            <span class="vd-icon">📝</span>
                            <span id="fileName-${id}" class="vd-filename">未命名文档.md</span>
                            <span id="dirtyDot-${id}" class="vd-dirty-dot"></span>
                        </div>
                        <div class="vd-status-text" id="statusText-${id}">准备就绪</div>
                    </div>
                    
                    <div class="vd-toolbar">
                        <div class="vd-btn-group">
                            <button class="vd-btn" id="new-${id}" title="新建">${ICONS.new} 新建</button>
                            <button class="vd-btn" id="open-${id}" title="打开">${ICONS.open} 打开</button>
                            <button class="vd-btn" id="save-${id}" title="保存" disabled>${ICONS.save} 保存</button>
                            <button class="vd-btn icon-only" id="saveAs-${id}" title="另存为">${ICONS.saveAs}</button>
                            <div class="vd-divider"></div>
                            <button class="vd-btn icon-only" id="export-${id}" title="导出 HTML">${ICONS.export}</button>
                        </div>

                        <div class="vd-controls">
                            <select id="mode-${id}" class="vd-select">
                                <option value="sv">分屏预览</option>
                                <option value="ir">即时渲染</option>
                                <option value="wysiwyg">所见即所得</option>
                            </select>
                            <button class="vd-btn icon-only" id="help-${id}" title="帮助">${ICONS.help}</button>
                        </div>
                    </div>
                </div>

                <div id="vditor-instance-${id}" class="vd-editor-body"></div>

                <div class="vd-footer">
                    <div class="vd-stats">
                        <span>字数: <b id="word-${id}">0</b></span>
                        <span class="vd-stat-divider"></span>
                        <span>行数: <b id="line-${id}">0</b></span>
                    </div>
                    <div class="vd-footer-right">
                        <span>Markdown Pro</span>
                    </div>
                </div>
            </div>
        `;

        this.dom = {
            fileName: document.getElementById(`fileName-${id}`),
            dirtyDot: document.getElementById(`dirtyDot-${id}`),
            statusText: document.getElementById(`statusText-${id}`),
            btnNew: document.getElementById(`new-${id}`),
            btnOpen: document.getElementById(`open-${id}`),
            btnSave: document.getElementById(`save-${id}`),
            btnSaveAs: document.getElementById(`saveAs-${id}`),
            btnExport: document.getElementById(`export-${id}`),
            btnHelp: document.getElementById(`help-${id}`),
            selectMode: document.getElementById(`mode-${id}`),
            wordCount: document.getElementById(`word-${id}`),
            lineCount: document.getElementById(`line-${id}`),
        };
    }

    initEditor() {
        const editorId = `vditor-instance-${this.containerId}`;
        
        try {
            this.editor = new Vditor(editorId, {
                height: '100%',
                mode: 'sv',
                theme: 'classic',
                placeholder: '在此处输入 Markdown 内容...',
                cache: { enable: false },
                toolbar: [
                    'emoji', 'headings', 'bold', 'italic', 'strike', 'link', '|',
                    'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
                    'quote', 'line', 'code', 'inline-code', '|',
                    'table', 'upload', 'link', '|',
                    'undo', 'redo', '|',
                    'edit-mode', 'fullscreen', 'preview'
                ],
                preview: {
                    hljs: { style: 'github' }
                },
                input: (value) => {
                    this.handleInput(value);
                },
                after: () => {
                    this.updateStatus('编辑器已就绪', 'success');
                    // 修复：确保 editor 存在再调用 setValue
                    if (this.editor) {
                        try {
                            this.editor.setValue(this.editor.getValue());
                        } catch(e) { /* ignore initial set error */ }
                    }
                },
            });
        } catch (e) {
            console.error('Vditor init failed:', e);
            this.updateStatus('编辑器初始化失败', 'error');
        }
    }

    bindEvents() {
        const d = this.dom;
        d.btnNew.onclick = () => this.newFile();
        d.btnOpen.onclick = () => this.openFile();
        d.btnSave.onclick = () => this.saveFile();
        d.btnSaveAs.onclick = () => this.saveAs();
        d.btnExport.onclick = () => this.exportHtml();
        d.btnHelp.onclick = () => this.insertHelp();
        
        d.selectMode.onchange = (e) => {
            if(this.editor) this.editor.setMode(e.target.value);
        };

        this.container.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey)) {
                switch(e.key.toLowerCase()) {
                    case 's': e.preventDefault(); this.saveFile(); break;
                    case 'o': e.preventDefault(); this.openFile(); break;
                }
            }
        });
    }

    handleInput(value) {
        if (!this.isDirty) {
            this.isDirty = true;
            this.dom.dirtyDot.style.display = 'inline-block';
            this.dom.btnSave.disabled = false;
        }
        this.dom.wordCount.textContent = value.length;
        this.dom.lineCount.textContent = value.split('\n').length;
    }

    updateStatus(msg, type = 'info') {
        const el = this.dom.statusText;
        if (!el) return;
        
        el.textContent = msg;
        el.className = 'vd-status-text';
        if (type === 'error') el.classList.add('status-error');
        if (type === 'success') el.classList.add('status-success');
        
        if (type !== 'loading') {
            setTimeout(() => {
                if (el) {
                    el.textContent = '就绪';
                    el.className = 'vd-status-text';
                }
            }, 3000);
        }
    }

    // --- 文件操作 ---

    async newFile() {
        if (this.isDirty && !confirm('放弃未保存的更改？')) return;
        if (this.editor) this.editor.setValue('');
        this.fileHandle = null;
        this.resetState('未命名文档.md');
    }

    async openFile() {
        if (!window.showOpenFilePicker) return alert('不支持文件系统API');
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Markdown', accept: {'text/markdown': ['.md', '.txt']} }]
            });
            const file = await handle.getFile();
            const content = await file.text();
            
            if (this.editor) {
                this.editor.setValue(content);
                this.fileHandle = handle;
                this.resetState(file.name);
                this.updateStatus(`已打开: ${file.name}`, 'success');
            }
        } catch (err) {
            if (err.name !== 'AbortError') this.updateStatus('打开失败', 'error');
        }
    }

    async saveFile() {
        if (!this.editor) return;
        if (!this.fileHandle) return this.saveAs();
        
        try {
            this.updateStatus('正在保存...', 'loading');
            const writable = await this.fileHandle.createWritable();
            await writable.write(this.editor.getValue());
            await writable.close();
            
            this.isDirty = false;
            this.dom.dirtyDot.style.display = 'none';
            this.dom.btnSave.disabled = true;
            this.updateStatus('保存成功', 'success');
        } catch (err) {
            this.updateStatus('保存失败', 'error');
        }
    }

    async saveAs() {
        if (!this.editor) return;
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: this.dom.fileName.textContent,
                types: [{ description: 'Markdown', accept: {'text/markdown': ['.md']} }]
            });
            this.fileHandle = handle;
            await this.saveFile();
            this.dom.fileName.textContent = handle.name;
        } catch (err) {}
    }

    async exportHtml() {
        if (!this.editor) return;
        const html = await this.editor.getHTML();
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Export</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vditor/dist/index.css" /><style>body{max-width:800px;margin:20px auto;padding:20px;font-family:sans-serif;}</style></head><body><div class="vditor-reset">${html}</div></body></html>`;

        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'export.html',
                types: [{ description: 'HTML', accept: {'text/html': ['.html']} }]
            });
            const writable = await handle.createWritable();
            await writable.write(fullHtml);
            await writable.close();
            this.updateStatus('导出成功', 'success');
        } catch (e) {}
    }

    resetState(name) {
        this.isDirty = false;
        this.dom.fileName.textContent = name;
        this.dom.dirtyDot.style.display = 'none';
        this.dom.btnSave.disabled = true;
        this.dom.wordCount.textContent = '0';
        this.dom.lineCount.textContent = '0';
    }

    insertHelp() {
        if (!this.editor) return;
        const helpText = `\n# Vditor 使用帮助\n\n- **快捷键**: Ctrl+S 保存, Ctrl+O 打开\n- **公式**: $E=mc^2$\n`;
        this.editor.insertValue(helpText);
    }
}

// 注册应用
DesktopSystem.registerApp({
    id: 'vditor',
    title: 'Markdown Pro',
    icon: '📝',
    width: 960,
    height: 700,
    content: (instanceId) => {
        setTimeout(() => {
            new VditorEditor(`app-${instanceId}`);
        }, 100);
        return `<div id="app-${instanceId}" style="height: 100%; width: 100%;"></div>`;
    }
});

// CSS 样式 (保持不变，确保美观)
const style = document.createElement('style');
style.textContent = `
:root { --vd-primary: #6366f1; --vd-bg: #ffffff; --vd-bg-sec: #f8fafc; --vd-border: #e2e8f0; --vd-text: #334155; --vd-hover: #f1f5f9; }
.vd-app { display: flex; flex-direction: column; height: 100%; background: var(--vd-bg); color: var(--vd-text); font-family: sans-serif; }
.vd-header { background: var(--vd-bg-sec); border-bottom: 1px solid var(--vd-border); padding: 8px 16px; display: flex; flex-direction: column; gap: 8px; }
.vd-title-bar { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.vd-file-info { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.vd-dirty-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: none; }
.vd-status-text { font-size: 12px; color: #64748b; } .status-error { color: #ef4444; } .status-success { color: #22c55e; }
.vd-toolbar { display: flex; justify-content: space-between; align-items: center; }
.vd-btn-group, .vd-controls { display: flex; align-items: center; gap: 6px; }
.vd-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid transparent; background: transparent; border-radius: 6px; color: var(--vd-text); font-size: 13px; cursor: pointer; transition: all 0.2s; }
.vd-btn:hover:not(:disabled) { background: var(--vd-hover); color: var(--vd-primary); }
.vd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.vd-btn.icon-only { padding: 6px; }
.vd-divider { width: 1px; height: 18px; background: var(--vd-border); margin: 0 4px; }
.vd-select { padding: 4px 8px; border: 1px solid var(--vd-border); border-radius: 4px; font-size: 12px; outline: none; }
.vd-editor-body { flex: 1; overflow: hidden; position: relative; }
.vditor { border: none !important; }
.vditor-toolbar { background: var(--vd-bg) !important; border-bottom: 1px solid var(--vd-border) !important; padding-left: 10px !important; }
.vd-footer { height: 28px; background: var(--vd-bg-sec); border-top: 1px solid var(--vd-border); display: flex; justify-content: space-between; align-items: center; padding: 0 12px; font-size: 11px; color: #64748b; }
.vd-stats { display: flex; gap: 10px; }
.vd-stat-divider { width: 1px; height: 10px; background: #cbd5e1; align-self: center; }
`;
if (!document.querySelector('style[data-vditor-style]')) {
    style.setAttribute('data-vditor-style', 'true');
    document.head.appendChild(style);
}
