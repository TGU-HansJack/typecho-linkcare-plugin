<?php
if(!defined('__TYPECHO_ADMIN__')){
    require_once dirname(__DIR__, 2) . '/admin/common.php';
}

include 'header.php';
include 'menu.php';

$opt = Helper::options()->plugin('LinkCare');
$pluginUrl = Helper::options()->pluginUrl . '/LinkCare';
$cacheDir  = __DIR__ . '/cache';
$cacheFile = $cacheDir . '/linkcare_cache.json';
$cacheTTL  = intval($opt->cacheExpiry ?? 21600);
$perPageOptions = [10, 20, 30, 50, 100];

$perPage = isset($_GET['limit']) && in_array(intval($_GET['limit']), $perPageOptions) ? intval($_GET['limit']) : 20;
$tab     = $_GET['tab']     ?? 'links';
$keyword = trim($_GET['keyword'] ?? '');
$page    = max(1, intval($_GET['page'] ?? 1));

// 刷新缓存请求
if (isset($_GET['refresh']) && $_GET['refresh'] == 1) {
    @unlink($cacheFile);
    echo '<div class="lc-message lc-message-success">
        <div class="lc-message-content">
            <strong>缓存已刷新</strong>
            <p>系统正在重新扫描数据，请稍候。</p>
        </div>
        <button class="lc-message-close">&times;</button>
    </div>';
}

// 引入 CSS
$monitorCssTime = filemtime(__DIR__ . '/assets/css/monitor.css');
echo '<link rel="stylesheet" href="' . $pluginUrl . '/assets/css/monitor.css?v=' . $monitorCssTime . '">';

/**
 * 从文章内容中提取所有链接
 */
function extractLinks($content) {
    $urls = [];
    preg_match_all('/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/i', $content, $m1);  // markdown
    preg_match_all('/<a\s+[^>]*href=["\'](https?:\/\/[^"\']+)["\']/i', $content, $m2); // html
    preg_match_all('/(?<!\]\()(https?:\/\/[^\s<>"\'\)]+)/i', $content, $m3); // 纯文本
    
    foreach([$m1[1] ?? [], $m2[1] ?? [], $m3[1] ?? []] as $arr) {
        $urls = array_merge($urls, $arr);
    }
    return array_unique(array_map('trim', $urls));
}

/**
 * 通过规则引擎检查单个链接返回状态
 */
function checkLinkByRules($url, $host) {
    $rules = LinkCare_Plugin::getRules();
    $status = [];

    // 初始链接状态
    $link = [
        'url'   => $url,
        'text'  => '',
        'host'  => $host,
        'attrs' => ['rel'=>[], 'target'=>'', 'class'=>[]]
    ];

    // 应用所有规则
    $appliedRules = [];
    foreach ($rules as $rule) {
        if (!empty($rule['enable'])) {
            $linkNew = LinkCare_Plugin::applyAdvancedRule($link, $rule);
            if ($linkNew !== $link) {
                $appliedRules[] = $rule['name'];
                $link = $linkNew;
            }
        }
    }

    // 状态收集
    if (!empty($link['attrs']['rel'])) {
        foreach($link['attrs']['rel'] as $relv) {
            $status[] = $relv; // nofollow, sponsored, ugc, noreferrer, noopener 等
        }
    }
    if (!empty($link['attrs']['target']) && strtolower($link['attrs']['target'])==='_blank') {
        $status[] = 'target_blank';
    }
    if (!empty($link['disabled'])) {
        $status[] = 'blacklisted';
    }

    // 检查是否有 sponsor 参数
    $query = parse_url($url, PHP_URL_QUERY) ?? '';
    if ($query) {
        parse_str($query, $params);
        foreach (['utm_source','aff','ref','affiliate','partner'] as $sponsorKey) {
            if (isset($params[$sponsorKey])) {
                $status[] = 'sponsored';
                break;
            }
        }
    }

    return [
        'applied_rules' => $appliedRules,
        'status' => array_unique($status)
    ];
}


// 缓存处理
$useCache = false;
if(file_exists($cacheFile)) {
    $cacheData = json_decode(file_get_contents($cacheFile), true);
    if($cacheData && time() - $cacheData['timestamp'] < $cacheTTL) {
        $externalLinks = $cacheData['links'];
        $domainStats   = $cacheData['domains'];
        $useCache = true;
    }
}

if(!$useCache) {
    $db = Typecho_Db::get();
    $posts = $db->fetchAll($db->select('cid', 'title', 'text', 'created')
        ->from('table.contents')
        ->where('type = ? AND status = ?', 'post', 'publish'));

    $siteHost = parse_url(Helper::options()->siteUrl, PHP_URL_HOST);
    $externalLinks = [];
    $domainStats   = [];

    foreach($posts as $post) {
        $urls = extractLinks($post['text']);
        foreach($urls as $url) {
            $host = parse_url($url, PHP_URL_HOST);
            if($host && $host != $siteHost) {
                $ruleStatus = checkLinkByRules($url, $host);
                
                $externalLinks[] = [
                    'url' => $url,
                    'host' => $host,
                    'title' => $post['title'],
                    'cid' => $post['cid'],
                    'created' => $post['created'],
                    'applied_rules' => $ruleStatus['applied_rules'],
                    'status' => $ruleStatus['status']
                ];
                
                if(!isset($domainStats[$host])) {
                    $domainStats[$host] = ['count' => 0, 'posts' => []];
                }
                $domainStats[$host]['count']++;
                if (!isset($domainStats[$host]['posts'][$post['cid']])) {
                    $domainStats[$host]['posts'][$post['cid']] = $post['title'];
                }
            }
        }
    }
    
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    file_put_contents($cacheFile, json_encode([
        'timestamp' => time(),
        'links' => $externalLinks,
        'domains' => $domainStats
    ], JSON_UNESCAPED_UNICODE));
}

// 搜索过滤
if($keyword) {
    $externalLinks = array_filter($externalLinks, function($l) use($keyword) {
        return stripos($l['url'], $keyword) !== false || 
               stripos($l['title'], $keyword) !== false ||
               stripos($l['host'], $keyword) !== false;
    });
    
    $domainStats = array_filter($domainStats, function($info, $domain) use($keyword) {
        return stripos($domain, $keyword) !== false;
    }, ARRAY_FILTER_USE_BOTH);
}

// 分类筛选
$blackLinks = array_filter($externalLinks, function($l) {
    return in_array('blacklisted', $l['status'] ?? []);
});

$whiteLinks = array_filter($externalLinks, function($l) {
    $status = $l['status'] ?? [];
    return empty($status) || (!in_array('nofollow', $status) && !in_array('blacklisted', $status));
});

$sponsorLinks = array_filter($externalLinks, function($l) {
    return in_array('sponsored', $l['status'] ?? []);
});

// 根据选项卡
switch($tab) {
    case 'domains':
        $data = array_map(function($domain, $info) {
            return ['domain' => $domain, 'count' => $info['count'], 'posts' => $info['posts']];
        }, array_keys($domainStats), $domainStats);
        break;
    case 'blacklist':
        $data = array_values($blackLinks);
        break;
    case 'whitelist':
        $data = array_values($whiteLinks);
        break;
    case 'sponsor':
        $data = array_values($sponsorLinks);
        break;
    default:
        $data = array_values($externalLinks);
}

// 分页
$total = count($data);
$totalPages = max(1, ceil($total / $perPage));
$data = array_slice($data, ($page - 1) * $perPage, $perPage);
?>

<div class="linkcare-monitor">
    <!-- 页面头部 -->
    <div class="lc-header">
        <div class="lc-container">
            <div class="lc-header-content">
                <div class="lc-header-info">
                    <h1 class="lc-title">
                        外链监控中心
                    </h1>
                    <p class="lc-subtitle">智能监控和管理网站外链，支持高级规则引擎</p>
                </div>
                <div class="lc-header-actions">
                    <a href="?panel=LinkCare/monitor.php&refresh=1&tab=<?php echo $tab;?>&limit=<?php echo $perPage;?>&keyword=<?php echo urlencode($keyword);?>" 
                       class="lc-btn lc-btn-primary">
                        刷新缓存
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- 统计面板 -->
    <div class="lc-container">
        <div class="lc-stats">
            <div class="lc-stat-card">
                <div class="lc-stat-value"><?php echo count($externalLinks); ?></div>
                <div class="lc-stat-label">外链总数</div>
            </div>
            <div class="lc-stat-card">
                <div class="lc-stat-value"><?php echo count($domainStats); ?></div>
                <div class="lc-stat-label">域名数量</div>
            </div>
            <div class="lc-stat-card lc-stat-warning">
                <div class="lc-stat-value"><?php echo count($blackLinks); ?></div>
                <div class="lc-stat-label">已禁用</div>
            </div>
            <div class="lc-stat-card lc-stat-info">
                <div class="lc-stat-value"><?php echo count($sponsorLinks); ?></div>
                <div class="lc-stat-label">赞助链接</div>
            </div>
        </div>
    </div>

    <!-- 标签页导航 -->
    <div class="lc-container">
        <div class="lc-tabs">
            <?php
            $tabs = [
                'links'     => ['label'=>'外链明细','count'=>count($externalLinks)],
                'domains'   => ['label'=>'域名统计','count'=>count($domainStats)],
                'blacklist' => ['label'=>'黑名单','count'=>count($blackLinks)],
                'whitelist' => ['label'=>'正常链接','count'=>count($whiteLinks)],
                'sponsor'   => ['label'=>'赞助链接','count'=>count($sponsorLinks)]
            ];
            foreach($tabs as $key=>$tabInfo){
                $activeClass = ($tab==$key)?' lc-tab-active':'';
                echo '<a class="lc-tab'.$activeClass.'" href="?panel=LinkCare/monitor.php&tab='.$key.'&limit='.$perPage.'&keyword='.urlencode($keyword).'">';
                echo '<span class="lc-tab-label">'.$tabInfo['label'].'</span>';
                echo '<span class="lc-tab-count">'.$tabInfo['count'].'</span>';
                echo '</a>';
            }
            ?>
        </div>
    </div>

    <!-- 数据表格 -->
    <div class="lc-container">
        <div class="lc-table-container">
        <?php if($data): ?>
            <div class="lc-table-wrapper">
                <table class="lc-table">
                    <thead>
                        <tr>
                            <?php if($tab=='domains'): ?>
                                <th>域名</th>
                                <th class="lc-th-center">数量</th>
                                <th>来源文章</th>
                            <?php else: ?>
                                <th>外链地址</th>
                                <th>来源文章</th>
                                <th>应用规则 & 状态</th>
                            <?php endif; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach($data as $row): ?>
                            <?php if($tab=='domains'): ?>
                                <tr class="lc-table-row">
                                    <td class="lc-domain-cell">
                                        <strong class="lc-domain-name"><?php echo htmlspecialchars($row['domain']); ?></strong>
                                    </td>
                                    <td class="lc-th-center">
                                        <span class="lc-count-badge"><?php echo $row['count']; ?></span>
                                    </td>
                                    <td>
                                        <div class="lc-post-list">
                                        <?php foreach(array_slice($row['posts'],0,5,true) as $cid=>$title): ?>
                                            <div class="lc-post-item">
                                                <a href="<?php echo Helper::options()->adminUrl.'write-post.php?cid='.$cid; ?>"
                                                   target="_blank"
                                                   title="<?php echo htmlspecialchars($title); ?>"
                                                   class="lc-post-link">
                                                   <?php 
                                                   $displayTitle = mb_strlen($title)>30 ? mb_substr($title,0,30,'UTF-8').'...' : $title;
                                                   echo htmlspecialchars($displayTitle);
                                                   ?>
                                                </a>
                                            </div>
                                        <?php endforeach; ?>
                                        <?php if(count($row['posts'])>5): ?>
                                            <div class="lc-post-more">等 <?php echo count($row['posts']); ?> 篇文章</div>
                                        <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php else: ?>
                                <tr class="lc-table-row">
                                    <td class="lc-link-cell">
                                        <div class="lc-link-info">
                                            <a href="<?php echo htmlspecialchars($row['url']);?>"
                                               target="_blank"
                                               class="lc-link-url">
                                               <?php 
                                               $displayUrl = strlen($row['url'])>60 ? substr($row['url'],0,60).'...' : $row['url'];
                                               echo htmlspecialchars($displayUrl);
                                               ?>
                                            </a>
                                            <?php if(!empty($row['applied_rules'])): ?>
                                              <div class="lc-link-rules">
                                                规则：<?php echo htmlspecialchars(implode(' | ',array_slice($row['applied_rules'],0,2))); ?>
                                                <?php if(count($row['applied_rules'])>2): ?>等...<?php endif; ?>
                                              </div>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                    <td class="lc-article-cell">
                                        <a href="<?php echo Helper::options()->adminUrl.'write-post.php?cid='.$row['cid']; ?>"
                                           target="_blank"
                                           class="lc-article-link">
                                           <?php 
                                           $displayTitle = mb_strlen($row['title'])>25? mb_substr($row['title'],0,25,'UTF-8').'...': $row['title'];
                                           echo htmlspecialchars($displayTitle);
                                           ?>
                                        </a>
                                    </td>
                                    <td>
                                        <div class="lc-status-labels">
                                          <?php if(!empty($row['status'])): ?>
                                            <?php 
                                            $statusMap = [
                                              'nofollow'   => ['warning','nofollow'],
                                              'sponsored'  => ['success','sponsored'],
                                              'ugc'        => ['info','ugc'],
                                              'noopener'   => ['info','noopener'],
                                              'noreferrer' => ['warning','noreferrer'],
                                              'blacklisted'=> ['danger','黑名单'],
                                              'target_blank'=>['info','新窗口']
                                            ];
                                            foreach(array_slice($row['status'],0,4) as $s) {
                                                $cfg = $statusMap[$s] ?? ['default',$s];
                                                echo '<span class="lc-status-label lc-status-'.$cfg[0].'">'.$cfg[1].'</span>';
                                            }
                                            if(count($row['status'])>4){
                                                echo '<span class="lc-status-label lc-status-default">+'.(count($row['status'])-4).'</span>';
                                            }
                                            ?>
                                          <?php else: ?>
                                            <span class="lc-status-label lc-status-default">正常</span>
                                          <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                            <?php endif; ?>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php else: ?>
            <div class="lc-empty-state">
                <div class="lc-empty-title">没有找到匹配的数据</div>
                <div class="lc-empty-desc">尝试调整搜索条件或切换其他标签页</div>
            </div>
        <?php endif; ?>
        </div>
    </div>

    <!-- 分页器 -->
    <?php if($totalPages>1): ?>
    <div class="lc-container">
      <div class="lc-pagination-wrapper">
        <div class="lc-pagination">
          <?php if($page>1): ?>
            <a class="lc-page-btn" href="?panel=LinkCare/monitor.php&tab=<?php echo $tab;?>&keyword=<?php echo urlencode($keyword);?>&limit=<?php echo $perPage;?>&page=<?php echo ($page-1);?>">←</a>
          <?php endif; ?>
          <?php 
          $start = max(1,$page-2); $end = min($totalPages,$page+2);
          for($i=$start;$i<=$end;$i++): ?>
            <a class="lc-page-btn <?php echo $i==$page?'lc-page-active':'';?>"
               href="?panel=LinkCare/monitor.php&tab=<?php echo $tab;?>&keyword=<?php echo urlencode($keyword);?>&limit=<?php echo $perPage;?>&page=<?php echo $i;?>"><?php echo $i;?></a>
          <?php endfor; ?>
          <?php if($page<$totalPages): ?>
            <a class="lc-page-btn" href="?panel=LinkCare/monitor.php&tab=<?php echo $tab;?>&keyword=<?php echo urlencode($keyword);?>&limit=<?php echo $perPage;?>&page=<?php echo ($page+1);?>">→</a>
          <?php endif; ?>
        </div>
        <div class="lc-per-page">
          <span>每页显示：</span>
          <form method="get" class="lc-per-page-form">
            <input type="hidden" name="panel" value="LinkCare/monitor.php">
            <input type="hidden" name="tab" value="<?php echo $tab;?>">
            <input type="hidden" name="keyword" value="<?php echo htmlspecialchars($keyword);?>">
            <select name="limit" class="lc-select" onchange="this.form.submit();">
              <?php foreach($perPageOptions as $opt): ?>
                <option value="<?php echo $opt;?>" <?php echo $opt==$perPage?'selected':'';?>><?php echo $opt;?></option>
              <?php endforeach; ?>
            </select>
          </form>
        </div>
      </div>
    </div>
    <?php endif; ?>
</div>

<script src="<?php echo $pluginUrl; ?>/assets/js/monitor.js"></script>
<?php include 'footer.php'; ?>
