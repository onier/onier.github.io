class LogcatManager {
    constructor() {
        this.logcatEntryMap = {};
        this.logcatWarningMap = {};
        this.logcatStageMap = {};
        this.logcatEntryParser = new LogcatEntryParser();
        this.stageDetector = new StageDetector();
        this.fileUtils = new FileUtils();
        this.logcatScanner = new LogcatScanner();
    }

    addLogcatEntry(file, content, fileSize = 0) {
        let logcatEntrys = this.logcatEntryParser.parse(file, content);
        this.logcatEntryMap[file] = logcatEntrys;
        let stages = this.stageDetector.detectStages(logcatEntrys);
        
        // 新的 logcatScanner.scanLogEntries 直接返回 warninfo 数组
        let warninfo = this.logcatScanner.scanLogEntries(logcatEntrys);
        
        this.logcatWarningMap[file] = warninfo;
        this.logcatStageMap[file] = stages;
        window.fileAnalysisManager.addFileData(file, fileSize, stages, warninfo);
        return { logcatEntrys, stages };
    }

    parseAndroidLogTime(timeStr, year = new Date().getFullYear()) {
        const [datePart, timePart] = timeStr.split(' ');
        const [month, day] = datePart.split('-').map(Number);
        const [hour, minute, secondAndMs] = timePart.split(':');
        const [second, millisecond] = secondAndMs.split('.').map(Number);
        return new Date(year, month - 1, day, hour, minute, second, millisecond);
    }

    processLogcatEntryTimeByPid(pid, entries) {
        if (entries.length === 0) {
            return;
        }
        for (let i = 1; i < entries.length; i++) {
            if (entries[i].pid != pid) {
                console.error(`processLogcatEntryTimeByPid pid 不匹配 ${pid} != ${entries[i].pid}`);
                continue;
            }
            let date0 = this.parseAndroidLogTime(entries[i - 1].line.substr(0, 18));
            let date1 = this.parseAndroidLogTime(entries[i].line.substr(0, 18));
            let diffMs = date1 - date0;
            if (diffMs > 1000) {
                console.log(`processLogcatEntryTimeByPid  ${entries[i - 1].lineNumber} \n ${entries[i].lineNumber} \n ${diffMs}`);
            }
        }
    }
}
