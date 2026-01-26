/**
 * js/apps/serial.js
 * 串口控制台应用 - 使用 Web Serial API 与串口设备通信
 * 修复版：支持设备请求、二进制Hex显示、流式中文解码
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
        
        // 默认串口配置
        this.config = {
            baudRate: 9600,
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
                            <select data-id="baudRate">
                                <option value="1200">1200</option>
                                <option value="2400">2400</option>
                                <option value="4800">4800</option>
                                <option value="9600" selected>9600</option>
                                <option value="19200">19200</option>
                                <option value="38400">38400</option>
                                <option value="57600">57600</option>
                                <option value="115200">115200</option>
                                <option value="230400">230400</option>
                                <option value="921600">921600</option>
                            </select>
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
                                <label><input type="checkbox" data-id="showTimestamp"> 时间戳</label>
                                <label><input type="checkbox" data-id="hexDisplay"> HEX显示</label>
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
                
                <div class="serial-footer">
                    <div class="log-section">
                        <h4>系统日志</h4>
                        <div data-id="logArea" class="log-area"></div>
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
            logArea: $('logArea'),
            // Checkboxes
            autoScroll: $('autoScroll'),
            showTimestamp: $('showTimestamp'),
            hexDisplay: $('hexDisplay'),
            appendNewline: $('appendNewline'),
            hexSend: $('hexSend'),
            repeatSendBtn: $('repeatSendBtn'),
            repeatInterval: $('repeatInterval')
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
        
        this.elements.sendArea.addEventListener('input', () => this.updateSendButton());
        
        // 配置变化监听
        ['baudRate', 'dataBits', 'stopBits'].forEach(key => {
            this.elements[key].addEventListener('change', (e) => this.config[key] = parseInt(e.target.value));
        });
        this.elements.parity.addEventListener('change', (e) => this.config.parity = e.target.value);
        
        // 初始刷新
        this.refreshPorts();
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
            // 注意：这里简化处理，直接输出到界面。
            // 严谨做法是维护一个buffer，但为了控制台实时性，直接解码流
            displayStr = this.textDecoder.decode(dataView, { stream: true });
        }
        
        if (showTime) {
            // 简单的换行检测，避免每小段数据都加时间戳，仅在上一段以换行结尾时加
            // 这里为了演示简单，直接加在头部（实际场景可能需要更复杂的行缓冲逻辑）
            // displayStr = `[${new Date().toLocaleTimeString()}] ${displayStr}`; 
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
        const div = document.createElement('div');
        div.className = `log-entry log-${type}`;
        div.innerHTML = `<span class="time">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
        this.elements.logArea.appendChild(div);
        this.elements.logArea.scrollTop = this.elements.logArea.scrollHeight;
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
    .config-item select { padding: 3px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; min-width: 60px; }
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
    
    .log-section { height: 50px; margin-top: 8px; background: #fff; padding: 6px; border-radius: 6px; display: flex; flex-direction: column; }
    .log-area { flex: 1; overflow-y: auto; font-family: monospace; font-size: 11px; border: 1px solid #eee; padding: 4px; background: #fcfcfc; }
    .log-entry { padding: 1px 0; border-bottom: 1px dashed #f0f0f0; }
    .log-entry .time { color: #999; margin-right: 6px; }
    .log-error { color: #d32f2f; }
    .log-success { color: #388e3c; }
    .log-warning { color: #f57c00; }
    
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
