class FileUtils {
  constructor() {
    this.files = null;
    // REsultlog.txt 解析结果
    this.resultDatas = [];
    this.allResultDatas = [];
    // doslog.txt 解析结果
    this.dosLogDatas = [];
    this.logcats = [];
    this.dosLogData = [];
    this.logcatReaderFileCnt = 0;
    this.logcatReaderFileTotalCnt = 0;
    // PortLog.txt 解析结果
    this.portLogData = [];  // 存储解析后的串口log数据
    this.portLogAnalysis = {};  // 存储分析结果（时间间隔、异常重启等）
  }
  getDosLogs(logcatFile) {
    for (let i = 0; i < this.dosLogDatas.length; i++) {
      if (this.dosLogDatas[i].fileName == logcatFile) {
        return this.dosLogDatas[i].segs;
      }
    }
    return null;
  }

  findResultLogCatFile() {
    this.logcatReaderFileCnt = 1;
    this.resultDatas.forEach(resultData => {
      resultData['logcatFile'] = '';
      for (let i = 0; i < this.files.length; i++) {
        let file = this.files[i];
        if (file.name == resultData.fileName) {
          resultData['logcatFile'] = file.name;
          file.text().then(text => {
            window.logcatManager.addLogcatEntry(file.name, text, file.size);
          });
          break;
        }
      }
      if (resultData['logcatFile'] == '') {
        for (let i = 0; i < this.files.length; i++) {
          let file = this.files[i];
          if (file.name.startsWith('logcat' + resultData['Runtimes'] + '_') &&
              file.name.endsWith('.txt')) {
            resultData['logcatFile'] = file.name;
            file.text().then(text => {
              window.logcatManager.addLogcatEntry(file.name, text, file.size);
            });
            break;
          }
        }
      }
    });
    this.allResultDatas.forEach(resultData => {
      for (let i = 0; i < this.files.length; i++) {
        let file = this.files[i];
        if (file.name.startsWith('logcat' + resultData['Runtimes'] + '_') &&
            file.name.endsWith('.txt')) {
          resultData['logcatFile'] = file.name;
          // file.text().then(text => {
          //     window.logcatManager.addLogcatEntry(file.name, text,
          //     file.size);
          // });
          break;
        }
      }
    });
  }

  // timestamp: timestamp.trim(),           // e.g. "2025-10-30 16:06:04,106"
  // thread: thread.trim(),                 // e.g. "Thread-23-10992" 或
  // "Dummy-3-10260" preciseTime: preciseTime.trim(),       // e.g. "2025-10-30
  // 16:06:04.106616" message: message.trim(),               // e.g. "adb
  // wait-for-device" 或 "检查开机中..."
  showDosFileAnalysisTable() {
    // 调用 DOS 文件分析管理器来更新表格
    if (window.dosFileAnalysisManager) {
      window.dosFileAnalysisManager.updateTable(this.resultDatas);
    } else {
      console.error('DOS 文件分析管理器未初始化，尝试初始化...');
      // 尝试初始化
      if (typeof initDosFileAnalysisManager === 'function') {
        initDosFileAnalysisManager();
        if (window.dosFileAnalysisManager) {
          window.dosFileAnalysisManager.updateTable(this.resultDatas);
        }
      }
    }
  }

  // 显示ADB时间分析表格
  showAdbTimeAnalysisTable() {
    // 调用 ADB 时间分析管理器来更新表格
    if (window.adbTimeAnalysisManager) {
      window.adbTimeAnalysisManager.updateTable(this.dosLogDatas);
    } else {
      console.error('ADB 时间分析管理器未初始化，尝试初始化...');
      // 尝试初始化
      if (typeof initAdbTimeAnalysisManager === 'function') {
        initAdbTimeAnalysisManager();
        if (window.adbTimeAnalysisManager) {
          window.adbTimeAnalysisManager.updateTable(this.dosLogDatas);
        }
      }
    }
  }

  /**
   * 读取指定文件的内容
   * @param {File[]} files - 文件数组
   * @param {string} filename - 要读取的文件名
   * @returns {Promise<string|null>} 文件内容或null（如果文件不存在）
   */
  async readFileContent(filename) {
    const file = this.files.find(f => f.name === filename);
    if (!file) {
      console.warn(`文件 "${filename}" 不存在`);
      return null;
    }

    try {
      const content = await file.text();
      console.log(`成功读取文件 "${filename}"，大小: ${content.length} 字符`);
      return content;
    } catch (error) {
      console.error(`读取文件 "${filename}" 时出错:`, error);
      return null;
    }
  }

  /**
   * 读取指定文件的内容（同步版本，返回Promise）
   * @param {File[]} files - 文件数组
   * @param {string} filename - 要读取的文件名
   * @returns {Promise<string|null>} 文件内容或null（如果文件不存在）
   */
  read_file(files, filename) {
    return this.readFileContent(files, filename);
  }

  parseAndroidLogs(logText) {
    // 正则解释：
    // (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})   -> 日期时间+毫秒
    // \s*-\s* \s*                                   -> 分隔符 -
    // ([^-]+?)                                      -> 线程名（懒惰匹配到下一个
    // - 之前） \s*-\s*\[([^\]]+)\]\s*                         -> [精确时间]
    // 部分
    // (.*)                                          -> 剩余内容（日志消息）
    const regex =
        /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*-\s*([^-]+?)\s*-\s*\[([^\]]+)\]\s*(.*)$/gm;

    const results = [];
    let match;

    while ((match = regex.exec(logText)) !== null) {
      const [_, timestamp, thread, preciseTime, message] = match;

      results.push({
        timestamp: timestamp.trim(),  // e.g. "2025-10-30 16:06:04,106"
        thread: thread.trim(),  // e.g. "Thread-23-10992" 或 "Dummy-3-10260"
        preciseTime: preciseTime.trim(),  // e.g. "2025-10-30 16:06:04.106616"
        message:
            message.trim(),  // e.g. "adb  wait-for-device" 或 "检查开机中..."
      });
    }
    return results;
  }

  startsWithLogTimestamp(str) {
    // 匹配 [YYYY-MM-DD HH:MM:SS.ffffff] 这样的开头
    // \d{4}-\d{2}-\d{2}：年-月-日
    // \s：单个空格
    // \d{2}:\d{2}:\d{2}\.\d{1,6}：时:分:秒.微秒（微秒支持 1~6 位）
    const regex = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{1,6}\]/;
    return regex.test(str);
  }

  split_line(line) {
    let ltems = line.split('\t');
    let result = [];
    for (let i = 0; i < ltems.length; i++) {
      if (ltems[i].trim().length > 0) {
        result.push(ltems[i].trim());
      }
    }
    return result;
  }

  find_doslog_segs(doslogLines, prefix) {
    let results = [];
    let matchLine = -1, startIndex = -1, endIndex = -1;
    for (let i = 0; i < doslogLines.length; i++) {
      if (doslogLines[i].includes(prefix)) {
        matchLine = i;
        break;
      }
    }
    if (matchLine == -1) {
      console.log('doslog file not found Runtimes' + Runtimes);
    }
    for (let i = matchLine; i > 0; i--) {
      if (doslogLines[i].includes('Module is booting up in pwk')) {
        startIndex = i;
        break;
      }
    }
    if (startIndex == -1) {
      for (let i = matchLine; i > 0; i--) {
        if (doslogLines[i].includes('Module start restart') ||
            doslogLines[i].includes('Initializing boot...')) {
          startIndex = i;
          break;
        }
      }
    }
    for (let i = matchLine; i < doslogLines.length; i++) {
      if (doslogLines[i].includes('Shut down normally')) {
        endIndex = i;
        break;
      }
    }
    if (endIndex == -1) {
      for (let i = matchLine; i < doslogLines.length; i++) {
        if (doslogLines[i].includes('Executing reboot restart')) {
          endIndex = i;
          break;
        }
      }
    }
    let logFileName = '';
    for (let i = startIndex; i <= endIndex; i++) {
      if (doslogLines[i].trim().length > 0) {
        let rawLine = doslogLines[i].trim();
        let n = rawLine.lastIndexOf('logcat');
        if (n != -1) {
          let str = rawLine.substring(n);
          if (str.endsWith('.txt') && str.includes('_')) {
            logFileName = str;
          }
        }
        results.push(rawLine);
      }
    }
    if (results.length == 0) {
      console.log('没有找到任何数据 ' + prefix);
    }
    return {results, logFileName};
  }

  async parse_doslog_file() {
    this.dosLogDatas = [];
    for (let i = 0; i < this.files.length; i++) {
      if (this.files[i].name == 'doslog.txt') {
        try {
          const text = await this.files[i].text();
          let lines = text.split('\n');
          for (let n = 0; n < this.resultDatas.length; n++) {
            let {results, logFileName} = this.find_doslog_segs(
                lines, this.resultDatas[n].LocalTime.substr(1, 19));
            if (logFileName.length > 0) {
              this.resultDatas[n].fileName = logFileName;
              this.dosLogDatas.push({
                segs: results,
                LocalTime: this.resultDatas[n].LocalTime,
                Runtimes: this.resultDatas[n].Runtimes,
                PowerOnTime: this.resultDatas[n].PowerOnTime,
                fileName: logFileName
              });
            } else {
              this.dosLogDatas.push({
                segs: results,
                LocalTime: this.resultDatas[n].LocalTime,
                Runtimes: this.resultDatas[n].Runtimes,
                PowerOnTime: this.resultDatas[n].PowerOnTime,
                fileName: this.resultDatas[n].logcatFile
              });
            }
          }

          // 解析完成后刷新ADB时间分析表格
          this.showAdbTimeAnalysisTable();
          return this.dosLogDatas;
        } catch (error) {
          console.error('读取 doslog.txt 文件失败:', error);
          return [];
        }
      }
    }
    console.warn('未找到 doslog.txt 文件');
    return [];
  }

  //  window.logcatManager
  async parse_result_file(content) {
    let headers = [];
    let result = [];
    let lines = content.split('\n');
    let startLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('LocalTime')) {
        headers = this.split_line(lines[i]);
        startLine = i + 1;
        break
      }
    }
    for (let i = startLine; i < lines.length; i++) {
      let entry = {};
      let items = this.split_line(lines[i]);
      if (items.length == headers.length) {
        items.forEach((item, index) => {
          entry[headers[index]] = item;
        });
        result.push(entry);
      } else {
        break;
      }
    }
    result.sort((a, b) => a.PowerOnTime - b.PowerOnTime);
    this.allResultDatas = result;
    this.resultDatas = [];
    let sampleNumber = document.getElementById('analysisNumberInput').value;
    let half = sampleNumber / 2;
    if (result.length > sampleNumber) {
      for (let i = 0; i < half; i++) {
        this.resultDatas.push(result[i]);
      }
      for (let i = result.length - half; i < result.length; i++) {
        this.resultDatas.push(result[i]);
      }
    } else {
      this.resultDatas = result;
    }
    await this.parse_doslog_file();
    this.logcatReaderFileTotalCnt = this.resultDatas.length;
    this.findResultLogCatFile();
    // 解析完成后显示表格
    this.showDosFileAnalysisTable();

    // 新增：更新温度-开机时间图表
    if (window.temperatureBootTimeChartManager &&
        typeof window.temperatureBootTimeChartManager.updateChart ===
            'function') {
      window.temperatureBootTimeChartManager.updateChart(this.allResultDatas);
    } else {
      console.warn('温度-开机时间图表管理器未初始化或updateChart方法不存在');
    }

    // 新增：更新运行次数-开机时间图表
    if (window.runtimesBootTimeChartManager &&
        typeof window.runtimesBootTimeChartManager.updateChart === 'function') {
      window.runtimesBootTimeChartManager.updateChart(this.allResultDatas);
    } else {
      console.warn('运行次数-开机时间图表管理器未初始化或updateChart方法不存在');
    }

    // 新增：更新异常数据库表
    if (window.anomalyTableManager &&
        typeof window.anomalyTableManager.updateTable === 'function') {
      window.anomalyTableManager.updateTable(this.allResultDatas);
    } else {
      console.warn('异常数据库表管理器未初始化或updateTable方法不存在');
    }

    return result;
  }

  async read_result_file(files) {
    this.files = files;

    try {
      // 查找并解析 ResultLog.txt
      for (let i = 0; i < files.length; i++) {
        if (files[i].name == 'ResultLog.txt') {
          const text = await files[i].text();
          await this.parse_result_file(text);
          break;
        }
      }

      // 新增：查找并解析 PortLog.txt（使用流式处理）
      for (let i = 0; i < files.length; i++) {
        if (files[i].name == 'PortLog.txt') {
          await this.parse_port_log_file_stream(files[i]);
          break;
        }
      }

      return {success: true, message: '文件解析完成'};
    } catch (error) {
      console.error('读取或解析文件时出错:', error);
      return {success: false, message: `错误: ${error.message}`};
    }
  }

  /**
   * 解析 PortLog.txt 文件
   * @param {string} content - 文件内容
   */
  parse_port_log_file(content) {
    try {
      // 使用 BootAnomalyDetector 进行解析
      if (window.BootAnomalyDetector) {
        // 调用启动异常检测管理器显示结果
        if (window.bootAnomalyManager) {
          window.bootAnomalyManager.updateTable(content);
        } else {
          console.warn('启动异常检测管理器未初始化，尝试初始化...');
          // 尝试初始化
          if (typeof initBootAnomalyManager === 'function') {
            initBootAnomalyManager();
            if (window.bootAnomalyManager) {
              window.bootAnomalyManager.updateTable(content);
            }
          }
        }

        console.log('PortLog.txt 解析完成，启动异常检测已执行');
        return content;
      } else {
        console.error(
            'BootAnomalyDetector 未加载，请确保 port_log_analyzer.js 已正确引入');
        return null;
      }
    } catch (error) {
      console.error('解析 PortLog.txt 时发生错误:', error);
      return null;
    }
  }

  /**
   * 流式解析 PortLog.txt 文件（避免大文件内存溢出）
   * @param {File} file - PortLog.txt 文件对象
   * @returns {Promise<boolean>} 解析是否成功
   */
  async parse_port_log_file_stream(file) {
    try {
      // 检查 BootAnomalyDetector 是否可用
      if (!window.BootAnomalyDetector) {
        console.error(
            'BootAnomalyDetector 未加载，请确保 port_log_analyzer.js 已正确引入');
        return false;
      }

      // 检查 BootAnomalyManager 是否可用
      if (!window.bootAnomalyManager) {
        console.warn('启动异常检测管理器未初始化，尝试初始化...');
        if (typeof initBootAnomalyManager === 'function') {
          initBootAnomalyManager();
        } else {
          console.error('无法初始化启动异常检测管理器');
          return false;
        }
      }

      // 获取或创建 BootAnomalyDetector 实例
      let detector = window.bootAnomalyManager.bootAnomalyDetector;
      if (!detector) {
        detector = new window.BootAnomalyDetector();
        window.bootAnomalyManager.bootAnomalyDetector = detector;
      }

      // 初始化流式解析
      detector.startStreamParse();

      // 配置分块大小（4MB）
      const CHUNK_SIZE = 4 * 1024 * 1024; 
      let offset = 0;
      let remainingData = ''; // 存储未完成的行
      let processedLines = 0;

      // 显示进度（如果UI支持）
      const showProgress = (progress, message) => {
        console.log(`PortLog 解析进度: ${progress.toFixed(2)}% - ${message}`);
        // 如果有进度条元素，更新它
        const progressContainer = document.getElementById('portLogProgressContainer');
        const progressElement = document.getElementById('portLogProgress');
        const progressLabel = document.getElementById('portLogProgressLabel');
        
        if (progressElement && progressContainer) {
          // 显示进度条容器
          if (progress > 0 && progress < 100) {
            progressContainer.style.display = 'flex';
          }
          
          // 更新进度条
          progressElement.style.width = `${progress}%`;
          progressElement.setAttribute('aria-valuenow', progress);
          progressElement.textContent = `${progress.toFixed(1)}%`;
          
          // 更新标签
          if (progressLabel) {
            progressLabel.innerHTML = `<i class="bi bi-usb-plug me-1"></i>串口Log解析 ${message ? '- ' + message : ''}`;
          }
        }
      };

      console.log(`开始流式解析 PortLog.txt，文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      showProgress(0, '开始解析');

      // 分块读取文件
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const text = await chunk.text(); // 使用 Blob.text() 方法读取文本

        // 合并之前剩余的数据
        const data = remainingData + text;
        const lines = data.split('\n');

        // 保留最后一行（可能不完整）
        remainingData = lines.pop();

        // 处理完整的行
        if (lines.length > 0) {
          detector.parseChunk(lines);
          processedLines += lines.length;
        }

        // 更新进度
        const progress = Math.min(100, (offset + CHUNK_SIZE) / file.size * 100);
        if (offset % (CHUNK_SIZE * 10) === 0) { // 每40MB输出一次进度
          showProgress(progress, `已处理 ${processedLines} 行`);
        }

        offset += CHUNK_SIZE;
      }

      // 处理最后一行（如果有）
      if (remainingData && remainingData.trim().length > 0) {
        detector.parseChunk([remainingData]);
      }

      // 结束流式解析
      const detectionResults = detector.endStreamParse();
      console.log('PortLog.txt 流式解析完成');
      showProgress(100, `解析完成，共处理 ${processedLines} 行`);

      // 获取表格数据并更新UI
      const tableData = detector.getTableData();
      if (window.bootAnomalyManager && window.bootAnomalyManager.anomalyTable) {
        const table = window.bootAnomalyManager.anomalyTable;
        table.clear();
        if (tableData.anomalyTable && tableData.anomalyTable.length > 0) {
          table.rows.add(tableData.anomalyTable);
        }
        table.draw();
        
        // 更新表格说明
        window.bootAnomalyManager.updateTableDescription(tableData.stats);
      }

      // 延迟隐藏进度条容器（让用户看到100%完成）
      setTimeout(() => {
        const progressContainer = document.getElementById('portLogProgressContainer');
        if (progressContainer) {
          progressContainer.style.display = 'none';
        }
      }, 2000);

      return true;
    } catch (error) {
      console.error('流式解析 PortLog.txt 时发生错误:', error);
      return false;
    }
  }
}

// 全局初始化
(function() {
let instance = null;

function init() {
  if (!instance) {
    instance = new FileUtils();
    window.fileUtils = instance;
    console.log('FileUtils 已初始化');
  }
  return instance;
}

// 自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 100));
} else {
  setTimeout(init, 100);
}
})();
