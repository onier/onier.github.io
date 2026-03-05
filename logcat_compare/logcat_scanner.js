class LogcatScanner {
    constructor() {
        this.batteryWarning = [];
        this.killerWarning = [];
    }
    //Slow operation: 4341ms so far, now at startProcess: done updating pids map
    scanSlowOperation(entries) {
        if (entries.message.trim().startsWith('Slow operation:')) {
            let str2 = entries.message.trim();
            let n = str2.substring(16, str2.indexOf("ms")).trim();
            if (!Number.isNaN(n)) {
                if (n > 3000) {
                    return {
                        type: "慢操作警告",
                        originalEntry: entries
                    };
                }
            }
        }
        return null;
    }

    scanI2CTXNTimeOUt(entries) {
        if (entries.message.trim().includes('I2C TXN timed out')) {
            return {
                type: "I2C TXN超时",
                originalEntry: entries
            };

        }
        return null;
    }

    scanLogEntries(entries) {
        this.batteryWarning = [];
        this.killerWarning = [];
        const warninfo = [];

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            let logcatWarn;
            // // 扫描进程被杀警告
            // logcatWarn = this.scanPorcessKiller(entry);
            // if (logcatWarn) {
            //     warninfo.push(logcatWarn);
            //     continue;
            // }
            // // 扫描 OpenGLRenderer 警告
            // logcatWarn = this.scanOpenGLRenderer(entry);
            // if (logcatWarn) {
            //     warninfo.push(logcatWarn);
            //     continue;
            // }
            // logcatWarn = this.scanChoreographer(entry);
            // if (logcatWarn) {
            //     warninfo.push(logcatWarn);
            //     continue;
            // }
            // logcatWarn = this.scanSlowOperation(entry);
            // if (logcatWarn) {
            //     warninfo.push(logcatWarn);
            //     continue;
            // }
            // 扫描电池警告
            logcatWarn = this.scanBattery(entry);
            if (logcatWarn) {
                warninfo.push(logcatWarn);
                continue;
            }
            logcatWarn = this.scanI2CTXNTimeOUt(entry);
            if (logcatWarn) {
                warninfo.push(logcatWarn);
                continue;
            }
        }
        return warninfo;
    }
    parseBatteryLog(str) {
        // 1. 去掉开头的 "battery " 标识，并按空格分割成数组
        const parts = str.replace(/^battery\s+/, '').split(/\s+/);
        // 2. 遍历数组，构建对象
        const data = parts.reduce((acc, part) => {
            // 确保这一项包含 '='
            if (part.includes('=')) {
                const [key, value] = part.split('=');

                // 3. 智能类型转换：如果是数字，转为 Number；否则保留字符串
                // 使用 isNaN 检查，注意 parseFloat 可以处理整数和浮点数
                const numVal = Number(value);
                acc[key] = isNaN(numVal) ? value : numVal;
            }
            return acc;
        }, {});
        return data;
    }
    scanOpenGLRenderer(entry) {
        if (entry.tag && entry.tag.trim().toLowerCase() === 'OpenGLRenderer'.toLowerCase()) {
            if (entry.message.startsWith('Davey')) {
                let str2 = entry.message.trim();
                let n = str2.substring(16, str2.indexOf("ms"));
                if (!Number.isNaN(n)) {
                    if (n > 700) {
                        return {
                            type: "OpenGLRenderer 警告",
                            originalEntry: entry
                        };
                    }
                }
            }
        }
        return null;
    }

    //Skipped 55 frames!
    scanChoreographer(entry) {
        if (entry.tag && entry.tag.trim().toLowerCase() === 'choreographer') {
            let n = parseInt(entry.message.substring(8, entry.message.indexOf("frames")).trim());
            if (!Number.isNaN(n)) {
                if (n > 29) {
                    return {
                        type: "Choreographer 警告",
                        originalEntry: entry
                    };
                }
            }

        }
        return null;
    }

    scanPorcessKiller(entry) {
        if (entry.message.toLowerCase().includes('successfully killed')) {
            this.killerWarning.push(entry);
            console.warn("Process Killer Warning:", entry.line);
            // 返回标准化的 warninfo 对象
            return {
                type: "杀进程警告",
                originalEntry: entry
            };
        }
        return null;
    }

    // battery l=3 v=3656 t=25.1 h=2 st=2 c=-349121 fc=3581000 cc=0 chg=u
    scanBattery(entry) {
        // 修复 bug: toLowerCase 应该是函数调用
        if (entry.tag && entry.tag.trim().toLowerCase() === 'healthd') {
            const battery = this.parseBatteryLog(entry.message);
            if (battery && battery.hasOwnProperty('l')) {
                if (battery.l <= 20) {
                    console.warn("Battery Warning:", entry.line);
                    this.batteryWarning.push(entry);
                    return {
                        type: "电池电量警告",
                        originalEntry: entry,
                    };
                }
            }
        }
        return null;
    }
}
