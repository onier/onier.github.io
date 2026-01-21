/**
 * js/apps/serial.js
 * 串口控制台应用 - 使用 Web Serial API 与串口设备通信
 */

// 串口管理器类
class SerialConsole {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.receiveBuffer = '';
        
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
    }
    
    // 初始化用户界面
    initUI() {
        this.container.innerHTML = `
            <div class="serial-console">
                <div class="serial-header">
                    <h3>串口控制台</h3>
                    <div class="connection-status">
                        <span class="status-indicator" id="statusIndicator">●</span>
                        <span id="statusText">未连接</span>
                    </div>
                </div>
                
                <div class="serial-controls">
                    <div class="config-section">
                        <h4>串口配置</h4>
                        <div class="config-grid">
                            <div class="config-item">
                                <label>端口:</label>
                                <select id="portSelect">
                                    <option value="">选择端口...</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <label>波特率:</label>
                                <select id="baudRate">
                                    <option value="300">300</option>
                                    <option value="1200">1200</option>
                                    <option value="2400">2400</option>
                                    <option value="4800">4800</option>
                                    <option value="9600" selected>9600</option>
                                    <option value="19200">19200</option>
                                    <option value="38400">38400</option>
                                    <option value="57600">57600</option>
                                    <option value="115200">115200</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <label>数据位:</label>
                                <select id="dataBits">
                                    <option value="7">7</option>
                                    <option value="8" selected>8</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <label>停止位:</label>
                                <select id="stopBits">
                                    <option value="1" selected>1</option>
                                    <option value="2">2</option>
                                </select>
                            </div>
                            <div class="config-item">
                                <label>校验位:</label>
                                <select id="parity">
                                    <option value="none" selected>无</option>
                                    <option value="even">偶校验</option>
                                    <option value="odd">奇校验</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="connection-section">
                        <button id="refreshPorts" class="btn secondary">刷新端口</button>
                        <button id="connectBtn" class="btn primary">连接</button>
                        <button id="disconnectBtn" class="btn danger" disabled>断开</button>
                        <button id="clearBtn" class="btn secondary">清空接收</button>
                    </div>
                </div>
                
                <div class="serial-main">
                    <div class="receive-section">
                        <h4>接收区 <span class="subtitle">(来自串口设备)</span></h4>
                        <div class="receive-options">
                            <label>
                                <input type="checkbox" id="autoScroll" checked> 自动滚动
                            </label>
                            <label>
                                <input type="checkbox" id="showTimestamp"> 显示时间戳
                            </label>
                            <label>
                                <input type="checkbox" id="hexDisplay"> 十六进制显示
                            </label>
                        </div>
                        <textarea id="receiveArea" readonly placeholder="接收的数据将显示在这里..."></textarea>
                        <div class="receive-info">
                            <span>字节数: <span id="byteCount">0</span></span>
                            <span>行数: <span id="lineCount">0</span></span>
                        </div>
                    </div>
                    
                    <div class="send-section">
                        <h4>发送区 <span class="subtitle">(发送到串口设备)</span></h4>
                        <div class="send-options">
                            <label>
                                <input type="checkbox" id="appendNewline"> 自动添加换行
                            </label>
                            <label>
                                <input type="checkbox" id="hexSend"> 十六进制发送
                            </label>
                            <button id="sendBtn" class="btn primary" disabled>发送</button>
                        </div>
                        <textarea id="sendArea" placeholder="输入要发送的数据..."></textarea>
                        <div class="send-controls">
                            <button id="clearSendBtn" class="btn secondary">清空发送区</button>
                            <button id="repeatSendBtn" class="btn secondary" disabled>重复发送</button>
                            <input type="number" id="repeatInterval" min="100" max="10000" value="1000" placeholder="间隔(ms)" style="width: 100px;">
                        </div>
                    </div>
                </div>
                
                <div class="serial-footer">
                    <div class="log-section">
                        <h4>日志</h4>
                        <div id="logArea"></div>
                    </div>
                </div>
            </div>
        `;
        
        // 获取DOM元素引用
        this.elements = {
            portSelect: document.getElementById('portSelect'),
            baudRate: document.getElementById('baudRate'),
            dataBits: document.getElementById('dataBits'),
            stopBits: document.getElementById('stopBits'),
            parity: document.getElementById('parity'),
            connectBtn: document.getElementById('connectBtn'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            refreshPorts: document.getElementById('refreshPorts'),
            clearBtn: document.getElementById('clearBtn'),
            receiveArea: document.getElementById('receiveArea'),
            sendArea: document.getElementById('sendArea'),
            sendBtn: document.getElementById('sendBtn'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            byteCount: document.getElementById('byteCount'),
            lineCount: document.getElementById('lineCount'),
            logArea: document.getElementById('logArea')
        };
    }
    
    // 绑定事件
    bindEvents() {
        this.elements.connectBtn.addEventListener('click', () => this.connect());
        this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.elements.refreshPorts.addEventListener('click', () => this.refreshPorts());
        this.elements.clearBtn.addEventListener('click', () => this.clearReceive());
        this.elements.sendBtn.addEventListener('click', () => this.sendData());
        this.elements.sendArea.addEventListener('input', () => this.updateSendButton());
        
        // 配置变化时更新
        this.elements.baudRate.addEventListener('change', (e) => this.config.baudRate = parseInt(e.target.value));
        this.elements.dataBits.addEventListener('change', (e) => this.config.dataBits = parseInt(e.target.value));
        this.elements.stopBits.addEventListener('change', (e) => this.config.stopBits = parseInt(e.target.value));
        this.elements.parity.addEventListener('change', (e) => this.config.parity = e.target.value);
        
        // 初始刷新端口列表
        this.refreshPorts();
    }
    
    // 刷新可用串口列表
    async refreshPorts() {
        try {
            if (!navigator.serial) {
                this.log('错误: 浏览器不支持 Web Serial API。请使用 Chrome/Edge 89+ 版本。', 'error');
                return;
            }
            
            const ports = await navigator.serial.getPorts();
            this.elements.portSelect.innerHTML = '<option value="">选择端口...</option>';
            
            if (ports.length === 0) {
                this.elements.portSelect.innerHTML += '<option value="" disabled>未找到串口设备</option>';
            } else {
                ports.forEach((port, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = port.getInfo().usbProductId ? 
                        `USB串口 (PID: ${port.getInfo().usbProductId})` : `串口 ${index + 1}`;
                    this.elements.portSelect.appendChild(option);
                });
            }
            
            this.log(`刷新完成，找到 ${ports.length} 个串口设备`);
        } catch (error) {
            this.log(`刷新端口失败: ${error.message}`, 'error');
        }
    }
    
    // 连接串口
    async connect() {
        const portIndex = this.elements.portSelect.value;
        if (portIndex === '') {
            this.log('请先选择串口设备', 'warning');
            return;
        }
        
        try {
            const ports = await navigator.serial.getPorts();
            this.port = ports[portIndex];
            
            // 更新配置
            this.config.baudRate = parseInt(this.elements.baudRate.value);
            this.config.dataBits = parseInt(this.elements.dataBits.value);
            this.config.stopBits = parseInt(this.elements.stopBits.value);
            this.config.parity = this.elements.parity.value;
            
            await this.port.open({
                baudRate: this.config.baudRate,
                dataBits: this.config.dataBits,
                stopBits: this.config.stopBits,
                parity: this.config.parity,
                flowControl: this.config.flowControl
            });
            
            this.isConnected = true;
            this.updateConnectionStatus();
            this.log(`已连接到串口，波特率: ${this.config.baudRate}`);
            
            // 启动数据读取
            this.startReading();
            
        } catch (error) {
            this.log(`连接失败: ${error.message}`, 'error');
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }
    
    // 断开连接
    async disconnect() {
        if (!this.port || !this.isConnected) return;
        
        try {
            if (this.reader) {
                this.reader.cancel();
                await this.reader.closed.catch(() => {});
            }
            
            if (this.writer) {
                this.writer.close();
                await this.writer.closed;
            }
            
            await this.port.close();
            this.isConnected = false;
            this.port = null;
            this.reader = null;
            this.writer = null;
            
            this.updateConnectionStatus();
            this.log('已断开串口连接');
            
        } catch (error) {
            this.log(`断开连接失败: ${error.message}`, 'error');
        }
    }
    
    // 开始读取串口数据
    async startReading() {
        if (!this.port || !this.isConnected) return;
        
        try {
            const textDecoder = new TextDecoder();
            while (this.port.readable && this.isConnected) {
                this.reader = this.port.readable.getReader();
                
                try {
                    while (true) {
                        const { value, done } = await this.reader.read();
                        if (done) break;
                        
                        // 处理接收到的数据
                        const text = textDecoder.decode(value);
                        this.receiveBuffer += text;
                        this.updateReceiveArea(text);
                        
                        // 更新统计
                        this.updateStatistics(value.length);
                    }
                } catch (error) {
                    if (error.name !== 'InterruptedError') {
                        this.log(`读取错误: ${error.message}`, 'error');
                    }
                } finally {
                    this.reader.releaseLock();
                }
            }
        } catch (error) {
            this.log(`读取失败: ${error.message}`, 'error');
        }
    }
    
    // 更新接收区域
    updateReceiveArea(text) {
        if (!text) return;
        
        const receiveArea = this.elements.receiveArea;
        const showTimestamp = document.getElementById('showTimestamp').checked;
        const hexDisplay = document.getElementById('hexDisplay').checked;
        
        let displayText = text;
        
        if (hexDisplay) {
            // 转换为十六进制显示
            const hexArray = [];
            for (let i = 0; i < text.length; i++) {
                hexArray.push(text.charCodeAt(i).toString(16).padStart(2, '0'));
            }
            displayText = hexArray.join(' ') + ' ';
        }
        
        if (showTimestamp) {
            const timestamp = new Date().toLocaleTimeString();
            displayText = `[${timestamp}] ${displayText}`;
        }
        
        receiveArea.value += displayText;
        
        // 自动滚动
        if (document.getElementById('autoScroll').checked) {
            receiveArea.scrollTop = receiveArea.scrollHeight;
        }
        
        // 更新行数
        const lines = receiveArea.value.split('\n').length;
        this.elements.lineCount.textContent = lines;
    }
    
    // 更新统计信息
    updateStatistics(bytesReceived) {
        const currentBytes = parseInt(this.elements.byteCount.textContent) || 0;
        this.elements.byteCount.textContent = currentBytes + bytesReceived;
    }
    
    // 发送数据
    async sendData() {
        if (!this.port || !this.isConnected) {
            this.log('未连接到串口设备', 'warning');
            return;
        }
        
        const sendArea = this.elements.sendArea;
        let data = sendArea.value.trim();
        
        if (!data) {
            this.log('发送数据不能为空', 'warning');
            return;
        }
        
        try {
            const hexSend = document.getElementById('hexSend').checked;
            const appendNewline = document.getElementById('appendNewline').checked;
            
            let sendBuffer;
            
            if (hexSend) {
                // 十六进制发送
                const hexBytes = data.replace(/[^0-9a-fA-F]/g, '').match(/.{1,2}/g) || [];
                const byteArray = new Uint8Array(hexBytes.map(byte => parseInt(byte, 16)));
                sendBuffer = byteArray;
            } else {
                // 文本发送
                if (appendNewline) {
                    data += '\n';
                }
                const textEncoder = new TextEncoder();
                sendBuffer = textEncoder.encode(data);
            }
            
            if (!this.writer) {
                this.writer = this.port.writable.getWriter();
            }
            
            await this.writer.write(sendBuffer);
            this.log(`已发送 ${sendBuffer.length} 字节数据`);
            
            // 如果需要重复发送
            const repeatBtn = document.getElementById('repeatSendBtn');
            if (repeatBtn.disabled === false) {
                const interval = parseInt(document.getElementById('repeatInterval').value) || 1000;
                setTimeout(() => this.sendData(), interval);
            }
            
        } catch (error) {
            this.log(`发送失败: ${error.message}`, 'error');
        }
    }
    
    // 清空接收区
    clearReceive() {
        this.elements.receiveArea.value = '';
        this.elements.byteCount.textContent = '0';
        this.elements.lineCount.textContent = '0';
        this.receiveBuffer = '';
        this.log('已清空接收区');
    }
    
    // 更新连接状态显示
    updateConnectionStatus() {
        const indicator = this.elements.statusIndicator;
        const statusText = this.elements.statusText;
        const connectBtn = this.elements.connectBtn;
        const disconnectBtn = this.elements.disconnectBtn;
        const sendBtn = this.elements.sendBtn;
        
        if (this.isConnected) {
            indicator.style.color = '#4CAF50';
            indicator.textContent = '●';
            statusText.textContent = '已连接';
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            sendBtn.disabled = false;
        } else {
            indicator.style.color = '#F44336';
            indicator.textContent = '●';
            statusText.textContent = '未连接';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            sendBtn.disabled = true;
        }
    }
    
    // 更新发送按钮状态
    updateSendButton() {
        const sendBtn = this.elements.sendBtn;
        const sendArea = this.elements.sendArea;
        sendBtn.disabled = !this.isConnected || sendArea.value.trim() === '';
    }
    
    // 添加日志
    log(message, type = 'info') {
        const logArea = this.elements.logArea;
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
        
        logArea.appendChild(logEntry);
        logArea.scrollTop = logArea.scrollHeight;
        
        // 限制日志数量
        const entries = logArea.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[0].remove();
        }
    }
}

// 注册应用到桌面系统
DesktopSystem.registerApp({
    id: 'serial',
    title: '串口控制台',
    icon: '🔌',
    color: '#2196F3',
    width: '800px',
    height: '700px',
    content: (instanceId) => {
        // 延迟初始化以确保DOM已加载
        setTimeout(() => {
            const container = document.getElementById(`serial-container-${instanceId}`);
            if (container) {
                new SerialConsole(`serial-container-${instanceId}`);
            }
        }, 100);
        
        return `
            <div id="serial-container-${instanceId}" style="width:100%;height:100%;padding:10px;box-sizing:border-box;">
                <div style="text-align:center;padding:20px;">
                    <p>加载串口控制台...</p>
                </div>
            </div>
        `;
    }
});

// 添加CSS样式
const style = document.createElement('style');
style.textContent = `
.serial-console {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
    font-family: 'Segoe UI', sans-serif;
    background: #fff;
    color: #333;
}

.serial-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid #e0e0e0;
    margin-bottom: 15px;
}

.serial-header h3 {
    margin: 0;
    font-size: 18px;
    color: #2196F3;
}

.connection-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
}

.status-indicator {
    font-size: 16px;
    color: #F44336;
}

.serial-controls {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
}

.config-section h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #666;
}

.config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin-bottom: 10px;
}

.config-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.config-item label {
    font-size: 12px;
    color: #666;
}

.config-item select {
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 13px;
    background: #fff;
}

.connection-section {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.2s;
}

.btn.primary {
    background: #2196F3;
    color: white;
}

.btn.primary:hover {
    background: #1976D2;
}

.btn.secondary {
    background: #f0f0f0;
    color: #333;
}

.btn.secondary:hover {
    background: #e0e0e0;
}

.btn.danger {
    background: #F44336;
    color: white;
}

.btn.danger:hover {
    background: #D32F2F;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.serial-main {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    flex: 1;
    min-height: 300px;
}

.receive-section, .send-section {
    display: flex;
    flex-direction: column;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 15px;
    background: #f9f9f9;
}

.receive-section h4, .send-section h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #333;
}

.subtitle {
    font-size: 12px;
    color: #666;
    font-weight: normal;
}

.receive-options, .send-options {
    display: flex;
    gap: 15px;
    margin-bottom: 10px;
    flex-wrap: wrap;
}

.receive-options label, .send-options label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #666;
    cursor: pointer;
}

#receiveArea, #sendArea {
    flex: 1;
    min-height: 200px;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 13px;
    resize: vertical;
    background: #fff;
}

#receiveArea {
    background: #f5f5f5;
}

.receive-info {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 12px;
    color: #666;
}

.send-controls {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    align-items: center;
}

.send-controls input {
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 13px;
}

.serial-footer {
    margin-top: 20px;
}

.log-section h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #333;
}

#logArea {
    height: 100px;
    overflow-y: auto;
    padding: 10px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: #f5f5f5;
    font-size: 12px;
    font-family: 'Consolas', monospace;
}

.log-entry {
    padding: 2px 0;
    border-bottom: 1px solid #eee;
}

.log-time {
    color: #666;
    margin-right: 10px;
}

.log-info {
    color: #2196F3;
}

.log-warning {
    color: #FF9800;
}

.log-error {
    color: #F44336;
}

.log-success {
    color: #4CAF50;
}
`;

// 将样式添加到文档头部
document.head.appendChild(style);
