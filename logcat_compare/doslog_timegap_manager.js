/**
 * DOS日志时间差管理器
 * 专门处理monacoEditorContainer2的时间差装饰器显示
 * 与monacoEditorContainer1的代码完全解耦
 */
class DosLogTimeGapManager {
    constructor() {
        console.log('DOS日志时间差管理器已创建');
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
     * 更新Monaco Editor 2的行号显示，添加时间差装饰器
     * @param {Array} doslogs - DOS日志数组
     */
    updateMonacoEditor2LineNumbers(doslogs) {
        if (!window.monacoEditorManager || !window.monacoEditorManager.editor2) {
            console.warn('Monaco Editor 2未初始化，跳过时间差装饰器更新');
            return;
        }
        
        const editor2 = window.monacoEditorManager.editor2;
        console.log('updateMonacoEditor2LineNumbers: 开始更新行号显示');
        console.log('DOS日志行数:', doslogs.length);
        
        const timeGaps = this.calculateRelativeTimeGaps(doslogs);
        console.log('计算得到的时间差数组:', timeGaps);
        console.log('时间差数组长度:', timeGaps.length);
        
        if (timeGaps.length === 0) {
            console.log('没有时间差数据，跳过行号更新');
            return;
        }
        
        // 检查时间差数组中是否有NaN
        const hasNaN = timeGaps.some(gap => gap.includes('NaN'));
        if (hasNaN) {
            console.error('时间差数组中包含NaN:', timeGaps);
        }
        
        // 创建行号到时间差的映射
        const lineGapMap = new Map();
        timeGaps.forEach((gap, index) => {
            lineGapMap.set(index + 1, gap);
        });
        
        console.log('行号到时间差的映射:', Array.from(lineGapMap.entries()));
        
        // 保存时间差映射到编辑器实例
        if (!window.monacoEditorManager.lineGapMap2) {
            window.monacoEditorManager.lineGapMap2 = new Map();
        }
        window.monacoEditorManager.lineGapMap2 = lineGapMap;
        
        // 更新行号显示函数
        editor2.updateOptions({
            lineNumbers: (lineNumber) => {
                const gap = lineGapMap.get(lineNumber) || '0.000s';
                // 在行号后面显示时间差，格式：行号 [时间差]
                const result = `${lineNumber} [${gap}]`;
                console.log(`行号显示函数被调用: lineNumber=${lineNumber}, gap=${gap}, result=${result}`);
                return result;
            },
            lineNumbersMinChars: 15 // 增加最小字符数，确保有足够空间显示时间差
        });
        
        console.log(`Monaco Editor 2行号显示已更新，包含${timeGaps.length}个时间差装饰器`);
    }
    
    /**
     * 处理DOS日志并更新Monaco Editor 2
     * 这是主要入口函数，在logcat_comparison.js中调用
     * @param {Array} doslogs - DOS日志数组
     */
    processAndUpdateDosLogs(doslogs) {
        if (!doslogs || doslogs.length === 0) {
            console.log('没有DOS日志数据，跳过处理');
            return;
        }
        
        console.log(`处理DOS日志: ${doslogs.length} 行`);
        
        // 计算时间差
        const timeGaps = this.calculateRelativeTimeGaps(doslogs);
        
        // 更新行号显示
        this.updateMonacoEditor2LineNumbers(doslogs);
        
        // 返回处理后的日志条目（供logcat_comparison.js使用）
        return doslogs.map((line, index) => ({
            line: line,
            rawLine: line,
            lineNumber: index + 1,
            level: '',
            tag: '',
            pid: 0,
            message: line,
            timestamp: this.parseDosLogTimestamp(line) || '',
            timeGap: timeGaps[index] || '0.000s',
            isFlag: false
        }));
    }
}

// 创建全局实例
let dosLogTimeGapManager = null;

// 初始化函数
function initDosLogTimeGapManager() {
    if (!dosLogTimeGapManager) {
        dosLogTimeGapManager = new DosLogTimeGapManager();
        window.dosLogTimeGapManager = dosLogTimeGapManager;
        console.log('DOS日志时间差管理器已初始化');
    }
    return dosLogTimeGapManager;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDosLogTimeGapManager);
} else {
    initDosLogTimeGapManager();
}

// 确保初始化的函数
function ensureDosLogTimeGapManagerInitialized() {
    if (!window.dosLogTimeGapManager) {
        console.warn('DOS日志时间差管理器未初始化，正在尝试初始化...');
        return initDosLogTimeGapManager();
    }
    return window.dosLogTimeGapManager;
}

// 导出函数，供其他模块调用
window.initDosLogTimeGapManager = initDosLogTimeGapManager;
window.ensureDosLogTimeGapManagerInitialized = ensureDosLogTimeGapManagerInitialized;
window.processDosLogsWithTimeGap = function(doslogs) {
    ensureDosLogTimeGapManagerInitialized();
    if (window.dosLogTimeGapManager) {
        return window.dosLogTimeGapManager.processAndUpdateDosLogs(doslogs);
    } else {
        console.error('DOS日志时间差管理器初始化失败');
        return null;
    }
};

// 立即尝试初始化（确保无论如何都会初始化）
setTimeout(function() {
    console.log('尝试立即初始化DOS日志时间差管理器...');
    ensureDosLogTimeGapManagerInitialized();
}, 100);
