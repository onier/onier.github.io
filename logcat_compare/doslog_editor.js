/**
 * DOS日志编辑器
 * 专门处理DOS日志的时间差装饰器显示
 * 只负责图表2的编辑器（monacoEditorContainer2）
 * 与Logcat编辑器完全解耦，专注于DOS日志处理
 */
class DoslogEditor {
    constructor() {
        console.log('DOS日志编辑器已创建');
        
        // 编辑器实例（只管理图表2的编辑器）
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
            console.log('Monaco Editor 加载成功，开始初始化DOS日志编辑器...');
            
            // 初始化DOS日志编辑器（图表2）
            this.initEditor();
            
            console.log('DOS日志编辑器初始化完成！');
        });
    }
    
    /**
     * 初始化DOS日志编辑器（图表2）
     */
    initEditor() {
        // 优先使用 Golden Layout 中的容器，如果没有则使用原来的容器
        let containerId = 'glMonacoEditor2';
        let container = document.getElementById(containerId);
        
        // 如果 Golden Layout 容器不存在，使用原来的容器
        if (!container) {
            containerId = 'monacoEditorContainer2';
            container = document.getElementById(containerId);
        }
        
        if (!container) {
            console.error(`找不到 ${containerId} 元素，将在 500ms 后重试...`);
            setTimeout(() => this.initEditor(), 500);
            return;
        }
        
        // 如果已经初始化过了，销毁旧的编辑器
        if (this.editor) {
            this.editor.dispose();
        }
        
        this.editor = monaco.editor.create(container, {
            value: '请选择文件或拖拽选择范围以显示DOS日志...\n\n提示：\n1. 从上方选择文件\n2. 在时序图上拖拽选择范围\n3. 使用过滤功能筛选日志',
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
        
        console.log('DOS日志编辑器（图表2）初始化完成');
    }
    
    /**
     * 解析DOS日志行中的时间戳
     * 格式：2025-10-31 01:52:11,412 - Dummy-3-10260 - [2025-10-31 01:52:11.412992]
     */
    parseDosLogTimestamp(logLine) {
        if (!logLine) return null;
        
        // 尝试匹配格式：2025-10-31 01:52:11,412
        const timestampRegex = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})/;
        const match = logLine.match(timestampRegex);
        
        if (match && match[1]) {
            return match[1]; // 返回：2025-10-31 01:52:11,412
        }
        
        return null;
    }
    
    /**
     * 将时间戳字符串转换为毫秒数
     * 格式：2025-10-31 01:52:11,412
     */
    timestampToMs(timestampStr) {
        if (!timestampStr) return 0;
        
        try {
            // 格式：2025-10-31 01:52:11,412
            const parts = timestampStr.split(' ');
            if (parts.length !== 2) {
                console.warn('时间戳格式错误，缺少空格分隔:', timestampStr);
                return 0;
            }
            
            const datePart = parts[0]; // 2025-10-31
            const timePart = parts[1]; // 01:52:11,412
            
            // 解析日期部分
            const dateParts = datePart.split('-');
            if (dateParts.length !== 3) {
                console.warn('日期部分格式错误:', datePart);
                return 0;
            }
            
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // 月份从0开始
            const day = parseInt(dateParts[2], 10);
            
            // 解析时间部分
            const timeParts = timePart.split(':');
            if (timeParts.length !== 3) {
                console.warn('时间部分格式错误:', timePart);
                return 0;
            }
            
            const hour = parseInt(timeParts[0], 10);
            const minute = parseInt(timeParts[1], 10);
            
            // 解析秒和毫秒
            const secondMilliParts = timeParts[2].split(',');
            if (secondMilliParts.length !== 2) {
                console.warn('秒和毫秒部分格式错误:', timeParts[2]);
                return 0;
            }
            
            const second = parseInt(secondMilliParts[0], 10);
            const millisecond = parseInt(secondMilliParts[1], 10);
            
            // 验证所有数字都是有效的
            if (isNaN(year) || isNaN(month) || isNaN(day) || 
                isNaN(hour) || isNaN(minute) || isNaN(second) || isNaN(millisecond)) {
                console.warn('时间戳包含无效数字:', timestampStr);
                return 0;
            }
            
            // 创建Date对象（使用本地时间）
            const date = new Date(year, month, day, hour, minute, second, millisecond);
            
            if (isNaN(date.getTime())) {
                console.warn('无法解析时间戳:', timestampStr);
                return 0;
            }
            
            return date.getTime();
        } catch (error) {
            console.error('时间戳转换错误:', error, '时间戳:', timestampStr);
            return 0;
        }
    }
    
    /**
     * 计算DOS日志的相对时间差（从第一行开始）
     * @param {Array} doslogs - DOS日志数组
     * @returns {Array} 时间差数组，格式：["0.000s", "0.123s", ...]
     */
    calculateRelativeTimeGaps(doslogs) {
        if (!doslogs || doslogs.length === 0) {
            console.log('calculateRelativeTimeGaps: 没有DOS日志数据');
            return [];
        }
        
        console.log('calculateRelativeTimeGaps: 开始计算时间差，日志行数:', doslogs.length);
        
        // 解析第一行的时间戳
        const firstTimestamp = this.parseDosLogTimestamp(doslogs[0]);
        console.log('第一行日志:', doslogs[0]);
        console.log('解析到的时间戳:', firstTimestamp);
        
        if (!firstTimestamp) {
            console.log('第一行没有时间戳，返回全0的时间差');
            // 如果第一行没有时间戳，返回全0的时间差
            return doslogs.map(() => '0.000s');
        }
        
        const firstTimeMs = this.timestampToMs(firstTimestamp);
        console.log('第一行时间戳毫秒数:', firstTimeMs);
        
        const timeGaps = [];
        
        doslogs.forEach((logLine, index) => {
            if (index === 0) {
                // 第一行时间差为0
                timeGaps.push('0.000s');
                console.log(`第1行时间差: 0.000s`);
                return;
            }
            
            const timestamp = this.parseDosLogTimestamp(logLine);
            console.log(`第${index + 1}行日志:`, logLine);
            console.log(`第${index + 1}行解析到的时间戳:`, timestamp);
            
            if (!timestamp) {
                // 如果没有时间戳，使用上一行的时间差
                const prevGap = timeGaps[index - 1] || '0.000s';
                timeGaps.push(prevGap);
                console.log(`第${index + 1}行没有时间戳，使用上一行的时间差: ${prevGap}`);
                return;
            }
            
            const currentTimeMs = this.timestampToMs(timestamp);
            console.log(`第${index + 1}行时间戳毫秒数:`, currentTimeMs);
            
            const gapMs = currentTimeMs - firstTimeMs;
            console.log(`第${index + 1}行时间差毫秒数:`, gapMs);
            
            // 检查gapMs是否为有效数字
            if (isNaN(gapMs)) {
                // 如果gapMs是NaN，使用上一行的时间差
                console.warn(`第${index + 1}行时间差计算为NaN，使用上一行的时间差`);
                const prevGap = timeGaps[index - 1] || '0.000s';
                timeGaps.push(prevGap);
            } else if (gapMs < 0) {
                // 如果时间差为负，可能是时间戳解析错误，使用上一行的时间差
                console.warn(`第${index + 1}行时间差为负: ${gapMs}ms，使用上一行的时间差`);
                const prevGap = timeGaps[index - 1] || '0.000s';
                timeGaps.push(prevGap);
            } else {
                // 转换为秒，保留3位小数
                const gapSeconds = (gapMs / 1000).toFixed(3);
                timeGaps.push(`${gapSeconds}s`);
                console.log(`第${index + 1}行时间差: ${gapSeconds}s`);
            }
        });
        
        console.log('calculateRelativeTimeGaps: 计算完成，时间差数组:', timeGaps);
        return timeGaps;
    }
    
    /**
     * 更新编辑器内容（只处理图表2）
     */
    updateEditorContent(doslogs) {
        const infoElement = document.getElementById('logInfo2');
        
        if (!this.editor) {
            console.error('DOS日志编辑器未初始化');
            return;
        }
        
        if (!doslogs || doslogs.length === 0) {
            this.editor.setValue('没有DOS日志数据...');
            const emptyMessage = '<i class="bi bi-info-circle me-1"></i>请选择文件或拖拽选择范围以显示DOS日志';
            if (infoElement) {
                infoElement.innerHTML = emptyMessage;
            }
            // 更新 Golden Layout 中的 info
            document.querySelectorAll('#glTemplateDosEditor .gl-log-info-text').forEach(el => {
                el.innerHTML = '请选择文件或拖拽选择范围以显示DOS日志';
            });
            return;
        }
        
        // 生成显示文本
        let text = '';
        const timeGaps = this.calculateRelativeTimeGaps(doslogs);
        
        doslogs.forEach((logLine, index) => {
            text += logLine + '\n';
        });
        
        // 设置编辑器内容
        this.editor.setValue(text);
        
        // 保存时间差映射到编辑器实例
        this.lineGapMap = new Map();
        timeGaps.forEach((gap, index) => {
            this.lineGapMap.set(index + 1, gap);
        });
        
        // 更新行号显示，在行号区显示时间差
        this.updateLineNumbersWithGap();
        
        // 更新信息显示
        const infoText = `显示 ${doslogs.length} 条DOS日志`;
        if (infoElement) {
            infoElement.innerHTML = `<i class="bi bi-info-circle me-1"></i>${infoText}`;
        }
        // 更新 Golden Layout 中的 info
        document.querySelectorAll('#glTemplateDosEditor .gl-log-info-text').forEach(el => {
            el.innerHTML = infoText;
        });
        
        console.log(`DOS日志编辑器内容已更新: ${doslogs.length} 条记录，时间差已显示在行号区`);
    }
    
    /**
     * 更新行号显示，在行号区显示时间差
     */
    updateLineNumbersWithGap() {
        // 更新行号显示函数
        this.editor.updateOptions({
            lineNumbers: (lineNumber) => {
                const gap = this.lineGapMap ? this.lineGapMap.get(lineNumber) : '0.000s';
                // 在行号后面显示时间差，格式：行号 [时间差]
                return `${lineNumber} [${gap}]`;
            },
            lineNumbersMinChars: 15 // 增加最小字符数，确保有足够空间显示时间差
        });
        
        console.log('DOS日志编辑器行号显示已更新，包含时间差信息');
    }
}

// 创建全局实例
let doslogEditor = null;

// 初始化函数
function initDoslogEditor() {
    if (!doslogEditor) {
        doslogEditor = new DoslogEditor();
        window.doslogEditor = doslogEditor;
        
        // 创建全局更新函数供其他模块调用（只处理图表2）
        window.updateDoslogEditorContent = function(doslogs) {
            if (window.doslogEditor) {
                window.doslogEditor.updateEditorContent(doslogs);
            } else {
                console.error('DOS日志编辑器未初始化');
            }
        };
        
        console.log('DOS日志编辑器已初始化');
    }
    return doslogEditor;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDoslogEditor);
} else {
    initDoslogEditor();
}

// 导出函数，供其他模块调用
window.initDoslogEditor = initDoslogEditor;
