/**
 * 温度-开机时间图表管理器
 * 负责创建和管理温度vs开机时间的Chart.js图表
 */
class TemperatureBootTimeChartManager {
    constructor() {
        this.chart = null;
        this.chartContainerId = 'temperatureBootTimeChart';
        this.chartCanvasId = 'temperatureBootTimeChartCanvas';
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
                    label: '开机时间 vs 温度',
                    data: [],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
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
                        text: '温度-开机时间趋势分析',
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
                                        `运行次数: ${point.custom.runtimes}`,
                                        `温度: ${point.x}°C`,
                                        `开机时间: ${point.y}`,
                                        point.custom.isAnomaly ? '⚠️ 异常点（>最小时间+20s）' : ''
                                    ];
                                }
                                return `温度: ${point.x}°C, 开机时间: ${point.y}`;
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
                        type: 'linear',
                        title: {
                            display: true,
                            text: '温度 (°C)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
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
                        beginAtZero: true
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
        const resetZoomBtn = document.getElementById('resetChartZoomBtn');
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', () => {
                if (this.chart) {
                    this.chart.resetZoom();
                }
            });
        }

        // 导出图片按钮
        const exportBtn = document.getElementById('exportChartBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportChartAsImage();
            });
        }

        // 显示/隐藏异常点按钮
        const toggleAnomaliesBtn = document.getElementById('toggleAnomaliesBtn');
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

        // 设置异常点颜色
        this.chart.data.datasets[0].pointBackgroundColor = chartData.data.map(point => {
            return point.custom.isAnomaly ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)';
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
            return item.Temp !== undefined && item.PowerOnTime !== undefined &&
                !isNaN(parseFloat(item.Temp)) && !isNaN(parseFloat(item.PowerOnTime));
        });

        if (validData.length === 0) {
            validData = allResultDatas.filter(item => {
                return item.Temp !== undefined && item.boot_time !== undefined &&
                    !isNaN(parseFloat(item.Temp)) && !isNaN(parseFloat(item.boot_time));
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
        const anomalyThreshold = minTime + 20; // 20秒 = 20000毫秒

        // 准备图表数据点
        const dataPoints = validData.map(item => {
            const temp = parseFloat(item.Temp);
            const powerOnTime = parseFloat(item.PowerOnTime || item.boot_time);
            const isAnomaly = powerOnTime > anomalyThreshold;

            return {
                x: temp,
                y: powerOnTime,
                custom: {
                    localTime: item.LocalTime || 'N/A',
                    runtimes: item.Runtimes || 'N/A',
                    temp: temp,
                    powerOnTime: powerOnTime,
                    isAnomaly: isAnomaly
                }
            };
        });

        // 按温度排序
        dataPoints.sort((a, b) => a.x - b.x);

        // 计算统计信息
        const stats = {
            totalPoints: validData.length,
            minTemperature: Math.min(...dataPoints.map(p => p.x)),
            maxTemperature: Math.max(...dataPoints.map(p => p.x)),
            avgTemperature: dataPoints.reduce((sum, p) => sum + p.x, 0) / dataPoints.length,
            minBootTime: minTime,
            maxBootTime: Math.max(...powerOnTimes),
            avgBootTime: powerOnTimes.reduce((sum, t) => sum + t, 0) / powerOnTimes.length,
            anomalyCount: dataPoints.filter(p => p.custom.isAnomaly).length,
            anomalyThreshold: anomalyThreshold
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
        const statsContainer = document.getElementById('chartStats');
        if (!statsContainer) return;

        if (Object.keys(stats).length === 0) {
            statsContainer.innerHTML = '<div class="alert alert-info">暂无数据</div>';
            return;
        }

        statsContainer.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header py-2">
                            <h6 class="mb-0">温度统计</h6>
                        </div>
                        <div class="card-body py-2">
                            <div class="row small">
                                <div class="col-6">最小值:</div>
                                <div class="col-6">${stats.minTemperature.toFixed(2)}°C</div>
                                <div class="col-6">最大值:</div>
                                <div class="col-6">${stats.maxTemperature.toFixed(2)}°C</div>
                                <div class="col-6">平均值:</div>
                                <div class="col-6">${stats.avgTemperature.toFixed(2)}°C</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header py-2">
                            <h6 class="mb-0">开机时间统计</h6>
                        </div>
                        <div class="card-body py-2">
                            <div class="row small">
                                <div class="col-6">数据总数:</div>
                                <div class="col-6">${stats.totalPoints}个</div>
                                <div class="col-6">最小值:</div>
                                <div class="col-6">${stats.minBootTime.toFixed(0)}</div>
                                <div class="col-6">最大值:</div>
                                <div class="col-6">${stats.maxBootTime.toFixed(0)}</div>
                                <div class="col-6">平均值:</div>
                                <div class="col-6">${stats.avgBootTime.toFixed(0)}</div>
                                <div class="col-6">异常点:</div>
                                <div class="col-6">${stats.anomalyCount}个</div>
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
            return point.custom.isAnomaly ? (show ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)') : 'rgba(54, 162, 235, 1)';
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
        link.download = `温度-开机时间分析_${new Date().toISOString().slice(0, 10)}.png`;
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
window.temperatureBootTimeChartManager = new TemperatureBootTimeChartManager();
