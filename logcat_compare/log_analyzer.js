var editorErrorDecorations = [];
var editorWarningDecorations = [];
var editorErrorSelectIndexies = [];
var editorWarningSelectIndexies = [];

function jumpToNextError(editorIndex) {
    let editor = editors[editorIndex - 1];
    if (editorErrorSelectIndexies[editorIndex] == undefined) {
        editorErrorSelectIndexies[editorIndex] = 0;
    }
    let decoration = editorErrorDecorations[editorIndex][editorErrorSelectIndexies[editorIndex]];
    if (decoration == undefined) {
        editorErrorSelectIndexies[editorIndex] = 0;
        return;
    } else {
        if (decoration) {
            const line = decoration.range.startLineNumber;
            editor.setPosition({ lineNumber: line, column: 1 });
            editor.revealLineInCenter(line);
            editorErrorSelectIndexies[editorIndex] = editorErrorSelectIndexies[editorIndex] + 1;
        }
    }
}

function jumpToNextWarning(editorIndex) {
    let editor = editors[editorIndex - 1];
    if (editorWarningSelectIndexies[editorIndex] == undefined) {
        editorWarningSelectIndexies[editorIndex] = 0;
    }
    let decoration = editorWarningDecorations[editorIndex][editorWarningSelectIndexies[editorIndex]];
    if (decoration == undefined) {
        editorWarningSelectIndexies[editorIndex] = 0;
        return;
    } else {
        if (decoration) {
            const line = decoration.range.startLineNumber;
            editor.setPosition({ lineNumber: line, column: 1 });
            editor.revealLineInCenter(line);
            editorWarningSelectIndexies[editorIndex] = editorWarningSelectIndexies[editorIndex] + 1;
        }
    }
}

/**
 * LogAnalyzer - Logcat 智能分析工具 (重构版)
 * 核心思想：控制反转 (IoC)，由规则自己决定如何解析日志行
 */
const LogAnalyzer = {

    /**
     * 定义规则库
     * 每个规则必须包含一个 scan(line) 方法
     * scan 返回格式: { severity: 'error'|'warning', message: '...' } 或 null
     */
    rules: [
        // 1. 低电量检测 (逻辑判断)
        {
            id: 'low_battery',
            // 静态正则，避免在函数内重复编译
            _regex: /(?:healthd|BatteryService).*?l=(\d+)/i,
            scan: function (line) {
                const match = line.match(this._regex);
                if (!match) return null;

                const level = parseInt(match[1], 10);
                if (level <= 20) {
                    return {
                        severity: 'warning',
                        message: `🔋 **低电量警告**\n当前电量仅为 **${level}%**`
                    };
                }
                return null;
            }
        },

        // 2. ANR 检测 (简单正则)
        {
            id: 'anr',
            _regex: /ANR in (\S+)/,
            scan: function (line) {
                const match = line.match(this._regex);
                return match ? {
                    severity: 'error',
                    message: `🛑 **检测到 ANR**\n应用无响应：\`${match[1]}\``
                } : null;
            }
        },

        // 3. Java Crash
        {
            id: 'crash_java',
            _regex: /FATAL EXCEPTION: (.+)/,
            scan: function (line) {
                const match = line.match(this._regex);
                return match ? {
                    severity: 'error',
                    message: `💥 **Java 崩溃**\n进程/线程：\`${match[1]}\``
                } : null;
            }
        },

        // 4. Native Crash
        {
            id: 'crash_native',
            _regex: /Fatal signal (\d+) \((SIG\w+)\).*?code (\d+)/,
            scan: function (line) {
                const match = line.match(this._regex);
                return match ? {
                    severity: 'error',
                    message: `☠️ **Native 崩溃**\n信号：${match[2]} (${match[1]})`
                } : null;
            }
        },

        // 5. UI 卡顿 (阈值判断)
        {
            id: 'lag',
            _regex: /Choreographer.*Skipped (\d+) frames/,
            scan: function (line) {
                const match = line.match(this._regex);
                if (!match) return null;

                const frames = parseInt(match[1], 10);
                // 只有跳帧超过 30 才报警
                if (frames > 30) {
                    return {
                        severity: 'warning',
                        message: `🐢 **UI 卡顿**\n主线程跳过了 **${frames}** 帧 (约 ${Math.round(frames * 16.6)}ms)`
                    };
                }
                return null;
            }
        },

        // 6. 频繁杀进程 (结合刚才的上下文，这是一个复杂的逻辑示例)
        {
            id: 'process_kill',
            _regex: /Successfully killed process cgroup uid (\d+) pid (\d+)/,
            scan: function (line) {
                const match = line.match(this._regex);
                if (!match) return null;

                const uid = match[1];
                const pid = match[2];

                // 这里可以做简单的标记，如果需要做"连续20次"这种分析，
                // 通常需要上下文状态，但作为单行扫描，我们先标记出来。
                if (uid === '1000') {
                    return {
                        severity: 'warning',
                        message: `⚠️ **系统进程被杀**\nUID: 1000 (System) | PID: ${pid}\n若频繁出现请警惕 BootLoop`
                    };
                }
                return null; // 普通应用被杀不提示，保持清爽
            }
        }
        ,
        // 7.ActivityManager  Slow operation:
        {
            id: 'ActivityManager',
            // 核心改进：使用正则同时捕获 [耗时] 和 [上下文详情]
            // 匹配示例: "Slow operation: 540ms so far, now at com.android.server..."
            _regex: /Slow operation:\s+(\d+)ms\s*(.*)/,

            scan: function (line) {
                // 1. 快速筛选
                if (line.indexOf("Slow operation:") === -1) {
                    return null;
                }

                // 2. 正则提取
                const match = line.match(this._regex);
                if (!match) return null;

                const duration = parseInt(match[1]); // 提取时间，如 540
                const context = match[2].trim();     // 提取原因，如 "so far, now at..."

                if (Number.isNaN(duration)) return null;

                // =============================================
                // 3. 行业经验阈值配置
                // =============================================

                // 🛑 严重 (Critical): > 3秒
                // 这意味着系统接近 ANR (Application Not Responding) 的边缘
                // 或者广播/Service 启动极度超时
                if (duration >= 3000) {
                    return {
                        severity: 'error', // 高亮显示
                        message: `🛑 **致命卡顿 (近ANR)**\n⏱️ 耗时: ${duration}ms\n📍 位置: ${context}`
                    };
                }

                // ❌ 错误 (Error): > 500ms
                // 超过 500ms 意味着明显的掉帧，用户能感觉到“卡了一下”
                // 这种通常是主线程进行了 I/O 操作或繁重计算
                if (duration >= 500) {
                    return {
                        severity: 'error',
                        message: `🚫 **严重卡顿**\n⏱️ 耗时: ${duration}ms\n📍 位置: ${context}`
                    };
                }

                // ⚠️ 警告 (Warning): > 100ms
                // 原始代码是 300ms，但在性能优化中，100ms 是掉帧的警戒线 (60fps = 16ms/帧)
                // 连续几个 100ms 的操作就会导致动画不流畅
                if (duration >= 100) {
                    return {
                        severity: 'warning',
                        message: `⚠️ **轻微卡顿**\n⏱️ 耗时: ${duration}ms\n📍 位置: ${context}`
                    };
                }

                return null;
            }
        },

        // 7.SystemServerTiming   took to complete:
        // SystemServerTiming( 2111): StartSensorPrivacyService took to complete: 7ms
        {
            id: 'ActivityManager',
            // 优化正则：同时捕获 [服务名称] 和 [耗时]
            // 匹配示例: "StartSensorPrivacyService took to complete: 7ms"
            _regex: /([a-zA-Z0-9_]+)\s+took to complete:\s+(\d+)ms/,

            scan: function (line) {
                // 1. 快速过滤：如果不包含关键词，直接跳过，节省性能
                if (line.indexOf("SystemServerTiming") === -1 || line.indexOf("took to complete:") === -1) {
                    return null;
                }

                // 2. 正则提取
                const match = line.match(this._regex);
                if (!match) return null;

                const serviceName = match[1].trim(); // 提取服务名，例如 StartPackageManagerService
                const duration = parseInt(match[2]); // 提取耗时，例如 1037

                if (Number.isNaN(duration)) return null;

                // =============================================
                // 3. 行业经验阈值配置 (核心逻辑)
                // =============================================

                // A. 特权白名单：允许耗时较长的重型服务
                if (serviceName.includes("PackageManagerService")) {
                    // PMS 只有超过 2秒才警告，超过 5秒才报错
                    if (duration >= 5000) {
                        return { severity: 'error', message: `🛑 **PMS严重超时** (${serviceName})\n耗时: ${duration}ms (阈值: 5000ms)` };
                    }
                    if (duration >= 2000) {
                        return { severity: 'warning', message: `⚠️ **PMS偏慢** (${serviceName})\n耗时: ${duration}ms` };
                    }
                    return null; // 2秒以内对 PMS 来说是正常的
                }

                // B. 初始化阶段 & 批量阶段 (Init, Phase...)
                if (serviceName.startsWith("Init") || serviceName.startsWith("Phase")) {
                    // 这些阶段通常包含多个操作，阈值放宽到 500ms
                    if (duration >= 1000) {
                        return { severity: 'error', message: `🛑 **启动阶段严重阻塞** (${serviceName})\n耗时: ${duration}ms` };
                    }
                    if (duration >= 300) {
                        return { severity: 'warning', message: `⚠️ **启动阶段耗时** (${serviceName})\n耗时: ${duration}ms` };
                    }
                    return null;
                }

                // C. 普通服务 (Standard Services)
                // 对于普通服务，标准要严苛得多
                // > 500ms: 严重 (Error)
                // > 100ms: 警告 (Warning)
                // > 50ms:  关注 (Info/Warning, 可选)

                if (duration >= 500) {
                    return {
                        severity: 'error',
                        message: `🛑 **严重卡顿服务**: ${serviceName}\n⏱️ 耗时: ${duration}ms (标准应 <100ms)`
                    };
                }

                if (duration >= 100) {
                    return {
                        severity: 'warning',
                        message: `⚠️ **耗时服务警告**: ${serviceName}\n⏱️ 耗时: ${duration}ms`
                    };
                }

                return null;
            }
        }

    ],

    /**
     * 执行分析
     */
    run: function (model) {
        if (!model) return;

        const lineCount = model.getLineCount();
        const errorDecorations = [];
        const warningDecorations = [];

        // 遍历每一行
        for (let i = 1; i <= lineCount; i++) {
            const lineContent = model.getLineContent(i);

            // 遍历每个规则，将整行内容传给规则
            for (const rule of this.rules) {
                // 🔥 核心改动：直接调用 rule.scan()
                const result = rule.scan(lineContent);

                // 如果规则返回了结果对象 (非 null)
                if (result) {
                    const decoration = {
                        range: new monaco.Range(i, 3, i, lineContent.length),
                        options: {
                            isWholeLine: true,
                            className: result.severity === 'error' ? 'log-decoration-error' : 'log-decoration-warning',
                            glyphMarginClassName: result.severity === 'error' ? 'log-glyph-error' : 'log-glyph-warning',
                            hoverMessage: {
                                value: result.message
                            }
                        }
                    };
                    
                    if (result.severity === 'error') {
                        errorDecorations.push(decoration);
                    } else {
                        warningDecorations.push(decoration);
                    }
                    // 匹配到一个规则后跳出，避免同一行被多次标记 (可根据需求去掉 break)
                    break;
                }
            }
        }

        return {
            errorCount: errorDecorations.length,
            warningCount: warningDecorations.length,
            totalCount: errorDecorations.length + warningDecorations.length,
            errorDecorations: errorDecorations,
            warningDecorations: warningDecorations,
            decorations: errorDecorations.concat(warningDecorations) // 向后兼容
        };
    },

    clear: function (editor) {
    }
};
