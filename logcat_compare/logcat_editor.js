/**
 * Logcat 编辑器
 * 管理Logcat日志的Monaco Editor显示
 * 只负责图表1的编辑器（monacoEditorContainer1）
 */

class LogcatEditor {
    constructor() {
        console.log('Logcat 编辑器已创建');
        
        // 编辑器实例（只管理图表1的编辑器）
        this.editor = null;
        
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
            console.log('Monaco Editor 加载成功，开始初始化Logcat编辑器...');
            
            // 初始化Logcat编辑器（图表1）
            this.initEditor();
            
            // 添加CSS样式
            this.addStyles();
            
            console.log('Logcat 编辑器初始化完成！');
        });
    }
    
    /**
     * 初始化Logcat编辑器（图表1）
     */
    initEditor() {
        const containerId = 'monacoEditorContainer1';
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.error(`找不到 ${containerId} 元素`);
            return;
        }
        
        this.editor = monaco.editor.create(container, {
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
        
        // 添加双击复制功能
        this.editor.onMouseDown((e) => {
            if (e.event.detail === 2) {
                const position = e.target.position;
                if (position) {
                    const lineNumber = position.lineNumber;
                    const lineContent = this.editor.getModel().getLineContent(lineNumber);
                    navigator.clipboard.writeText(lineContent).then(() => {
                        console.log(`已复制第 ${lineNumber} 行到剪贴板`);
                    });
                }
            }
        });
        
        console.log('Logcat 编辑器（图表1）初始化完成');
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
     * 更新编辑器内容（只处理图表1）
     */
    updateEditorContent(entries) {
        const infoElement = document.getElementById('logInfo1');
        
        if (!this.editor) {
            console.error('Logcat编辑器未初始化');
            return;
        }
        
        if (!entries || entries.length === 0) {
            this.editor.setValue('没有日志数据...');
            if (infoElement) {
                infoElement.innerHTML = '<i class="bi bi-info-circle me-1"></i>请选择文件或拖拽选择范围以显示日志';
            }
            return;
        }
        
        // 获取过滤状态，判断是否显示原始过滤
        let showRawLine = false;
        if (window.logcatComparisonManager) {
            const filterState = window.logcatComparisonManager.filterState1;
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
        this.editor.setValue(text);
        
        // 保存时间差映射到编辑器实例
        this.lineGapMap = lineGapMap;
        
        // 更新行号显示，在行号区显示时间差
        this.updateLineNumbersWithGap(lineGapMap);
        
        // 应用日志级别颜色装饰
        this.applyLevelColorDecorations(entries);
        
        // 更新信息显示
        if (infoElement) {
            infoElement.innerHTML = `<i class="bi bi-info-circle me-1"></i>显示 ${entries.length} 条日志`;
        }
        
        console.log(`Logcat编辑器内容已更新: ${entries.length} 条记录，时间差已显示在行号区`);
    }
    
    /**
     * 计算时间差
     */
    calculateGap(entry) {
        let gapValue = entry.logTimeFromBaseTimeGap;
        
        if (gapValue !== null) {
            return (gapValue / 1000).toFixed(3) + 's';
        }
        
        return '0.000s';
    }
    
        /**
     * 更新行号显示，在行号区显示时间差
     */
    updateLineNumbersWithGap(lineGapMap) {
        // 获取当前总行数
        const model = this.editor.getModel();
        const lineCount = model ? model.getLineCount() : 0;
        
        // 动态计算所需宽度
        // 1. 行号长度：例如 10000 -> 5
        const lineCountLen = lineCount.toString().length;
        
        // 2. 时间差预留长度：
        // 格式 " [1234.567s]" 大约需要 12-13 个字符
        // 我们预留 14 个字符以确保宽裕（包含空格和括号）
        const gapReservedLen = 14; 
        
        // 3. 计算总宽度，并设置一个最小值（防止文件很小时太窄）
        const totalMinChars = Math.max(15, lineCountLen + gapReservedLen);

        // 更新行号显示函数
        this.editor.updateOptions({
            lineNumbers: (lineNumber) => {
                const gap = lineGapMap ? lineGapMap.get(lineNumber) : '0.000s';
                // 在行号后面显示时间差，格式：行号 [时间差]
                return `${lineNumber} [${gap}]`;
            },
            // 使用动态计算的宽度
            lineNumbersMinChars: totalMinChars 
        });
        
        console.log(`Logcat编辑器行号显示已更新，宽度设置为: ${totalMinChars} chars`);
    }
    
    /**
     * 应用日志级别颜色装饰
     */
    applyLevelColorDecorations(entries) {
        const decorations = [];
        
        // 获取过滤状态，判断是否显示原始过滤
        let showRawLine = false;
        if (window.logcatComparisonManager) {
            const filterState = window.logcatComparisonManager.filterState1;
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
        const model = this.editor.getModel();
        const oldDecorations = this.editor.getDecorationsInRange(new monaco.Range(1, 1, model.getLineCount(), 1));
        if (oldDecorations) {
            this.editor.deltaDecorations(oldDecorations.map(d => d.id), []);
        }
        
        // 应用新的装饰
        if (decorations.length > 0) {
            this.editor.deltaDecorations([], decorations);
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
let logcatEditor = null;

// 初始化函数
function initLogcatEditor() {
    if (!logcatEditor) {
        logcatEditor = new LogcatEditor();
        window.logcatEditor = logcatEditor;
        
        // 创建全局更新函数供其他模块调用（只处理图表1）
        window.updateLogcatEditorContent = function(entries) {
            if (window.logcatEditor) {
                window.logcatEditor.updateEditorContent(entries);
            } else {
                console.error('Logcat 编辑器未初始化');
            }
        };
        
        console.log('Logcat 编辑器已初始化');
    }
    return logcatEditor;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogcatEditor);
} else {
    initLogcatEditor();
}

// 导出函数，供其他模块调用
window.initLogcatEditor = initLogcatEditor;
