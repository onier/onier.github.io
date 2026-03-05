/**
 * BootAnomalyManager - 启动异常检测管理器
 * 负责显示启动异常检测结果
 * 功能：
 * 1. 初始化和管理异常检测表格
 * 2. 处理文件上传和解析
 * 3. 提供导出和重置功能
 */

class BootAnomalyManager {
    constructor() {
        this.bootAnomalyDetector = null;
        this.initialized = false;
        
        // 表格实例
        this.anomalyTable = null;
    }

    /**
     * 初始化管理器
     */
    init() {
        if (this.initialized) return;
        
        // 创建 BootAnomalyDetector 实例
        if (window.BootAnomalyDetector) {
            this.bootAnomalyDetector = new window.BootAnomalyDetector();
        } else {
            console.error('BootAnomalyDetector 未加载，请确保 port_log_analyzer.js 已正确引入');
            return;
        }
        
        // 初始化表格
        this.initTable();
        
        this.initialized = true;
        console.log('BootAnomalyManager 初始化完成');
    }

    /**
     * 初始化表格
     */
    initTable() {
        // 初始化异常检测表格，显示4列（删除行号列）
        this.anomalyTable = $('#portLogRestartTable').DataTable({
            language: {
                emptyTable: "没有检测到异常",
                info: "显示第 _START_ 至 _END_ 项结果，共 _TOTAL_ 项",
                infoEmpty: "显示第 0 至 0 项结果，共 0 项",
                infoFiltered: "(由 _MAX_ 项结果过滤)",
                lengthMenu: "显示 _MENU_ 项结果",
                loadingRecords: "载入中...",
                processing: "处理中...",
                search: "搜索:",
                zeroRecords: "没有匹配结果",
                paginate: {
                    first: "首页",
                    last: "末页",
                    next: "下一页",
                    previous: "上一页"
                }
            },
            pageLength: 10,
            lengthMenu: [5, 10, 25, 50],
            order: [[0, 'asc']], // 默认按规则ID排序
            columns: [
                { 
                    title: "规则ID", 
                    data: "规则ID",
                    className: "text-center"
                },
                { 
                    title: "严重等级", 
                    data: "严重等级",
                    className: "text-center",
                    render: function(data, type, row) {
                        // 根据严重等级添加颜色
                        if (type === 'display') {
                            if (data.includes('CRITICAL')) {
                                return '<span class="badge bg-danger">' + data + '</span>';
                            } else if (data.includes('ERROR')) {
                                return '<span class="badge bg-warning">' + data + '</span>';
                            } else if (data.includes('WARNING')) {
                                return '<span class="badge bg-info">' + data + '</span>';
                            } else if (data.includes('INFO')) {
                                return '<span class="badge bg-secondary">' + data + '</span>';
                            }
                        }
                        return data;
                    }
                },
                { 
                    title: "描述", 
                    data: "描述",
                    className: "text-start"
                },
                { 
                    title: "原始内容", 
                    data: "原始内容",
                    className: "text-start",
                    render: function(data, type, row) {
                        // 显示时截断过长的内容
                        if (type === 'display' && data.length > 100) {
                            return '<span title="' + data + '">' + data.substring(0, 100) + '...</span>';
                        }
                        return data;
                    }
                }
            ],
            createdRow: function(row, data, dataIndex) {
                // 根据严重等级添加行样式
                const severity = data.严重等级;
                if (severity.includes('CRITICAL')) {
                    $(row).addClass('table-danger');
                } else if (severity.includes('ERROR')) {
                    $(row).addClass('table-warning');
                } else if (severity.includes('WARNING')) {
                    $(row).addClass('table-info');
                } else if (severity.includes('INFO')) {
                    $(row).addClass('table-secondary');
                }
            }
        });
    }

    /**
     * 更新表格数据
     * @param {string} logContent - 日志文件内容
     */
    updateTable(logContent) {
        if (!this.initialized) {
            this.init();
        }
        
        if (!this.bootAnomalyDetector) {
            console.warn('BootAnomalyDetector 未初始化');
            return;
        }
        
        // 解析日志文件并检测异常
        this.bootAnomalyDetector.parseLogFile(logContent);
        
        // 获取检测结果
        const detectionResult = this.bootAnomalyDetector.detectionResults;
        
        if (!detectionResult || !detectionResult.anomalies) {
            console.warn('没有有效的检测结果数据', detectionResult);
            return;
        }
        
        // 获取表格数据
        const tableData = this.bootAnomalyDetector.getTableData();
        console.log('获取的表格数据：', tableData);
        // 更新异常检测表格
        if (this.anomalyTable) {
            this.anomalyTable.clear();
            if (tableData.anomalyTable && tableData.anomalyTable.length > 0) {
                this.anomalyTable.rows.add(tableData.anomalyTable);
            }
            this.anomalyTable.draw();
        }
        
        // 更新表格说明
        this.updateTableDescription(tableData.stats);
    }

    /**
     * 更新表格说明
     * @param {object} stats - 统计信息
     */
    updateTableDescription(stats) {
        const descriptionElement = document.getElementById('portLogTableDescription');
        if (!descriptionElement) return;
        
        const severityCounts = stats.severityCounts || {};
        const totalRules = stats.totalRules || 0;
        
        let description = `
            <h6 class="alert-heading"><i class="bi bi-info-circle me-1"></i>分析说明</h6>
            <ul class="mb-0">
                <li><strong>基于规则表的启动异常检测</strong>: 使用配置化的规则表检测各种启动异常</li>
                <li><strong>当前规则</strong>: ${totalRules}条 (电源管理、安全启动、硬件初始化等)</li>
                <li><strong>匹配逻辑</strong>: 所有关键词必须出现在同一行 (AND关系)</li>
                <li><strong>严重等级</strong>: 
                    <span class="badge bg-danger">🔴 严重</span> 
                    <span class="badge bg-warning">🟠 错误</span> 
                    <span class="badge bg-info">🟡 警告</span> 
                    <span class="badge bg-secondary">🔵 信息</span>
                </li>
                <li><strong>检测统计</strong>: 扫描 ${stats.linesScanned || 0} 行，发现 ${stats.totalAnomalies || 0} 个异常</li>
                <li><strong>文件格式</strong>: 支持各种启动日志文件，自动检测异常模式</li>
            </ul>
        `;
        
        descriptionElement.innerHTML = description;
    }

    /**
     * 导出检测结果为CSV
     */
    exportToCSV() {
        if (!this.bootAnomalyDetector) {
            alert('请先加载日志文件进行分析');
            return;
        }
        
        const csv = this.bootAnomalyDetector.exportToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // 生成文件名
        const fileName = `启动异常检测_${new Date().toISOString().slice(0, 10)}.csv`;
        
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        alert(`检测结果已导出为CSV文件: ${fileName}`);
    }

    /**
     * 重置管理器状态
     */
    reset() {
        if (this.anomalyTable) {
            this.anomalyTable.clear().draw();
        }
        
        if (this.bootAnomalyDetector) {
            this.bootAnomalyDetector.reset();
        }
        
        // 重置表格说明
        const descriptionElement = document.getElementById('portLogTableDescription');
        if (descriptionElement) {
            descriptionElement.innerHTML = `
                <h6 class="alert-heading"><i class="bi bi-info-circle me-1"></i>分析说明</h6>
                <ul class="mb-0">
                    <li><strong>基于规则表的启动异常检测</strong>: 使用配置化的规则表检测各种启动异常</li>
                    <li><strong>当前规则</strong>: 14条 (电源管理、安全启动、硬件初始化等)</li>
                    <li><strong>匹配逻辑</strong>: 所有关键词必须出现在同一行 (AND关系)</li>
                    <li><strong>严重等级</strong>: 
                        <span class="badge bg-danger">🔴 严重</span> 
                        <span class="badge bg-warning">🟠 错误</span> 
                        <span class="badge bg-info">🟡 警告</span> 
                        <span class="badge bg-secondary">🔵 信息</span>
                    </li>
                    <li><strong>检测统计</strong>: 请上传日志文件开始分析</li>
                    <li><strong>文件格式</strong>: 支持各种启动日志文件，自动检测异常模式</li>
                </ul>
            `;
        }
    }
}

// 全局变量
window.bootAnomalyManager = new BootAnomalyManager();

/**
 * 初始化启动异常检测管理器
 */
function initBootAnomalyManager() {
    if (window.bootAnomalyManager) {
        window.bootAnomalyManager.init();
        console.log('启动异常检测管理器初始化完成');
    } else {
        console.error('无法初始化启动异常检测管理器');
    }
}

// 页面加载完成后自动初始化
$(document).ready(function() {
    // 延迟初始化，确保所有依赖已加载
    setTimeout(() => {
        if (window.BootAnomalyDetector && $('#portLogRestartTable').length) {
            initBootAnomalyManager();
        }
    }, 500);
});
