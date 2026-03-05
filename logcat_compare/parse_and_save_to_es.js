#!/usr/bin/env node

/**
 * 主脚本：解析日志文件并保存到 Elasticsearch
 * 用法：
 *   node parse_and_save_to_es.js --file <日志文件路径>
 *   node parse_and_save_to_es.js --dir <日志目录路径>
 *   node parse_and_save_to_es.js --help
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// 导入自定义模块
const ElasticsearchClient = require('./elasticsearch_client.js');

// 模拟浏览器环境（用于加载现有代码）
global.window = {
  fileAnalysisManager: {
    addFileData: function(file, fileSize, stages) {
      console.log(`[fileAnalysisManager] 添加文件数据: ${file}, 大小: ${fileSize} bytes, 阶段数: ${stages ? stages.length : 0}`);
      return { success: true };
    }
  }
};

// 动态加载现有的 JavaScript 文件
function loadJSFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 创建一个沙箱环境来执行代码
  const module = { exports: {} };
  const require = () => ({});
  
  // 定义全局类
  const evalCode = `
    (function(module, exports, require) {
      ${content}
      
      // 如果文件定义了类，将它们导出到全局作用域
      if (typeof LogcatEntry !== 'undefined') {
        global.LogcatEntry = LogcatEntry;
      }
      if (typeof LogcatEntryParser !== 'undefined') {
        global.LogcatEntryParser = LogcatEntryParser;
      }
      if (typeof StageDetector !== 'undefined') {
        global.StageDetector = StageDetector;
      }
      if (typeof LogcatManager !== 'undefined') {
        global.LogcatManager = LogcatManager;
      }
    })
  `;
  
  try {
    const func = eval(evalCode);
    func(module, module.exports, require);
  } catch (error) {
    console.error(`加载 ${filePath} 时出错:`, error.message);
    throw error;
  }
}

/**
 * 加载必要的 JavaScript 文件
 */
function loadRequiredFiles() {
  console.log('加载必要的 JavaScript 文件...');
  
  try {
    // 按依赖顺序加载文件
    loadJSFile(path.join(__dirname, 'logcat_entry.js'));
    console.log('✓ 加载 logcat_entry.js');
    
    loadJSFile(path.join(__dirname, 'logcat_stage.js'));
    console.log('✓ 加载 logcat_stage.js');
    
    loadJSFile(path.join(__dirname, 'logcat_manager.js'));
    console.log('✓ 加载 logcat_manager.js');
    
    console.log('所有文件加载完成\n');
    return true;
  } catch (error) {
    console.error('加载文件失败:', error.message);
    return false;
  }
}

/**
 * 解析单个日志文件
 * @param {string} filePath - 日志文件路径
 * @param {ElasticsearchClient} esClient - Elasticsearch 客户端
 * @param {Object} options - 选项
 */
async function parseAndSaveFile(filePath, esClient, options = {}) {
  const startTime = Date.now();
  
  try {
    console.log(`\n📄 处理文件: ${filePath}`);
    
    // 读取文件内容
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const fileSize = fs.statSync(filePath).size;
    
    console.log(`  文件大小: ${fileSize} bytes, 内容长度: ${fileContent.length} 字符`);
    
    // 创建 LogcatManager 实例
    const logcatManager = new LogcatManager();
    
    // 解析日志文件
    console.log('  解析日志文件...');
    const result = logcatManager.addLogcatEntry(filePath, fileContent, fileSize);
    
    const parsedCount = result.logcatEntrys ? result.logcatEntrys.length : 0;
    console.log(`  解析完成: ${parsedCount} 个日志条目`);
    
    if (parsedCount === 0) {
      console.log('  ⚠️  没有解析到有效的日志条目，跳过此文件');
      return { success: false, reason: 'No entries parsed', file: filePath };
    }
    
    // 准备 Elasticsearch 索引名称
    const indexName = esClient.sanitizeIndexName(filePath);
    console.log(`  Elasticsearch 索引: ${indexName}`);
    
    // 创建索引（如果不存在）
    await esClient.createIndexIfNotExists(indexName);
    
    // 准备文档数据
    const documents = result.logcatEntrys
      .filter(entry => !entry.isFlag) // 过滤掉标志为无效的条目
      .map((entry, index) => {
        // 创建文档对象，包含所有 LogcatEntry 属性
        const doc = {
          ...entry,
          // 添加元数据
          filename: filePath,
          parsed_at: new Date().toISOString(),
          entry_index: index,
          total_entries: parsedCount
        };
        
        // 确保所有字段都是基本类型（Elasticsearch 不支持复杂对象）
        Object.keys(doc).forEach(key => {
          if (typeof doc[key] === 'object' && doc[key] !== null) {
            doc[key] = JSON.stringify(doc[key]);
          }
        });
        
        return doc;
      });
    
    console.log(`  准备索引 ${documents.length} 个有效文档`);
    
    // 批量保存到 Elasticsearch
    console.log('  保存到 Elasticsearch...');
    const saveResult = await esClient.bulkIndex(indexName, documents, 'lineNumber');
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (saveResult.success) {
      console.log(`  ✅ 完成! 耗时: ${duration}ms, 保存: ${saveResult.count} 个文档`);
      return {
        success: true,
        file: filePath,
        index: indexName,
        entries: parsedCount,
        saved: saveResult.count,
        duration: duration
      };
    } else {
      console.log(`  ⚠️  部分完成! 耗时: ${duration}ms, 成功: ${saveResult.count}, 失败: ${saveResult.errors}`);
      return {
        success: false,
        file: filePath,
        index: indexName,
        entries: parsedCount,
        saved: saveResult.count,
        errors: saveResult.errors,
        duration: duration
      };
    }
    
  } catch (error) {
    console.error(`  ❌ 处理文件失败 (${filePath}):`, error.message);
    return {
      success: false,
      file: filePath,
      error: error.message
    };
  }
}

/**
 * 递归获取目录中的所有日志文件
 * @param {string} dirPath - 目录路径
 * @returns {Array} 日志文件路径数组
 */
function getLogFilesFromDirectory(dirPath) {
  const logFiles = [];
  
  function traverseDirectory(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverseDirectory(fullPath);
      } else if (stat.isFile() && item.match(/\.(log|txt)$/i)) {
        logFiles.push(fullPath);
      }
    }
  }
  
  traverseDirectory(dirPath);
  return logFiles;
}

/**
 * 主函数
 */
async function main() {
  // 配置命令行参数
  program
    .name('parse_and_save_to_es')
    .description('解析日志文件并保存到 Elasticsearch')
    .version('1.0.0');
  
  program
    .option('-f, --file <path>', '解析单个日志文件')
    .option('-d, --dir <path>', '解析目录中的所有日志文件')
    .option('-e, --es-node <url>', 'Elasticsearch 节点 URL (默认: https://127.0.0.1:9200)', 'https://127.0.0.1:9200')
    .option('-u, --username <username>', 'Elasticsearch 用户名')
    .option('-p, --password <password>', 'Elasticsearch 密码')
    .option('-b, --batch-size <number>', '批量处理大小 (默认: 1000)', '1000')
    .option('--skip-existing', '跳过已处理的文件（基于索引存在性）')
    .option('--dry-run', '试运行，不实际保存到 Elasticsearch');
  
  program.parse(process.argv);
  const options = program.opts();
  
  // 验证参数
  if (!options.file && !options.dir) {
    console.error('错误: 必须指定 --file 或 --dir 参数');
    program.help();
    process.exit(1);
  }
  
  // 显示配置
  console.log('='.repeat(60));
  console.log('日志解析和 Elasticsearch 保存工具');
  console.log('='.repeat(60));
  console.log(`Elasticsearch 节点: ${options.esNode}`);
  console.log(`批量大小: ${options.batchSize}`);
  console.log(`试运行模式: ${options.dryRun ? '是' : '否'}`);
  console.log(`跳过已处理文件: ${options.skipExisting ? '是' : '否'}`);
  console.log('');
  
  // 加载必要的 JavaScript 文件
  if (!loadRequiredFiles()) {
    process.exit(1);
  }
  
  // 初始化 Elasticsearch 客户端
  const esClientOptions = {
    node: options.esNode
  };
  
  // 如果提供了用户名和密码，添加认证信息
  if (options.username && options.password) {
    esClientOptions.username = options.username;
    esClientOptions.password = options.password;
  }
  
  const esClient = new ElasticsearchClient(esClientOptions);
  
  // 测试 Elasticsearch 连接
  console.log('测试 Elasticsearch 连接...');
  const connected = await esClient.testConnection();
  if (!connected && !options.dryRun) {
    console.error('无法连接到 Elasticsearch，退出');
    process.exit(1);
  }
  
  // 获取要处理的文件列表
  let filesToProcess = [];
  
  if (options.file) {
    if (!fs.existsSync(options.file)) {
      console.error(`错误: 文件不存在: ${options.file}`);
      process.exit(1);
    }
    filesToProcess = [options.file];
  } else if (options.dir) {
    if (!fs.existsSync(options.dir)) {
      console.error(`错误: 目录不存在: ${options.dir}`);
      process.exit(1);
    }
    
    console.log(`扫描目录: ${options.dir}`);
    filesToProcess = getLogFilesFromDirectory(options.dir);
    console.log(`找到 ${filesToProcess.length} 个日志文件`);
  }
  
  if (filesToProcess.length === 0) {
    console.error('错误: 没有找到要处理的文件');
    process.exit(1);
  }
  
  // 处理文件
  console.log(`\n开始处理 ${filesToProcess.length} 个文件...`);
  console.log('');
  
  const results = {
    total: filesToProcess.length,
    successful: 0,
    failed: 0,
    totalEntries: 0,
    totalSaved: 0,
    files: []
  };
  
  for (let i = 0; i < filesToProcess.length; i++) {
    const filePath = filesToProcess[i];
    
    console.log(`[${i + 1}/${filesToProcess.length}]`);
    
    if (options.dryRun) {
      console.log(`  📄 试运行: ${filePath}`);
      console.log(`  ℹ️  试运行模式，跳过实际保存`);
      results.files.push({
        file: filePath,
        success: true,
        dryRun: true
      });
      results.successful++;
    } else {
      const result = await parseAndSaveFile(filePath, esClient, options);
      
      results.files.push(result);
      
      if (result.success) {
        results.successful++;
        results.totalEntries += result.entries || 0;
        results.totalSaved += result.saved || 0;
      } else {
        results.failed++;
      }
    }
    
    console.log('');
  }
  
  // 显示摘要
  console.log('='.repeat(60));
  console.log('处理完成摘要');
  console.log('='.repeat(60));
  console.log(`总文件数: ${results.total}`);
  console.log(`成功: ${results.successful}`);
  console.log(`失败: ${results.failed}`);
  
  if (!options.dryRun) {
    console.log(`总日志条目: ${results.totalEntries}`);
    console.log(`总保存文档: ${results.totalSaved}`);
  }
  
  console.log('');
  
  // 显示失败的文件（如果有）
  if (results.failed > 0) {
    console.log('失败的文件:');
    results.files
      .filter(r => !r.success && !r.dryRun)
      .forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.file}`);
        if (r.error) console.log(`     错误: ${r.error}`);
      });
    console.log('');
  }
  
  console.log('🎉 处理完成!');
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('未处理的错误:', error);
    process.exit(1);
  });
}

module.exports = {
  parseAndSaveFile,
  getLogFilesFromDirectory
};
