/**
 * Logcat 对比管理器
 * 用于对比两个图表选择的范围内的日志记录
 * 支持tag和level的多选过滤
 * 使用Monaco Editor显示日志
 */
class LogcatComparisonManager {
    constructor() {
        console.log('Logcat对比管理器已创建');

        // 初始化过滤状态 - 只保留图表1的过滤状态
        this.filterState1 = {
            tags: [],
            levels: [],
            pids: [],
            regex: '',
            startLine: null,
            endLine: null,
            showRawLine: false,
            isActive: false
        };

        // 图表2不再有过滤状态
        this.filterState2 = null;

        // 初始化事件监听器
        this.initFilterEventListeners();

        // 初始化Select2控件
        this.initSelect2Controls();

        // 初始化文件选择器
        this.initFileSelectors();
    }

    /**
     * 初始化文件选择器
     */
    initFileSelectors() {
        // 延迟初始化，等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupFileSelectors();
            });
        } else {
            this.setupFileSelectors();
        }
    }

    /**
     * 设置文件选择器
     */
    setupFileSelectors() {
        // 为两个图表初始化文件选择器
        this.initFileSelector(1);
        this.initFileSelector(2);

        // 监听文件上传完成事件，更新文件选择器
        document.addEventListener('logcatFilesUploaded', () => {
            this.updateFileSelectors();
        });

        console.log('文件选择器已初始化');
    }

    /**
     * 初始化单个文件选择器
     */
    initFileSelector(chartNum) {
        // 图表2不再有文件选择器，跳过初始化
        if (chartNum === 2) {
            console.log('图表2不再有文件选择器，跳过初始化');
            return;
        }

        const fileSelect = document.getElementById(`logFileSelect${chartNum}`);
        if (!fileSelect) {
            console.error(`找不到文件选择器: logFileSelect${chartNum}`);
            return;
        }

        // 初始化Select2控件（支持搜索）
        $(fileSelect).select2({
            theme: 'bootstrap4',
            placeholder: '选择文件...',
            allowClear: true,
            width: '100%',
            minimumResultsForSearch: 0, // 总是显示搜索框
            language: {
                searching: function() {
                    return "搜索中...";
                },
                noResults: function() {
                    return "未找到匹配的文件";
                },
                inputTooShort: function(args) {
                    var remainingChars = args.minimum - args.input.length;
                    return "请输入至少 " + remainingChars + " 个字符";
                }
            },
            templateResult: function(data) {
                if (!data.id) {
                    return data.text;
                }
                // 高亮搜索匹配的部分
                var term = $(fileSelect).data('select2').dropdown.$search.val();
                if (term && data.text) {
                    var escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    var regex = new RegExp('(' + escapedTerm + ')', 'gi');
                    var highlightedText = data.text.replace(regex, '<mark>$1</mark>');
                    return $('<span>').html(highlightedText);
                }
                return data.text;
            }
        });

        // 添加变更事件监听器
        $(fileSelect).on('change', (e) => {
            this.onFileSelected(chartNum, e.target.value);
        });

        // 初始更新文件列表
        this.updateFileSelectorOptions(chartNum);
    }

    /**
     * 文件选择变更事件处理
     */
    onFileSelected(chartNum, filename) {
        console.log(`图表${chartNum}选择了文件: ${filename}`);

        if (!filename) {
            // 如果没有选择文件，显示提示信息
            this.updateMonacoEditorContent(chartNum, null);
            return;
        }
        
        // 获取doslogs
        let doslogs = window.logcatManager.fileUtils.getDosLogs(filename);
        
        // 更新当前文件名
        this.setCurrentFilename(chartNum, filename);

        if (chartNum === 1) {
            // 图表1选择文件时，更新图表1的日志显示，同时将doslogs显示到图表2
            this.updateLogDisplay(1);
            this.updateSelect2Controls(1);
            this.resetFilter(1);
            
            // 将doslogs显示到图表2
            this.updateDosLogsDisplay(doslogs);
        } else if (chartNum === 2) {
            // 图表2选择文件时，保持原有逻辑（但UI上应该禁用图表2的文件选择器）
            this.updateLogDisplay(2);
            this.updateSelect2Controls(2);
            this.resetFilter(2);
        }
    }

    /**
     * 设置当前文件名
     */
    setCurrentFilename(chartNum, filename) {
        // 确保图表管理器存在
        if (!window.logcatChartsManager) {
            window.logcatChartsManager = {};
        }

        if (chartNum === 1) {
            window.logcatChartsManager.currentFile1 = filename;
        } else if (chartNum === 2) {
            window.logcatChartsManager.currentFile2 = filename;
        }
    }

    /**
     * 更新文件选择器选项
     */
    updateFileSelectorOptions(chartNum) {
        // 图表2不再有文件选择器，跳过更新
        if (chartNum === 2) {
            console.log('图表2不再有文件选择器，跳过更新');
            return;
        }

        const fileSelect = document.getElementById(`logFileSelect${chartNum}`);
        if (!fileSelect) return;

        // 获取已上传的文件列表 - 确保从正确的数据源获取
        let fileNames = [];
        if (window.logcatManager && window.logcatManager.logcatEntryMap) {
            fileNames = Object.keys(window.logcatManager.logcatEntryMap);
        }

        console.log(`图表${chartNum}文件选择器更新: 找到 ${fileNames.length} 个文件`, fileNames);

        // 保存当前选中的值
        const selectedFile = fileSelect.value;

        // 清空选项（保留第一个提示选项）
        fileSelect.innerHTML = '<option value="" disabled selected>选择文件...</option>';

        // 添加文件选项
        fileNames.forEach(fileName => {
            const option = document.createElement('option');
            option.value = fileName;
            option.textContent = fileName;
            fileSelect.appendChild(option);
        });

        // 恢复选中的值（如果文件仍然存在）
        if (selectedFile && fileNames.includes(selectedFile)) {
            fileSelect.value = selectedFile;
        } else if (fileNames.length > 0) {
            // 如果没有选中文件但有可用文件，选择第一个
            fileSelect.value = fileNames[0];
            // 触发变更事件
            this.onFileSelected(chartNum, fileNames[0]);
        }

        // 如果没有文件，显示提示
        if (fileNames.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "暂无文件，请先上传文件";
            option.disabled = true;
            fileSelect.appendChild(option);
        }
    }

    /**
     * 更新所有文件选择器
     */
    updateFileSelectors() {
        // 确保日志分析内容区域是可见的
        const logAnalysisContent = document.getElementById('logAnalysisContent');
        if (logAnalysisContent && !logAnalysisContent.classList.contains('d-none')) {
            this.updateFileSelectorOptions(1);
            this.updateFileSelectorOptions(2);
            console.log('文件选择器已更新');
        } else {
            console.log('日志分析页面未显示，跳过文件选择器更新');
        }
    }

    /**
     * 导出日志数据
     */
    exportLogData(chartNum, format = 'csv') {
        const filename = this.getCurrentFilename(chartNum);
        if (!filename) {
            this.showAlert('请先选择文件', 'warning');
            return;
        }

        const entries = this.getAllLogcatEntries(filename);
        if (!entries || entries.length === 0) {
            this.showAlert('文件没有日志数据', 'warning');
            return;
        }

        try {
            let content = '';
            let fileExtension = '';

            if (format === 'csv') {
                content = this.exportToCsv(entries);
                fileExtension = 'csv';
            } else if (format === 'json') {
                content = this.exportToJson(entries);
                fileExtension = 'json';
            } else if (format === 'txt') {
                content = this.exportToText(entries);
                fileExtension = 'txt';
            }

            // 创建下载链接
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}_${new Date().getTime()}.${fileExtension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showAlert(`日志已导出为${format.toUpperCase()}格式`, 'success');
        } catch (error) {
            console.error('导出失败:', error);
            this.showAlert(`导出失败: ${error.message}`, 'danger');
        }
    }

    /**
     * 导出为CSV格式
     */
    exportToCsv(entries) {
        // 添加UTF-8 BOM头，解决Excel中文乱码问题
        let csvContent = '\uFEFF行号,时间戳,级别,标签,PID,消息,累计时间(ms),当前时间差(ms)\n';

        entries.forEach((entry, index) => {
            const row = [
                index + 1,
                entry.timestamp || '',
                entry.level || '',
                entry.tag || '',
                entry.pid || '',
                this.escapeCsvField(entry.message || ''),
                entry.logTimeFromBaseTime || 0,
                entry.gapDiff || 0
            ];
            csvContent += row.join(',') + '\n';
        });

        return csvContent;
    }

    /**
     * 导出为JSON格式
     */
    exportToJson(entries) {
        const exportData = {
            exportTime: new Date().toISOString(),
            totalEntries: entries.length,
            entries: entries.map((entry, index) => ({
                lineNumber: index + 1,
                timestamp: entry.timestamp,
                level: entry.level,
                tag: entry.tag,
                pid: entry.pid,
                message: entry.message,
                logTimeFromBaseTime: entry.logTimeFromBaseTime,
                gapDiff: entry.gapDiff,
                rawLine: entry.line
            }))
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 导出为文本格式
     */
    exportToText(entries) {
        let textContent = '';

        entries.forEach((entry, index) => {
            textContent += `[${index + 1}] ${entry.timestamp || ''} ${entry.level || ''}/${entry.tag || ''}(${entry.pid || ''}): ${entry.message || ''}\n`;
        });

        return textContent;
    }

    /**
     * 转义CSV字段
     */
    escapeCsvField(field) {
        if (field === null || field === undefined) return '';

        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    }

    /**
     * 排序日志数据
     */
    sortLogData(chartNum, sortBy = 'time', sortOrder = 'asc') {
        const filename = this.getCurrentFilename(chartNum);
        if (!filename) {
            this.showAlert('请先选择文件', 'warning');
            return;
        }

        const entries = this.getAllLogcatEntries(filename);
        if (!entries || entries.length === 0) {
            this.showAlert('文件没有日志数据', 'warning');
            return;
        }

        // 创建排序后的副本
        const sortedEntries = [...entries];

        sortedEntries.sort((a, b) => {
            let valueA, valueB;

            switch (sortBy) {
                case 'time':
                    valueA = a.logTimeFromBaseTime || 0;
                    valueB = b.logTimeFromBaseTime || 0;
                    break;
                case 'level':
                    valueA = this.getLevelPriority(a.level);
                    valueB = this.getLevelPriority(b.level);
                    break;
                case 'tag':
                    valueA = (a.tag || '').toLowerCase();
                    valueB = (b.tag || '').toLowerCase();
                    break;
                case 'pid':
                    valueA = a.pid || 0;
                    valueB = b.pid || 0;
                    break;
                default:
                    valueA = a.logTimeFromBaseTime || 0;
                    valueB = b.logTimeFromBaseTime || 0;
            }

            if (sortOrder === 'asc') {
                return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
            } else {
                return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
            }
        });

        // 更新显示
        this.updateMonacoEditorContent(chartNum, sortedEntries);

        // 显示排序提示
        const sortText = this.getSortText(sortBy, sortOrder);
        this.showAlert(`已按${sortText}排序`, 'info');
    }

    /**
     * 获取级别优先级
     */
    getLevelPriority(level) {
        const priority = {
            'E': 1, 'ERROR': 1,
            'W': 2, 'WARNING': 2,
            'I': 3, 'INFO': 3,
            'D': 4, 'DEBUG': 4,
            'V': 5, 'VERBOSE': 5
        };
        return priority[level] || 6;
    }

    /**
     * 获取排序描述文本
     */
    getSortText(sortBy, sortOrder) {
        const sortByText = {
            'time': '时间',
            'level': '级别',
            'tag': '标签',
            'pid': '进程ID'
        }[sortBy] || '时间';

        const sortOrderText = sortOrder === 'asc' ? '升序' : '降序';

        return `${sortByText}${sortOrderText}`;
    }

    /**
     * 更新日志显示
     */
    updateLogDisplay(chartNum) {
        const filename = this.getCurrentFilename(chartNum);
        if (!filename) {
            this.updateMonacoEditorContent(chartNum, null);
            return;
        }

        const entries = this.getAllLogcatEntries(filename);
        if (!entries || entries.length === 0) {
            this.updateMonacoEditorContent(chartNum, []);
            return;
        }

        // 检查过滤状态，如果过滤已激活则显示过滤后的数据
        const filterState = chartNum === 1 ? this.filterState1 : this.filterState2;
        let displayEntries = entries;

        if (filterState.isActive) {
            displayEntries = this.getFilteredEntries(chartNum, entries);
            console.log(`图表${chartNum}日志显示已更新（过滤中）: 显示${displayEntries.length}/${entries.length}条记录`);
        } else {
            console.log(`图表${chartNum}日志显示已更新: 显示${entries.length}条记录`);
        }

        // 更新Monaco Editor内容
        this.updateMonacoEditorContent(chartNum, displayEntries);
    }

    /**
     * 更新Monaco Editor内容
     */
    updateMonacoEditorContent(chartNum, entries) {
        // 根据图表号使用不同的编辑器API
        if (chartNum === 1) {
            // 图表1使用Logcat编辑器
            if (typeof window.updateLogcatEditorContent === 'function') {
                window.updateLogcatEditorContent(entries);
            } else {
                console.error('Logcat编辑器更新函数未初始化');
                this.showSimpleInfo(chartNum, entries);
            }
        } else if (chartNum === 2) {
            // 图表2使用DOS日志编辑器
            if (typeof window.updateDoslogEditorContent === 'function') {
                window.updateDoslogEditorContent(entries);
            } else {
                console.error('DOS日志编辑器更新函数未初始化');
                this.showSimpleInfo(chartNum, entries);
            }
        } else {
            console.error(`无效的图表号: ${chartNum}`);
        }
    }
    
    /**
     * 显示简单信息（当编辑器未初始化时）
     */
    showSimpleInfo(chartNum, entries) {
        const infoElement = document.getElementById(`logInfo${chartNum}`);
        if (infoElement) {
            if (!entries || entries.length === 0) {
                infoElement.innerHTML = '<i class="bi bi-info-circle me-1"></i>请选择文件或拖拽选择范围以显示日志';
            } else {
                infoElement.innerHTML = `<i class="bi bi-info-circle me-1"></i>显示 ${entries.length} 条日志 (编辑器加载中...)`;
            }
        }
    }

    /**
     * 更新DOS日志显示到图表2
     */
    updateDosLogsDisplay(doslogs) {
        console.log('更新DOS日志显示:', doslogs ? doslogs.length : 0, '行');
        
        if (!doslogs || doslogs.length === 0) {
            // 如果没有doslogs，显示提示信息
            this.updateMonacoEditorContent(2, null);
            
            // 更新图表2的信息显示
            const infoElement = document.getElementById('logInfo2');
            if (infoElement) {
                infoElement.innerHTML = '<i class="bi bi-info-circle me-1"></i>当前选择的logcat文件没有对应的DOS日志';
            }
            return;
        }
        
        // 直接调用DOS日志编辑器更新函数
        if (typeof window.updateDoslogEditorContent === 'function') {
            console.log('使用DOS日志编辑器更新函数');
            window.updateDoslogEditorContent(doslogs);
        } else {
            console.log('DOS日志编辑器更新函数未加载，使用默认处理');
            // 将doslogs数组转换为Monaco Editor可以显示的格式
            const doslogEntries = doslogs.map((line, index) => ({
                line: line,
                rawLine: line,
                lineNumber: index + 1,
                level: '',
                tag: '',
                pid: 0,
                message: line,
                timestamp: '',
                isFlag: false
            }));
            
            // 更新图表2显示doslogs
            this.updateMonacoEditorContent(2, doslogEntries);
        }
        
        // 更新图表2的信息显示
        const infoElement = document.getElementById('logInfo2');
        if (infoElement) {
            infoElement.innerHTML = `<i class="bi bi-info-circle me-1"></i>显示 ${doslogs.length} 行DOS日志（已添加时间差装饰器）`;
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

    /**
     * 获取当前图表对应的文件名
     */
    getCurrentFilename(chartNum) {
        // 从图表管理器获取当前文件名
        if (window.logcatChartsManager) {
            if (chartNum === 1) {
                return window.logcatChartsManager.currentFile1;
            } else if (chartNum === 2) {
                return window.logcatChartsManager.currentFile2;
            }
        }

        // 如果图表管理器中没有，尝试从文件选择器获取
        const fileSelect = document.getElementById(`logFileSelect${chartNum}`);
        if (fileSelect && fileSelect.value) {
            return fileSelect.value;
        }

        return null;
    }

    /**
     * 获取指定文件的所有日志记录
     */
    getAllLogcatEntries(filename) {
        if (!filename) return null;

        // 从logcatManager获取日志记录
        if (window.logcatManager && window.logcatManager.logcatEntryMap) {
            return window.logcatManager.logcatEntryMap[filename] || null;
        }
        return null;
    }

    /**
     * 显示提示信息
     */
    showAlert(message, type = 'info') {
        // 创建提示元素
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
        `;
        alertDiv.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : type === 'danger' ? 'x-circle' : 'info-circle'} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="关闭"></button>
        `;

        document.body.appendChild(alertDiv);

        // 5秒后自动移除提示
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    /**
     * 初始化过滤事件监听器
     */
    initFilterEventListeners() {
        // 图表1的过滤按钮（对话框版本）
        const applyFilterModal1 = document.getElementById('applyFilterModal1');
        const resetFilterModal1 = document.getElementById('resetFilterModal1');
        const resetFilter1 = document.getElementById('resetFilter1');

        if (applyFilterModal1) {
            applyFilterModal1.addEventListener('click', () => this.applyFilterFromModal(1));
        }
        if (resetFilterModal1) {
            resetFilterModal1.addEventListener('click', () => this.resetFilterFromModal(1));
        }
        if (resetFilter1) {
            resetFilter1.addEventListener('click', () => this.resetFilter(1));
        }
        
        // Golden Layout 中的过滤按钮（使用事件委托）
        document.addEventListener('click', (e) => {
            const target = e.target.closest('.gl-reset-filter-btn');
            if (target) {
                this.resetFilter(1);
            }
        });

        // 图表2不再有过滤功能，所以不初始化图表2的过滤事件监听器

        // 排序功能 - 只保留图表1的排序
        const sortBy1 = document.getElementById('sortBy1');
        
        if (sortBy1) {
            sortBy1.addEventListener('change', () => this.applySorting(1));
        }

        console.log('过滤事件监听器已初始化（仅图表1）');
    }
    
    /**
     * 从对话框应用过滤
     */
    applyFilterFromModal(chartNum) {
        const tagSelect = document.getElementById(`filterTag${chartNum}`);
        const levelSelect = document.getElementById(`filterLevel${chartNum}`);
        const pidSelect = document.getElementById(`filterPid${chartNum}`);
        const regexInput = document.getElementById(`filterRegex${chartNum}`);
        const startLineInput = document.getElementById(`filterStartLine${chartNum}`);
        const endLineInput = document.getElementById(`filterEndLine${chartNum}`);
        const showRawLineCheckbox = document.getElementById(`showRawLine${chartNum}`);

        if (!tagSelect || !levelSelect || !pidSelect || !regexInput || !startLineInput || !endLineInput || !showRawLineCheckbox) {
            console.error(`找不到过滤控件: 图表${chartNum}`);
            return;
        }

        // 获取选中的值
        const selectedTags = Array.from(tagSelect.selectedOptions).map(option => option.value);
        const selectedLevels = Array.from(levelSelect.selectedOptions).map(option => option.value);
        const selectedPids = Array.from(pidSelect.selectedOptions).map(option => option.value);
        const regexPattern = regexInput.value.trim();
        const startLine = startLineInput.value ? parseInt(startLineInput.value, 10) : null;
        const endLine = endLineInput.value ? parseInt(endLineInput.value, 10) : null;
        const showRawLine = showRawLineCheckbox.checked;

        // 验证行号
        if (startLine !== null && (isNaN(startLine) || startLine < 1)) {
            this.showAlert('起始行号必须是大于0的整数', 'warning');
            return;
        }
        if (endLine !== null && (isNaN(endLine) || endLine < 1)) {
            this.showAlert('结束行号必须是大于0的整数', 'warning');
            return;
        }
        if (startLine !== null && endLine !== null && startLine > endLine) {
            this.showAlert('起始行号不能大于结束行号', 'warning');
            return;
        }

        // 更新过滤状态
        const filterState = chartNum === 1 ? this.filterState1 : this.filterState2;
        filterState.tags = selectedTags.filter(tag => tag !== '');
        filterState.levels = selectedLevels;
        filterState.pids = selectedPids.filter(pid => pid !== '').map(pid => parseInt(pid, 10)).filter(pid => !isNaN(pid));
        filterState.regex = regexPattern;
        filterState.startLine = startLine;
        filterState.endLine = endLine;
        filterState.showRawLine = showRawLine;
        filterState.isActive = filterState.tags.length > 0 || filterState.levels.length > 0 || filterState.pids.length > 0 || filterState.regex !== '' || filterState.startLine !== null || filterState.endLine !== null || filterState.showRawLine;

        // 更新过滤状态显示
        this.updateFilterStatus(chartNum);

        // 获取当前文件的数据
        const filename = this.getCurrentFilename(chartNum);
        const entries = this.getAllLogcatEntries(filename);
        
        if (entries) {
            // 应用过滤并获取过滤后的数据
            const filteredEntries = this.getFilteredEntries(chartNum, entries);
            // 更新Monaco Editor显示过滤后的数据
            this.updateMonacoEditorContent(chartNum, filteredEntries);
            
            console.log(`图表${chartNum}过滤已应用: 显示${filteredEntries.length}/${entries.length}条记录, tags=${filterState.tags}, levels=${filterState.levels}, pids=${filterState.pids}, regex=${filterState.regex}, startLine=${filterState.startLine}, endLine=${filterState.endLine}`);
            
            // 关闭对话框
            const modal = bootstrap.Modal.getInstance(document.getElementById(`filterModal${chartNum}`));
            if (modal) {
                modal.hide();
            }
        } else {
            console.log(`图表${chartNum}没有数据可过滤`);
        }
    }
    
    /**
     * 从对话框重置过滤
     */
    resetFilterFromModal(chartNum) {
        const tagSelect = document.getElementById(`filterTag${chartNum}`);
        const levelSelect = document.getElementById(`filterLevel${chartNum}`);
        const pidSelect = document.getElementById(`filterPid${chartNum}`);
        const regexInput = document.getElementById(`filterRegex${chartNum}`);
        const startLineInput = document.getElementById(`filterStartLine${chartNum}`);
        const endLineInput = document.getElementById(`filterEndLine${chartNum}`);
        const showRawLineCheckbox = document.getElementById(`showRawLine${chartNum}`);

        if (tagSelect) $(tagSelect).val(null).trigger('change');
        if (levelSelect) $(levelSelect).val(null).trigger('change');
        if (pidSelect) $(pidSelect).val(null).trigger('change');
        if (regexInput) regexInput.value = '';
        if (startLineInput) startLineInput.value = '';
        if (endLineInput) endLineInput.value = '';
        if (showRawLineCheckbox) showRawLineCheckbox.checked = false;

        // 重置过滤状态
        const filterState = chartNum === 1 ? this.filterState1 : this.filterState2;
        filterState.tags = [];
        filterState.levels = [];
        filterState.pids = [];
        filterState.regex = '';
        filterState.startLine = null;
        filterState.endLine = null;
        filterState.showRawLine = false;
        filterState.isActive = false;

        // 更新过滤状态显示
        this.updateFilterStatus(chartNum);

        // 获取当前文件的所有数据并显示
        const filename = this.getCurrentFilename(chartNum);
        const entries = this.getAllLogcatEntries(filename);
        
        if (entries) {
            // 显示所有数据（不过滤）
            this.updateMonacoEditorContent(chartNum, entries);
            console.log(`图表${chartNum}过滤已重置: 显示所有${entries.length}条记录`);
            
            // 关闭对话框
            const modal = bootstrap.Modal.getInstance(document.getElementById(`filterModal${chartNum}`));
            if (modal) {
                modal.hide();
            }
        } else {
            console.log(`图表${chartNum}过滤已重置: 没有数据可显示`);
        }
    }
    
    /**
     * 应用排序
     */
    applySorting(chartNum) {
        const sortBySelect = document.getElementById(`sortBy${chartNum}`);
        if (!sortBySelect) return;
        
        const sortBy = sortBySelect.value;
        this.sortLogData(chartNum, sortBy, 'asc');
    }

    /**
     * 应用过滤
     */
    applyFilter(chartNum) {
        const tagSelect = document.getElementById(`filterTag${chartNum}`);
        const levelSelect = document.getElementById(`filterLevel${chartNum}`);
        const pidSelect = document.getElementById(`filterPid${chartNum}`);

        if (!tagSelect || !levelSelect || !pidSelect) {
            console.error(`找不到过滤控件: 图表${chartNum}`);
            return;
        }

        // 获取选中的值
        const selectedTags = Array.from(tagSelect.selectedOptions).map(option => option.value);
        const selectedLevels = Array.from(levelSelect.selectedOptions).map(option => option.value);
        const selectedPids = Array.from(pidSelect.selectedOptions).map(option => option.value);

        // 更新过滤状态
        const filterState = chartNum === 1 ? this.filterState1 : this.filterState2;
        filterState.tags = selectedTags.filter(tag => tag !== '');
        filterState.levels = selectedLevels;
        filterState.pids = selectedPids.filter(pid => pid !== '').map(pid => parseInt(pid, 10)).filter(pid => !isNaN(pid));
        filterState.isActive = filterState.tags.length > 0 || filterState.levels.length > 0 || filterState.pids.length > 0;

        // 更新过滤状态显示
        this.updateFilterStatus(chartNum);

        // 获取当前文件的数据
        const filename = this.getCurrentFilename(chartNum);
        const entries = this.getAllLogcatEntries(filename);

        if (entries) {
            // 应用过滤并获取过滤后的数据
            const filteredEntries = this.getFilteredEntries(chartNum, entries);
            // 更新Monaco Editor显示过滤后的数据
            this.updateMonacoEditorContent(chartNum, filteredEntries);

            console.log(`图表${chartNum}过滤已应用: 显示${filteredEntries.length}/${entries.length}条记录, tags=${filterState.tags}, levels=${filterState.levels}, pids=${filterState.pids}`);
        } else {
            console.log(`图表${chartNum}没有数据可过滤`);
        }
    }

    /**
     * 重置过滤
     */
    resetFilter(chartNum) {
        const tagSelect = document.getElementById(`filterTag${chartNum}`);
        const levelSelect = document.getElementById(`filterLevel${chartNum}`);
        const pidSelect = document.getElementById(`filterPid${chartNum}`);

        if (tagSelect) tagSelect.value = null;
        if (levelSelect) levelSelect.value = null;
        if (pidSelect) pidSelect.value = null;

        // 更新Select2显示
        if (tagSelect && $(tagSelect).data('select2')) {
            $(tagSelect).val(null).trigger('change');
        }
        if (levelSelect && $(levelSelect).data('select2')) {
            $(levelSelect).val(null).trigger('change');
        }
        if (pidSelect && $(pidSelect).data('select2')) {
            $(pidSelect).val(null).trigger('change');
        }

        // 重置过滤状态
        const filterState = chartNum === 1 ? this.filterState1 : this.filterState2;
        filterState.tags = [];
        filterState.levels = [];
        filterState.pids = [];
        filterState.isActive = false;

        // 更新过滤状态显示
        this.updateFilterStatus(chartNum);

        // 获取当前文件的所有数据并显示
        const filename = this.getCurrentFilename(chartNum);
        const entries = this.getAllLogcatEntries(filename);

        if (entries) {
            // 显示所有数据（不过滤）
            this.updateMonacoEditorContent(chartNum, entries);
            console.log(`图表${chartNum}过滤已重置: 显示所有${entries.length}条记录`);
        } else {
            console.log(`图表${chartNum}过滤已重置: 没有数据可显示`);
        }
    }

    /**
     * 更新过滤状态显示
     */
    updateFilterStatus(chartNum) {
        const filterStatusElement = document.getElementById(`filterStatus${chartNum}`);
        
        const filterState = chartNum === 1 ? this.filterState1 : this.filterState2;
        
        let statusText = '';
        let statusClass = '';

        if (filterState.isActive) {
            const conditions = [];
            if (filterState.tags.length > 0) {
                conditions.push(`标签: ${filterState.tags.length}个`);
            }
            if (filterState.levels.length > 0) {
                conditions.push(`级别: ${filterState.levels.length}个`);
            }
            if (filterState.pids.length > 0) {
                conditions.push(`PID: ${filterState.pids.length}个`);
            }
            if (filterState.regex) {
                conditions.push(`正则: "${filterState.regex}"`);
            }
            if (filterState.startLine !== null || filterState.endLine !== null) {
                let lineRange = '';
                if (filterState.startLine !== null && filterState.endLine !== null) {
                    lineRange = `行号: ${filterState.startLine}-${filterState.endLine}`;
                } else if (filterState.startLine !== null) {
                    lineRange = `行号: ${filterState.startLine}-末尾`;
                } else if (filterState.endLine !== null) {
                    lineRange = `行号: 1-${filterState.endLine}`;
                }
                if (lineRange) {
                    conditions.push(lineRange);
                }
            }
            if (filterState.showRawLine) {
                conditions.push(`显示原始过滤`);
            }

            statusText = `已应用过滤: ${conditions.join(', ')}`;
            statusClass = 'small text-success fw-bold';
        } else {
            statusText = '未应用过滤';
            statusClass = 'small text-muted';
        }
        
        // 更新原始状态元素
        if (filterStatusElement) {
            filterStatusElement.textContent = statusText;
            filterStatusElement.className = statusClass;
        }
        
        // 更新 Golden Layout 中的状态元素
        const glStatusElements = document.querySelectorAll('.gl-filter-status');
        glStatusElements.forEach(el => {
            el.textContent = statusText;
            el.className = `gl-filter-status ${statusClass}`;
        });
    }

    /**
     * 初始化Select2控件
     */
    initSelect2Controls() {
        // 延迟初始化，等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupSelect2Controls();
            });
        } else {
            this.setupSelect2Controls();
        }
    }

    /**
     * 设置Select2控件
     */
    setupSelect2Controls() {
        // 初始化两个图表的Select2控件
        this.initSelect2ForChart(1);
        this.initSelect2ForChart(2);

        console.log('Select2控件已初始化');
    }

    /**
     * 初始化单个图表的Select2控件
     */
    initSelect2ForChart(chartNum) {
        const modalId = `filterModal${chartNum}`;
        const modalElement = document.getElementById(modalId);
        
        // 标签选择器
        const tagSelect = document.getElementById(`filterTag${chartNum}`);
        if (tagSelect) {
            $(tagSelect).select2({
                theme: 'bootstrap4',
                placeholder: '选择标签...',
                allowClear: true,
                width: '100%',
                dropdownParent: $(document.body)
            });
        }

        // 级别选择器
        const levelSelect = document.getElementById(`filterLevel${chartNum}`);
        if (levelSelect) {
            $(levelSelect).select2({
                theme: 'bootstrap4',
                placeholder: '选择级别...',
                allowClear: true,
                width: '100%',
                dropdownParent: $(document.body)
            });
        }

        // PID选择器
        const pidSelect = document.getElementById(`filterPid${chartNum}`);
        if (pidSelect) {
            $(pidSelect).select2({
                theme: 'bootstrap4',
                placeholder: '选择PID...',
                allowClear: true,
                width: '100%',
                dropdownParent: $(document.body)
            });
        }
    }

    /**
     * 更新Select2控件选项
     */
    updateSelect2Controls(chartNum) {
        // 图表2不再有过滤功能，所以跳过图表2的Select2更新
        if (chartNum === 2) {
            console.log('图表2不再有过滤功能，跳过Select2更新');
            return;
        }

        const filename = this.getCurrentFilename(chartNum);
        if (!filename) {
            console.log(`图表${chartNum}没有选择文件，跳过Select2更新`);
            return;
        }

        const entries = this.getAllLogcatEntries(filename);
        if (!entries || entries.length === 0) {
            console.log(`图表${chartNum}文件没有日志数据，跳过Select2更新`);
            return;
        }

        // 更新标签选择器
        this.updateTagSelectOptions(chartNum, entries);

        // 更新PID选择器
        this.updatePidSelectOptions(chartNum, entries);

        console.log(`图表${chartNum}Select2控件选项已更新`);
    }

    /**
     * 更新标签选择器选项
     */
    updateTagSelectOptions(chartNum, entries) {
        const tagSelect = document.getElementById(`filterTag${chartNum}`);
        if (!tagSelect) return;

        // 收集所有唯一的标签
        const uniqueTags = new Set();
        entries.forEach(entry => {
            if (entry.tag && entry.tag.trim() !== '') {
                uniqueTags.add(entry.tag);
            }
        });

        // 保存当前选中的值
        const selectedTags = Array.from(tagSelect.selectedOptions).map(option => option.value);

        // 清空选项
        tagSelect.innerHTML = '';

        // 添加空标签选项
        const emptyOption = document.createElement('option');
        emptyOption.value = '[空标签]';
        emptyOption.textContent = '[空标签]';
        tagSelect.appendChild(emptyOption);

        // 添加标签选项
        Array.from(uniqueTags).sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });

        // 恢复选中的值
        selectedTags.forEach(tag => {
            const option = tagSelect.querySelector(`option[value="${tag}"]`);
            if (option) {
                option.selected = true;
            }
        });

        // 更新Select2显示
        if ($(tagSelect).data('select2')) {
            $(tagSelect).trigger('change');
        }
    }

    /**
     * 更新PID选择器选项
     */
    updatePidSelectOptions(chartNum, entries) {
        const pidSelect = document.getElementById(`filterPid${chartNum}`);
        if (!pidSelect) return;

        // 收集所有唯一的PID - 包括PID=0
        const uniquePids = new Set();
        entries.forEach(entry => {
            if (entry.pid !== undefined && entry.pid !== null) {
                // 包括PID=0
                uniquePids.add(entry.pid.toString());
            }
        });

        // 保存当前选中的值
        const selectedPids = Array.from(pidSelect.selectedOptions).map(option => option.value);

        // 清空选项
        pidSelect.innerHTML = '';

        // 添加PID选项
        Array.from(uniquePids).sort((a, b) => parseInt(a) - parseInt(b)).forEach(pid => {
            const option = document.createElement('option');
            option.value = pid;
            option.textContent = pid;
            pidSelect.appendChild(option);
        });

        // 恢复选中的值
        selectedPids.forEach(pid => {
            const option = pidSelect.querySelector(`option[value="${pid}"]`);
            if (option) {
                option.selected = true;
            }
        });

        // 更新Select2显示
        if ($(pidSelect).data('select2')) {
            $(pidSelect).trigger('change');
        }
    }

    /**
     * 获取过滤后的日志记录
     */
    getFilteredEntries(chartNum, entries) {
        if (!entries) return null;

        // 图表2不再有过滤功能，直接返回所有条目
        if (chartNum === 2) {
            return entries;
        }

        const filterState = this.filterState1;
        if (!filterState.isActive) {
            return entries;
        }

        // 编译正则表达式（如果存在）
        let regex = null;
        if (filterState.regex) {
            try {
                regex = new RegExp(filterState.regex, 'i'); // 不区分大小写
            } catch (error) {
                console.error(`正则表达式错误: ${filterState.regex}`, error);
                this.showAlert(`正则表达式错误: ${error.message}`, 'danger');
                return entries; // 如果正则表达式错误，返回所有条目
            }
        }

        // 首先应用行号过滤（如果指定了行号）
        let filteredByLine = entries;
        if (filterState.startLine !== null || filterState.endLine !== null) {
            filteredByLine = entries.filter((entry, index) => {
                const lineNumber = index + 1; // 行号从1开始
                let lineMatch = true;
                
                if (filterState.startLine !== null && lineNumber < filterState.startLine) {
                    lineMatch = false;
                }
                if (filterState.endLine !== null && lineNumber > filterState.endLine) {
                    lineMatch = false;
                }
                
                return lineMatch;
            });
        }

        // 然后应用其他过滤条件
        return filteredByLine.filter(entry => {
            // 检查标签过滤
            let tagMatch = true;
            if (filterState.tags.length > 0) {
                if (filterState.tags.includes('[空标签]')) {
                    const tag = entry.tag;
                    tagMatch = !tag || tag.trim() === '';
                } else {
                    tagMatch = filterState.tags.includes(entry.tag || '');
                }
            }

            // 检查级别过滤
            let levelMatch = true;
            if (filterState.levels.length > 0) {
                levelMatch = filterState.levels.includes(entry.level || '');
            }

            // 检查PID过滤
            let pidMatch = true;
            if (filterState.pids.length > 0) {
                pidMatch = filterState.pids.includes(entry.pid);
            }

            // 检查正则表达式过滤
            let regexMatch = true;
            if (regex) {
                // 检查消息是否匹配正则表达式
                const message = entry.message || '';
                const tag = entry.tag || '';
                const level = entry.level || '';
                const pid = entry.pid || '';
                const timestamp = entry.timestamp || '';
                
                // 构建完整的日志行进行匹配
                const logLine = `${timestamp} ${level}/${tag}(${pid}): ${message}`;
                regexMatch = regex.test(logLine);
            }

            return tagMatch && levelMatch && pidMatch && regexMatch;
        });
    }
}

// 创建全局实例
let logcatComparisonManager = null;

// 初始化函数
function initLogcatComparisonManager() {
    if (!logcatComparisonManager) {
        logcatComparisonManager = new LogcatComparisonManager();
        window.logcatComparisonManager = logcatComparisonManager;
        console.log('Logcat对比管理器已初始化');
    }
    return logcatComparisonManager;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogcatComparisonManager);
} else {
    initLogcatComparisonManager();
}

// 导出函数，供其他模块调用
window.initLogcatComparisonManager = initLogcatComparisonManager;
