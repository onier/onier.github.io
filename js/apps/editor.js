/**
 * js/apps/monica-editor.js
 * 基于 Monaco Editor 的专业代码编辑器
 */

window.MonicaEditorApp = {
    instances: {},

    // 语言映射表
    langMap: {
        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript',
        'html': 'html', 'css': 'css', 'json': 'json',
        'md': 'markdown', 'py': 'python', 'java': 'java',
        'c': 'c', 'cpp': 'cpp', 'txt': 'plaintext'
    },

    // --- 获取 HTML 模板 ---
    getTemplate(instanceId) {
        return `
            <div class="editor-layout" style="height: 100%; display: flex; flex-direction: column; background: #1e1e1e;">
                <div class="editor-toolbar" style="padding: 5px; background: #252526; border-bottom: 1px solid #333;">
                    <button class="editor-btn" onclick="MonicaEditorApp.openFile('${instanceId}')">📂 打开</button>
                    <button class="editor-btn" onclick="MonicaEditorApp.saveFile('${instanceId}')">💾 保存</button>
                    <button class="editor-btn" onclick="MonicaEditorApp.saveAs('${instanceId}')">📑 另存为</button>
                </div>
                <!-- Monaco 挂载点 -->
                <div id="monaco-container-${instanceId}" class="monaco-container" style="flex: 1; overflow: hidden;"></div>
                <div class="editor-status" style="padding: 0 10px; height: 22px; background: #007acc; color: white; font-size: 12px; line-height: 22px; display: flex; justify-content: space-between;">
                    <span id="editor-title-${instanceId}">Untitled</span>
                    <span id="editor-status-${instanceId}">Ready</span>
                </div>
            </div>
        `;
    },

    // 1. 初始化 (创建 DOM -> 加载 Monaco)
    init(instanceId, fileHandle = null) {
        const containerId = `monaco-container-${instanceId}`;
        
        require(['vs/editor/editor.main'], () => {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`Monaco container #${containerId} not found!`);
                return;
            }

            // 防止重复初始化
            if (container.getAttribute('data-initialized') === 'true') return;
            container.setAttribute('data-initialized', 'true');

            // 创建 Monaco 实例
            const editor = monaco.editor.create(container, {
                value: '', 
                language: 'plaintext', 
                theme: 'vs-light', 
                automaticLayout: false, 
                minimap: { enabled: true },
                fontSize: 14,
                fontFamily: 'Consolas, "Courier New", monospace',
                scrollBeyondLastLine: false,
            });

            this.instances[instanceId] = {
                editor: editor,
                handle: fileHandle,
                isDirty: false
            };

            editor.onDidChangeModelContent(() => {
                if(this.instances[instanceId]) {
                    this.instances[instanceId].isDirty = true;
                    this.updateStatus(instanceId, '已修改');
                }
            });

            const ro = new ResizeObserver(() => {
                editor.layout();
            });
            ro.observe(container);

            if (fileHandle) {
                this.readFile(instanceId, fileHandle);
            }
        });
    },

    // 2. 读取文件
    async readFile(instanceId, fileHandle) {
        const state = this.instances[instanceId];
        if (!state || !state.editor) {
            console.error('Editor instance not found:', instanceId);
            return;
        }

        try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            const ext = file.name.split('.').pop().toLowerCase();
            const lang = this.langMap[ext] || 'plaintext';

            const model = state.editor.getModel();
            monaco.editor.setModelLanguage(model, lang);
            state.editor.setValue(content);

            state.handle = fileHandle;
            state.isDirty = false;
            this.updateTitle(instanceId, file.name);
            this.updateStatus(instanceId, `已加载 (${lang})`);

        } catch (e) {
            alert('读取失败: ' + e.message);
        }
    },

    // 3. 打开文件按钮逻辑
    async openFile(instanceId) {
        // 调试日志，确保 instanceId 正确传递
        console.log('Opening file for instance:', instanceId);
        try {
            const [handle] = await window.showOpenFilePicker();
            await this.readFile(instanceId, handle);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error(e);
            }
        } 
    },

    // 4. 保存文件
    async saveFile(instanceId) {
        const state = this.instances[instanceId];
        if (!state || !state.editor) return;

        const content = state.editor.getValue();

        if (state.handle) {
            try {
                this.updateStatus(instanceId, '正在保存...');
                const writable = await state.handle.createWritable();
                await writable.write(content);
                await writable.close();
                
                state.isDirty = false;
                this.updateStatus(instanceId, '已保存');
            } catch (e) {
                alert('保存失败: ' + e.message);
            }
        } else {
            this.saveAs(instanceId);
        }
    },

    // 5. 另存为
    async saveAs(instanceId) {
        const state = this.instances[instanceId];
        const content = state.editor.getValue();

        try {
            const handle = await window.showSaveFilePicker();
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();

            state.handle = handle;
            state.isDirty = false;
            this.updateTitle(instanceId, handle.name);
            this.updateStatus(instanceId, '已保存');
            
            const ext = handle.name.split('.').pop().toLowerCase();
            const lang = this.langMap[ext] || 'plaintext';
            monaco.editor.setModelLanguage(state.editor.getModel(), lang);

        } catch (e) {}
    },

    updateTitle(instanceId, name) {
        const el = document.getElementById(`editor-title-${instanceId}`);
        if(el) el.innerText = name;
    },
    
    updateStatus(instanceId, status) {
        const el = document.getElementById(`editor-status-${instanceId}`);
        if(el) el.innerText = status;
    },

    // --- 外部调用接口 ---
    openInstance(fileHandle = null) {
        const instanceId = `monaco_${Date.now()}`;

        new WinBox({
            title: fileHandle ? `文本编辑器 - ${fileHandle.name}` : '文本编辑器',
            icon: false,
            background: '#252526',
            border: 4,
            width: '800px',
            height: '600px',
            x: 'center', y: 'center',
            html: this.getTemplate(instanceId),
            oncreate: () => {
                // WinBox 的 oncreate 保证了 DOM 已经存在
                setTimeout(() => this.init(instanceId, fileHandle), 50);
            },
            onclose: () => {
                if (this.instances[instanceId] && this.instances[instanceId].editor) {
                    this.instances[instanceId].editor.dispose();
                }
                delete this.instances[instanceId];
            }
        });
    }
};

// 注册到桌面
DesktopSystem.registerApp({
    id: 'monica-editor',
    title: '文本编辑器',
    icon: '📝',
    type: 'html',
    content: () => {
        const instanceId = `monaco_desk_${Date.now()}`;
        
        // 关键修复：不依赖 <script> 标签，而是使用 JS 轮询检测 DOM 元素
        // 一旦检测到 HTML 被插入页面，立即执行初始化
        const checkExist = setInterval(() => {
            const el = document.getElementById(`monaco-container-${instanceId}`);
            if (el) {
                clearInterval(checkExist);
                // 找到元素后，执行初始化
                MonicaEditorApp.init(instanceId, null);
            }
        }, 50); // 每 50ms 检查一次

        // 设置一个超时，防止内存泄漏（比如窗口创建失败）
        setTimeout(() => clearInterval(checkExist), 10000);
        
        // 只返回纯 HTML，不包含无效的 script
        return MonicaEditorApp.getTemplate(instanceId);
    }
});
