/**
 * 日志时间工具类
 * 提供日志时间字符串与Date对象之间的转换，以及时间计算功能
 * 日志时间格式: "MM-DD HH:MM:SS.mmm" (例如: "10-31 00:51:24.984")
 */

class LogTimeUtils {
    /**
     * 将日志时间字符串转换为Date对象
     * @param {string} timeStr - 日志时间字符串，格式: "MM-DD HH:MM:SS.mmm"
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {Date} 对应的Date对象，如果解析失败返回null
     */
    static parseLogTime(timeStr, baseYear = new Date().getFullYear()) {
        if (!timeStr || typeof timeStr !== 'string') {
            return null;
        }
        
        // 正则匹配日志时间格式: "MM-DD HH:MM:SS.mmm"
        const pattern = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
        const match = timeStr.match(pattern);
        
        if (!match) {
            // 尝试匹配6位毫秒的格式
            const pattern6 = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{6})$/;
            const match6 = timeStr.match(pattern6);
            if (!match6) {
                return null;
            }
            
            const [, month, day, hours, minutes, seconds, milliseconds6] = match6;
            // 将6位毫秒转换为3位毫秒（取前3位）
            const milliseconds = parseInt(milliseconds6.substring(0, 3));
            
            return new Date(
                baseYear,
                parseInt(month) - 1, // 月份从0开始
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds),
                milliseconds
            );
        }
        
        const [, month, day, hours, minutes, seconds, milliseconds] = match;
        
        return new Date(
            baseYear,
            parseInt(month) - 1, // 月份从0开始
            parseInt(day),
            parseInt(hours),
            parseInt(minutes),
            parseInt(seconds),
            parseInt(milliseconds)
        );
    }
    
    /**
     * 将Date对象转换为日志时间字符串
     * @param {Date} date - Date对象
     * @returns {string} 日志时间字符串，格式: "MM-DD HH:MM:SS.mmm"
     */
    static formatLogTime(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return '';
        }
        
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        
        return `${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
    
    /**
     * 给日志时间字符串增加指定的毫秒数
     * @param {string} timeStr - 原始日志时间字符串
     * @param {number} millisecondsToAdd - 要增加的毫秒数
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {string} 增加毫秒后的日志时间字符串
     */
    static addMilliseconds(timeStr, millisecondsToAdd, baseYear = new Date().getFullYear()) {
        const date = this.parseLogTime(timeStr, baseYear);
        if (!date) {
            return timeStr;
        }
        
        const newDate = new Date(date.getTime() + millisecondsToAdd);
        return this.formatLogTime(newDate);
    }
    
    /**
     * 给日志时间字符串增加指定的秒数
     * @param {string} timeStr - 原始日志时间字符串
     * @param {number} secondsToAdd - 要增加的秒数
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {string} 增加秒数后的日志时间字符串
     */
    static addSeconds(timeStr, secondsToAdd, baseYear = new Date().getFullYear()) {
        return this.addMilliseconds(timeStr, secondsToAdd * 1000, baseYear);
    }
    
    /**
     * 给日志时间字符串增加指定的分钟数
     * @param {string} timeStr - 原始日志时间字符串
     * @param {number} minutesToAdd - 要增加的分钟数
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {string} 增加分钟数后的日志时间字符串
     */
    static addMinutes(timeStr, minutesToAdd, baseYear = new Date().getFullYear()) {
        return this.addSeconds(timeStr, minutesToAdd * 60, baseYear);
    }
    
    /**
     * 给日志时间字符串增加指定的小时数
     * @param {string} timeStr - 原始日志时间字符串
     * @param {number} hoursToAdd - 要增加的小时数
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {string} 增加小时数后的日志时间字符串
     */
    static addHours(timeStr, hoursToAdd, baseYear = new Date().getFullYear()) {
        return this.addMinutes(timeStr, hoursToAdd * 60, baseYear);
    }
    
    /**
     * 计算两个日志时间字符串之间的时间差（毫秒）
     * @param {string} timeStr1 - 第一个日志时间字符串
     * @param {string} timeStr2 - 第二个日志时间字符串
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {number} 时间差（毫秒），timeStr2 - timeStr1
     */
    static timeDifference(timeStr1, timeStr2, baseYear = new Date().getFullYear()) {
        const date1 = this.parseLogTime(timeStr1, baseYear);
        const date2 = this.parseLogTime(timeStr2, baseYear);
        
        if (!date1 || !date2) {
            return NaN;
        }
        
        return date2.getTime() - date1.getTime();
    }
    
    /**
     * 计算两个日志时间字符串之间的时间差（秒）
     * @param {string} timeStr1 - 第一个日志时间字符串
     * @param {string} timeStr2 - 第二个日志时间字符串
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {number} 时间差（秒），timeStr2 - timeStr1
     */
    static timeDifferenceSeconds(timeStr1, timeStr2, baseYear = new Date().getFullYear()) {
        const diffMs = this.timeDifference(timeStr1, timeStr2, baseYear);
        return isNaN(diffMs) ? NaN : diffMs / 1000;
    }
    
    /**
     * 计算两个日志时间字符串之间的时间差（分钟）
     * @param {string} timeStr1 - 第一个日志时间字符串
     * @param {string} timeStr2 - 第二个日志时间字符串
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {number} 时间差（分钟），timeStr2 - timeStr1
     */
    static timeDifferenceMinutes(timeStr1, timeStr2, baseYear = new Date().getFullYear()) {
        const diffSeconds = this.timeDifferenceSeconds(timeStr1, timeStr2, baseYear);
        return isNaN(diffSeconds) ? NaN : diffSeconds / 60;
    }
    
    /**
     * 计算两个日志时间字符串之间的时间差（小时）
     * @param {string} timeStr1 - 第一个日志时间字符串
     * @param {string} timeStr2 - 第二个日志时间字符串
     * @param {number} baseYear - 基准年份，默认为当前年份
     * @returns {number} 时间差（小时），timeStr2 - timeStr1
     */
    static timeDifferenceHours(timeStr1, timeStr2, baseYear = new Date().getFullYear()) {
        const diffMinutes = this.timeDifferenceMinutes(timeStr1, timeStr2, baseYear);
        return isNaN(diffMinutes) ? NaN : diffMinutes / 60;
    }
    
    /**
     * 格式化时间差为可读字符串
     * @param {number} milliseconds - 时间差（毫秒）
     * @returns {string} 格式化的时间差字符串，例如: "1天 02:30:15.500"
     */
    static formatTimeDifference(milliseconds) {
        if (isNaN(milliseconds)) {
            return '无效时间差';
        }
        
        const absMs = Math.abs(milliseconds);
        const sign = milliseconds < 0 ? '-' : '';
        
        const days = Math.floor(absMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((absMs % (1000 * 60)) / 1000);
        const ms = absMs % 1000;
        
        let result = sign;
        
        if (days > 0) {
            result += `${days}天 `;
        }
        
        result += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
        
        return result;
    }
    
    /**
     * 获取当前时间的日志格式字符串
     * @returns {string} 当前时间的日志格式字符串
     */
    static now() {
        return this.formatLogTime(new Date());
    }
    
    /**
     * 验证日志时间字符串格式是否正确
     * @param {string} timeStr - 要验证的时间字符串
     * @returns {boolean} 格式是否正确
     */
    static isValidLogTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') {
            return false;
        }
        
        // 匹配3位毫秒或6位毫秒的格式
        const pattern3 = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
        const pattern6 = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{6})$/;
        
        return pattern3.test(timeStr) || pattern6.test(timeStr);
    }
    
    /**
     * 获取两个时间中较早的时间
     * @param {string} timeStr1 - 第一个时间字符串
     * @param {string} timeStr2 - 第二个时间字符串
     * @param {number} baseYear - 基准年份
     * @returns {string} 较早的时间字符串
     */
    static min(timeStr1, timeStr2, baseYear = new Date().getFullYear()) {
        const date1 = this.parseLogTime(timeStr1, baseYear);
        const date2 = this.parseLogTime(timeStr2, baseYear);
        
        if (!date1 || !date2) {
            return '';
        }
        
        return date1.getTime() <= date2.getTime() ? timeStr1 : timeStr2;
    }
    
    /**
     * 获取两个时间中较晚的时间
     * @param {string} timeStr1 - 第一个时间字符串
     * @param {string} timeStr2 - 第二个时间字符串
     * @param {number} baseYear - 基准年份
     * @returns {string} 较晚的时间字符串
     */
    static max(timeStr1, timeStr2, baseYear = new Date().getFullYear()) {
        const date1 = this.parseLogTime(timeStr1, baseYear);
        const date2 = this.parseLogTime(timeStr2, baseYear);
        
        if (!date1 || !date2) {
            return '';
        }
        
        return date1.getTime() >= date2.getTime() ? timeStr1 : timeStr2;
    }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LogTimeUtils;
}

// 示例用法
if (typeof window !== 'undefined') {
    window.LogTimeUtils = LogTimeUtils;
    
    // 示例测试代码
    console.log('LogTimeUtils 已加载，示例用法:');
    
    const exampleTime = '10-31 00:51:24.984';
    console.log('原始时间:', exampleTime);
    
    const dateObj = LogTimeUtils.parseLogTime(exampleTime);
    console.log('转换为Date对象:', dateObj);
    
    const formatted = LogTimeUtils.formatLogTime(dateObj);
    console.log('转换回字符串:', formatted);
    
    const added = LogTimeUtils.addMilliseconds(exampleTime, 1500);
    console.log('增加1500毫秒后:', added);
    
    const diff = LogTimeUtils.timeDifference('10-31 00:51:24.984', '10-31 01:51:24.984');
    console.log('时间差(毫秒):', diff);
    console.log('格式化时间差:', LogTimeUtils.formatTimeDifference(diff));
}
