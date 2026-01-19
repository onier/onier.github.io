/**
 * js/apps/files.js
 * 资源管理器 - 集成终端版
 */

const FileExplorerApp = {
    state: {},

    initState(instanceId) {
        this.state[instanceId] = {
            rootHandle: null,
            currentHandle: null,
            path: [],
            shellInstance: null // 存储该窗口的 Shell 实例
        };
    },

    // 1. 入口：选择根目录
    async openRoot(instanceId) {
        // 检查 File System Access API 是否可用
        if (!window.showDirectoryPicker) {
            alert('您的浏览器不支持文件系统访问API。请使用Chrome 86+、Edge 86+或Opera 72+，并确保在HTTPS或localhost环境下运行。');
            return;
        }
        
        try {
            const dirHandle = await window.showDirectoryPicker();
            const state = this.state[instanceId];
            
            state.rootHandle = dirHandle;
            state.currentHandle = dirHandle;
            
            // 重置 UI
            const treeContainer = document.getElementById(`fm-tree-${instanceId}`);
            treeContainer.innerHTML = ''; 
            await this.appendTreeNode(instanceId, treeContainer, dirHandle, 0);
            await this.loadRightPanel(instanceId, dirHandle);
            
            // 如果终端已打开，销毁旧的并提示重新打开，或者直接重置
            // 简单起见：如果切换了根目录，我们销毁旧终端实例
            if (state.shellInstance) {
                state.shellInstance.term.dispose(); // 销毁 Xterm
                state.shellInstance = null;
                document.getElementById(`fm-term-body-${instanceId}`).innerHTML = '';
                // 如果面板是开着的，自动重新初始化
                const panel = document.getElementById(`fm-term-panel-${instanceId}`);
                if (panel.style.display !== 'none') {
                    // 稍微延时等待 DOM
                    setTimeout(() => {
                         state.shellInstance = new window.WebShell(
                             document.getElementById(`fm-term-body-${instanceId}`), 
                             dirHandle, 
                             '/'
                         );
                    }, 100);
                }
            }

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err);
                alert('选择目录时出错: ' + err.message);
            }
        }
    },

    // 2. 左侧树：构建节点
    async appendTreeNode(instanceId, container, dirHandle, level) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'tree-node';
        
        const rowDiv = document.createElement('div');
        rowDiv.className = 'tree-row';
        rowDiv.style.paddingLeft = `${level * 16}px`;
        rowDiv.innerHTML = `<span class="tree-arrow">▶</span><span class="tree-icon">📁</span><span>${dirHandle.name}</span>`;
        
        const arrowSpan = rowDiv.querySelector('.tree-arrow');
        const childrenDiv = document.createElement('div');
        childrenDiv.style.display = 'none';
        nodeDiv.appendChild(rowDiv);
        nodeDiv.appendChild(childrenDiv);
        container.appendChild(nodeDiv);
        
        arrowSpan.onclick = (e) => {
            e.stopPropagation();
            this.toggleTreeExpand(instanceId, arrowSpan, childrenDiv, dirHandle, level + 1);
        };
        
        rowDiv.onclick = () => {
            // 移除其他选中状态
            const allRows = document.querySelectorAll(`#fm-tree-${instanceId} .tree-row`);
            allRows.forEach(r => r.classList.remove('selected'));
            rowDiv.classList.add('selected');

            this.loadRightPanel(instanceId, dirHandle);
        };
    },

    // 3. 左侧树：展开/折叠逻辑
    async toggleTreeExpand(instanceId, arrow, container, handle, level) {
        if(arrow.innerHTML === '▶') {
            arrow.innerHTML = '▼'; 
            container.style.display = 'block';
            if(container.innerHTML === '') {
                for await (const entry of handle.values()) {
                    if(entry.kind === 'directory') {
                        await this.appendTreeNode(instanceId, container, entry, level);
                    }
                }
            }
        } else {
            arrow.innerHTML = '▶'; 
            container.style.display = 'none';
        }
    },

    // 4. 右侧列表：加载内容
    async loadRightPanel(instanceId, dirHandle) {
        const tbody = document.getElementById(`fm-tbody-${instanceId}`);
        tbody.innerHTML = '';
        this.state[instanceId].currentHandle = dirHandle;
        
        for await (const entry of dirHandle.values()) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${entry.kind === 'directory' ? '📁' : '📄'} ${entry.name}</td><td>-</td><td>${entry.kind}</td><td>-</td>`;
            tbody.appendChild(tr);
        }
    },

    // 5. 终端控制逻辑
    toggleTerminal(instanceId) {
        const panel = document.getElementById(`fm-term-panel-${instanceId}`);
        const body = document.getElementById(`fm-term-body-${instanceId}`);
        const state = this.state[instanceId];

        if (!panel) return;

        // 切换显示状态
        if (panel.style.display === 'none') {
            // 显示
            panel.style.display = 'flex';
            
            // 如果还没初始化 Shell，则初始化
            if (!state.shellInstance) {
                if (!state.currentHandle) {
                    body.innerHTML = '<div style="color:#999;padding:10px;">请先选择根目录...</div>';
                    return;
                }

                // 清空占位符
                body.innerHTML = '';
                
                // 实例化 WebShell，传入当前目录句柄
                // 使用当前文件夹名作为路径标签
                const pathLabel = state.currentHandle.name === state.rootHandle.name ? '/' : `/${state.currentHandle.name}`;
                
                state.shellInstance = new window.WebShell(body, state.currentHandle, pathLabel);
            } else {
                // 如果已经存在，重新适配大小 (因为从 display:none 变过来需要 fit)
                state.shellInstance.fit();
                state.shellInstance.term.focus();
            }
        } else {
            // 隐藏
            panel.style.display = 'none';
        }
    }
};

// 注册应用
DesktopSystem.registerApp({
    id: 'files',
    title: '资源管理器',
    icon: '📂',
    type: 'html',
    width: '850px',
    height: '600px',
    
    content: (instanceId) => {
        FileExplorerApp.initState(instanceId);
        return `
            <div class="fm-layout">
                <!-- 工具栏 -->
                <div class="fm-toolbar">
                    <button onclick="FileExplorerApp.openRoot('${instanceId}')">📂 根目录</button>
                    <!-- 切换终端按钮 -->
                    <button onclick="FileExplorerApp.toggleTerminal('${instanceId}')" style="margin-left:auto;">
                        💻 终端
                    </button>
                </div>

                <!-- 主体 -->
                <div class="fm-body">
                    <!-- 左侧树 -->
                    <div class="fm-tree-panel" id="fm-tree-${instanceId}"></div>

                    <!-- 右侧面板 (包含列表 + 终端) -->
                    <div class="fm-right-panel">
                        <!-- 上半部分：列表 -->
                        <div class="fm-list-panel">
                            <table class="fm-table">
                                <thead>
                                    <tr>
                                        <th>名称</th><th>日期</th><th>类型</th><th>大小</th>
                                    </tr>
                                </thead>
                                <tbody id="fm-tbody-${instanceId}"></tbody>
                            </table>
                        </div>

                        <!-- 下半部分：嵌入式终端 -->
                        <div class="fm-term-panel" id="fm-term-panel-${instanceId}" style="display: none;">
                            <div class="fm-term-header">
                                <span>终端 (Local)</span>
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
