/**
 * LinkCare 监控页面脚本（现代化重构版）
 * @version 5.1.0
 */
class LinkCareMonitor {
    constructor() {
        this.currentTab = this.getUrlParam('tab') || 'links';
        this.currentPage = parseInt(this.getUrlParam('page')) || 1;
        this.perPage = parseInt(this.getUrlParam('limit')) || 20;
        this.keyword = this.getUrlParam('keyword') || '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupMobileEnhancements();
        this.initializeTooltips();
        this.handleAutoRefresh();
        this.initializeAccessibility();
        console.log('%c LinkCare Monitor 已初始化', 'font-weight: bold; color: #2563eb;');
        this.showKeyboardShortcuts();
    }

    getUrlParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    bindEvents() {
        // 搜索表单处理
        this.bindSearchForm();
        
        // 标签页点击处理
        this.bindTabClicks();
        
        // 链接点击统计
        this.bindLinkTracking();
        
        // 键盘快捷键
        this.bindKeyboardShortcuts();
        
        // 消息关闭按钮
        this.bindMessageClose();
        
        // 表格行悬停效果
        this.bindTableHover();
    }

    bindSearchForm() {
        const searchForm = document.querySelector('.lc-search-form');
        if (searchForm) {
            const searchInput = searchForm.querySelector('input[name="keyword"]');
            
            searchForm.addEventListener('submit', (e) => {
                this.handleSearch(e);
            });

            // 搜索输入实时提示
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    const query = e.target.value.trim();
                    
                    if (query.length > 2) {
                        searchTimeout = setTimeout(() => {
                            this.showSearchSuggestions(query);
                        }, 300);
                    } else {
                        this.hideSearchSuggestions();
                    }
                });

                // 搜索框聚焦效果
                searchInput.addEventListener('focus', () => {
                    searchInput.parentElement.classList.add('focused');
                });

                searchInput.addEventListener('blur', () => {
                    setTimeout(() => {
                        searchInput.parentElement.classList.remove('focused');
                        this.hideSearchSuggestions();
                    }, 200);
                });
            }
        }
    }

    bindTabClicks() {
        document.querySelectorAll('.lc-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const href = tab.getAttribute('href');
                const tabName = href.split('tab=')[1]?.split('&')[0];
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
    }

    bindLinkTracking() {
        document.querySelectorAll('.lc-link-url').forEach(link => {
            link.addEventListener('click', () => {
                this.trackLinkClick(link.href, link.textContent);
            });
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 忽略在输入框中的按键
            if (this.isInputFocused()) return;

            switch (e.key) {
                case 'k':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.focusSearch();
                    }
                    break;
                case 'r':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.refreshData();
                    }
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                    this.switchTabByNumber(parseInt(e.key));
                    break;
                case 'Escape':
                    this.clearSearch();
                    break;
                case '?':
                    this.showKeyboardShortcuts();
                    break;
            }
        });
    }

    bindMessageClose() {
        document.querySelectorAll('.lc-message-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const message = e.target.closest('.lc-message');
                if (message) {
                    message.style.opacity = '0';
                    message.style.transform = 'translateY(-10px)';
                    setTimeout(() => {
                        message.remove();
                    }, 300);
                }
            });
        });

        // 自动隐藏成功消息
        document.querySelectorAll('.lc-message-success').forEach(message => {
            setTimeout(() => {
                if (message.parentNode) {
                    message.style.opacity = '0';
                    message.style.transform = 'translateY(-10px)';
                    setTimeout(() => {
                        message.remove();
                    }, 300);
                }
            }, 5000);
        });
    }

    bindTableHover() {
        document.querySelectorAll('.lc-table-row').forEach(row => {
            row.addEventListener('mouseenter', () => {
                row.style.transform = 'translateX(4px)';
            });

            row.addEventListener('mouseleave', () => {
                row.style.transform = 'translateX(0)';
            });
        });
    }

    setupMobileEnhancements() {
        if (window.innerWidth <= 768) {
            this.enableMobileOptimizations();
        }

        // 监听屏幕方向变化
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });

        // 响应式表格
        window.addEventListener('resize', this.debounce(() => {
            this.handleResponsiveTable();
        }, 250));

        // 初始化时检查
        this.handleResponsiveTable();
    }

    enableMobileOptimizations() {
        // 为移动端添加触摸友好的交互
        document.querySelectorAll('.lc-link-url').forEach(link => {
            link.addEventListener('touchstart', (e) => {
                link.style.backgroundColor = 'var(--gray-100)';
            }, { passive: true });

            link.addEventListener('touchend', () => {
                setTimeout(() => {
                    link.style.backgroundColor = '';
                }, 150);
            }, { passive: true });
        });

        // 改进移动端滚动
        const tableWrapper = document.querySelector('.lc-table-wrapper');
        if (tableWrapper) {
            tableWrapper.style.overflowX = 'auto';
            tableWrapper.style.webkitOverflowScrolling = 'touch';
        }
    }

    handleResponsiveTable() {
        const table = document.querySelector('.lc-table');
        const wrapper = document.querySelector('.lc-table-wrapper');
        
        if (!table || !wrapper) return;

        if (window.innerWidth <= 640) {
            // 小屏幕：转换为卡片布局
            this.convertTableToCards();
        } else {
            // 大屏幕：使用表格布局
            this.restoreTableLayout();
        }
    }

    convertTableToCards() {
        const tableWrapper = document.querySelector('.lc-table-wrapper');
        if (!tableWrapper || tableWrapper.classList.contains('cards-mode')) return;

        tableWrapper.classList.add('cards-mode');
        
        const rows = tableWrapper.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const card = document.createElement('div');
            card.className = 'lc-mobile-card';
            card.innerHTML = this.generateMobileCardHTML(cells);
            
            row.style.display = 'none';
            row.parentNode.insertBefore(card, row);
        });
    }

    generateMobileCardHTML(cells) {
        // 根据当前标签页生成不同的卡片布局
        if (this.currentTab === 'domains') {
            return `
                <div class="lc-card-header">
                    <span class="lc-card-icon">🌐</span>
                    <strong>${cells[0].textContent.trim()}</strong>
                    <span class="lc-card-count">${cells[1].textContent.trim()}</span>
                </div>
                <div class="lc-card-content">
                    ${cells[2].innerHTML}
                </div>
            `;
        } else {
            return `
                <div class="lc-card-header">
                    <div class="lc-card-url">${cells[0].innerHTML}</div>
                </div>
                <div class="lc-card-content">
                    <div class="lc-card-article">
                        <strong>来源文章：</strong>${cells[1].innerHTML}
                    </div>
                    <div class="lc-card-status">
                        <strong>状态：</strong>${cells[2].innerHTML}
                    </div>
                </div>
            `;
        }
    }

    restoreTableLayout() {
        const tableWrapper = document.querySelector('.lc-table-wrapper');
        if (!tableWrapper || !tableWrapper.classList.contains('cards-mode')) return;

        tableWrapper.classList.remove('cards-mode');
        
        // 移除移动端卡片并恢复表格行
        tableWrapper.querySelectorAll('.lc-mobile-card').forEach(card => {
            const nextRow = card.nextElementSibling;
            if (nextRow && nextRow.tagName === 'TR') {
                nextRow.style.display = '';
            }
            card.remove();
        });
    }

    initializeTooltips() {
        // 为状态标签添加详细说明
        const tooltips = {
            'nofollow': '搜索引擎不会跟踪此链接',
            'sponsored': '这是一个赞助链接',
            'ugc': '用户生成的内容链接',
            'blacklisted': '此链接已被加入黑名单',
            'target_blank': '链接将在新窗口中打开',
            'https': '链接已强制使用HTTPS协议',
            'utm': '链接包含UTM跟踪参数',
            'noreferer': '不会发送来源信息给目标网站',
            'custom_referer': '使用自定义来源信息',
            'svg_base64': 'SVG图像已转换为Base64格式'
        };

        document.querySelectorAll('.lc-status-label').forEach(label => {
            const text = label.textContent.toLowerCase().trim();
            if (tooltips[text]) {
                label.setAttribute('title', tooltips[text]);
                label.classList.add('lc-tooltip');
            }
        });
    }

    handleAutoRefresh() {
        // 检查是否启用自动刷新
        const autoRefresh = localStorage.getItem('linkcare_auto_refresh');
        if (autoRefresh === 'true') {
            const interval = parseInt(localStorage.getItem('linkcare_refresh_interval')) || 300000; // 默认5分钟
            
            this.autoRefreshTimer = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    this.refreshDataSilently();
                }
            }, interval);

            // 显示自动刷新状态
            this.showAutoRefreshStatus(interval);
        }
    }

    initializeAccessibility() {
        // 为键盘导航添加焦点指示器
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-navigation');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-navigation');
        });

        // 为屏幕阅读器添加标签
        this.addAriaLabels();
    }

    addAriaLabels() {
        // 为表格添加标题
        const table = document.querySelector('.lc-table');
        if (table && !table.getAttribute('aria-label')) {
            table.setAttribute('aria-label', '外链监控数据表格');
        }

        // 为搜索框添加标签
        const searchInput = document.querySelector('input[name="keyword"]');
        if (searchInput && !searchInput.getAttribute('aria-label')) {
            searchInput.setAttribute('aria-label', '搜索外链、域名或文章标题');
        }

        // 为分页按钮添加标签
        document.querySelectorAll('.lc-page-btn').forEach((btn, index) => {
            if (!btn.getAttribute('aria-label')) {
                const text = btn.textContent.trim();
                if (text === '←') {
                    btn.setAttribute('aria-label', '上一页');
                } else if (text === '→') {
                    btn.setAttribute('aria-label', '下一页');
                } else {
                    btn.setAttribute('aria-label', `第${text}页`);
                }
            }
        });
    }

    // 搜索相关方法
    handleSearch(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const keyword = formData.get('keyword')?.trim() || '';
        
        // 保存搜索历史
        this.saveSearchHistory(keyword);
        
        this.updateUrl({
            keyword: keyword,
            page: 1
        });
    }

    showSearchSuggestions(query) {
        // 从本地存储或缓存中获取建议
        const suggestions = this.getSearchSuggestions(query);
        if (suggestions.length === 0) return;

        const searchInput = document.querySelector('input[name="keyword"]');
        const inputRect = searchInput.getBoundingClientRect();
        
        let dropdown = document.querySelector('.lc-search-suggestions');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'lc-search-suggestions';
            document.body.appendChild(dropdown);
        }

        dropdown.style.position = 'fixed';
        dropdown.style.top = `${inputRect.bottom + 5}px`;
        dropdown.style.left = `${inputRect.left}px`;
        dropdown.style.width = `${inputRect.width}px`;
        dropdown.style.display = 'block';

        dropdown.innerHTML = suggestions.map(suggestion => 
            `<div class="lc-suggestion-item" data-value="${suggestion}">${this.highlightQuery(suggestion, query)}</div>`
        ).join('');

        // 绑定建议点击事件
        dropdown.querySelectorAll('.lc-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                searchInput.value = item.dataset.value;
                this.hideSearchSuggestions();
                searchInput.form.requestSubmit();
            });
        });
    }

    hideSearchSuggestions() {
        const dropdown = document.querySelector('.lc-search-suggestions');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    getSearchSuggestions(query) {
        // 从页面中提取匹配的域名和标题作为建议
        const suggestions = new Set();
        
        // 从域名中匹配
        document.querySelectorAll('.lc-domain-name').forEach(el => {
            const domain = el.textContent.trim();
            if (domain.toLowerCase().includes(query.toLowerCase())) {
                suggestions.add(domain);
            }
        });

        // 从文章标题中匹配
        document.querySelectorAll('.lc-article-link, .lc-post-link').forEach(el => {
            const title = el.textContent.trim();
            if (title.toLowerCase().includes(query.toLowerCase())) {
                suggestions.add(title);
            }
        });

        return Array.from(suggestions).slice(0, 5);
    }

    highlightQuery(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    saveSearchHistory(keyword) {
        if (!keyword) return;
        
        try {
            let history = JSON.parse(localStorage.getItem('linkcare_search_history') || '[]');
            history = history.filter(item => item !== keyword); // 移除重复项
            history.unshift(keyword); // 添加到开头
            history = history.slice(0, 10); // 只保留最近10条
            localStorage.setItem('linkcare_search_history', JSON.stringify(history));
        } catch (e) {
            console.warn('无法保存搜索历史:', e);
        }
    }

    // 导航相关方法
    switchTab(tab) {
        this.currentTab = tab;
        this.updateUrl({
            tab: tab,
            page: 1
        });
    }

    switchTabByNumber(num) {
        const tabs = ['links', 'domains', 'blacklist', 'whitelist', 'sponsor'];
        const tabIndex = num - 1;
        if (tabs[tabIndex]) {
            this.switchTab(tabs[tabIndex]);
        }
    }

    focusSearch() {
        const searchInput = document.querySelector('input[name="keyword"]');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    clearSearch() {
        const searchInput = document.querySelector('input[name="keyword"]');
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            searchInput.form.requestSubmit();
        }
    }

    updateUrl(params) {
        const url = new URL(window.location);
        
        // 保持现有参数
        url.searchParams.set('panel', 'LinkCare/monitor.php');
        
        // 更新新参数
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        
        // 添加加载指示器
        this.showLoading();
        
        // 跳转到新URL
        window.location.href = url.toString();
    }

    // 数据刷新相关
    refreshData() {
        const url = new URL(window.location);
        url.searchParams.set('refresh', '1');
        
        this.showLoading('正在刷新数据...');
        window.location.href = url.toString();
    }

    refreshDataSilently() {
        // 静默刷新，不影响用户操作
        fetch(window.location.href + '&refresh=1', {
            method: 'GET',
            cache: 'no-cache'
        }).then(response => {
            if (response.ok) {
                // 可以在这里更新页面的特定部分，而不是完全刷新
                this.showMessage('数据已更新', 'info');
            }
        }).catch(error => {
            console.warn('静默刷新失败:', error);
        });
    }

    showAutoRefreshStatus(interval) {
        const minutes = Math.floor(interval / 60000);
        const statusEl = document.createElement('div');
        statusEl.className = 'lc-auto-refresh-status';
        statusEl.innerHTML = `
            <span class="lc-status-indicator"></span>
            <span>自动刷新：每${minutes}分钟</span>
            <button class="lc-status-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        document.querySelector('.lc-container').appendChild(statusEl);
    }

    // 链接统计和追踪
    trackLinkClick(href, text) {
        try {
            const clickData = {
                url: href,
                text: text.trim(),
                timestamp: new Date().toISOString(),
                page: window.location.href,
                referrer: document.referrer,
                tab: this.currentTab
            };
            
            // 发送统计数据
            this.sendAnalytics('link_click', clickData);
            
            // 本地存储用于分析
            this.storeClickData(clickData);
            
            console.log('链接点击已记录:', href);
        } catch (error) {
            console.warn('链接追踪失败:', error);
        }
    }

    sendAnalytics(event, data) {
        // 如果有分析服务，在这里发送数据
        if (navigator.sendBeacon) {
            const analyticsData = new FormData();
            analyticsData.append('event', event);
            analyticsData.append('data', JSON.stringify(data));
            
            // 发送到分析端点（如果配置了）
            const analyticsUrl = window.linkCareConfig?.analyticsUrl;
            if (analyticsUrl) {
                navigator.sendBeacon(analyticsUrl, analyticsData);
            }
        }
    }

    storeClickData(data) {
        try {
            let clicks = JSON.parse(localStorage.getItem('linkcare_clicks') || '[]');
            clicks.push(data);
            
            // 只保留最近500条记录
            if (clicks.length > 500) {
                clicks = clicks.slice(-500);
            }
            
            localStorage.setItem('linkcare_clicks', JSON.stringify(clicks));
        } catch (error) {
            console.warn('无法存储点击数据:', error);
        }
    }

    // UI 辅助方法
    showLoading(message = '加载中...') {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'lc-loading-overlay';
        loadingEl.innerHTML = `
            <div class="lc-loading-content">
                <div class="lc-loading"></div>
                <p>${message}</p>
            </div>
        `;
        
        document.body.appendChild(loadingEl);
    }

    hideLoading() {
        const loadingEl = document.querySelector('.lc-loading-overlay');
        if (loadingEl) {
            loadingEl.remove();
        }
    }

    showMessage(text, type = 'info', duration = 3000) {
        const messageEl = document.createElement('div');
        messageEl.className = `lc-message lc-message-${type}`;
        messageEl.innerHTML = `
            <div class="lc-message-content">
                <p>${text}</p>
            </div>
            <button class="lc-message-close">&times;</button>
        `;
        
        const container = document.querySelector('.lc-container');
        container.insertBefore(messageEl, container.firstChild);
        
        // 绑定关闭事件
        messageEl.querySelector('.lc-message-close').addEventListener('click', () => {
            messageEl.remove();
        });
        
        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.style.opacity = '0';
                    setTimeout(() => messageEl.remove(), 300);
                }
            }, duration);
        }
    }

    showKeyboardShortcuts() {
        if (window.innerWidth <= 768) return; // 移动端不显示
        
        console.group('%c LinkCare Monitor 快捷键', 'font-weight: bold; color: #2563eb;');
        console.log('%c Ctrl/Cmd + K', 'color: #16a34a;', '聚焦搜索框');
        console.log('%c R', 'color: #16a34a;', '刷新数据');
        console.log('%c 1-5', 'color: #16a34a;', '切换标签页');
        console.log('%c ESC', 'color: #16a34a;', '清空搜索');
        console.log('%c ?', 'color: #16a34a;', '显示此帮助');
        console.groupEnd();
    }

    handleOrientationChange() {
        // 处理设备方向变化
        setTimeout(() => {
            this.handleResponsiveTable();
        }, 300);
    }

    // 工具方法
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable
        );
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 数据导出功能
    exportData() {
        try {
            const data = this.getCurrentTableData();
            if (data.length === 0) {
                this.showMessage('没有可导出的数据', 'warning');
                return;
            }
            
            const csv = this.convertToCSV(data);
            this.downloadCSV(csv, `linkcare_${this.currentTab}_${new Date().toISOString().split('T')[0]}.csv`);
            
            this.showMessage('数据导出成功！', 'success');
        } catch (error) {
            this.showMessage('导出失败：' + error.message, 'error');
        }
    }

    getCurrentTableData() {
        const rows = document.querySelectorAll('.lc-table tbody tr:not([style*="display: none"])');
        const data = [];
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const rowData = Array.from(cells).map(cell => 
                    cell.textContent.trim().replace(/\s+/g, ' ')
                );
                data.push(rowData);
            }
        });
        
        return data;
    }

    convertToCSV(data) {
        const headers = this.getTableHeaders();
        const csvContent = [headers].concat(data)
            .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        return '\uFEFF' + csvContent; // Add BOM for Excel compatibility
    }

    getTableHeaders() {
        const headerCells = document.querySelectorAll('.lc-table thead th');
        return Array.from(headerCells).map(th => th.textContent.trim().replace(/\s+/g, ' '));
    }

    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // 清理方法
    destroy() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }
        
        // 移除事件监听器
        document.removeEventListener('keydown', this.keydownHandler);
        window.removeEventListener('resize', this.resizeHandler);
        window.removeEventListener('orientationchange', this.orientationHandler);
        
        console.log('LinkCare Monitor 已销毁');
    }
}

// CSS 样式注入（用于动态元素）
const additionalStyles = `
<style>
.lc-search-suggestions {
    background: white;
    border: 1px solid var(--gray-300);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
}

.lc-suggestion-item {
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    border-bottom: 1px solid var(--gray-100);
    font-size: 0.875rem;
}

.lc-suggestion-item:hover {
    background: var(--gray-50);
}

.lc-suggestion-item:last-child {
    border-bottom: none;
}

.lc-suggestion-item mark {
    background: #fef3c7;
    color: #92400e;
    padding: 1px 2px;
    border-radius: 2px;
}

.lc-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.lc-loading-content {
    background: white;
    padding: var(--space-8);
    border-radius: var(--radius-lg);
    text-align: center;
    box-shadow: var(--shadow-lg);
}

.lc-loading-content .lc-loading {
    margin-bottom: var(--space-4);
}

.lc-loading-content p {
    margin: 0;
    color: var(--gray-600);
    font-size: 0.875rem;
}

.lc-mobile-card {
    background: white;
    border: 1px solid var(--gray-200);
    border-radius: var(--radius);
    margin-bottom: var(--space-3);
    padding: var(--space-4);
    box-shadow: var(--shadow);
}

.lc-card-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
    font-weight: 600;
}

.lc-card-icon {
    font-size: 1.25rem;
}

.lc-card-count {
    background: var(--primary);
    color: white;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    margin-left: auto;
}

.lc-card-content {
    font-size: 0.875rem;
    line-height: 1.5;
}

.lc-card-content > div {
    margin-bottom: var(--space-2);
}

.lc-card-content > div:last-child {
    margin-bottom: 0;
}

.lc-card-url {
    flex: 1;
    word-break: break-all;
}

.lc-auto-refresh-status {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    background: var(--success);
    color: white;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    z-index: 1000;
    animation: slideInRight 0.3s ease;
}

.lc-status-indicator {
    width: 8px;
    height: 8px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: pulse 2s infinite;
}

.lc-status-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
    margin-left: var(--space-2);
    font-size: 1rem;
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.keyboard-navigation *:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}

@media (max-width: 640px) {
    .lc-search-suggestions {
        left: var(--space-3) !important;
        right: var(--space-3);
        width: auto !important;
    }
    
    .lc-auto-refresh-status {
        top: var(--space-2);
        right: var(--space-2);
        left: var(--space-2);
        text-align: center;
    }
}
</style>
`;

// 注入样式
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// 初始化监控器
let linkCareMonitor;
document.addEventListener('DOMContentLoaded', function() {
    linkCareMonitor = new LinkCareMonitor();
    
    // 页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
        if (linkCareMonitor) {
            linkCareMonitor.destroy();
        }
    });
});

// 导出到全局作用域（便于调试和扩展）
window.LinkCareMonitor = LinkCareMonitor;
