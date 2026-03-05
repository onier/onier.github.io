/**
 * BootAnomalyDetector - 启动异常检测器
 * 基于规则表的启动异常检测系统
 * 功能：
 * 1. 使用配置化的规则表检测各种启动异常
 * 2. 支持电源管理、安全启动、硬件初始化等多种异常类型
 * 3. 提供结构化的检测结果输出
 */

class BootAnomalyDetector {
  constructor() {
    // 解析结果
    this.logData = {
      lines: [],     // 原始日志行
      totalLines: 0  // 总行数
    };

    // 检测结果
    this.detectionResults = {
      anomalies: [],  // 检测到的异常
      stats: {}       // 统计信息
    };

    // ============================================================
    // 配置规则表 (在此处扩展更多异常)
    // keywords: 数组中的所有字符串都必须出现在同一行中才算匹配 (AND关系)
    // ============================================================
    this.abnormalRules = [
      // --- 电源管理 (PMIC) 相关 ---
      // {
      //     id: 'PMIC_UVLO',
      //     keywords: ['POWER OFF due to', 'UVLO'],
      //     severity: 'CRITICAL',
      //     desc: '欠压锁定：电压过低导致强制断电 (电池没电/虚接/负载过大)'
      // },
      // {
      //     id: 'PMIC_OVP',
      //     keywords: ['POWER OFF due to', 'OVP'],
      //     severity: 'CRITICAL',
      //     desc: '过压保护：输入电压超过阈值 (适配器电压错误)'
      // },
      // {
      //     id: 'PMIC_WDT',
      //     keywords: ['POWER OFF due to', 'WDT'], // 有些平台是 BITE
      //     severity: 'CRITICAL',
      //     desc: '看门狗复位：上次系统死机/卡死导致被强制重启'
      // },
      // {
      //     id: 'PMIC_TEMP',
      //     keywords: ['POWER OFF due to', 'TEMP'], // 包含 OTST 或 TEMP
      //     severity: 'CRITICAL',
      //     desc: '过热保护：温度过高导致关机'
      // },
      // {
      //     id: 'PMIC_SHORT',
      //     keywords: ['POWER OFF due to', 'SC'], // Short Circuit
      //     severity: 'CRITICAL',
      //     desc: '短路保护：检测到硬件短路'
      // },
      {
        id: 'PMIC_SMPL',
        keywords: ['POWER ON by', 'SMPL'],
        severity: 'ERROR',
        desc: '突发掉电恢复：检测到电源瞬间断开后又恢复 (接触不良/抖动)'
      },
      // ,
      // {
      //     id: 'PMIC_HARD_RESET',
      //     keywords: ['HARD_RESET'],
      //     severity: 'INFO',
      //     desc: '硬复位：通常由长按电源键或特定硬件信号触发'
      // },

      // // --- 启动安全与镜像校验 ---
      // {
      //     id: 'SEC_HASH_MISMATCH',
      //     keywords: ['Hash does not match'],
      //     severity: 'ERROR',
      //     desc: '镜像校验失败：分区数据损坏或被篡改 (AVB Verify Fail)'
      // },
      // {
      //     id: 'SEC_VERIFY_ERR',
      //     keywords: ['Error verifying'],
      //     severity: 'ERROR',
      //     desc: '验证错误：Vbmeta 或签名验证未通过'
      // },

      // // --- 硬件初始化错误 ---
      // {
      //     id: 'HW_DEVICE_ERR',
      //     keywords: ['Device Error'],
      //     severity: 'ERROR',
      //     desc: '设备错误：外设初始化失败 (如充电IC、屏幕等)'
      // },
      // {
      //     id: 'HW_NOT_FOUND',
      //     keywords: ['Protocol', 'Not Found'],
      //     severity: 'WARNING',
      //     desc: '协议缺失：UEFI 驱动未找到指定协议'
      // },
      // {
      //     id: 'IMG_LOAD_FAIL',
      //     keywords: ['Image Loaded', '(0 Bytes)'],
      //     severity: 'ERROR',
      //     desc: '镜像加载失败：文件大小为 0 或读取错误'
      // },

      // // --- 新增：串口Log特定规则 ---
      // {
      //     id: 'PORT_RUNTIME_INTERVAL',
      //     keywords: ['Runtimes:'],
      //     severity: 'WARNING',
      //     desc: 'Runtimes时间间隔检测'
      // },
      // {
      //     id: 'PORT_FORMAT_MULTIPLE',
      //     keywords: ['Format: Log Type - Time'],
      //     severity: 'WARNING',
      //     desc: '多次Format行检测'
      // }
    ];
  }

  /**
   * 解析日志文件
   * @param {string} content - 文件内容
   * @returns {object} 解析结果
   */
  parseLogFile(content) {
    const lines = content.split('\n');

    // 存储原始日志数据
    this.logData = {
      lines: lines.map(
          (line, index) => (
              {lineNumber: index + 1, content: line.trim(), rawContent: line})),
      totalLines: lines.length
    };

    // 执行异常检测
    this.detectAnomalies();

    return this.logData;
  }

  /**
   * 初始化流式解析
   */
  startStreamParse() {
    // 流式解析不存储所有行，只存储检测结果
    this.logData = {
      lines: null,  // 不存储原始日志以节省内存
      totalLines: 0
    };
    
    this.detectionResults = {
      anomalies: [],
      stats: {}
    };
    
    // 只保留最近的相关行用于异常重启检测，避免内存溢出
    this._lastRuntimeLine = null;
    this._formatCountSinceLastRuntime = 0;
    this._currentLineNumber = 0;
  }

  /**
   * 处理单个数据块（流式解析）
   * @param {Array<string>} lines - 数据块中的行数组
   */
  parseChunk(lines) {
    if (!Array.isArray(lines)) {
      console.error('parseChunk 需要传入行数组');
      return;
    }

    // 处理每一行
    for (const line of lines) {
      this._currentLineNumber++;
      
      // 只创建临时行对象用于检测，不存储到数组中
      const lineObj = {
        lineNumber: this._currentLineNumber,
        content: line.trim(),
        rawContent: line
      };
      
      // 检测异常（异常结果会被存储到 detectionResults.anomalies）
      this.detectAnomalyInLine(lineObj);
    }
    
    this.logData.totalLines = this._currentLineNumber;
  }

  /**
   * 检测单行中的异常（流式解析专用）
   * @param {object} lineObj - 行对象
   */
  detectAnomalyInLine(lineObj) {
    const line = lineObj.content;
    const lineNumber = lineObj.lineNumber;

    // // 检测异常重启（不存储所有行，只维护计数器）
    // if (line.includes('] Runtimes:')) {
    //   this._lastRuntimeLine = line;
    //   this._formatCountSinceLastRuntime = 0;
    // }
    // if (line.includes('] Format: Log Type - Time') && this._lastRuntimeLine) {
    //   this._formatCountSinceLastRuntime++;
    //   // 检测异常重启：如果在上一次 Runtimes 后出现多次 Format
    //   if (this._formatCountSinceLastRuntime > 1) {
    //     this.detectionResults.anomalies.push({
    //       lineNumber: lineNumber,
    //       ruleId: '异常关机',
    //       severity: 'ERROR',
    //       description: '出现异常重启',
    //       rawContent: this._lastRuntimeLine,
    //       matchedKeywords: ''
    //     });
    //     // 重置计数器，避免重复添加
    //     this._formatCountSinceLastRuntime = 0;
    //   }
    // }

    // 为了忽略大小写，统一转为大写进行比对
    const upperLine = line.toUpperCase();

    // 遍历所有规则
    for (const rule of this.abnormalRules) {
      // 检查是否包含该规则定义的所有关键词
      // every() 确保 keywords 数组里的每个词都在行内
      const isMatch = rule.keywords.every(
          keyword => upperLine.includes(keyword.toUpperCase()));

      if (isMatch) {
        this.detectionResults.anomalies.push({
          lineNumber: lineNumber,
          ruleId: rule.id,
          severity: rule.severity,
          description: rule.desc,
          rawContent: line,
          matchedKeywords: rule.keywords
        });

        // 如果一行匹配了某个规则，跳出规则循环，避免重复
        break;
      }
    }
  }

  /**
   * 结束流式解析并生成统计信息
   */
  endStreamParse() {
    // 计算统计信息
    this.detectionResults.stats = this.calculateStats(this.detectionResults.anomalies);
    
    // 清理临时数据
    delete this._lastRuntimeLine;
    delete this._formatCountSinceLastRuntime;
    delete this._currentLineNumber;
    
    return this.detectionResults;
  }
  
  checkCrash(rebootLogs) {
    return null;
    let matchRuntime = 0;
    let lineRaw = '';
    for (let i = 0; i < rebootLogs.length; i++) {
      if (rebootLogs[i].includes('] Runtimes:')) {
        lineRaw = rebootLogs[i];
        matchRuntime = 0;
        continue;
      }
      if (rebootLogs[i].includes('] Format: Log Type')) {
        matchRuntime++;
        if (matchRuntime > 1) {
          return {
            lineNumber: 0,
            ruleId: '异常关机',                   // 规则ID
            severity: 'ERROR',                    // 严重等级
            description: '出现异常重启',  // 中文描述
            rawContent: lineRaw,                  // 原始日志内容
            matchedKeywords: ''                   // 匹配到的关键词
          };
        }
        continue;
      }
    }
  }
  /**
   * 检测异常
   */
  detectAnomalies() {
    const anomalies = [];
    const lines = this.logData.lines;
    let RuntimesAndRebootLogs = [];
    // 逐行扫描逻辑
    lines.forEach((lineObj) => {
      const line = lineObj.content;
      if (line.includes('] Runtimes:')) {
        RuntimesAndRebootLogs.push(line);
      }
      if (line.includes('] Format: Log Type - Time')) {
        RuntimesAndRebootLogs.push(line);
      }
      const lineNumber = lineObj.lineNumber;

      // 为了忽略大小写，统一转为大写进行比对
      const upperLine = line.toUpperCase();

      // 遍历所有规则
      for (const rule of this.abnormalRules) {
        // 检查是否包含该规则定义的所有关键词
        // every() 确保 keywords 数组里的每个词都在行内
        const isMatch = rule.keywords.every(
            keyword => upperLine.includes(keyword.toUpperCase()));

        if (isMatch) {
          anomalies.push({
            lineNumber: lineNumber,         // 行号
            ruleId: rule.id,                // 规则ID
            severity: rule.severity,        // 严重等级
            description: rule.desc,         // 中文描述
            rawContent: line,               // 原始日志内容
            matchedKeywords: rule.keywords  // 匹配到的关键词
          });

          // 如果一行匹配了某个规则，是否还继续匹配其他规则？
          // 通常一行只对应一种主要错误，这里选择 break 跳出规则循环，避免重复
          // 如果需要一行匹配多个错误，注释掉下面这行即可
          break;
        }
      }
    });
    let item = this.checkCrash(RuntimesAndRebootLogs);
    if (item) {
      anomalies.push(item);
    }
    // 存储检测结果
    this.detectionResults.anomalies = anomalies;
    this.detectionResults.stats = this.calculateStats(anomalies);

    return this.detectionResults;
  }

  /**
   * 计算统计信息
   * @param {Array} anomalies - 检测到的异常数组
   * @returns {object} 统计信息
   */
  calculateStats(anomalies) {
    const severityCounts = {CRITICAL: 0, ERROR: 0, WARNING: 0, INFO: 0};

    const ruleCounts = {};

    // 统计严重等级和规则分布
    anomalies.forEach(anomaly => {
      severityCounts[anomaly.severity] =
          (severityCounts[anomaly.severity] || 0) + 1;
      ruleCounts[anomaly.ruleId] = (ruleCounts[anomaly.ruleId] || 0) + 1;
    });

    return {
      totalAnomalies: anomalies.length,
      severityCounts: severityCounts,
      ruleCounts: ruleCounts,
      totalRules: this.abnormalRules.length,
      linesScanned: this.logData.totalLines,
      anomalyRate: this.logData.totalLines > 0 ?
          (anomalies.length / this.logData.totalLines * 100).toFixed(2) + '%' :
          '0%'
    };
  }

  /**
   * 获取检测结果用于表格显示
   * @returns {object} 表格数据
   */
  getTableData() {
    return {
      // 异常表格数据 - 4列结构（删除行号列）
      anomalyTable: this.detectionResults.anomalies.map(
          anomaly => ({
            规则ID: anomaly.ruleId,
            严重等级:
                this.getSeverityIcon(anomaly.severity) + ' ' + anomaly.severity,
            描述: anomaly.description,
            原始内容: anomaly.rawContent
          })),

      // 统计信息
      stats: this.detectionResults.stats
    };
  }

  /**
   * 获取严重等级图标
   * @param {string} severity - 严重等级
   * @returns {string} 图标
   */
  getSeverityIcon(severity) {
    const icons =
        {'CRITICAL': '🔴', 'ERROR': '🟠', 'WARNING': '🟡', 'INFO': '🔵'};
    return icons[severity] || '⚪';
  }

  /**
   * 获取检测摘要
   * @returns {string} 检测摘要
   */
  getDetectionSummary() {
    const stats = this.detectionResults.stats;
    const severityCounts = stats.severityCounts || {};

    let summary = `启动异常检测摘要：\n`;
    summary += `扫描行数: ${stats.linesScanned || 0}\n`;
    summary += `检测到异常: ${stats.totalAnomalies || 0}个\n`;
    summary += `异常率: ${stats.anomalyRate || '0%'}\n`;
    summary += `严重等级分布:\n`;
    summary += `  🔴 严重: ${severityCounts.CRITICAL || 0}个\n`;
    summary += `  🟠 错误: ${severityCounts.ERROR || 0}个\n`;
    summary += `  🟡 警告: ${severityCounts.WARNING || 0}个\n`;
    summary += `  🔵 信息: ${severityCounts.INFO || 0}个\n`;
    summary += `规则数量: ${stats.totalRules || this.abnormalRules.length}条`;

    return summary;
  }

  /**
   * 导出检测结果为CSV
   * @returns {string} CSV格式的数据
   */
  exportToCSV() {
    const tableData = this.getTableData();
    const BOM = '\uFEFF';  // UTF-8 BOM

    let csv = BOM;

    // 导出异常表格（删除行号列）
    csv += '启动异常检测结果\n';
    csv += '规则ID,严重等级,描述,原始内容\n';

    tableData.anomalyTable.forEach(row => {
      csv += `"${row.规则ID}","${row.严重等级}","${row.描述}","${
          row.原始内容}"\n`;
    });

    csv += '\n\n统计信息\n';
    csv += '指标,值\n';
    csv += `总行数,${tableData.stats.linesScanned || 0}\n`;
    csv += `总异常数,${tableData.stats.totalAnomalies || 0}\n`;
    csv += `异常率,${tableData.stats.anomalyRate || '0%'}\n`;
    csv += `严重等级-严重,${tableData.stats.severityCounts?.CRITICAL || 0}\n`;
    csv += `严重等级-错误,${tableData.stats.severityCounts?.ERROR || 0}\n`;
    csv += `严重等级-警告,${tableData.stats.severityCounts?.WARNING || 0}\n`;
    csv += `严重等级-信息,${tableData.stats.severityCounts?.INFO || 0}\n`;
    csv +=
        `规则总数,${tableData.stats.totalRules || this.abnormalRules.length}\n`;

    return csv;
  }

  /**
   * 添加自定义规则
   * @param {object} rule - 规则对象
   */
  addRule(rule) {
    if (rule.id && rule.keywords && rule.severity && rule.desc) {
      this.abnormalRules.push(rule);
      return true;
    }
    return false;
  }

  /**
   * 删除规则
   * @param {string} ruleId - 规则ID
   */
  removeRule(ruleId) {
    const index = this.abnormalRules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      this.abnormalRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有规则
   * @returns {Array} 规则数组
   */
  getAllRules() {
    return this.abnormalRules;
  }

  /**
   * 重置检测器状态
   */
  reset() {
    this.logData = {lines: [], totalLines: 0};

    this.detectionResults = {anomalies: [], stats: {}};
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BootAnomalyDetector;
}

// 全局变量 - 保持向后兼容
window.PortLogAnalyzer = BootAnomalyDetector;
window.BootAnomalyDetector = BootAnomalyDetector;
