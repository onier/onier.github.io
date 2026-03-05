/**
 * Monaco Editor 应用主文件
 * 从 monaco.html 中提取的 JavaScript 代码
 * 重构为模块化结构
 */

// 全局状态管理
const MonacoApp = (function() {
    // 私有变量
    const editors = [];
    let activeFileTargetIndex = -1;
    const filesMap = [];
    const editorDecorations = [];
    const editorDecorationsSelectIndexies = [];
    
    // 编辑器状态管理
    const editorStates = {
        1: { visible: true, container: null },
        2: { visible: true, container: null },
        3: { visible: true, container: null },
        4: { visible: true, container: null }
    };

    const editorSettings = {
        1: { showT0: true, showDelta: true, updateFn: null },
        2: { showT0: true, showDelta: true, updateFn: null },
        3: { showT0: true, showDelta: true, updateFn: null },
        4: { showT0: true, showDelta: true, updateFn: null }
    };

    // 公共API
    return {
        // 初始化函数
        init: function() {
            this.setupMonacoEnvironment();
            this.setupEventListeners();
            this.createEditors();
        },

        // 设置Monaco环境
        setupMonacoEnvironment: function() {
            require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@latest/min/vs' } });
            window.MonacoEnvironment = { getWorkerUrl: () => proxy };

            let proxy = URL.createObjectURL(new Blob([`
                self.MonacoEnvironment = { baseUrl: 'https://unpkg.com/monaco-editor@latest/min/' };
                importScripts('https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js');
            `], { type: 'text/javascript' }));
        },

        // 设置事件监听器
        setupEventListeners: function() {
            // 文件输入变化事件
            document.getElementById('global-file-input').addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file || activeFileTargetIndex === -1) return;
                MonacoApp.readFileToEditor(file, editors[activeFileTargetIndex - 1], activeFileTargetIndex);
            });

            // 过滤输入框回车事件
            document.getElementById('filter-input').addEventListener('keyup', function(event) {
                if (event.key === 'Enter') {
                    MonacoApp.applyFilter();
                }
            });

            // 窗口消息事件
            window.addEventListener('message', (event) => {
                const datas = event.data;
                if (!Array.isArray(datas)) return;

                datas.forEach(data => {
                    let file = data.file;
                    let enties = data.enties;

                    // 构造文本内容
                    let content = "";
                    enties.forEach(lineObj => {
                        content += lineObj.line + "\n";
                    });

                    // 获取编辑器索引
                    const editorIndex = filesMap[file];
                    if (editorIndex !== undefined && editors[editorIndex]) {
                        // 更新标题
                        MonacoApp.updateEditorTitle(editorIndex + 1, file);

                        // 设置内容
                        editors[editorIndex].setValue(content);

                        // 自动触发全部折叠
                        setTimeout(() => {
                            editors[editorIndex].trigger('fold', 'editor.foldAll');
                        }, 300);
                    }
                });
            });

            // 页面加载完成事件
            window.onload = function() {
                const params = new URLSearchParams(window.location.search);
                ['file1', 'file2', 'file3', 'file4'].forEach((key, i) => {
                    const url = params.get(key);
                    if (url) filesMap[url] = i;
                });
                if (window.opener) {
                    window.opener.postMessage("ready", '*');
                }
            };
        },

        // 创建编辑器
        createEditors: function() {
            require(["vs/editor/editor.main"], () => {
                this.registerFoldingProvider();
                this.createLogEditor('container-1', 1, "");
                this.createLogEditor('container-2', 2, "");
                this.createLogEditor('container-3', 3, "");
                this.createLogEditor('container-4', 4, "");
                this.updateLayout();
            });
        },

        // 注册折叠提供者
        registerFoldingProvider: function() {
            monaco.languages.registerFoldingRangeProvider('plaintext', {
                provideFoldingRanges: function(model, context, token) {
                    const resultRanges = [];
                    const result = LogAnalyzer.run(model);
                    const lineCount = model.getLineCount();
                    let milestones = [];
                    
                    for (let i = 1; i <= lineCount; i++) {
                        const lineContent = model.getLineContent(i);
                        const isMilestone = checkKeyWords(lineContent.toLowerCase());
                        if (isMilestone) {
                            milestones.push(i);
                        }
                    }
                    
                    for (let i = 0; i < result.count; i++) {
                        let decoration = result.decorations[i];
                        milestones.push(decoration.range.startLineNumber);
                    }
                    
                    milestones.sort(function(a, b) { return a - b; });
                    
                    if (milestones.length > 0) {
                        if (milestones[0] > 1) {
                            resultRanges.push({
                                start: 1,
                                end: milestones[0] - 1,
                                kind: monaco.languages.FoldingRangeKind.Region
                            });
                        }
                        
                        for (let j = 0; j < milestones.length - 1; j++) {
                            const startLine = milestones[j];
                            const nextLine = milestones[j + 1];
                            if (nextLine > startLine + 1) {
                                resultRanges.push({
                                    start: startLine,
                                    end: nextLine - 1,
                                    kind: monaco.languages.FoldingRangeKind.Region
                                });
                            }
                        }
                        
                        const lastMilestone = milestones[milestones.length - 1];
                        if (lastMilestone < lineCount) {
                            resultRanges.push({
                                start: lastMilestone,
                                end: lineCount,
                                kind: monaco.languages.FoldingRangeKind.Region
                            });
                        }
                    }

                    return resultRanges;
                }
            });
        },

        // 创建日志编辑器
        createLogEditor: function(containerId, editorIndex, initialContent) {
            const container = document.getElementById(containerId);
            const toolbar = document.createElement('div');
            toolbar.className = 'editor-mini-toolbar';

            toolbar.innerHTML = `
                <span id="title-${editorIndex}" class="editor-title" title="Editor ${editorIndex}">Editor ${editorIndex}</span>
                <div id="warning-badge-${editorIndex}" class="warning-badge" title="当前警告数量" onclick="MonacoApp.jumpToNextWarning(${editorIndex})">
                    <span class="warning-icon">⚠️</span>
                    <span id="warning-count-${editorIndex}">0</span>
                </div>
                <button id="btn-t0-${editorIndex}" class="mini-toggle active" title="显示距开始时间" onclick="MonacoApp.toggleLocalTimeDisplay(${editorIndex}, 't0')">T0</button>
                <button id="btn-delta-${editorIndex}" class="mini-toggle active" title="显示距上一行时间" onclick="MonacoApp.toggleLocalTimeDisplay(${editorIndex}, 'delta')">Δ</button>

                <div class="mini-separator"></div>

                <div class="toolbar-dropdown">
                    <button class="mini-btn dropdown-btn">\u22EE 操作</button>
                    
                    <div class="dropdown-content">
                        <div class="dropdown-item" onclick="MonacoApp.triggerOpenFile(${editorIndex})">
                            <span>\uD83D\uDCC2</span> 打开文件
                        </div>
                        <div class="dropdown-item" onclick="MonacoApp.triggerSaveFile(${editorIndex})">
                            <span>\uD83D\uDCBE</span> 保存文件
                        </div>
                        <div class="dropdown-divider"></div>
                        <div class="dropdown-item" onclick="MonacoApp.triggerFoldAll(${editorIndex})">
                            <span>\u229F</span> 全部折叠
                        </div>
                        <div class="dropdown-item" onclick="MonacoApp.triggerUnfoldAll(${editorIndex})">
                            <span>\u229E</span> 全部展开
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(toolbar);

            const modelUri = monaco.Uri.parse(`inmemory://logs/editor-${editorIndex}`);
            const model = monaco.editor.createModel(initialContent, 'plaintext', modelUri);

            const editor = monaco.editor.create(container, {
                model: model,
                language: 'plaintext',
                theme: 'vs',
                lineNumbers: 'on',
                lineDecorationsWidth: 150,
                lineNumbersMinChars: 3,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                folding: true,
                glyphMargin: true,
                foldingStrategy: 'auto'
            });

            editorStates[editorIndex].container = container;

            // 拖拽事件
            container.addEventListener('dragover', (e) => {
                e.preventDefault(); e.stopPropagation();
                container.classList.add('drag-active');
            });
            
            container.addEventListener('dragleave', (e) => {
                e.preventDefault(); e.stopPropagation();
                container.classList.remove('drag-active');
            });
            
            container.addEventListener('drop', (e) => {
                e.preventDefault(); e.stopPropagation();
                container.classList.remove('drag-active');
                const files = e.dataTransfer.files;
                if (files.length > 0) this.readFileToEditor(files[0], editor, editorIndex);
            });

            const styleElement = document.createElement('style');
            document.head.appendChild(styleElement);
            let oldDecorations = [];

            // 更新时间差显示
            const updateTimeDiff = () => {
                const model = editor.getModel();
                if (!model) return;
                
                const result = LogAnalyzer.run(editor.getModel());
                let warnId = "warning-count-" + editorIndex;
                document.getElementById(warnId).textContent = result.count;
                
                const settings = editorSettings[editorIndex];
                let requiredWidth = 10;
                if (settings.showT0 && settings.showDelta) requiredWidth = 150;
                else if (settings.showT0 || settings.showDelta) requiredWidth = 80;
                
                editor.updateOptions({ lineDecorationsWidth: requiredWidth });

                if (!settings.showT0 && !settings.showDelta) {
                    oldDecorations = editor.deltaDecorations(oldDecorations, []);
                    styleElement.innerHTML = "";
                    return;
                }
                
                let lineTimes = calculatelineTime(model);
                const lineCount = model.getLineCount();
                const decorations = [];
                let cssRules = "";
                let firstTime = null;
                let lastTime = null;

                for (let i = 1; i <= lineCount; i++) {
                    const lineContent = model.getLineContent(i);
                    let timeInfo = getTimeByLine(lineTimes, i);

                    if (timeInfo !== null) {
                        const currentTime = timeInfo.currentTime;
                        if (firstTime === null) firstTime = currentTime;
                        
                        let displayParts = [];
                        let isLong = false;
                        
                        if (settings.showT0) {
                            const diffFromStart = currentTime - firstTime;
                            displayParts.push(`T${formatDuration(diffFromStart, true)}`);
                        }
                        
                        if (settings.showDelta) {
                            let deltaText = "Start";
                            if (lastTime !== null) {
                                const diff = currentTime - lastTime;
                                deltaText = formatDuration(diff);
                                if (Math.abs(diff) >= 1000)
                                    isLong = true;
                            }
                            displayParts.push(deltaText);
                        }
                        
                        const displayText = displayParts.join(' | ');
                        const uniqueClass = `diff-e${editorIndex}-l${i}`;
                        const colorClass = (isLong || timeInfo.isShift) ? 'time-diff-long' : '';
                        const cssWidth = requiredWidth - 10;
                        
                        cssRules += `.${uniqueClass}::after { content: "${displayText}"; width: ${cssWidth}px; }\n`;
                        decorations.push({
                            range: new monaco.Range(i, 1, i, 1),
                            options: { isWholeLine: true, linesDecorationsClassName: `time-diff-gutter ${colorClass} ${uniqueClass}` }
                        });
                        
                        lastTime = currentTime;
                    }
                }
                
                styleElement.innerHTML = cssRules;
                
                result.decorations.forEach(decoration => {
                    decorations.push(decoration);
                    decorations.push({
                        range: decoration.range,
                        isWholeLine: true,
                        options: decoration.options
                    });
                });
                
                editorDecorations[editorIndex] = result.decorations;
                oldDecorations = editor.deltaDecorations(oldDecorations, decorations);
            };

            editorSettings[editorIndex].updateFn = updateTimeDiff;
            updateTimeDiff();
            editor.onDidChangeModelContent(() => setTimeout(updateTimeDiff, 100));
            editors.push(editor);
            
            return editor;
        },

        // 更新布局
        updateLayout: function() {
            const visibleIds = Object.keys(editorStates).filter(k => editorStates[k].visible);
            const count = visibleIds.length;
            
            visibleIds.forEach((id, index) => {
                const container = document.getElementById(`container-${id}`);
                let width = '50%';
                let height = '50%';
                
                if (count === 1) { width = '100%'; height = '100%'; }
                else if (count === 2) { width = '50%'; height = '100%'; }
                else if (count === 3) {
                    if (index < 2) { width = '50%'; height = '50%'; }
                    else { width = '100%'; height = '50%'; }
                }
                else if (count === 4) { width = '50%'; height = '50%'; }
                
                container.style.width = width;
                container.style.height = height;
            });
        },

        // 切换编辑器显示
        toggleEditor: function(id) {
            const state = editorStates[id];
            state.visible = !state.visible;
            const btn = document.querySelectorAll('.toggle-group:first-child .toggle-btn')[id - 1];
            
            if (state.visible) btn.classList.add('active');
            else btn.classList.remove('active');
            
            const container = document.getElementById(`container-${id}`);
            if (state.visible) container.classList.remove('hidden');
            else container.classList.add('hidden');
            
            this.updateLayout();
        },

        // 切换本地时间显示
        toggleLocalTimeDisplay: function(editorIndex, type) {
            const settings = editorSettings[editorIndex];
            if (type === 't0') {
                settings.showT0 = !settings.showT0;
                const btn = document.getElementById(`btn-t0-${editorIndex}`);
                settings.showT0 ? btn.classList.add('active') : btn.classList.remove('active');
            } else if (type === 'delta') {
                settings.showDelta = !settings.showDelta;
                const btn = document.getElementById(`btn-delta-${editorIndex}`);
                settings.showDelta ? btn.classList.add('active') : btn.classList.remove('active');
            }
            
            if (settings.updateFn) settings.updateFn();
        },

        // 应用过滤
        applyFilter: function() {
            const input = document.getElementById('filter-input');
            const regexStr = input.value;
            let regex = null;

            if (regexStr && regexStr.trim() !== "") {
                try {
                    regex = new RegExp(regexStr, 'i');
                    input.classList.remove('error');
                } catch (e) {
                    input.classList.add('error');
                    return;
                }
            } else {
                input.classList.remove('error');
            }

            editors.forEach(editor => {
                const model = editor.getModel();
                if (!model) return;

                if (!regex) {
                    editor.setHiddenAreas([]);
                    return;
                }

                const lineCount = model.getLineCount();
                const hiddenRanges = [];
                let startHideLine = -1;

                for (let i = 1; i <= lineCount; i++) {
                    const lineContent = model.getLineContent(i);
                    const isMatch = regex.test(lineContent);

                    if (!isMatch) {
                        if (startHideLine === -1) startHideLine = i;
                    } else {
                        if (startHideLine !== -1) {
                            hiddenRanges.push(new monaco.Range(startHideLine, 1, i - 1, 1));
                            startHideLine = -1;
                        }
                    }
                }
                
                if (startHideLine !== -1) {
                    hiddenRanges.push(new monaco.Range(startHideLine, 1, lineCount, 1));
                }

                editor.setHiddenAreas(hiddenRanges);
            });
        },

        // 读取文件到编辑器
        readFileToEditor: function(file, editor, index) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target.result;
                if (editor) {
                    editor.setValue(content);
                    if (index) MonacoApp.updateEditorTitle(index, file.name);
                    setTimeout(() => {
                        MonacoApp.applyFilter();
                        editor.trigger('fold', 'editor.foldAll');
                    }, 300);
                }
            };
            reader.readAsText(file);
        },

        // 更新编辑器标题
        updateEditorTitle: function(index, title) {
            const titleEl = document.getElementById(`title-${index}`);
            if (titleEl) {
                titleEl.textContent = title;
                titleEl.title = title;
            }
        },

        // 触发打开文件
        triggerOpenFile: function(index) {
            activeFileTargetIndex = index;
            document.getElementById('global-file-input').value = '';
            document.getElementById('global-file-input').click();
        },

        // 触发保存文件
        triggerSaveFile: function(index) {
            const editor = editors[index - 1];
            if (!editor) return;
            
            const content = editor.getValue();
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `editor-${index}-log.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },

        // 触发全部折叠
        triggerFoldAll: function(index) {
            const editor = editors[index - 1];
            if (!editor) return;
            editor.trigger('fold', 'editor.foldAll');
        },

        // 触发全部展开
        triggerUnfoldAll: function(index) {
            const editor = editors[index - 1];
            if (!editor) return;
            editor.trigger('unfold', 'editor.unfoldAll');
        },

        // 跳转到下一个警告
        jumpToNextWarning: function(editorIndex) {
            let editor = editors[editorIndex - 1];
            if (editorDecorationsSelectIndexies[editorIndex] == undefined) {
                editorDecorationsSelectIndexies[editorIndex] = 0;
            }
            
            let decoration = editorDecorations[editorIndex][editorDecorationsSelectIndexies[editorIndex]];
            if (decoration == undefined) {
                editorDecorationsSelectIndexies[editorIndex] = 0;
                return;
            } else {
                if (decoration) {
                    const line = decoration.range.startLineNumber;
                    editor.setPosition({ lineNumber: line, column: 1 });
                    editor.revealLineInCenter(line);
                    editorDecorationsSelectIndexies[editorIndex] = editorDecorationsSelectIndexies[editorIndex] + 1;
                }
            }
        },

        // 解析日志时间戳（从原monaco.html中提取）
        parseLogTimestamp: function(lineContent) {
            const patterns = [
                { regex: /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/, type: 'standard' },
                { regex: /(\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/, type: 'slash' },
                { regex: /(\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)/, type: 'no-year' },
                { regex: /([A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})/, type: 'syslog' }
            ];
            
            for (let p of patterns) {
                const match = lineContent.match(p.regex);
                if (match) {
                    let dateStr = match[1].replace(',', '.');
                    if (p.type === 'no-year') dateStr = new Date().getFullYear() + '-' + dateStr;
                    const ts = Date.parse(dateStr);
                    if (!isNaN(ts)) return ts;
                }
            }
            return null;
        },

        // 格式化持续时间（从原monaco.html中提取）
        formatDuration: function(ms, isTotal = false) {
            const abs = Math.abs(ms);
            const sign = ms >= 0 ? '+' : '';
            
            if (abs < 1000) return `${sign}${ms}ms`;
            else if (abs < 60000) return `${sign}${(ms / 1000).toFixed(2)}s`;
            else {
                const m = Math.floor(abs / 60000);
                const s = ((abs % 60000) / 1000).toFixed(1);
                return `${sign}${m}m${s}s`;
            }
        }
    };
})();

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    MonacoApp.init();
});

// 暴露必要的函数到全局作用域，供HTML内联事件调用
window.toggleEditor = function(id) {
    MonacoApp.toggleEditor(id);
};

window.applyFilter = function() {
    MonacoApp.applyFilter();
};
