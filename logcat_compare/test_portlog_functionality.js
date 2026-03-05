/**
 * 串口Log分析器功能测试脚本
 * 用于验证核心功能是否正常工作
 */

console.log('=== 串口Log分析器功能测试 ===');

// 测试数据
const testData = `[2025-12-06 17:31:05.202147] Runtimes:1
[2025-12-06 17:31:05.202148] Format: Log Type - Time
[2025-12-06 17:32:17.892147] Runtimes:2
[2025-12-06 17:32:17.892148] Format: Log Type - Time
[2025-12-06 17:33:35.032147] Runtimes:3
[2025-12-06 17:33:35.032148] Format: Log Type - Time
[2025-12-06 17:34:51.682147] Runtimes:4
[2025-12-06 17:34:51.682148] Format: Log Type - Time
[2025-12-06 17:36:08.332147] Runtimes:5
[2025-12-06 17:36:08.332148] Format: Log Type - Time`;

// 测试异常重启数据
const testDataWithAbnormalRestart = `[2025-12-06 17:31:05.202147] Runtimes:1
[2025-12-06 17:31:05.202148] Format: Log Type - Time
[2025-12-06 17:31:06.202148] Format: Log Type - Time  # 额外的Format行
[2025-12-06 17:32:17.892147] Runtimes:2
[2025-12-06 17:32:17.892148] Format: Log Type - Time
[2025-12-06 17:33:35.032147] Runtimes:3
[2025-12-06 17:33:35.032148] Format: Log Type - Time`;

// 测试长时间间隔数据
const testDataWithLongInterval = `[2025-12-06 17:31:05.202147] Runtimes:1
[2025-12-06 17:31:05.202148] Format: Log Type - Time
[2025-12-06 17:32:17.892147] Runtimes:2
[2025-12-06 17:32:17.892148] Format: Log Type - Time
[2025-12-06 17:33:35.032147] Runtimes:3
[2025-12-06 17:33:35.032148] Format: Log Type - Time
[2025-12-06 17:45:35.032147] Runtimes:4  # 长时间间隔
[2025-12-06 17:45:35.032148] Format: Log Type - Time`;

// 测试函数
function testPortLogAnalyzer() {
    console.log('\n1. 测试基本解析功能...');
    
    if (!window.PortLogAnalyzer) {
        console.error('❌ PortLogAnalyzer 未加载');
        return false;
    }
    
    const analyzer = new window.PortLogAnalyzer();
    const result = analyzer.parsePortLogFile(testData);
    
    if (!result.runtimes || result.runtimes.length !== 5) {
        console.error('❌ 基本解析失败: 期望5个Runtimes，实际找到' + (result.runtimes ? result.runtimes.length : 0));
        return false;
    }
    
    console.log('✅ 基本解析成功: 找到' + result.runtimes.length + '个Runtimes');
    
    // 验证时间间隔分析
    const analysis = analyzer.portLogAnalysis;
    if (!analysis.timeIntervals || analysis.timeIntervals.length !== 4) {
        console.error('❌ 时间间隔分析失败');
        return false;
    }
    
    console.log('✅ 时间间隔分析成功: 找到' + analysis.timeIntervals.length + '个间隔');
    
    // 验证警告阈值计算
    if (analysis.minInterval <= 0) {
        console.error('❌ 最小间隔计算失败');
        return false;
    }
    
    const expectedThreshold = analysis.minInterval + 30;
    if (Math.abs(analysis.warningThreshold - expectedThreshold) > 0.01) {
        console.error('❌ 警告阈值计算失败: 期望' + expectedThreshold + '，实际' + analysis.warningThreshold);
        return false;
    }
    
    console.log('✅ 警告阈值计算正确: 最小间隔=' + analysis.minInterval.toFixed(2) + '秒，阈值=' + analysis.warningThreshold.toFixed(2) + '秒');
    
    return true;
}

function testAbnormalRestartDetection() {
    console.log('\n2. 测试异常重启检测...');
    
    const analyzer = new window.PortLogAnalyzer();
    const result = analyzer.parsePortLogFile(testDataWithAbnormalRestart);
    const analysis = analyzer.portLogAnalysis;
    
    if (analysis.abnormalRestarts.length !== 1) {
        console.error('❌ 异常重启检测失败: 期望1个异常重启，实际找到' + analysis.abnormalRestarts.length);
        return false;
    }
    
    const abnormalRestart = analysis.abnormalRestarts[0];
    if (abnormalRestart.runtime !== 1 || abnormalRestart.formatCount !== 2) {
        console.error('❌ 异常重启数据不正确');
        return false;
    }
    
    console.log('✅ 异常重启检测成功: Runtime ' + abnormalRestart.runtime + ' 检测到' + abnormalRestart.formatCount + '次Format行');
    
    return true;
}

function testLongIntervalWarning() {
    console.log('\n3. 测试长时间间隔警告...');
    
    const analyzer = new window.PortLogAnalyzer();
    const result = analyzer.parsePortLogFile(testDataWithLongInterval);
    const analysis = analyzer.portLogAnalysis;
    
    // 计算期望的警告
    // 前两个间隔: ~72.69秒, ~77.14秒
    // 第三个间隔: ~720秒 (12分钟) - 应该触发警告
    
    const warnings = analysis.timeWarnings;
    if (warnings.length !== 1) {
        console.error('❌ 长时间间隔警告检测失败: 期望1个警告，实际找到' + warnings.length);
        console.log('分析结果:', analysis);
        return false;
    }
    
    const warning = warnings[0];
    if (warning.fromRuntime !== 3 || warning.toRuntime !== 4) {
        console.error('❌ 警告对应的Runtime不正确');
        return false;
    }
    
    console.log('✅ 长时间间隔警告检测成功: Runtime ' + warning.fromRuntime + ' 到 ' + warning.toRuntime + ' 间隔' + warning.intervalSeconds.toFixed(2) + '秒，超过阈值' + warning.warningThreshold.toFixed(2) + '秒');
    
    return true;
}

function testTableDataGeneration() {
    console.log('\n4. 测试表格数据生成...');
    
    const analyzer = new window.PortLogAnalyzer();
    analyzer.parsePortLogFile(testData);
    const tableData = analyzer.getTableData();
    
    if (!tableData.timeIntervalTable || tableData.timeIntervalTable.length !== 4) {
        console.error('❌ 时间间隔表格数据生成失败');
        return false;
    }
    
    if (!tableData.restartTable || tableData.restartTable.length !== 4) {
        console.error('❌ 重启表格数据生成失败');
        return false;
    }
    
    if (!tableData.stats || !tableData.stats.totalRuntimes) {
        console.error('❌ 统计信息生成失败');
        return false;
    }
    
    console.log('✅ 表格数据生成成功:');
    console.log('   - 时间间隔表格: ' + tableData.timeIntervalTable.length + '行');
    console.log('   - 重启表格: ' + tableData.restartTable.length + '行');
    console.log('   - 统计信息: ' + Object.keys(tableData.stats).length + '项');
    
    return true;
}

function testCSVExport() {
    console.log('\n5. 测试CSV导出...');
    
    const analyzer = new window.PortLogAnalyzer();
    analyzer.parsePortLogFile(testData);
    const csv = analyzer.exportToCSV();
    
    if (!csv || csv.length === 0) {
        console.error('❌ CSV导出失败');
        return false;
    }
    
    // 检查CSV是否包含关键部分
    if (!csv.includes('时间间隔分析') || !csv.includes('重启分析') || !csv.includes('统计信息')) {
        console.error('❌ CSV格式不正确');
        return false;
    }
    
    console.log('✅ CSV导出成功: ' + csv.length + '字符');
    
    return true;
}

// 运行所有测试
function runAllTests() {
    console.log('开始运行串口Log分析器功能测试...');
    
    const tests = [
        { name: '基本解析功能', test: testPortLogAnalyzer },
        { name: '异常重启检测', test: testAbnormalRestartDetection },
        { name: '长时间间隔警告', test: testLongIntervalWarning },
        { name: '表格数据生成', test: testTableDataGeneration },
        { name: 'CSV导出', test: testCSVExport }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(testCase => {
        try {
            const result = testCase.test();
            if (result) {
                console.log('✅ ' + testCase.name + ': 通过');
                passed++;
            } else {
                console.log('❌ ' + testCase.name + ': 失败');
                failed++;
            }
        } catch (error) {
            console.error('❌ ' + testCase.name + ': 异常 - ' + error.message);
            failed++;
        }
    });
    
    console.log('\n=== 测试结果汇总 ===');
    console.log('总测试数: ' + tests.length);
    console.log('通过: ' + passed);
    console.log('失败: ' + failed);
    
    if (failed === 0) {
        console.log('🎉 所有测试通过！串口Log分析器功能正常。');
        return true;
    } else {
        console.log('⚠️  ' + failed + ' 个测试失败，需要检查问题。');
        return false;
    }
}

// 如果直接运行此脚本，则执行测试
if (typeof window !== 'undefined') {
    // 在浏览器环境中，等待PortLogAnalyzer加载
    setTimeout(() => {
        if (window.PortLogAnalyzer) {
            runAllTests();
        } else {
            console.error('PortLogAnalyzer 未加载，请确保 port_log_analyzer.js 已正确引入');
        }
    }, 1000);
} else {
    // 在Node.js环境中，需要加载模块
    console.log('请在浏览器环境中运行此测试脚本');
}

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testPortLogAnalyzer,
        testAbnormalRestartDetection,
        testLongIntervalWarning,
        testTableDataGeneration,
        testCSVExport,
        runAllTests
    };
}
