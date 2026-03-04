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
            editorInstance: null, // 稍后填充
            editorType: null // 'monaco' 或 'vditor'
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

        // 5. 根据文件类型选择编辑器
        const ext = fileHandle.name.split('.').pop().toLowerCase();
        const isMarkdown = ['md', 'markdown', 'mdown', 'mkd'].includes(ext);

        setTimeout(() => {
            if (isMarkdown) {
                this.initVditor(instanceId, viewDiv, fileHandle, newTab);
            } else {
                this.initMonaco(instanceId, viewDiv, fileHandle);
            }
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

        // 销毁编辑器实例以释放内存
        if (tab.editorInstance) {
            if (tab.editorType === 'vditor') {
                tab.editorInstance.destroy();
            } else {
                tab.editorInstance.dispose();
            }
        }

        // 释放 Blob URL
        if (tab.blobUrls) {
            tab.blobUrls.forEach(url => URL.revokeObjectURL(url));
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

    // --- Vditor Markdown 编辑器集成 ---

    async initVditor(instanceId, container, fileHandle, tab) {
        tab.editorType = 'vditor';
        container.innerHTML = '<div style="color:#999;padding:20px;">正在加载 Markdown 编辑器...</div>';

        // 确保 Vditor 已加载
        if (typeof window.Vditor === 'undefined') {
            await this.loadVditorLibrary();
        }

        if (typeof window.Vditor === 'undefined') {
            container.innerHTML = '<div style="color:red;padding:20px;">错误: Vditor 加载失败</div>';
            return;
        }

        try {
            const file = await fileHandle.getFile();
            let content = await file.text();

            // 处理本地图片：将相对路径转换为 Blob URL
            const parentDir = await this.getParentDirectory(fileHandle);
            const { processedContent, blobUrls } = await this.processMarkdownImages(content, parentDir);
            tab.blobUrls = blobUrls;

            // 清空容器
            container.innerHTML = '';

            // 创建 Vditor 容器
            const vditorId = `vditor-${tab.id}`;
            const vditorContainer = document.createElement('div');
            vditorContainer.id = vditorId;
            vditorContainer.style.width = '100%';
            vditorContainer.style.height = '100%';
            container.appendChild(vditorContainer);

            // 初始化 Vditor
            const editor = new Vditor(vditorId, {
                height: '100%',
                mode: 'sv', // 分屏模式：编辑 + 预览
                theme: 'classic',
                placeholder: '在此处输入 Markdown 内容...',
                cache: { enable: false },
                toolbar: [
                    'emoji', 'headings', 'bold', 'italic', 'strike', '|',
                    'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
                    'quote', 'line', 'code', 'inline-code', '|',
                    'table', 'link', '|',
                    'undo', 'redo', '|',
                    'edit-mode', 'fullscreen', 'preview'
                ],
                preview: {
                    delay: 500,
                    hljs: { 
                        style: 'github',
                        lineNumber: true
                    },
                    markdown: {
                        toc: true,
                        mark: true,
                        footnotes: true,
                        autoSpace: true
                    }
                },
                upload: {
                    accept: 'image/*',
                    handler: (files) => {
                        // 本地图片处理：转换为 Blob URL
                        return this.handleImageUpload(files, parentDir, editor);
                    }
                },
                input: (value) => {
                    tab.isDirty = true;
                },
                after: () => {
                    editor.setValue(processedContent);
                    tab.editorInstance = editor;
                }
            });

            // 添加 Ctrl+S 保存支持
            container.addEventListener('keydown', async (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    await this.saveMarkdownFile(fileHandle, editor, tab);
                }
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = `<div style="color:red;padding:20px;">无法读取文件: ${e.message}</div>`;
        }
    },

    // 加载 Vditor 库
    async loadVditorLibrary() {
        if (window.Vditor) return;

        return new Promise((resolve) => {
            // 加载 CSS
            if (!document.querySelector('link[href*="vditor"][href$="index.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/vditor@3.10.5/dist/index.css';
                document.head.appendChild(link);
            }

            // 加载 JS
            if (!document.querySelector('script[src*="vditor"]')) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/vditor@3.10.5/dist/index.min.js';
                script.onload = () => resolve();
                script.onerror = () => resolve();
                document.head.appendChild(script);
            } else {
                // 检查是否已加载完成
                const checkLoaded = setInterval(() => {
                    if (window.Vditor) {
                        clearInterval(checkLoaded);
                        resolve();
                    }
                }, 100);
                // 超时
                setTimeout(() => {
                    clearInterval(checkLoaded);
                    resolve();
                }, 10000);
            }
        });
    },

    // 获取文件的父目录
    async getParentDirectory(fileHandle) {
        // 尝试从 FileSystemDirectoryHandle 的 resolve 方法获取
        // 但由于 API 限制，我们使用存储在 tab 中的引用
        return null;
    },

    // 处理 Markdown 中的本地图片路径
    async processMarkdownImages(content, parentDir) {
        const blobUrls = [];
        
        // 匹配 Markdown 图片语法: ![alt](path) 和 HTML: <img src="path">
        const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        
        // 存储需要替换的映射
        const replacements = [];

        // 处理 Markdown 图片
        let match;
        while ((match = mdImageRegex.exec(content)) !== null) {
            const [fullMatch, alt, path] = match;
            if (this.isLocalImagePath(path)) {
                replacements.push({
                    original: fullMatch,
                    alt,
                    path,
                    index: match.index
                });
            }
        }

        // 处理 HTML 图片
        while ((match = htmlImageRegex.exec(content)) !== null) {
            const [fullMatch] = match;
            const srcMatch = fullMatch.match(/src=["']([^"']+)["']/);
            if (srcMatch && this.isLocalImagePath(srcMatch[1])) {
                // 检查是否已处理过
                const alreadyProcessed = replacements.some(r => r.original === fullMatch);
                if (!alreadyProcessed) {
                    replacements.push({
                        original: fullMatch,
                        path: srcMatch[1],
                        isHtml: true,
                        index: match.index
                    });
                }
            }
        }

        // 按索引倒序排序，以便从后往前替换
        replacements.sort((a, b) => b.index - a.index);

        let processedContent = content;

        // 尝试从文件系统读取图片
        for (const repl of replacements) {
            try {
                // 由于无法直接获取父目录，我们尝试使用 showDirectoryPicker 打开的根目录
                const imageBlob = await this.tryReadImageFile(repl.path);
                if (imageBlob) {
                    const blobUrl = URL.createObjectURL(imageBlob);
                    blobUrls.push(blobUrl);
                    
                    if (repl.isHtml) {
                        processedContent = processedContent.replace(
                            repl.original,
                            repl.original.replace(repl.path, blobUrl)
                        );
                    } else {
                        processedContent = processedContent.replace(
                            repl.original,
                            `![${repl.alt}](${blobUrl})`
                        );
                    }
                }
            } catch (e) {
                console.warn(`无法加载图片: ${repl.path}`, e);
            }
        }

        return { processedContent, blobUrls };
    },

    // 判断是否为本地图片路径
    isLocalImagePath(path) {
        // 排除网络 URL 和 data URL
        if (path.startsWith('http://') || 
            path.startsWith('https://') || 
            path.startsWith('data:') ||
            path.startsWith('blob:')) {
            return false;
        }
        // 检查是否为常见图片扩展名
        const ext = path.split('.').pop().toLowerCase();
        return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext);
    },

    // 尝试读取图片文件
    async tryReadImagePath(path) {
        // 从所有已打开的资源管理器实例的根目录中查找
        for (const instanceId in this.state) {
            const state = this.state[instanceId];
            if (state.rootHandle) {
                try {
                    const imageHandle = await this.findFileInDirectory(state.rootHandle, path);
                    if (imageHandle) {
                        const file = await imageHandle.getFile();
                        return file;
                    }
                } catch (e) {
                    // 继续尝试其他实例
                }
            }
        }
        return null;
    },

    // 在目录中递归查找文件
    async findFileInDirectory(dirHandle, filePath) {
        const parts = filePath.split('/').filter(p => p);
        
        let currentHandle = dirHandle;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLast = i === parts.length - 1;
            
            try {
                if (isLast) {
                    return await currentHandle.getFileHandle(part);
                } else {
                    currentHandle = await currentHandle.getDirectoryHandle(part);
                }
            } catch (e) {
                return null;
            }
        }
        return null;
    },

    // 读取图片文件
    async tryReadImageFile(path) {
        const file = await this.tryReadImagePath(path);
        if (file) {
            return file;
        }
        
        // 尝试直接在当前目录查找（简单文件名）
        for (const instanceId in this.state) {
            const state = this.state[instanceId];
            if (state.currentHandle) {
                try {
                    const fileName = path.split('/').pop();
                    const imageHandle = await state.currentHandle.getFileHandle(fileName);
                    return await imageHandle.getFile();
                } catch (e) {
                    // 尝试根目录
                    if (state.rootHandle && state.rootHandle !== state.currentHandle) {
                        try {
                            const fileName = path.split('/').pop();
                            const imageHandle = await state.rootHandle.getFileHandle(fileName);
                            return await imageHandle.getFile();
                        } catch (e2) {
                            // 继续
                        }
                    }
                }
            }
        }
        return null;
    },

    // 处理图片上传（拖拽或粘贴）
    async handleImageUpload(files, parentDir, editor) {
        const urls = [];
        for (const file of files) {
            const blobUrl = URL.createObjectURL(file);
            urls.push(blobUrl);
            // 插入图片到编辑器
            editor.insertValue(`![${file.name}](${blobUrl})`);
        }
        return urls;
    },

    // 保存 Markdown 文件
    async saveMarkdownFile(fileHandle, editor, tab) {
        try {
            let content = editor.getValue();
            
            // 将 Blob URL 还原为原始路径（简化处理）
            if (tab.blobUrls) {
                // 注意：这里简化处理，实际应该维护映射关系
                // 用户需要手动将 blob:xxx 替换回原始路径
            }

            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            
            tab.isDirty = false;
            alert('已保存: ' + fileHandle.name);
        } catch (e) {
            alert('保存失败: ' + e.message);
        }
    },

    // --- Monaco Editor 集成 (核心修复部分) ---

    async initMonaco(instanceId, container, fileHandle) {
        const state = this.state[instanceId];
        const tab = state.tabs.find(t => t.handle && t.handle.name === fileHandle.name);
        if (tab) {
            tab.editorType = 'monaco';
        }
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

                // 添加快捷键 Ctrl+E 导出指定行
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, () => {
                    this.showExportDialog(instanceId, editor, fileHandle.name);
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

    // --- 导出指定行范围功能 ---

    exportCurrentFile(instanceId) {
        const state = this.state[instanceId];
        if (!state) return;

        // 获取当前活动标签
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (!activeTab || activeTab.type !== 'editor') {
            alert('请先打开一个文件');
            return;
        }

        if (!activeTab.editorInstance) {
            alert('编辑器正在加载中，请稍后再试');
            return;
        }

        this.showExportDialog(instanceId, activeTab.editorInstance, activeTab.name);
    },

    showExportDialog(instanceId, editor, fileName) {
        // 检查是否已有对话框
        const existingDialog = document.getElementById(`export-dialog-${instanceId}`);
        if (existingDialog) existingDialog.remove();

        const lineCount = editor.getModel().getLineCount();
        
        // 创建对话框
        const dialog = document.createElement('div');
        dialog.id = `export-dialog-${instanceId}`;
        dialog.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(30, 30, 35, 0.95);
            border: 1px solid rgba(100, 200, 255, 0.3);
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 0 20px rgba(0, 150, 255, 0.3);
            z-index: 1000;
            min-width: 320px;
            backdrop-filter: blur(10px);
        `;

        dialog.innerHTML = `
            <div style="color: #00f0ff; font-size: 14px; font-weight: bold; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                <span>📤 导出日志行范围</span>
                <span style="cursor: pointer; color: #999; font-size: 18px;" onclick="this.closest('.export-dialog').remove()">&times;</span>
            </div>
            <div style="color: #aaa; font-size: 12px; margin-bottom: 10px;">
                文件共 ${lineCount} 行 | 快捷键: Ctrl+E
            </div>
            <div style="margin-bottom: 15px;">
                <div style="margin-bottom: 8px;">
                    <label style="color: #ccc; font-size: 12px;">起始行号:</label>
                    <input type="number" id="export-start-${instanceId}" min="1" max="${lineCount}" value="1"
                        style="width: 100%; padding: 8px; margin-top: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
                </div>
                <div>
                    <label style="color: #ccc; font-size: 12px;">结束行号:</label>
                    <input type="number" id="export-end-${instanceId}" min="1" max="${lineCount}" value="${lineCount}"
                        style="width: 100%; padding: 8px; margin-top: 4px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px; box-sizing: border-box;">
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="export-btn-${instanceId}" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #007acc, #005a9e); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    导出
                </button>
                <button onclick="document.getElementById('export-dialog-${instanceId}').remove()" style="padding: 8px 15px; background: #444; color: #ccc; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    取消
                </button>
            </div>
            <div id="export-error-${instanceId}" style="color: #ff6b6b; font-size: 11px; margin-top: 10px; display: none;"></div>
        `;

        // 添加类名便于选择器
        dialog.className = 'export-dialog';

        // 添加到编辑器容器
        const container = editor.getDomNode();
        if (container) {
            container.style.position = 'relative';
            container.appendChild(dialog);
        }

        // 绑定导出按钮事件
        const exportBtn = document.getElementById(`export-btn-${instanceId}`);
        exportBtn.onclick = () => {
            const startInput = document.getElementById(`export-start-${instanceId}`);
            const endInput = document.getElementById(`export-end-${instanceId}`);
            const errorDiv = document.getElementById(`export-error-${instanceId}`);

            const startLine = parseInt(startInput.value, 10);
            const endLine = parseInt(endInput.value, 10);

            // 验证输入
            if (isNaN(startLine) || isNaN(endLine)) {
                errorDiv.textContent = '请输入有效的行号';
                errorDiv.style.display = 'block';
                return;
            }

            if (startLine < 1 || endLine < 1) {
                errorDiv.textContent = '行号必须大于等于 1';
                errorDiv.style.display = 'block';
                return;
            }

            if (startLine > lineCount || endLine > lineCount) {
                errorDiv.textContent = `行号不能超过最大行数 ${lineCount}`;
                errorDiv.style.display = 'block';
                return;
            }

            if (startLine > endLine) {
                errorDiv.textContent = '起始行号不能大于结束行号';
                errorDiv.style.display = 'block';
                return;
            }

            // 执行导出
            this.exportLines(editor, fileName, startLine, endLine);
            dialog.remove();
        };

        // 自动聚焦到起始行输入框
        setTimeout(() => {
            const startInput = document.getElementById(`export-start-${instanceId}`);
            if (startInput) {
                startInput.focus();
                startInput.select();
            }
        }, 50);

        // 回车键提交
        dialog.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                exportBtn.click();
            }
        });
    },

    exportLines(editor, fileName, startLine, endLine) {
        try {
            const model = editor.getModel();
            let content = '';

            // 获取指定范围的行内容
            for (let i = startLine; i <= endLine; i++) {
                content += model.getLineContent(i);
                if (i < endLine) {
                    content += '\n';
                }
            }

            // 生成标题
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const title = `${baseName}_lines${startLine}-${endLine}_${timestamp}`;

            // 在新页面中打开内容
            const newWindow = window.open('', '_blank');
            if (newWindow) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html lang="zh-CN">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>${title}</title>
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body {
                                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                                background: #1e1e1e;
                                color: #d4d4d4;
                                padding: 20px;
                                line-height: 1.6;
                            }
                            .header {
                                position: fixed;
                                top: 0;
                                left: 0;
                                right: 0;
                                background: #252526;
                                border-bottom: 1px solid #333;
                                padding: 10px 20px;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                z-index: 100;
                            }
                            .header h1 {
                                font-size: 14px;
                                color: #00f0ff;
                                font-weight: normal;
                            }
                            .header .info {
                                font-size: 12px;
                                color: #888;
                            }
                            .content {
                                margin-top: 50px;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                                font-size: 13px;
                            }
                            .line-number {
                                color: #858585;
                                display: inline-block;
                                width: 50px;
                                text-align: right;
                                padding-right: 15px;
                                user-select: none;
                            }
                            .line-content {
                                color: #d4d4d4;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>📄 ${fileName} (第 ${startLine} 行 - 第 ${endLine} 行)</h1>
                            <span class="info">共 ${endLine - startLine + 1} 行 | ${timestamp}</span>
                        </div>
                        <div class="content"></div>
                        <script>
                            const lines = ${JSON.stringify(content.split('\n'))};
                            const startLine = ${startLine};
                            const contentDiv = document.querySelector('.content');
                            lines.forEach((line, index) => {
                                const lineNum = startLine + index;
                                const lineDiv = document.createElement('div');
                                lineDiv.innerHTML = '<span class="line-number">' + lineNum + '</span><span class="line-content">' + 
                                    line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
                                contentDiv.appendChild(lineDiv);
                            });
                        <\/script>
                    </body>
                    </html>
                `);
                newWindow.document.close();
                console.log(`已在新页面打开 ${fileName} 的第 ${startLine} 行到第 ${endLine} 行`);
            } else {
                alert('无法打开新窗口，请检查浏览器是否阻止了弹出窗口');
            }
        } catch (e) {
            console.error('导出失败:', e);
            alert('导出失败: ' + e.message);
        }
    },

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
                    <button onclick="FileExplorerApp.exportCurrentFile('${instanceId}')" style="margin-left: auto; margin-right: 10px;">📤 导出日志</button>
                    <button onclick="FileExplorerApp.toggleTerminal('${instanceId}')">💻 终端</button>
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
