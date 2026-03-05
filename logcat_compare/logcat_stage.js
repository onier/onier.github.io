class StageDetector {
    constructor(parser) {
    }

    checkStateKeyword(line, keywords) {
        let temp = line.toLowerCase();
        for (let i = 0; i < keywords.length; i++) {
            if (temp.includes(keywords[i].toLowerCase())) {
                continue;
            } else {
                return false;
            }
        }
        return true;
    }

    getStageTime(startIndex, endIndex, logcatEntrys) {
        // let time = 0;
        // for (let i = startIndex; i <= endIndex; i++) {
        //     time = time + (logcatEntrys[i].gapDiff);
        // }
        // console.log("getStageTime", logcatEntrys[endIndex].logTimeFromBaseTime - logcatEntrys[startIndex].logTimeFromBaseTime);
        // console.log("getStageTime", logcatEntrys[endIndex].line, logcatEntrys[startIndex].line);
        return logcatEntrys[endIndex].logTimeFromBaseTime - logcatEntrys[startIndex].logTimeFromBaseTime;
    }

    detectStages(logcatEntrys) {
        let stages = [
            {
                keyword: ['Booting Linux on physical'],
                name: 'Linux version',
                stage: '内核启动',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['init first stage'],
                name: 'init first stage',
                stage: 'Init阶段',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['Entered the Android system server'],
                name: 'Entered the Android system server',
                stage: '框架入口',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['memory class'],
                name: 'Activity manager is running',
                stage: 'AMS运行',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['boot_progress_pms_start'],
                name: 'boot_progress_pms_start',
                stage: 'PMS扫描开始',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['adbd restarting as root'],
                name: 'adbd restarting as root',
                stage: 'adbd root',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['boot_progress_pms_ready'],
                name: 'boot_progress_pms_ready',
                stage: 'PMS扫描完成',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['connection with lmkd established'],
                name: 'connection with lmkd established',
                stage: 'LMKD连接',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['wm_boot_animation_done'],
                name: 'wm_boot_animation_done',
                stage: '动画完成',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['boot_progress_ams_ready'],
                name: 'boot_progress_ams_ready',
                stage: 'AMS就绪',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['making services ready'],
                name: 'making services ready',
                stage: '服务就绪',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['START u0', 'cmp=com.android.settings/.FallbackHome'],
                name: 'START u0 ...cmp=com.android.settings/.FallbackHome',
                stage: '桌面启动',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['boot_completed=1',"init"],
                name: 'BOOT_COMPLETED',
                stage: '启动完成',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['com.android.settings.FallbackHome', 'Window became focusable'],
                name: 'FallbackHome获取焦点',
                stage: 'FallbackHome获取焦点',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['ImmersiveModeConfirmation', 'Window became focusable'],
                name: 'ImmersiveModeConfirmation获取焦点',
                stage: 'ImmersiveModeConfirmation获取焦点',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
             {
                keyword: ['QuickstepLauncher', 'Window became focusable'],
                name: 'QuickstepLauncher获取焦点',
                stage: 'QuickstepLauncher获取焦点',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
            {
                keyword: ['do_shutdown'],
                name: 'do_shutdown',
                stage: '关机',
                startIndex: 0,
                endIndex: 0,
                time: 0
            },
        ];
        console.log('开始检测阶段' + logcatEntrys.length);
        for (let i = 0; i < stages.length; i++) {
            for (let j = 0; j < logcatEntrys.length; j++) {
                if (this.checkStateKeyword(logcatEntrys[j].line, stages[i].keyword)) {
                    stages[i].startIndex = j;
                    break;
                }
            }
        }

        for (let i = 1; i < stages.length; i++) {
            // stages[i].time = this.getStageTime(stages[i - 1].startIndex, stages[i].startIndex, logcatEntrys);
            stages[i].time = logcatEntrys[stages[i].startIndex].logTimeFromBaseTimeGap;
        }

        return stages;
    }

}