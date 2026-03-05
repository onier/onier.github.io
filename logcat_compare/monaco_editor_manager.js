/**
 * Monaco Editor 管理器
 * 包含完整的Monaco Editor初始化、装饰功能和更新逻辑
 * 从index.html迁移而来，提供更好的代码组织
 */

class MonacoEditorManager {
    constructor() {
        console.log('Monaco Editor 管理器已创建');
        
        // 编辑器实例
        this.editor1 = null;
        this.editor2 = null;
        
        // 初始化
        this.initMonacoEditor();
    }
    
    /**
     * 初始化 Monaco Editor
     */
    initMonacoEditor() {
        // 配置 Monaco Editor 的路径
        require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@latest/min/vs' }});
        
        // 配置 MonacoEnvironment
        window.MonacoEnvironment = {
            getWorkerUrl: () => this.proxy
        };

        // 创建 worker proxy
        this.proxy = URL.createObjectURL(new Blob([`
            self.MonacoEnvironment = { baseUrl: 'https://unpkg.com/monaco-editor@latest/min/' };
            importScripts('https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js');
        `], { type: 'text/javascript' }));

        // 加载并初始化 Monaco Editor
        require(["vs/editor/editor.main"], () => {
            console.log('Monaco Editor 加载成功，开始初始化编辑器...');
            
            // 初始化第一个编辑器
            this.initEditor(1);
            
            // 初始化第二个编辑器
            this.initEditor(2);
            
            // 添加CSS样式
            this.addStyles();
            
            console.log('Monaco Editor 初始化全部完成！');
        });
    }
    
    /**
     * 初始化单个编辑器
     */
    initEditor(chartNum) {
        const containerId = `monacoEditorContainer${chartNum}`;
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.error(`找不到 ${containerId} 元素`);
            return;
        }
        
        const editor = monaco.editor.create(container, {
            value: '请选择文件或拖拽选择范围以显示日志...\n\n提示：\n1. 从上方选择文件\n2. 在时序图上拖拽选择范围\n3. 使用过滤功能筛选日志',
            language: 'plaintext',
            theme: 'vs-light',
            readOnly: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 12,
            fontFamily: "'Courier New', monospace",
            lineHeight: 18,
            automaticLayout: true,
            folding: true,
            foldingStrategy: 'indentation',
            renderLineHighlight: 'all',
            scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false,
                verticalScrollbarSize: 12,
                horizontalScrollbarSize: 12,
                arrowSize: 30
            }
        });
        
        // 保存编辑器实例
        if (chartNum === 1) {
            this.editor1 = editor;
        } else {
            this.editor2 = editor;
        }
        
        // 添加双击复制功能
        editor.onMouseDown((e) => {
            if (e.event.detail === 2) {
                const position = e.target.position;
                if (position) {
                    const lineNumber = position.lineNumber;
                    const lineContent = editor.getModel().getLineContent(lineNumber);
                    navigator.clipboard.writeText(lineContent).then(() => {
                        console.log(`已复制第 ${lineNumber} 行到剪贴板`);
                    });
                }
            }
        });
        
        console.log(`图表${chartNum} Monaco Editor 初始化完成`);
    }
    
    /**
     * 添加CSS样式
     */
    addStyles() {
        // 定义日志级别和时间差装饰的CSS样式
        const style = document.createElement('style');
        style.textContent = `
            .log-level-e, .log-level-error {
                background-color: rgba(220, 53, 69, 0.08) !important;
                color: #dc3545 !important;
            }
            .log-level-w, .log-level-warning {
                background-color: rgba(255, 193, 7, 0.08) !important;
                color: #856404 !important;
            }
            .log-level-i, .log-level-info {
                background-color: rgba(13, 202, 240, 0.05) !important;
                color: #0c5460 !important;
            }
            .log-level-d, .log-level-debug {
                background-color: rgba(108, 117, 125, 0.05) !important;
                color: #383d41 !important;
            }
            .log-level-v, .log-level-verbose {
                background-color: rgba(111, 66, 193, 0.05) !important;
                color: #6f42c1 !important;
            }
            
            /* 时间差装饰样式 */
            .time-gap-decoration {
                color: #6c757d !important; /* 灰色文字 */
                font-size: 0.85em !important;
                font-weight: bold !important;
                background-color: rgba(108, 117, 125, 0.1) !important;
                padding: 1px 4px !important;
                border-radius: 3px !important;
                margin-right: 8px !important;
                border: 1px solid rgba(108, 117, 125, 0.2) !important;
            }
            
            /* 鼠标悬停效果 */
            .time-gap-decoration:hover {
                background-color: rgba(108, 117, 125, 0.2) !important;
                border-color: rgba(108, 117, 125, 0.4) !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 更新编辑器内容
     */
    updateEditorContent(chartNum, entries) {
        const editor = chartNum === 1 ? this.editor1 : this.editor2;
        const infoElement = document.getElementById(`logInfo${chartNum}`);
        
        if (!editor) {
            console.error(`图表${chartNum}编辑器未初始化`);
            return;
        }
        
        if (!entries || entries.length === 0) {
            editor.setValue('没有日志数据...');
            if (infoElement) {
                infoElement.innerHTML = '<i class="bi bi-info-circle me-1"></i>请选择文件或拖拽选择范围以显示日志';
            }
            return;
        }
        
        // 获取过滤状态，判断是否显示原始过滤
        let showRawLine = false;
        if (window.logcatComparisonManager) {
            const filterState = chartNum === 1 ? window.logcatComparisonManager.filterState1 : window.logcatComparisonManager.filterState2;
            showRawLine = filterState ? filterState.showRawLine : false;
        }
        
        // 生成显示文本
        let text = '';
        const lineGapMap = new Map(); // 行号到时间差的映射
        
        entries.forEach((entry, index) => {
            const lineNumber = index + 1;
            
            // 计算时间差
            const gap = this.calculateGap(entry);
            
            // 保存行号到时间差的映射
            lineGapMap.set(lineNumber, gap);
            
            // 根据showRawLine选项选择显示原始行还是过滤后的行
            const lineContent = showRawLine ? `${entry.rawLine || ''}` : `${entry.line || ''}`;
            text += lineContent + '\n';
        });
        
        // 设置编辑器内容
        editor.setValue(text);
        
        // 保存时间差映射到编辑器实例
        if (chartNum === 1) {
            this.lineGapMap1 = lineGapMap;
        } else {
            this.lineGapMap2 = lineGapMap;
        }
        
        // 更新行号显示，在行号区显示时间差
        this.updateLineNumbersWithGap(editor, chartNum, lineGapMap);
        
        // 应用日志级别颜色装饰
        this.applyLevelColorDecorations(editor, entries);
        
        // 更新信息显示
        if (infoElement) {
            infoElement.innerHTML = `<i class="bi bi-info-circle me-1"></i>显示 ${entries.length} 条日志`;
        }
        
        console.log(`图表${chartNum}编辑器内容已更新: ${entries.length} 条记录，时间差已显示在行号区`);
    }
    
    /**
     * 计算时间差
     */
    calculateGap(entry) {
        let gapValue = entry.logTimeFromBaseTimeGap;
        
        // // 检查所有可能的时间差字段
        // if (entry.logTimeFromBaseTimeGap !== undefined && entry.logTimeFromBaseTimeGap !== null) {
        //     gapValue = entry.logTimeFromBaseTimeGap;
        // } else if (entry.gapDiff !== undefined && entry.gapDiff !== null) {
        //     gapValue = entry.gapDiff;
        // } else if (entry.logTimeFromBaseTime !== undefined && entry.logTimeFromBaseTime !== null) {
        //     gapValue = entry.logTimeFromBaseTime;
        // }
        
        if (gapValue !== null) {
            return (gapValue / 1000).toFixed(3) + 's';
        }
        
        return '0.000s';
    }
    
    /**
     * 更新行号显示，在行号区显示时间差
     */
    updateLineNumbersWithGap(editor, chartNum, lineGapMap) {
        // 获取对应的时间差映射
        const gapMap = chartNum === 1 ? this.lineGapMap1 : this.lineGapMap2;
        
        // 更新行号显示函数
        editor.updateOptions({
            lineNumbers: (lineNumber) => {
                const gap = gapMap ? gapMap.get(lineNumber) : '0.000s';
                // 在行号后面显示时间差，格式：行号 [时间差]
                return `${lineNumber} [${gap}]`;
            },
            lineNumbersMinChars: 15 // 增加最小字符数，确保有足够空间显示时间差
        });
        
        console.log(`图表${chartNum}行号显示已更新，包含时间差信息`);
    }
    
    /**
     * 应用日志级别颜色装饰
     */
    applyLevelColorDecorations(editor, entries) {
        const decorations = [];
        
        // 获取过滤状态，判断是否显示原始过滤
        let showRawLine = false;
        if (window.logcatComparisonManager) {
            // 这里需要知道是哪个图表，但applyLevelColorDecorations没有chartNum参数
            // 我们可以通过editor实例来判断
            const chartNum = editor === this.editor1 ? 1 : 2;
            const filterState = chartNum === 1 ? window.logcatComparisonManager.filterState1 : window.logcatComparisonManager.filterState2;
            showRawLine = filterState ? filterState.showRawLine : false;
        }
        
        entries.forEach((entry, index) => {
            const lineNumber = index + 1;
            // 根据showRawLine选项选择使用原始行还是过滤后的行
            const lineContent = showRawLine ? `${entry.rawLine || ''}` : `${entry.line || ''}`;
            const level = entry.level || '';
            
            // 根据日志级别添加颜色装饰
            decorations.push({
                range: new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1),
                options: {
                    inlineClassName: `log-level-${level.toLowerCase()}`,
                    isWholeLine: true
                }
            });
        });
        
        // 清除之前的装饰
        const model = editor.getModel();
        const oldDecorations = editor.getDecorationsInRange(new monaco.Range(1, 1, model.getLineCount(), 1));
        if (oldDecorations) {
            editor.deltaDecorations(oldDecorations.map(d => d.id), []);
        }
        
        // 应用新的装饰
        if (decorations.length > 0) {
            editor.deltaDecorations([], decorations);
            console.log(`已应用 ${decorations.length} 个级别颜色装饰`);
        }
    }
    
    /**
     * 工具函数：日期计算
     */
    add(date, num, unit = 'day') {
        const d = new Date(date);
        switch (unit) {
            case 'year': d.setFullYear(d.getFullYear() + num); break;
            case 'month': d.setMonth(d.getMonth() + num); break;
            case 'day': d.setDate(d.getDate() + num); break;
            case 'hour': d.setHours(d.getHours() + num); break;
            case 'minute': d.setMinutes(d.getMinutes() + num); break;
            case 'second': d.setSeconds(d.getSeconds() + num); break;
            case 'ms': d.setMilliseconds(d.getMilliseconds() + num); break;
            default: throw new Error('unit 不支持');
        }
        return d;
    }
    
    /**
     * 工具函数：格式化日期
     */
    formatDateLikeLogcat(date = new Date()) {
        const pad = (n) => n.toString().padStart(2, '0');
        const padMs = (n) => n.toString().padStart(3, '0');

        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hour = pad(date.getHours());
        const min = pad(date.getMinutes());
        const sec = pad(date.getSeconds());
        const ms = padMs(date.getMilliseconds());

        return `${month}-${day} ${hour}:${min}:${sec}.${ms}`;
    }
}

// 创建全局实例
let monacoEditorManager = null;

// 初始化函数
function initMonacoEditorManager() {
    if (!monacoEditorManager) {
        monacoEditorManager = new MonacoEditorManager();
        window.monacoEditorManager = monacoEditorManager;
        
        // 创建全局更新函数供其他模块调用
        window.updateMonacoEditorContent = function(chartNum, entries) {
            if (window.monacoEditorManager) {
                window.monacoEditorManager.updateEditorContent(chartNum, entries);
            } else {
                console.error('Monaco Editor 管理器未初始化');
            }
        };
        
        console.log('Monaco Editor 管理器已初始化');
    }
    return monacoEditorManager;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMonacoEditorManager);
} else {
    initMonacoEditorManager();
}

// 导出函数，供其他模块调用
window.initMonacoEditorManager = initMonacoEditorManager;
