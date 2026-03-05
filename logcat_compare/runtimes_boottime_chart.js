/**
 * 运行次数-开机时间图表管理器
 * 负责创建和管理运行次数vs开机时间的Chart.js图表
 */
class RuntimesBootTimeChartManager {
    constructor() {
        this.chart = null;
        this.chartContainerId = 'runtimesBootTimeChart';
        this.chartCanvasId = 'runtimesBootTimeChartCanvas';
        this.initialize();
    }

    /**
     * 初始化图表管理器
     */
    initialize() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupChart());
        } else {
            this.setupChart();
        }
    }

    /**
     * 设置图表
     */
    setupChart() {
        const canvas = document.getElementById(this.chartCanvasId);
        if (!canvas) {
            console.warn('图表画布元素未找到:', this.chartCanvasId);
            return;
        }

        const ctx = canvas.getContext('2d');

        // 初始空图表
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '开机时间 vs 运行次数',
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '运行次数-开机时间趋势分析',
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                const point = context.dataset.data[context.dataIndex];
                                if (point.custom) {
                                    return [
                                        `本地时间: ${point.custom.localTime}`,
                                        `运行次数: ${point.x}`,
                                        `开机时间: ${point.y}s`,
                                        `温度: ${point.custom.temp}°C`,
                                        point.custom.isAnomaly ? '⚠️ 异常点（>最小时间+20s）' : ''
                                    ];
                                }
                                return `运行次数: ${point.x}, 开机时间: ${point.y}s`;
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        title: {
                            display: true,
                            text: '运行次数 (Runtimes)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '开机时间 '
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        beginAtZero: false  // 允许从某个值开始，更好观察趋势
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                elements: {
                    line: {
                        tension: 0.1
                    }
                }
            }
        });

        // 初始化控制按钮事件
        this.setupControls();
    }

    /**
     * 设置控制按钮事件
     */
    setupControls() {
        // 重置缩放按钮
        const resetZoomBtn = document.getElementById('resetRuntimesChartZoomBtn');
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', () => {
                if (this.chart) {
                    this.chart.resetZoom();
                }
            });
        }

        // 导出图片按钮
        const exportBtn = document.getElementById('exportRuntimesChartBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportChartAsImage();
            });
        }

        // 显示/隐藏异常点按钮
        const toggleAnomaliesBtn = document.getElementById('toggleRuntimesAnomaliesBtn');
        if (toggleAnomaliesBtn) {
            toggleAnomaliesBtn.addEventListener('click', (e) => {
                const showAnomalies = e.target.textContent.includes('隐藏');
                this.toggleAnomaliesDisplay(showAnomalies);
                e.target.textContent = showAnomalies ? '显示异常点' : '隐藏异常点';
            });
        }
    }

    /**
     * 更新图表数据
     * @param {Array} allResultDatas - 从file_utils.js解析的数据
     */
    updateChart(allResultDatas) {
        if (!this.chart) {
            console.warn('图表未初始化');
            return;
        }

        if (!Array.isArray(allResultDatas) || allResultDatas.length === 0) {
            console.warn('没有数据可显示');
            this.chart.data.datasets[0].data = [];
            this.chart.update();
            return;
        }

        // 准备图表数据
        const chartData = this.prepareChartData(allResultDatas);

        // 更新图表数据
        this.chart.data.datasets[0].data = chartData.data;

        // 设置异常点颜色（红色，与温度图表一致）
        this.chart.data.datasets[0].pointBackgroundColor = chartData.data.map(point => {
            return point.custom.isAnomaly ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)';
        });
        this.chart.data.datasets[0].pointBorderColor = chartData.data.map(point => {
            return point.custom.isAnomaly ? 'rgba(255, 99, 132, 1)' : '#fff';
        });

        // 更新统计信息
        this.updateStats(chartData.stats);

        // 重新渲染图表
        this.chart.update();
    }

    /**
     * 准备图表数据
     * @param {Array} allResultDatas - 原始数据
     * @returns {Object} 图表数据和统计信息
     */
    prepareChartData(allResultDatas) {
        // 过滤有效数据
        let validData = allResultDatas.filter(item => {
            return item.Runtimes !== undefined && item.PowerOnTime !== undefined &&
                !isNaN(parseFloat(item.Runtimes)) && !isNaN(parseFloat(item.PowerOnTime));
        });

        if (validData.length === 0) {
            validData = allResultDatas.filter(item => {
                return item.Runtimes !== undefined && item.boot_time !== undefined &&
                    !isNaN(parseFloat(item.Runtimes)) && !isNaN(parseFloat(item.boot_time));
            });
        }

        if (validData.length === 0) {
            return { data: [], stats: {} };
        }

        // 提取开机时间并计算最小值和异常阈值
        const powerOnTimes = validData.map(item => {
            // 如果 PowerOnTime 有值就用它，否则用 boot_time
            return parseFloat(item.PowerOnTime || item.boot_time);
        });
        
        const minTime = Math.min(...powerOnTimes);
        const anomalyThreshold = minTime + 20;  // 最小开机时间+20秒作为异常阈值

        // 准备图表数据点
        const dataPoints = validData.map(item => {
            const runtimes = item.Runtimes;
            const powerOnTime = parseFloat(item.PowerOnTime || item.boot_time);
            const temp = parseFloat(item.Temp || 0);
            const isAnomaly = powerOnTime > anomalyThreshold;

            return {
                x: runtimes,
                y: powerOnTime,
                custom: {
                    localTime: item.LocalTime || 'N/A',
                    runtimes: runtimes,
                    temp: temp,
                    powerOnTime: powerOnTime,
                    isAnomaly: isAnomaly
                }
            };
        });

        // 按Runtimes排序（字符串排序）
        dataPoints.sort((a, b) => {
            // 尝试数值排序
            const numA = parseInt(a.x);
            const numB = parseInt(b.x);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            // 如果不是数字，使用字符串排序
            return String(a.x).localeCompare(String(b.x));
        });

        // 计算统计信息
        const avgTime = powerOnTimes.reduce((sum, t) => sum + t, 0) / powerOnTimes.length;
        const stats = {
            totalPoints: validData.length,
            minBootTime: minTime,
            maxBootTime: Math.max(...powerOnTimes),
            avgBootTime: avgTime,
            anomalyThreshold: anomalyThreshold,
            anomalyCount: dataPoints.filter(p => p.custom.isAnomaly).length,
            uniqueRuntimes: [...new Set(dataPoints.map(p => p.x))].length
        };

        return {
            data: dataPoints,
            stats: stats
        };
    }

    /**
     * 更新统计信息显示
     * @param {Object} stats - 统计信息
     */
    updateStats(stats) {
        const statsContainer = document.getElementById('runtimesChartStats');
        if (!statsContainer) return;

        if (Object.keys(stats).length === 0) {
            statsContainer.innerHTML = '<div class="alert alert-info">暂无数据</div>';
            return;
        }

        statsContainer.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header py-2 bg-success text-white">
                            <h6 class="mb-0">开机时间统计</h6>
                        </div>
                        <div class="card-body py-2">
                            <div class="row small">
                                <div class="col-6">最小值:</div>
                                <div class="col-6">${stats.minBootTime.toFixed(0)}s</div>
                                <div class="col-6">最大值:</div>
                                <div class="col-6">${stats.maxBootTime.toFixed(0)}s</div>
                                <div class="col-6">平均值:</div>
                                <div class="col-6">${stats.avgBootTime.toFixed(0)}s</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header py-2 bg-info text-white">
                            <h6 class="mb-0">数据概览</h6>
                        </div>
                        <div class="card-body py-2">
                            <div class="row small">
                                <div class="col-6">总数据点:</div>
                                <div class="col-6">${stats.totalPoints}个</div>
                                <div class="col-6">唯一Runtimes:</div>
                                <div class="col-6">${stats.uniqueRuntimes}个</div>
                                <div class="col-6">异常阈值:</div>
                                <div class="col-6">${stats.anomalyThreshold.toFixed(0)}s</div>
                                <div class="col-6">异常点:</div>
                                <div class="col-6 text-danger">${stats.anomalyCount}个</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 切换异常点显示
     * @param {boolean} show - 是否显示异常点
     */
    toggleAnomaliesDisplay(show) {
        if (!this.chart) return;

        const dataset = this.chart.data.datasets[0];
        dataset.pointBackgroundColor = dataset.data.map(point => {
            return point.custom.isAnomaly ? (show ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)') : 'rgba(75, 192, 192, 1)';
        });
        dataset.pointBorderColor = dataset.data.map(point => {
            return point.custom.isAnomaly ? (show ? 'rgba(255, 99, 132, 1)' : '#fff') : '#fff';
        });

        this.chart.update();
    }

    /**
     * 导出图表为图片
     */
    exportChartAsImage() {
        if (!this.chart) {
            alert('图表未初始化');
            return;
        }

        const link = document.createElement('a');
        link.download = `运行次数-开机时间分析_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = this.chart.toBase64Image();
        link.click();
    }

    /**
     * 销毁图表
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// 全局实例
window.runtimesBootTimeChartManager = new RuntimesBootTimeChartManager();