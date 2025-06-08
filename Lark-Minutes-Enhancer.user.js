// ==UserScript==
// @name         飞书妙记增强脚本
// @name:en      Lark-Minutes-Enhancer
// @namespace    https://github.com/liaozhu913/Lark-Minutes-Enhancer
// @version      1.9
// @description  [v1.9] 终极版！通过分段读取、逐步累加的方式，完美解决“文字记录”因DOM复用导致的复制不全问题。
// @description:en [v1.9] Ultimate! Perfectly solves incomplete copy issue in transcripts caused by DOM recycling, by using a chunk-reading and accumulating strategy.
// @author       liaozhu913
// @match        https://*.feishu.cn/minutes/*
// @grant        GM_addStyle
// @run-at       document-end
// @icon         https://raw.githubusercontent.com/liaozhu913/Lark-Minutes-Enhancer/main/icon.png
// @homepageURL  https://github.com/liaozhu913/Lark-Minutes-Enhancer
// @supportURL   https://github.com/liaozhu913/Lark-Minutes-Enhancer/issues
// ==/UserScript==

(function() {
    'use strict';
    const SCRIPT_PREFIX = '[飞书妙记增强 v1.9]：';

    // ... UI样式, expandAllChapters, summaryToMarkdown 函数与 v1.8 相同 ...
    GM_addStyle(`
        #floating-copy-button:disabled { background-color: #868e96; cursor: not-allowed; }
        div.ai-quota-exceed-mask, div.linear-gradient-content { display: none !important; }
        #floating-copy-button {
            position: absolute; top: 15px; right: 20px; z-index: 9999;
            padding: 6px 12px; font-size: 14px; font-weight: bold; color: #fff;
            background-color: #007AFF; border: none; border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2); cursor: pointer;
            transition: all 0.2s ease-in-out;
        }
        #floating-copy-button:hover:not(:disabled) { background-color: #0056b3; transform: scale(1.05); }
        #floating-copy-button.success { background-color: #28a745; }
        #floating-copy-button.error { background-color: #dc3545; }
    `);
    function expandAllChapters() { /* ... */ }
    function summaryToMarkdown(element) { /* ... */ }

    // --- [核心解析器 2 - 重大升级!] 文字记录滚动读取器 ---
    async function transcriptToText(scrollContainer, button) {
        const collectedData = new Map(); // 使用Map来根据时间戳去重
        const originalScrollTop = scrollContainer.scrollTop;
        let lastScrollTop = -1;

        button.textContent = '读取中...';
        button.disabled = true;

        console.log(SCRIPT_PREFIX + '开始分段读取文字记录...');
        scrollContainer.scrollTop = 0; // 从头开始
        await new Promise(resolve => setTimeout(resolve, 100)); // 等待滚动生效

        while (scrollContainer.scrollTop !== lastScrollTop) {
            lastScrollTop = scrollContainer.scrollTop;

            const paragraphs = scrollContainer.querySelectorAll('.paragraph-editor-wrapper');
            paragraphs.forEach(p => {
                const timeEl = p.querySelector('.p-time');
                if (timeEl) {
                    const time = timeEl.getAttribute('time-content').trim();
                    if (!collectedData.has(time)) { // 如果是新的时间戳
                        const speakerEl = p.querySelector('.p-user-name');
                        const contentEl = p.querySelector('.mm-paragraph-content');
                        const speaker = speakerEl ? speakerEl.getAttribute('user-name-content').trim() : '未知';
                        const content = contentEl ? contentEl.innerText.trim() : '';
                        if (content) {
                            collectedData.set(time, `[${speaker} ${time}]\n${content}`);
                        }
                    }
                }
            });

            // 向下滚动一屏
            scrollContainer.scrollTop += scrollContainer.clientHeight;
            await new Promise(resolve => setTimeout(resolve, 100)); // 等待滚动和DOM更新
        }
        
        button.disabled = false;
        scrollContainer.scrollTop = originalScrollTop; // 恢复滚动条
        console.log(SCRIPT_PREFIX + `读取完毕，共收集到 ${collectedData.size} 条不重复的记录。`);

        // 将Map中的值（格式化好的文本）拼接起来
        return Array.from(collectedData.values()).join('\n\n');
    }

    // --- [功能 - 最终版!] 上下文感知的悬浮复制按钮 ---
    function addFloatingCopyButton() {
        const rightPanel = document.querySelector('div.detail-right-content');
        if (rightPanel && !document.getElementById('floating-copy-button')) {
            const copyButton = document.createElement('button');
            copyButton.id = 'floating-copy-button';
            copyButton.textContent = '复制为MD';

            copyButton.addEventListener('click', async () => {
                let contentToCopy = '';
                let contentType = '智能纪要';

                const summaryTab = document.querySelector('.summary-tab.right-tab-visible');
                const transcriptTab = document.querySelector('.transcript-tab.right-tab-visible');

                if (summaryTab) {
                    const contentWrapper = summaryTab.querySelector('.minutes-editable.ai-summary-content-editable');
                    if (contentWrapper) { contentToCopy = summaryToMarkdown(contentWrapper); }
                } else if (transcriptTab) {
                    contentType = '文字记录';
                    const scrollContainer = transcriptTab.querySelector('.rc-virtual-list-holder');
                    if (scrollContainer) {
                        contentToCopy = await transcriptToText(scrollContainer, copyButton); // 调用新的异步读取器
                    }
                }
                
                if (contentToCopy) {
                    navigator.clipboard.writeText(contentToCopy).then(/* ... */);
                }
            });

            rightPanel.style.position = 'relative';
            rightPanel.appendChild(copyButton);
        }
    }
    
    // 省略重复代码的完整实现
    function expandAllChapters() {
        const expandButton = document.querySelector('div.ai-summary-content-editable-expand-button-wrapper > button:not([data-expanded="true"])');
        if (expandButton && expandButton.textContent.includes('展开')) {
            expandButton.click();
            expandButton.setAttribute('data-expanded', 'true');
        }
    }
    function summaryToMarkdown(element) {
        let markdownText = '';
        function processNode(node, listLevel = 0) {
            if (node.nodeType === Node.TEXT_NODE) { markdownText += node.textContent; }
            else if (node.nodeType === Node.ELEMENT_NODE) {
                let prefix = '', suffix = '';
                let children = Array.from(node.childNodes);
                switch (node.tagName) {
                    case 'DIV': if (!node.classList.contains('list-div')) { suffix = '\n'; } break;
                    case 'UL': case 'OL': children.forEach(child => processNode(child, listLevel + 1)); return;
                    case 'LI': prefix = '  '.repeat(listLevel - 1) + '- '; suffix = '\n'; break;
                    case 'SPAN':
                        if (getComputedStyle(node).fontWeight === '700' || getComputedStyle(node).fontWeight === 'bold') { prefix = '**'; suffix = '**'; }
                        if (node.hasAttribute('data-enter')) { return; }
                        break;
                }
                markdownText += prefix;
                children.forEach(child => processNode(child, listLevel));
                markdownText += suffix;
            }
        }
        processNode(element);
        return markdownText.replace(/\n\s*\n/g, '\n').trim();
    }
    const fullAddFloatingCopyButton = addFloatingCopyButton;
    addFloatingCopyButton = function() {
        const rightPanel = document.querySelector('div.detail-right-content');
        if (rightPanel && !document.getElementById('floating-copy-button')) {
            const copyButton = document.createElement('button');
            copyButton.id = 'floating-copy-button';
            copyButton.textContent = '复制为MD';
            copyButton.addEventListener('click', async () => {
                let contentToCopy = '';
                let contentType = '智能纪要';
                const summaryTab = document.querySelector('.summary-tab.right-tab-visible');
                const transcriptTab = document.querySelector('.transcript-tab.right-tab-visible');
                if (summaryTab) {
                    const contentWrapper = summaryTab.querySelector('.minutes-editable.ai-summary-content-editable');
                    if (contentWrapper) { contentToCopy = summaryToMarkdown(contentWrapper); }
                } else if (transcriptTab) {
                    contentType = '文字记录';
                    const scrollContainer = transcriptTab.querySelector('.rc-virtual-list-holder');
                    if (scrollContainer) { contentToCopy = await transcriptToText(scrollContainer, copyButton); }
                }
                if (contentToCopy) {
                    navigator.clipboard.writeText(contentToCopy).then(() => {
                        console.log(SCRIPT_PREFIX + `${contentType}已成功复制。`);
                        copyButton.textContent = '复制成功!';
                        copyButton.className = 'success';
                        setTimeout(() => { copyButton.textContent = '复制为MD'; copyButton.className = ''; }, 2000);
                    }).catch(err => {
                        console.error(SCRIPT_PREFIX + '复制失败:', err);
                        copyButton.textContent = '复制失败';
                        copyButton.className = 'error';
                        setTimeout(() => { copyButton.textContent = '复制为MD'; copyButton.className = ''; }, 2000);
                    });
                } else {
                    console.error(SCRIPT_PREFIX + '未找到可复制的内容。');
                }
            });
            rightPanel.style.position = 'relative';
            rightPanel.appendChild(copyButton);
        }
    };

    const observer = new MutationObserver(() => {
        expandAllChapters();
        addFloatingCopyButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log(SCRIPT_PREFIX + '脚本已启动，终极虚拟滚动兼容模式已启用！');
})();
