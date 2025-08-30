<?php
/**
 * LinkCare 跳转页面（逻辑严谨版 + 返回逻辑增强）
 * 提供外链跳转提醒和统计功能，集成规则引擎
 * @version 5.2.1
 */

// 尝试加载 LinkCare 插件
$pluginDir = __DIR__;
$pluginPath = $pluginDir . '/Plugin.php';

if (file_exists($pluginPath)) {
    require_once $pluginPath;
    $hasPlugin = true;
} else {
    $hasPlugin = false;
}

// 获取目标URL
$targetUrl = $_GET['url'] ?? '';
$targetUrl = filter_var($targetUrl, FILTER_VALIDATE_URL);

if (!$targetUrl) {
    http_response_code(400);
    die('无效的URL参数');
}

// 解析URL信息
$parsedUrl = parse_url($targetUrl);
$domain = $parsedUrl['host'] ?? '';
$isSecure = ($parsedUrl['scheme'] ?? '') === 'https';

// 规则引擎检查（如果插件可用）
$ruleStatus = [];
$isBlacklisted = false;
$isTrusted = false;
$blockReason = '';

if ($hasPlugin && class_exists('LinkCare_Plugin')) {
    try {
        // 使用规则引擎检查链接
        $rules = LinkCare_Plugin::getRules();
        $appliedRules = LinkCare_Plugin::checkLinkRules($targetUrl, $domain);
        
        // 模拟链接对象来应用规则
        $link = [
            'url'   => $targetUrl,
            'text'  => '',
            'host'  => $domain,
            'attrs' => ['rel'=>[], 'target'=>'', 'class'=>[]]
        ];

        // 应用规则引擎获取状态
        foreach ($rules as $rule) {
            if (!empty($rule['enable']) && in_array($rule['name'], $appliedRules)) {
                $linkTest = $link;
                foreach ($rule['conditions'] as $condition) {
                    if (!empty($condition['actions'])) {
                        foreach ($condition['actions'] as $action) {
                            // 检查黑名单动作
                            if ($action['type'] === 'add_to_blacklist' && !empty($action['enabled'])) {
                                $isBlacklisted = true;
                                $blockMode = $action['action'] ?? 'disable';
                                
                                if ($blockMode === 'disable') {
                                    $blockReason = '链接已被规则禁用';
                                } elseif ($blockMode === 'redirect') {
                                    $blockReason = '链接被标记为需要中转';
                                } else {
                                    $blockReason = '链接存在安全风险';
                                }
                                break 3; // 跳出所有循环
                            }
                            
                            // 收集其他状态
                            if ($action['type'] === 'add_rel' && !empty($action['values'])) {
                                $ruleStatus = array_merge($ruleStatus, $action['values']);
                            }
                            if ($action['type'] === 'target_blank' && !empty($action['enabled'])) {
                                $ruleStatus[] = 'target_blank';
                            }
                        }
                    }
                }
            }
        }
        
        // 判断是否为可信域名（基于规则配置）
        foreach ($rules as $rule) {
            if (!empty($rule['enable']) && in_array($rule['name'], $appliedRules)) {
                foreach ($rule['conditions'] as $condition) {
                    if ($condition['type'] === 'if' && !empty($condition['rules'])) {
                        foreach ($condition['rules'] as $condRule) {
                            if ($condRule['field'] === 'domain' && 
                                ($condRule['operator'] === 'equals' || $condRule['operator'] === 'match')) {
                                // 假设精确匹配或通配符匹配的域名是可信的
                                if (preg_match('/^[a-zA-Z0-9.-]+\.(com|org|edu|gov)$/', $condRule['value'])) {
                                    $isTrusted = true;
                                    break 3;
                                }
                            }
                        }
                    }
                }
            }
        }
        
    } catch (Exception $e) {
        error_log('LinkCare 规则引擎检查失败: ' . $e->getMessage());
    }
}

// 如果没有插件，使用传统的可信域名列表
if (!$hasPlugin) {
    $trustedDomains = [
        'github.com', 'stackoverflow.com', 'developer.mozilla.org',
        'w3.org', 'wikipedia.org', 'google.com', 'microsoft.com',
        'apple.com', 'mozilla.org', 'php.net', 'jquery.com'
    ];
    $isTrusted = in_array($domain, $trustedDomains);
}

// 黑名单检查 - 如果被规则禁用，显示错误页面
if ($isBlacklisted) {
    http_response_code(403);
    ?>
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>链接已被禁用</title>
        <meta name="robots" content="noindex, nofollow">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
                   background: #f8f9fa; margin: 0; padding: 40px; text-align: center; }
            .error-container { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
                              padding: 40px; max-width: 500px; margin: 0 auto; border-left: 4px solid #dc3545; }
            .error-icon { font-size: 4rem; margin-bottom: 20px; color: #dc3545; }
            .error-title { font-size: 1.5rem; font-weight: 600; color: #dc3545; margin-bottom: 15px; }
            .error-message { color: #6c757d; margin-bottom: 30px; line-height: 1.6; }
            .btn { padding: 12px 24px; background: #6c757d; color: white; text-decoration: none; 
                   border-radius: 8px; display: inline-block; font-weight: 500; }
            .btn:hover { background: #545b62; color: white; }
            .block-info { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; 
                         padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 0.875rem; }
        </style>
    </head>
    <body>
        <div class="error-container">
            <div class="error-icon">🚫</div>
            <h1 class="error-title">链接访问被拒绝</h1>
            <div class="block-info">
                <strong>禁用原因：</strong><?php echo htmlspecialchars($blockReason); ?><br>
                <strong>目标域名：</strong><?php echo htmlspecialchars($domain); ?>
            </div>
            <div class="error-message">
                根据网站安全策略，此链接已被规则引擎标记为禁用。<br>
                如果您认为这是误判，请联系网站管理员。
            </div>
            <a href="javascript:void(0)" onclick="goBack()" class="btn">返回上一页</a>
        </div>
        
        <script>
            function goBack() {
                const defaultBackUrl = "/";
                if (document.referrer && document.referrer !== window.location.href) {
                    window.location.href = document.referrer;
                } else {
                    window.location.href = defaultBackUrl;
                }
            }
        </script>
    </body>
    </html>
    <?php
    
    // 记录被阻止的访问
    $logFile = $pluginDir . '/logs/blocked_redirects.log';
    if (!is_dir(dirname($logFile))) @mkdir(dirname($logFile), 0755, true);
    
    $blockData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'target' => $targetUrl,
        'domain' => $domain,
        'reason' => $blockReason,
        'applied_rules' => $appliedRules ?? [],
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    
    if (is_writable(dirname($logFile))) {
        file_put_contents($logFile, json_encode($blockData, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
    }
    
    exit;
}

// 获取站点首页URL（作为返回默认页）
$siteUrl = '/';
if ($hasPlugin && function_exists('Helper')) {
    try {
        $siteUrl = Helper::options()->siteUrl;
    } catch (Exception $e) {
        // 如果无法获取，保持默认值
    }
}

// 记录正常跳转统计
$logFile = $pluginDir . '/logs/redirects.log';
if (!is_dir(dirname($logFile))) @mkdir(dirname($logFile), 0755, true);

if (is_writable(dirname($logFile))) {
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'target' => $targetUrl,
        'domain' => $domain,
        'is_trusted' => $isTrusted,
        'rule_status' => array_unique($ruleStatus),
        'applied_rules' => $appliedRules ?? [],
        'referrer' => $_SERVER['HTTP_REFERER'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? ''
    ];
    file_put_contents($logFile, json_encode($logData, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

$redirectDelay = $isTrusted ? 2 : 5; // 可信域名减少等待时间
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>外链跳转提醒 - LinkCare 安全保护</title>
    <meta name="robots" content="noindex, nofollow">
    <meta name="description" content="LinkCare 外链安全跳转服务，保护您的浏览安全">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fomantic-ui@2.9.2/dist/semantic.min.css">
    <style>
        :root {
            --primary-color: #007bff;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --danger-color: #dc3545;
        }
        
        body {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .redirect-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            padding: 40px;
            max-width: 650px;
            width: 100%;
            text-align: center;
            border: 1px solid #e1e8ed;
            position: relative;
            overflow: hidden;
        }

        .redirect-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--primary-color), var(--success-color));
        }

        .redirect-header {
            margin-bottom: 30px;
        }

        .redirect-title {
            font-size: 2rem;
            color: #2c3e50;
            margin-bottom: 15px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }

        .redirect-subtitle {
            font-size: 1rem;
            color: #6c757d;
            line-height: 1.6;
        }

        .url-info {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            text-align: left;
            border-left: 4px solid var(--primary-color);
        }

        .url-label {
            font-weight: 600;
            color: #495057;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .url-display {
            font-family: 'Monaco', 'Menlo', 'SF Mono', monospace;
            word-break: break-all;
            padding: 16px;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            font-size: 0.875rem;
            color: #495057;
            line-height: 1.5;
        }

        .rule-status {
            margin-top: 15px;
            padding: 12px;
            background: #e7f3ff;
            border: 1px solid #b8daff;
            border-radius: 8px;
            font-size: 0.875rem;
        }

        .status-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
        }

        .status-tag {
            padding: 3px 8px;
            background: var(--primary-color);
            color: white;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 500;
        }

        .countdown-section {
            margin: 30px 0;
        }

        .countdown-number {
            font-size: 3.5rem;
            font-weight: 800;
            color: var(--primary-color);
            margin: 15px 0;
            text-shadow: 0 2px 4px rgba(0,123,255,0.3);
        }

        .countdown-text {
            color: #6c757d;
            font-size: 0.875rem;
            margin-bottom: 20px;
        }

        .progress-container {
            background: #e9ecef;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin: 20px 0;
            position: relative;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--primary-color), var(--success-color));
            border-radius: 4px;
            transition: width 0.1s linear;
            position: relative;
        }

        .progress-bar::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 30px;
        }

        .btn {
            padding: 14px 28px;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary-color), #0056b3);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0,123,255,0.3);
            color: white;
        }

        .btn-secondary {
            background: linear-gradient(135deg, #6c757d, #545b62);
            color: white;
        }

        .btn-secondary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(108,117,125,0.3);
            color: white;
        }

        .alert {
            padding: 18px 24px;
            border-radius: 12px;
            margin: 25px 0;
            border: 1px solid;
            font-weight: 500;
        }

        .alert-success {
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
            border-color: #b8e6c1;
            color: #155724;
        }

        .alert-warning {
            background: linear-gradient(135deg, #fff3cd, #ffeaa7);
            border-color: #f0d000;
            color: #856404;
        }

        .domain-badges {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-top: 15px;
            flex-wrap: wrap;
        }

        .domain-badge {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-trusted {
            background: linear-gradient(135deg, #d4edda, #c3e6cb);
            color: #155724;
            border: 1px solid #b8e6c1;
        }

        .badge-untrusted {
            background: linear-gradient(135deg, #f8d7da, #f1aeb5);
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .badge-secure {
            background: linear-gradient(135deg, #cce5ff, #99d3ff);
            color: #004085;
            border: 1px solid #7cc7ff;
        }

        .footer-info {
            margin-top: 35px;
            padding-top: 25px;
            border-top: 1px solid #e9ecef;
            font-size: 0.8125rem;
            color: #6c757d;
        }

        .version-info {
            background: #f1f3f4;
            color: #5f6368;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.75rem;
            margin-top: 15px;
            font-family: 'Monaco', 'Menlo', monospace;
        }

        @media (max-width: 768px) {
            .redirect-container {
                padding: 30px 24px;
                margin: 10px;
            }

            .action-buttons {
                flex-direction: column;
            }

            .countdown-number {
                font-size: 2.5rem;
            }

            .redirect-title {
                font-size: 1.5rem;
            }
            
            .btn {
                padding: 12px 24px;
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>
    <div class="redirect-container">
        <div class="redirect-header">
            <h1 class="redirect-title">
                🔒 外链安全跳转
            </h1>
            <p class="redirect-subtitle">
                <?php if ($isTrusted): ?>
                    您即将访问一个可信的外部网站，系统将自动为您跳转
                <?php else: ?>
                    您即将离开本站访问外部网站，请确认链接安全性后继续
                <?php endif; ?>
            </p>
        </div>

        <div class="alert <?php echo $isTrusted ? 'alert-success' : 'alert-warning'; ?>">
            <?php if ($isTrusted): ?>
                <strong>✅ 可信域名</strong> - 这是一个已验证的安全网站
            <?php else: ?>
                <strong>⚠️ 请注意</strong> - 这是一个外部网站，请确认链接安全性
            <?php endif; ?>
        </div>

        <div class="url-info">
            <div class="url-label">
                <i class="linkify icon"></i>
                目标网址
            </div>
            <div class="url-display"><?php echo htmlspecialchars($targetUrl); ?></div>
            
            <div class="domain-badges">
                <span>域名:</span>
                <span class="domain-badge <?php echo $isTrusted ? 'badge-trusted' : 'badge-untrusted'; ?>">
                    <?php echo htmlspecialchars($domain); ?>
                </span>
                
                <?php if ($isSecure): ?>
                    <span class="domain-badge badge-secure">HTTPS 安全</span>
                <?php endif; ?>
            </div>

            <?php if ($hasPlugin && !empty($ruleStatus)): ?>
                <div class="rule-status">
                    <strong>🎯 规则引擎状态:</strong>
                    <div class="status-tags">
                        <?php foreach (array_slice($ruleStatus, 0, 6) as $status): ?>
                            <span class="status-tag"><?php echo htmlspecialchars($status); ?></span>
                        <?php endforeach; ?>
                        <?php if (count($ruleStatus) > 6): ?>
                            <span class="status-tag">+<?php echo count($ruleStatus) - 6; ?>更多</span>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>

        <div class="countdown-section">
            <div class="countdown-number" id="countdown"><?php echo $redirectDelay; ?></div>
            <div class="countdown-text">
                系统将在 <span id="timer"><?php echo $redirectDelay; ?></span> 秒后自动跳转
            </div>
            
            <div class="progress-container">
                <div class="progress-bar" id="progress"></div>
            </div>
        </div>

        <div class="action-buttons">
            <a href="<?php echo htmlspecialchars($targetUrl); ?>" class="btn btn-primary" id="jumpBtn">
                <i class="external alternate icon"></i>
                立即跳转
            </a>
            <a href="javascript:void(0)" onclick="goBack()" class="btn btn-secondary">
                <i class="arrow left icon"></i>
                返回上页
            </a>
        </div>

        <div class="footer-info">
            <p><strong>LinkCare</strong> 外链安全保护服务</p>
            <p>按 <kbd>Enter</kbd> 键立即跳转，按 <kbd>ESC</kbd> 键返回上页</p>
            
            <?php if ($hasPlugin): ?>
                <div class="version-info">
                    ✅ 规则引擎已启用 | LinkCare v5.2.1 返回逻辑增强版
                </div>
            <?php else: ?>
                <div class="version-info" style="background:#fff3cd;color:#856404;">
                    ⚠️ 规则引擎未加载，使用传统模式 | LinkCare v5.2.1
                </div>
            <?php endif; ?>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        (function() {
            const targetUrl = <?php echo json_encode($targetUrl); ?>;
            const redirectDelay = <?php echo $redirectDelay; ?>;
            let countdown = redirectDelay;
            
            const countdownEl = document.getElementById('countdown');
            const progressEl = document.getElementById('progress');
            const timerEl = document.getElementById('timer');

            function updateProgress() {
                const progress = ((redirectDelay - countdown) / redirectDelay) * 100;
                progressEl.style.width = progress + '%';
            }

            const timer = setInterval(() => {
                countdown--;
                countdownEl.textContent = countdown;
                timerEl.textContent = countdown;
                updateProgress();

                if (countdown <= 0) {
                    clearInterval(timer);
                    // 添加跳转动画
                    document.querySelector('.redirect-container').style.transform = 'scale(0.95)';
                    document.querySelector('.redirect-container').style.opacity = '0.8';
                    
                    setTimeout(() => {
                        window.location.href = targetUrl;
                    }, 200);
                }
            }, 1000);

            // 返回上一页逻辑（增强版，带 fallback）
            window.goBack = function() {
                const defaultBackUrl = <?php echo json_encode($siteUrl); ?>;
                
                // 检查是否有来源页面且不是当前页面
                if (document.referrer && 
                    document.referrer !== window.location.href && 
                    document.referrer !== window.location.origin + window.location.pathname) {
                    
                    console.log('返回来源页面:', document.referrer);
                    window.location.href = document.referrer;
                } else {
                    console.log('返回默认页面:', defaultBackUrl);
                    window.location.href = defaultBackUrl;
                }
            };

            // 键盘快捷键
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    window.location.href = targetUrl;
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    goBack();
                }
            });

            // 初始化进度条
            updateProgress();

            // 页面加载完成后的提示
            console.log('%c LinkCare 外链跳转页面 v5.2.1 (返回逻辑增强)', 'font-weight: bold; color: #007bff;');
            console.log('🔒 规则引擎状态:', <?php echo $hasPlugin ? 'true' : 'false'; ?>);
            console.log('🎯 目标域名:', <?php echo json_encode($domain); ?>);
            console.log('✅ 可信状态:', <?php echo $isTrusted ? 'true' : 'false'; ?>);
            console.log('🏠 返回默认页:', <?php echo json_encode($siteUrl); ?>);
        })();
    </script>
</body>
</html>
