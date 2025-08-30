/**
 * LinkCare 前端处理脚本（简约版）
 * 处理自定义Referer和其他前端功能
 * @version 5.2.0
 */
(function() {
    'use strict';

    class LinkCareFrontend {
        constructor() {
            this.debugMode = localStorage.getItem('linkcare_debug') === 'true';
            this.init();
        }

        init() {
            this.handleCustomReferer();
            this.handleSvgBase64();
            this.handleLinkTracking();
            this.addLinkIcons();
            this.initTooltips();
            this.initKeyboardShortcuts();
            this.handleSuspiciousLinks();
            
            if (this.debugMode) {
                console.log('LinkCare Frontend 已初始化');
                this.performStrictModeCheck();
            }
        }

        /**
         * 处理自定义Referer
         */
        handleCustomReferer() {
            const refererLinks = document.querySelectorAll('a.js-referer[data-referer]');
            
            if (this.debugMode && refererLinks.length > 0) {
                console.log(`发现 ${refererLinks.length} 个自定义Referer链接`);
            }
            
            refererLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    const customReferer = link.getAttribute('data-referer');
                    if (customReferer) {
                        if (this.debugMode) {
                            console.log('处理自定义Referer:', customReferer, '目标:', link.href);
                        }
                        
                        // 创建隐藏的iframe来设置referer
                        const iframe = document.createElement('iframe');
                        iframe.style.display = 'none';
                        iframe.src = customReferer;
                        
                        iframe.onload = () => {
                            // 延迟跳转以确保referer设置
                            setTimeout(() => {
                                window.open(link.href, link.target || '_blank');
                            }, 100);
                            
                            // 清理iframe
                            setTimeout(() => {
                                if (document.body.contains(iframe)) {
                                    document.body.removeChild(iframe);
                                }
                            }, 1000);
                        };
                        
                        iframe.onerror = () => {
                            console.warn('LinkCare: 自定义Referer设置失败，直接跳转');
                            window.open(link.href, link.target || '_blank');
                        };
                        
                        document.body.appendChild(iframe);
                        e.preventDefault();
                    }
                });
            });
        }

        /**
         * 处理SVG Base64优化
         */
        handleSvgBase64() {
            const svgLinks = document.querySelectorAll('a[href*=".svg"], a[href*="svg+xml"]');
            
            svgLinks.forEach(link => {
                const href = link.href;
                if (href.includes('data:image/svg+xml;base64,')) {
                    // 已经是base64格式，添加标识
                    link.classList.add('svg-base64-link');
                    link.setAttribute('title', '已优化的SVG图像 (Base64)');
                    
                    if (this.debugMode) {
                        console.log('SVG Base64链接:', href.substring(0, 100) + '...');
                    }
                } else if (href.includes('.svg')) {
                    // 普通SVG链接
                    link.classList.add('svg-link');
                }
            });
        }

        /**
         * 处理链接跟踪和统计
         */
        handleLinkTracking() {
            const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            
            if (this.debugMode) {
                console.log(`发现 ${externalLinks.length} 个外部链接，启用跟踪`);
            }
            
            externalLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    this.trackLinkClick(link);
                });
            });
        }

        /**
         * 跟踪链接点击
         */
        trackLinkClick(link) {
            const status = this.getLinkStatus(link);
            
            const data = {
                url: link.href,
                text: link.textContent.trim(),
                timestamp: new Date().toISOString(),
                page: window.location.href,
                referrer: document.referrer,
                status: status,
                hasRules: status.length > 0
            };

            if (this.debugMode) {
                console.log('链接点击跟踪:', data);
            }

            // 发送统计数据（如果有统计服务的话）
            if (window.linkCareConfig && window.linkCareConfig.trackingEnabled) {
                this.sendTrackingData(data);
            }

            // 本地存储（用于调试）
            if (localStorage) {
                try {
                    const clicks = JSON.parse(localStorage.getItem('linkcare_frontend_clicks') || '[]');
                    clicks.push(data);
                    if (clicks.length > 100) clicks.shift(); // 只保留最近100条
                    localStorage.setItem('linkcare_frontend_clicks', JSON.stringify(clicks));
                } catch (e) {
                    console.warn('LinkCare: Failed to store click data', e);
                }
            }
        }

        /**
         * 发送跟踪数据
         */
        sendTrackingData(data) {
            if (navigator.sendBeacon) {
                const formData = new FormData();
                formData.append('action', 'linkcare_track');
                formData.append('data', JSON.stringify(data));
                
                navigator.sendBeacon('/wp-admin/admin-ajax.php', formData);
            } else {
                // 降级处理
                const img = new Image();
                img.src = '/wp-admin/admin-ajax.php?action=linkcare_track&data=' + 
                         encodeURIComponent(JSON.stringify(data));
            }
        }

        /**
         * 为外链添加图标
         */
        addLinkIcons() {
            const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            
            externalLinks.forEach(link => {
                if (!link.querySelector('.linkcare-icon')) {
                    // 检查链接类型并添加相应图标
                    const domain = this.extractDomain(link.href);
                    const icon = this.getLinkIcon(domain, link.href);
                    
                    if (icon) {
                        const iconEl = document.createElement('span');
                        iconEl.className = 'linkcare-icon';
                        iconEl.innerHTML = icon;
                        iconEl.style.marginLeft = '4px';
                        iconEl.style.opacity = '0.6';
                        iconEl.style.fontSize = '0.8em';
                        iconEl.style.color = '#6b7280';
                        
                        link.appendChild(iconEl);
                    }
                }
            });
        }

        /**
         * 提取域名
         */
        extractDomain(url) {
            try {
                return new URL(url).hostname;
            } catch (e) {
                return '';
            }
        }

        /**
         * 获取链接图标（简约版）
         */
        getLinkIcon(domain, url) {
            // 常见网站图标映射（使用简洁符号）
            const iconMap = {
                'github.com': '[GH]',
                'stackoverflow.com': '[SO]',
                'youtube.com': '[YT]',
                'twitter.com': '[TW]',
                'x.com': '[X]',
                'facebook.com': '[FB]',
                'linkedin.com': '[LI]',
                'instagram.com': '[IG]',
                'reddit.com': '[RD]',
                'medium.com': '[MD]',
                'dev.to': '[DEV]',
                'codepen.io': '[CP]',
                'jsfiddle.net': '[JS]',
                'wikipedia.org': '[WK]',
                'arxiv.org': '[AR]',
                'scholar.google.com': '[GS]',
                'npmjs.com': '[NPM]',
                'pypi.org': '[PY]',
                'docker.com': '[DK]'
            };

            // 检查特定域名
            if (iconMap[domain]) {
                return iconMap[domain];
            }

            // 检查文件类型
            if (url.match(/\.(pdf|doc|docx)$/i)) return '[DOC]';
            if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return '[IMG]';
            if (url.match(/\.(mp4|avi|mov|webm)$/i)) return '[VID]';
            if (url.match(/\.(mp3|wav|ogg|flac)$/i)) return '[AUD]';
            if (url.match(/\.(zip|rar|7z|tar\.gz)$/i)) return '[ZIP]';

            // 默认外链图标
            return '[EXT]';
        }

        /**
         * 初始化工具提示
         */
        initTooltips() {
            const links = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            
            links.forEach(link => {
                if (!link.title) {
                    const domain = this.extractDomain(link.href);
                    const status = this.getLinkStatus(link);
                    
                    let tooltip = `外链: ${domain}`;
                    if (status.length > 0) {
                        tooltip += ` (${status.join(', ')})`;
                    } else {
                        tooltip += ' (无特殊处理)';
                    }
                    
                    link.title = tooltip;
                }
            });
        }

        /**
         * 获取链接状态
         */
        getLinkStatus(link) {
            const status = [];
            
            // 检查target属性
            if (link.target === '_blank') {
                status.push('新窗口');
            }
            
            // 检查rel属性 - 严格按照实际DOM内容
            if (link.rel) {
                const relValues = link.rel.split(/\s+/).filter(r => r.trim());
                
                relValues.forEach(rel => {
                    switch (rel.toLowerCase()) {
                        case 'nofollow':
                            status.push('nofollow');
                            break;
                        case 'sponsored':
                            status.push('sponsored');
                            break;
                        case 'ugc':
                            status.push('ugc');
                            break;
                        case 'noopener':
                            status.push('noopener');
                            break;
                        case 'noreferrer':
                            status.push('noreferrer');
                            break;
                    }
                });
                
                if (this.debugMode && relValues.length > 0) {
                    console.log(`检测到rel属性: ${relValues.join(' ')}`);
                }
            }
            
            // 检查其他自定义属性
            if (link.classList.contains('js-referer')) {
                status.push('自定义referer');
            }
            
            // 检查URL中的UTM参数
            if (link.href.includes('utm_')) {
                status.push('UTM跟踪');
            }
            
            // 检查是否为SVG Base64
            if (link.classList.contains('svg-base64-link')) {
                status.push('SVG Base64');
            }
            
            // 检查是否为可疑链接
            if (link.classList.contains('suspicious-link')) {
                status.push('可疑链接');
            }
            
            return status;
        }

        /**
         * 执行严格模式检测
         */
        performStrictModeCheck() {
            const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            let checkedCount = 0;
            let inconsistentCount = 0;
            
            console.group('LinkCare 严格模式检测');
            
            externalLinks.forEach((link, index) => {
                const status = this.getLinkStatus(link);
                const domain = this.extractDomain(link.href);
                
                // 检查潜在的不一致性
                const issues = this.detectInconsistencies(link, status);
                
                if (issues.length > 0) {
                    inconsistentCount++;
                    console.warn(`链接 ${index + 1} (${domain}) 发现问题:`, issues);
                    console.warn('   链接:', link.href);
                    console.warn('   实际状态:', status);
                }
                
                checkedCount++;
            });
            
            if (inconsistentCount === 0) {
                console.log(`检查完成: ${checkedCount} 个外链全部符合要求`);
            } else {
                console.warn(`发现 ${inconsistentCount}/${checkedCount} 个链接存在潜在问题`);
            }
            
            console.groupEnd();
        }

        /**
         * 检测链接的不一致性
         */
        detectInconsistencies(link, status) {
            const issues = [];
            
            // 检查target="_blank"但没有安全rel的情况
            if (link.target === '_blank') {
                const hasNoopener = status.includes('noopener');
                const hasNoreferrer = status.includes('noreferrer');
                
                if (!hasNoopener && !hasNoreferrer) {
                    issues.push('target="_blank"但未设置noopener或noreferrer');
                }
            }
            
            // 检查sponsored链接但没有nofollow
            if (status.includes('sponsored') && !status.includes('nofollow')) {
                issues.push('有sponsored属性但缺少nofollow');
            }
            
            // 检查可疑的rel组合
            const relCount = ['nofollow', 'sponsored', 'ugc'].filter(rel => status.includes(rel)).length;
            if (relCount > 1) {
                issues.push('rel属性组合可能重复');
            }
            
            return issues;
        }

        /**
         * 检查链接可访问性
         */
        async checkLinkAccessibility() {
            const links = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            const batchSize = 5;
            
            if (this.debugMode) {
                console.log(`开始检查 ${links.length} 个外链的可访问性`);
            }
            
            for (let i = 0; i < links.length; i += batchSize) {
                const batch = Array.from(links).slice(i, i + batchSize);
                
                await Promise.allSettled(batch.map(link => this.checkSingleLink(link)));
                
                // 添加延迟避免被限制
                if (i + batchSize < links.length) {
                    await this.sleep(1000);
                }
            }
            
            if (this.debugMode) {
                console.log('链接可访问性检查完成');
            }
        }

        /**
         * 检查单个链接
         */
        async checkSingleLink(link) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(link.href, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                link.setAttribute('data-checked', 'true');
                link.setAttribute('data-check-time', new Date().toISOString());
                
                if (this.debugMode) {
                    console.log('链接可访问:', link.href);
                }
                
            } catch (error) {
                // 标记为可能无法访问
                link.setAttribute('data-check-failed', 'true');
                link.setAttribute('data-check-time', new Date().toISOString());
                link.style.opacity = '0.6';
                
                // 添加视觉提示
                if (!link.querySelector('.linkcare-warning')) {
                    this.createExternalLinkWarning(link);
                }
                
                if (this.debugMode) {
                    console.warn('链接检查失败:', link.href, error.name);
                }
            }
        }

        /**
         * 睡眠函数
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * 创建外链警告
         */
        createExternalLinkWarning(link) {
            const warning = document.createElement('span');
            warning.className = 'linkcare-warning';
            warning.innerHTML = ' [!]';
            warning.title = '链接可能无法访问或网络超时';
            warning.style.cursor = 'help';
            warning.style.fontSize = '0.8em';
            warning.style.opacity = '0.7';
            warning.style.color = '#f59e0b';
            
            link.appendChild(warning);
        }

        /**
         * 批量处理可疑链接
         */
        handleSuspiciousLinks() {
            // 已知的可疑域名列表（短链接服务）
            const suspiciousDomains = [
                'bit.ly', 'tinyurl.com', 'short.link', 't.co',
                'goo.gl', 'ow.ly', 'buff.ly', 'tiny.cc', 'is.gd',
                'cutt.ly', 'rebrand.ly', 'clickup.com', 'bl.ink'
            ];
            
            const links = document.querySelectorAll('a[href^="http"]');
            let suspiciousCount = 0;
            
            links.forEach(link => {
                const domain = this.extractDomain(link.href);
                
                if (suspiciousDomains.includes(domain)) {
                    link.classList.add('suspicious-link');
                    link.style.borderBottom = '1px dashed #f59e0b';
                    link.style.background = '#fef3c7';
                    link.style.padding = '1px 3px';
                    link.style.borderRadius = '3px';
                    link.title = `注意: 这是一个短链接服务 (${domain})，请小心访问`;
                    
                    // 添加点击确认
                    link.addEventListener('click', (e) => {
                        if (!confirm(`您即将访问短链接服务:\n${domain}\n\n目标地址: ${link.href}\n\n短链接可能隐藏真实目标，请确认安全后继续。`)) {
                            e.preventDefault();
                        }
                    });
                    
                    suspiciousCount++;
                }
            });
            
            if (this.debugMode && suspiciousCount > 0) {
                console.warn(`发现 ${suspiciousCount} 个可疑短链接，已添加警告`);
            }
        }

        /**
         * 初始化键盘快捷键
         */
        initKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Alt + L: 高亮所有外链
                if (e.altKey && e.key === 'l') {
                    e.preventDefault();
                    this.toggleExternalLinksHighlight();
                }
                
                // Alt + C: 检查链接可访问性
                if (e.altKey && e.key === 'c') {
                    e.preventDefault();
                    this.checkLinkAccessibility();
                }
                
                // Alt + D: 切换调试模式
                if (e.altKey && e.key === 'd') {
                    e.preventDefault();
                    this.toggleDebugMode();
                }
                
                // Alt + S: 执行严格模式检测
                if (e.altKey && e.key === 's') {
                    e.preventDefault();
                    this.performStrictModeCheck();
                }
            });
            
            if (this.debugMode) {
                console.log('键盘快捷键已启用:');
                console.log('   Alt + L: 高亮外链');
                console.log('   Alt + C: 检查可访问性');
                console.log('   Alt + D: 切换调试模式');
                console.log('   Alt + S: 严格模式检测');
            }
        }

        /**
         * 切换调试模式
         */
        toggleDebugMode() {
            this.debugMode = !this.debugMode;
            localStorage.setItem('linkcare_debug', this.debugMode.toString());
            
            const message = this.debugMode ? '调试模式已启用' : '调试模式已关闭';
            console.log(`LinkCare: ${message}`);
            
            if (this.debugMode) {
                this.performStrictModeCheck();
            }
        }

        /**
         * 切换外链高亮
         */
        toggleExternalLinksHighlight() {
            const links = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            const isHighlighted = document.body.classList.contains('linkcare-highlight-external');
            
            if (isHighlighted) {
                document.body.classList.remove('linkcare-highlight-external');
                links.forEach(link => {
                    if (!link.classList.contains('suspicious-link')) {
                        link.style.backgroundColor = '';
                        link.style.padding = '';
                        link.style.borderRadius = '';
                    }
                    link.style.border = '';
                });
                
                if (this.debugMode) {
                    console.log('外链高亮已关闭');
                }
            } else {
                document.body.classList.add('linkcare-highlight-external');
                links.forEach(link => {
                    const status = this.getLinkStatus(link);
                    
                    // 根据状态设置不同颜色
                    if (status.includes('nofollow')) {
                        link.style.backgroundColor = '#fef3c7';
                        link.style.border = '1px solid #fcd34d';
                    } else if (status.includes('blacklisted')) {
                        link.style.backgroundColor = '#fee2e2';
                        link.style.border = '1px solid #fca5a5';
                    } else if (status.includes('sponsored')) {
                        link.style.backgroundColor = '#dcfce7';
                        link.style.border = '1px solid #86efac';
                    } else {
                        link.style.backgroundColor = '#f3f4f6';
                        link.style.border = '1px solid #d1d5db';
                    }
                    
                    link.style.padding = '2px 4px';
                    link.style.borderRadius = '3px';
                    link.style.margin = '0 1px';
                });
                
                if (this.debugMode) {
                    console.log(`外链高亮已启用 (${links.length} 个链接)`);
                }
                
                // 5秒后自动取消高亮
                setTimeout(() => {
                    if (document.body.classList.contains('linkcare-highlight-external')) {
                        this.toggleExternalLinksHighlight();
                    }
                }, 5000);
            }
        }

        /**
         * 显示统计信息
         */
        showStatistics() {
            const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            const stats = {
                total: externalLinks.length,
                nofollow: 0,
                sponsored: 0,
                targetBlank: 0,
                suspicious: 0,
                svgBase64: 0,
                customReferer: 0
            };

            externalLinks.forEach(link => {
                const status = this.getLinkStatus(link);
                if (status.includes('nofollow')) stats.nofollow++;
                if (status.includes('sponsored')) stats.sponsored++;
                if (status.includes('新窗口')) stats.targetBlank++;
                if (status.includes('可疑链接')) stats.suspicious++;
                if (status.includes('SVG Base64')) stats.svgBase64++;
                if (status.includes('自定义referer')) stats.customReferer++;
            });

            console.group('LinkCare 统计信息');
            console.log(`总外链数量: ${stats.total}`);
            console.log(`nofollow: ${stats.nofollow}`);
            console.log(`sponsored: ${stats.sponsored}`);
            console.log(`新窗口打开: ${stats.targetBlank}`);
            console.log(`可疑链接: ${stats.suspicious}`);
            console.log(`SVG Base64: ${stats.svgBase64}`);
            console.log(`自定义Referer: ${stats.customReferer}`);
            console.groupEnd();

            return stats;
        }

        /**
         * 获取点击历史
         */
        getClickHistory() {
            try {
                return JSON.parse(localStorage.getItem('linkcare_frontend_clicks') || '[]');
            } catch (e) {
                return [];
            }
        }

        /**
         * 清理点击历史
         */
        clearClickHistory() {
            localStorage.removeItem('linkcare_frontend_clicks');
            console.log('点击历史已清理');
        }

        /**
         * 导出数据用于调试
         */
        exportDebugData() {
            const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
            const debugData = {
                timestamp: new Date().toISOString(),
                page: window.location.href,
                userAgent: navigator.userAgent,
                links: []
            };

            externalLinks.forEach((link, index) => {
                const status = this.getLinkStatus(link);
                debugData.links.push({
                    index: index + 1,
                    url: link.href,
                    text: link.textContent.trim(),
                    domain: this.extractDomain(link.href),
                    status: status,
                    rel: link.rel || '',
                    target: link.target || '',
                    classes: Array.from(link.classList)
                });
            });

            const dataStr = JSON.stringify(debugData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `linkcare_debug_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            console.log('调试数据已导出');
        }
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.linkCareFrontend = new LinkCareFrontend();
        });
    } else {
        window.linkCareFrontend = new LinkCareFrontend();
    }

    // 导出到全局（便于调试）
    window.LinkCareFrontend = LinkCareFrontend;

    // 添加全局调试方法
    window.linkCareDebug = {
        toggle: () => window.linkCareFrontend?.toggleDebugMode(),
        check: () => window.linkCareFrontend?.performStrictModeCheck(),
        stats: () => window.linkCareFrontend?.showStatistics(),
        highlight: () => window.linkCareFrontend?.toggleExternalLinksHighlight(),
        export: () => window.linkCareFrontend?.exportDebugData(),
        clearHistory: () => window.linkCareFrontend?.clearClickHistory()
    };

    // 控制台欢迎信息
    if (localStorage.getItem('linkcare_debug') === 'true') {
        console.log('LinkCare Frontend 调试工具');
        console.log('可用命令:');
        console.log('linkCareDebug.toggle() - 切换调试模式');
        console.log('linkCareDebug.check() - 执行严格模式检测');
        console.log('linkCareDebug.stats() - 显示统计信息');
        console.log('linkCareDebug.highlight() - 高亮外链');
        console.log('linkCareDebug.export() - 导出调试数据');
    }

})();
