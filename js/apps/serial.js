/**
 * js/apps/serial.js
 * 串口控制台应用 - 使用 Web Serial API 与串口设备通信
 * 修复版：支持设备请求、二进制Hex显示、流式中文解码
 * 修改版：增加时间戳(HH:MM:SS/ms)、日志导入导出、默认开启时间戳
 */

class SerialConsole {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.keepReading = false;
        this.textDecoder = new TextDecoder(); // 复用解码器实例
        this.lastMsgEndsWithNewline = true; // 用于控制时间戳显示的标志位
        
        // 默认串口配置
        this.config = {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none'
        };
        
        this.initUI();
        this.bindEvents();
        
        // 监听全局串口插拔事件
        navigator.serial.addEventListener('disconnect', (e) => {
            if (this.port === e.target) {
                this.log('检测到设备断开连接', 'warning');
                this.disconnect();
            }
        });
    }
    
    // 初始化用户界面
    initUI() {
        this.container.innerHTML = `
            <div class="serial-console">
                <div class="serial-controls">
                    <div class="config-row">
                        <div class="config-item">
                            <label>端口</label>
                            <select data-id="portSelect">
                                <option value="">选择设备...</option>
                            </select>
                        </div>
                        <div class="config-item">
                            <label>波特率</label>
                            <input type="number" data-id="baudRate" value="115200" min="110" max="4000000" step="1" list="baudRateList" style="min-width: 80px;">
                            <datalist id="baudRateList">
                                <option value="1200">
                                <option value="2400">
                                <option value="4800">
                                <option value="9600">
                                <option value="19200">
                                <option value="38400">
                                <option value="57600">
                                <option value="115200">
                                <option value="230400">
                                <option value="460800">
                                <option value="921600">
                                <option value="2000000">
                            </datalist>
                        </div>
                        <div class="config-item">
                            <label>数据位</label>
                            <select data-id="dataBits">
                                <option value="7">7</option>
                                <option value="8" selected>8</option>
                            </select>
                        </div>
                        <div class="config-item">
                            <label>停止位</label>
                            <select data-id="stopBits">
                                <option value="1" selected>1</option>
                                <option value="2">2</option>
                            </select>
                        </div>
                        <div class="config-item">
                            <label>校验位</label>
                            <select data-id="parity">
                                <option value="none" selected>无</option>
                                <option value="even">偶</option>
                                <option value="odd">奇</option>
                            </select>
                        </div>
                        <div class="config-item">
                            <button data-id="requestPortBtn" class="btn primary-outline" title="授权新设备">➕ 选择设备</button>
                        </div>
                        <div class="config-item">
                            <button data-id="refreshPorts" class="btn secondary" title="刷新已授权设备列表">刷新</button>
                        </div>
                        <div class="config-item">
                            <button data-id="connectBtn" class="btn primary">连接</button>
                        </div>
                        <div class="config-item">
                            <button data-id="disconnectBtn" class="btn danger" disabled>断开</button>
                        </div>
                        <div class="config-item">
                            <button data-id="clearBtn" class="btn secondary">清空窗口</button>
                        </div>
                    </div>
                </div>
                
                <div class="serial-main">
                    <div class="receive-section">
                        <div class="receive-header">
                            <h4>接收区 <span class="subtitle">(来自设备)</span></h4>
                            <div class="receive-options">
                                <label><input type="checkbox" data-id="autoScroll" checked> 自动滚动</label>
                                <label><input type="checkbox" data-id="showTimestamp" checked> 时间戳</label>
                                <label><input type="checkbox" data-id="hexDisplay"> HEX显示</label>
                                <button data-id="exportBtn" class="btn secondary" style="padding: 2px 6px; font-size: 11px;" title="保存接收内容">导出</button>
                                <button data-id="importBtn" class="btn secondary" style="padding: 2px 6px; font-size: 11px;" title="加载本地文件">导入</button>
                                <input type="file" data-id="fileInput" accept=".txt,.log" style="display:none">
                                <span class="receive-info">
                                    RX: <span data-id="byteCount">0</span> Bytes | Lines: <span data-id="lineCount">0</span>
                                </span>
                            </div>
                        </div>
                        <textarea data-id="receiveArea" readonly placeholder="等待数据..."></textarea>
                    </div>
                    
                    <div class="send-section">
                        <div class="send-header">
                            <h4>发送区 <span class="subtitle">(发送到设备)</span></h4>
                            <div class="send-options">
                                <label><input type="checkbox" data-id="appendNewline"> 加换行(CRLF)</label>
                                <label><input type="checkbox" data-id="hexSend"> HEX发送</label>
                                <button data-id="sendBtn" class="btn primary" disabled>发送</button>
                            </div>
                        </div>
                        <textarea data-id="sendArea" placeholder="输入数据..."></textarea>
                        <div class="send-controls">
                            <button data-id="clearSendBtn" class="btn secondary">清空</button>
                            <button data-id="repeatSendBtn" class="btn secondary" disabled>循环发送</button>
                            <input type="number" data-id="repeatInterval" min="50" max="60000" value="1000" placeholder="ms" style="width: 80px;">
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 使用 querySelector 在当前容器内查找元素，避免多开窗口ID冲突
        const $ = (selector) => this.container.querySelector(`[data-id="${selector}"]`);
        
        this.elements = {
            portSelect: $('portSelect'),
            baudRate: $('baudRate'),
            dataBits: $('dataBits'),
            stopBits: $('stopBits'),
            parity: $('parity'),
            connectBtn: $('connectBtn'),
            disconnectBtn: $('disconnectBtn'),
            refreshPorts: $('refreshPorts'),
            requestPortBtn: $('requestPortBtn'),
            clearBtn: $('clearBtn'),
            receiveArea: $('receiveArea'),
            sendArea: $('sendArea'),
            sendBtn: $('sendBtn'),
            clearSendBtn: $('clearSendBtn'),
            statusIndicator: $('statusIndicator'),
            statusText: $('statusText'),
            byteCount: $('byteCount'),
            lineCount: $('lineCount'),
            // Checkboxes
            autoScroll: $('autoScroll'),
            showTimestamp: $('showTimestamp'),
            hexDisplay: $('hexDisplay'),
            appendNewline: $('appendNewline'),
            hexSend: $('hexSend'),
            repeatSendBtn: $('repeatSendBtn'),
            repeatInterval: $('repeatInterval'),
            // Import/Export
            exportBtn: $('exportBtn'),
            importBtn: $('importBtn'),
            fileInput: $('fileInput')
        };
    }
    
    bindEvents() {
        this.elements.connectBtn.addEventListener('click', () => this.connect());
        this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.elements.refreshPorts.addEventListener('click', () => this.refreshPorts());
        this.elements.requestPortBtn.addEventListener('click', () => this.requestNewPort());
        this.elements.clearBtn.addEventListener('click', () => this.clearReceive());
        this.elements.sendBtn.addEventListener('click', () => this.sendData());
        this.elements.clearSendBtn.addEventListener('click', () => { this.elements.sendArea.value = ''; this.updateSendButton(); });
        
        // 导入导出事件
        this.elements.exportBtn.addEventListener('click', () => this.exportLog());
        this.elements.importBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.importLog(e));
        
        this.elements.sendArea.addEventListener('input', () => this.updateSendButton());
        
        // 配置变化监听
        ['baudRate', 'dataBits', 'stopBits'].forEach(key => {
            this.elements[key].addEventListener('change', (e) => this.config[key] = parseInt(e.target.value));
        });
        // 波特率实时更新
        this.elements.baudRate.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value > 0) {
                this.config.baudRate = value;
            }
        });
        this.elements.parity.addEventListener('change', (e) => this.config.parity = e.target.value);
        
        // 初始刷新
        this.refreshPorts();
    }
    
    // 导出日志
    exportLog() {
        const content = this.elements.receiveArea.value;
        if (!content) {
            this.log('没有可导出的内容', 'warning');
            return;
        }
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.href = url;
            a.download = `serial_log_${timestamp}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.log('日志导出成功', 'success');
        } catch (e) {
            this.log(`导出失败: ${e.message}`, 'error');
        }
    }

    // 导入日志
    importLog(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.elements.receiveArea.value = content;
            
            // 更新统计
            this.elements.byteCount.textContent = new TextEncoder().encode(content).length;
            this.elements.lineCount.textContent = content.split('\n').length;
            
            this.log(`已加载文件: ${file.name}`, 'success');
            // 重置input以允许重复选择同一文件
            this.elements.fileInput.value = '';
        };
        reader.onerror = () => {
            this.log('读取文件失败', 'error');
            this.elements.fileInput.value = '';
        };
        reader.readAsText(file);
    }

    // 请求用户授权新设备 (必须由用户手势触发)
    async requestNewPort() {
        try {
            if (!navigator.serial) {
                throw new Error('浏览器不支持 Web Serial API');
            }
            const port = await navigator.serial.requestPort();
            if (port) {
                this.log('设备授权成功');
                await this.refreshPorts();
                // 自动选中刚添加的设备
                const ports = await navigator.serial.getPorts();
                this.elements.portSelect.value = ports.indexOf(port);
            }
        } catch (error) {
            if (error.name !== 'NotFoundError') { // 用户取消不报错
                this.log(`请求设备失败: ${error.message}`, 'error');
            }
        }
    }
    
    // 刷新已授权端口列表
    async refreshPorts() {
        try {
            if (!navigator.serial) return;
            
            const ports = await navigator.serial.getPorts();
            const currentVal = this.elements.portSelect.value;
            
            this.elements.portSelect.innerHTML = '<option value="">-- 选择端口 --</option>';
            
            if (ports.length === 0) {
                this.elements.portSelect.innerHTML += '<option value="" disabled>无授权设备 (请点击"选择设备")</option>';
            } else {
                ports.forEach((port, index) => {
                    const info = port.getInfo();
                    const label = info.usbProductId ? 
                        `USB设备 (PID:${info.usbProductId.toString(16).toUpperCase()})` : 
                        `串口设备 ${index + 1}`;
                    
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = label;
                    this.elements.portSelect.appendChild(option);
                });
            }
            
            // 尝试保持之前的选择
            if (currentVal !== '' && currentVal < ports.length) {
                this.elements.portSelect.value = currentVal;
            }
        } catch (error) {
            this.log(`刷新列表失败: ${error.message}`, 'error');
        }
    }
    
    // 连接
    async connect() {
        const portIndex = this.elements.portSelect.value;
        if (portIndex === '') {
            this.log('请先选择串口设备', 'warning');
            return;
        }
        
        try {
            const ports = await navigator.serial.getPorts();
            this.port = ports[portIndex];
            
            await this.port.open({
                baudRate: this.config.baudRate,
                dataBits: this.config.dataBits,
                stopBits: this.config.stopBits,
                parity: this.config.parity,
                bufferSize: 8192 // 增加缓冲区
            });
            
            this.isConnected = true;
            this.keepReading = true;
            this.lastMsgEndsWithNewline = true; // 重置换行状态
            this.updateConnectionStatus();
            this.log(`已连接 (波特率: ${this.config.baudRate})`, 'success');
            
            // 启动读取循环
            this.readLoop();
            
        } catch (error) {
            this.log(`连接失败: ${error.message}`, 'error');
            this.disconnect();
        }
    }
    
    // 断开
    async disconnect() {
        this.keepReading = false; // 信号停止读取循环
        
        if (this.reader) {
            try {
                await this.reader.cancel();
                // 注意：reader.closed 的 promise 可能会在循环结束后才 resolve
            } catch (e) { /* ignore */ }
        }
        
        if (this.writer) {
            try {
                await this.writer.close();
            } catch (e) { /* ignore */ }
        }
        
        if (this.port) {
            try {
                await this.port.close();
            } catch (e) { 
                console.error(e);
            }
        }
        
        this.isConnected = false;
        this.port = null;
        this.reader = null;
        this.writer = null;
        
        this.updateConnectionStatus();
        this.log('已断开连接', 'warning');
    }
    
    // 核心读取循环 (修复了二进制处理和流式解码)
    async readLoop() {
        while (this.port.readable && this.keepReading) {
            this.reader = this.port.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    if (value) {
                        this.handleIncomingData(value);
                    }
                }
            } catch (error) {
                if (this.keepReading) this.log(`读取错误: ${error.message}`, 'error');
            } finally {
                this.reader.releaseLock();
            }
        }
    }
    
    // 处理接收到的原始数据
    handleIncomingData(dataView) {
        // dataView 是 Uint8Array
        const isHex = this.elements.hexDisplay.checked;
        const showTime = this.elements.showTimestamp.checked;
        let displayStr = '';
        
        if (isHex) {
            // Hex 模式：直接转换原始字节
            const hexArr = [];
            for(let i=0; i<dataView.length; i++) {
                hexArr.push(dataView[i].toString(16).padStart(2, '0').toUpperCase());
            }
            displayStr = hexArr.join(' ') + ' ';
        } else {
            // 文本模式：使用流式解码处理多字节字符（中文）
            displayStr = this.textDecoder.decode(dataView, { stream: true });
        }
        
        if (showTime && displayStr.length > 0) {
            // 构造时间戳字符串 HH:MM:SS/毫秒
            const now = new Date();
            const h = now.getHours().toString().padStart(2, '0');
            const m = now.getMinutes().toString().padStart(2, '0');
            const s = now.getSeconds().toString().padStart(2, '0');
            const ms = now.getMilliseconds().toString().padStart(3, '0');
            const timeStr = `[${h}:${m}:${s}/${ms}] `;

            // 智能添加时间戳：
            // 1. 如果上一段数据以换行结束，则在当前数据开头添加
            // 2. 如果当前数据中间包含换行，则在换行后添加（可选，这里简单处理仅在开头加）
            if (this.lastMsgEndsWithNewline) {
                displayStr = timeStr + displayStr;
            }
            
            // 更新状态，判断本次数据是否以换行结尾
            // 检查 \n 或 \r
            this.lastMsgEndsWithNewline = /[\\r\\n]$/.test(displayStr);
            
            // 如果需要在每行中间也加时间戳（处理一次收到多行的情况），可以使用 replace
            // displayStr = displayStr.replace(/(\\r\\n|\\n|\\r)/g, `$1${timeStr}`);
        }

        this.appendToReceiveArea(displayStr);
        
        // 更新统计
        const currentBytes = parseInt(this.elements.byteCount.textContent) || 0;
        this.elements.byteCount.textContent = currentBytes + dataView.byteLength;
    }
    
    appendToReceiveArea(text) {
        const area = this.elements.receiveArea;
        const autoScroll = this.elements.autoScroll.checked;
        
        // 智能滚动：如果当前不在底部，就不强制滚动
        const isAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 50;
        
        area.value += text;
        
        // 更新行数
        this.elements.lineCount.textContent = area.value.split('\n').length;
        
        if (autoScroll && isAtBottom) {
            area.scrollTop = area.scrollHeight;
        }
    }
    
    // 发送数据
    async sendData() {
        if (!this.port || !this.port.writable) return;
        
        const rawInput = this.elements.sendArea.value;
        if (!rawInput) return;
        
        try {
            const isHex = this.elements.hexSend.checked;
            const appendNL = this.elements.appendNewline.checked;
            let dataToSend;
            
            if (isHex) {
                // 过滤非Hex字符
                const cleanHex = rawInput.replace(/[^0-9a-fA-F]/g, '');
                if (cleanHex.length % 2 !== 0) {
                    this.log('Hex长度必须是偶数', 'warning');
                    return;
                }
                const bytes = new Uint8Array(cleanHex.length / 2);
                for (let i = 0; i < cleanHex.length; i += 2) {
                    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
                }
                dataToSend = bytes;
            } else {
                let text = rawInput;
                if (appendNL) text += '\r\n'; // 标准串口换行通常是 CRLF
                dataToSend = new TextEncoder().encode(text);
            }
            
            const writer = this.port.writable.getWriter();
            await writer.write(dataToSend);
            writer.releaseLock();
            
            this.log(`已发送 ${dataToSend.byteLength} 字节`);
            
            // 处理循环发送
            // 注意：此处简化逻辑，实际循环发送建议使用 setInterval 并在外部控制
            
        } catch (error) {
            this.log(`发送失败: ${error.message}`, 'error');
        }
    }
    
    clearReceive() {
        this.elements.receiveArea.value = '';
        this.elements.byteCount.textContent = '0';
        this.elements.lineCount.textContent = '0';
    }
    
    updateConnectionStatus() {
        const isConnected = this.isConnected;
        const color = isConnected ? '#4CAF50' : '#F44336';
        const text = isConnected ? '已连接' : '未连接';
        
        this.elements.statusIndicator.style.color = color;
        this.elements.statusText.textContent = text;
        this.elements.statusText.style.color = color;
        
        this.elements.connectBtn.disabled = isConnected;
        this.elements.disconnectBtn.disabled = !isConnected;
        this.elements.sendBtn.disabled = !isConnected;
        this.elements.portSelect.disabled = isConnected;
        this.elements.baudRate.disabled = isConnected;
        this.elements.requestPortBtn.disabled = isConnected;
    }
    
    updateSendButton() {
        const hasContent = this.elements.sendArea.value.length > 0;
        this.elements.sendBtn.disabled = !this.isConnected || !hasContent;
    }
    
    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMsg = `[${timestamp}] ${msg}`;
        
        switch(type) {
            case 'error':
                console.error(formattedMsg);
                break;
            case 'warning':
                console.warn(formattedMsg);
                break;
            case 'success':
                console.info(formattedMsg);
                break;
            default:
                console.info(formattedMsg);
        }
    }
}

// 注册应用到桌面系统
if (typeof DesktopSystem !== 'undefined') {
    DesktopSystem.registerApp({
        id: 'serial',
        title: '串口调试助手',
        icon: '🔌',
        width: '850px',
        height: '700px',
        content: (instanceId) => {
            setTimeout(() => {
                new SerialConsole(`serial-app-${instanceId}`);
            }, 0);
            return `<div id="serial-app-${instanceId}" style="height:100%"></div>`;
        }
    });
}

// 注入样式 (防止重复注入)
if (!document.getElementById('serial-console-style')) {
    const style = document.createElement('style');
    style.id = 'serial-console-style';
    style.textContent = `
    .serial-console { display: flex; flex-direction: column; height: 100%; padding: 10px; box-sizing: border-box; background: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .connection-status { font-size: 13px; font-weight: 500; }
    
    .serial-controls { background: #fff; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 8px; }
    .config-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .config-item { display: flex; flex-direction: column; gap: 2px; }
    .config-item label { font-size: 10px; color: #666; font-weight: 500; text-align: center; }
    .config-item select, .config-item input { padding: 3px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; min-width: 80px; }
    .config-item input[type="number"]::-webkit-inner-spin-button, 
    .config-item input[type="number"]::-webkit-outer-spin-button { 
        opacity: 1; margin: 0; height: auto; 
    }
    .config-item .btn { padding: 4px 8px; font-size: 11px; white-space: nowrap; }
    
    .serial-main { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
    .receive-section, .send-section { display: flex; flex-direction: column; background: #fff; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .receive-section { flex: 3; min-height: 0; }
    .send-section { flex: 1; min-height: 0; }
    
    .receive-header, .send-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    h4 { margin: 0; font-size: 13px; color: #444; display: flex; align-items: center; }
    .subtitle { font-weight: normal; color: #999; font-size: 11px; margin-left: 6px; }
    
    .receive-options, .send-options { display: flex; gap: 8px; align-items: center; font-size: 12px; color: #555; }
    .receive-options label, .send-options label { display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; }
    .receive-info { font-size: 11px; color: #888; margin-left: auto; padding-left: 12px; }
    
    textarea { flex: 1; resize: none; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; line-height: 1.4; outline: none; }
    textarea:focus { border-color: #2196F3; }
    .receive-section textarea { background-color: #fafafa; color: #222; }
    
    .send-controls { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
    

    
    .btn { padding: 5px 12px; border: 1px solid transparent; border-radius: 4px; font-size: 12px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(100%); }
    .btn.primary { background: #2196F3; color: white; }
    .btn.primary:hover:not(:disabled) { background: #1976D2; }
    .btn.primary-outline { border: 1px solid #2196F3; color: #2196F3; background: transparent; }
    .btn.primary-outline:hover:not(:disabled) { background: #E3F2FD; }
    .btn.secondary { background: #f5f5f5; border: 1px solid #ddd; color: #333; }
    .btn.secondary:hover:not(:disabled) { background: #e0e0e0; }
    .btn.danger { background: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }
    .btn.danger:hover:not(:disabled) { background: #ef9a9a; color: white; border-color: #ef9a9a; }
    `;
    document.head.appendChild(style);
}