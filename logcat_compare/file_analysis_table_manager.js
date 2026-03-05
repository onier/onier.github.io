let popup = null;
/**
 * FileAnalysisManager - 日志文件分析表格管理器
 * 优化版：仅第一列可点击跳转
 */
class FileAnalysisManager {
    constructor() {
        this.fileData = new Map();
        this.dataTable = null;
        this.tableId = 'logcatFileAnalysisTable';
        //logcat解析数据的结构
        this.stateTableRows = [];
        // 样式配置
        this.config = {
            slowThreshold: 1000,
            verySlowThreshold: 5000
        };
        this.selectFiles = new Set();
        this.injectCustomStyles();
        this.initDataTable();
    }

    injectCustomStyles() {
        const styleId = 'file-analysis-styles';
        if (document.getElementById(styleId)) return;

        const css = `
            /* 表格通用优化 */
            #${this.tableId} { font-size: 0.9rem; }
            #${this.tableId} th { vertical-align: middle; white-space: nowrap; background-color: #f8f9fa; }
            #${this.tableId} td { vertical-align: middle; }
            
            /* 列对齐 */
            .col-number { text-align: right !important; font-family: 'Consolas', monospace; }
            
            /* 文件名链接 - 只有这里显示手型鼠标 */
            .file-link { 
                text-decoration: none; 
                font-weight: 500; 
                color: #0d6efd; 
                cursor: pointer; /* 明确指定手型 */
            }
            .file-link:hover { text-decoration: underline; color: #0a58ca; }
            
            /* 移除行的手型鼠标，避免误导用户以为整行可点 */
            #${this.tableId} tbody tr { cursor: default !important; }
            #${this.tableId} tbody tr:hover { background-color: rgba(0,0,0,0.02); }

            /* 时间和行号样式 */
            .time-cell { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
            .line-badge { 
                font-size: 0.75em; padding: 2px 6px; border-radius: 4px; 
                background-color: #e9ecef; color: #6c757d; border: 1px solid #dee2e6;
            }
            .time-text { white-space: nowrap; }
            .time-slow { color: #dc3545; }
            .time-very-slow { color: #dc3545; font-weight: bold; }
            
            /* 模态框优化 */
            .column-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
            .column-item { padding: 8px; border: 1px solid #dee2e6; border-radius: 4px; background: #fff; }
            
            /* Child rows 样式 */
            .child-row { background-color: #f8f9fa; }
            .child-row td { border-top: 1px solid #dee2e6; border-bottom: 1px solid #dee2e6; }
            .warninfo-table { width: 100%; margin: 0; }
            .warninfo-table th { background-color: #e9ecef; font-weight: 600; }
            .warninfo-table td, .warninfo-table th { padding: 6px 12px; border: 1px solid #dee2e6; }
            .warninfo-badge { 
                display: inline-block; 
                padding: 2px 8px; 
                border-radius: 12px; 
                font-size: 0.8em; 
                font-weight: 500; 
                margin-right: 6px;
            }
            .warninfo-warning { background-color: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
            .warninfo-error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .warninfo-info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
            .expand-btn { 
                cursor: pointer; 
                color: #6c757d; 
                font-size: 0.9em; 
                margin-right: 8px;
                transition: color 0.2s;
            }
            .expand-btn:hover { color: #0d6efd; }
            
            /* 警告数量徽章样式 */
            .warn-count-badge {
                display: inline-block;
                margin-left: 6px;
                padding: 1px 5px;
                font-size: 0.75em;
                font-weight: 600;
                border-radius: 8px;
                background-color: #dc3545;
                color: white;
                vertical-align: middle;
            }
            .warn-count-badge:hover {
                background-color: #c82333;
            }
        `;

        const style = document.createElement('style');
        style.id = styleId;
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    initDataTable() {
        this.initDynamicDataTable([]);
    }

    addFileData(filename, fileSize, stages, warninfo) {
        const fileInfo = {
            filename: filename,
            size: this.formatFileSize(fileSize),
            sizeBytes: fileSize,
            stages: stages || [],
            warninfo: warninfo
        };
        this.fileData.set(filename, fileInfo);
        this.updateTable();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(ms) {
        if (ms === undefined || ms === null || isNaN(ms)) return '-';
        if (ms < 1000) return Math.round(ms) + ' ms';
        if (ms < 60000) return (ms / 1000).toFixed(2) + ' s';
        return (ms / 60000).toFixed(2) + ' min';
    }

    updateTable() {
        if (!this.dataTable) return;

        if (this.fileData.size === 0) {
            this.dataTable.clear().draw();
            return;
        }

        const stageNamesSet = new Set();
        for (const [_, fileInfo] of this.fileData) {
            if (Array.isArray(fileInfo.stages)) {
                fileInfo.stages.forEach(s => {
                    if (s && s.stage) stageNamesSet.add(s.stage);
                });
            }
        }
        let stageNames = [];
        stageNamesSet.forEach(name => {
            stageNames.push(name);
            // if (name !== 'Total') {
            //     stageNamesSet.add('Total');
            // }
        });
        // const stageNames = Array.from(stageNamesSet).sort((a, b) => {
        //     if (a === 'Total') return 1;
        //     if (b === 'Total') return -1;
        //     return a.localeCompare(b);
        // });

        const currentColCount = this.dataTable.columns().count();
        const neededColCount = 2 + stageNames.length;

        if (currentColCount !== neededColCount) {
            this.reinitializeDataTable(stageNames);
        }

        this.dataTable.clear();
        this.stateTableRows = [];

        for (const [filename, fileInfo] of this.fileData) {
            const rowData = [false, filename, fileInfo.sizeBytes];
            stageNames.forEach(stageName => {
                let timeValue = null;
                let line = -1;
                if (stageName === 'Total') {
                    timeValue = fileInfo.stages.reduce((acc, curr) => acc + (curr.time || 0), 0);
                } else {
                    const stage = fileInfo.stages.find(s => s && s.stage === stageName);
                    if (stage && stage.time !== undefined) {
                        timeValue = stage.time;
                        line = stage.startIndex;
                    }
                }
                rowData.push({ timeValue, line });
            });
            this.stateTableRows.push(rowData);
        }

        this.dataTable.rows.add(this.stateTableRows);
        this.dataTable.draw();
    }

    reinitializeDataTable(stageNames) {
        if (this.dataTable) {
            // 销毁前解绑事件，防止内存泄漏
            $(`#${this.tableId} tbody`).off('click');
            this.dataTable.destroy();
            $('#' + this.tableId).empty();
            this.dataTable = null;
        }
        this.initDynamicDataTable(stageNames);
    }
    deleteByIndex(set, index) {
        const arr = [...set];           // 把 Set 转成数组
        if (index < 0 || index >= arr.length) return false;
        set.delete(arr[index]);         // 按值删除对应元素
        return true;
    }

    initDynamicDataTable(stageNames) {
        this.stageNames = stageNames;
        if (!$.fn.DataTable) return;

        const columns = [
            {
                title: '选择',
                className: 'text-start',
                render: this.reanderSelect.bind(this)
            },
            {
                title: '文件名',
                className: 'text-start',
                render: this.renderFilename.bind(this)
            },
            {
                title: '大小',
                className: 'col-number',
                render: this.renderFileSize.bind(this)
            }
        ];

        stageNames.forEach(stageName => {
            columns.push({
                title: stageName,
                className: 'col-number',
                render: this.renderTimeColumn.bind(this)
            });
        });

        this.dataTable = $(`#${this.tableId}`).DataTable({
            columns: columns,
            autoWidth: false,
            scrollX: true,
            pageLength: 50,
            order: [[0, 'asc']],
            language: {
                search: "",
                searchPlaceholder: "搜索文件名...",
                lengthMenu: "_MENU_ 条/页",
                info: "显示 _START_ - _END_ (共 _TOTAL_ 条)",
                infoEmpty: "无数据",
                paginate: { first: "«", previous: "‹", next: "›", last: "»" }
            },
            dom: "<'row mb-2'<'col-sm-6'l><'col-sm-6'f>>" +
                "<'row'<'col-sm-12'tr>>" +
                "<'row mt-2'<'col-sm-5'i><'col-sm-7'p>>",
            // 【关键修改】移除 createdRow 中的双击事件绑定
            createdRow: (row, data) => {
                // 不再绑定 $(row).on('dblclick')
                // 不再设置 $(row).css('cursor', 'pointer')
            },
            drawCallback: () => {
                // Tooltip 初始化
                if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
                    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
                    tooltipTriggerList.map(function (tooltipTriggerEl) {
                        return new bootstrap.Tooltip(tooltipTriggerEl);
                    });
                }
            }
        });

        // 【关键修改】使用事件委托绑定点击事件
        // 这样无论表格翻页还是重绘，只要是 .logcat-file-link 类的元素被点击，都会触发
        // 且只响应这个类的点击，不响应行的其他部分
        $(`#${this.tableId} tbody`).off('click', '.logcat-file-link').on('click', '.logcat-file-link', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            e.preventDefault();  // 阻止默认链接跳转
            const filename = $(e.currentTarget).data('filename');
            this.handleLogcatFileClick(filename);
        });
        $(`#${this.tableId} tbody`).off('click', '.file-select-checkbox').on('click', '.file-select-checkbox', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const checkbox = e.currentTarget;
            const filename = $(checkbox).data('filename');
            if (this.selectFiles.has(filename)) {
                this.selectFiles.delete(filename);
            } else {
                if (this.selectFiles.size == 4) {
                    this.deleteByIndex(this.selectFiles, 0);
                }
                this.selectFiles.add(filename);
            }
            if (this.dataTable)
                this.dataTable.rows().invalidate().draw();
        });
        // 绑定展开/折叠按钮点击事件
        $(`#${this.tableId} tbody`).off('click', '.expand-btn').on('click', '.expand-btn', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const filename = $(e.currentTarget).data('filename');
            this.toggleChildRow(filename, e.currentTarget);
        });

        if (window.fileAnalysisManager) {
            setTimeout(() => window.fileAnalysisManager.initColumnFilterControls(), 100);
        }
    }

    reanderSelect(data, type, row, meta) {
        const filename = row[1];
        if (this.selectFiles.has(filename)) {
            return `<input type="checkbox" 
           class="file-select-checkbox" 
           data-filename="${filename}" checked>`;
        } else {
            return `<input type="checkbox" 
           class="file-select-checkbox" 
           data-filename="${filename}">`;
        }
    }

    renderFilename(data, type) {
        if (type === 'display' && data) {
            const shortName = data.length > 25 ? data.substring(0, 22) + '...' : data;
            const fileInfo = this.fileData.get(data);
            const warnCount = fileInfo && fileInfo.warninfo ? fileInfo.warninfo.length : 0;
            const hasWarninfo = warnCount > 0;

            // 警告数量徽章
            const warnBadge = hasWarninfo
                ? `<span class="warn-count-badge" title="${warnCount} 个警告">[${warnCount}]个性能警告</span>`
                : '';

            const expandIcon = hasWarninfo
                ? `<span class="expand-btn" data-filename="${data}" title="点击展开/折叠警告信息">
                     <i class="bi bi-chevron-right"></i>
                   </span>`
                : '';

            // 只有这个 <a> 标签有 file-link 类，只有它可点击
            return `${expandIcon}<a href="javascript:void(0)" class="logcat-file-link file-link" 
                       data-filename="${data}" title="点击分析: ${data}">
                       <i class="bi bi-file-text me-1"></i>${shortName}${warnBadge}
                    </a>`;
        }
        return data;
    }

    renderFileSize(data, type) {
        if (type === 'display' && data !== null) return this.formatFileSize(data);
        return data;
    }

    renderTimeColumn(data, type) {
        if (type === 'display') {
            if (!data || data.timeValue === null) return '<span class="text-muted">-</span>';
            const ms = data.timeValue;
            const timeStr = this.formatTime(ms);
            let timeClass = 'time-text';
            if (ms > this.config.verySlowThreshold) timeClass += ' time-very-slow';
            else if (ms > this.config.slowThreshold) timeClass += ' time-slow';
            const lineHtml = data.line !== -1
                ? `<span class="line-badge" data-bs-toggle="tooltip" title="Line: ${data.line}">L:${data.line}</span>`
                : '';
            return `<div class="time-cell"><span class="${timeClass}">${timeStr}</span>${lineHtml}</div>`;
        }
        return data && data.timeValue !== null ? data.timeValue : -1;
    }

    // ... 其他方法保持不变 (clearAll, exportToCsv, handleLogcatFileClick, showAlert, initColumnFilterControls 等) ...

    clearAll() {
        this.fileData.clear();
        if (this.dataTable) this.dataTable.clear().draw();
    }

    getExportLogcatTable() {
        let headers = [];
        this.dataTable.columns().every(function () {
            let key = $(this.header()).text().trim();
            if (key != '选择' && key != '大小') {
                headers.push(key);
            }
        });
        let tableData = this.dataTable.data().toArray();
        let logcatStageRowDatas = new Map();
        tableData.forEach(row => {
            let logcatStageRowData = [];
            logcatStageRowData.push(row[1]);
            for (let i = 3; i < row.length; i++) {
                const ms = row[i].timeValue;
                const timeStr = this.formatTime(ms);
                logcatStageRowData.push(timeStr);
            }
            logcatStageRowDatas.set(row[1], logcatStageRowData);
        });

        return {
            headers: headers,
            logcatStageRowDatas: logcatStageRowDatas
        };
    }
    getExportResultTable() {
        let headers = [];
        let resultTableData = window.dosFileAnalysisManager.dataTable.data().toArray();
        if (resultTableData.length > 0) {
            Object.keys(resultTableData[0]).forEach(key => {
                headers.push(key);
            });
        }
        let resultTableRowDatas = new Map();
        for (let i = 0; i < resultTableData.length; i++) {
            let temp = resultTableData[i];
            let rowDatas = []
            headers.forEach(key => {
                rowDatas.push(temp[key]);
            });
            resultTableRowDatas.set(temp.logcatFile, rowDatas)
        }
        return {
            headers: headers,
            resultTableRowDatas: resultTableRowDatas
        }
    }

    exportToCsv() {
        let data1 = this.getExportLogcatTable();
        let data2 = this.getExportResultTable();
        if (!this.dataTable || this.fileData.size === 0) {
            this.showAlert('没有数据可导出', 'warning');
            return;
        }
        let headers = data1.headers.concat(data2.headers);
        let datas = [];
        data1.logcatStageRowDatas.forEach((value, key) => {
            let rowData = value.concat(data2.resultTableRowDatas.get(key));
            datas.push(rowData);
        });
        try {
            let csvContent = '\uFEFF' + headers.map(h => this.escapeCsvField(h)).join(',') + '\n';
            datas.forEach(row => {
                const csvRow = row.map((cell, index) => {
                    // 其他列直接转义
                    return this.escapeCsvField(cell);
                });
                csvContent += csvRow.join(',') + '\n';
            });
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Analysis_Result_${new Date().getTime()}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showAlert('CSV 导出成功', 'success');
        } catch (error) {
            this.showAlert(`导出失败: ${error.message}`, 'danger');
        }
    }

    escapeCsvField(field) {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    handleLogcatFileClick(filename) {
        if (typeof window.switchToLogAnalysis === 'function') {
            window.switchToLogAnalysis();
            setTimeout(() => {
                const select = $('#logFileSelect1');
                if (select.length) {
                    select.val(filename).trigger('change');
                    this.showAlert(`已加载文件: ${filename}`, 'success');
                }
            }, 300);
        } else {
            this.showAlert('无法切换面板，函数未定义', 'danger');
        }
    }

    showAlert(message, type = 'info') {
        const icon = type === 'success' ? 'check-circle' : type === 'danger' ? 'x-circle' : 'info-circle';
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show shadow-sm" style="position: fixed; top: 80px; right: 20px; z-index: 9999; min-width: 300px;">
                <i class="bi bi-${icon} me-2"></i>${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', alertHtml);
        setTimeout(() => $('.alert-dismissible').alert('close'), 4000);
    }

    initColumnFilterControls() {
        if (document.getElementById('columnFilterBtn')) return;
        const cardHeader = document.querySelector('.card-header.bg-success .d-flex') ||
            document.querySelector('.card-header.bg-success');
        if (!cardHeader) return;
        const btn = document.createElement('button');
        btn.id = 'columnFilterBtn';
        btn.className = 'btn btn-light btn-sm ms-2 shadow-sm';
        btn.innerHTML = '<i class="bi bi-layout-three-columns me-1"></i>打开文件';
        btn.onclick = (e) => { e.stopPropagation(); this.showColumnFilterModal(); };
        cardHeader.appendChild(btn);
    }

    showColumnFilterModal() {
        let url = "monaco.html?";
        const arr = [...this.selectFiles];
        for (let i = 0; i < Math.min(arr.length, 4); i++) {
            let fileParam = encodeURIComponent(arr[i]);
            url += "file" + (i + 1) + "=" + fileParam + "&";
        }
        popup = window.open(url);
    }

    /**
     * 切换 Child row 的展开/折叠状态
     */
    toggleChildRow(filename, expandBtn) {
        const row = $(expandBtn).closest('tr');
        const tr = row[0];

        // 检查是否已经展开
        if ($(tr).hasClass('shown')) {
            // 如果已经展开，则关闭
            this.dataTable.row(tr).child.hide();
            $(tr).removeClass('shown');
            $(expandBtn).find('i').removeClass('bi-chevron-down').addClass('bi-chevron-right');
        } else {
            // 如果未展开，则显示 Child row
            const fileInfo = this.fileData.get(filename);
            if (!fileInfo || !fileInfo.warninfo || fileInfo.warninfo.length === 0) {
                return;
            }

            const childContent = this.formatWarninfo(fileInfo.warninfo);
            this.dataTable.row(tr).child(childContent, 'child-row').show();
            $(tr).addClass('shown');
            $(expandBtn).find('i').removeClass('bi-chevron-right').addClass('bi-chevron-down');
        }
    }

    /**
     * 格式化 warninfo 数据为 HTML 表格
     * 根据简化后的数据结构：只显示 type 和 originalEntry.message
     */
    formatWarninfo(warninfo) {
        if (!warninfo || warninfo.length === 0) {
            return '<div class="p-3 text-muted">无警告信息</div>';
        }

        let tableHtml = `
            <div class="p-3">
                <h6 class="mb-3">警告信息 (${warninfo.length} 条)</h6>
                <table class="warninfo-table">
                    <thead>
                        <tr>
                            <th style="width: 120px;">类型</th>
                            <th>消息内容</th>
                        </tr>
                    </thead>
                    <tbody>`;

        warninfo.forEach((warn, index) => {
            const typeClass = this.getWarninfoTypeClass(warn.type);
            const typeBadge = `<span class="warninfo-badge ${typeClass}">${warn.type || '未知类型'}</span>`;

            // 从 originalEntry 获取消息内容
            let message = '';
            if (warn.originalEntry && warn.originalEntry.line) {
                message = warn.originalEntry.line;
            } else if (warn.message) {
                message = warn.message;
            }

            tableHtml += `
                <tr>
                    <td>${typeBadge}</td>
                    <td class="text-start">${this.escapeHtml(message)}</td>
                </tr>`;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>`;

        return tableHtml;
    }

    /**
     * 根据警告类型获取 CSS 类名
     * 支持新的警告类型："杀进程警告"和"电池电量警告"
     */
    getWarninfoTypeClass(type) {
        if (!type) return 'warninfo-info';

        const typeLower = type.toLowerCase();

        // 处理新的警告类型
        if (typeLower.includes('杀进程') || typeLower.includes('process kill') || typeLower.includes('killer')) {
            return 'warninfo-error';  // 杀进程警告用红色
        }
        if (typeLower.includes('电池') || typeLower.includes('battery') || typeLower.includes('电量')) {
            return 'warninfo-warning';  // 电池警告用黄色
        }

        // 原有的类型处理
        if (typeLower.includes('error') || typeLower.includes('err')) {
            return 'warninfo-error';
        } else if (typeLower.includes('warn') || typeLower.includes('warning')) {
            return 'warninfo-warning';
        } else {
            return 'warninfo-info';
        }
    }

    /**
     * 转义 HTML 特殊字符
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化
let fileAnalysisManager = null;
function initFileAnalysisManager() {
    if (!fileAnalysisManager) {
        fileAnalysisManager = new FileAnalysisManager();
        window.fileAnalysisManager = fileAnalysisManager;
    }
    window.addEventListener('message', (event) => {
        let datas = [];
        fileAnalysisManager.selectFiles.forEach((file) => {
            if (window.logcatManager.logcatEntryMap.hasOwnProperty(file)) {
                datas.push({
                    file: file,
                    enties: window.logcatManager.logcatEntryMap[file],
                    states: window.logcatManager.logcatStageMap[file]
                });
            }
        });
        popup.postMessage(datas, '*');

        // if (event.data === 'I_AM_READY') {
        //     console.log("子页面已就绪，开始发送大数据...");

        //     // 3. 发送数据 (关键在第二个参数)
        //     // postMessage(message, targetOrigin, [transferables])
        //     // '*' 表示不限制目标源（解决 file:// 跨域问题）
        //     popup.postMessage(hugeBuffer, '*', [hugeBuffer]);

        //     console.log("数据已发送！注意：父页面的 hugeBuffer 长度现在变为 0 (所有权已转移)");
        //     console.log("父页面 buffer 长度:", hugeBuffer.byteLength); // 输出 0
        // }
    });
    return fileAnalysisManager;
}
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => { initFileAnalysisManager(); initExportButton(); }, 100);
});
function initExportButton() {
    const btn = document.getElementById('exportAnalysisCsvBtn');
    if (btn) btn.onclick = () => window.fileAnalysisManager && window.fileAnalysisManager.exportToCsv();
    else setTimeout(initExportButton, 1000);
}
