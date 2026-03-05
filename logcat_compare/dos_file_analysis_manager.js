class DosFileAnalysisManager {
    constructor() {
        this.tableId = '#dosFileAnalysisTable';
        this.dataTable = null;
    }

    /**
     * 更新表格数据
     * @param {Array} resultDatas 数据对象数组
     */
    updateTable(resultDatas) {
        // 1. 数据校验
        if (!Array.isArray(resultDatas) || resultDatas.length === 0) {
            this.clearAll();
            this.showAlert('没有可显示的数据', 'warning');
            return;
        }

        // 2. 销毁旧表格实例 (防止重复初始化报错)
        if ($.fn.DataTable.isDataTable(this.tableId)) {
            $(this.tableId).DataTable().destroy();
            $(this.tableId).empty(); // 清空 DOM 内容，包括 thead
        }

        // 3. 构建列定义
        const columns = this.buildColumns(resultDatas[resultDatas.length-1]);

        const self = this; // 保存上下文

        // 4. 初始化 DataTable
        this.dataTable = $(this.tableId).DataTable({
            data: resultDatas, // 直接传入对象数组，无需手动转换为二维数组
            columns: columns,  // 使用带有 data 属性的列定义
            destroy: true,     // 确保彻底销毁旧实例
            autoWidth: false,  // 禁用自动宽度计算，提高性能
            scrollX: true,     // 开启水平滚动
            pageLength: 50,
            order: [],         // 默认不排序，保留原始数据顺序
            // 添加 Bootstrap 样式类
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
                // 添加鼠标手势
                $(row).css('cursor', 'pointer');
                
                // 绑定双击事件
                $(row).on('dblclick', function () {
                    // 不区分大小写查找 logcatFile 属性
                    const logcatKey = Object.keys(data).find(k => k.toLowerCase() === 'logcatfile');
                    const logcatFileName = logcatKey ? data[logcatKey] : null;

                    if (logcatFileName) {
                        console.log('双击行，文件名:', logcatFileName);
                        self.handleLogcatFileClick(logcatFileName);
                    } else {
                        self.showAlert('该行没有关联的 logcat 文件', 'warning');
                    }
                });
            },
            // 绘制回调
            drawCallback: function () {
                // 绑定链接点击事件 (使用事件委托，性能更好)
                $(self.tableId + ' tbody').off('click', '.logcat-file-link').on('click', '.logcat-file-link', function (e) {
                    e.stopPropagation(); // 阻止冒泡，防止触发行点击
                    const fileName = $(this).data('filename');
                    self.handleLogcatFileClick(fileName);
                });
            }
        });

        console.log(`DOS 文件分析表格已更新，共 ${resultDatas.length} 行数据`);
    }

    /**
     * 根据数据对象构建列定义
     * @param {Object} sampleRow 样本数据行
     * @returns {Array} DataTable 列配置数组
     */
    buildColumns(sampleRow) {
        if (!sampleRow) return [];

        const columns = [];
        const keys = Object.keys(sampleRow);

        keys.forEach(key => {
            const colDef = {
                title: key,
                data: key, // 关键：绑定数据字段名
                defaultContent: '-', // 数据缺失时显示的默认值
                className: 'text-nowrap' // 防止表头换行
            };

            // 特殊处理 logcatFile 列
            if (key.toLowerCase() === 'logcatfile') {
                colDef.render = function (data, type, row) {
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
                };
            } 
            // 默认渲染器：处理 null/undefined
            else {
                colDef.render = function(data, type, row) {
                    return (data === null || data === undefined || data === '') ? '-' : data;
                };
            }

            columns.push(colDef);
        });

        return columns;
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

        // 2. 延迟设置 Select2，给予 DOM 切换时间
        setTimeout(() => {
            const $select = $('#logFileSelect1');
            
            if ($select.length === 0) {
                this.showAlert('找不到文件选择器组件', 'danger');
                return;
            }

            // 检查选项是否存在
            if ($select.find(`option[value="${logcatFileName}"]`).length === 0) {
                // 如果选项不存在，尝试创建一个临时选项 (可选，视业务逻辑而定)
                // $select.append(new Option(logcatFileName, logcatFileName, true, true));
                this.showAlert(`文件列表中未找到: ${logcatFileName}`, 'warning');
                return;
            }

            // 设置值并触发 change 事件 (兼容 Select2)
            $select.val(logcatFileName).trigger('change');
            
            this.showAlert(`已加载日志文件: ${logcatFileName}`, 'success');

            // 尝试打开下拉框 (视觉反馈)
            try {
                if ($select.data('select2')) {
                    $select.select2('open');
                    // 1秒后自动关闭，仅作提示
                    setTimeout(() => $select.select2('close'), 1000);
                }
            } catch (e) {
                console.warn('Select2 操作失败', e);
            }

        }, 300);
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
            $alert.alert('close'); // 使用 Bootstrap 的关闭方法
            setTimeout(() => $alert.remove(), 150); // 确保 DOM 移除
        }, 4000);
    }
}

// 全局初始化逻辑
(function() {
    let instance = null;

    function init() {
        if (!instance) {
            instance = new DosFileAnalysisManager();
            window.dosFileAnalysisManager = instance;
            console.log('DOS File Analysis Manager Ready.');
        }
        return instance;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
    } else {
        setTimeout(init, 100);
    }
})();
