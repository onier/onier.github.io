
// 初始化 Logcat 解析器
let logcatManager = new LogcatManager();
window.logcatManager = logcatManager
// DOM 元素
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const noFilesMessage = document.getElementById('noFilesMessage');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const uploadFilesBtn = document.getElementById('uploadFilesBtn');

// 更新文件列表显示
fileInput.addEventListener('change', updateFileList);
clearFilesBtn.addEventListener('click', clearFiles);
uploadFilesBtn.addEventListener('click', uploadFiles);

// 更新文件列表
function updateFileList() {
    const files = fileInput.files;
}

// 上传并读取文件
function uploadFiles() {
    const files = fileInput.files;

    if (files.length === 0) {
        showAlert('请先选择至少一个文件！', 'warning');
        return;
    }

    // 显示加载状态
    const loading = showLoading(uploadFilesBtn, '读取中...');

    // 统计成功和失败的文件
    let successCount = 0;
    let errorCount = 0;
    const processedFiles = [];

    // 创建进度信息显示 - 简化版本，只显示文件个数统计
    const progressInfo = createSimpleProgressInfo(files.length);
    
    // 更新进度信息
    updateSimpleProgressInfo(progressInfo, 0, files.length, `开始读取 ${files.length} 个文件...`);

    // 遍历所有文件
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function (e) {
            const content = e.target.result;

            // 输出到浏览器控制台
            console.log(`=== 文件 ${i + 1}: ${file.name} ===`);
            console.log(`文件大小: ${(file.size / 1024).toFixed(2)} KB`);
            console.log(`文件类型: ${file.type || '未知'}`);

            try {
                // 更新进度信息 - 简化版本
                updateSimpleProgressInfo(progressInfo, i + 1, files.length, `正在处理: ${file.name}`);
                
                // 使用 LogcatManager 解析文件并更新表格
                logcatManager.addLogcatEntry(file.name, content, file.size);
                successCount++;
                processedFiles.push(file.name);
                console.log(`✓ 文件 ${file.name} 解析成功`);
            } catch (error) {
                console.error(`✗ 文件 ${file.name} 解析失败:`, error);
                errorCount++;
            }

            // 如果是最后一个文件，显示完成消息
            if (i === files.length - 1) {
                // 恢复按钮状态
                loading.restore();
                
                // 移除进度信息
                removeSimpleProgressInfo(progressInfo);

                // 显示结果消息 - 简化版本，只显示文件个数统计
                let message = '';
                if (successCount > 0 && errorCount === 0) {
                    message = `成功读取 ${successCount} 个文件！`;
                    showAlert(message, 'success');
                } else if (successCount > 0 && errorCount > 0) {
                    message = `成功读取 ${successCount} 个文件，${errorCount} 个文件失败`;
                    showAlert(message, 'warning');
                } else {
                    message = '所有文件读取失败，请检查文件格式。';
                    showAlert(message, 'danger');
                }

                // 更新侧边栏统计
                updateSidebarStats(successCount, files);
                
                // 触发文件上传完成事件，通知图表管理器更新文件列表
                const event = new CustomEvent('logcatFilesUploaded', {
                    detail: {
                        fileCount: successCount,
                        fileNames: processedFiles,
                        successCount: successCount,
                        errorCount: errorCount
                    }
                });
                document.dispatchEvent(event);
            }
        };

        reader.onerror = function () {
            console.error(`读取文件失败: ${file.name}`);
            errorCount++;
            
            // 更新进度信息
            updateSimpleProgressInfo(progressInfo, i + 1, files.length, `文件读取失败: ${file.name}`);

            // 如果是最后一个文件，恢复按钮状态
            if (i === files.length - 1) {
                loading.restore();
                removeSimpleProgressInfo(progressInfo);
                showAlert(`部分文件读取失败，成功: ${successCount}，失败: ${errorCount}`, 'danger');
            }
        };

        reader.readAsText(file);
    }
}

// 创建简化进度信息显示 - 只显示文件个数统计
function createSimpleProgressInfo(totalFiles) {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'simpleUploadProgressContainer';
    progressContainer.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        z-index: 9998;
        min-width: 250px;
        max-width: 300px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 12px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    progressContainer.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <i class="bi bi-upload me-2 text-primary fs-5"></i>
            <h6 class="mb-0 fw-bold">文件上传进度</h6>
        </div>
        <div class="progress mb-2" style="height: 6px;">
            <div id="simpleUploadProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                 style="width: 0%; background-color: #1a73e8;"></div>
        </div>
        <div class="d-flex justify-content-between align-items-center">
            <small id="simpleUploadProgressText" class="text-muted">准备中...</small>
            <small id="simpleUploadProgressPercent" class="fw-bold">0%</small>
        </div>
        <div class="mt-1">
            <small id="simpleUploadFileInfo" class="text-muted">0/${totalFiles} 个文件</small>
        </div>
    `;
    
    document.body.appendChild(progressContainer);
    
    return {
        container: progressContainer,
        progressBar: document.getElementById('simpleUploadProgressBar'),
        progressText: document.getElementById('simpleUploadProgressText'),
        progressPercent: document.getElementById('simpleUploadProgressPercent'),
        fileInfo: document.getElementById('simpleUploadFileInfo'),
        startTime: Date.now(),
        totalFiles: totalFiles
    };
}

// 更新简化进度信息
function updateSimpleProgressInfo(progressInfo, currentFile, totalFiles, message = '') {
    if (!progressInfo) return;
    
    const progressPercent = Math.round((currentFile / totalFiles) * 100);
    
    // 更新进度条
    if (progressInfo.progressBar) {
        progressInfo.progressBar.style.width = `${progressPercent}%`;
    }
    
    // 更新进度文本
    if (progressInfo.progressText) {
        progressInfo.progressText.textContent = message || `正在处理文件 ${currentFile}/${totalFiles}`;
    }
    
    // 更新百分比
    if (progressInfo.progressPercent) {
        progressInfo.progressPercent.textContent = `${progressPercent}%`;
    }
    
    // 更新文件信息
    if (progressInfo.fileInfo) {
        progressInfo.fileInfo.textContent = `${currentFile}/${totalFiles} 个文件`;
    }
}

// 移除简化进度信息
function removeSimpleProgressInfo(progressInfo) {
    if (progressInfo && progressInfo.container && progressInfo.container.parentNode) {
        // 添加淡出动画
        progressInfo.container.style.opacity = '0';
        progressInfo.container.style.transform = 'translateX(100%)';
        progressInfo.container.style.transition = 'opacity 0.3s, transform 0.3s';
        
        setTimeout(() => {
            if (progressInfo.container.parentNode) {
                progressInfo.container.parentNode.removeChild(progressInfo.container);
            }
        }, 300);
    }
}

// 创建进度信息显示
function createProgressInfo(totalFiles) {
    const progressContainer = document.createElement('div');
    progressContainer.id = 'uploadProgressContainer';
    progressContainer.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        z-index: 9998;
        min-width: 300px;
        max-width: 400px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 15px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    progressContainer.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <i class="bi bi-upload me-2 text-primary fs-5"></i>
            <h6 class="mb-0 fw-bold">文件上传进度</h6>
        </div>
        <div class="progress mb-2" style="height: 8px;">
            <div id="uploadProgressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                 style="width: 0%; background-color: #1a73e8;"></div>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-1">
            <small id="uploadProgressText" class="text-muted">准备中...</small>
            <small id="uploadProgressPercent" class="fw-bold">0%</small>
        </div>
        <div class="d-flex justify-content-between align-items-center">
            <small id="uploadFileInfo" class="text-muted">0/${totalFiles} 个文件</small>
            <small id="uploadTimeInfo" class="text-muted">预计时间: 计算中...</small>
        </div>
    `;
    
    document.body.appendChild(progressContainer);
    
    // 确保CSS动画存在
    if (!document.querySelector('#alert-animations')) {
        const style = document.createElement('style');
        style.id = 'alert-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes progressShrink {
                from { width: 100%; }
                to { width: 0%; }
            }
            .custom-alert .progress-bar {
                transition: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    return {
        container: progressContainer,
        progressBar: document.getElementById('uploadProgressBar'),
        progressText: document.getElementById('uploadProgressText'),
        progressPercent: document.getElementById('uploadProgressPercent'),
        fileInfo: document.getElementById('uploadFileInfo'),
        timeInfo: document.getElementById('uploadTimeInfo'),
        startTime: Date.now(),
        totalFiles: totalFiles
    };
}

// 更新进度信息
function updateProgressInfo(progressInfo, currentFile, totalFiles, message = '') {
    if (!progressInfo) return;
    
    const progressPercent = Math.round((currentFile / totalFiles) * 100);
    const elapsedTime = Date.now() - progressInfo.startTime;
    const estimatedTotalTime = elapsedTime / (currentFile || 1) * totalFiles;
    const remainingTime = estimatedTotalTime - elapsedTime;
    
    // 更新进度条
    if (progressInfo.progressBar) {
        progressInfo.progressBar.style.width = `${progressPercent}%`;
    }
    
    // 更新进度文本
    if (progressInfo.progressText) {
        progressInfo.progressText.textContent = message || `正在处理文件 ${currentFile}/${totalFiles}`;
    }
    
    // 更新百分比
    if (progressInfo.progressPercent) {
        progressInfo.progressPercent.textContent = `${progressPercent}%`;
    }
    
    // 更新文件信息
    if (progressInfo.fileInfo) {
        progressInfo.fileInfo.textContent = `${currentFile}/${totalFiles} 个文件`;
    }
    
    // 更新时间信息
    if (progressInfo.timeInfo) {
        if (currentFile === 0) {
            progressInfo.timeInfo.textContent = '预计时间: 计算中...';
        } else if (currentFile === totalFiles) {
            const totalSeconds = Math.round(elapsedTime / 1000);
            progressInfo.timeInfo.textContent = `完成时间: ${totalSeconds}秒`;
        } else {
            const remainingSeconds = Math.round(remainingTime / 1000);
            progressInfo.timeInfo.textContent = `剩余时间: ${remainingSeconds}秒`;
        }
    }
}

// 移除进度信息
function removeProgressInfo(progressInfo) {
    if (progressInfo && progressInfo.container && progressInfo.container.parentNode) {
        // 添加淡出动画
        progressInfo.container.style.opacity = '0';
        progressInfo.container.style.transform = 'translateX(100%)';
        progressInfo.container.style.transition = 'opacity 0.3s, transform 0.3s';
        
        setTimeout(() => {
            if (progressInfo.container.parentNode) {
                progressInfo.container.parentNode.removeChild(progressInfo.container);
            }
        }, 300);
    }
}

// 清空已选文件
function clearFiles() {
    fileInput.value = '';
    updateFileList();
    showAlert('已清空文件选择', 'info');
}

// 显示提示消息 - 改进版本
function showAlert(message, type = 'info', duration = 5000) {
    // 移除已存在的相同类型提示
    const existingAlerts = document.querySelectorAll('.custom-alert');
    existingAlerts.forEach(alert => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    });

    // 创建改进的 alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `custom-alert alert alert-${type} alert-dismissible fade show`;
    alertDiv.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border: none;
        border-radius: 8px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    // 根据类型设置图标
    let icon = 'bi-info-circle';
    if (type === 'success') icon = 'bi-check-circle';
    if (type === 'warning') icon = 'bi-exclamation-triangle';
    if (type === 'danger') icon = 'bi-x-circle';
    
    alertDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${icon} me-2 fs-5"></i>
            <div class="flex-grow-1">${message}</div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="关闭"></button>
        </div>
        <div class="progress mt-2" style="height: 3px;">
            <div class="progress-bar bg-${type}" style="width: 100%; animation: progressShrink ${duration}ms linear;"></div>
        </div>
    `;

    document.body.appendChild(alertDiv);

    // 添加CSS动画
    if (!document.querySelector('#alert-animations')) {
        const style = document.createElement('style');
        style.id = 'alert-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes progressShrink {
                from { width: 100%; }
                to { width: 0%; }
            }
            .custom-alert .progress-bar {
                transition: none;
            }
        `;
        document.head.appendChild(style);
    }

    // 自动消失
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.classList.remove('show');
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 300);
        }
    }, duration);
}

// 显示加载状态
function showLoading(button, text = '处理中...') {
    if (!button) return null;
    
    const originalHTML = button.innerHTML;
    const originalDisabled = button.disabled;
    
    button.innerHTML = `<span class="loading-spinner me-2"></span>${text}`;
    button.disabled = true;
    
    return {
        restore: function() {
            button.innerHTML = originalHTML;
            button.disabled = originalDisabled;
        }
    };
}

// 显示确认对话框
function showConfirm(message, onConfirm, onCancel = null) {
    // 创建模态框
    const modalId = 'confirmModal_' + Date.now();
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">确认操作</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex align-items-center">
                            <i class="bi bi-question-circle text-warning me-3 fs-3"></i>
                            <div>${message}</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="confirmBtn">确认</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    const modal = new bootstrap.Modal(document.getElementById(modalId));
    modal.show();
    
    // 事件处理
    document.getElementById('confirmBtn').addEventListener('click', function() {
        modal.hide();
        setTimeout(() => {
            if (modalContainer.parentNode) {
                modalContainer.parentNode.removeChild(modalContainer);
            }
            if (onConfirm) onConfirm();
        }, 300);
    });
    
    document.getElementById(modalId).addEventListener('hidden.bs.modal', function() {
        setTimeout(() => {
            if (modalContainer.parentNode) {
                modalContainer.parentNode.removeChild(modalContainer);
            }
            if (onCancel) onCancel();
        }, 300);
    });
}

// 更新侧边栏统计信息
function updateSidebarStats(fileCount, files) {
    // 计算总文件大小
    let totalSize = 0;
    for (let file of files) {
        totalSize += file.size;
    }
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    // 更新侧边栏统计
    const fileBadge = document.querySelector('.sidebar .badge.bg-primary');
    const storageBadge = document.querySelector('.sidebar .badge.bg-info');

    if (fileBadge) {
        fileBadge.textContent = fileCount;
    }

    if (storageBadge) {
        storageBadge.textContent = `${totalSizeMB} MB`;
    }
}

// 页面切换功能
function switchToDashboard(event) {
    if (event) event.preventDefault();

    // 切换内容显示 - 兼容新旧两种系统
    const dashboard = document.getElementById('dashboardContent');
    const logAnalysis = document.getElementById('logAnalysisContent');
    const processAnalysis = document.getElementById('processAnalysisContent');
    
    // 新系统：使用 active 类
    dashboard.classList.add('active');
    logAnalysis.classList.remove('active');
    processAnalysis.classList.remove('active');
    
    // 旧系统：使用 d-none 类（兼容旧代码）
    dashboard.classList.remove('d-none');
    logAnalysis.classList.add('d-none');
    processAnalysis.classList.add('d-none');
    
    // 强制设置内联样式确保正确显示/隐藏（使用 !important）
    dashboard.style.setProperty('display', '', 'important');
    logAnalysis.style.setProperty('display', 'none', 'important');
    processAnalysis.style.setProperty('display', 'none', 'important');

    // 更新导航激活状态
    updateNavActiveState('dashboard');

    // 更新页面标题
    document.title = 'Logcat 分析仪表板';
}

function switchToLogAnalysis(event) {
    if (event) event.preventDefault();

    // 切换内容显示 - 兼容新旧两种系统
    const dashboard = document.getElementById('dashboardContent');
    const logAnalysis = document.getElementById('logAnalysisContent');
    const processAnalysis = document.getElementById('processAnalysisContent');
    
    // 新系统：使用 active 类
    dashboard.classList.remove('active');
    logAnalysis.classList.add('active');
    processAnalysis.classList.remove('active');
    
    // 旧系统：使用 d-none 类（兼容旧代码）
    dashboard.classList.add('d-none');
    logAnalysis.classList.remove('d-none');
    processAnalysis.classList.add('d-none');
    
    // 强制设置内联样式确保正确显示/隐藏（使用 !important）
    dashboard.style.setProperty('display', 'none', 'important');
    logAnalysis.style.setProperty('display', '', 'important');
    processAnalysis.style.setProperty('display', 'none', 'important');

    // 更新导航激活状态
    updateNavActiveState('logAnalysis');

    // 更新页面标题
    document.title = '日志分析 - Logcat 分析仪表板';

    // 切换到日志分析页面时，更新文件选择器
    if (window.logcatComparisonManager) {
        // 延迟一点时间确保DOM已更新
        setTimeout(() => {
            window.logcatComparisonManager.updateFileSelectors();
        }, 100);
    }
}

function switchToProcessAnalysis(event) {
    if (event) event.preventDefault();

    // 切换内容显示 - 兼容新旧两种系统
    const dashboard = document.getElementById('dashboardContent');
    const logAnalysis = document.getElementById('logAnalysisContent');
    const processAnalysis = document.getElementById('processAnalysisContent');
    
    // 新系统：使用 active 类
    dashboard.classList.remove('active');
    logAnalysis.classList.remove('active');
    processAnalysis.classList.add('active');
    
    // 旧系统：使用 d-none 类（兼容旧代码）
    dashboard.classList.add('d-none');
    logAnalysis.classList.add('d-none');
    processAnalysis.classList.remove('d-none');
    
    // 强制设置内联样式确保正确显示/隐藏（使用 !important）
    dashboard.style.setProperty('display', 'none', 'important');
    logAnalysis.style.setProperty('display', 'none', 'important');
    processAnalysis.style.setProperty('display', '', 'important');

    // 更新导航激活状态
    updateNavActiveState('processAnalysis');

    // 更新页面标题
    document.title = '进程分析 - Logcat 分析仪表板';
}

function updateNavActiveState(activePage) {
    // 获取所有导航链接
    const navLinks = document.querySelectorAll('.sidebar .nav-link, .sidebar-nav .nav-link');

    // 移除所有激活状态
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // 根据页面设置激活状态 - 兼容新旧两种导航结构
    // 新系统：使用 data-page 属性
    const newNavLink = document.querySelector(`.sidebar-nav .nav-link[data-page="${activePage}"]`);
    if (newNavLink) {
        newNavLink.classList.add('active');
        return;
    }
    
    // 旧系统：使用 onclick 属性
    if (activePage === 'dashboard') {
        const oldLink = document.querySelector('.sidebar .nav-link[onclick*="switchToDashboard"]');
        if (oldLink) oldLink.classList.add('active');
    } else if (activePage === 'logAnalysis') {
        const oldLink = document.querySelector('.sidebar .nav-link[onclick*="switchToLogAnalysis"]');
        if (oldLink) oldLink.classList.add('active');
    } else if (activePage === 'processAnalysis') {
        const oldLink = document.querySelector('.sidebar .nav-link[onclick*="switchToProcessAnalysis"]');
        if (oldLink) oldLink.classList.add('active');
    }
}

// 日志分析功能
function analyzeLogs() {
    // 显示分析中状态
    const analyzeBtn = document.querySelector('#logAnalysisContent .btn-outline-primary');
    const originalText = analyzeBtn.innerHTML;
    analyzeBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>分析中...';
    analyzeBtn.disabled = true;

    // 模拟分析过程
    setTimeout(() => {
        // 生成模拟数据
        const errorCount = Math.floor(Math.random() * 50) + 10;
        const warningCount = Math.floor(Math.random() * 100) + 20;
        const infoCount = Math.floor(Math.random() * 200) + 50;
        const totalCount = errorCount + warningCount + infoCount;

        // 更新统计数字
        document.getElementById('errorCount').textContent = errorCount;
        document.getElementById('warningCount').textContent = warningCount;
        document.getElementById('infoCount').textContent = infoCount;
        document.getElementById('totalCount').textContent = totalCount;

        // 更新进度条
        const errorPercent = Math.round((errorCount / totalCount) * 100);
        const warningPercent = Math.round((warningCount / totalCount) * 100);
        const infoPercent = Math.round((infoCount / totalCount) * 100);
        const otherPercent = 100 - errorPercent - warningPercent - infoPercent;

        const progressBar = document.querySelector('#logAnalysisContent .progress');
        progressBar.innerHTML = `
                    <div class="progress-bar bg-danger" style="width: ${errorPercent}%">错误 ${errorPercent}%</div>
                    <div class="progress-bar bg-warning" style="width: ${warningPercent}%">警告 ${warningPercent}%</div>
                    <div class="progress-bar bg-info" style="width: ${infoPercent}%">信息 ${infoPercent}%</div>
                    <div class="progress-bar bg-success" style="width: ${otherPercent}%">其他 ${otherPercent}%</div>
                `;

        // 生成模拟日志数据
        const logTable = document.getElementById('logAnalysisTable');
        logTable.innerHTML = '';

        const logLevels = ['错误', '警告', '信息'];
        const logTags = ['System', 'App', 'Network', 'Security', 'Performance'];
        const logMessages = [
            '系统服务启动失败',
            '内存使用超过阈值',
            '网络连接超时',
            '安全权限检查通过',
            '性能优化建议',
            '数据库连接异常',
            '用户登录成功',
            '文件上传完成'
        ];

        for (let i = 0; i < 8; i++) {
            const level = logLevels[Math.floor(Math.random() * logLevels.length)];
            const tag = logTags[Math.floor(Math.random() * logTags.length)];
            const message = logMessages[Math.floor(Math.random() * logMessages.length)];
            const time = `12-02 1${Math.floor(Math.random() * 10)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;

            let levelClass = 'badge bg-info';
            if (level === '错误') levelClass = 'badge bg-danger';
            if (level === '警告') levelClass = 'badge bg-warning';

            const row = document.createElement('tr');
            row.innerHTML = `
                        <td>${time}</td>
                        <td><span class="${levelClass}">${level}</span></td>
                        <td><span class="badge bg-secondary">${tag}</span></td>
                        <td>${message}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewLogDetail(${i})">
                                <i class="bi bi-eye"></i> 查看
                            </button>
                        </td>
                    `;
            logTable.appendChild(row);
        }

        // 恢复按钮状态
        analyzeBtn.innerHTML = originalText;
        analyzeBtn.disabled = false;

        // 显示成功消息
        showAlert('日志分析完成！已生成分析报告。', 'success');

        // 输出到控制台
        console.log('=== 日志分析结果 ===');
        console.log(`错误数量: ${errorCount}`);
        console.log(`警告数量: ${warningCount}`);
        console.log(`信息数量: ${infoCount}`);
        console.log(`总日志数: ${totalCount}`);
        console.log('===================');

    }, 1500); // 1.5秒模拟分析时间
}

function viewLogDetail(logId) {
    console.log(`查看日志详情 ID: ${logId}`);
    showAlert(`正在查看日志详情 #${logId + 1}`, 'info');
}

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    // 添加拖拽支持
    const dropArea = document.querySelector('.card-body');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('border', 'border-primary', 'border-3');
    }

    function unhighlight() {
        dropArea.classList.remove('border', 'border-primary', 'border-3');
    }

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        fileInput.files = files;
        updateFileList();
        showAlert(`已添加 ${files.length} 个文件`, 'success');
    }

    // 初始化页面状态
    switchToDashboard();

    // 初始化侧边栏折叠功能
    initSidebarToggle();

    // 初始化目录上传事件
    initDirectoryUploadEvents();
});

// 侧边栏折叠功能
function initSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (!sidebarToggle || !sidebar) return;
    
    // 从localStorage读取保存的状态
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
        updateToggleButtonIcon(true);
    }
    
    // 添加点击事件监听
    sidebarToggle.addEventListener('click', function() {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        
        // 更新按钮图标
        updateToggleButtonIcon(isCollapsed);
        
        // 保存状态到localStorage
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        
        console.log(`侧边栏已${isCollapsed ? '折叠' : '展开'}`);
    });
    
    // 更新按钮图标
    function updateToggleButtonIcon(isCollapsed) {
        const icon = sidebarToggle.querySelector('i');
        if (icon) {
            if (isCollapsed) {
                icon.className = 'bi bi-chevron-right';
                sidebarToggle.title = '展开侧边栏';
            } else {
                icon.className = 'bi bi-chevron-left';
                sidebarToggle.title = '折叠侧边栏';
            }
        }
    }
    
    // 添加键盘快捷键支持 (Ctrl+B 或 Cmd+B)
    document.addEventListener('keydown', function(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
            event.preventDefault();
            sidebarToggle.click();
        }
    });
    
    // 初始化进程分析功能
    initProcessAnalysis();
}

// 进程分析功能
function initProcessAnalysis() {
    // 获取DOM元素
    const compareProcessBtn = document.getElementById('compareProcessBtn');
    const refreshProcessAnalysisBtn = document.getElementById('refreshProcessAnalysisBtn');
    const exportProcessAnalysisBtn = document.getElementById('exportProcessAnalysisBtn');
    
    if (!compareProcessBtn) {
        console.log('进程分析按钮未找到，跳过初始化');
        return;
    }
    
    // 监听文件上传完成事件，更新文件选择器
    document.addEventListener('logcatFilesUploaded', function(event) {
        updateProcessFileSelectors();
    });
    
    // 对比按钮点击事件
    compareProcessBtn.addEventListener('click', compareProcessAnalysis);
    
    // 刷新按钮点击事件
    if (refreshProcessAnalysisBtn) {
        refreshProcessAnalysisBtn.addEventListener('click', function() {
            updateProcessFileSelectors();
            showAlert('文件列表已刷新', 'info');
        });
    }
    
    // 导出按钮点击事件
    if (exportProcessAnalysisBtn) {
        exportProcessAnalysisBtn.addEventListener('click', exportProcessAnalysisResults);
    }
    
    // 初始化文件选择器
    updateProcessFileSelectors();
}

// 更新进程分析文件选择器
function updateProcessFileSelectors() {
    const fileSelect1 = document.getElementById('processCompareFile1');
    const fileSelect2 = document.getElementById('processCompareFile2');
    
    if (!fileSelect1 || !fileSelect2) return;
    
    // 获取已上传的文件列表
    const fileNames = window.logcatManager ? Object.keys(window.logcatManager.logcatEntryMap || {}) : [];
    
    // 保存当前选中的值
    const selectedFile1 = fileSelect1.value;
    const selectedFile2 = fileSelect2.value;
    
    // 清空选项
    fileSelect1.innerHTML = '<option value="" disabled selected>选择文件...</option>';
    fileSelect2.innerHTML = '<option value="" disabled selected>选择文件...</option>';
    
    // 添加文件选项
    fileNames.forEach(fileName => {
        const option1 = document.createElement('option');
        option1.value = fileName;
        option1.textContent = fileName;
        fileSelect1.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = fileName;
        option2.textContent = fileName;
        fileSelect2.appendChild(option2);
    });
    
    // 恢复选中的值
    if (selectedFile1 && fileNames.includes(selectedFile1)) {
        fileSelect1.value = selectedFile1;
    }
    
    if (selectedFile2 && fileNames.includes(selectedFile2)) {
        fileSelect2.value = selectedFile2;
    }
}

// 对比进程分析
function compareProcessAnalysis() {
    const file1 = document.getElementById('processCompareFile1').value;
    const file2 = document.getElementById('processCompareFile2').value;
    const compareBtn = document.getElementById('compareProcessBtn');
    
    // 验证输入
    if (!file1 || !file2) {
        showAlert('请选择两个文件进行对比', 'warning');
        return;
    }
    
    if (file1 === file2) {
        showAlert('请选择两个不同的文件进行对比', 'warning');
        return;
    }
    
    // 检查文件是否存在
    if (!window.logcatManager || !window.logcatManager.logcatEntryMap[file1] || !window.logcatManager.logcatEntryMap[file2]) {
        showAlert('选择的文件数据不存在，请确保文件已正确上传', 'danger');
        return;
    }
    
    // 显示分析中状态
    const originalText = compareBtn.innerHTML;
    compareBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>分析中...';
    compareBtn.disabled = true;
    
    try {
        // 创建进程分析实例
        const processAnalysis = new ProcessAnalysis();
        
        // 执行对比分析
        const result = processAnalysis.calculateProcessAnalysis(file1, file2);
        
        // 显示结果
        displayProcessAnalysisResults(result);
        
        // 显示成功消息
        showAlert('进程分析完成！', 'success');
        
    } catch (error) {
        console.error('进程分析失败:', error);
        showAlert(`进程分析失败: ${error.message}`, 'danger');
    } finally {
        // 恢复按钮状态
        compareBtn.innerHTML = originalText;
        compareBtn.disabled = false;
    }
}

// 显示进程分析结果
function displayProcessAnalysisResults(result) {
    // 显示结果卡片
    const resultCard = document.getElementById('processCompareResultCard');
    const detailsCard = document.getElementById('processCompareDetailsCard');
    
    if (resultCard) resultCard.classList.remove('d-none');
    if (detailsCard) detailsCard.classList.remove('d-none');
    
    // 更新概览数据
    const uniqueInFile1 = result.uniqueInFile1 || [];
    const uniqueInFile2 = result.uniqueInFile2 || [];
    const commonDifferences = result.commonDifferences || new Map();
    
    // 计算差异进程数（差异百分比不为0的进程）
    let differentProcessesCount = 0;
    commonDifferences.forEach(diff => {
        if (Math.abs(diff.diff_percent) > 0.1) { // 差异超过0.1%视为有差异
            differentProcessesCount++;
        }
    });
    
    // 更新概览卡片
    document.getElementById('uniqueProcessesFile1').textContent = uniqueInFile1.length;
    document.getElementById('uniqueProcessesFile2').textContent = uniqueInFile2.length;
    document.getElementById('commonProcessesCount').textContent = commonDifferences.size;
    document.getElementById('differentProcessesCount').textContent = differentProcessesCount;
    
    // 更新独有进程表格
    updateUniqueProcessesTable('uniqueProcessesTable1', uniqueInFile1, result.processMap1);
    updateUniqueProcessesTable('uniqueProcessesTable2', uniqueInFile2, result.processMap2);
    
    // 更新共有进程差异表格
    updateCommonProcessesTable('commonProcessesTable', commonDifferences);
}

// 更新独有进程表格
function updateUniqueProcessesTable(tableId, uniqueProcesses, processMap) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // 清空表格
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // 添加数据行
    uniqueProcesses.forEach(processName => {
        const row = document.createElement('tr');
        const processCount = processMap.get(processName)?.length || 0;
        
        row.innerHTML = `
            <td>${processName || '(空标签)'}</td>
            <td>${processCount}</td>
        `;
        tbody.appendChild(row);
    });
    
    // 如果没有数据，显示提示
    if (uniqueProcesses.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="2" class="text-muted text-center">无独有进程</td>
        `;
        tbody.appendChild(row);
    }
}

// 更新共有进程差异表格
function updateCommonProcessesTable(tableId, commonDifferences) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    // 如果DataTable已经初始化，先销毁它
    if ($.fn.DataTable.isDataTable('#' + tableId)) {
        $('#' + tableId).DataTable().destroy();
        $('#' + tableId).empty(); // 清空表格内容
    }
    
    // 重新构建表格结构
    const tableHtml = `
        <thead>
            <tr>
                <th>进程名</th>
                <th>文件1数量</th>
                <th>文件2数量</th>
                <th>差异</th>
                <th>差异百分比</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    table.innerHTML = tableHtml;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // 准备数据
    const tableData = [];
    
    // 添加数据行
    commonDifferences.forEach((diff, processName) => {
        const diffSign = diff.diff > 0 ? '+' : '';
        const diffPercent = diff.diff_percent.toFixed(2);
        
        // 根据差异设置行样式类
        let rowClass = '';
        if (Math.abs(diff.diff_percent) > 10) {
            rowClass = diff.diff > 0 ? 'table-warning' : 'table-info';
        }
        
        tableData.push([
            processName || '(空标签)',
            diff.count1,
            diff.count2,
            `${diffSign}${diff.diff}`,
            `${diffPercent}%`
        ]);
    });
    
    // 如果没有数据，显示提示
    if (commonDifferences.size === 0) {
        tableData.push([
            '无共有进程',
            '',
            '',
            '',
            ''
        ]);
    }
    
    // 初始化DataTable
    const dataTable = $('#' + tableId).DataTable({
        data: tableData,
        columns: [
            { title: '进程名' },
            { title: '文件1数量' },
            { title: '文件2数量' },
            { title: '差异' },
            { title: '差异百分比' }
        ],
        language: {
            emptyTable: "表中数据为空",
            info: "显示第 _START_ 至 _END_ 项结果，共 _TOTAL_ 项",
            infoEmpty: "显示第 0 至 0 项结果，共 0 项",
            infoFiltered: "(由 _MAX_ 项结果过滤)",
            infoPostFix: "",
            thousands: ",",
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
            },
            aria: {
                sortAscending: ": 升序排列",
                sortDescending: ": 降序排列"
            }
        },
        pageLength: 10,
        lengthMenu: [5, 10, 25, 50, 100],
        order: [[0, 'asc']], // 默认按进程名升序排序
        dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
             '<"row"<"col-sm-12"tr>>' +
             '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
        initComplete: function() {
            // 为特定行添加样式
            const api = this.api();
            api.rows().every(function(rowIdx) {
                const data = this.data();
                if (data[0] === '无共有进程') {
                    $(this.node()).addClass('text-muted text-center');
                    $(this.node()).attr('colspan', 5);
                }
            });
        },
        createdRow: function(row, data, dataIndex) {
            // 根据差异百分比为行添加样式
            if (data[0] !== '无共有进程') {
                const diffPercent = parseFloat(data[4].replace('%', ''));
                if (Math.abs(diffPercent) > 10) {
                    if (diffPercent > 0) {
                        $(row).addClass('table-warning');
                    } else {
                        $(row).addClass('table-info');
                    }
                }
            }
        }
    });
    
    return dataTable;
}

// 导出进程分析结果
function exportProcessAnalysisResults() {
    const resultCard = document.getElementById('processCompareResultCard');
    const detailsCard = document.getElementById('processCompareDetailsCard');
    
    if (resultCard.classList.contains('d-none') || detailsCard.classList.contains('d-none')) {
        showAlert('请先进行进程分析再导出结果', 'warning');
        return;
    }
    
    // 构建导出数据
    const exportData = {
        timestamp: new Date().toISOString(),
        file1: document.getElementById('processCompareFile1').value,
        file2: document.getElementById('processCompareFile2').value,
        uniqueInFile1: document.getElementById('uniqueProcessesFile1').textContent,
        uniqueInFile2: document.getElementById('uniqueProcessesFile2').textContent,
        commonProcesses: document.getElementById('commonProcessesCount').textContent,
        differentProcesses: document.getElementById('differentProcessesCount').textContent
    };
    
    // 创建导出内容
    const exportContent = JSON.stringify(exportData, null, 2);
    
    // 创建下载链接
    const blob = new Blob([exportContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `process_analysis_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('分析结果已导出为JSON文件', 'success');
}

// ============================================
// 目录选择事件处理 - 六个空函数
// ============================================

// 1. 处理目录选择变化事件
function handleDirectoryInputChange() {
    // TODO: 实现目录选择变化事件处理
    console.log('目录选择变化事件 - 待实现');
}

// 2. 处理目录确认按钮点击事件
function handleConfirmDirectoryClick() {
    const directoryInput = document.getElementById('directoryInput');
    const directoryPreview = document.getElementById('directoryPreview');
    const directoryInfo = document.getElementById('directoryInfo');
    const directoryFilesTable = document.getElementById('directoryFilesTable');
    
    if (!directoryInput || !directoryPreview || !directoryInfo || !directoryFilesTable) {
        console.error('目录确认相关DOM元素未找到');
        showAlert('目录确认功能初始化失败', 'danger');
        return;
    }
    
    // 获取选中的文件列表
    const files = directoryInput.files;
    const fileUtils = window.logcatManager.fileUtils;
    // 由于 read_result_file 现在是异步函数，需要处理异步操作
    fileUtils.read_result_file(files).then(result => {
        if (result && result.success) {
            console.log('文件解析完成:', result.message);
        } else {
            console.error('文件解析失败:', result ? result.message : '未知错误');
        }
    }).catch(error => {
        console.error('调用 read_result_file 时出错:', error);
    });
    
    // 获取目录路径
    let directoryPath = '未选择目录';
    if (files.length > 0 && files[0].webkitRelativePath) {
        directoryPath = files[0].webkitRelativePath.split('/')[0];
    }
    
    // 设置页面标题 - 直接在"Logcat 分析仪表板"后面加上路径
    document.title = `Logcat 分析仪表板 ${directoryPath}`;
    
    // 更新导航栏标题控件 - 在"Logcat 分析仪表板"后面显示目录路径
    const navbarBrand = document.querySelector('.navbar-brand');
    if (navbarBrand) {
        navbarBrand.innerHTML = `<i class="bi bi-speedometer2 me-2"></i>Logcat 分析仪表板 ${directoryPath}`;
        console.log(`导航栏标题已更新: Logcat 分析仪表板 ${directoryPath}`);
    } else {
        console.warn('未找到导航栏标题控件');
    }
    
    console.log(`目录路径已设置为标题: ${directoryPath}`);
    
    // if (files.length === 0) {
    //     showAlert('请先选择目录', 'warning');
    //     return;
    // }
    
    // // 过滤出.log和.txt文件
    // const logcatFiles = Array.from(files).filter(file => {
    //     const fileName = file.name.toLowerCase();
    //     return fileName.endsWith('.log') || fileName.endsWith('.txt');
    // });
    
    // if (logcatFiles.length === 0) {
    //     showAlert('选择的目录中没有找到.log或.txt文件', 'warning');
    //     return;
    // }
    
    // // 计算总大小
    // let totalSize = 0;
    // logcatFiles.forEach(file => {
    //     totalSize += file.size;
    // });
    
    // // 更新目录信息
    // const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    // directoryInfo.innerHTML = `
    //     <div class="d-flex justify-content-between">
    //         <span>目录: <strong>${files[0].webkitRelativePath.split('/')[0] || '未知目录'}</strong></span>
    //         <span>文件数: <strong>${logcatFiles.length}</strong></span>
    //     </div>
    //     <div class="d-flex justify-content-between">
    //         <span>总大小: <strong>${totalSizeMB} MB</strong></span>
    //         <span>文件类型: <strong>.log, .txt</strong></span>
    //     </div>
    // `;
    
    // // 更新文件表格
    // updateDirectoryPreview(logcatFiles);
    
    // // 显示预览区域
    // directoryPreview.classList.remove('d-none');
    
    // // 显示成功消息
    // showAlert(`已确认目录选择，找到 ${logcatFiles.length} 个logcat文件`, 'success');
    // console.log(`目录确认完成，找到 ${logcatFiles.length} 个文件，总大小: ${totalSizeMB} MB`);
}

// 3. 清空目录选择
function clearDirectorySelection() {
    const directoryInput = document.getElementById('directoryInput');
    const directoryPreview = document.getElementById('directoryPreview');
    const directoryInfo = document.getElementById('directoryInfo');
    const directoryFilesTable = document.getElementById('directoryFilesTable');
    
    // 清空目录选择器
    if (directoryInput) {
        directoryInput.value = '';
    }
    
    // 隐藏预览区域
    if (directoryPreview) {
        directoryPreview.classList.add('d-none');
    }
    
    // 清空目录信息
    if (directoryInfo) {
        directoryInfo.innerHTML = '';
    }
    
    // 清空文件表格
    if (directoryFilesTable) {
        const tbody = directoryFilesTable.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
    }
    
    // 重置全选复选框
    const selectAllFiles = document.getElementById('selectAllFiles');
    if (selectAllFiles) {
        selectAllFiles.checked = false;
        selectAllFiles.indeterminate = false;
    }
    
    showAlert('目录选择已清空', 'info');
    console.log('目录选择已清空');
}

// 4. 切换上传模式（文件/目录）- 简化版本
function switchUploadMode(mode) {
    // 这个函数现在只是一个空函数，因为移除了模式切换
    console.log('切换上传模式到: ' + mode + ' - 模式切换已移除，使用独立的选择器');
}

// 5. 初始化目录选择器事件监听 - 简化版本
function initDirectoryUploadEvents() {
    // 获取DOM元素
    const directoryInput = document.getElementById('directoryInput');
    const clearDirectoryBtn = document.getElementById('clearDirectoryBtn');
    const confirmDirectoryBtn = document.getElementById('confirmDirectoryBtn');
    
    // 添加目录选择器变化事件
    if (directoryInput) {
        directoryInput.addEventListener('change', handleDirectoryInputChange);
        console.log('目录选择器变化事件监听已添加');
    }
    
    // 添加清空目录按钮事件
    if (clearDirectoryBtn) {
        clearDirectoryBtn.addEventListener('click', clearDirectorySelection);
        console.log('清空目录按钮事件监听已添加');
    }
    
    // 添加目录确认按钮事件
    if (confirmDirectoryBtn) {
        confirmDirectoryBtn.addEventListener('click', handleConfirmDirectoryClick);
        console.log('目录确认按钮事件监听已添加');
    }
    
    console.log('目录选择器事件监听已初始化（简化版本）');
}

// 6. 更新目录文件预览
function updateDirectoryPreview(files) {
    const directoryFilesTable = document.getElementById('directoryFilesTable');
    const selectAllFiles = document.getElementById('selectAllFiles');
    
    if (!directoryFilesTable) {
        console.error('目录文件表格未找到');
        return;
    }
    
    // 清空表格内容
    const tbody = directoryFilesTable.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // 按文件名排序
    const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));
    
    // 添加文件行
    sortedFiles.forEach((file, index) => {
        const row = document.createElement('tr');
        const fileSizeKB = (file.size / 1024).toFixed(2);
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const displaySize = file.size > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;
        
        row.innerHTML = `
            <td>
                <div class="form-check">
                    <input class="form-check-input file-checkbox" type="checkbox" value="${index}" id="fileCheck${index}" checked>
                </div>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <i class="bi bi-file-text me-2 text-primary"></i>
                    <span title="${file.name}">${file.name}</span>
                </div>
            </td>
            <td>${displaySize}</td>
        `;
        tbody.appendChild(row);
    });
    
    // 添加全选复选框事件
    if (selectAllFiles) {
        selectAllFiles.checked = true;
        selectAllFiles.addEventListener('change', function() {
            const checkboxes = tbody.querySelectorAll('.file-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }
    
    // 添加单个复选框事件，更新全选复选框状态
    const checkboxes = tbody.querySelectorAll('.file-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectAllCheckboxState();
        });
    });
    
    console.log(`目录文件预览已更新，显示 ${files.length} 个文件`);
    
    // 更新全选复选框状态
    function updateSelectAllCheckboxState() {
        if (!selectAllFiles) return;
        
        const checkboxes = tbody.querySelectorAll('.file-checkbox');
        const checkedCount = tbody.querySelectorAll('.file-checkbox:checked').length;
        
        if (checkedCount === 0) {
            selectAllFiles.checked = false;
            selectAllFiles.indeterminate = false;
        } else if (checkedCount === checkboxes.length) {
            selectAllFiles.checked = true;
            selectAllFiles.indeterminate = false;
        } else {
            selectAllFiles.checked = false;
            selectAllFiles.indeterminate = true;
        }
    }
}
