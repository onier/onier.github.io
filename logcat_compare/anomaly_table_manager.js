/**
 * 异常数据库表管理器
 * 负责创建和管理异常数据表格，显示开机时间异常的数据
 */
class AnomalyTableManager {
    constructor() {
        this.tableId = '#anomalyAnalysisTable';
        this.dataTable = null;
        this.selectedFiles = new Set(); // 存储选中的文件名
        this.initialize();
    }

    /**
     * 初始化管理器
     */
    initialize() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupControls());
        } else {
            this.setupControls();
        }
    }

    /**
     * 设置控制按钮事件
     */
    setupControls() {
        // 全选复选框事件（使用事件委托，因为表格可能重新渲染）
        $(document).on('click', '#selectAllCheckbox', (e) => {
            const isChecked = $(e.target).prop('checked');
            $('.row-checkbox').prop('checked', isChecked);
            
            // 更新选中文件集合
            if (isChecked) {
                $('.row-checkbox').each((index, checkbox) => {
                    const fileName = $(checkbox).data('filename');
                    if (fileName) this.selectedFiles.add(fileName);
                });
            } else {
                this.selectedFiles.clear();
            }
            
            this.updateSelectedCount();
        });

        // 行复选框事件
        $(document).on('change', '.row-checkbox', (e) => {
            const checkbox = e.target;
            const fileName = $(checkbox).data('filename');
            const isChecked = $(checkbox).prop('checked');
            
            if (isChecked) {
                this.selectedFiles.add(fileName);
            } else {
                this.selectedFiles.delete(fileName);
                // 取消全选复选框
                $('#selectAllCheckbox').prop('checked', false);
            }
            
            this.updateSelectedCount();
        });

        // 打开选中文件按钮
        $(document).on('click', '#openSelectedFilesBtn', () => {
            this.openSelectedFiles();
        });

        // 导出选中数据按钮
        $(document).on('click', '#exportSelectedDataBtn', () => {
            this.exportSelectedData();
        });
    }

    /**
     * 更新表格数据
     * @param {Array} allResultDatas 所有数据对象数组
     */
    updateTable(allResultDatas) {
        // 1. 过滤异常数据
        const anomalyData = this.filterAnomalies(allResultDatas);
        
        // 2. 数据校验
        if (!Array.isArray(anomalyData) || anomalyData.length === 0) {
            this.clearAll();
            this.showAlert('没有异常数据可显示', 'info');
            return;
        }

        // 3. 销毁旧表格实例
        if ($.fn.DataTable.isDataTable(this.tableId)) {
            $(this.tableId).DataTable().destroy();
            $(this.tableId).empty();
        }

        // 4. 构建列定义
        const columns = this.buildColumns(anomalyData[anomalyData.length - 1]);

        const self = this; // 保存上下文

        // 5. 初始化 DataTable
        this.dataTable = $(this.tableId).DataTable({
            data: anomalyData,
            columns: columns,
            destroy: true,
            autoWidth: false,
            scrollX: true,
            pageLength: 50,
            order: [],
            className: 'table table-striped table-bordered table-hover',
            language: {
                search: "搜索:",
                lengthMenu: "显示 _MENU_ 条",
                info: "第 _START_ - _END_ 条 / 共 _TOTAL_ 条",
                infoEmpty: "无数据",
                infoFiltered: "(从 _MAX_ 条过滤)",
                zeroRecords: "未找到匹配记录",
                paginate: { first: "首页", previous: "上页", next: "下页", last: "末页" }
            },
            // 行渲染回调
            createdRow: function (row, data, dataIndex) {
                $(row).css('cursor', 'pointer');
                
                // 绑定双击事件 - 使用 Monaco Editor 显示文件内容
                $(row).on('dblclick', function () {
                    const logcatKey = Object.keys(data).find(k => k.toLowerCase() === 'logcatfile');
                    const logcatFileName = logcatKey ? data[logcatKey] : null;
                    if (logcatFileName) {
                        self.showFileInMonaco(logcatFileName);
                    }
                });
            },
            // 绘制回调
            drawCallback: function () {
                // 绑定链接点击事件
                $(self.tableId + ' tbody').off('click', '.logcat-file-link').on('click', '.logcat-file-link', function (e) {
                    e.stopPropagation();
                    const fileName = $(this).data('filename');
                    self.handleLogcatFileClick(fileName);
                });
                
                // 更新选中状态
                $('.row-checkbox').each((index, checkbox) => {
                    const fileName = $(checkbox).data('filename');
                    $(checkbox).prop('checked', self.selectedFiles.has(fileName));
                });
                
                // 更新全选复选框状态
                const totalRows = $(self.tableId + ' tbody tr').length;
                const checkedRows = $(self.tableId + ' tbody .row-checkbox:checked').length;
                $('#selectAllCheckbox').prop('checked', totalRows > 0 && totalRows === checkedRows);
                
                self.updateSelectedCount();
            }
        });

        console.log(`异常数据库表格已更新，共 ${anomalyData.length} 条异常数据`);
        this.updateSelectedCount();
    }

    /**
     * 过滤异常数据
     * @param {Array} allResultDatas 所有数据
     * @returns {Array} 异常数据
     */
    filterAnomalies(allResultDatas) {
        if (!Array.isArray(allResultDatas) || allResultDatas.length === 0) {
            return [];
        }

        // 过滤有效数据
        const validData = allResultDatas.filter(item => {
            return item.Temp !== undefined && item.PowerOnTime !== undefined &&
                   !isNaN(parseFloat(item.Temp)) && !isNaN(parseFloat(item.PowerOnTime));
        });

        if (validData.length === 0) {
            return [];
        }

        // 计算最小开机时间和异常阈值
        const powerOnTimes = validData.map(item => parseFloat(item.PowerOnTime));
        const minTime = Math.min(...powerOnTimes);
        const anomalyThreshold = minTime + 20; // 20秒 = 20000毫秒

        // 过滤异常数据
        return validData.filter(item => {
            const powerOnTime = parseFloat(item.PowerOnTime);
            return powerOnTime > anomalyThreshold;
        }).map(item => {
            // 确保数值类型
            return {
                ...item,
                Temp: parseFloat(item.Temp),
                PowerOnTime: parseFloat(item.PowerOnTime)
            };
        });
    }

    /**
     * 根据数据对象构建列定义
     * @param {Object} sampleRow 样本数据行
     * @returns {Array} DataTable 列配置数组
     */
    buildColumns(sampleRow) {
        if (!sampleRow) return [];

        const columns = [];
        
        // 第一列：复选框选择列
        columns.push({
            title: '<input type="checkbox" id="selectAllCheckbox" title="全选/取消全选">',
            data: null,
            orderable: false,
            searchable: false,
            width: '40px',
            className: 'text-center',
            render: (data, type, row, meta) => {
                const logcatKey = Object.keys(row).find(k => k.toLowerCase() === 'logcatfile');
                const fileName = logcatKey ? row[logcatKey] : '';
                const isChecked = this.selectedFiles.has(fileName) ? 'checked' : '';
                return `<input type="checkbox" class="row-checkbox" data-filename="${fileName}" data-index="${meta.row}" ${isChecked}>`;
            }
        });

        // 其他列（动态生成）
        const keys = Object.keys(sampleRow);
        keys.forEach(key => {
            // 跳过logcatfile，我们会在后面特殊处理
            if (key.toLowerCase() === 'logcatfile') return;
            
            const colDef = {
                title: key,
                data: key,
                defaultContent: '-',
                className: 'text-nowrap'
            };

            // 默认渲染器
            colDef.render = function(data, type, row) {
                return (data === null || data === undefined || data === '') ? '-' : data;
            };

            columns.push(colDef);
        });

        // 添加logcatFile列（特殊处理）
        const logcatKey = Object.keys(sampleRow).find(k => k.toLowerCase() === 'logcatfile');
        if (logcatKey) {
            columns.push({
                title: logcatKey,
                data: logcatKey,
                defaultContent: '-',
                className: 'text-nowrap',
                render: function(data, type, row) {
                    if (type === 'display' && data) {
                        return `<a href="javascript:void(0)" 
                                   class="logcat-file-link text-primary fw-bold" 
                                   style="text-decoration: underline;"
                                   data-filename="${data}" 
                                   title="点击分析此文件">
                                   <i class="bi bi-file-text me-1"></i>${data}
                                </a>`;
                    }
                    return data || '-';
                }
            });
        }

        return columns;
    }

    /**
     * 打开选中的文件
     */
    openSelectedFiles() {
        if (this.selectedFiles.size === 0) {
            this.showAlert('请先选择要打开的文件', 'warning');
            return;
        }

        const files = Array.from(this.selectedFiles);
        console.log(`准备打开 ${files.length} 个文件:`, files);
        
        // 逐个打开文件（可以改为批量打开）
        files.forEach((fileName, index) => {
            setTimeout(() => {
                this.handleLogcatFileClick(fileName);
            }, index * 500); // 间隔500ms，避免同时切换导致问题
        });

        this.showAlert(`正在打开 ${files.length} 个文件...`, 'success');
    }

    /**
     * 导出选中数据
     */
    exportSelectedData() {
        if (this.selectedFiles.size === 0) {
            this.showAlert('请先选择要导出的数据', 'warning');
            return;
        }

        if (!this.dataTable) {
            this.showAlert('表格数据未初始化', 'danger');
            return;
        }

        // 获取选中行的数据
        const selectedData = [];
        const allData = this.dataTable.rows().data().toArray();
        
        allData.forEach(row => {
            const logcatKey = Object.keys(row).find(k => k.toLowerCase() === 'logcatfile');
            const fileName = logcatKey ? row[logcatKey] : '';
            
            if (this.selectedFiles.has(fileName)) {
                selectedData.push(row);
            }
        });

        if (selectedData.length === 0) {
            this.showAlert('未找到选中的数据', 'warning');
            return;
        }

        // 导出为CSV
        this.exportToCsv(selectedData);
    }

    /**
     * 导出数据为CSV
     * @param {Array} data 数据数组
     */
    exportToCsv(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return;
        }

        // 获取列标题
        const headers = Object.keys(data[0]);
        
        // 构建CSV内容
        let csvContent = headers.join(',') + '\n';
        
        data.forEach(row => {
            const rowValues = headers.map(header => {
                const value = row[header];
                // 处理特殊字符
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                // 如果包含逗号、引号或换行符，用引号括起来
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return '"' + stringValue.replace(/"/g, '""') + '"';
                }
                return stringValue;
            });
            csvContent += rowValues.join(',') + '\n';
        });

        // 创建下载链接
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `异常数据_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showAlert(`已导出 ${data.length} 条数据`, 'success');
    }

    /**
     * 处理文件点击/跳转逻辑
     */
    handleLogcatFileClick(logcatFileName) {
        if (!logcatFileName) return;
        
        console.log('准备切换并分析文件:', logcatFileName);

        // 1. 切换面板
        if (typeof window.switchToLogAnalysis === 'function') {
            window.switchToLogAnalysis();
        } else {
            console.error('全局函数 switchToLogAnalysis 未定义');
            this.showAlert('系统错误：无法切换面板', 'danger');
            return;
        }

        // 2. 延迟设置 Select2
        setTimeout(() => {
            const $select = $('#logFileSelect1');
            
            if ($select.length === 0) {
                this.showAlert('找不到文件选择器组件', 'danger');
                return;
            }

            // 检查选项是否存在
            if ($select.find(`option[value="${logcatFileName}"]`).length === 0) {
                this.showAlert(`文件列表中未找到: ${logcatFileName}`, 'warning');
                return;
            }

            // 设置值并触发 change 事件
            $select.val(logcatFileName).trigger('change');
            
            this.showAlert(`已加载日志文件: ${logcatFileName}`, 'success');

        }, 300);
    }

    /**
     * 在 Monaco Editor 中显示文件内容
     * @param {string} filename 文件名
     */
    async showFileInMonaco(filename) {
        if (!filename) {
            this.showAlert('文件名不能为空', 'warning');
            return;
        }

        // 获取 FileUtils 实例
        if (!window.fileUtils) {
            this.showAlert('FileUtils 未初始化', 'danger');
            return;
        }

        // 检查文件数组是否已加载
        if (!window.fileUtils.files || !Array.isArray(window.fileUtils.files) || window.fileUtils.files.length === 0) {
            this.showAlert('没有可用的文件数据，请先上传文件', 'warning');
            return;
        }

        // 显示加载状态
        this.showAlert(`正在加载文件: ${filename}...`, 'info');

        try {
            // 使用 readFileContent 读取文件内容（现在只接受一个参数）
            const content = await window.fileUtils.readFileContent(filename);
            
            if (content === null) {
                this.showAlert(`无法读取文件: ${filename}`, 'danger');
                return;
            }

            // 打开 Monaco Editor 查看器
            this.openMonacoViewer(filename, content);
            
        } catch (error) {
            console.error('读取文件时出错:', error);
            this.showAlert(`读取文件失败: ${error.message}`, 'danger');
        }
    }

    /**
     * 打开 Monaco Editor 查看器
     * @param {string} filename 文件名
     * @param {string} content 文件内容
     */
    openMonacoViewer(filename, content) {
        // 创建或获取模态框
        let modal = document.getElementById('monacoViewerModal');
        if (!modal) {
            modal = this.createMonacoViewerModal();
        }

        // 创建 iframe
        const iframe = document.getElementById('monacoViewerIframe');
        if (!iframe) {
            this.showAlert('Monaco Viewer 初始化失败', 'danger');
            return;
        }

        // 设置 iframe 源
        const baseUrl = window.location.origin + window.location.pathname;
        const monacoUrl = baseUrl.replace(/[^/]*$/, '') + 'monaco.html';
        iframe.src = monacoUrl;

        // 显示模态框
        $(modal).modal('show');

        // 等待 iframe 加载完成后发送文件内容
        iframe.onload = () => {
            try {
                // 将文件内容转换为 monaco.html 期望的格式
                // monaco.html 期望接收一个数组，每个元素包含 file 和 enties 字段
                const lines = content.split('\n');
                const enties = lines.map((line, index) => ({
                    line: line,
                    lineNumber: index + 1
                }));
                
                // 发送符合 monaco.html 格式的消息
                iframe.contentWindow.postMessage([{
                    file: filename,
                    enties: enties
                }], '*');
                
                this.showAlert(`文件已加载到 Monaco Editor: ${filename}`, 'success');
            } catch (error) {
                console.error('发送消息到 iframe 失败:', error);
                this.showAlert('无法在 Monaco Editor 中显示文件', 'danger');
            }
        };

        // 设置超时处理，确保消息发送
        setTimeout(() => {
            if (iframe.contentWindow) {
                try {
                    const lines = content.split('\n');
                    const enties = lines.map((line, index) => ({
                        line: line,
                        lineNumber: index + 1
                    }));
                    
                    iframe.contentWindow.postMessage([{
                        file: filename,
                        enties: enties
                    }], '*');
                } catch (error) {
                    console.error('发送消息到 iframe 失败:', error);
                }
            }
        }, 1000);
    }

    /**
     * 创建 Monaco Viewer 模态框
     * @returns {HTMLElement} 模态框元素
     */
    createMonacoViewerModal() {
        // 创建模态框HTML
        const modalHtml = `
            <div class="modal fade" id="monacoViewerModal" tabindex="-1" aria-labelledby="monacoViewerModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title" id="monacoViewerModalLabel">
                                <i class="bi bi-file-code me-2"></i>Monaco Editor 文件查看器
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-0">
                            <iframe id="monacoViewerIframe" 
                                    style="width: 100%; height: calc(100vh - 120px); border: none;"
                                    title="Monaco Editor 文件查看器"
                                    allowfullscreen>
                            </iframe>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="bi bi-x-circle me-1"></i>关闭
                            </button>
                            <button type="button" class="btn btn-primary" onclick="window.anomalyTableManager.refreshMonacoViewer()">
                                <i class="bi bi-arrow-clockwise me-1"></i>刷新
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加CSS样式
        const styleId = 'monaco-viewer-styles';
        if (!document.getElementById(styleId)) {
            const css = `
                #monacoViewerModal .modal-fullscreen {
                    max-width: 100%;
                    margin: 0;
                }
                #monacoViewerModal .modal-content {
                    height: 100vh;
                    border-radius: 0;
                }
                #monacoViewerModal .modal-body {
                    overflow: hidden;
                    padding: 0;
                }
                #monacoViewerIframe {
                    background-color: #f8f9fa;
                }
            `;
            const style = document.createElement('style');
            style.id = styleId;
            style.type = 'text/css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        }

        // 添加模态框到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 初始化 Bootstrap 模态框
        const modalElement = document.getElementById('monacoViewerModal');
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            new bootstrap.Modal(modalElement);
        }

        return modalElement;
    }

    /**
     * 刷新 Monaco Viewer
     */
    refreshMonacoViewer() {
        const iframe = document.getElementById('monacoViewerIframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.location.reload();
        }
    }

    /**
     * 更新选中计数显示
     */
    updateSelectedCount() {
        const count = this.selectedFiles.size;
        const countElement = $('#selectedFilesCount');
        if (countElement.length > 0) {
            countElement.text(count);
        }
    }

    /**
     * 清空表格
     */
    clearAll() {
        if ($.fn.DataTable.isDataTable(this.tableId)) {
            $(this.tableId).DataTable().clear().draw();
        } else {
            $(this.tableId).empty();
        }
        this.selectedFiles.clear();
        this.updateSelectedCount();
    }

    /**
     * 显示 Toast 提示
     */
    showAlert(message, type = 'info') {
        const iconMap = {
            success: 'check-circle',
            warning: 'exclamation-triangle',
            danger: 'x-circle',
            info: 'info-circle'
        };

        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show shadow-sm border-${type}" role="alert" 
                 style="position: fixed; top: 80px; right: 20px; z-index: 10050; min-width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div class="d-flex align-items-center">
                    <i class="bi bi-${iconMap[type] || 'info-circle'} me-2 fs-5"></i>
                    <div>${message}</div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        const $alert = $(alertHtml);
        $('body').append($alert);

        // 自动销毁
        setTimeout(() => {
            $alert.alert('close');
            setTimeout(() => $alert.remove(), 150);
        }, 4000);
    }
}

// 全局初始化逻辑
(function() {
    let instance = null;

    function init() {
        if (!instance) {
            instance = new AnomalyTableManager();
            window.anomalyTableManager = instance;
            console.log('异常数据库表管理器已初始化');
        }
        return instance;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    } else {
        setTimeout(init, 100);
    }
})();
