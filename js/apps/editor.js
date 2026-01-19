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

    // 1. 初始化 (创建 DOM -> 加载 Monaco)
    init(instanceId, fileHandle = null) {
        // 渲染基础 HTML 结构
        const containerId = `monaco-container-${instanceId}`;
        
        // 异步加载 Monaco 核心
        require(['vs/editor/editor.main'], () => {
            const container = document.getElementById(containerId);
            if (!container) return;

            // 创建 Monaco 实例
            const editor = monaco.editor.create(container, {
                value: '', // 初始内容
                language: 'plaintext', // 初始语言
                theme: 'vs-dark', // 深色主题
                automaticLayout: false, // 我们手动处理 layout 以提升性能
                minimap: { enabled: true }, // 开启代码缩略图
                fontSize: 14,
                fontFamily: 'Consolas, "Courier New", monospace',
                scrollBeyondLastLine: false,
            });

            // 存入状态
            this.instances[instanceId] = {
                editor: editor,
                handle: fileHandle,
                isDirty: false
            };

            // 监听内容变化 (用于标记未保存状态，这里简化处理)
            editor.onDidChangeModelContent(() => {
                this.instances[instanceId].isDirty = true;
                this.updateStatus(instanceId, '已修改');
            });

            // 添加 ResizeObserver 自动调整编辑器大小
            // WinBox 改变大小时，必须调用 editor.layout()
            const ro = new ResizeObserver(() => {
                editor.layout();
            });
            ro.observe(container);

            // 如果启动时传入了文件，读取它
            if (fileHandle) {
                this.readFile(instanceId, fileHandle);
            }
        });
    },

    // 2. 读取文件
    async readFile(instanceId, fileHandle) {
        const state = this.instances[instanceId];
        if (!state || !state.editor) return;

        try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            // 自动检测语言
            const ext = file.name.split('.').pop().toLowerCase();
            const lang = this.langMap[ext] || 'plaintext';

            // 更新编辑器内容和语言模式
            const model = state.editor.getModel();
            monaco.editor.setModelLanguage(model, lang);
            state.editor.setValue(content);

            // 更新状态
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
        try {
            const [handle] = await window.showOpenFilePicker();
            await this.readFile(instanceId, handle);
        } catch (e) {} // 用户取消
    },

    // 4. 保存文件
    async saveFile(instanceId) {
        const state = this.instances[instanceId];
        if (!state || !state.editor) return;

        const content = state.editor.getValue(); // 获取 Monaco 内容

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
            
            // 更新语言高亮
            const ext = handle.name.split('.').pop().toLowerCase();
            const lang = this.langMap[ext] || 'plaintext';
            monaco.editor.setModelLanguage(state.editor.getModel(), lang);

        } catch (e) {}
    },

    // --- UI 辅助 ---
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
            title: fileHandle ? `Monaco Editor - ${fileHandle.name}` : 'Monaco Editor',
            icon: false,
            background: '#252526',
            border: 4,
            width: '800px', // 宽一点适合写代码
            height: '600px',
            x: 'center', y: 'center',
            html: `
                <div class="editor-layout">
                    <div class="editor-toolbar">
                        <button class="editor-btn" onclick="MonicaEditorApp.openFile('${instanceId}')">📂 打开</button>
                        <button class="editor-btn" onclick="MonicaEditorApp.saveFile('${instanceId}')">💾 保存</button>
                        <button class="editor-btn" onclick="MonicaEditorApp.saveAs('${instanceId}')">📑 另存为</button>
                    </div>
                    <!-- Monaco 挂载点 -->
                    <div id="monaco-container-${instanceId}" class="monaco-container"></div>
                    <div class="editor-status">
                        <span id="editor-title-${instanceId}">Untitled</span>
                        <span id="editor-status-${instanceId}">Ready</span>
                    </div>
                </div>
            `,
            oncreate: () => {
                // 必须稍微延时，等待 DOM 插入文档流
                setTimeout(() => this.init(instanceId, fileHandle), 50);
            },
            onclose: () => {
                // 销毁 Monaco 实例以释放内存
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
    title: 'Monaco Editor',
    icon: '📝',
    type: 'html',
    content: (instanceId) => {
        // 桌面图标直接点击，打开空编辑器
        setTimeout(() => {
             // 这里的逻辑稍微有点绕，因为我们想复用 openInstance 的逻辑
             // 但 core.js 已经创建了一个窗口。
             // 简单方案：直接调用 openInstance 创建新窗口，然后让 core.js 的空窗口自动关闭（或者忽略它）
             // 完美方案：重构 core.js。
             // 这里使用简单方案：
             MonicaEditorApp.openInstance(null);
        }, 100);
        
        // 返回一段脚本关闭 core.js 创建的默认窗口 (Hack)
        return `<script>
            // 这是一个 Hack，用于关闭 core.js 默认创建的空窗口，
            // 因为 MonicaEditorApp.openInstance 会自己创建配置更好的 WinBox
            const myWinBox = document.currentScript.closest('.winbox'); 
            if(myWinBox) myWinBox.remove(); 
        </script>`;
    }
});