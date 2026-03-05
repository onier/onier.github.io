class AdbTimeAnalysisManager {
    constructor() {
        this.dataTable = null; // DataTable 实例
    }

    // 更新表格数据
    updateTable(dosLogDatas) {
        if (!dosLogDatas || dosLogDatas.length === 0) {
            console.log('没有DOS日志数据可分析');
            this.clearTable();
            return;
        }

        // 构建表格数据
        const tableData = [];
        
        dosLogDatas.forEach((dosLogData, index) => {
            const analysisResult = this.analyzeAdbCommands(dosLogData);
            
            tableData.push({
                index: index + 1,
                runtimes: dosLogData.Runtimes || '-',
                localTime: dosLogData.LocalTime || '-',
                PowerOnTime: dosLogData.PowerOnTime || '-',
                adbCount: analysisResult.adbCommands.length,
                totalInterval: analysisResult.totalInterval,
                avgInterval: analysisResult.avgInterval,
                segs: dosLogData.segs || [],
                analysisResult: analysisResult
            });
        });

        // 初始化或更新DataTable
        this.initOrUpdateDataTable(tableData);
        
        console.log(`ADB命令时间分析表格已更新，共 ${dosLogDatas.length} 条DOS日志数据`);
    }

    // 分析ADB命令
    analyzeAdbCommands(dosLogData) {
        if (!dosLogData.segs || dosLogData.segs.length === 0) {
            return {
                adbCommands: [],
                totalInterval: 0,
                avgInterval: 0,
                intervals: []
            };
        }

        // 解析segs数据
        const parsedLogs = this.parseAndroidLogs(dosLogData.segs);
        
        // 过滤出ADB命令
        const adbCommands = parsedLogs.filter(log => 
            log.message && (log.message.toLowerCase().includes('adb')||log.message.toLowerCase().includes('boot_completed') 
            || log.message.toLowerCase().includes("set to True"))
        );

        // 计算时间间隔
        const intervals = this.calculateTimeIntervals(adbCommands);
        
        // 计算总间隔和平均间隔
        const totalInterval = intervals.reduce((sum, interval) => sum + interval, 0);
        const avgInterval = adbCommands.length > 1 ? totalInterval / (adbCommands.length - 1) : 0;

        return {
            adbCommands: adbCommands,
            totalInterval: totalInterval,
            avgInterval: avgInterval,
            intervals: intervals
        };
    }

    // 解析Android日志（使用substr替代正则表达式）
    parseAndroidLogs(logTextArray) {
        const results = [];
        
        logTextArray.forEach(logText => {
            // 跳过空行
            if (!logText || logText.trim() === '') {
                return;
            }
            
            try {
                // 格式：2025-10-30 17:09:49,492 - Dummy-3-10260 - [2025-10-30 17:09:49.492063] Module is booting up in pwk
                
                // 1. 提取时间戳（前23个字符）
                const timestamp = logText.substr(0, 23).trim();
                
                // 2. 找到第一个" - "分隔符之后的位置
                const firstDashIndex = logText.indexOf(' - ');
                if (firstDashIndex === -1) {
                    // console.warn('日志格式错误，找不到第一个分隔符:', logText);
                    return;
                }
                
                // 3. 找到第二个" - "分隔符的位置
                const secondDashIndex = logText.indexOf(' - ', firstDashIndex + 3);
                if (secondDashIndex === -1) {
                    console.warn('日志格式错误，找不到第二个分隔符:', logText);
                    return;
                }
                
                // 4. 提取线程名（第一个分隔符和第二个分隔符之间）
                const thread = logText.substring(firstDashIndex + 3, secondDashIndex).trim();
                
                // 5. 找到精确时间的开始位置（第二个分隔符之后的'['）
                const bracketStartIndex = logText.indexOf('[', secondDashIndex);
                if (bracketStartIndex === -1) {
                    console.warn('日志格式错误，找不到精确时间开始标记:', logText);
                    return;
                }
                
                // 6. 找到精确时间的结束位置（']'）
                const bracketEndIndex = logText.indexOf(']', bracketStartIndex);
                if (bracketEndIndex === -1) {
                    console.warn('日志格式错误，找不到精确时间结束标记:', logText);
                    return;
                }
                
                // 7. 提取精确时间（包含方括号）
                const preciseTime = logText.substring(bracketStartIndex, bracketEndIndex + 1).trim();
                
                // 8. 提取消息（精确时间之后的部分）
                const message = logText.substring(bracketEndIndex + 1).trim();
                
                // 验证提取的数据
                if (timestamp && thread && preciseTime) {
                    results.push({
                        timestamp: timestamp,
                        thread: thread,
                        preciseTime: preciseTime,
                        message: message
                    });
                } else {
                    console.warn('解析日志行失败，数据不完整:', logText);
                }
            } catch (error) {
                console.error('解析日志行时发生错误:', error, '日志行:', logText);
            }
        });

        return results;
    }

    // 计算时间间隔
    calculateTimeIntervals(adbCommands) {
        const intervals = [];
        
        if (adbCommands.length < 2) {
            return intervals;
        }

        for (let i = 1; i < adbCommands.length; i++) {
            const currentTime = this.parsePreciseTime(adbCommands[i].preciseTime);
            const previousTime = this.parsePreciseTime(adbCommands[i - 1].preciseTime);
            
            if (currentTime && previousTime) {
                const interval = currentTime - previousTime;
                intervals.push(interval);
            }
        }

        return intervals;
    }

    // 解析精确时间字符串为时间戳（毫秒）
    parsePreciseTime(timeStr) {
        try {
            // 格式: "2025-10-30 16:50:04.076982"
            // 移除方括号
            const cleanTimeStr = timeStr.replace(/[\[\]]/g, '');
            
            // 将微秒转换为毫秒（取前3位）
            const parts = cleanTimeStr.split('.');
            if (parts.length === 2) {
                const datePart = parts[0];
                const microSecPart = parts[1].substring(0, 3); // 取前3位作为毫秒
                const millisTimeStr = `${datePart}.${microSecPart}`;
                return Date.parse(millisTimeStr);
            }
            
            return Date.parse(cleanTimeStr);
        } catch (error) {
            console.error('解析时间失败:', timeStr, error);
            return null;
        }
    }

    // 格式化时间间隔（毫秒）
    formatInterval(ms) {
        if (ms === 0) return '0';
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    }

    // 根据时间间隔获取对应的CSS类
    getTimeIntervalClass(ms) {
        if (ms === 0 || ms === '-') return 'time-badge-default';
        
        const seconds = ms / 1000;
        
        if (seconds <= 3) {
            return 'time-badge-3s';
        } else if (seconds <= 5) {
            return 'time-badge-5s';
        } else if (seconds <= 10) {
            return 'time-badge-10s';
        } else if (seconds <= 15) {
            return 'time-badge-15s';
        } else {
            return 'time-badge-default';
        }
    }

    // 初始化或更新DataTable
    initOrUpdateDataTable(tableData) {
        const self = this; // 保存this引用
        
        if (this.dataTable) {
            // 如果DataTable已存在，销毁它
            this.dataTable.destroy();
            this.dataTable = null;
        }

        // 初始化DataTable
        this.dataTable = $('#adbTimeAnalysisTable').DataTable({
            data: tableData,
            columns: [
                {
                    className: 'details-control',
                    orderable: false,
                    data: null,
                    defaultContent: '',
                    width: '40px'
                },
                { 
                    data: 'index',
                    title: '序号',
                    width: '60px'
                },
                { 
                    data: 'runtimes',
                    title: 'Runtimes',
                    width: '80px'
                },
                { 
                    data: 'localTime',
                    title: 'LocalTime',
                    width: '150px'
                },
                { 
                    data: 'PowerOnTime',
                    title: 'PowerOnTime',
                    width: '120px'
                },
                { 
                    data: 'adbCount',
                    title: 'ADB命令数量',
                    width: '100px',
                    render: function(data, type, row) {
                        if (type === 'display') {
                            return `<span class="badge ${data > 0 ? 'bg-primary' : 'bg-secondary'}">${data}</span>`;
                        }
                        return data;
                    }
                },
                { 
                    data: 'totalInterval',
                    title: '总时间间隔(ms)',
                    width: '120px',
                    render: function(data, type, row) {
                        if (type === 'display') {
                            return self.formatInterval(data);
                        }
                        return data;
                    }
                },
                { 
                    data: 'avgInterval',
                    title: '平均时间间隔(ms)',
                    width: '120px',
                    render: function(data, type, row) {
                        if (type === 'display') {
                            return self.formatInterval(data);
                        }
                        return data;
                    }
                }
            ],
            autoWidth: false,
            scrollX: true,
            pageLength: 50, // 默认显示50行
            language: {
                search: "搜索:",
                lengthMenu: "显示 _MENU_ 条记录",
                info: "显示第 _START_ 至 _END_ 条记录，共 _TOTAL_ 条",
                infoEmpty: "显示第 0 至 0 条记录，共 0 条",
                infoFiltered: "(从 _MAX_ 条记录中过滤)",
                zeroRecords: "没有找到匹配的记录",
                paginate: {
                    first: "首页",
                    previous: "上页",
                    next: "下页",
                    last: "末页"
                }
            },
            createdRow: function(row, data, dataIndex) {
                // 为details-control单元格添加初始的"+"图标
                const detailsControlCell = $(row).find('td.details-control');
                detailsControlCell.html('<i class="bi bi-plus-circle"></i>');
                
                // 为展开按钮添加点击事件
                detailsControlCell.on('click', function() {
                    const tr = $(this).closest('tr');
                    const row = self.dataTable.row(tr);
                    
                    if (row.child.isShown()) {
                        // 如果子行已显示，关闭它
                        row.child.hide();
                        tr.removeClass('shown');
                        $(this).html('<i class="bi bi-plus-circle"></i>');
                    } else {
                        // 如果子行未显示，打开它
                        row.child(self.formatDetails(data)).show();
                        tr.addClass('shown');
                        $(this).html('<i class="bi bi-dash-circle"></i>');
                    }
                });
            }
        });
    }

    // 格式化详情内容（用于Child rows显示）
    formatDetails(rowData) {
        const analysisResult = rowData.analysisResult;
        
        if (!analysisResult || analysisResult.adbCommands.length === 0) {
            return '<div class="alert alert-warning p-2 m-2">该条目没有ADB命令</div>';
        }

        // 创建详情HTML
        let detailsHtml = `
            <div class="adb-details p-3" style="background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
                <h6 class="mb-3">ADB命令详情 (Runtimes: ${rowData.runtimes})</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-3">
                        <thead>
                            <tr>
                                <th width="80">序号</th>
                                <th width="120">时间间隔</th>
                                <th width="180">时间戳</th>
                                <th width="150">线程</th>
                                <th>命令</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        analysisResult.adbCommands.forEach((cmd, index) => {
            const intervalMs = index === 0 ? '-' : analysisResult.intervals[index - 1];
            const intervalDisplay = index === 0 ? '-' : this.formatInterval(intervalMs);
            const timeClass = index === 0 ? 'time-badge-default' : this.getTimeIntervalClass(intervalMs);
            
            detailsHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td><span class="badge ${timeClass}">${intervalDisplay}</span></td>
                    <td>${cmd.timestamp}</td>
                    <td>${cmd.thread}</td>
                    <td><code class="small">${cmd.message}</code></td>
                </tr>
            `;
        });

        detailsHtml += `
                        </tbody>
                    </table>
                </div>
                <div class="mt-3 p-2 bg-white rounded border">
                    <p class="mb-2"><strong>统计信息:</strong></p>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="d-flex align-items-center mb-1">
                                <span class="me-2">ADB命令总数:</span>
                                <span class="badge bg-primary">${analysisResult.adbCommands.length}</span>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="d-flex align-items-center mb-1">
                                <span class="me-2">总时间间隔:</span>
                                <span class="badge bg-success">${this.formatInterval(analysisResult.totalInterval)}</span>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="d-flex align-items-center mb-1">
                                <span class="me-2">平均时间间隔:</span>
                                <span class="badge bg-warning">${this.formatInterval(analysisResult.avgInterval)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return detailsHtml;
    }

    // 清空表格
    clearTable() {
        if (this.dataTable) {
            this.dataTable.clear().draw();
        } else {
            // 如果DataTable未初始化，清空表格内容
            $('#adbTimeAnalysisTable tbody').empty();
        }
    }

    // 显示提示信息
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
}

// 创建全局实例
let adbTimeAnalysisManager = null;

// 初始化ADB时间分析管理器
function initAdbTimeAnalysisManager() {
    if (!adbTimeAnalysisManager) {
        adbTimeAnalysisManager = new AdbTimeAnalysisManager();
        // 暴露到全局作用域，方便其他脚本访问
        window.adbTimeAnalysisManager = adbTimeAnalysisManager;
        console.log('ADB时间分析管理器初始化完成');
    }
    return adbTimeAnalysisManager;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
    // 延迟初始化，确保DataTable库已加载
    setTimeout(() => {
        initAdbTimeAnalysisManager();
    }, 100);
});
