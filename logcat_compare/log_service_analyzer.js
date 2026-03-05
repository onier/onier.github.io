/**
 * LogServiceAnalyzer - 服务耗时分析工具（简化版）
 * 专门用于提取类似 "Zygote32Timing(  920): ZygoteInit took to complete: 887ms"
 * 的日志 不使用正则表达式，只解析服务名和时间
 */
var ServiceLogTimes = {};
// 对比分析功能
function compareServices() {
  showServiceComparisonDialog();
}

// 显示服务对比对话框
function showServiceComparisonDialog() {
  // 创建对话框容器
  let dialog = document.getElementById('service-comparison-dialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'service-comparison-dialog';
    dialog.className = 'modal-dialog';
    dialog.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>服务耗时对比</h3>
          <button class="close-btn" onclick="closeServiceComparisonDialog()">×</button>
        </div>
        <div class="modal-body">
          <!-- 文件选择区域 -->
          <div class="file-selection-area mb-4">
            <h5>选择多个文件进行对比</h5>
            <div class="row g-3">
              <div class="col-md-12">
                <label for="fileMultiSelect" class="form-label">选择对比文件（可多选）</label>
                <select class="form-select" id="fileMultiSelect" multiple size="5">
                  <!-- 文件选项将动态填充 -->
                </select>
                <div class="form-text">按住Ctrl键（Windows/Linux）或Command键（Mac）可多选文件</div>
              </div>
            </div>
            <div class="mt-3">
              <button class="btn btn-primary" id="compareBtn">对比</button>
              <button class="btn btn-outline-secondary ms-2" id="refreshBtn">刷新文件列表</button>
              <button class="btn btn-outline-danger ms-2" id="clearSelectionBtn">清空选择</button>
            </div>
            <div class="mt-2">
              <small class="text-muted">已选择文件：<span id="selectedFilesCount">0</span>个</small>
            </div>
          </div>
          
          <!-- 统计信息区域 -->
          <div class="stats-area mb-3 d-none" id="statsArea">
            <div class="card">
              <div class="card-body py-2">
                <div class="row text-center">
                  <div class="col-md-3">
                    <small class="text-muted">服务总数</small>
                    <div class="h5 mb-0" id="totalServices">0</div>
                  </div>
                  <div class="col-md-3">
                    <small class="text-muted">对比文件数</small>
                    <div class="h5 mb-0" id="totalFiles">0</div>
                  </div>
                  <div class="col-md-3">
                    <small class="text-muted">最大耗时</small>
                    <div class="h5 mb-0" id="maxTime">0ms</div>
                  </div>
                  <div class="col-md-3">
                    <small class="text-muted">最小耗时</small>
                    <div class="h5 mb-0" id="minTime">0ms</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 对比表格容器 -->
          <div class="table-container">
            <table id="serviceComparisonTable" class="table table-striped table-hover w-100">
              <thead>
                <tr>
                  <th>服务名称</th>
                  <!-- 文件列将动态生成 -->
                </tr>
              </thead>
              <tbody>
                <!-- DataTables将动态填充 -->
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-success" id="exportDataBtn">导出CSV</button>
          <button class="btn btn-secondary" onclick="closeServiceComparisonDialog()">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    
    // 添加CSS样式
    addComparisonDialogStyles();
    
    // 初始化事件监听
    initComparisonDialogEvents();
  }
  
  // 更新文件选择器
  updateFileSelectors();
  
  // 显示对话框
  dialog.style.display = 'block';
}

// 关闭服务对比对话框
function closeServiceComparisonDialog() {
  const dialog = document.getElementById('service-comparison-dialog');
  if (dialog) {
    dialog.style.display = 'none';
  }
}

// 添加对话框CSS样式
function addComparisonDialogStyles() {
  const styleId = 'service-comparison-styles';
  if (document.getElementById(styleId)) {
    return; // 样式已添加
  }
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .modal-dialog {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      overflow: auto;
    }
    
    .modal-content {
      background-color: #fff;
      margin: 50px auto;
      padding: 20px;
      border: 1px solid #888;
      width: 90%;
      max-width: 1200px;
      max-height: 80vh;
      overflow: auto;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    .modal-header h3 {
      margin: 0;
      color: #333;
    }
    
    .close-btn {
      background: #f44336;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .close-btn:hover {
      background: #d32f2f;
    }
    
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-top: 1px solid #ddd;
      padding-top: 15px;
      margin-top: 20px;
    }
    
    .export-btn {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .export-btn:hover {
      background: #45a049;
    }
    
    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    
    .comparison-table th {
      background-color: #f2f2f2;
      padding: 12px 8px;
      text-align: left;
      border-bottom: 2px solid #ddd;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .comparison-table td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
    }
    
    .comparison-table tr:hover {
      background-color: #f5f5f5;
    }
    
    .service-name {
      font-weight: bold;
      color: #333;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .duration-cell {
      text-align: right;
      font-family: monospace;
    }
    
    .diff-positive {
      color: #d32f2f;
      font-weight: bold;
    }
    
    .diff-negative {
      color: #388e3c;
      font-weight: bold;
    }
    
    .no-data {
      color: #999;
      font-style: italic;
    }
    
    .file-header {
      background-color: #e8f5e8 !important;
      text-align: center;
      font-weight: bold;
    }
    
    /* 新增样式用于DataTables */
    .file-selection-area {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }
    
    .file-selection-area h5 {
      margin-bottom: 15px;
      color: #495057;
    }
    
    .stats-area .card {
      border: 1px solid #dee2e6;
      border-radius: 8px;
    }
    
    .stats-area .card-body {
      padding: 10px 15px;
    }
    
    .stats-area small {
      font-size: 0.8rem;
    }
    
    .stats-area .h5 {
      margin-bottom: 0;
    }
    
    .table-container {
      margin-top: 20px;
    }
    
    #serviceComparisonTable {
      font-size: 0.9rem;
    }
    
    #serviceComparisonTable th {
      background-color: #f8f9fa;
      font-weight: 600;
      white-space: nowrap;
    }
    
    #serviceComparisonTable td {
      vertical-align: middle;
    }
    
    /* DataTables 自定义样式 */
    .dataTables_wrapper .dataTables_length,
    .dataTables_wrapper .dataTables_filter,
    .dataTables_wrapper .dataTables_info,
    .dataTables_wrapper .dataTables_paginate {
      padding: 10px 0;
    }
    
    .dataTables_wrapper .dataTables_filter input {
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 5px 10px;
    }
    
    .dataTables_wrapper .dataTables_paginate .paginate_button {
      padding: 5px 10px;
      margin: 0 2px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background-color: #fff;
    }
    
    .dataTables_wrapper .dataTables_paginate .paginate_button.current {
      background-color: #0d6efd;
      color: white !important;
      border-color: #0d6efd;
    }
    
    .dataTables_wrapper .dataTables_paginate .paginate_button:hover {
      background-color: #e9ecef;
      border-color: #dee2e6;
    }
  `;
  document.head.appendChild(style);
}

// 渲染对比表格
function renderComparisonTable() {
  const container = document.getElementById('comparison-table-container');
  if (!container) return;
  
  // 获取所有文件的服务数据
  const fileNames = Object.keys(ServiceLogTimes);
  if (fileNames.length === 0) {
    container.innerHTML = '<p>没有可对比的数据</p>';
    return;
  }
  
  // 收集所有服务名（去重）
  const allServiceNames = new Set();
  fileNames.forEach(fileName => {
    const services = ServiceLogTimes[fileName];
    services.forEach(service => {
      allServiceNames.add(service.serviceName);
    });
  });
  
  // 将服务名转换为数组并排序
  const serviceNames = Array.from(allServiceNames).sort();
  
  // 创建表格HTML
  let html = '<table class="comparison-table">';
  
  // 表头：服务名 + 各文件列 + 差异列
  html += '<thead><tr>';
  html += '<th>服务名称</th>';
  
  // 添加文件列
  fileNames.forEach(fileName => {
    html += `<th colspan="2" class="file-header">${fileName}</th>`;
  });
  
  // 添加差异列（最后一个文件与第一个文件的差异）
  if (fileNames.length >= 2) {
    html += '<th colspan="2">差异对比</th>';
  }
  
  html += '</tr><tr>';
  html += '<th></th>'; // 服务名列的空白子标题
  
  // 添加每个文件的子标题（耗时和百分比）
  fileNames.forEach(() => {
    html += '<th>耗时(ms)</th><th>占比(%)</th>';
  });
  
  // 添加差异列的子标题
  if (fileNames.length >= 2) {
    html += '<th>绝对差异(ms)</th><th>相对差异(%)</th>';
  }
  
  html += '</tr></thead>';
  
  // 表格主体
  html += '<tbody>';
  
  // 计算每个文件的总耗时
  const fileTotals = {};
  fileNames.forEach(fileName => {
    const services = ServiceLogTimes[fileName];
    const total = services.reduce((sum, service) => sum + service.duration, 0);
    fileTotals[fileName] = total;
  });
  
  // 为每个服务添加行
  serviceNames.forEach(serviceName => {
    html += '<tr>';
    html += `<td class="service-name" title="${serviceName}">${serviceName}</td>`;
    
    const serviceData = {};
    
    // 添加每个文件的数据
    fileNames.forEach(fileName => {
      const services = ServiceLogTimes[fileName];
      const service = services.find(s => s.serviceName === serviceName);
      const total = fileTotals[fileName];
      
      if (service) {
        const duration = service.duration;
        const percentage = total > 0 ? ((duration / total) * 100).toFixed(2) : '0.00';
        
        html += `<td class="duration-cell">${duration}</td>`;
        html += `<td class="duration-cell">${percentage}%</td>`;
        
        serviceData[fileName] = {
          duration: duration,
          percentage: parseFloat(percentage)
        };
      } else {
        html += '<td class="duration-cell no-data">-</td>';
        html += '<td class="duration-cell no-data">-</td>';
        
        serviceData[fileName] = null;
      }
    });
    
    // 添加差异列（比较第一个和最后一个文件）
    if (fileNames.length >= 2) {
      const firstFile = fileNames[0];
      const lastFile = fileNames[fileNames.length - 1];
      const firstData = serviceData[firstFile];
      const lastData = serviceData[lastFile];
      
      if (firstData && lastData) {
        const absDiff = lastData.duration - firstData.duration;
        const relDiff = firstData.duration > 0 ? 
          ((absDiff / firstData.duration) * 100).toFixed(2) : '0.00';
        
        const absDiffClass = absDiff > 0 ? 'diff-positive' : absDiff < 0 ? 'diff-negative' : '';
        const relDiffClass = parseFloat(relDiff) > 0 ? 'diff-positive' : parseFloat(relDiff) < 0 ? 'diff-negative' : '';
        
        html += `<td class="duration-cell ${absDiffClass}">${absDiff > 0 ? '+' : ''}${absDiff}</td>`;
        html += `<td class="duration-cell ${relDiffClass}">${relDiff > 0 ? '+' : ''}${relDiff}%</td>`;
      } else {
        html += '<td class="duration-cell no-data">-</td>';
        html += '<td class="duration-cell no-data">-</td>';
      }
    }
    
    html += '</tr>';
  });
  
  // 添加总计行
  html += '<tr style="background-color: #f9f9f9; font-weight: bold;">';
  html += '<td>总计</td>';
  
  fileNames.forEach(fileName => {
    const total = fileTotals[fileName];
    html += `<td class="duration-cell">${total}</td>`;
    html += '<td class="duration-cell">100.00%</td>';
  });
  
  if (fileNames.length >= 2) {
    const firstTotal = fileTotals[fileNames[0]];
    const lastTotal = fileTotals[fileNames[fileNames.length - 1]];
    const totalAbsDiff = lastTotal - firstTotal;
    const totalRelDiff = firstTotal > 0 ? ((totalAbsDiff / firstTotal) * 100).toFixed(2) : '0.00';
    
    const totalAbsDiffClass = totalAbsDiff > 0 ? 'diff-positive' : totalAbsDiff < 0 ? 'diff-negative' : '';
    const totalRelDiffClass = parseFloat(totalRelDiff) > 0 ? 'diff-positive' : parseFloat(totalRelDiff) < 0 ? 'diff-negative' : '';
    
    html += `<td class="duration-cell ${totalAbsDiffClass}">${totalAbsDiff > 0 ? '+' : ''}${totalAbsDiff}</td>`;
    html += `<td class="duration-cell ${totalRelDiffClass}">${totalRelDiff > 0 ? '+' : ''}${totalRelDiff}%</td>`;
  }
  
  html += '</tr>';
  
  html += '</tbody></table>';
  
  container.innerHTML = html;
}

// 注意：旧的 exportComparisonData 函数已被新的两个文件对比版本取代
// 新的 exportComparisonData 函数在文件末尾定义
const LogServiceAnalyzer = {

  parseTime: function(tail) {
    let lastIndex = tail.lastIndexOf('ms');
    if (lastIndex === -1) {
      let n = parseInt(tail);
      if (!Number.isNaN(n)) {
        return n;
      } else {
        return 0;
      }
    } else {
      tail = tail.substring(0, lastIndex);
      let n = parseInt(tail);
      if (!Number.isNaN(n)) {
        return n;
      } else {
        return 0;
      }
    }
  },

  /**
   * 解析单行日志，提取服务名和耗时
   * @param {string} line - 日志行
   * @returns {object|null} 返回 {serviceName: string, duration: number} 或 null
   */
  parseLine: function(line) {
    // 1. 快速检查是否包含关键词
    if (!line.includes('took to complete:')) {
      return null;
    }

    // 2. 找到关键词位置
    const keywordIndex = line.indexOf('took to complete:');
    if (keywordIndex === -1) {
      return null;
    }

    let header = line.substring(0, keywordIndex);
    let tail = line.substring(keywordIndex + 17);
    let duration = this.parseTime(tail.trim());
    if (duration > 0) {
      if (line.includes('SystemServerTiming') ||
          line.includes('ActivityManagerTiming') ||
          line.includes('Zygote32Timing') ||
          line.includes('PackageManagerTiming') ||
          line.includes('Zygote64Timing') || line.includes('SystemConfig') ||
          line.includes('WallpaperManagerService') ||
          line.includes('ZygoteInitTiming_lazy') ||
          line.includes('StagingManagerTiming')) {
        let startIndex = header.lastIndexOf(':');
        let serviceName = header.substring(startIndex + 1);
        return {serviceName: serviceName.trim(), duration: duration};
      } else if (line.includes('SystemUIBootTiming')) {
        if(line.includes('DependencyInjection')){
           return {serviceName: 'DependencyInjection', duration: duration};
        }
        let startIndex = header.lastIndexOf('StartServices');
        let serviceName = header.substring(startIndex + 14);
        return {serviceName: serviceName.trim(), duration: duration};
      } else {
        console.log('header:', header);
        console.log('tail:', tail);
        return null;
      }
    } else {
      return null;
    }
  },

  /**
   * 判断字符是否为数字
   * @param {string} char - 单个字符
   * @returns {boolean}
   */
  isDigit: function(char) {
    return char >= '0' && char <= '9';
  },

  /**
   * 批量解析日志行
   * @param {Array<string>} lines - 日志行数组
   * @returns {Array<object>} 解析结果数组
   */
  parseLines: function(lines) {
    const results = [];
    for (const line of lines) {
      const result = this.parseLine(line);
      if (result) {
        results.push(result);
      }
    }
    return results;
  },

  /**
   * 从文本中解析所有服务耗时
   * @param {string} text - 日志文本
   * @returns {Array<object>} 解析结果数组
   */
  parseText: function(text) {
    const lines = text.split('\n');
    return this.parseLines(lines);
  },

  /**
   * 执行分析（参照log_analyzer.js的run函数结构）
   * @param {object} model - Monaco Editor 模型
   * @returns {object} 分析结果
   */
  run: function(model) {
    if (!model) return;

    const lineCount = model.getLineCount();
    const services = [];

    // 遍历每一行
    for (let i = 1; i <= lineCount; i++) {
      const lineContent = model.getLineContent(i);
      const result = this.parseLine(lineContent);

      if (result) {
        services.push(result);
      }
    }
    ServiceLogTimes[model.file_name] = services;
    return services;
  },
};

// 初始化对话框事件监听
function initComparisonDialogEvents() {
  // 对比按钮点击事件
  document.getElementById('compareBtn').addEventListener('click', function() {
    const fileSelect = document.getElementById('fileMultiSelect');
    const selectedFiles = Array.from(fileSelect.selectedOptions).map(option => option.value);
    
    if (selectedFiles.length < 2) {
      alert('请至少选择两个文件进行对比');
      return;
    }
    
    // 检查是否有重复选择
    const uniqueFiles = [...new Set(selectedFiles)];
    if (uniqueFiles.length !== selectedFiles.length) {
      alert('请选择不同的文件进行对比');
      return;
    }
    
    renderDataTablesComparison(selectedFiles);
  });
  
  // 刷新按钮点击事件
  document.getElementById('refreshBtn').addEventListener('click', function() {
    updateFileSelectors();
  });
  
  // 清空选择按钮点击事件
  document.getElementById('clearSelectionBtn').addEventListener('click', function() {
    const fileSelect = document.getElementById('fileMultiSelect');
    Array.from(fileSelect.options).forEach(option => {
      option.selected = false;
    });
    updateSelectedFilesCount();
  });
  
  // 导出按钮点击事件
  document.getElementById('exportDataBtn').addEventListener('click', function() {
    exportComparisonData();
  });
  
  // 文件选择变化事件
  document.getElementById('fileMultiSelect').addEventListener('change', function() {
    updateSelectedFilesCount();
  });
}

// 更新已选择文件数量
function updateSelectedFilesCount() {
  const fileSelect = document.getElementById('fileMultiSelect');
  const selectedCount = Array.from(fileSelect.selectedOptions).length;
  document.getElementById('selectedFilesCount').textContent = selectedCount;
}

// 更新文件选择器
function updateFileSelectors() {
  const fileSelect = document.getElementById('fileMultiSelect');
  
  if (!fileSelect) return;
  
  // 获取所有可用文件
  const fileNames = Object.keys(ServiceLogTimes);
  
  // 保存当前选中的值
  const selectedOptions = Array.from(fileSelect.selectedOptions).map(option => option.value);
  
  // 清空选项
  fileSelect.innerHTML = '';
  
  // 添加文件选项
  fileNames.forEach(fileName => {
    const option = document.createElement('option');
    option.value = fileName;
    option.textContent = fileName;
    
    // 如果之前被选中，保持选中状态
    if (selectedOptions.includes(fileName)) {
      option.selected = true;
    }
    
    fileSelect.appendChild(option);
  });
  
  // 更新已选择文件数量
  updateSelectedFilesCount();
}

// 使用DataTables渲染多文件对比表格
function renderDataTablesComparison(selectedFiles) {
  const table = $('#serviceComparisonTable');
  
  // 如果DataTable已经存在，销毁它
  if ($.fn.DataTable.isDataTable('#serviceComparisonTable')) {
    table.DataTable().destroy();
    table.empty();
  }
  
  // 动态构建表头
  let theadHtml = '<thead><tr><th>服务名称</th>';
  
  // 为每个文件添加列
  selectedFiles.forEach(fileName => {
    theadHtml += `<th>${fileName}耗时(ms)</th>`;
  });
  
  // 添加差异列（与第一个文件的差异）
  if (selectedFiles.length > 1) {
    for (let i = 1; i < selectedFiles.length; i++) {
      theadHtml += `<th>${selectedFiles[i]} vs ${selectedFiles[0]}差异(ms)</th>`;
      theadHtml += `<th>${selectedFiles[i]} vs ${selectedFiles[0]}差异(%)</th>`;
    }
  }
  
  theadHtml += '</tr></thead><tbody></tbody>';
  table.html(theadHtml);
  
  // 创建服务名到耗时的映射数组
  const serviceMaps = selectedFiles.map(fileName => {
    const services = ServiceLogTimes[fileName] || [];
    const serviceMap = new Map();
    services.forEach(service => {
      serviceMap.set(service.serviceName, service.duration);
    });
    return serviceMap;
  });
  
  // 收集所有服务名（去重）
  const allServiceNames = new Set();
  serviceMaps.forEach(serviceMap => {
    Array.from(serviceMap.keys()).forEach(serviceName => {
      allServiceNames.add(serviceName);
    });
  });
  
  const serviceNames = Array.from(allServiceNames).sort();
  
  // 准备表格数据
  const tableData = [];
  const fileTotals = selectedFiles.map(() => 0);
  let maxTime = 0;
  let minTime = Infinity;
  
  serviceNames.forEach(serviceName => {
    const rowData = [serviceName];
    
    // 添加每个文件的耗时
    selectedFiles.forEach((fileName, index) => {
      const duration = serviceMaps[index].get(serviceName);
      if (duration !== undefined) {
        rowData.push(duration + 'ms');
        fileTotals[index] += duration;
        
        // 更新最大最小耗时
        if (duration > maxTime) maxTime = duration;
        if (duration < minTime) minTime = duration;
      } else {
        rowData.push('-');
      }
    });
    
    // 添加差异列（与第一个文件的比较）
    if (selectedFiles.length > 1) {
      const baseDuration = serviceMaps[0].get(serviceName);
      
      for (let i = 1; i < selectedFiles.length; i++) {
        const compareDuration = serviceMaps[i].get(serviceName);
        
        if (baseDuration !== undefined && compareDuration !== undefined) {
          const diff = compareDuration - baseDuration;
          const diffPercent = baseDuration > 0 ? ((diff / baseDuration) * 100).toFixed(2) : (diff > 0 ? '∞' : '-∞');
          
          const diffClass = diff > 0 ? 'diff-positive' : diff < 0 ? 'diff-negative' : '';
          const diffPercentClass = diff > 0 ? 'diff-positive' : diff < 0 ? 'diff-negative' : '';
          
          rowData.push(`<span class="${diffClass}">${diff > 0 ? '+' : ''}${diff}ms</span>`);
          rowData.push(`<span class="${diffPercentClass}">${diff > 0 ? '+' : ''}${diffPercent}%</span>`);
        } else {
          rowData.push('N/A');
          rowData.push('N/A');
        }
      }
    }
    
    tableData.push(rowData);
  });
  
  // 更新统计信息
  updateMultiFileStats(serviceNames.length, selectedFiles.length, maxTime, minTime, fileTotals);
  
  // 准备DataTables列配置
  const columns = [
    { 
      title: '服务名称',
      type: 'string'
    }
  ];
  
  // 添加文件列配置
  selectedFiles.forEach((fileName, index) => {
    columns.push({
      title: `${fileName}耗时(ms)`,
      type: 'num',
      render: function(data, type, row, meta) {
        if (type === 'sort' || type === 'type') {
          const serviceName = row[0];
          const duration = serviceMaps[index].get(serviceName);
          return duration !== undefined ? duration : -1;
        }
        return data;
      }
    });
  });
  
  // 添加差异列配置
  if (selectedFiles.length > 1) {
    for (let i = 1; i < selectedFiles.length; i++) {
      columns.push({
        title: `${selectedFiles[i]} vs ${selectedFiles[0]}差异(ms)`,
        type: 'num',
        render: function(data, type, row, meta) {
          if (type === 'sort' || type === 'type') {
            const serviceName = row[0];
            const baseDuration = serviceMaps[0].get(serviceName);
            const compareDuration = serviceMaps[i].get(serviceName);
            
            if (baseDuration !== undefined && compareDuration !== undefined) {
              return compareDuration - baseDuration;
            }
            return 0;
          }
          return data;
        }
      });
      
      columns.push({
        title: `${selectedFiles[i]} vs ${selectedFiles[0]}差异(%)`,
        type: 'num',
        render: function(data, type, row, meta) {
          if (type === 'sort' || type === 'type') {
            const serviceName = row[0];
            const baseDuration = serviceMaps[0].get(serviceName);
            const compareDuration = serviceMaps[i].get(serviceName);
            
            if (baseDuration !== undefined && compareDuration !== undefined && baseDuration > 0) {
              return ((compareDuration - baseDuration) / baseDuration) * 100;
            }
            return 0;
          }
          return data;
        }
      });
    }
  }
  
  // 初始化DataTable
  const dataTable = table.DataTable({
    data: tableData,
    columns: columns,
    language: {
      emptyTable: "没有数据可显示",
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
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100],
    order: [[0, 'asc']], // 默认按服务名升序排序
    dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
         '<"row"<"col-sm-12"tr>>' +
         '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
    createdRow: function(row, data, dataIndex) {
      // 可以在这里为行添加额外的样式
    }
  });
  
  // 显示统计区域
  document.getElementById('statsArea').classList.remove('d-none');
}

// 更新多文件统计信息
function updateMultiFileStats(totalServices, totalFiles, maxTime, minTime, fileTotals) {
  document.getElementById('totalServices').textContent = totalServices;
  document.getElementById('totalFiles').textContent = totalFiles;
  document.getElementById('maxTime').textContent = maxTime + 'ms';
  document.getElementById('minTime').textContent = (minTime === Infinity ? 0 : minTime) + 'ms';
}

// 导出多文件对比数据
function exportComparisonData() {
  const fileSelect = document.getElementById('fileMultiSelect');
  const selectedFiles = Array.from(fileSelect.selectedOptions).map(option => option.value);
  
  if (selectedFiles.length < 2) {
    alert('请至少选择两个文件进行对比');
    return;
  }
  
  // 创建服务名到耗时的映射数组
  const serviceMaps = selectedFiles.map(fileName => {
    const services = ServiceLogTimes[fileName] || [];
    const serviceMap = new Map();
    services.forEach(service => {
      serviceMap.set(service.serviceName, service.duration);
    });
    return serviceMap;
  });
  
  // 收集所有服务名（去重）
  const allServiceNames = new Set();
  serviceMaps.forEach(serviceMap => {
    Array.from(serviceMap.keys()).forEach(serviceName => {
      allServiceNames.add(serviceName);
    });
  });
  
  const serviceNames = Array.from(allServiceNames).sort();
  
  // 创建CSV内容 - 添加UTF-8 BOM解决中文乱码问题
  const BOM = '\uFEFF'; // UTF-8 BOM
  let csv = BOM + '服务名称';
  
  // 添加文件列标题
  selectedFiles.forEach(fileName => {
    csv += `,${fileName}耗时(ms)`;
  });
  
  // 添加差异列标题
  if (selectedFiles.length > 1) {
    for (let i = 1; i < selectedFiles.length; i++) {
      csv += `,${selectedFiles[i]} vs ${selectedFiles[0]}差异(ms)`;
      csv += `,${selectedFiles[i]} vs ${selectedFiles[0]}差异(%)`;
    }
  }
  
  csv += '\n';
  
  // 添加数据行
  serviceNames.forEach(serviceName => {
    // 转义服务名称
    const escapedServiceName = serviceName.replace(/"/g, '""');
    csv += `"${escapedServiceName}"`;
    
    // 添加每个文件的耗时
    selectedFiles.forEach((fileName, index) => {
      const duration = serviceMaps[index].get(serviceName);
      csv += `,${duration !== undefined ? duration : ''}`;
    });
    
    // 添加差异列
    if (selectedFiles.length > 1) {
      const baseDuration = serviceMaps[0].get(serviceName);
      
      for (let i = 1; i < selectedFiles.length; i++) {
        const compareDuration = serviceMaps[i].get(serviceName);
        
        if (baseDuration !== undefined && compareDuration !== undefined) {
          const diff = compareDuration - baseDuration;
          const diffPercent = baseDuration > 0 ? ((diff / baseDuration) * 100).toFixed(2) : (diff > 0 ? 'Infinity' : '-Infinity');
          csv += `,${diff},${diffPercent}`;
        } else {
          csv += ',,'; // 空值
        }
      }
    }
    
    csv += '\n';
  });
  
  // 创建下载链接 - 使用正确的MIME类型和编码
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // 生成文件名
  const fileName = selectedFiles.length === 2 
    ? `服务对比_${selectedFiles[0]}_vs_${selectedFiles[1]}`
    : `服务对比_${selectedFiles.length}个文件`;
  
  link.href = url;
  link.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  alert(`数据已导出为CSV文件，包含${selectedFiles.length}个文件的对比数据，使用UTF-8编码`);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LogServiceAnalyzer;
}
