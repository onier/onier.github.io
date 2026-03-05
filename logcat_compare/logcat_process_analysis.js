class ProcessAnalysis {
    constructor(logcatData) {

    }

    buildProcessMap(logcatEntrys, startIndex, endIndex) {
        let processMap = new Map();
        for (let i = startIndex; i <= endIndex; i++) {
            let entry = logcatEntrys[i];
            if (!processMap.has(entry.tag)) {
                processMap.set(entry.tag, []);
            }
            processMap.get(entry.tag).push(entry);
        }
        return processMap;
    }

    calculateProcessAnalysisTagDifference(processMap1, processMap2) {
        let map1_not_found_in_map2 = [];
        let map2_not_found_in_map1 = [];
        
        // 获取所有tag
        const tags1 = Array.from(processMap1.keys());
        const tags2 = Array.from(processMap2.keys());
        
        for (let tag of tags1) {
            if (!processMap2.has(tag)) {
                map1_not_found_in_map2.push(tag);
            }
        }

        for (let tag of tags2) {
            if (!processMap1.has(tag)) {
                map2_not_found_in_map1.push(tag);
            }
        }
        
        let tag_diff_map = new Map();
        for (let tag of tags1) {
            if (processMap2.has(tag)) {
                let entries1 = processMap1.get(tag);
                let entries2 = processMap2.get(tag);
                if (entries1.length == entries2.length) {
                    continue;
                }
                let diff = entries1.length - entries2.length;
                let diff_percent = entries1.length > 0 ? (diff / entries1.length) * 100 : 0;
                tag_diff_map.set(tag, {
                    diff: diff,
                    diff_percent: diff_percent,
                    count1: entries1.length,
                    count2: entries2.length
                });
            }
        }
        return {
            map1_not_found_in_map2: map1_not_found_in_map2,
            map2_not_found_in_map1: map2_not_found_in_map1,
            tag_diff_map: tag_diff_map
        };
    }

    calculateProcessAnalysis(file1, file2) {
        let file1Entry = window.logcatManager.logcatEntryMap[file1];
        let file2Entry = window.logcatManager.logcatEntryMap[file2];
        let file1Stages = window.logcatManager.logcatStageMap[file1];
        let file2Stages = window.logcatManager.logcatStageMap[file2];

        // 计算两个日志文件的进程分析数据
        let file1StartIndex = 0, file1EndIndex = file1Stages[file1Stages.length - 1].startIndex;
        let file2StartIndex = 0, file2EndIndex = file2Stages[file2Stages.length - 1].startIndex;

        let file1ProcessMap = this.buildProcessMap(file1Entry, file1StartIndex, file1EndIndex);
        let file2ProcessMap = this.buildProcessMap(file2Entry, file2StartIndex, file2EndIndex);
        let { map1_not_found_in_map2, map2_not_found_in_map1, tag_diff_map } = this.calculateProcessAnalysisTagDifference(file1ProcessMap, file2ProcessMap);

        console.log(`进程分析结果:`);
        console.log(`${file1} 中未在 ${file2} 中出现的进程: ${JSON.stringify(map1_not_found_in_map2)}`);
        console.log(`${file2} 中未在 ${file1} 中出现的进程: ${JSON.stringify(map2_not_found_in_map1)}`);
        console.log(`共有进程的日志条目差异:`, tag_diff_map);
        
        return {
            file1: file1,
            file2: file2,
            uniqueInFile1: map1_not_found_in_map2,
            uniqueInFile2: map2_not_found_in_map1,
            commonDifferences: tag_diff_map,
            processMap1: file1ProcessMap,
            processMap2: file2ProcessMap
        };
    }
}
