DesktopSystem.registerApp({
    id: 'editor',
    title: '记事本',
    icon: '📝',
    type: 'html',
    color: '#209cee', // 自定义窗口颜色
    // content 可以是一个函数，接收 instanceId，这样你可以为每个窗口生成唯一的 ID
    content: (instanceId) => {
        return `<textarea id="txt-${instanceId}" style="width:100%; height:100%; border:none; padding:10px; outline:none; font-family:monospace; resize:none;" placeholder="开始写作... (实例 ID: ${instanceId})"></textarea>`;
    }
});
