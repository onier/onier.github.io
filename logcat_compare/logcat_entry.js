/**
 * 定义日志条目类
 * @class LogcatEntry
 * @constructor
 * @param {Object} line - 日志行
 * @param {string} lineNumber   - 日志行号 
 * 10-31 00:51:24.984 E/Diag-Router( 965): diag: failed to create control node for slate_adsp
 * timestamp          level/tag(pid)   : title:message
 * @description 日志条目类用于表示日志文件中的单个日志条目，包含日志的各个组成部分。
 */

class LogcatEntry {
    constructor(line, lineNumber) {
        // 日志行
        this.line = line;
        // 日志行号
        this.lineNumber = lineNumber;
        // 日志标签
        this.tag = '';
        // 日志时间,原始时间，包含跳变时间
        this.timestamp = '';
        // 日志级别
        this.level = '';
        // 日志进程ID
        this.pid = -1;
        this.uid = -1;
        // message的头
        this.title = '';
        // 日志消息
        this.message = '';
        //当前log条目相对于进程启动时间的运行时间
        this.processRunningTime = 0;
        //进程启动时间,绝对时间可能是错位时间
        this.processStartTime = 0;
        //当前log条目相对于系统启动时间的运行时间
        this.logTimeFromBaseTime = 0;
        //从开机过去的时间，单位ms 
        this.logTimeFromBaseTimeGap = 0;
        // 标志位,false表示包含时间的日志条目,true表示不包含时间的日志条目
        this.isFlag = false;
        this.rawLine = '';
    }
}
/**
 * 定义日志条目解析器类
 * @class LogcatEntryParser
 * @constructor
 */
class LogcatEntryParser {
    constructor() {
    }
    parseLogTime(timeStr, baseYear = new Date().getFullYear()) {
        return new Date(`2025-${timeStr.replace(' ', 'T')}`);
    }

    checkAcherTime(ancherTimers, time) {
        for (let i = 0; i < ancherTimers.length; i++) {
            let diffMs = this.parseLogTime(ancherTimers[i].timer_line.substr(0, 18)) - time;
            if (Math.abs(diffMs) < 1000 * 60 * 60) {
                return false;
            }
        }
        return true;
    }

    calculateLogcatEntryTimeByAncherTime(ancherTimers, time) {
        for (let i = 0; i < ancherTimers.length; i++) {
            let baseTime = this.parseLogTime(ancherTimers[i].base_line.substr(0, 18));
            let timerTime = this.parseLogTime(ancherTimers[i].timer_line.substr(0, 18));
            if (Math.abs(timerTime - time) < 1000 * 60 * 60) {
                return {
                    base: baseTime,
                    diff: time - timerTime
                };
            }
        }
        throw new Error("no ancher time");
    }

    add(date, num, unit = 'day') {
        const d = new Date(date); // 复制一份
        switch (unit) {
            case 'year': d.setFullYear(d.getFullYear() + num); break;
            case 'month': d.setMonth(d.getMonth() + num); break;
            case 'day': d.setDate(d.getDate() + num); break;
            case 'hour': d.setHours(d.getHours() + num); break;
            case 'minute': d.setMinutes(d.getMinutes() + num); break;
            case 'second': d.setSeconds(d.getSeconds() + num); break;
            case 'ms': d.setMilliseconds(d.getMilliseconds() + num); break;
            default: throw new Error('unit 不支持');
        }
        return d;
    }

    /**
    * 检测时间戳，当突变时间超过一个小时就把这个时刻定义为锚点时间，作为后续计算时间跳跃的参考
    */
    calculateLogcatEntryAncherTime(allEntries) {
        let ancherTimers = [];
        let date0 = this.parseLogTime(allEntries[0].line.substr(0, 18));
        ancherTimers.push({
            base_line: allEntries[0].line,
            timer_line: allEntries[0].line
        });
        for (let i = 1; i < allEntries.length; i++) {
            if (allEntries[i].isFlag) {
                continue;
            }
            let date1 = this.parseLogTime(allEntries[i].line.substr(0, 18));
            if (this.checkAcherTime(ancherTimers, date1)) {
                if (allEntries[i - 1].isFlag) { // 忽略flag true，这种行没有日志时间
                    ancherTimers.push({
                        base_line: allEntries[i - 2].line,
                        timer_line: allEntries[i].line,
                    });
                } else {
                    ancherTimers.push({
                        base_line: allEntries[i - 1].line,
                        timer_line: allEntries[i].line,
                    });
                }
            }
        }
        return ancherTimers;
    }
    calculateLogcatEntryTimeFromBaseTime(entry, archerTimes) {
        let begin = archerTimes[0].base_line;

    }

    getLocatFormatType(line) {
        try {
            //01-01 08:47:05.452 I/        (    0): Booting Linux on physical CPU 0x0000000000  type 1
            //01-03 15:18:15.876     0     0 I         : Booting Linux on physical CPU 0x0000000000 type 2
            let n1 = line.indexOf("(");
            let n2 = line.indexOf(")");
            if (n1 > 0 && n2 > 0) {
                return 1;
            } else {
                return 2;
            }
        } catch (error) {
            return 3;
        }
    }

    parse(filename, rawLines) {
        let logcatEntrys = [];
        let lines = rawLines.split('\n');
        console.log(`开始解析 ${filename}，共 ${lines.length} 行日志`);
        let outLines = this.filterOuttime(lines);
        lines = outLines.lines;
        let origlines = outLines.origlines;
        console.log(`过滤后有效 ${lines.length} 行日志`);
        let parsedCount = 0;
        let type = this.getLocatFormatType(lines[0]);
        for (let i = 0; i < lines.length; i++) {
            const entry = this.parseLine(lines[i], i, type);
            entry.rawLine = origlines[i];
            if (entry && entry.timestamp) {
                logcatEntrys.push(entry);
                parsedCount++;
            } else {
                entry.isFlag = true;
                logcatEntrys.push(entry);
            }
        }
        let archerTimes = this.calculateLogcatEntryAncherTime(logcatEntrys);
        console.log('parsedCount', parsedCount);
        console.log('archerTimes', JSON.stringify(archerTimes));
        let pids = new Set();
        for (let i = 1; i < logcatEntrys.length; i++) {
            pids.add(logcatEntrys[i].pid);
        }
        console.log('pids', pids.size);

        pids.forEach(pid => {
            let entries = logcatEntrys.filter(entry => entry.pid == pid && !entry.isFlag);
            entries.forEach(entry => {
                let tempDate = this.parseLogTime(entry.line.substr(0, 18));
                if (tempDate != "Invalid Date") {
                    let result = this.calculateLogcatEntryTimeByAncherTime(archerTimes, this.parseLogTime(entry.line.substr(0, 18)));
                    entry.processRunningTime = result.diff;
                    entry.processStartTime = result.base;
                    entry.logTimeFromBaseTime = this.add(entry.processStartTime, entry.processRunningTime, "ms");
                    // console.log(entry.logTimeFromBaseTime, entry.processStartTime, entry.processRunningTime, entry.line);
                }
            });
        });
        logcatEntrys.filter(entry => entry.isFlag == false).forEach(entry => {
            entry.logTimeFromBaseTimeGap = entry.logTimeFromBaseTime - logcatEntrys[0].logTimeFromBaseTime;
        });
        // pids.forEach(pid => {
        //     let entries = logcatEntrys.filter(entry => entry.pid == pid);
        //     let pidTxt = "pid: " + pid + "  " + entries[0].tag + "  " + entries[0].processStartTime;
        //     console.log(pidTxt);
        // });
        return logcatEntrys;
    }
    parseHeader(header, entry) {
        entry.timestamp = header.substring(0, 18).trim();
        let substr = header.substring(19).trim();
        entry.level = substr.substring(0, 1);
        let pidStart = substr.indexOf('(');
        let pidEnd = substr.indexOf(')');
        if (pidStart !== -1 && pidEnd !== -1 && pidEnd > pidStart) {
            entry.tag = substr.substring(2, pidStart).trim();
            let pidStr = substr.substring(pidStart + 1, pidEnd).trim();
            const num = parseInt(pidStr);
            if (Number.isNaN(num)) {
                let n1 = header.lastIndexOf('(');
                let n2 = header.lastIndexOf(')');
                if (n1 !== -1 && n2 !== -1 && n2 > n1) {
                    pidStr = header.substring(n1 + 1, n2).trim();
                    entry.pid = parseInt(pidStr);
                } else {
                    console.error(` pidStr is not number ${pidStr}`);
                }
            } else {
                entry.pid = parseInt(pidStr);
            }
        } else {
            entry.tag = substr.substring(2).trim();
        }
        // [kworke][0x23679e6f][11:10:01.809492] wlan
        if (entry.tag.startsWith("[kworke][") && entry.tag.endsWith("] wlan")) {
            entry.tag = "wlan";
        }
        //binder:747_3
        if (entry.tag.startsWith("binder:")) {
            entry.tag = "binder";
        }
        if (entry.tag.startsWith("[")) {
            entry.tag = entry.tag.substring(1, entry.tag.indexOf("]"));
        }
    }

    parseTail(tail, entry) {
        tail = tail.trim();
        // if(entry.tag === ""){
        entry.message = tail;
        // return; 
        // }
        // console.log(tail);
    }

    parseLine(line, lineNumber, type) {
        const entry = new LogcatEntry(line, lineNumber);
        if (!line || line.trim() === '') {
            return entry;
        }
        line = line.trim();
        if (type == 1) {
            if (line.includes("): ")) {
                //01-01 08:47:14.321 I/SELinux (  541): SELinux: Loaded service_contexts from
                let index = line.indexOf("): ");
                let header = line.substr(0, index + 1);
                this.parseHeader(header, entry);
                let tail = line.substr(index + 2);
                this.parseTail(tail, entry);
                return entry;
            } else {
                return entry;
            }
        } else {
            if (lineNumber == 40000) {
                console.log("lineNumber:", lineNumber);
            }
            //01-04 06:26:50.327     0     0 I         : Booting Linux on physical CPU 0x0000000000 [0x51af8014]
            entry.timestamp = line.substring(0, 18).trim();
            let temp = line.substring(19).trim();
            let tempIndex = temp.indexOf(' ');
            if (tempIndex == -1) {
                entry.isFlag = true;
                console.error("tempIndex == -1", lineNumber, line);
                return entry;
            }
            entry.pid = parseInt(temp.substring(0, tempIndex));
            temp = temp.trim().substring(tempIndex).trim();
            tempIndex = temp.indexOf(' ');
            if (tempIndex == -1) {
                entry.isFlag = true;
                console.error("tempIndex == -1", lineNumber, line);
                return entry;
            }
            entry.uid = parseInt(temp.substring(0, tempIndex));
            temp = temp.trim().substring(tempIndex).trim();
            tempIndex = temp.indexOf(' ');
            if (tempIndex == -1) {
                entry.isFlag = true;
                console.error("tempIndex == -1", lineNumber, line);
                return entry;
            }
            entry.level = temp.substring(0, tempIndex).trim();
            temp = temp.trim().substring(tempIndex).trim();
            tempIndex = temp.indexOf(':');
            if (tempIndex == -1) {
                entry.isFlag = true;
                console.error("tempIndex == -1", lineNumber, line);
                return entry;
            }
            entry.tag = temp.substring(0, tempIndex).trim();
            entry.message = temp.trim().substring(tempIndex + 1).trim();
            return entry;
        }

    }

    parseMordenLogLine(line, lineNumber) {

    }
    findLinuxBootLogLine(rawLines) {
        let bootLogInfo = "Booting Linux on physical CPU";
        for (let i = 0; i < rawLines.length; i++) {
            if (rawLines[i].includes(bootLogInfo)) {
                return i;
            }
        }
        return 0;
    }

    filterOuttime(rawLines) {
        let lines = [];
        let origlines = [];
        let i = this.findLinuxBootLogLine(rawLines);
        if (i >= 0) {
            for (let j = i; j < rawLines.length; j++) {
                lines.push(this.filterTimeDiff(rawLines[j]));
                origlines.push(rawLines[j]);
            }
        } else {
            console.error("Cannot find Linux boot log line.");
        }
        return {
            lines: lines,
            origlines: origlines
        };
    }

    filterTimeDiff(rawLine) {
        let prefixHeader = "- b", prefixTail = "\\r\\n'";
        let start = rawLine.indexOf(prefixHeader);
        if (start === -1) {
            return rawLine;
        }
        let newLine = rawLine.substring(start + 4, rawLine.length - 5);
        return newLine;
    }
}
