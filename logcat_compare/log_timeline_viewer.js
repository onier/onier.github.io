<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LogWorkbench Pro (Resizable)</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.min.js"></script>
    <style>
        body { margin: 0; height: 100vh; display: flex; flex-direction: column; background: #fff; color: #333; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
        
        /* 通用控件 */
        input, button { background: #fff; border: 1px solid #ccc; color: #333; padding: 4px 8px; outline: none; font-family: inherit; font-size: 12px; border-radius: 2px; }
        input:focus, button:hover { border-color: #007acc; background: #f0f7ff; }
        button:active { background: #e6f0ff; }
        
        /* 布局 */
        #header { height: 40px; display: flex; align-items: center; padding: 0 10px; gap: 8px; border-bottom: 1px solid #ddd; background: #f8f8f8; user-select: none; }
        #main { flex: 1; display: flex; overflow: hidden; position: relative; }
        #sidebar { width: 220px; background: #f8f8f8; border-right: 1px solid #ddd; display: flex; flex-direction: column; z-index: 10; }
        #fileList { flex: 1; overflow-y: auto; background: #fff; }
        #canvasWrap { flex: 1; position: relative; overflow: hidden; cursor: grab; background: #fff; z-index: 1; }
        #canvasWrap:active { cursor: grabbing; }

        /* 侧边栏 */
        .file-item { padding: 8px; border-bottom: 1px solid #eee; cursor: pointer; border-left: 3px solid transparent; font-size: 12px; }
        .file-item:hover { background: #f0f0f0; }
        .file-item.active { background: #e6f3ff; border-left-color: #007acc; }
        .prop-panel { padding: 10px; border-top: 1px solid #ddd; background: #f8f8f8; font-size: 11px; display: none; }
        .prop-panel.show { display: block; }

        /* Tooltip */
        #tooltip { position: absolute; display: none; pointer-events: none; background: rgba(255,255,255,0.95); border: 1px solid #bbb; padding: 6px; font-size: 11px; color: #333; max-width: 400px; z-index: 999; white-space: pre-wrap; word-break: break-all; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .hl { background: #fffacd; color: #d32f2f; border-bottom: 1px solid #d32f2f; }
        #emptyTip { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #999; pointer-events: none; }

        /* --- 浮动窗口样式 --- */
        .win-box {
            position: absolute; top: 50px; left: 250px; width: 600px; height: 400px;
            background: #fff; border: 1px solid #ccc; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex; flex-direction: column; border-radius: 4px; overflow: hidden;
            z-index: 100; min-width: 200px; min-height: 100px;
        }
        /* 最小化样式 */
        .win-box.minimized { height: 32px !important; width: 200px !important; overflow: hidden; }
        .win-box.minimized .win-resize-handle { display: none; } /* 最小化时隐藏调整手柄 */

        .win-header {
            height: 32px; background: #f0f0f0; border-bottom: 1px solid #ddd;
            display: flex; align-items: center; justify-content: space-between;
            padding: 0 8px; cursor: move; user-select: none; flex-shrink: 0;
        }
        .win-header.active { background: #e6f3ff; }
        .win-title { font-weight: bold; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%; }
        .win-ctrls { display: flex; gap: 6px; }
        .win-btn { width: 12px; height: 12px; border-radius: 50%; border: none; cursor: pointer; padding: 0; }
        .win-btn-min { background: #f5c542; }
        .win-btn-close { background: #ff5f57; }
        
        .win-body { flex: 1; position: relative; overflow: hidden; background: #fff; }
        
        /* 调整大小的手柄 (右下角) */
        .win-resize-handle {
            position: absolute; bottom: 0; right: 0;
            width: 15px; height: 15px;
            cursor: se-resize;
            z-index: 10;
            /* 用渐变画一个小三角 */
            background: linear-gradient(135deg, transparent 50%, #ccc 50%);
        }
        
        .monaco-editor { padding-top: 4px; }
    </style>
</head>
<body>

<div id="header">
    <b style="color:#007acc">LogWB Pro</b>
    <button onclick="document.getElementById('fileIn').click()">+ 添加文件</button>
    <input type="file" id="fileIn" multiple style="display:none" accept=".log,.txt,.csv">
    <input type="text" id="globalFilter" placeholder="全局正则过滤..." style="width:120px">
    <button onclick="applyFilter()">应用</button>
    <input type="text" id="jumpTime" placeholder="HH:MM:SS" style="width:80px" onkeydown="if(event.key==='Enter') jumpTo()">
    <button onclick="jumpTo()">Go</button>
    <div style="flex:1"></div>
    <button id="modeBtn" onclick="toggleMode()">模式: 绝对时间</button>
    <button onclick="clearAll()" style="color:#d32f2f; border-color:#ffcccc; background:#fff5f5">清空</button>
</div>

<div id="main">
    <div id="sidebar">
        <div id="fileList"></div>
        <div id="propPanel" class="prop-panel">
            <div style="margin-bottom:4px;color:#007acc;font-weight:bold" id="selFileName"></div>
            <input id="selFilter" type="text" placeholder="当前文件独立过滤..." style="width:100%;box-sizing:border-box" onkeydown="if(event.key==='Enter') updateSelFilter()">
            <div style="margin-top:6px;display:flex;justify-content:space-between">
                <button onclick="updateSelFilter()">更新视图</button>
                <button onclick="removeSel()" style="color:#d32f2f">移除文件</button>
            </div>
        </div>
    </div>
    <div id="canvasWrap">
        <canvas id="cvs"></canvas>
        <div id="tooltip"></div>
        <div id="emptyTip">拖拽文件至此 / 点击添加</div>
    </div>
    <div id="winContainer"></div>
</div>

<script>
    // --- Monaco Init ---
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
    let monacoReady = false;
    require(['vs/editor/editor.main'], function() {
        monacoReady = true;
        console.log("Monaco Editor Loaded");
    });

    // --- Core Data ---
    const state = {
        files: [],
        selId: null,
        scale: 0.05,
        offset: 50,
        mode: 'abs',
        minTs: Infinity,
        maxTs: -Infinity
    };
    
    const COLORS = { err: '#d32f2f', warn: '#f57c00', ok: '#388e3c', stop: '#1976d2', def: '#757575' };
    const DOM = {
        cvs: document.getElementById('cvs'),
        ctx: document.getElementById('cvs').getContext('2d', {alpha: false}),
        wrap: document.getElementById('canvasWrap'),
        list: document.getElementById('fileList'),
        tip: document.getElementById('tooltip'),
        prop: document.getElementById('propPanel'),
        fName: document.getElementById('selFileName'),
        fFilter: document.getElementById('selFilter'),
        winContainer: document.getElementById('winContainer')
    };

    // --- Window Manager ---
    const WinMgr = {
        zIndex: 100,
        instances: {}, 

        createOrShow: function(file) {
            if (!monacoReady) { alert("编辑器资源正在加载中，请稍后..."); return; }
            
            if (this.instances[file.id]) {
                const inst = this.instances[file.id];
                this.bringToFront(inst.el);
                if (inst.minimized) this.toggleMin(file.id);
                return inst;
            }

            const el = document.createElement('div');
            el.className = 'win-box';
            el.style.zIndex = ++this.zIndex;
            const offset = Object.keys(this.instances).length * 20;
            el.style.top = (50 + offset) + 'px';
            el.style.left = (250 + offset) + 'px';

            // 增加 .win-resize-handle
            el.innerHTML = `
                <div class="win-header" onmousedown="WinMgr.startDrag(event, '${file.id}')">
                    <span class="win-title" style="color:${file.color}">📄 ${file.name}</span>
                    <div class="win-ctrls">
                        <button class="win-btn win-btn-min" title="折叠/展开" onclick="WinMgr.toggleMin('${file.id}')"></button>
                        <button class="win-btn win-btn-close" title="关闭" onclick="WinMgr.close('${file.id}')"></button>
                    </div>
                </div>
                <div class="win-body" id="editor-${file.id}"></div>
                <div class="win-resize-handle" onmousedown="WinMgr.startResize(event, '${file.id}')"></div>
            `;
            
            el.onmousedown = () => this.bringToFront(el);
            DOM.winContainer.appendChild(el);

            const editor = monaco.editor.create(document.getElementById(`editor-${file.id}`), {
                value: file.lines.join('\n'),
                language: 'log',
                theme: 'vs',
                readOnly: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: false, // 我们手动控制layout以提高性能
                fontFamily: 'Consolas, monospace',
                fontSize: 12
            });

            // 监听窗口大小变化自动布局（作为兜底）
            new ResizeObserver(() => editor.layout()).observe(el);

            this.instances[file.id] = { el, editor, minimized: false, fileId: file.id };
            return this.instances[file.id];
        },

        jumpToLine: function(fileId, lineIdx) {
            const inst = this.instances[fileId];
            if (!inst) return;
            const lineNum = lineIdx + 1; 
            inst.editor.revealLineInCenter(lineNum);
            inst.editor.setPosition({ column: 1, lineNumber: lineNum });
            inst.editor.focus();
            inst.editor.setSelection(new monaco.Range(lineNum, 1, lineNum, 1000));
        },

        close: function(id) {
            if (this.instances[id]) {
                this.instances[id].editor.dispose();
                this.instances[id].el.remove();
                delete this.instances[id];
            }
        },

        toggleMin: function(id) {
            const inst = this.instances[id];
            if (!inst) return;
            inst.minimized = !inst.minimized;
            if (inst.minimized) {
                inst.el.classList.add('minimized');
                inst.savedHeight = inst.el.style.height;
            } else {
                inst.el.classList.remove('minimized');
                inst.el.style.height = inst.savedHeight || '400px';
                // 恢复时重新布局
                setTimeout(() => inst.editor.layout(), 50);
            }
        },

        bringToFront: function(el) {
            el.style.zIndex = ++this.zIndex;
            const header = el.querySelector('.win-header');
            document.querySelectorAll('.win-header').forEach(h => h.classList.remove('active'));
            if(header) header.classList.add('active');
        },

        startDrag: function(e, id) {
            if(e.target.tagName === 'BUTTON') return;
            const inst = this.instances[id];
            const el = inst.el;
            this.bringToFront(el);
            
            const startX = e.clientX;
            const startY = e.clientY;
            const rect = el.getBoundingClientRect();
            const startLeft = rect.left;
            const startTop = rect.top;

            const move = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                el.style.left = (startLeft + dx) + 'px';
                el.style.top = (startTop + dy) + 'px';
            };
            const up = () => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        },

        // 新增：调整大小逻辑
        startResize: function(e, id) {
            e.stopPropagation(); // 防止冒泡触发置顶等其他逻辑
            const inst = this.instances[id];
            const el = inst.el;
            this.bringToFront(el);

            const startX = e.clientX;
            const startY = e.clientY;
            const startW = parseInt(document.defaultView.getComputedStyle(el).width, 10);
            const startH = parseInt(document.defaultView.getComputedStyle(el).height, 10);

            const move = (ev) => {
                const newW = startW + (ev.clientX - startX);
                const newH = startH + (ev.clientY - startY);
                // 设置最小尺寸限制
                el.style.width = Math.max(200, newW) + 'px';
                el.style.height = Math.max(100, newH) + 'px';
                
                // 关键：实时通知编辑器重新布局
                inst.editor.layout();
            };
            const up = () => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
            };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
    };

    // --- Init ---
    window.onresize = render;
    document.getElementById('fileIn').onchange = e => loadFiles(e.target.files);
    
    DOM.wrap.addEventListener('wheel', e => {
        e.preventDefault();
        const mx = e.offsetX;
        const ts = (mx - state.offset) / state.scale;
        state.scale *= (e.deltaY < 0 ? 1.1 : 0.9);
        state.scale = Math.max(0.0001, Math.min(50, state.scale));
        state.offset = mx - ts * state.scale;
        render();
    }, {passive:false});

    let drag = { on: false, x: 0, moved: false };
    DOM.wrap.onmousedown = e => { 
        drag.on = true; drag.x = e.clientX; drag.moved = false;
        DOM.wrap.style.cursor = 'grabbing'; 
    };
    window.onmouseup = () => { 
        drag.on = false; DOM.wrap.style.cursor = 'grab'; 
    };
    window.onmousemove = e => {
        if(drag.on) {
            const dx = e.clientX - drag.x;
            if (Math.abs(dx) > 2) drag.moved = true;
            state.offset += dx;
            drag.x = e.clientX;
            render();
        } else showTooltip(e);
    };

    DOM.wrap.onclick = e => {
        if (drag.moved) return;
        const hit = getHitEvent(e);
        if (hit) {
            const file = state.files.find(f => f.events.includes(hit));
            if (file) {
                WinMgr.createOrShow(file);
                WinMgr.jumpToLine(file.id, hit.lineIdx);
            }
        }
    };

    // --- Logic ---
    async function loadFiles(files) {
        if(!files.length) return;
        document.getElementById('emptyTip').style.display = 'none';
        const globalF = document.getElementById('globalFilter').value;
        
        for(let f of files) {
            const text = await f.text();
            state.files.push({
                id: Date.now() + Math.random(),
                name: f.name,
                lines: text.split(/\r?\n/),
                events: [],
                color: `hsl(${Math.random()*360},60%,45%)`,
                filter: globalF
            });
        }
        parseAll(true);
    }

    function parseAll(resetView=false) {
        state.minTs = Infinity; state.maxTs = -Infinity;
        const timeReg = /^\s*\[?(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}[,.]\d{3,6})\]?/;

        state.files.forEach(f => {
            f.events = [];
            let reg = null;
            try { if(f.filter) reg = new RegExp(f.filter, 'i'); } catch(e){}
            let base = null;

            for(let i = 0; i < f.lines.length; i++) {
                const line = f.lines[i];
                if(reg && !reg.test(line)) continue;
                const m = timeReg.exec(line);
                if(m) {
                    const tStr = m[1].replace(',', '.');
                    const ts = new Date(tStr).getTime();
                    if(!isNaN(ts)) {
                        if(base === null) base = ts;
                        let txt = line.substring(m[0].length).trim();
                        let c = f.color;
                        const lc = txt.toLowerCase();
                        if(/error|fail|fatal|exception/.test(lc)) c = COLORS.err;
                        else if(/warn|alert/.test(lc)) c = COLORS.warn;
                        else if(/start|begin|init|success/.test(lc)) c = COLORS.ok;
                        else if(/stop|shut|end/.test(lc)) c = COLORS.stop;

                        f.events.push({ abs: ts, rel: ts - base, txt, c, rawT: tStr, lineIdx: i });
                    }
                }
            }
            if(f.events.length) {
                const s = state.mode==='abs' ? f.events[0].abs : 0;
                const e = state.mode==='abs' ? f.events[f.events.length-1].abs : f.events[f.events.length-1].rel;
                if(s < state.minTs) state.minTs = s;
                if(e > state.maxTs) state.maxTs = e;
            }
        });

        renderList();
        if(resetView && state.minTs !== Infinity) {
            const span = state.maxTs - state.minTs || 1000;
            state.scale = DOM.wrap.clientWidth / (span * 1.2);
            state.offset = 50 - state.minTs * state.scale;
        }
        render();
    }

    function render() {
        const w = DOM.wrap.clientWidth;
        const h = DOM.wrap.clientHeight;
        DOM.cvs.width = w; DOM.cvs.height = h;
        const ctx = DOM.ctx;
        
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
        if(!state.files.length) return;

        const startT = (0 - state.offset) / state.scale;
        const endT = (w - state.offset) / state.scale;
        
        let timeStep = 1000; 
        if(state.scale < 0.001) timeStep = 60000;
        if(state.scale < 0.00005) timeStep = 3600000;
        
        ctx.beginPath();
        for(let t = Math.floor(startT/timeStep)*timeStep; t < endT; t+=timeStep) {
            const x = t * state.scale + state.offset;
            ctx.moveTo(x, 30); ctx.lineTo(x, h);
            
            let label = '';
            if(state.mode==='abs') {
                const d = new Date(t);
                label = d.toTimeString().split(' ')[0];
            } else label = (t/1000).toFixed(1)+'s';
            
            ctx.fillStyle = '#888'; ctx.fillText(label, x+2, 20);
        }
        ctx.strokeStyle = '#f0f0f0'; ctx.stroke();

        const rowH = 100;
        state.files.forEach((f, i) => {
            const y = 30 + i * rowH;
            ctx.fillStyle = (i%2===0) ? '#ffffff' : '#fafafa';
            ctx.fillRect(0, y, w, rowH);
            
            if(f.id === state.selId) { 
                ctx.strokeStyle='#b3d9ff'; ctx.lineWidth = 2;
                ctx.strokeRect(1,y+1,w-2,rowH-2); ctx.lineWidth = 1;
            }
            
            ctx.fillStyle = f.color; ctx.font = 'bold 12px monospace';
            ctx.fillText(f.name, 10, y+20);

            const cy = y + rowH/2;
            for(let e of f.events) {
                const t = state.mode==='abs' ? e.abs : e.rel;
                if(t < startT || t > endT) continue;
                const x = t * state.scale + state.offset;
                
                ctx.fillStyle = e.c;
                ctx.beginPath(); ctx.arc(x, cy, 3, 0, Math.PI*2); ctx.fill();
                
                if(state.scale > 0.01) {
                    ctx.fillStyle = '#666'; ctx.font = '10px monospace';
                    ctx.fillText(e.txt.slice(0,15), x, cy+15);
                }
            }
            ctx.strokeStyle='#eee'; ctx.beginPath(); ctx.moveTo(0,y+rowH); ctx.lineTo(w,y+rowH); ctx.stroke();
        });
    }

    function renderList() {
        DOM.list.innerHTML = '';
        state.files.forEach(f => {
            const d = document.createElement('div');
            d.className = `file-item ${f.id===state.selId?'active':''}`;
            d.style.borderLeftColor = f.color;
            d.innerHTML = `<div>${f.name}</div><div style="color:#999">${f.events.length} lines</div>`;
            d.onclick = () => {
                state.selId = f.id;
                DOM.fName.innerText = f.name;
                DOM.fName.style.color = f.color;
                DOM.fFilter.value = f.filter || '';
                DOM.prop.classList.add('show');
                renderList(); render();
            };
            DOM.list.appendChild(d);
        });
        if(!state.selId) DOM.prop.classList.remove('show');
    }

    function getHitEvent(e) {
        const rect = DOM.cvs.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if(y < 30) return null;
        
        const idx = Math.floor((y-30)/100);
        if(idx >= 0 && idx < state.files.length) {
            const f = state.files[idx];
            const mx = e.clientX - rect.left;
            const tHover = (mx - state.offset) / state.scale;
            
            let hit = null, minD = 5 / state.scale; 
            for(let evt of f.events) {
                const t = state.mode==='abs' ? evt.abs : evt.rel;
                const d = Math.abs(t - tHover);
                if(d < minD) { minD = d; hit = evt; }
            }
            return hit;
        }
        return null;
    }

    function showTooltip(e) {
        const hit = getHitEvent(e);
        if(hit) {
            DOM.tip.style.display = 'block';
            DOM.tip.style.left = (e.clientX+10)+'px';
            DOM.tip.style.top = (e.clientY+10)+'px';
            const f = state.files.find(file => file.events.includes(hit));
            let content = hit.txt.replace(/</g, '&lt;');
            if(f && f.filter) content = content.replace(new RegExp(`(${f.filter})`,'gi'), '<span class="hl">$1</span>');
            DOM.tip.innerHTML = `<div style="color:#007acc;border-bottom:1px solid #eee;padding-bottom:2px;margin-bottom:2px">${hit.rawT}</div><div style="color:#333">${content}</div><div style="font-size:9px;color:#999;margin-top:2px">点击打开文件</div>`;
        } else DOM.tip.style.display='none';
    }

    // --- Actions ---
    function applyFilter() {
        const v = document.getElementById('globalFilter').value;
        state.files.forEach(f => f.filter = v);
        parseAll(true);
    }
    function updateSelFilter() {
        const f = state.files.find(x => x.id === state.selId);
        if(f) { f.filter = DOM.fFilter.value; parseAll(false); }
    }
    function removeSel() {
        if (state.selId) WinMgr.close(state.selId);
        state.files = state.files.filter(x => x.id !== state.selId);
        state.selId = null;
        if(!state.files.length) document.getElementById('emptyTip').style.display='block';
        parseAll(true);
    }
    function clearAll() {
        state.files.forEach(f => WinMgr.close(f.id));
        state.files = []; state.selId = null;
        document.getElementById('emptyTip').style.display='block';
        parseAll();
    }
    function toggleMode() {
        state.mode = state.mode === 'abs' ? 'rel' : 'abs';
        document.getElementById('modeBtn').innerText = '模式: ' + (state.mode==='abs'?'绝对时间':'起点对齐');
        parseAll(true);
    }
    function jumpTo() {
        const val = document.getElementById('jumpTime').value.trim();
        if(!val || !state.files.length) return;
        let ts = 0;
        if(val.includes(':')) {
            const base = new Date(state.minTs);
            const p = val.split(':');
            base.setHours(+p[0], +p[1], +p[2]||0, 0);
            ts = base.getTime();
        } else {
            ts = new Date(val).getTime();
        }
        if(!isNaN(ts)) {
            if(state.mode === 'rel') toggleMode();
            state.offset = (DOM.wrap.clientWidth/2) - (ts * state.scale);
            render();
        }
    }
</script>
</body>
</html>

