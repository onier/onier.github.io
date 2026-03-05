/**
 * WinBox Manager - 使用 WinBox.js 管理所有窗口对话框
 * 
 * 功能：
 * 1. 文件上传对话框
 * 2. 文件分析结果各个表格的独立对话框
 * 3. 日志分析的左右对话框布局
 */

class WinBoxManager {
    constructor() {
        this.windows = new Map();
        this.windowConfigs = {
            fileUpload: {
                title: '<i class="bi bi-cloud-upload me-2"></i>文件上传',
                width: '600px',
                height: '500px',
                x: 'center',
                y: 'center',
                minWidth: '400px',
                minHeight: '300px'
            },
            logcatAnalysis: {
                title: '<i class="bi bi-file-text me-2"></i>Logcat 分析表',
                width: '80%',
                height: '70%',
                x: 'center',
                y: 'center',
                minWidth: '600px',
                minHeight: '400px'
            },
            dosAnalysis: {
                title: '<i class="bi bi-file-binary me-2"></i>测试Result分析表',
                width: '80%',
                height: '70%',
                x: 'center',
                y: 'center',
                minWidth: '600px',
                minHeight: '400px'
            },
            adbTimeAnalysis: {
                title: '<i class="bi bi-clock-history me-2"></i>ADB命令时间分析',
                width: '80%',
                height: '70%',
                x: 'center',
                y: 'center',
                minWidth: '600px',
                minHeight: '400px'
            },
            temperatureBootTime: {
                title: '<i class="bi bi-thermometer-half me-2"></i>温度-开机时间分析',
                width: '90%',
                height: '80%',
                x: 'center',
                y: 'center',
                minWidth: '700px',
                minHeight: '500px'
            },
            runtimesBootTime: {
                title: '<i class="bi bi-arrow-repeat me-2"></i>运行次数-开机时间分析',
                width: '90%',
                height: '80%',
                x: 'center',
                y: 'center',
                minWidth: '700px',
                minHeight: '500px'
            },
            anomalyTable: {
                title: '<i class="bi bi-exclamation-triangle me-2"></i>异常数据库表',
                width: '80%',
                height: '70%',
                x: 'center',
                y: 'center',
                minWidth: '600px',
                minHeight: '400px'
            },
            portLogAnalysis: {
                title: '<i class="bi bi-usb-plug me-2"></i>串口Log分析',
                width: '80%',
                height: '70%',
                x: 'center',
                y: 'center',
                minWidth: '600px',
                minHeight: '400px'
            },
            logcatLog: {
                title: '<i class="bi bi-file-text me-2"></i>Logcat 日志',
                width: '50%',
                height: '80%',
                x: '2%',
                y: '10%',
                minWidth: '400px',
                minHeight: '400px'
            },
            dosLog: {
                title: '<i class="bi bi-terminal me-2"></i>DOS 日志',
                width: '46%',
                height: '80%',
                x: '52%',
                y: '10%',
                minWidth: '400px',
                minHeight: '400px'
            }
        };
    }

    /**
     * 创建或显示窗口
     */
    openWindow(windowId, content, options = {}) {
        // 如果窗口已存在，先关闭
        if (this.windows.has(windowId)) {
            const existingWin = this.windows.get(windowId);
            if (existingWin && !existingWin.closed) {
                existingWin.focus();
                return existingWin;
            }
        }

        const config = this.windowConfigs[windowId] || {};
        const mergedOptions = { ...config, ...options };

        const win = new WinBox({
            id: windowId,
            class: ['no-full', 'no-max'],
            ...mergedOptions,
            html: content,
            onclose: () => {
                this.windows.delete(windowId);
                if (mergedOptions.onClose) {
                    mergedOptions.onClose();
                }
            },
            onfocus: () => {
                if (mergedOptions.onFocus) {
                    mergedOptions.onFocus();
                }
            }
        });

        this.windows.set(windowId, win);
        return win;
    }

    /**
     * 关闭指定窗口
     */
    closeWindow(windowId) {
        if (this.windows.has(windowId)) {
            const win = this.windows.get(windowId);
            win.close();
            this.windows.delete(windowId);
        }
    }

    /**
     * 关闭所有窗口
     */
    closeAllWindows() {
        this.windows.forEach((win, id) => {
            win.close();
        });
        this.windows.clear();
    }

    /**
     * 获取窗口实例
     */
    getWindow(windowId) {
        return this.windows.get(windowId);
    }

    /**
     * 检查窗口是否打开
     */
    isWindowOpen(windowId) {
        const win = this.windows.get(windowId);
        return win && !win.closed;
    }

    // ==================== 特定窗口创建方法 ====================

    /**
     * 打开文件上传对话框
     */
    openFileUploadWindow() {
        const content = document.getElementById('fileUploadTemplate').innerHTML;
        const win = this.openWindow('fileUpload', content, {
            onOpen: () => {
                // 重新绑定事件
                this.bindFileUploadEvents();
            }
        });
        
        // 立即绑定事件
        setTimeout(() => this.bindFileUploadEvents(), 100);
        
        return win;
    }

    /**
     * 绑定文件上传对话框事件
     */
    bindFileUploadEvents() {
        const fileInput = document.querySelector('#fileInput');
        const clearFilesBtn = document.querySelector('#clearFilesBtn');
        const uploadFilesBtn = document.querySelector('#uploadFilesBtn');
        const directoryInput = document.querySelector('#directoryInput');
        const confirmDirectoryBtn = document.querySelector('#confirmDirectoryBtn');

        if (fileInput) {
            // 克隆元素以移除旧事件监听器
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            newFileInput.addEventListener('change', () => {
                updateFileList();
            });
        }

        if (clearFilesBtn) {
            const newClearBtn = clearFilesBtn.cloneNode(true);
            clearFilesBtn.parentNode.replaceChild(newClearBtn, clearFilesBtn);
            newClearBtn.addEventListener('click', () => {
                clearFiles();
            });
        }

        if (uploadFilesBtn) {
            const newUploadBtn = uploadFilesBtn.cloneNode(true);
            uploadFilesBtn.parentNode.replaceChild(newUploadBtn, uploadFilesBtn);
            newUploadBtn.addEventListener('click', () => {
                uploadFiles();
                // 上传完成后关闭窗口
                setTimeout(() => {
                    this.closeWindow('fileUpload');
                }, 500);
            });
        }

        if (directoryInput) {
            const newDirInput = directoryInput.cloneNode(true);
            directoryInput.parentNode.replaceChild(newDirInput, directoryInput);
            newDirInput.addEventListener('change', () => {
                handleDirectoryInputChange();
            });
        }

        if (confirmDirectoryBtn) {
            const newConfirmBtn = confirmDirectoryBtn.cloneNode(true);
            confirmDirectoryBtn.parentNode.replaceChild(newConfirmBtn, confirmDirectoryBtn);
            newConfirmBtn.addEventListener('click', () => {
                handleConfirmDirectoryClick();
            });
        }
    }

    /**
     * 打开 Logcat 分析表窗口
     */
    openLogcatAnalysisWindow() {
        const content = document.getElementById('logcatAnalysisTemplate').innerHTML;
        const win = this.openWindow('logcatAnalysis', content);
        
        // 初始化 DataTable
        setTimeout(() => {
            // 创建新的 FileAnalysisManager 实例用于此窗口
            if (typeof FileAnalysisManager !== 'undefined') {
                const manager = new FileAnalysisManager({ lazyInit: true });
                manager.setTableId('logcatFileAnalysisTable');
                manager.initDataTable();
                
                // 复制已有数据
                if (window.logcatManager && window.logcatManager.fileAnalysisManager) {
                    const existingData = window.logcatManager.fileAnalysisManager.fileData;
                    existingData.forEach((value, key) => {
                        manager.fileData.set(key, value);
                    });
                    manager.updateTable();
                }
                
                // 保存引用以便后续更新
                win.fileAnalysisManager = manager;
            }
        }, 100);
        
        return win;
    }

    /**
     * 打开测试Result分析表窗口
     */
    openDosAnalysisWindow() {
        const content = document.getElementById('dosAnalysisTemplate').innerHTML;
        const win = this.openWindow('dosAnalysis', content);
        
        setTimeout(() => {
            if (window.dosFileAnalysisManager) {
                window.dosFileAnalysisManager.updateTable();
            }
        }, 100);
        
        return win;
    }

    /**
     * 打开 ADB 命令时间分析窗口
     */
    openAdbTimeAnalysisWindow() {
        const content = document.getElementById('adbTimeAnalysisTemplate').innerHTML;
        const win = this.openWindow('adbTimeAnalysis', content);
        
        setTimeout(() => {
            if (window.adbTimeAnalysisManager) {
                window.adbTimeAnalysisManager.updateTable();
            }
        }, 100);
        
        return win;
    }

    /**
     * 打开温度-开机时间分析窗口
     */
    openTemperatureBootTimeWindow() {
        const content = document.getElementById('temperatureBootTimeTemplate').innerHTML;
        const win = this.openWindow('temperatureBootTime', content);
        
        setTimeout(() => {
            if (window.temperatureBootTimeChart) {
                window.temperatureBootTimeChart.renderChart();
            }
        }, 100);
        
        return win;
    }

    /**
     * 打开运行次数-开机时间分析窗口
     */
    openRuntimesBootTimeWindow() {
        const content = document.getElementById('runtimesBootTimeTemplate').innerHTML;
        const win = this.openWindow('runtimesBootTime', content);
        
        setTimeout(() => {
            if (window.runtimesBootTimeChart) {
                window.runtimesBootTimeChart.renderChart();
            }
        }, 100);
        
        return win;
    }

    /**
     * 打开异常数据库表窗口
     */
    openAnomalyTableWindow() {
        const content = document.getElementById('anomalyTableTemplate').innerHTML;
        const win = this.openWindow('anomalyTable', content);
        
        setTimeout(() => {
            if (window.anomalyTableManager) {
                window.anomalyTableManager.updateTable();
            }
        }, 100);
        
        return win;
    }

    /**
     * 打开串口Log分析窗口
     */
    openPortLogAnalysisWindow() {
        const content = document.getElementById('portLogAnalysisTemplate').innerHTML;
        const win = this.openWindow('portLogAnalysis', content);
        
        setTimeout(() => {
            if (window.portLogAnalysisManager) {
                window.portLogAnalysisManager.updateTable();
            }
        }, 100);
        
        return win;
    }

    /**
     * 打开日志分析对话框（左侧 Logcat，右侧 DOS）
     */
    openLogAnalysisWindows() {
        // 先关闭可能已存在的日志窗口
        this.closeWindow('logcatLog');
        this.closeWindow('dosLog');

        // 创建 Logcat 日志窗口
        const logcatContent = document.getElementById('logcatLogTemplate').innerHTML;
        const logcatWin = this.openWindow('logcatLog', logcatContent, {
            onClose: () => {
                // 关闭 Logcat 窗口时同时关闭 DOS 窗口
                this.closeWindow('dosLog');
            }
        });

        // 创建 DOS 日志窗口
        const dosContent = document.getElementById('dosLogTemplate').innerHTML;
        const dosWin = this.openWindow('dosLog', dosContent, {
            onClose: () => {
                // 关闭 DOS 窗口时同时关闭 Logcat 窗口
                this.closeWindow('logcatLog');
            }
        });

        // 初始化 Monaco Editor
        setTimeout(() => {
            this.initLogAnalysisEditors();
        }, 200);

        return { logcatWin, dosWin };
    }

    /**
     * 初始化日志分析的 Monaco Editor
     */
    initLogAnalysisEditors() {
        // 使用现有的 monaco_editor_manager.js 中的逻辑
        if (window.monacoEditorManager) {
            window.monacoEditorManager.initEditors();
        }
    }

    /**
     * 更新所有打开的窗口中的表格数据
     */
    refreshAllTables() {
        // 注意：WinBox 窗口中的表格在窗口重新打开时会重新初始化
        // 这里不需要手动刷新，因为窗口打开时会自动加载最新数据
        console.log('表格数据已更新，重新打开窗口查看最新数据');
    }
}

// 创建全局实例
window.winBoxManager = new WinBoxManager();
