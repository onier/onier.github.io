// /**
//  * js/apps/terminal.js
//  * 提供通用的 WebShell 类，既可以独立运行，也可以被嵌入
//  */

// // 将 WebShell 挂载到 window 对象，确保其他文件能访问
// window.WebShell = class WebShell {
//     /**
//      * @param {HTMLElement} containerDOM - 终端要挂载的 DOM 元素
//      * @param {FileSystemDirectoryHandle} rootHandle - 挂载的文件句柄
//      * @param {String} pathLabel - 初始路径显示文本
//      */
//     constructor(containerDOM, rootHandle = null, pathLabel = '/') {
//         this.container = containerDOM;
//         this.rootHandle = rootHandle;
//         this.currentHandle = rootHandle;
//         this.pathStack = [];
//         this.pathString = pathLabel;
//         this.commandBuffer = '';

//         this.initXterm();
//     }

//     initXterm() {
//         // 1. 创建 Xterm 实例
//         this.term = new Terminal({
//             cursorBlink: true,
//             fontSize: 13,
//             fontFamily: 'Consolas, "Courier New", monospace',
//             theme: {
//                 background: '#1e1e1e',
//                 foreground: '#f0f0f0'
//             },
//             convertEol: true // 自动转换换行符
//         });

//         // 2. 加载适配插件
//         this.fitAddon = new FitAddon.FitAddon();
//         this.term.loadAddon(this.fitAddon);

//         // 3. 挂载
//         this.term.open(this.container);
        
//         // 4. 初始提示
//         if (!this.rootHandle) {
//             this.term.writeln('WebShell ready. Use "mount" to access files.');
//         } else {
//             this.term.writeln(`\x1b[32mTerminal active in: ${this.pathString}\x1b[0m`);
//         }
        
//         this.prompt();

//         // 5. 绑定输入
//         this.term.onData(e => this.handleInput(e));

//         // 6. 初始调整大小 (延时一下确保 DOM 渲染完毕)
//         setTimeout(() => this.fit(), 50);
        
//         // 监听窗口大小变化
//         this.resizeObserver = new ResizeObserver(() => this.fit());
//         this.resizeObserver.observe(this.container);
//     }

//     fit() {
//         try {
//             this.fitAddon.fit();
//         } catch(e) {}
//     }

//     handleInput(e) {
//         switch (e) {
//             case '\r': // Enter
//                 this.term.write('\r\n');
//                 this.execute(this.commandBuffer.trim());
//                 this.commandBuffer = '';
//                 break;
//             case '\u007F': // Backspace
//                 if (this.commandBuffer.length > 0) {
//                     this.commandBuffer = this.commandBuffer.slice(0, -1);
//                     this.term.write('\b \b');
//                 }
//                 break;
//             default:
//                 if (e >= String.fromCharCode(0x20) && e <= String.fromCharCode(0x7e)) {
//                     this.commandBuffer += e;
//                     this.term.write(e);
//                 }
//         }
//     }

//     prompt() {
//         const path = `\x1b[1;34m${this.pathString}\x1b[0m`;
//         this.term.write(`user@winbox:${path}$ `);
//     }

//     // --- 命令执行逻辑 (与之前相同，略微精简) ---
//     async execute(input) {
//         if (!input) { this.prompt(); return; }
//         const [cmd, ...args] = input.split(' ');
//         const param = args.join(' '); // 简单处理参数

//         try {
//             switch (cmd) {
//                 case 'clear': this.term.clear(); break;
//                 case 'ls': await this.cmdLs(); break;
//                 case 'cd': await this.cmdCd(param); break;
//                 case 'cat': await this.cmdCat(param); break;
//                 case 'echo': await this.cmdEcho(input); break;
//                 case 'mkdir': await this.cmdMkdir(param); break;
//                 case 'rm': await this.cmdRm(param); break;
//                 case 'pwd': this.term.writeln(this.pathString); break;
//                 case 'help': this.term.writeln('ls, cd, cat, echo, mkdir, rm, clear'); break;
//                 default: this.term.writeln(`Command not found: ${cmd}`);
//             }
//         } catch (err) {
//             this.term.writeln(`\x1b[31mError: ${err.message}\x1b[0m`);
//         }
//         this.prompt();
//     }

//     ensureMounted() { if (!this.currentHandle) throw new Error('No folder mounted.'); }

//     async cmdLs() {
//         this.ensureMounted();
//         const items = [];
//         for await (const entry of this.currentHandle.values()) {
//             items.push(entry.kind === 'directory' ? `\x1b[1;34m${entry.name}/\x1b[0m` : entry.name);
//         }
//         this.term.writeln(items.join('  '));
//     }

//     async cmdCd(dir) {
//         this.ensureMounted();
//         if(!dir || dir==='.') return;
//         if(dir === '..') {
//             if(this.pathStack.length > 0) {
//                 this.pathStack.pop();
//                 this.currentHandle = this.pathStack.length ? this.pathStack[this.pathStack.length-1] : this.rootHandle;
//                 this.pathString = this.pathString.substring(0, this.pathString.lastIndexOf('/')) || '/';
//             }
//         } else {
//             const h = await this.currentHandle.getDirectoryHandle(dir);
//             this.pathStack.push(h);
//             this.currentHandle = h;
//             this.pathString = this.pathString === '/' ? `/${dir}` : `${this.pathString}/${dir}`;
//         }
//     }

//     async cmdCat(f) { 
//         this.ensureMounted(); 
//         const h = await this.currentHandle.getFileHandle(f); 
//         this.term.writeln((await (await h.getFile()).text()).replace(/\n/g, '\r\n')); 
//     }
    
//     async cmdMkdir(d) { 
//         this.ensureMounted(); 
//         await this.currentHandle.getDirectoryHandle(d, {create:true}); 
//     }
    
//     async cmdRm(n) { 
//         this.ensureMounted(); 
//         await this.currentHandle.removeEntry(n, {recursive:true}); 
//     }
    
//     async cmdEcho(input) {
//         this.ensureMounted();
//         const parts = input.split('>');
//         if(parts.length<2) return this.term.writeln(input.substring(5));
//         const content = parts[0].substring(5).trim().replace(/^"|"$/g, '');
//         const w = await (await this.currentHandle.getFileHandle(parts[1].trim(), {create:true})).createWritable();
//         await w.write(content); await w.close();
//     }
// };

// // 保持独立图标的注册 (可选)
// DesktopSystem.registerApp({
//     id: 'terminal',
//     title: '独立终端',
//     icon: '💻',
//     type: 'html',
//     content: (instanceId) => {
//         setTimeout(() => {
//             const el = document.getElementById(`term-standalone-${instanceId}`);
//             if(el) new window.WebShell(el);
//         }, 100);
//         return `<div id="term-standalone-${instanceId}" style="width:100%;height:100%;background:#1e1e1e;"></div>`;
//     }
// });
