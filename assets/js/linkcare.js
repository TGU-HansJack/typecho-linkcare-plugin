/**
 * LinkCare 高级规则引擎管理器（SVG标识版 + 自定义参数）
 * @version 5.5.0
 */
class AdvancedRulesManager {
    constructor() {
        this.rules = [];
        this.currentEditingIndex = -1;
        this.conditionIdCounter = 0;
        this.isDirty = false;
        this.init();
    }

    init() {
        this.loadRules();
        this.render();
        this.bindEvents();
        this.initializeSortable();
        this.setupAutoSave();
        console.log('LinkCare Rules Manager v5.5.0 (SVG标识版 + 自定义参数) 已初始化');
    }

    loadRules() {
        const input = document.querySelector('input[name="linkRules"]');
        try {
            const rulesData = input ? input.value : '[]';
            this.rules = JSON.parse(rulesData) || [];
            console.log('已加载规则:', this.rules.length, '条');
        } catch (e) {
            console.warn('规则加载失败，使用默认配置:', e);
            this.rules = [];
        }
    }

    saveRules() {
        const input = document.querySelector('input[name="linkRules"]');
        if (input) {
            const rulesJson = JSON.stringify(this.rules, null, 2);
            input.value = rulesJson;
            this.isDirty = false;
            console.log('规则已保存:', this.rules.length, '条');
            
            // 触发变更事件，通知Typecho系统
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    bindEvents() {
        // 全局键盘事件
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 页面离开提醒
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });

        // 定期检查规则有效性
        setInterval(() => {
            this.validateRules();
        }, 30000);
    }

    handleKeyboardShortcuts(e) {
        // ESC 关闭编辑器
        if (e.key === 'Escape') {
            this.closeEditor();
        }
        
        // Ctrl/Cmd + S 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (document.querySelector('.rule-editor.show')) {
                this.saveCurrentRule();
            } else {
                this.saveRules();
                this.showMessage('规则已保存！', 'success');
            }
        }
        
        // Ctrl/Cmd + N 新建规则
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !this.isInputFocused()) {
            e.preventDefault();
            this.createRule();
        }
        
        // Ctrl/Cmd + D 复制当前规则
        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !this.isInputFocused()) {
            e.preventDefault();
            if (this.currentEditingIndex >= 0) {
                this.copyRule(this.currentEditingIndex);
            }
        }
    }

    initializeSortable() {
        const listEl = document.querySelector('.rules-list');
        if (listEl && typeof Sortable !== 'undefined') {
            this.sortable = Sortable.create(listEl, {
                handle: '.rule-card',
                animation: 300,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                onStart: (evt) => {
                    document.body.style.cursor = 'grabbing';
                },
                onEnd: (evt) => {
                    document.body.style.cursor = '';
                    if (evt.oldIndex !== evt.newIndex) {
                        const item = this.rules.splice(evt.oldIndex, 1)[0];
                        this.rules.splice(evt.newIndex, 0, item);
                        this.markDirty();
                        this.saveRules();
                        this.render();
                        this.showMessage('规则顺序已更新', 'info', 2000);
                    }
                }
            });
        }
    }

    setupAutoSave() {
        // 每30秒自动保存一次
        setInterval(() => {
            if (this.isDirty) {
                this.saveRules();
                console.log('自动保存完成');
            }
        }, 30000);
    }

    render() {
        const container = document.getElementById('linkcare-rules-manager');
        if (!container) return;

        container.innerHTML = this.getHTML();
        this.initializeComponents();
        
        // 重新初始化排序
        setTimeout(() => {
            this.initializeSortable();
        }, 100);
    }

    initializeComponents() {
        // 初始化切换开关
        this.initializeToggles();
        
        // 初始化按钮事件
        this.initializeButtons();
        
        // 初始化工具提示
        this.initializeTooltips();
        
        // 初始化拖拽提示
        this.initializeDragHints();
    }

    initializeToggles() {
        document.querySelectorAll('.lc-toggle input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (!isNaN(index) && this.rules[index]) {
                    this.rules[index].enable = e.target.checked;
                    this.markDirty();
                    this.saveRules();
                    this.updateRuleCardState(index);
                }
            });
        });
    }

    initializeButtons() {
        // 绑定所有按钮点击事件
        document.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const index = parseInt(button.dataset.index);

            switch (action) {
                case 'create-rule':
                    this.createRule();
                    break;
                case 'edit-rule':
                    this.editRule(index);
                    break;
                case 'copy-rule':
                    this.copyRule(index);
                    break;
                case 'delete-rule':
                    this.deleteRule(index);
                    break;
                case 'export-rules':
                    this.exportRules();
                    break;
                case 'import-rules':
                    this.importRules();
                    break;
            }
        });
    }

    initializeTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            element.classList.add('lc-tooltip');
        });
    }

    initializeDragHints() {
        document.querySelectorAll('.rule-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('dragging')) {
                    card.style.cursor = 'grab';
                }
            });
        });
    }

    getHTML() {
        return `
            <div class="rules-header">
                <div>
                    <h2>
                        链接规则引擎 <span class="version-badge">v5.5.0 SVG标识版</span>
                        <div class="sub header">拖拽调整优先级，上方规则优先执行。新增SVG标识和自定义参数功能</div>
                    </h2>
                </div>
                <div class="header-actions">
                    <button class="lc-btn lc-btn-info lc-btn-sm" data-action="import-rules" data-tooltip="导入规则配置">
                        导入规则
                    </button>
                    <button class="lc-btn lc-btn-success lc-btn-sm" data-action="export-rules" data-tooltip="导出规则配置">
                        导出规则
                    </button>
                    <button class="lc-btn lc-btn-primary" data-action="create-rule" data-tooltip="创建新规则 (Ctrl+N)">
                        创建规则
                    </button>
                </div>
            </div>
            <div class="rules-list">
                ${this.rules.length > 0 ? this.rules.map((rule, index) => this.getRuleCardHTML(rule, index)).join('') : this.getEmptyStateHTML()}
            </div>
            ${this.getEditorHTML()}
            <div class="overlay"></div>
        `;
    }

    getEmptyStateHTML() {
        return `
            <div class="lc-empty-state">
                <div class="empty-title">还没有配置任何规则</div>
                <div class="empty-description">
                    规则引擎可以帮助您自动处理外链，包括添加rel属性、UTM参数、黑名单控制、重定向控制、SVG标识、自定义参数等功能。<br>
                    <strong>新功能：</strong>SVG链接标识、自定义参数添加，让外链处理更加灵活。<br>
                    所有属性严格按配置执行，不会自动添加任何内容。
                </div>
                <button class="lc-btn lc-btn-primary lc-btn-lg" data-action="create-rule">
                    创建第一个规则
                </button>
            </div>
        `;
    }

    getRuleCardHTML(rule, index) {
        const priority = index + 1;
        const conditionText = this.getConditionSummary(rule);
        const actionTags = this.getActionTags(rule);
        const isEnabled = rule.enable !== false;

        return `
            <div class="rule-card ${!isEnabled ? 'disabled' : ''}" data-index="${index}">
                <div class="rule-header">
                    <div class="rule-title-area">
                        <label class="lc-toggle">
                            <input type="checkbox" ${isEnabled ? 'checked' : ''} data-index="${index}">
                            <span class="lc-toggle-slider"></span>
                        </label>
                        <div class="header">${this.escapeHtml(rule.name || `规则 ${priority}`)}</div>
                        <div class="rule-priority">第${priority}位</div>
                    </div>
                    <div class="rule-actions">
                        <button class="lc-btn lc-btn-secondary lc-btn-sm" data-action="copy-rule" data-index="${index}" data-tooltip="复制规则 (Ctrl+D)">
                            复制
                        </button>
                        <button class="lc-btn lc-btn-primary lc-btn-sm" data-action="edit-rule" data-index="${index}" data-tooltip="编辑规则">
                            编辑
                        </button>
                        <button class="lc-btn lc-btn-danger lc-btn-sm" data-action="delete-rule" data-index="${index}" data-tooltip="删除规则">
                            删除
                        </button>
                    </div>
                </div>
                <div class="rule-content">
                    <div class="condition-summary">${conditionText}</div>
                    <div class="action-tags">${actionTags}</div>
                </div>
            </div>
        `;
    }

    getConditionSummary(rule) {
        if (!rule.conditions || rule.conditions.length === 0) {
            return '当访问任何外链时执行操作';
        }

        const mainCondition = rule.conditions[0];
        if (mainCondition.type === 'if' && mainCondition.rules && mainCondition.rules.length > 0) {
            const firstRule = mainCondition.rules[0];
            let text = this.formatConditionRule(firstRule);
            if (mainCondition.rules.length > 1) {
                const logic = mainCondition.logic || 'and';
                text += ` ${logic.toUpperCase()}等${mainCondition.rules.length}个条件`;
            }
            return `当 ${text} 时执行操作`;
        }
        
        return '当访问外链时执行操作';
    }

    formatConditionRule(rule) {
        const operators = {
            'match': '匹配',
            'contains': '包含',
            'not_contains': '不包含',
            'equals': '等于',
            'not_equals': '不等于',
            'starts_with': '开始于',
            'ends_with': '结束于',
            'regex': '正则匹配'
        };

        const fields = {
            'domain': '域名',
            'url': 'URL',
            'rel': 'Rel属性',
            'path': 'URL路径',
            'query': '查询参数',
            'page_path': '页面路径',
            'page_type': '页面类型',
            'page_name': '页面名称',
            'is_special_page': '特殊页面'
        };

        const fieldName = fields[rule.field] || rule.field;
        const operatorName = operators[rule.operator] || rule.operator;
        
        return `${fieldName}${operatorName} "${rule.value}"`;
    }

    getActionTags(rule) {
        const tags = [];
        
        if (!rule.conditions) return tags.join('');

        rule.conditions.forEach(condition => {
            if (!condition.actions) return;
            
            condition.actions.forEach(action => {
                const tag = this.getActionTag(action);
                if (tag) tags.push(tag);
            });
        });

        return tags.join('');
    }

    getActionTag(action) {
        const tagConfigs = {
            'add_rel': {
                condition: () => action.values && action.values.length > 0,
                content: () => action.values.map(rel => `<span class="action-tag rel">${rel}</span>`).join(''),
                single: false
            },
            'add_utm': {
                condition: () => action.enabled,
                content: () => '<span class="action-tag utm">UTM参数</span>'
            },
            'target_blank': {
                condition: () => action.enabled,
                content: () => '<span class="action-tag target">新窗口</span>'
            },
            'force_https': {
                condition: () => action.enabled,
                content: () => '<span class="action-tag https">HTTPS</span>'
            },
            'add_to_blacklist': {
                condition: () => action.enabled,
                content: () => '<span class="action-tag blacklist">黑名单</span>'
            },
            'add_referer': {
                condition: () => action.enabled && action.value,
                content: () => '<span class="action-tag referer">自定义Referer</span>'
            },
            'svg_suffix': {
                condition: () => action.enabled,
                content: () => '<span class="action-tag svg-suffix">SVG标识</span>'
            },
            'add_custom_params': {
                condition: () => action.enabled && action.params && action.params.length > 0,
                content: () => '<span class="action-tag custom-params">自定义参数</span>'
            },
            'enable_redirect': {
                condition: () => action.enabled,
                content: () => '<span class="action-tag redirect">启用重定向</span>'
            }
        };

        const config = tagConfigs[action.type];
        if (config && config.condition()) {
            return config.single === false ? config.content() : config.content();
        }
        
        return '';
    }


    // 规则操作方法
    createRule() {
        this.currentEditingIndex = -1;
        this.showEditor();
        this.clearEditor();
        this.addCondition('if');
        
        // 设置默认规则名称
        const defaultName = `规则 ${this.rules.length + 1}`;
        document.getElementById('rule-name').value = defaultName;
    }

    editRule(index) {
        if (index < 0 || index >= this.rules.length) return;
        
        console.log('编辑规则:', index, this.rules[index]);
        this.currentEditingIndex = index;
        this.showEditor();
        this.loadRuleToEditor(this.rules[index]);
    }

    copyRule(index) {
        if (index < 0 || index >= this.rules.length) return;
        
        const originalRule = this.rules[index];
        const copiedRule = JSON.parse(JSON.stringify(originalRule));
        copiedRule.name = `${originalRule.name || '未命名规则'} (副本)`;
        
        this.rules.push(copiedRule);
        this.markDirty();
        this.saveRules();
        this.render();
        
        this.showMessage('规则复制成功！', 'success');
    }

    async deleteRule(index) {
        if (index < 0 || index >= this.rules.length) return;
        
        const rule = this.rules[index];
        const confirmed = await this.showConfirmDialog(
            '删除规则',
            `确定要删除规则"${rule.name || '未命名规则'}"吗？此操作不可撤销。`,
            '删除',
            '取消'
        );
        
        if (confirmed) {
            this.rules.splice(index, 1);
            this.markDirty();
            this.saveRules();
            this.render();
            this.showMessage('规则删除成功！', 'success');
        }
    }

    // 导入导出功能
    async importRules() {
        try {
            const file = await this.selectFile('.json');
            if (!file) return;

            const content = await this.readFileAsText(file);
            const importedRules = JSON.parse(content);
            
            if (!Array.isArray(importedRules)) {
                throw new Error('无效的规则格式：必须是数组');
            }
            
            // 验证规则格式
            this.validateImportedRules(importedRules);
            
            const confirmed = await this.showConfirmDialog(
                '导入规则',
                `确定导入 ${importedRules.length} 条规则吗？这将替换当前所有规则。`,
                '导入',
                '取消'
            );
            
            if (confirmed) {
                this.rules = importedRules;
                this.markDirty();
                this.saveRules();
                this.render();
                this.showMessage(`成功导入 ${importedRules.length} 条规则！`, 'success');
            }
        } catch (error) {
            console.error('导入失败:', error);
            this.showMessage(`导入失败: ${error.message}`, 'error');
        }
    }

    exportRules() {
        if (this.rules.length === 0) {
            this.showMessage('没有可导出的规则', 'warning');
            return;
        }
        
        try {
            const exportData = {
                version: '5.5.0',
                exportTime: new Date().toISOString(),
                rules: this.rules
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const filename = `linkcare_rules_v5.5.0_${new Date().toISOString().split('T')[0]}.json`;
            
            this.downloadFile(dataStr, filename, 'application/json');
            this.showMessage('规则导出成功！', 'success');
        } catch (error) {
            console.error('导出失败:', error);
            this.showMessage(`导出失败: ${error.message}`, 'error');
        }
    }

    validateImportedRules(rules) {
        rules.forEach((rule, index) => {
            if (typeof rule !== 'object') {
                throw new Error(`规则 ${index + 1} 格式错误：必须是对象`);
            }
            
            if (!rule.name || typeof rule.name !== 'string') {
                rule.name = `导入的规则 ${index + 1}`;
            }
            
            if (rule.enable === undefined) {
                rule.enable = true;
            }
            
            if (!Array.isArray(rule.conditions)) {
                rule.conditions = [];
            }

            // 确保条件中有logic字段
            rule.conditions.forEach(condition => {
                if (condition.type !== 'else' && !condition.logic) {
                    condition.logic = 'and'; // 默认AND逻辑
                }
            });
        });
    }

    // 编辑器相关方法
    showEditor() {
        const editor = document.querySelector('.rule-editor');
        const overlay = document.querySelector('.overlay');
        
        if (editor && overlay) {
            editor.classList.add('show');
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            // 聚焦到第一个输入框
            setTimeout(() => {
                const firstInput = editor.querySelector('input, textarea, select');
                if (firstInput) firstInput.focus();
            }, 300);
        }
    }

    closeEditor() {
        if (this.isDirty && this.currentEditingIndex >= 0) {
            const confirmed = confirm('您有未保存的更改，确定要关闭吗？');
            if (!confirmed) return;
        }
        
        const editor = document.querySelector('.rule-editor');
        const overlay = document.querySelector('.overlay');
        
        if (editor && overlay) {
            editor.classList.remove('show');
            overlay.classList.remove('show');
            document.body.style.overflow = 'auto';
        }
        
        this.currentEditingIndex = -1;
    }

    clearEditor() {
        const nameInput = document.getElementById('rule-name');
        const container = document.getElementById('conditions-container');
        
        if (nameInput) nameInput.value = '';
        if (container) container.innerHTML = '';
        
        this.conditionIdCounter = 0;
    }

    getEditorHTML() {
        return `
            <div class="rule-editor">
                <div class="rule-editor-header">
                    <h3 class="rule-editor-title">
                        规则编辑器 <span class="version-badge">v5.5.0 SVG标识版</span>
                    </h3>
                    <button class="lc-btn lc-btn-secondary lc-btn-sm" onclick="rulesManager.closeEditor()">
                        关闭
                    </button>
                </div>
                <div class="rule-editor-content">
                    <form class="lc-form" onsubmit="event.preventDefault(); rulesManager.saveCurrentRule();">
                        <div class="lc-form-group">
                            <label class="lc-label lc-label-required" for="rule-name">
                                规则名称
                            </label>
                            <input type="text" id="rule-name" class="lc-input" 
                                   placeholder="请输入规则名称，如：友情链接页面外链处理、屏蔽广告域名等"
                                   required maxlength="100">
                        </div>

                        <div class="lc-divider-text">条件设置（支持AND/OR逻辑和页面上下文）</div>
                        
                        <div id="conditions-container">
                            <!-- 条件将在这里动态生成 -->
                        </div>

                        <button type="button" class="lc-btn lc-btn-secondary" onclick="rulesManager.addCondition()">
                            添加条件组
                        </button>

                        <div class="lc-divider-text">保存规则</div>
                        
                        <div class="lc-grid lc-grid-2">
                            <button type="button" class="lc-btn lc-btn-secondary" onclick="rulesManager.closeEditor()">
                                取消
                            </button>
                            <button type="submit" class="lc-btn lc-btn-primary">
                                保存规则
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    // 条件管理方法
    addCondition(type = 'if', parentId = null) {
        const conditionId = ++this.conditionIdCounter;
        const container = document.getElementById('conditions-container');
        
        if (!container) return;

        const conditionHTML = this.getConditionHTML(conditionId, type);
        container.insertAdjacentHTML('beforeend', conditionHTML);
        
        // 为新条件添加默认规则
        if (type !== 'else') {
            this.addConditionRule(conditionId);
        }
        
        // 初始化新元素的事件
        this.initializeConditionEvents(conditionId);
    }

    getConditionHTML(conditionId, type) {
        const typeConfig = {
            'if': { label: 'IF' },
            'elseif': { label: 'ELSE IF' },
            'else': { label: 'ELSE' }
        };
        
        const config = typeConfig[type] || typeConfig['if'];
        
        return `
            <div class="condition-group" id="condition-${conditionId}" data-type="${type}">
                <div class="condition-header">
                    <div class="condition-type ${type}">
                        ${config.label}
                    </div>
                    <div class="condition-controls">
                        ${type !== 'else' ? `
                            <button type="button" class="lc-btn lc-btn-secondary lc-btn-sm" 
                                    onclick="rulesManager.addNestedCondition(${conditionId})"
                                    data-tooltip="添加嵌套条件">
                                嵌套
                            </button>
                        ` : ''}
                        <button type="button" class="lc-btn lc-btn-secondary lc-btn-sm" 
                                onclick="rulesManager.addElseIf(${conditionId})"
                                data-tooltip="添加否则如果条件">
                            + Else If
                        </button>
                        <button type="button" class="lc-btn lc-btn-secondary lc-btn-sm" 
                                onclick="rulesManager.addElse(${conditionId})"
                                data-tooltip="添加否则条件">
                            + Else
                        </button>
                        <button type="button" class="lc-btn lc-btn-danger lc-btn-sm" 
                                onclick="rulesManager.removeCondition(${conditionId})"
                                data-tooltip="删除此条件组">
                            删除
                        </button>
                    </div>
                </div>
                
                ${type !== 'else' ? `
                    <div class="condition-rules" id="rules-${conditionId}">
                        <!-- 条件规则将在这里生成 -->
                    </div>
                    
                    <button type="button" class="lc-btn lc-btn-secondary lc-btn-sm" 
                            onclick="rulesManager.addConditionRule(${conditionId})"
                            data-tooltip="添加匹配条件">
                        添加条件
                    </button>
                ` : ''}

                <div class="lc-divider-text">执行动作</div>
                
                <div class="actions-container" id="actions-${conditionId}">
                    ${this.getActionModulesHTML(conditionId)}
                </div>
            </div>
        `;
    }

    addConditionRule(conditionId) {
        const ruleId = Date.now() + Math.random();
        const container = document.getElementById(`rules-${conditionId}`);
        
        if (!container) return;

        const ruleHTML = this.getConditionRuleHTML(ruleId, conditionId);
        container.insertAdjacentHTML('beforeend', ruleHTML);
        
        // 初始化新规则的事件
        this.initializeRuleEvents(ruleId);
    }

    getConditionRuleHTML(ruleId, conditionId) {
        return `
            <div class="condition-row" id="rule-${ruleId}" data-rule-id="${ruleId}" data-condition-id="${conditionId}">
                <select class="lc-input lc-select" name="field-${ruleId}" onchange="rulesManager.handleFieldChange(${ruleId})">
                    <option value="domain">目标域名</option>
                    <option value="url">完整URL</option>
                    <option value="path">URL路径</option>
                    <option value="query">查询参数</option>
                    <option value="rel">Rel属性</option>
                    <optgroup label="页面上下文">
                        <option value="page_path">页面路径</option>
                        <option value="page_type">页面类型</option>
                        <option value="page_name">页面名称</option>
                        <option value="is_special_page">是否特殊页面</option>
                    </optgroup>
                </select>
                <select class="lc-input lc-select" name="operator-${ruleId}" id="operator-${ruleId}">
                    <option value="match">匹配模式</option>
                    <option value="contains">包含</option>
                    <option value="not_contains">不包含</option>
                    <option value="equals">完全等于</option>
                    <option value="not_equals">不等于</option>
                    <option value="starts_with">开始于</option>
                    <option value="ends_with">结束于</option>
                    <option value="regex">正则表达式</option>
                </select>
                <div class="value-input-container" id="value-container-${ruleId}">
                    <input type="text" class="lc-input" name="value-${ruleId}" id="value-${ruleId}"
                           placeholder="输入匹配值，支持通配符 * 和正则表达式"
                           required>
                </div>
                <button type="button" class="lc-btn lc-btn-danger lc-btn-sm" 
                        onclick="rulesManager.removeConditionRule(${ruleId})"
                        data-tooltip="删除此条件">
                    删除
                </button>
            </div>
            <div class="logic-operator" data-condition-id="${conditionId}">
                <span>逻辑关系:</span>
                <div class="logic-buttons" data-operator="and">
                    <button type="button" class="logic-button active" 
                            onclick="rulesManager.setLogicOperator(this, 'and', ${conditionId})">AND</button>
                    <button type="button" class="logic-button" 
                            onclick="rulesManager.setLogicOperator(this, 'or', ${conditionId})">OR</button>
                </div>
            </div>
        `;
    }

    /**
     * 处理字段变更
     */
    handleFieldChange(ruleId) {
        const fieldSelect = document.querySelector(`[name="field-${ruleId}"]`);
        const operatorSelect = document.getElementById(`operator-${ruleId}`);
        const valueInput = document.getElementById(`value-${ruleId}`);
        const valueContainer = document.getElementById(`value-container-${ruleId}`);
        
        if (!fieldSelect || !operatorSelect || !valueInput || !valueContainer) return;
        
        const field = fieldSelect.value;
        
        console.log(`字段切换到: ${field} (规则ID: ${ruleId})`);
        
        // 根据字段类型调整操作符选项
        this.updateOperatorOptions(operatorSelect, field);
        
        // 根据字段类型提供预设值和帮助信息
        this.updateValueInput(valueContainer, valueInput, field, ruleId);
    }

    updateOperatorOptions(operatorSelect, field) {
        const baseOptions = `
            <option value="match">匹配模式</option>
            <option value="contains">包含</option>
            <option value="not_contains">不包含</option>
            <option value="equals">完全等于</option>
            <option value="not_equals">不等于</option>
            <option value="starts_with">开始于</option>
            <option value="ends_with">结束于</option>
            <option value="regex">正则表达式</option>
        `;

        const booleanOptions = `
            <option value="equals">等于</option>
            <option value="not_equals">不等于</option>
        `;

        if (field === 'is_special_page') {
            operatorSelect.innerHTML = booleanOptions;
        } else {
            operatorSelect.innerHTML = baseOptions;
        }
    }

    updateValueInput(container, input, field, ruleId) {
        // 清除所有现有的帮助信息和自定义输入
        this.clearFieldHelp(container, ruleId);

        // 重置输入框
        let placeholder = '输入匹配值';
        let helpHTML = '';

        switch (field) {
            case 'page_path':
                placeholder = '如: /links.html, /friends/, /about/*';
                helpHTML = this.getPagePathHelp(ruleId);
                break;
            
            case 'page_type':
                placeholder = '如: links, home, post, page';
                helpHTML = this.getPageTypeHelp(ruleId);
                break;
                
            case 'page_name':
                placeholder = '如: links, friends, about';
                helpHTML = this.getPageNameHelp(ruleId);
                break;
                
            case 'is_special_page':
                // 对于布尔字段，替换为select而不是input
                this.createBooleanSelect(container, ruleId);
                helpHTML = this.getSpecialPageHelp();
                break;
                
            case 'domain':
                placeholder = '如: example.com, *.google.com, /.*\\.edu$/';
                helpHTML = this.getDomainHelp(ruleId);
                break;
                
            default:
                // 确保input元素存在
                this.ensureTextInput(container, ruleId);
                break;
        }

        // 更新placeholder（如果是文本输入框）
        const currentInput = container.querySelector(`[name="value-${ruleId}"]`);
        if (currentInput && currentInput.tagName === 'INPUT') {
            currentInput.placeholder = placeholder;
        }
        
        // 添加帮助信息
        if (helpHTML) {
            container.insertAdjacentHTML('afterend', helpHTML);
        }
    }

    /**
     * 清除字段帮助信息
     */
    clearFieldHelp(container, ruleId) {
        // 移除现有的帮助信息
        const parentElement = container.parentElement;
        const existingHelp = parentElement.querySelector('.field-help');
        if (existingHelp) {
            existingHelp.remove();
            console.log(`已清除规则 ${ruleId} 的帮助信息`);
        }
    }

    /**
     * 确保存在文本输入框
     */
    ensureTextInput(container, ruleId) {
        const currentElement = container.querySelector(`[name="value-${ruleId}"]`);
        if (!currentElement || currentElement.tagName !== 'INPUT') {
            container.innerHTML = `
                <input type="text" class="lc-input" name="value-${ruleId}" id="value-${ruleId}"
                       placeholder="输入匹配值，支持通配符 * 和正则表达式"
                       required>
            `;
            console.log(`已为规则 ${ruleId} 创建文本输入框`);
        }
    }

    /**
     * 创建布尔选择框
     */
    createBooleanSelect(container, ruleId) {
        container.innerHTML = `
            <select class="lc-input lc-select" name="value-${ruleId}" id="value-${ruleId}" required>
                <option value="true">是</option>
                <option value="false">否</option>
            </select>
        `;
        console.log(`已为规则 ${ruleId} 创建布尔选择框`);
    }

    /**
     * 获取页面路径帮助信息
     */
    getPagePathHelp(ruleId) {
        return `
            <div class="field-help">
                <div class="help-title">页面路径匹配示例：</div>
                <div class="help-examples">
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">/links.html</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">/friends/</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">/about/*</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">/links*</span>
                </div>
                <div class="help-desc">支持通配符 * 匹配任意字符，如 /links* 匹配所有以 /links 开头的路径</div>
            </div>
        `;
    }

    /**
     * 获取页面类型帮助信息
     */
    getPageTypeHelp(ruleId) {
        return `
            <div class="field-help">
                <div class="help-title">页面类型预设值：</div>
                <div class="help-examples">
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">links</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">home</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">post</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">page</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">about</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">contact</span>
                </div>
                <div class="help-desc">常见页面类型：links(友情链接), home(首页), post(文章), page(页面)</div>
            </div>
        `;
    }

    /**
     * 获取页面名称帮助信息
     */
    getPageNameHelp(ruleId) {
        return `
            <div class="field-help">
                <div class="help-title">页面名称示例：</div>
                <div class="help-examples">
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">links</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">friends</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">about</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">contact</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">友情链接</span>
                </div>
                <div class="help-desc">页面文件名（不含扩展名）或页面别名</div>
            </div>
        `;
    }

    /**
     * 获取特殊页面帮助信息
     */
    getSpecialPageHelp() {
        return `
            <div class="field-help">
                <div class="help-desc">特殊页面包括：友情链接页、关于页面、联系页面等</div>
            </div>
        `;
    }

    /**
     * 获取域名帮助信息
     */
    getDomainHelp(ruleId) {
        return `
            <div class="field-help">
                <div class="help-examples">
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">github.com</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">*.google.com</span>
                    <span class="help-example" onclick="rulesManager.setFieldValue(${ruleId}, this.textContent)">*.edu</span>
                </div>
            </div>
        `;
    }

    /**
     * 设置字段值的辅助方法
     */
    setFieldValue(ruleId, value) {
        const input = document.querySelector(`[name="value-${ruleId}"]`);
        if (input) {
            input.value = value;
            this.markDirty();
            console.log(`已设置规则 ${ruleId} 的值为: ${value}`);
        }
    }

    getActionModulesHTML(conditionId) {
        return `
            ${this.getRelActionModule(conditionId)}
            ${this.getUtmActionModule(conditionId)}
            ${this.getAttributesActionModule(conditionId)}
            ${this.getRefererActionModule(conditionId)}
            ${this.getSvgSuffixActionModule(conditionId)}
            ${this.getBlacklistActionModule(conditionId)}
            ${this.getRedirectActionModule(conditionId)}
            ${this.getAdvancedActionModule(conditionId)}
        `;
    }

    getRelActionModule(conditionId) {
        return `
            <div class="action-module" id="module-rel-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-rel-${conditionId}">
                        <span>修改链接关系 (Rel) - 严格按选择</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <div class="lc-form-group">
                        <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:4px;padding:8px;font-size:0.75rem;color:#0c4a6e;margin-bottom:12px;">
                            <strong>严格模式：</strong>只有勾选的rel属性才会添加，不会自动加任何其他属性。
                        </div>
                    </div>
                    <div class="lc-grid lc-grid-3">
                        <label class="lc-checkbox">
                            <input type="checkbox" id="rel-nofollow-${conditionId}">
                            <span>nofollow</span>
                        </label>
                        <label class="lc-checkbox">
                            <input type="checkbox" id="rel-sponsored-${conditionId}">
                            <span>sponsored</span>
                        </label>
                        <label class="lc-checkbox">
                            <input type="checkbox" id="rel-ugc-${conditionId}">
                            <span>ugc</span>
                        </label>
                        <label class="lc-checkbox">
                            <input type="checkbox" id="rel-noopener-${conditionId}">
                            <span>noopener</span>
                        </label>
                        <label class="lc-checkbox">
                            <input type="checkbox" id="rel-noreferrer-${conditionId}">
                            <span>noreferrer</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    getUtmActionModule(conditionId) {
        return `
            <div class="action-module" id="module-utm-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-utm-${conditionId}">
                        <span>添加UTM参数</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <div class="lc-grid lc-grid-2">
                        <div class="lc-form-group">
                            <label class="lc-label" for="utm-source-${conditionId}">utm_source</label>
                            <input type="text" id="utm-source-${conditionId}" class="lc-input" placeholder="如: blog">
                        </div>
                        <div class="lc-form-group">
                            <label class="lc-label" for="utm-medium-${conditionId}">utm_medium</label>
                            <input type="text" id="utm-medium-${conditionId}" class="lc-input" placeholder="如: link">
                        </div>
                        <div class="lc-form-group">
                            <label class="lc-label" for="utm-campaign-${conditionId}">utm_campaign</label>
                            <input type="text" id="utm-campaign-${conditionId}" class="lc-input" placeholder="如: article">
                        </div>
                        <div class="lc-form-group">
                            <label class="lc-label" for="utm-content-${conditionId}">utm_content</label>
                            <input type="text" id="utm-content-${conditionId}" class="lc-input" placeholder="如: sidebar">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getAttributesActionModule(conditionId) {
        return `
            <div class="action-module" id="module-attrs-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-attrs-${conditionId}">
                        <span>修改链接属性</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <div class="lc-form-group">
                        <label class="lc-checkbox">
                            <input type="checkbox" id="target-blank-${conditionId}">
                            <span>新窗口打开 (target="_blank") - 仅设置target，rel由上方控制</span>
                        </label>
                    </div>
                    <div class="lc-form-group">
                        <label class="lc-checkbox">
                            <input type="checkbox" id="force-https-${conditionId}">
                            <span>强制HTTPS</span>
                        </label>
                    </div>
                    <div class="lc-form-group">
                        <label class="lc-label" for="css-class-${conditionId}">CSS类名</label>
                        <input type="text" id="css-class-${conditionId}" class="lc-input" placeholder="如: external-link">
                    </div>
                    <div class="lc-form-group">
                        <label class="lc-label" for="title-attr-${conditionId}">标题属性</label>
                        <input type="text" id="title-attr-${conditionId}" class="lc-input" placeholder="鼠标悬停提示文字">
                    </div>
                </div>
            </div>
        `;
    }
    
    getRefererActionModule(conditionId) {
        return `
            <div class="action-module" id="module-referer-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-referer-${conditionId}">
                        <span>Referer控制</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <div class="lc-form-group">
                        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;padding:8px;font-size:0.75rem;color:#92400e;margin-bottom:12px;">
                            <strong>提示：</strong>不发送Referer需要在上方"修改链接关系"中勾选noreferrer，这里只是快捷选项。
                        </div>
                    </div>
                    <div class="lc-form-group">
                        <label class="lc-radio">
                            <input type="radio" id="referer-none-${conditionId}" name="referer-type-${conditionId}" value="none">
                            <span>不发送Referer (会在Rel中添加noreferrer)</span>
                        </label>
                        <label class="lc-radio">
                            <input type="radio" id="referer-custom-${conditionId}" name="referer-type-${conditionId}" value="custom">
                            <span>自定义Referer</span>
                        </label>
                    </div>
                    <div class="lc-form-group" id="custom-referer-field-${conditionId}" style="display: none;">
                        <label class="lc-label" for="custom-referer-${conditionId}">自定义Referer地址</label>
                        <input type="url" id="custom-referer-${conditionId}" class="lc-input" 
                               placeholder="输入自定义Referer，如: https://www.google.com/">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * SVG后缀标识模块（替换原SVG Base64）
     */
    getSvgSuffixActionModule(conditionId) {
        return `
            <div class="action-module" id="module-svg-suffix-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-svg-suffix-${conditionId}">
                        <span>SVG后缀标识 (NEW)</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <div class="lc-form-group">
                        <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:4px;padding:8px;font-size:0.75rem;color:#047857;margin-bottom:12px;">
                            <strong>SVG标识：</strong>为SVG链接添加后缀提示和可选的Base64代码展示。
                        </div>
                    </div>
                    <div class="lc-form-group">
                        <label class="lc-label" for="svg-suffix-text-${conditionId}">后缀文字</label>
                        <input type="text" id="svg-suffix-text-${conditionId}" class="lc-input" 
                               placeholder="如: [SVG]" value="[SVG]">
                    </div>
                    <div class="lc-form-group">
                        <label class="lc-label" for="svg-base64-code-${conditionId}">Base64代码（可选）</label>
                        <input type="text" id="svg-base64-code-${conditionId}" class="lc-input" 
                               placeholder="输入Base64代码片段，如: iVBORw0KGgoAAAAN...">
                        <div style="color:#6b7280;font-size:0.75rem;margin-top:4px;">
                            添加后会在链接后显示Base64代码片段，便于识别
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 黑名单设置模块（去掉重定向选项）
     */
    getBlacklistActionModule(conditionId) {
        return `
            <div class="action-module" id="module-blacklist-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-blacklist-${conditionId}">
                        <span>黑名单设置</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <div class="lc-form-group">
                        <label class="lc-radio">
                            <input type="radio" id="blacklist-disable-${conditionId}" 
                                   name="blacklist-action-${conditionId}" value="disable" checked>
                            <span>禁用链接 (转为纯文本)</span>
                        </label>
                        <label class="lc-radio">
                            <input type="radio" id="blacklist-warning-${conditionId}" 
                                   name="blacklist-action-${conditionId}" value="warning">
                            <span>添加警告标识</span>
                        </label>
                    </div>
                    <div class="lc-form-group" id="warning-text-field-${conditionId}" style="display: none;">
                        <label class="lc-label" for="warning-text-${conditionId}">警告文字</label>
                        <input type="text" id="warning-text-${conditionId}" class="lc-input" 
                               placeholder="警告文字，如: [外链已屏蔽]" value="[外链已屏蔽]">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 重定向控制模块
     */
    getRedirectActionModule(conditionId) {
        return `
            <div class="action-module" id="module-redirect-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-redirect-${conditionId}">
                        <span>启用重定向</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <div class="lc-form-group">
                        <div style="background:#dcfce7;border:1px solid #16a34a;border-radius:4px;padding:8px;font-size:0.75rem;color:#15803d;margin-bottom:12px;">
                            <strong>重定向控制：</strong>只有启用此选项的链接才会使用中转页，需要在插件设置中配置跳转页地址。
                        </div>
                        <div style="color:#64748b;font-size:0.875rem;line-height:1.5;">
                            启用此动作后，匹配的外链将通过中转页跳转，而不是直接链接到目标地址。
                            这样可以精确控制哪些链接需要重定向，而不是全部外链都重定向。
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 高级处理模块（新增自定义参数功能）
     */
    getAdvancedActionModule(conditionId) {
        return `
            <div class="action-module" id="module-advanced-${conditionId}">
                <div class="action-module-header" onclick="this.parentElement.classList.toggle('active')">
                    <label class="lc-checkbox">
                        <input type="checkbox" id="enable-advanced-${conditionId}">
                        <span>高级处理</span>
                    </label>
                </div>
                <div class="action-module-content">
                    <!-- 参数清理 -->
                    <div class="lc-form-group">
                        <div class="lc-form-sub-title">参数清理</div>
                        <label class="lc-checkbox">
                            <input type="checkbox" id="remove-utm-${conditionId}">
                            <span>移除现有UTM参数</span>
                        </label>
                        <label class="lc-checkbox">
                            <input type="checkbox" id="remove-tracking-${conditionId}">
                            <span>移除跟踪参数 (fbclid, gclid等)</span>
                        </label>
                    </div>
                    <div class="lc-form-group">
                        <label class="lc-label" for="custom-remove-params-${conditionId}">自定义移除参数</label>
                        <input type="text" id="custom-remove-params-${conditionId}" class="lc-input" 
                               placeholder="用逗号分隔，如: ref,from,source">
                    </div>
                    
                    <!-- 新增：自定义参数添加 -->
                    <div class="lc-divider-text" style="margin: 20px 0 15px;">添加自定义参数 (NEW)</div>
                    <div class="lc-form-group">
                        <label class="lc-checkbox">
                            <input type="checkbox" id="enable-custom-params-${conditionId}">
                            <span>启用自定义参数</span>
                        </label>
                    </div>
                    <div class="lc-form-group" id="custom-params-container-${conditionId}" style="display: none;">
                        <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:4px;padding:8px;font-size:0.75rem;color:#0c4a6e;margin-bottom:12px;">
                            <strong>说明：</strong>为链接添加自定义参数，如 ?from=myblog&source=article
                        </div>
                        <div id="custom-params-list-${conditionId}">
                            <!-- 参数列表将在这里生成 -->
                        </div>
                        <button type="button" class="lc-btn lc-btn-secondary lc-btn-sm" 
                                onclick="rulesManager.addCustomParam(${conditionId})">
                            + 添加参数
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 添加自定义参数行
     */
    addCustomParam(conditionId, name = '', value = '') {
        const container = document.getElementById(`custom-params-list-${conditionId}`);
        const paramId = Date.now() + Math.random();
        
        const paramHTML = `
            <div class="custom-param-row" id="param-${paramId}">
                <div class="lc-grid lc-grid-3" style="align-items: end; gap: 8px;">
                    <div>
                        <input type="text" class="lc-input lc-input-sm" 
                               placeholder="参数名，如: from" 
                               data-param-name="${paramId}" 
                               value="${name}">
                    </div>
                    <div>
                        <input type="text" class="lc-input lc-input-sm" 
                               placeholder="参数值，如: myblog" 
                               data-param-value="${paramId}"
                               value="${value}">
                    </div>
                    <div>
                        <button type="button" class="lc-btn lc-btn-danger lc-btn-sm" 
                                onclick="rulesManager.removeCustomParam('${paramId}')">
                            删除
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', paramHTML);
    }

    /**
     * 移除自定义参数行
     */
    removeCustomParam(paramId) {
        const element = document.getElementById(`param-${paramId}`);
        if (element) {
            element.remove();
            this.markDirty();
        }
    }

    // 事件初始化方法
    initializeConditionEvents(conditionId) {
        // 初始化自定义Referer显示/隐藏逻辑
        const refererRadios = document.querySelectorAll(`input[name="referer-type-${conditionId}"]`);
        const customField = document.getElementById(`custom-referer-field-${conditionId}`);
        
        refererRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (customField) {
                    customField.style.display = radio.value === 'custom' ? 'block' : 'none';
                }
            });
        });

        // 初始化黑名单警告文字显示/隐藏逻辑
        const blacklistRadios = document.querySelectorAll(`input[name="blacklist-action-${conditionId}"]`);
        const warningField = document.getElementById(`warning-text-field-${conditionId}`);
        
        blacklistRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (warningField) {
                    warningField.style.display = radio.value === 'warning' ? 'block' : 'none';
                }
            });
        });

        // 初始化自定义参数显示/隐藏逻辑
        const customParamsCheckbox = document.getElementById(`enable-custom-params-${conditionId}`);
        const customParamsContainer = document.getElementById(`custom-params-container-${conditionId}`);
        
        if (customParamsCheckbox && customParamsContainer) {
            customParamsCheckbox.addEventListener('change', () => {
                customParamsContainer.style.display = customParamsCheckbox.checked ? 'block' : 'none';
                if (customParamsCheckbox.checked) {
                    // 添加一个默认参数行
                    const paramsList = document.getElementById(`custom-params-list-${conditionId}`);
                    if (paramsList.children.length === 0) {
                        this.addCustomParam(conditionId, 'from', 'myblog');
                    }
                }
            });
        }
    }

    initializeRuleEvents(ruleId) {
        // 为新添加的规则元素绑定变更事件
        const ruleElement = document.getElementById(`rule-${ruleId}`);
        if (ruleElement) {
            const inputs = ruleElement.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.markDirty();
                });
            });
        }
    }

    // 条件操作方法
    addElseIf(afterConditionId) {
        this.addCondition('elseif');
    }

    addElse(afterConditionId) {
        this.addCondition('else');
    }

    addNestedCondition(parentId) {
        this.addCondition('if', parentId);
    }

    removeCondition(conditionId) {
        const element = document.getElementById(`condition-${conditionId}`);
        if (element) {
            const confirmed = confirm('确定删除此条件组吗？');
            if (confirmed) {
                element.remove();
                this.markDirty();
            }
        }
    }

    removeConditionRule(ruleId) {
        const ruleElement = document.getElementById(`rule-${ruleId}`);
        if (ruleElement) {
            const confirmed = confirm('确定删除此条件吗？');
            if (confirmed) {
                const logicElement = ruleElement.nextElementSibling;
                if (logicElement && logicElement.classList.contains('logic-operator')) {
                    logicElement.remove();
                }
                ruleElement.remove();
                this.markDirty();
            }
        }
    }

    setLogicOperator(button, operator, conditionId) {
        const container = button.parentElement;
        const buttons = container.querySelectorAll('.logic-button');
        
        buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        container.setAttribute('data-operator', operator);
        
        // 标记此条件组的逻辑运算符已更改
        const conditionElement = document.getElementById(`condition-${conditionId}`);
        if (conditionElement) {
            conditionElement.setAttribute('data-logic', operator);
        }
        
        this.markDirty();
        console.log(`条件组 ${conditionId} 逻辑设置为: ${operator.toUpperCase()}`);
    }

    // 规则保存和加载
    saveCurrentRule() {
        const rule = this.extractRuleFromEditor();
        if (!rule) return;

        if (this.currentEditingIndex >= 0) {
            this.rules[this.currentEditingIndex] = rule;
            this.showMessage('规则更新成功！', 'success');
        } else {
            this.rules.push(rule);
            this.showMessage('规则创建成功！', 'success');
        }

        this.markDirty();
        this.saveRules();
        this.render();
        this.closeEditor();
    }

    extractRuleFromEditor() {
        const nameInput = document.getElementById('rule-name');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) {
            this.showMessage('请输入规则名称', 'error');
            nameInput?.focus();
            return null;
        }

        const rule = {
            name: name,
            enable: true,
            conditions: []
        };

        // 提取所有条件组
        const conditionGroups = document.querySelectorAll('.condition-group');
        conditionGroups.forEach(group => {
            const conditionData = this.extractConditionData(group);
            if (conditionData) {
                rule.conditions.push(conditionData);
            }
        });

        if (rule.conditions.length === 0) {
            this.showMessage('请至少添加一个条件组', 'warning');
            return null;
        }

        console.log('提取的规则数据:', rule);
        return rule;
    }

    extractConditionData(groupElement) {
        const conditionId = groupElement.id.replace('condition-', '');
        const type = groupElement.getAttribute('data-type') || 'if';

        const condition = {
            type: type,
            rules: [],
            actions: []
        };

        // 提取逻辑运算符（对于非else类型）
        if (type !== 'else') {
            const logicOperator = groupElement.getAttribute('data-logic') || 
                                 groupElement.querySelector('.logic-buttons')?.getAttribute('data-operator') || 'and';
            condition.logic = logicOperator;

            // 提取条件规则
            const ruleElements = groupElement.querySelectorAll('.condition-row');
            ruleElements.forEach(ruleEl => {
                const ruleId = ruleEl.getAttribute('data-rule-id');
                const field = ruleEl.querySelector(`[name="field-${ruleId}"]`)?.value;
                const operator = ruleEl.querySelector(`[name="operator-${ruleId}"]`)?.value;
                
                // 对于不同字段类型，从不同的元素获取值
                let value;
                const valueElement = ruleEl.querySelector(`[name="value-${ruleId}"]`);
                if (valueElement) {
                    value = valueElement.value?.trim();
                }

                if (field && operator && value !== undefined && value !== '') {
                    condition.rules.push({ field, operator, value });
                }
            });
        }

        // 提取动作
        condition.actions = this.extractActionsFromCondition(conditionId);

        return condition;
    }

    extractActionsFromCondition(conditionId) {
        const actions = [];

        // 提取Rel动作
        if (document.getElementById(`enable-rel-${conditionId}`)?.checked) {
            const relValues = [];
            ['nofollow', 'sponsored', 'ugc', 'noopener', 'noreferrer'].forEach(rel => {
                if (document.getElementById(`rel-${rel}-${conditionId}`)?.checked) {
                    relValues.push(rel);
                }
            });
            if (relValues.length) {
                actions.push({ type: 'add_rel', values: relValues });
                console.log(`Rel动作: ${relValues.join(', ')} (严格按选择添加)`);
            }
        }

        // 提取UTM动作
        if (document.getElementById(`enable-utm-${conditionId}`)?.checked) {
            const utmData = {};
            ['source', 'medium', 'campaign', 'content'].forEach(param => {
                const value = document.getElementById(`utm-${param}-${conditionId}`)?.value?.trim();
                if (value) utmData[param] = value;
            });
            if (Object.keys(utmData).length) {
                actions.push({ type: 'add_utm', enabled: true, data: utmData });
            }
        }

        // 提取属性动作
        if (document.getElementById(`enable-attrs-${conditionId}`)?.checked) {
            if (document.getElementById(`target-blank-${conditionId}`)?.checked) {
                actions.push({ type: 'target_blank', enabled: true });
                console.log('target_blank 动作: 只设置target="_blank"，不自动加rel');
            }
            if (document.getElementById(`force-https-${conditionId}`)?.checked) {
                actions.push({ type: 'force_https', enabled: true });
            }
            const cssClass = document.getElementById(`css-class-${conditionId}`)?.value?.trim();
            if (cssClass) {
                actions.push({ type: 'add_class', value: cssClass });
            }
            const titleAttr = document.getElementById(`title-attr-${conditionId}`)?.value?.trim();
            if (titleAttr) {
                actions.push({ type: 'add_title', value: titleAttr });
            }
        }

        // 提取Referer控制
        if (document.getElementById(`enable-referer-${conditionId}`)?.checked) {
            const refererType = document.querySelector(`input[name="referer-type-${conditionId}"]:checked`)?.value;
            if (refererType === 'none') {
                console.warn('"不发送Referer" 需要在 Rel 模块中勾选 noreferrer');
            } else if (refererType === 'custom') {
                const customReferer = document.getElementById(`custom-referer-${conditionId}`)?.value?.trim();
                if (customReferer) {
                    actions.push({ type: 'add_referer', enabled: true, value: customReferer });
                }
            }
        }

        // 提取SVG后缀处理
        if (document.getElementById(`enable-svg-suffix-${conditionId}`)?.checked) {
            const suffixText = document.getElementById(`svg-suffix-text-${conditionId}`)?.value?.trim() || '[SVG]';
            const base64Code = document.getElementById(`svg-base64-code-${conditionId}`)?.value?.trim() || '';
            
            const svgAction = {
                type: 'svg_suffix',
                enabled: true,
                suffix_text: suffixText,
                base64_code: base64Code
            };
            actions.push(svgAction);
        }

        // 提取黑名单（去掉重定向选项）
        if (document.getElementById(`enable-blacklist-${conditionId}`)?.checked) {
            const blacklistAction = document.querySelector(`input[name="blacklist-action-${conditionId}"]:checked`)?.value;
            if (blacklistAction) {
                const action = {
                    type: 'add_to_blacklist',
                    enabled: true,
                    action: blacklistAction
                };

                if (blacklistAction === 'warning') {
                    const warningText = document.getElementById(`warning-text-${conditionId}`)?.value?.trim();
                    if (warningText) action.warning_text = warningText;
                }

                actions.push(action);
            }
        }

        // 提取重定向动作
        if (document.getElementById(`enable-redirect-${conditionId}`)?.checked) {
            actions.push({ type: 'enable_redirect', enabled: true });
            console.log('重定向动作: 启用重定向中转');
        }

        // 提取高级处理
        if (document.getElementById(`enable-advanced-${conditionId}`)?.checked) {
            if (document.getElementById(`remove-utm-${conditionId}`)?.checked) {
                actions.push({ type: 'remove_utm', enabled: true });
            }
            if (document.getElementById(`remove-tracking-${conditionId}`)?.checked) {
                actions.push({ type: 'remove_tracking', enabled: true });
            }
            const customRemoveParams = document.getElementById(`custom-remove-params-${conditionId}`)?.value?.trim();
            if (customRemoveParams) {
                const params = customRemoveParams.split(',').map(p => p.trim()).filter(p => p);
                if (params.length) {
                    actions.push({ type: 'remove_params', enabled: true, params });
                }
            }

            // 提取自定义参数添加
            if (document.getElementById(`enable-custom-params-${conditionId}`)?.checked) {
                const customParams = this.extractCustomParams(conditionId);
                if (customParams.length > 0) {
                    actions.push({ type: 'add_custom_params', enabled: true, params: customParams });
                    console.log('自定义参数动作:', customParams);
                }
            }
        }

        return actions;
    }

    /**
     * 提取自定义参数
     */
    extractCustomParams(conditionId) {
        const params = [];
        const paramRows = document.querySelectorAll(`#custom-params-list-${conditionId} .custom-param-row`);
        
        paramRows.forEach(row => {
            const nameInput = row.querySelector('[data-param-name]');
            const valueInput = row.querySelector('[data-param-value]');
            
            if (nameInput && valueInput) {
                const name = nameInput.value?.trim();
                const value = valueInput.value?.trim();
                
                if (name && value) {
                    params.push({ name, value });
                }
            }
        });
        
        return params;
    }

    loadRuleToEditor(rule) {
        console.log('加载规则到编辑器:', rule);
        this.clearEditor();

        // 设置规则名称
        const nameInput = document.getElementById('rule-name');
        if (nameInput) {
            nameInput.value = rule.name || '';
        }

        // 加载条件
        if (rule.conditions && rule.conditions.length > 0) {
            rule.conditions.forEach(condition => {
                this.addCondition(condition.type);
                const conditionId = this.conditionIdCounter;

                // 加载条件规则
                if (condition.rules && condition.rules.length > 0 && condition.type !== 'else') {
                    this.loadConditionRulesToEditor(conditionId, condition.rules, condition.logic || 'and');
                }

                // 加载动作
                if (condition.actions && condition.actions.length > 0) {
                    this.loadActionsToEditor(conditionId, condition.actions);
                }
            });
        } else {
            // 如果没有条件，添加默认条件
            this.addCondition('if');
        }
    }

    loadConditionRulesToEditor(conditionId, rules, logic = 'and') {
        // 先清空默认添加的条件
        const rulesContainer = document.getElementById(`rules-${conditionId}`);
        if (rulesContainer) {
            rulesContainer.innerHTML = '';
        }

        rules.forEach((ruleData) => {
            this.addConditionRule(conditionId);
            const ruleElements = document.querySelectorAll(`#rules-${conditionId} .condition-row`);
            const currentRuleElement = ruleElements[ruleElements.length - 1];
            
            if (currentRuleElement) {
                const ruleId = currentRuleElement.getAttribute('data-rule-id');

                // 设置字段、操作符、值
                const fieldSelect = currentRuleElement.querySelector(`[name="field-${ruleId}"]`);
                const operatorSelect = currentRuleElement.querySelector(`[name="operator-${ruleId}"]`);
                
                if (fieldSelect) {
                    fieldSelect.value = ruleData.field || 'domain';
                    // 触发字段变更事件以更新UI
                    this.handleFieldChange(ruleId);
                    
                    // 等待UI更新后设置值
                    setTimeout(() => {
                        const valueElement = currentRuleElement.querySelector(`[name="value-${ruleId}"]`);
                        if (valueElement) {
                            valueElement.value = ruleData.value || '';
                        }
                    }, 100);
                }
                if (operatorSelect) operatorSelect.value = ruleData.operator || 'match';
            }
        });

        // 设置逻辑运算符
        const logicButtons = document.querySelectorAll(`[data-condition-id="${conditionId}"] .logic-buttons`);
        logicButtons.forEach(container => {
            container.setAttribute('data-operator', logic);
            const buttons = container.querySelectorAll('.logic-button');
            buttons.forEach(btn => btn.classList.remove('active'));
            const targetBtn = container.querySelector(`[onclick*="'${logic}'"]`);
            if (targetBtn) targetBtn.classList.add('active');
        });

        // 设置条件组的逻辑属性
        const conditionElement = document.getElementById(`condition-${conditionId}`);
        if (conditionElement) {
            conditionElement.setAttribute('data-logic', logic);
        }

        console.log(`条件组 ${conditionId} 逻辑加载: ${logic.toUpperCase()}`);
    }

    loadActionsToEditor(conditionId, actions) {
        actions.forEach(action => {
            switch (action.type) {
                case 'add_rel':
                    if (action.values && action.values.length > 0) {
                        const enableCheckbox = document.getElementById(`enable-rel-${conditionId}`);
                        if (enableCheckbox) {
                            enableCheckbox.checked = true;
                            const module = document.getElementById(`module-rel-${conditionId}`);
                            if (module) module.classList.add('active');

                            action.values.forEach(rel => {
                                const relCheckbox = document.getElementById(`rel-${rel}-${conditionId}`);
                                if (relCheckbox) relCheckbox.checked = true;
                            });
                            
                            console.log(`加载 Rel: ${action.values.join(', ')}`);
                        }
                    }
                    break;

                case 'add_utm':
                    if (action.enabled && action.data) {
                        const enableCheckbox = document.getElementById(`enable-utm-${conditionId}`);
                        if (enableCheckbox) {
                            enableCheckbox.checked = true;
                            const module = document.getElementById(`module-utm-${conditionId}`);
                            if (module) module.classList.add('active');

                            Object.keys(action.data).forEach(param => {
                                const input = document.getElementById(`utm-${param}-${conditionId}`);
                                if (input) input.value = action.data[param];
                            });
                        }
                    }
                    break;

                case 'target_blank':
                    if (action.enabled) {
                        this.activateAttributeAction(conditionId, 'target-blank');
                        console.log('加载 target_blank: 仅设置新窗口');
                    }
                    break;

                case 'force_https':
                    if (action.enabled) {
                        this.activateAttributeAction(conditionId, 'force-https');
                    }
                    break;

                case 'add_class':
                    if (action.value) {
                        this.activateAttributeAction(conditionId);
                        const classInput = document.getElementById(`css-class-${conditionId}`);
                        if (classInput) classInput.value = action.value;
                    }
                    break;

                case 'add_title':
                    if (action.value) {
                        this.activateAttributeAction(conditionId);
                        const titleInput = document.getElementById(`title-attr-${conditionId}`);
                        if (titleInput) titleInput.value = action.value;
                    }
                    break;

                case 'add_referer':
                    if (action.enabled && action.value) {
                        const enableCheckbox = document.getElementById(`enable-referer-${conditionId}`);
                        if (enableCheckbox) {
                            enableCheckbox.checked = true;
                            const module = document.getElementById(`module-referer-${conditionId}`);
                            if (module) module.classList.add('active');

                            const customRadio = document.getElementById(`referer-custom-${conditionId}`);
                            if (customRadio) {
                                customRadio.checked = true;
                                const customField = document.getElementById(`custom-referer-field-${conditionId}`);
                                if (customField) customField.style.display = 'block';
                                
                                const customInput = document.getElementById(`custom-referer-${conditionId}`);
                                if (customInput) customInput.value = action.value;
                            }
                        }
                    }
                    break;

                case 'svg_suffix':
                    if (action.enabled) {
                        const enableCheckbox = document.getElementById(`enable-svg-suffix-${conditionId}`);
                        if (enableCheckbox) {
                            enableCheckbox.checked = true;
                            const module = document.getElementById(`module-svg-suffix-${conditionId}`);
                            if (module) module.classList.add('active');

                            const suffixInput = document.getElementById(`svg-suffix-text-${conditionId}`);
                            if (suffixInput && action.suffix_text) {
                                suffixInput.value = action.suffix_text;
                            }
                            
                            const base64Input = document.getElementById(`svg-base64-code-${conditionId}`);
                            if (base64Input && action.base64_code) {
                                base64Input.value = action.base64_code;
                            }
                        }
                    }
                    break;

                case 'add_to_blacklist':
                    if (action.enabled) {
                        const enableCheckbox = document.getElementById(`enable-blacklist-${conditionId}`);
                        if (enableCheckbox) {
                            enableCheckbox.checked = true;
                            const module = document.getElementById(`module-blacklist-${conditionId}`);
                            if (module) module.classList.add('active');

                            const actionRadio = document.getElementById(`blacklist-${action.action}-${conditionId}`);
                            if (actionRadio) actionRadio.checked = true;

                            if (action.action === 'warning' && action.warning_text) {
                                const warningField = document.getElementById(`warning-text-field-${conditionId}`);
                                if (warningField) warningField.style.display = 'block';
                                
                                const warningInput = document.getElementById(`warning-text-${conditionId}`);
                                if (warningInput) warningInput.value = action.warning_text;
                            }
                        }
                    }
                    break;
                
                case 'enable_redirect':
                    if (action.enabled) {
                        const enableCheckbox = document.getElementById(`enable-redirect-${conditionId}`);
                        if (enableCheckbox) {
                            enableCheckbox.checked = true;
                            const module = document.getElementById(`module-redirect-${conditionId}`);
                            if (module) module.classList.add('active');
                            console.log('加载 重定向动作');
                        }
                    }
                    break;

                case 'add_custom_params':
                    if (action.enabled && action.params && action.params.length > 0) {
                        const enableCheckbox = document.getElementById(`enable-advanced-${conditionId}`);
                        const customParamsCheckbox = document.getElementById(`enable-custom-params-${conditionId}`);
                        
                        if (enableCheckbox && customParamsCheckbox) {
                            enableCheckbox.checked = true;
                            customParamsCheckbox.checked = true;
                            
                            const advancedModule = document.getElementById(`module-advanced-${conditionId}`);
                            const customParamsContainer = document.getElementById(`custom-params-container-${conditionId}`);
                            
                            if (advancedModule) advancedModule.classList.add('active');
                            if (customParamsContainer) customParamsContainer.style.display = 'block';
                            
                            // 加载自定义参数
                            action.params.forEach(param => {
                                this.addCustomParam(conditionId, param.name || '', param.value || '');
                            });
                            
                            console.log('加载 自定义参数:', action.params);
                        }
                    }
                    break;
            }
        });
    }

    activateAttributeAction(conditionId, specific = null) {
        const enableCheckbox = document.getElementById(`enable-attrs-${conditionId}`);
        if (enableCheckbox) {
            enableCheckbox.checked = true;
            const module = document.getElementById(`module-attrs-${conditionId}`);
            if (module) module.classList.add('active');

            if (specific) {
                const specificCheckbox = document.getElementById(`${specific}-${conditionId}`);
                if (specificCheckbox) specificCheckbox.checked = true;
            }
        }
    }

    // 工具方法
    markDirty() {
        this.isDirty = true;
    }

    updateRuleCardState(index) {
        const card = document.querySelector(`[data-index="${index}"]`);
        if (card) {
            if (this.rules[index].enable) {
                card.classList.remove('disabled');
            } else {
                card.classList.add('disabled');
            }
        }
    }

    validateRules() {
        // 验证规则的有效性
        let hasInvalidRules = false;
        
        this.rules.forEach((rule, index) => {
            if (!rule.name || !rule.conditions || rule.conditions.length === 0) {
                console.warn(`规则 ${index + 1} 配置不完整`);
                hasInvalidRules = true;
            }

            // 检查条件逻辑
            rule.conditions.forEach((condition, condIndex) => {
                if (condition.type !== 'else' && !condition.logic) {
                    console.warn(`规则 ${index + 1} 条件 ${condIndex + 1} 缺少逻辑运算符，将使用默认 AND`);
                    condition.logic = 'and';
                }
            });
        });
        
        if (hasInvalidRules) {
            console.warn('发现无效规则，请检查配置');
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable
        );
    }

    // 文件操作工具方法
    selectFile(accept = '') {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.onchange = (e) => resolve(e.target.files[0] || null);
            input.click();
        });
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    // UI 辅助方法
    showMessage(text, type = 'info', duration = 3000) {
        const messageEl = document.createElement('div');
        messageEl.className = `lc-message lc-message-${type}`;
        messageEl.innerHTML = `
            <div class="lc-message-content">
                <div class="header">${this.getMessageTitle(type)}</div>
                <p>${text}</p>
            </div>
            <button class="lc-message-close">×</button>
        `;
        
        const container = document.getElementById('linkcare-rules-manager');
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
                    messageEl.style.transform = 'translateY(-10px)';
                    setTimeout(() => messageEl.remove(), 300);
                }
            }, duration);
        }
    }

    getMessageTitle(type) {
        const titles = {
            'success': '成功',
            'error': '错误',
            'warning': '警告',
            'info': '提示'
        };
        return titles[type] || '提示';
    }

    showConfirmDialog(title, message, confirmText = '确定', cancelText = '取消') {
        return new Promise((resolve) => {
            const confirmed = confirm(`${title}\n\n${message}`);
            resolve(confirmed);
        });
    }

    // 清理方法
    destroy() {
        if (this.sortable) {
            this.sortable.destroy();
        }
        
        // 移除事件监听器
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        
        console.log('LinkCare Rules Manager 已销毁');
    }
}

// CSS样式增强（SVG标识版 + 自定义参数）
const svgCustomParamStyles = `
<style>
.version-badge {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 500;
    margin-left: 8px;
    display: inline-block;
    animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
}

.field-help {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    margin-top: 8px;
    font-size: 0.875rem;
    position: relative;
    z-index: 10;
}

.help-title {
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
}

.help-examples {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.help-example {
    background: #3b82f6;
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
}

.help-example:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.help-example:active {
    transform: translateY(0);
    background: #1e40af;
}

.help-desc {
    color: #64748b;
    font-size: 0.75rem;
    line-height: 1.5;
}

.value-input-container {
    position: relative;
    min-height: 40px;
}

.condition-row select[name^="field-"] optgroup {
    background: #f0f9ff;
    font-weight: 600;
    color: #1e40af;
}

.condition-row select[name^="field-"] optgroup option {
    background: white;
    color: #374151;
    font-weight: 400;
    padding-left: 16px;
}

.condition-row select[name^="field-"] optgroup option:before {
    content: "→ ";
    color: #3b82f6;
}

/* 修复帮助信息重叠问题 */
.condition-row {
    margin-bottom: 20px;
    position: relative;
}

.condition-row + .logic-operator {
    margin-top: 20px;
}

/* 确保帮助信息不被遮挡 */
.rule-editor-content {
    overflow: visible;
}

.actions-container {
    margin-top: 30px;
}

/* SVG标识标签样式 */
.action-tag.svg-suffix {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    font-weight: 600;
}

/* 自定义参数标签样式 */
.action-tag.custom-params {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    font-weight: 600;
}

/* 重定向标签样式 */
.action-tag.redirect {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    font-weight: 600;
    animation: redirect-pulse 2s infinite;
}

@keyframes redirect-pulse {
    0%, 100% { 
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); 
    }
    50% { 
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1); 
    }
}

/* 自定义参数行样式 */
.custom-param-row {
    margin-bottom: 8px;
    padding: 8px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
}

.lc-input-sm {
    padding: 6px 10px;
    font-size: 0.875rem;
    height: auto;
}

/* 表单子标题样式 */
.lc-form-sub-title {
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    font-size: 0.875rem;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 4px;
}

/* 分隔线样式优化 */
.lc-divider-text {
    position: relative;
    text-align: center;
    margin: 20px 0;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
}

.lc-divider-text:before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: #e5e7eb;
    z-index: 1;
}

.lc-divider-text span,
.lc-divider-text {
    background: white;
    padding: 0 12px;
    position: relative;
    z-index: 2;
}
</style>
`;

// 注入CSS样式
document.head.insertAdjacentHTML('beforeend', svgCustomParamStyles);

// 全局初始化
let rulesManager;
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('linkcare-rules-manager')) {
        rulesManager = new AdvancedRulesManager();
        
        // 添加快捷键提示
        console.log('LinkCare Rules Manager v5.5.0 SVG标识版 + 自定义参数快捷键:');
        console.log('Ctrl/Cmd + S: 保存规则');
        console.log('Ctrl/Cmd + N: 新建规则');
        console.log('Ctrl/Cmd + D: 复制规则');
        console.log('ESC: 关闭编辑器');
        console.log('');
        console.log('新功能: SVG后缀标识 + 自定义参数');
        console.log('- svg_suffix: 为SVG链接添加后缀提示和Base64代码');
        console.log('- add_custom_params: 添加自定义URL参数');
        console.log('- 黑名单去掉重复的重定向选项');
    }
});

// 导出到全局作用域
window.AdvancedRulesManager = AdvancedRulesManager;
