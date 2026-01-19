DesktopSystem.registerApp({
    id: 'calc',
    title: '计算器',
    icon: '🧮',
    type: 'html',
    width: '300px',
    height: '400px',
    content: `
        <div style="display:flex; flex-direction:column; height:100%; padding:10px; background:#333;">
            <input type="text" style="width:100%; padding:10px; margin-bottom:10px; text-align:right;" placeholder="0">
            <div style="color:white; text-align:center;">(这里可以嵌入一个 JS 计算器逻辑)</div>
        </div>
    `
});
