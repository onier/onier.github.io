/**
 * js/apps/serial.js
 * 串口控制台应用 - 使用 Web Serial API 与串口设备通信
 * 修复版：支持设备请求、二进制Hex显示、流式中文解码
 * 修改版：增加时间戳(HH:MM:SS/ms)、日志导入导出、默认开启时间戳
 * 增强版：使用 Monaco Editor 显示日志
 * 优化版：增加缓存行数限制，修复空行过多问题
 * 进阶版：使用 Monaco 装饰器显示虚拟时间差，导入文件时自动重算时间差
 */

class SerialConsole {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.keepReading = false;
        this.textDecoder = new TextDecoder(); 
        
        // Monaco Editor 相关
        this.editor = null;
        this.monacoModel = null;
        this.editorDecorations = []; // 存储当前的装饰器ID
        this.pendingData = []; 
        this.isMonacoReady = false;

        // 状态变量
        this.lastMsgEndsWithNewline = true; 
        this.lastParsedTime = null; 
        this.sessionStartTime = null; 
        this.receiveBuffer = ''; 
        
        // 默认串口配置
        this.config = {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none',
            maxLines: 1000 
        };
        
        this.initUI();
        
        this.loadMonaco().then(() => {
            this.initMonaco();
        }).catch(err => {
            this.log(`Monaco Editor 加载失败: ${err.message}`, 'error');
            if (this.elements && this.elements.receiveContainer) {
                this.elements.receiveContainer.innerHTML = '<div style="color:red;padding:10px;">无法加载编辑器组件，请检查网络连接。<br>Error: ' + err.message + '</div>';
            }
        });

        this.bindEvents();
        
        navigator.serial.addEventListener('disconnect', (e) => {
            if (this.port === e.target) {
                this.log('检测到设备断开连接', 'warning');
                this.disconnect();
            }
        });
    }
    
    loadMonaco() {
        return new Promise((resolve, reject) => {
            if (window.monaco) {
                resolve();
                return;
            }
            const loaderScript = document.createElement('script');
            loaderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js';
            loaderScript.onload = () => {
                require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
                require(['vs/editor/editor.main'], () => {
                    resolve();
                });
            };
            loaderScript.onerror = reject;
            document.body.appendChild(loaderScript);
        });
    }

    initMonaco() {
        const container = this.elements.receiveContainer;
        container.innerHTML = ''; 

        monaco.editor.defineTheme('serialLogTheme', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#fafafa',
                'editor.lineHighlightBackground': '#f0f0f0'
            }
        });

        this.editor = monaco.editor.create(container, {
            value: '',
            language: 'plaintext',
            theme: 'serialLogTheme',
            readOnly: true, 
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            minimap: { enabled: false },
            lineNumbers: 'off', 
            folding: false,
            renderLineHighlight: 'all',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 12,
            contextmenu: true,
            mouseWheelZoom: true,
            renderWhitespace: 'none'
        });

        this.monacoModel = this.editor.getModel();
        this.isMonacoReady = true;

        if (this.pendingData.length > 0) {
            this.pendingData.forEach(item => this.writeToMonaco(item));
            this.pendingData = [];
        }
    }

    initUI() {
        this.container.innerHTML = `
            <div class="serial-console">
                <div class="serial-controls">
                    <div class="config-row">
                        <div class="config-item">
                            <label>端口</label>
                            <select data-id="portSelect"><option value="">选择设备...</option></select>
                        </div>
                        <div class="config-item">
                            <label>波特率</label>
                            <input type="number" data-id="baudRate" value="115200" min="110" max="4000000" step="1" list="baudRateList" style="min-width: 80px;">
                            <datalist id="baudRateList">
                                <option value="9600"><option value="115200"><option value="921600">
                            </datalist>
                        </div>
                        <div class="config-item">
                            <label>数据位</label>
                            <select data-id="dataBits"><option value="8" selected>8</option></select>
                        </div>
                        <div class="config-item">
                            <label>停止位</label>
                            <select data-id="stopBits"><option value="1" selected>1</option></select>
                        </div>
                        <div class="config-item">
                            <label>校验位</label>
                            <select data-id="parity"><option value="none" selected>无</option></select>
                        </div>
                        <div class="config-item"><button data-id="requestPortBtn" class="btn primary-outline">➕ 选择设备</button></div>
                        <div class="config-item"><button data-id="refreshPorts" class="btn secondary">刷新</button></div>
                        <div class="config-item"><button data-id="connectBtn" class="btn primary">连接</button></div>
                        <div class="config-item"><button data-id="disconnectBtn" class="btn danger" disabled>断开</button></div>
                        <div class="config-item"><button data-id="clearBtn" class="btn secondary">清空</button></div>
                        
                        <div class="config-item" style="margin-left:auto; border-left:1px solid #eee; padding-left:8px;">
                            <label>最大行数</label>
                            <input type="number" data-id="maxLines" value="1000" min="100" step="100" style="width: 60px;">
                        </div>
                        <div class="config-item" style="display: flex; align-items: center; gap: 5px; padding-right: 5px;">
                            <span data-id="statusIndicator" style="color: #F44336; font-size: 14px;">●</span>
                            <span data-id="statusText" style="font-size: 11px; color: #F44336; font-weight: 500;">未连接</span>
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
                                <button data-id="exportBtn" class="btn secondary" style="padding: 2px 6px; font-size: 11px;" title="保存纯净日志">导出</button>
                                <button data-id="importBtn" class="btn secondary" style="padding: 2px 6px; font-size: 11px;" title="加载本地文件并分析时间差">导入</button>
                                <input type="file" data-id="fileInput" accept=".txt,.log" style="display:none">
                                <span class="receive-info">RX: <span data-id="byteCount">0</span> Bytes</span>
                            </div>
                        </div>
                        <div data-id="receiveContainer" class="receive-window">正在加载编辑器组件...</div>
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
        
        const $ = (selector) => this.container.querySelector(`[data-id="${selector}"]`);
        this.elements = {
            portSelect: $('portSelect'), baudRate: $('baudRate'), dataBits: $('dataBits'), stopBits: $('stopBits'), parity: $('parity'),
            connectBtn: $('connectBtn'), disconnectBtn: $('disconnectBtn'), refreshPorts: $('refreshPorts'), requestPortBtn: $('requestPortBtn'),
            clearBtn: $('clearBtn'), receiveContainer: $('receiveContainer'), sendArea: $('sendArea'), sendBtn: $('sendBtn'),
            clearSendBtn: $('clearSendBtn'), statusIndicator: $('statusIndicator'), statusText: $('statusText'),
            byteCount: $('byteCount'), autoScroll: $('autoScroll'), showTimestamp: $('showTimestamp'), hexDisplay: $('hexDisplay'),
            appendNewline: $('appendNewline'), hexSend: $('hexSend'), repeatSendBtn: $('repeatSendBtn'), repeatInterval: $('repeatInterval'),
            exportBtn: $('exportBtn'), importBtn: $('importBtn'), fileInput: $('fileInput'), maxLines: $('maxLines')
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
        this.elements.exportBtn.addEventListener('click', () => this.exportLog());
        this.elements.importBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.importLog(e));
        this.elements.sendArea.addEventListener('input', () => this.updateSendButton());
        
        ['baudRate', 'dataBits', 'stopBits'].forEach(key => {
            this.elements[key].addEventListener('change', (e) => this.config[key] = parseInt(e.target.value));
        });
        this.elements.baudRate.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value > 0) this.config.baudRate = value;
        });
        this.elements.parity.addEventListener('change', (e) => this.config.parity = e.target.value);
        
        this.elements.maxLines.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            if (val > 0) {
                this.config.maxLines = val;
                this.checkBufferLimit(true); 
            }
        });
        
        this.refreshPorts();
    }

    // ================= 数据流处理 =================

    handleIncomingData(dataView) {
        const isHex = this.elements.hexDisplay.checked;
        const showTime = this.elements.showTimestamp.checked;
        let chunk = '';
        
        if (isHex) {
            const hexArr = [];
            for(let i=0; i<dataView.length; i++) hexArr.push(dataView[i].toString(16).padStart(2, '0').toUpperCase());
            chunk = hexArr.join(' ') + ' ';
        } else {
            chunk = this.textDecoder.decode(dataView, { stream: true });
        }
        
        chunk = chunk.replace(/\r/g, '');

        const currentBytes = parseInt(this.elements.byteCount.textContent) || 0;
        this.elements.byteCount.textContent = currentBytes + dataView.byteLength;

        let processedChunk = '';
        const now = new Date();
        const timeStr = `[${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}/${now.getMilliseconds().toString().padStart(3,'0')}] `;
        
        if (showTime) {
            if (this.lastMsgEndsWithNewline) {
                processedChunk += timeStr;
                this.lastMsgEndsWithNewline = false;
            }
            
            if (chunk.includes('\n')) {
                const parts = chunk.split('\n');
                for (let i = 0; i < parts.length - 1; i++) {
                    parts[i+1] = timeStr + parts[i+1];
                }
                processedChunk += parts.join('\n');
            } else {
                processedChunk += chunk;
            }
            
            if (chunk.endsWith('\n')) {
                this.lastMsgEndsWithNewline = true;
                if (processedChunk.endsWith('\n' + timeStr)) {
                    processedChunk = processedChunk.slice(0, -timeStr.length);
                }
            }
        } else {
            processedChunk = chunk;
        }

        this.processBufferAndRender(processedChunk);
    }
    
    processBufferAndRender(newText) {
        let tempText = newText;
        while(tempText.length > 0) {
            const nlIdx = tempText.indexOf('\n');
            if (nlIdx === -1) {
                this.writeToMonaco(tempText); 
                break;
            } else {
                const linePart = tempText.slice(0, nlIdx + 1);
                this.writeToMonaco(linePart);
                tempText = tempText.slice(nlIdx + 1);
            }
        }
    }
    
    writeToMonaco(text) {
        if (!this.isMonacoReady) {
            this.pendingData.push(text);
            return;
        }
        const model = this.monacoModel;
        
        const lastLine = model.getLineCount();
        const lastLen = model.getLineLength(lastLine);
        
        model.applyEdits([{
            range: new monaco.Range(lastLine, lastLen + 1, lastLine, lastLen + 1),
            text: text
        }]);
        
        const currentLastLine = model.getLineCount();
        this.checkAndAddDelta(currentLastLine);
        
        if (text.includes('\n')) {
            this.checkAndAddDelta(currentLastLine - 1);
        }
        
        this.checkBufferLimit();

        if (this.elements.autoScroll.checked) {
            this.editor.revealLine(currentLastLine);
        }
    }

    checkBufferLimit(force = false) {
        if (!this.monacoModel) return;
        
        const maxLines = this.config.maxLines;
        const currentLines = this.monacoModel.getLineCount();
        const threshold = force ? 0 : Math.max(10, maxLines * 0.1);
        
        if (currentLines > maxLines + threshold) {
            const linesToDelete = currentLines - maxLines;
            this.monacoModel.applyEdits([{
                range: new monaco.Range(1, 1, linesToDelete + 1, 1),
                text: null
            }]);
        }
    }
    
    checkAndAddDelta(lineNumber) {
        if (lineNumber < 1) return;
        const model = this.monacoModel;
        const lineContent = model.getLineContent(lineNumber);
        
        if (!lineContent.trim().startsWith('[')) return;

        const lineDecos = this.editor.getLineDecorations(lineNumber);
        const hasTimeDeco = lineDecos.some(d => 
            d.options.beforeContentClassName && d.options.beforeContentClassName.includes('delta-')
        );
        if (hasTimeDeco) return;

        const timeMatch = lineContent.match(/^\[(\d{2}):(\d{2}):(\d{2})\/(\d{3})\]/);
        if (timeMatch) {
            const now = new Date();
            now.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), parseInt(timeMatch[3]), parseInt(timeMatch[4]));
            const currentTime = now.getTime();
            
            if (this.sessionStartTime === null) {
                this.sessionStartTime = currentTime;
            }

            let startStr = 'T+0.000s'; 
            let deltaStr = '+0ms';
            let decorationClass = 'delta-normal';
            
            // 1. Total Time
            if (this.sessionStartTime !== null) {
                const diffStart = currentTime - this.sessionStartTime;
                if (diffStart >= 0) {
                    startStr = `T+${(diffStart/1000).toFixed(3)}s`;
                }
            }

            // 2. Delta Time
            if (this.lastParsedTime !== null) {
                const diff = currentTime - this.lastParsedTime;
                if (diff >= 0 && diff < 3600000) { 
                    if (diff >= 1000) deltaStr = `+${(diff/1000).toFixed(2)}s`;
                    else deltaStr = `+${diff}ms`;
                    
                    if (diff >= 2000) decorationClass = 'delta-2000';
                    else if (diff >= 1000) decorationClass = 'delta-1000';
                    else if (diff >= 300) decorationClass = 'delta-300';
                    else if (diff >= 100) decorationClass = 'delta-100';
                }
            }
            
            this.lastParsedTime = currentTime;
            
            const displayContent = `${startStr.padEnd(10, ' ')} | ${deltaStr.padEnd(7, ' ')}   `;

            const newDeco = {
                range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                options: {
                    isWholeLine: true,
                    before: {
                        content: displayContent,
                        inlineClassName: `delta-base ${decorationClass}`
                    }
                }
            };

            const addedIds = model.deltaDecorations([], [newDeco]);
            this.editorDecorations.push(...addedIds);
        }
    }

    // ================= 导入导出 =================

    exportLog() {
        if (!this.monacoModel) return;
        const content = this.monacoModel.getValue();
        
        if (!content) { this.log('没有可导出的内容', 'warning'); return; }
        
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

    importLog(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.clearReceive(); 
            
            // 1. 设置纯文本
            this.monacoModel.setValue(content);
            this.elements.byteCount.textContent = new TextEncoder().encode(content).length;
            
            // 2. 重新计算所有行的时间差
            const lineCount = this.monacoModel.getLineCount();
            const newDecorations = [];
            
            // 重置状态，确保从文件第一行开始计算
            this.sessionStartTime = null;
            this.lastParsedTime = null;

            for (let i = 1; i <= lineCount; i++) {
                const lineContent = this.monacoModel.getLineContent(i);
                if (!lineContent.trim()) continue;

                const timeMatch = lineContent.match(/^\[(\d{2}):(\d{2}):(\d{2})\/(\d{3})\]/);
                if (timeMatch) {
                    const now = new Date();
                    now.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), parseInt(timeMatch[3]), parseInt(timeMatch[4]));
                    const t = now.getTime();
                    
                    // 关键：将文件中发现的第一个时间戳设为 T+0
                    if (this.sessionStartTime === null) this.sessionStartTime = t;
                    
                    let startStr = 'T+0.000s';
                    let deltaStr = '+0ms';
                    let decorationClass = 'delta-normal';

                    // 计算 Total
                    if (this.sessionStartTime !== null) {
                        const diffStart = t - this.sessionStartTime;
                        if (diffStart >= 0) startStr = `T+${(diffStart/1000).toFixed(3)}s`;
                    }

                    // 计算 Delta
                    if (this.lastParsedTime !== null) {
                        const diff = t - this.lastParsedTime;
                        if (diff >= 0 && diff < 3600000) {
                            if (diff >= 1000) deltaStr = `+${(diff/1000).toFixed(2)}s`;
                            else deltaStr = `+${diff}ms`;
                            
                            if (diff >= 2000) decorationClass = 'delta-2000';
                            else if (diff >= 1000) decorationClass = 'delta-1000';
                            else if (diff >= 300) decorationClass = 'delta-300';
                            else if (diff >= 100) decorationClass = 'delta-100';
                        }
                    }
                    this.lastParsedTime = t;

                    const displayContent = `${startStr.padEnd(10, ' ')} | ${deltaStr.padEnd(7, ' ')}   `;
                    
                    newDecorations.push({
                        range: new monaco.Range(i, 1, i, 1),
                        options: {
                            isWholeLine: true,
                            before: {
                                content: displayContent,
                                inlineClassName: `delta-base ${decorationClass}`
                            }
                        }
                    });
                }
            }
            
            // 批量应用装饰器
            const addedIds = this.monacoModel.deltaDecorations([], newDecorations);
            this.editorDecorations.push(...addedIds);
            
            this.log(`已加载文件: ${file.name}`, 'success');
            this.elements.fileInput.value = '';
        };
        reader.readAsText(file);
    }

    // ================= 标准串口功能 =================
    
    clearReceive() {
        if (this.monacoModel) {
            this.monacoModel.setValue('');
            this.monacoModel.deltaDecorations(this.editorDecorations, []);
            this.editorDecorations = [];
        }
        this.elements.byteCount.textContent = '0';
        this.lastParsedTime = null;
        this.sessionStartTime = null; 
    }

    async requestNewPort() {
        try {
            if (!navigator.serial) throw new Error('浏览器不支持 Web Serial API');
            const port = await navigator.serial.requestPort();
            if (port) {
                this.log('设备授权成功');
                await this.refreshPorts();
                const ports = await navigator.serial.getPorts();
                this.elements.portSelect.value = ports.indexOf(port);
            }
        } catch (error) {
            if (error.name !== 'NotFoundError') this.log(`请求设备失败: ${error.message}`, 'error');
        }
    }
    
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
                    const label = info.usbProductId ? `USB设备 (PID:${info.usbProductId.toString(16).toUpperCase()})` : `串口设备 ${index + 1}`;
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = label;
                    this.elements.portSelect.appendChild(option);
                });
            }
            if (currentVal !== '' && currentVal < ports.length) this.elements.portSelect.value = currentVal;
        } catch (error) {
            this.log(`刷新列表失败: ${error.message}`, 'error');
        }
    }
    
    async connect() {
        const portIndex = this.elements.portSelect.value;
        if (portIndex === '') { this.log('请先选择串口设备', 'warning'); return; }
        try {
            const ports = await navigator.serial.getPorts();
            this.port = ports[portIndex];
            await this.port.open({
                baudRate: this.config.baudRate,
                dataBits: this.config.dataBits,
                stopBits: this.config.stopBits,
                parity: this.config.parity,
                bufferSize: 8192
            });
            this.isConnected = true;
            this.keepReading = true;
            this.lastMsgEndsWithNewline = true;
            this.lastParsedTime = null; 
            this.updateConnectionStatus();
            this.log(`已连接 (波特率: ${this.config.baudRate})`, 'success');
            this.readLoop();
        } catch (error) {
            this.log(`连接失败: ${error.message}`, 'error');
            this.disconnect();
        }
    }
    
    async disconnect() {
        this.keepReading = false;
        if (this.reader) try { await this.reader.cancel(); } catch (e) {}
        if (this.writer) try { await this.writer.close(); } catch (e) {}
        if (this.port) try { await this.port.close(); } catch (e) { console.error(e); }
        this.isConnected = false;
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.updateConnectionStatus();
        this.log('已断开连接', 'warning');
    }
    
    async readLoop() {
        while (this.port.readable && this.keepReading) {
            this.reader = this.port.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    if (value) this.handleIncomingData(value);
                }
            } catch (error) {
                if (this.keepReading) this.log(`读取错误: ${error.message}`, 'error');
            } finally {
                this.reader.releaseLock();
            }
        }
    }
    
    async sendData() {
        if (!this.port || !this.port.writable) return;
        const rawInput = this.elements.sendArea.value;
        if (!rawInput) return;
        try {
            const isHex = this.elements.hexSend.checked;
            const appendNL = this.elements.appendNewline.checked;
            let dataToSend;
            if (isHex) {
                const cleanHex = rawInput.replace(/[^0-9a-fA-F]/g, '');
                if (cleanHex.length % 2 !== 0) { this.log('Hex长度必须是偶数', 'warning'); return; }
                const bytes = new Uint8Array(cleanHex.length / 2);
                for (let i = 0; i < cleanHex.length; i += 2) bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
                dataToSend = bytes;
            } else {
                let text = rawInput;
                if (appendNL) text += '\r\n';
                dataToSend = new TextEncoder().encode(text);
            }
            const writer = this.port.writable.getWriter();
            await writer.write(dataToSend);
            writer.releaseLock();
            this.log(`已发送 ${dataToSend.byteLength} 字节`);
        } catch (error) {
            this.log(`发送失败: ${error.message}`, 'error');
        }
    }
    
    updateConnectionStatus() {
        const isConnected = this.isConnected;
        const color = isConnected ? '#4CAF50' : '#F44336';
        if (this.elements.statusIndicator) this.elements.statusIndicator.style.color = color;
        if (this.elements.statusText) {
            this.elements.statusText.textContent = isConnected ? '已连接' : '未连接';
            this.elements.statusText.style.color = color;
        }
        this.elements.connectBtn.disabled = isConnected;
        this.elements.disconnectBtn.disabled = !isConnected;
        this.elements.sendBtn.disabled = !isConnected;
        this.elements.portSelect.disabled = isConnected;
        this.elements.baudRate.disabled = isConnected;
        this.elements.requestPortBtn.disabled = isConnected;
    }
    
    updateSendButton() {
        this.elements.sendBtn.disabled = !this.isConnected || this.elements.sendArea.value.length === 0;
    }
    
    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMsg = `[${timestamp}] ${msg}`;
        console.log(formattedMsg); 
    }
}

if (typeof DesktopSystem !== 'undefined') {
    DesktopSystem.registerApp({
        id: 'serial',
        title: '串口调试助手',
        icon: '🔌',
        width: '980px',
        height: '750px',
        content: (instanceId) => {
            setTimeout(() => { new SerialConsole(`serial-app-${instanceId}`); }, 0);
            return `<div id="serial-app-${instanceId}" style="height:100%"></div>`;
        }
    });
}

if (!document.getElementById('serial-console-style')) {
    const style = document.createElement('style');
    style.id = 'serial-console-style';
    style.textContent = `
    .serial-console { display: flex; flex-direction: column; height: 100%; padding: 10px; box-sizing: border-box; background: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .serial-controls { background: #fff; padding: 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 8px; }
    .config-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .config-item { display: flex; flex-direction: column; gap: 2px; }
    .config-item label { font-size: 10px; color: #666; font-weight: 500; text-align: center; }
    .config-item select, .config-item input { padding: 3px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; min-width: 80px; }
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
    
    .receive-window { flex: 1; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
    
    /* Delta Colors for Monaco Decorations */
    .delta-base { opacity: 0.8; font-size: 11px; font-family: 'Consolas', monospace; display: inline-block; }
    .delta-normal { color: #999; }
    .delta-100 { color: #2196F3 !important; font-weight: bold; }
    .delta-300 { color: #FF9800 !important; font-weight: bold; }
    .delta-1000 { color: #F44336 !important; font-weight: bold; }
    .delta-2000 { color: #9C27B0 !important; font-weight: bold; }
    
    textarea { flex: 1; resize: none; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; line-height: 1.4; outline: none; }
    textarea:focus { border-color: #2196F3; }
    
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