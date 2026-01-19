/**
 * js/apps/files.js
 * 资源管理器 - IDE 风格版 (多标签 + Monaco Editor 集成)
 */

const FileExplorerApp = {
    state: {},

    // 初始化窗口状态
    initState(instanceId) {
        this.state[instanceId] = {
            rootHandle: null,
            currentHandle: null, // 当前“文件列表”视图所在的目录
            shellInstance: null,
            tabs: [], // { id, type: 'list'|'editor', name, handle, contentDivId, editorInstance }
            activeTabId: null
        };
    },

    // 1. 入口：选择根目录
    async openRoot(instanceId) {
        // 检查 API 支持
        if (!window.showDirectoryPicker) {
            alert('您的浏览器不支持文件系统访问API。请使用 Chrome 86+ 或 Edge。');
            return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker();
            const state = this.state[instanceId];

            state.rootHandle = dirHandle;
            state.currentHandle = dirHandle;

            // 重置左侧树
            const treeContainer = document.getElementById(`fm-tree-${instanceId}`);
            treeContainer.innerHTML = '';
            await this.appendTreeNode(instanceId, treeContainer, dirHandle, 0);

            // 初始化默认的“文件列表”标签
            this.initTabs(instanceId, dirHandle);

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                alert('打开目录失败: ' + err.message);
            }
        }
    },

    // --- 标签页管理系统 ---

    // 初始化默认标签
    initTabs(instanceId, dirHandle) {
        const state = this.state[instanceId];
        state.tabs = [];

        // 创建默认的“文件列表”标签
        const listTab = {
            id: 'tab-list',
            type: 'list',
            name: dirHandle.name,
            handle: dirHandle,
            contentDivId: `view-list-${instanceId}`
        };

        state.tabs.push(listTab);
        this.renderTabs(instanceId);
        this.switchTab(instanceId, 'tab-list');
        this.loadRightPanel(instanceId, dirHandle); // 加载列表内容
    },

    // 打开一个文件标签 (新建或跳转)
    async openFileTab(instanceId, fileHandle) {
        const state = this.state[instanceId];

        // 1. 检查是否已打开 (按文件名匹配)
        const existingTab = state.tabs.find(t => t.handle && t.handle.name === fileHandle.name);
        if (existingTab) {
            this.switchTab(instanceId, existingTab.id);
            return;
        }

        // 2. 创建新标签数据
        const tabId = `tab-${Date.now()}`;
        const contentId = `view-${tabId}`;

        const newTab = {
            id: tabId,
            type: 'editor',
            name: fileHandle.name,
            handle: fileHandle,
            contentDivId: contentId,
            editorInstance: null // 稍后填充
        };

        state.tabs.push(newTab);

        // 3. 创建 DOM 容器
        const viewsContainer = document.getElementById(`fm-views-${instanceId}`);
        const viewDiv = document.createElement('div');
        viewDiv.id = contentId;
        viewDiv.className = 'fm-view'; // 对应 CSS 中的 .fm-view

        // 强制内联样式确保宽高 (双重保险)
        viewDiv.style.width = '100%';
        viewDiv.style.height = '100%';
        viewDiv.style.overflow = 'hidden';

        viewsContainer.appendChild(viewDiv);

        // 4. 渲染标签栏并跳转 (这一步很重要，必须先让 div 变为 display:block)
        this.renderTabs(instanceId);
        this.switchTab(instanceId, tabId);

        // 5. 初始化 Monaco Editor
        // 稍微延时 0ms 确保 DOM 渲染完成，宽高已计算
        setTimeout(() => {
            this.initMonaco(instanceId, viewDiv, fileHandle);
        }, 0);
    },

    // 渲染标签栏 UI
    renderTabs(instanceId) {
        const state = this.state[instanceId];
        const bar = document.getElementById(`fm-tabs-${instanceId}`);
        if (!bar) return;

        bar.innerHTML = '';

        state.tabs.forEach(tab => {
            const isActive = tab.id === state.activeTabId;
            const tabEl = document.createElement('div');
            tabEl.className = `fm-tab ${isActive ? 'active' : ''}`;

            // 图标
            const icon = tab.type === 'list' ? '📂' : '📝';

            tabEl.innerHTML = `
                <span class="fm-tab-icon">${icon}</span>
                <span class="fm-tab-name">${tab.name}</span>
                ${tab.type === 'editor' ? `<span class="fm-tab-close">×</span>` : ''}
            `;

            // 点击切换
            tabEl.onclick = () => this.switchTab(instanceId, tab.id);

            // 点击关闭 (仅限编辑器)
            if (tab.type === 'editor') {
                const closeBtn = tabEl.querySelector('.fm-tab-close');
                closeBtn.onclick = (e) => {
                    e.stopPropagation(); // 防止触发切换
                    this.closeTab(instanceId, tab.id);
                };
            }

            bar.appendChild(tabEl);
        });
    },

    // 切换标签
    switchTab(instanceId, tabId) {
        const state = this.state[instanceId];
        state.activeTabId = tabId;

        // 1. 更新标签样式
        this.renderTabs(instanceId);

        // 2. 切换视图显示
        state.tabs.forEach(tab => {
            const el = document.getElementById(tab.contentDivId);
            if (el) {
                if (tab.id === tabId) {
                    el.classList.add('active');
                    // 如果是编辑器，切换回来时需要重新布局以适应大小
                    if (tab.editorInstance) {
                        // 稍微延时确保 display:flex 生效后再 layout
                        setTimeout(() => tab.editorInstance.layout(), 50);
                    }
                } else {
                    el.classList.remove('active');
                }
            }
        });
    },

    // 关闭标签
    closeTab(instanceId, tabId) {
        const state = this.state[instanceId];
        const tabIndex = state.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        const tab = state.tabs[tabIndex];

        // 销毁 Monaco 实例以释放内存
        if (tab.editorInstance) {
            tab.editorInstance.dispose();
        }

        // 移除 DOM
        const el = document.getElementById(tab.contentDivId);
        if (el) el.remove();

        // 移除数据
        state.tabs.splice(tabIndex, 1);

        // 如果关闭的是当前激活的标签，激活前一个
        if (state.activeTabId === tabId) {
            const newActive = state.tabs[Math.max(0, tabIndex - 1)];
            if (newActive) this.switchTab(instanceId, newActive.id);
        } else {
            this.renderTabs(instanceId);
        }
    },

    // --- Monaco Editor 集成 (核心修复部分) ---

    async initMonaco(instanceId, container, fileHandle) {
        // 1. 显示加载状态
        container.innerHTML = '<div style="color:#999;padding:20px;">正在加载编辑器资源...</div>';

        // 2. 检查 AMD Loader 是否存在
        if (typeof require === 'undefined') {
            container.innerHTML = '<div style="color:red;padding:20px;">错误: 未找到 Monaco Loader。请检查 index.html 是否引入了 loader.js</div>';
            return;
        }

        // 3. 使用 require 异步加载编辑器核心
        require(['vs/editor/editor.main'], async () => {
            // --- 回调开始：此时 window.monaco 必定可用 ---

            // 清空“正在加载”的提示
            container.innerHTML = '';

            try {
                const file = await fileHandle.getFile();
                const content = await file.text();

                // 简单语言推断
                const ext = file.name.split('.').pop().toLowerCase();
                const langMap = {
                    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript',
                    'html': 'html', 'css': 'css', 'json': 'json',
                    'md': 'markdown', 'py': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp',
                    'txt': 'plaintext'
                };

                // 创建编辑器实例
                const editor = monaco.editor.create(container, {
                    value: content,
                    language: langMap[ext] || 'plaintext',
                    theme: 'vs-dark',
                    automaticLayout: true, // 自动适应容器大小
                    minimap: { enabled: true },
                    fontSize: 14,
                    fontFamily: 'Consolas, "Courier New", monospace',
                    scrollBeyondLastLine: false
                });

                // 将实例绑定到对应的 Tab 数据中
                const state = this.state[instanceId];
                if (state) {
                    const tab = state.tabs.find(t => t.handle && t.handle.name === fileHandle.name);
                    if (tab) {
                        tab.editorInstance = editor;
                    }
                }

                // 添加 Ctrl+S 保存监听
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
                    try {
                        const val = editor.getValue();
                        const writable = await fileHandle.createWritable();
                        await writable.write(val);
                        await writable.close();

                        // 简单的保存反馈
                        alert('已保存: ' + file.name);
                    } catch (e) {
                        alert('保存失败: ' + e.message);
                    }
                });

            } catch (e) {
                console.error(e);
                container.innerHTML = `<div style="color:red;padding:20px;">无法读取文件: ${e.message}</div>`;
            }
        });
    },

    // --- 左侧树逻辑 (支持显示文件) ---

    async appendTreeNode(instanceId, container, dirHandle, level) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'tree-node';

        const rowDiv = document.createElement('div');
        rowDiv.className = 'tree-row';
        rowDiv.style.paddingLeft = `${level * 16}px`;

        const isDir = dirHandle.kind === 'directory';
        const icon = isDir ? '📁' : '📄';
        // 只有文件夹才有箭头
        const arrow = isDir ? '<span class="tree-arrow">▶</span>' : '<span class="tree-arrow" style="visibility:hidden">▶</span>';

        rowDiv.innerHTML = `${arrow}<span class="tree-icon">${icon}</span><span>${dirHandle.name}</span>`;

        // 子节点容器
        const childrenDiv = document.createElement('div');
        childrenDiv.style.display = 'none';

        nodeDiv.appendChild(rowDiv);
        nodeDiv.appendChild(childrenDiv);
        container.appendChild(nodeDiv);

        // 事件处理
        const arrowSpan = rowDiv.querySelector('.tree-arrow');

        if (isDir) {
            // 点击箭头：展开/折叠
            arrowSpan.onclick = (e) => {
                e.stopPropagation();
                this.toggleTreeExpand(instanceId, arrowSpan, childrenDiv, dirHandle, level + 1);
            };
            // 点击行：在右侧列表显示该目录内容
            rowDiv.onclick = () => {
                this.highlightRow(instanceId, rowDiv);
                // 切换回列表标签
                this.switchTab(instanceId, 'tab-list');
                // 更新列表内容
                this.loadRightPanel(instanceId, dirHandle);
                // 更新列表标签的名称
                const state = this.state[instanceId];
                const listTab = state.tabs.find(t => t.type === 'list');
                if (listTab) {
                    listTab.name = dirHandle.name;
                    listTab.handle = dirHandle;
                    this.renderTabs(instanceId);
                }
            };
        } else {
            // 点击文件行：在右侧打开编辑器标签
            rowDiv.onclick = () => {
                this.highlightRow(instanceId, rowDiv);
                this.openFileTab(instanceId, dirHandle); // dirHandle 这里其实是 fileHandle
            };
        }
    },

    // 高亮选中行
    highlightRow(instanceId, rowDiv) {
        const allRows = document.querySelectorAll(`#fm-tree-${instanceId} .tree-row`);
        allRows.forEach(r => r.classList.remove('selected'));
        rowDiv.classList.add('selected');
    },

    // 展开/折叠树节点
    async toggleTreeExpand(instanceId, arrow, container, handle, level) {
        if (arrow.innerHTML === '▶') {
            arrow.innerHTML = '▼';
            container.style.display = 'block';
            if (container.innerHTML === '') {
                // 遍历目录内容
                const dirs = [];
                const files = [];
                for await (const entry of handle.values()) {
                    if (entry.kind === 'directory') dirs.push(entry);
                    else files.push(entry);
                }

                // 排序：文件夹优先，然后按字母
                dirs.sort((a, b) => a.name.localeCompare(b.name));
                files.sort((a, b) => a.name.localeCompare(b.name));

                // 先渲染文件夹
                for (const d of dirs) await this.appendTreeNode(instanceId, container, d, level);
                // 再渲染文件
                for (const f of files) await this.appendTreeNode(instanceId, container, f, level);
            }
        } else {
            arrow.innerHTML = '▶';
            container.style.display = 'none';
        }
    },

    // --- 右侧列表逻辑 ---

    async loadRightPanel(instanceId, dirHandle) {
        const tbody = document.getElementById(`fm-tbody-${instanceId}`);
        if (!tbody) return;

        tbody.innerHTML = '';
        this.state[instanceId].currentHandle = dirHandle;

        const dirs = [];
        const files = [];

        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'directory') dirs.push(entry);
            else files.push(entry);
        }

        // 简单的排序
        dirs.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));
        const allEntries = [...dirs, ...files];

        for (const entry of allEntries) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${entry.kind === 'directory' ? '📁' : '📄'} ${entry.name}</td><td>-</td><td>${entry.kind}</td><td>-</td>`;

            tr.ondblclick = () => {
                if (entry.kind === 'directory') {
                    // 进入下一级目录
                    this.loadRightPanel(instanceId, entry);
                    // 更新列表标签名
                    const state = this.state[instanceId];
                    const listTab = state.tabs.find(t => t.type === 'list');
                    if (listTab) { listTab.name = entry.name; this.renderTabs(instanceId); }
                } else {
                    // 双击文件，打开标签
                    this.openFileTab(instanceId, entry);
                }
            };

            // 单击选中效果
            tr.onclick = () => {
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
                tr.classList.add('selected');
            };

            tbody.appendChild(tr);
        }
    },

    // --- 终端逻辑 ---

    toggleTerminal(instanceId) {
        const panel = document.getElementById(`fm-term-panel-${instanceId}`);
        const body = document.getElementById(`fm-term-body-${instanceId}`);
        const state = this.state[instanceId];
        if (!panel) return;

        if (panel.style.display === 'none') {
            panel.style.display = 'flex';
            if (!state.shellInstance) {
                const pathLabel = state.currentHandle ? `/${state.currentHandle.name}` : '/';
                // 确保 WebShell 已加载
                if (window.WebShell) {
                    state.shellInstance = new window.WebShell(body, state.currentHandle, pathLabel);
                } else {
                    body.innerHTML = 'WebShell 组件未加载';
                }
            } else {
                state.shellInstance.fit();
                state.shellInstance.term.focus();
            }
        } else {
            panel.style.display = 'none';
        }
    }
};

// 注册应用到桌面系统
DesktopSystem.registerApp({
    id: 'files',
    title: '资源管理器',
    icon: '📂',
    type: 'html',
    width: '950px',
    height: '650px',

    content: (instanceId) => {
        FileExplorerApp.initState(instanceId);
        return `
            <div class="fm-layout">
                <!-- 工具栏 -->
                <div class="fm-toolbar">
                    <button onclick="FileExplorerApp.openRoot('${instanceId}')">📂 打开根目录</button>
                    <button onclick="FileExplorerApp.toggleTerminal('${instanceId}')" style="margin-left:auto;">💻 终端</button>
                </div>

                <!-- 主体 -->
                <div class="fm-body">
                    <!-- 左侧树 -->
                    <div class="fm-tree-panel" id="fm-tree-${instanceId}"></div>

                    <!-- 右侧面板 -->
                    <div class="fm-right-panel">
                        <!-- 1. 标签栏 -->
                        <div class="fm-tabs-bar" id="fm-tabs-${instanceId}"></div>

                        <!-- 2. 视图容器 (包含列表和所有编辑器) -->
                        <div class="fm-views-container" id="fm-views-${instanceId}">
                            
                            <!-- 默认视图：文件列表 -->
                            <div id="view-list-${instanceId}" class="fm-view active">
                                <div class="fm-list-panel">
                                    <table class="fm-table">
                                        <thead>
                                            <tr><th>名称</th><th>日期</th><th>类型</th><th>大小</th></tr>
                                        </thead>
                                        <tbody id="fm-tbody-${instanceId}"></tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <!-- 动态添加的编辑器视图将放在这里 -->
                        </div>

                        <!-- 3. 底部终端 (共享) -->
                        <div class="fm-term-panel" id="fm-term-panel-${instanceId}" style="display: none;">
                            <div class="fm-term-header">
                                <span>终端</span>
                                <span class="fm-term-close" onclick="FileExplorerApp.toggleTerminal('${instanceId}')">×</span>
                            </div>
                            <div class="fm-term-body" id="fm-term-body-${instanceId}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
});
