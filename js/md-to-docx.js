/**
 * Markdown 转 Word 文档工具
 * 使用 marked + html-docx-js
 */

class MarkdownToDocx {
    constructor() {
        this.scriptsLoaded = false;
    }

    // 动态加载依赖库
    async loadDependencies() {
        if (this.scriptsLoaded) return;

        // 加载 marked（Markdown 转 HTML）
        if (!window.marked) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js');
        }

        // 加载 html-docx-js（HTML 转 DOCX）
        if (!window.htmlDocx) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js');
        }

        // 加载 FileSaver（保存文件）
        if (!window.saveAs) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js');
        }

        this.scriptsLoaded = true;
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 转换 Markdown 为 DOCX
    async convert(markdown, options = {}) {
        await this.loadDependencies();

        const {
            title = 'Document',
            includeImages = true,
            pageMargins = { top: 1440, right: 1440, bottom: 1440, left: 1440 } // twips
        } = options;

        // 1. Markdown 转 HTML
        const html = this.markdownToHtml(markdown);

        // 2. 包装成完整的 HTML 文档
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Microsoft YaHei', 'SimSun', Arial, sans-serif; }
                    h1 { font-size: 24pt; color: #333; }
                    h2 { font-size: 20pt; color: #444; }
                    h3 { font-size: 16pt; color: #555; }
                    p { font-size: 12pt; line-height: 1.5; }
                    code { background: #f4f4f4; padding: 2px 4px; font-family: Consolas, monospace; }
                    pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
                    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; }
                    th { background: #f2f2f2; }
                    img { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;

        // 3. HTML 转 DOCX Blob
        const blob = window.htmlDocx.asBlob(fullHtml, {
            orientation: 'portrait',
            margins: pageMargins
        });

        return blob;
    }

    // Markdown 转 HTML（使用 marked）
    markdownToHtml(markdown) {
        if (!window.marked) {
            throw new Error('marked library not loaded');
        }

        // 配置 marked
        window.marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: false,
            mangle: false
        });

        return window.marked.parse(markdown);
    }

    // 下载 DOCX 文件
    async download(markdown, filename = 'document.docx') {
        const blob = await this.convert(markdown, { title: filename.replace('.docx', '') });
        
        if (window.saveAs) {
            window.saveAs(blob, filename);
        } else {
            // 备用下载方案
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
}

// 导出工具函数
window.MarkdownToDocx = MarkdownToDocx;

// 便捷的独立函数
window.exportMarkdownToDocx = async function(markdown, filename) {
    const converter = new MarkdownToDocx();
    await converter.download(markdown, filename);
};
