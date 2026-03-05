const editors = [];
var activeFileTargetIndex = -1;
var filesMap = [];
const BOOT_KEYWORDS = [
    ['Booting Linux on physical'],
    ["SMP", "Total of", "processors", "activated"],  //多核启动
    ["Run /init as init process"],//用户空间切换
    ["Loading module"],//模块加载
    ["console", "enabled"],//串口就绪
    ["Enhanced", 'MMC card'],//存储识别
    ["Wait for partitions returned"],//挂载
    ["mount", "metadata", "block"],//成功挂载 Metadata 分区
    ["Loading SELinux policy"],//安全加载
    ["init second stage started"],//Init 进程进入第二阶段，开始解析 init.rc 脚本。
    ["ueventd started!"],//ueventd 开始处理设备事件，创建 /dev 下的节点。
    ["Bootstrap subcommand detected", "apexd"],//APEX 引导：Android APEX 包管理服务启动，准备挂载系统组件。
    ["Successfully bind display panel"],//显示驱动完成握手，屏幕即将显示开机动画。
    ["Starting sm instance on"],//ServiceManager 启动：Android 的“交通枢纽”启动，标志着 Binder 机制就绪。
    ["Starting", "keymint-service-qti service"],//硬件密钥库服务启动，用于解密用户数据。
    ["Vold", "firing up"],//Vold 启动
    ["Validating", "checkpoint", "userdata", "block"],//检查用户分区状态
    ["Registered GPU CC clocks"],
    ["cont_splash enabled in"],
    ["Registered thermal governor"],
    ["using governor"],
    ["rate limit exceeded"],
    ['boot_progress_start'],
    ["AndroidRuntime", "ZygoteInit", "uid 0"],//Zygote 初始化完成，开始 fork 系统服务进程。
    ["SurfaceFlinger", "Connecting display"],//SurfaceFlinger（图层混合器）连接到了主显示屏，准备开始绘图
    ["SurfaceFlinger", "Enter boot animation"],//SurfaceFlinger 准备好渲染开机动画。
    ["BootAnimation", "BootAnimationStartTiming start time"],//开机动画正式开始播放的时间点。这是用户感知“手机正在开机”的重要时刻。
    ["audioserver", "AudioFlinger created"],//Android 音频核心服务启动。
    ["HidlServiceManagement", "Registered ", "vendor.qti.hardware.AGMIPC"],//高通 AGM (Audio Graph Manager) 服务注册，这是音频路由管理的核心
    ["AudioFlinger", "Loaded primary audio interface"],//主音频硬件接口（HAL）加载完成，系统具备了发声能力（如开机音效）
    ["RILD", "RIL Daemon Started"],//RIL (Radio Interface Layer) 守护进程启动，负责 Android 与 Modem 的通信。
    ["imsd", "IMS Daemon Main:Started"],//IMS 服务启动，负责 VoLTE 和 VoWiFi 功能。
    ["adbd started"],//ADB 调试守护进程启动。
    ["USB event", "FUNCTIONFS_BIND"],//USB 接口绑定完成，此时电脑可以识别到 ADB 设备。

    ['boot_progress_preload_start'],
    ["init first stage started"],
    ["init second stage started!"],
    ["Forked child process"],//Zygote 启动 (孵化器)
    ["SystemServerTimingAsync", "took to complete"],
    ["Mounted with checkpoint version"],
    ["mounted filesystem"],
    ["Added device: zram0"],
    ["qcom_system_heap_create"],//如果这些 Heap 创建失败，会导致黑屏或相机无法启动。
    ["am_meminfo"],//内存压力 Cached free zram kernel buffer 
    ["am_pss"],//I/am_pss  ( 2095): [pid, uid, 包名, PSS, USS, RSS, SwapPss, ?, ?, ?]
    ['boot_progress_preload_end'],
    ["zygote64", "Background verification of"],//类校验耗时: 
    ["zygote", "Background verification of"],//类校验耗时: 
    ["ZygoteInit took to complete"],
    ["BeginPreload took to complete"],//预加载总耗时:
    ["Explicit concurrent copying GC"],//系统在初始化过程中主动触发了 GC。
    ["wait_for_completion_timeout"],
    ["registry_sensor availability time"],


    ['boot_progress_system_run'],
    ["SystemServerTiming", "InitBeforeStartServices took to"],//
    ["adbd restarting"],
    ["USB_STATE=DISCONNECTED"],
    ["WLAN FW is ready"],

    ['boot_progress_pms_start'],
    ["PackageManagerTiming"],

    ['boot_progress_pms_system_scan_start'],
    ['boot_progress_pms_data_scan_start'],
    ['boot_progress_pms_ready'],
    ['boot_progress_ams_ready'],
    ['boot_progress_enable_screen'],
    ['sf_stop_bootanim'],
    ['wm_boot_animation_done'],
    ['ActivityManager: Displayed'],
    ['boot_completed=1']
];

function checkKeyword(line, keys) {
    for (let i = 0; i < keys.length; i++) {
        if (!line.includes(keys[i].toLowerCase())) {
            return false;
        }
    }
    return true;
}

function checkKeyWords(lineContent) {
    for (let i = 0; i < BOOT_KEYWORDS.length; i++) {
        if (checkKeyword(lineContent, BOOT_KEYWORDS[i])) {
            if (BOOT_KEYWORDS[i][0] == "SystemServerTimingAsync") {
                let timestr = lineContent.substring(lineContent.lastIndexOf(":") + 1, (lineContent.lastIndexOf("ms"))).trim()
                let time = parseInt(timestr);
                if (!Number.isNaN(time)) {
                    if (time > 100) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
            return true;
        }
    }
    return false;
}

function parseLogDate(logLine) {
    // 1. 安全性检查：长度不够直接返回 null
    if (!logLine || logLine.length < 15) {
        return null;
    }

    // --- 情况 A: 2025-10-22 13:04:50 ---
    // 特征：第5个字符是 '-' (索引4) 且 第8个字符是 '-' (索引7)
    if (logLine.charAt(4) === '-' && logLine.charAt(7) === '-') {
        // 直接切片提取数字 (注意：JS中月份是 0-11，所以要减 1)
        const year = parseInt(logLine.substring(0, 4));
        const month = parseInt(logLine.substring(5, 7)) - 1;
        const day = parseInt(logLine.substring(8, 10));
        const hour = parseInt(logLine.substring(11, 13));
        const min = parseInt(logLine.substring(14, 16));
        const sec = parseInt(logLine.substring(17, 19));

        // 使用本地时间构造 Date 对象
        return new Date(year, month, day, hour, min, sec);
    }

    // --- 情况 B: 01-01 01:06:33.986 ---
    // 特征：第3个字符是 '-' (索引2) 且 第6个字符是 ' ' (索引5)
    if (logLine.charAt(2) === '-' && logLine.charAt(5) === ' ') {
        // 这种格式缺少年份，通常默认使用【当前年份】
        const year = new Date().getFullYear();

        const month = parseInt(logLine.substring(0, 2)) - 1;
        const day = parseInt(logLine.substring(3, 5));
        const hour = parseInt(logLine.substring(6, 8));
        const min = parseInt(logLine.substring(9, 11));
        const sec = parseInt(logLine.substring(12, 14));
        const ms = parseInt(logLine.substring(15, 18)); // 提取毫秒

        return new Date(year, month, day, hour, min, sec, ms);
    }

    return null; // 未知格式
}

//判断是新的突变时间还是属于已有突变时间范围（一小时以内）
function checkShiftTimes(date, timeShifts) {
    for (let i = 0; i < timeShifts.length; i++) {
        const shift = timeShifts[i];
        let diff = Math.abs(date - shift.shiftTime);
        if (diff < 1000 * 60 * 30) {
            return false;
        }
    }
    return true;
}

function getLastShitTime(lineTimes, index) {
    for (let i = index; i >= 0; i--) {
        if (!lineTimes[i].isShift) {
            return lineTimes[i].currentTime;
        }
    }
    return null;
}

function calculateCalibrateLineTime(date, shiftTimes) {
    for (let i = 0; i < shiftTimes.length; i++) {
        let diff = Math.abs(date - shiftTimes[i].shiftTime);
        if (Math.abs(diff) < 1000 * 60 * 30) {
            let milliseconds = date - shiftTimes[i].shiftTime;
            return new Date(shiftTimes[i].base.getTime() + milliseconds);
        }
    }
    return date;
}

function recalibrateTime(lineTimes, shiftTimes) {
    for (let i = 0; i < lineTimes.length; i++) {
        lineTimes[i].currentTime = calculateCalibrateLineTime(lineTimes[i].currentTime, shiftTimes);
    }
}

function getTimeByLine(lineTimes, lineNum) {
    for (let i = 0; i < lineTimes.length; i++) {
        if (lineTimes[i].lineNum === lineNum) {
            return lineTimes[i];
        }
    }
    return null;
}

function calculatelineTime(model) {
    let lineTimes = [];
    const count = model.getLineCount();
    for (let i = 1; i <= count; i++) {
        const lineContent = model.getLineContent(i);
        const currentTime = parseLogDate(lineContent);
        if (currentTime !== null) {
            lineTimes.push({
                lineNum: i,
                currentTime: currentTime,
                isShift: false
            });
        }
    }
    if (lineTimes.length < 2) {
        return [];
    }
    let timeShifts = [];
    timeShifts.push({
        lineNum: 0,//行号
        base: lineTimes[0].currentTime,//基础时间
        shiftTime: lineTimes[0].currentTime //突变原始时间
    });
    for (let i = 1; i < lineTimes.length; i++) {
        if (Math.abs(lineTimes[i].currentTime - lineTimes[i - 1].currentTime) > 1000 * 60 * 30) {
            // console.log('time may shift', lineTimes[i].lineNum);
            if (checkShiftTimes(lineTimes[i].currentTime, timeShifts)) {
                lineTimes[i].isShift = true;
                timeShifts.push({
                    lineNum: i,//行号
                    base: getLastShitTime(lineTimes, i),//基础时间
                    shiftTime: lineTimes[i].currentTime //突变原始时间
                });
            }
        }
    }
    recalibrateTime(lineTimes, timeShifts);
    console.log('timeShifts', timeShifts);
    console.log('lineTimes', lineTimes);
    return lineTimes
}
