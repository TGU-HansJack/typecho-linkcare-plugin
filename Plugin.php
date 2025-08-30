<?php
/**
 * LinkCare 外链优化与监控插件
 * @package LinkCare
 * @version 5.5.0
 * @author 寒士杰克
 * @link https://www.hansjack.com
 */
class LinkCare_Plugin implements Typecho_Plugin_Interface
{
    public static $panel = 'LinkCare/monitor.php';

    public static function activate()
    {
        Helper::addPanel(1, self::$panel, '外链监控', '外链监控与统计', 'administrator');
        
        $cacheDir = __DIR__ . '/cache';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }
        
        return 'LinkCare 插件已启用';
    }

    public static function deactivate()
    {
        Helper::removePanel(1, self::$panel);
        
        $cacheFile = __DIR__ . '/cache/linkcare_cache.json';
        if (file_exists($cacheFile)) {
            @unlink($cacheFile);
        }
    }

    public static function config(Typecho_Widget_Helper_Form $form)
    {
        $form->addInput(new Typecho_Widget_Helper_Form_Element_Text(
            'redirect', 
            null, 
            '', 
            '跳转页地址', 
            '设置外链跳转中转页面，留空则不启用跳转功能。注意：是否使用跳转需要在规则引擎中配置"启用重定向"动作'
        ));
        
        $form->addInput(new Typecho_Widget_Helper_Form_Element_Hidden(
            'linkRules', 
            null, 
            '[]', 
            '规则数据'
        ));
        
        $form->addInput(new Typecho_Widget_Helper_Form_Element_Select(
            'cacheExpiry',
            array(
                '3600' => '1小时',
                '21600' => '6小时', 
                '43200' => '12小时',
                '86400' => '24小时'
            ),
            '21600',
            '缓存过期时间',
            '监控数据的缓存时间，减少数据库查询'
        ));
        
        $form->addInput(new Typecho_Widget_Helper_Form_Element_Radio(
            'enableLogging',
            array(
                '1' => '启用',
                '0' => '禁用'
            ),
            '1',
            '启用日志记录',
            '记录外链处理日志，便于调试和统计'
        ));

        $pluginUrl = Helper::options()->pluginUrl . '/LinkCare';
        $linkcareCssTime = filemtime(__DIR__ . '/assets/css/linkcare.css');
        echo '<link rel="stylesheet" href="' . $pluginUrl . '/assets/css/linkcare.css?v=' . $linkcareCssTime . '">';
        
        echo '<div id="linkcare-rules-manager"></div>';
        
        $sortableJsTime = filemtime(__DIR__ . '/assets/js/sortable.min.js');
        $linkcareJsTime = filemtime(__DIR__ . '/assets/js/linkcare.js');

        echo '<script src="' . $pluginUrl . '/assets/js/sortable.min.js?v=' . $sortableJsTime . '"></script>';
        echo '<script src="' . $pluginUrl . '/assets/js/linkcare.js?v=' . $linkcareJsTime . '"></script>';
        echo '<script>document.addEventListener("DOMContentLoaded", function() { if (typeof rulesManager === "undefined") { window.rulesManager = new AdvancedRulesManager(); } });</script>';
    }

    public static function personalConfig(Typecho_Widget_Helper_Form $form) {}

    /**
     * 主钩子：内容中的外链处理（SVG标识版 + 自定义参数）
     */
    public static function LinkCare($content)
    {
        $opt = Helper::options()->plugin('LinkCare');
        $rules = json_decode($opt->linkRules, true);
        if (!is_array($rules)) $rules = [];
        
        $siteHost = parse_url(Helper::options()->siteUrl, PHP_URL_HOST);
        
        // 获取当前页面上下文信息
        $pageContext = self::getCurrentPageContext();

        return preg_replace_callback(
            '/<a\s+[^>]*href=["\'](.*?)["\'][^>]*>(.*?)<\/a>/is',
            function($m) use ($rules, $siteHost, $opt, $pageContext) {
                $href = $m[1]; 
                $text = $m[2];
                $host = parse_url($href, PHP_URL_HOST);

                if (!$host || $host === $siteHost) return $m[0];

                if ($opt->enableLogging == '1') {
                    self::logActivity('link_processed', $href . ' | Page: ' . $pageContext['current_path']);
                }

                $link = [
                    'url'  => $href,
                    'text' => $text,
                    'host' => $host,
                    'page_context' => $pageContext,
                    'use_redirect' => false, // 默认不使用重定向
                    'attrs'=> [
                        'rel'    => self::parseRel($m[0]),
                        'target' => self::parseTarget($m[0]),
                        'class'  => self::parseClass($m[0]),
                        'title'  => self::parseTitle($m[0])
                    ]
                ];

                foreach ($rules as $rule) {
                    if (!empty($rule['enable'])) {
                        $link = self::applyAdvancedRule($link, $rule);
                        if (isset($link['disabled']) && $link['disabled']) {
                            break;
                        }
                    }
                }

                if (isset($link['disabled']) && $link['disabled']) {
                    return $link['warning_text'] ?? $link['text'];
                }

                // 只有在规则中明确启用重定向且配置了重定向地址时才使用重定向
                if ($link['use_redirect'] && $opt->redirect) {
                    $link['url'] = rtrim($opt->redirect, '/') . '?url=' . urlencode($link['url']);
                }

                return self::buildFinalLink($link);
            }, 
            $content
        );
    }

    /**
     * 获取当前页面上下文信息
     */
    private static function getCurrentPageContext()
    {
        $context = [
            'current_path' => '',
            'page_name' => '',
            'page_type' => 'unknown',
            'is_special_page' => false,
            'template' => ''
        ];

        // 获取当前请求路径
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        $currentPath = parse_url($requestUri, PHP_URL_PATH) ?? '/';
        
        $context['current_path'] = $currentPath;
        $context['page_name'] = basename($currentPath, '.html');

        // 识别特殊页面类型
        if (preg_match('/\/(link|friend|exchange)/', $currentPath)) {
            $context['page_type'] = 'links';
            $context['is_special_page'] = true;
        } elseif (preg_match('/\/(about|关于)/', $currentPath)) {
            $context['page_type'] = 'about';
            $context['is_special_page'] = true;
        } elseif (preg_match('/\/(contact|联系)/', $currentPath)) {
            $context['page_type'] = 'contact';
            $context['is_special_page'] = true;
        } elseif (preg_match('/\/(tag|标签)/', $currentPath)) {
            $context['page_type'] = 'tag';
        } elseif (preg_match('/\/(category|分类)/', $currentPath)) {
            $context['page_type'] = 'category';
        } elseif (preg_match('/\/(archive|归档)/', $currentPath)) {
            $context['page_type'] = 'archive';
        } elseif ($currentPath === '/' || $currentPath === '') {
            $context['page_type'] = 'home';
        }

        // 尝试获取Typecho页面信息（如果在Typecho环境中）
        try {
            if (class_exists('Typecho_Widget_Helper_PageNavigator')) {
                $widget = Typecho_Widget::widget('Widget_Archive');
                if ($widget) {
                    if ($widget->is('single')) {
                        $context['page_type'] = 'post';
                        $context['template'] = 'post';
                    } elseif ($widget->is('page')) {
                        $context['page_type'] = 'page';
                        $context['template'] = 'page';
                        
                        // 检查是否为友情链接页面
                        $slug = $widget->slug ?? '';
                        if (in_array($slug, ['links', 'friends', 'exchange', '友情链接', '友链'])) {
                            $context['page_type'] = 'links';
                            $context['is_special_page'] = true;
                        }
                    } elseif ($widget->is('category')) {
                        $context['page_type'] = 'category';
                    } elseif ($widget->is('tag')) {
                        $context['page_type'] = 'tag';
                    } elseif ($widget->is('index')) {
                        $context['page_type'] = 'home';
                    }
                }
            }
        } catch (Exception $e) {
            // 如果无法获取Typecho信息，使用基于URL的判断
        }

        return $context;
    }

    /**
     * 应用高级规则（增强页面上下文支持）
     */
    public static function applyAdvancedRule($link, $rule)
    {
        if (empty($rule['conditions'])) return $link;
        
        foreach ($rule['conditions'] as $condition) {
            $matched = false;
            
            if ($condition['type'] === 'if' || $condition['type'] === 'elseif') {
                $matched = self::evaluateConditionRules($link, $condition['rules'] ?? [], $condition['logic'] ?? 'and');
            } elseif ($condition['type'] === 'else') {
                $matched = true;
            }
            
            if ($matched && !empty($condition['actions'])) {
                $link = self::applyConditionActions($link, $condition['actions']);
                break;
            }
        }
        
        return $link;
    }

    /**
     * 评估条件规则（支持页面上下文匹配）
     */
    private static function evaluateConditionRules($link, $rules, $logic = 'and')
    {
        if (empty($rules)) return false;

        $logic = strtolower($logic);
        $results = [];

        foreach ($rules as $rule) {
            $result = false;

            switch ($rule['field']) {
                case 'domain':
                    $result = self::evaluateDomainRule($link['host'], $rule['operator'], $rule['value']);
                    break;
                case 'url':
                    $result = self::evaluateStringRule($link['url'], $rule['operator'], $rule['value']);
                    break;
                case 'rel':
                    $result = self::evaluateRelRule($link['attrs']['rel'], $rule['operator'], $rule['value']);
                    break;
                case 'path':
                    $path = parse_url($link['url'], PHP_URL_PATH) ?? '/';
                    $result = self::evaluateStringRule($path, $rule['operator'], $rule['value']);
                    break;
                case 'query':
                    $query = parse_url($link['url'], PHP_URL_QUERY) ?? '';
                    $result = self::evaluateStringRule($query, $rule['operator'], $rule['value']);
                    break;
                
                // 新增：页面上下文匹配
                case 'page_path':
                    $currentPath = $link['page_context']['current_path'] ?? '/';
                    $result = self::evaluateStringRule($currentPath, $rule['operator'], $rule['value']);
                    break;
                case 'page_type':
                    $pageType = $link['page_context']['page_type'] ?? 'unknown';
                    $result = self::evaluateStringRule($pageType, $rule['operator'], $rule['value']);
                    break;
                case 'page_name':
                    $pageName = $link['page_context']['page_name'] ?? '';
                    $result = self::evaluateStringRule($pageName, $rule['operator'], $rule['value']);
                    break;
                case 'is_special_page':
                    $isSpecial = $link['page_context']['is_special_page'] ?? false;
                    $result = self::evaluateBooleanRule($isSpecial, $rule['operator'], $rule['value']);
                    break;
            }

            $results[] = $result;
        }

        // 执行逻辑判断
        if ($logic === 'or') {
            return in_array(true, $results, true);
        }
        return !in_array(false, $results, true); // 默认 and
    }

    /**
     * 布尔值规则评估
     */
    private static function evaluateBooleanRule($value, $operator, $expected)
    {
        $expectedBool = in_array(strtolower($expected), ['true', '1', 'yes', 'on']);
        
        switch ($operator) {
            case 'equals':
                return $value === $expectedBool;
            case 'not_equals':
                return $value !== $expectedBool;
        }
        return false;
    }

    /**
     * 域名规则评估
     */
    private static function evaluateDomainRule($host, $operator, $value)
    {
        switch ($operator) {
            case 'match':
                return self::matchDomainPattern($host, $value);
            case 'contains':
                return stripos($host, $value) !== false;
            case 'not_contains':
                return stripos($host, $value) === false;
            case 'equals':
                return strcasecmp($host, $value) === 0;
            case 'not_equals':
                return strcasecmp($host, $value) !== 0;
            case 'starts_with':
                return stripos($host, $value) === 0;
            case 'ends_with':
                return str_ends_with(strtolower($host), strtolower($value));
            case 'regex':
                return @preg_match($value, $host);
        }
        return false;
    }

    /**
     * Rel属性规则评估
     */
    private static function evaluateRelRule($relArray, $operator, $value)
    {
        switch ($operator) {
            case 'contains':
                return in_array($value, $relArray);
            case 'not_contains':
                return !in_array($value, $relArray);
        }
        return false;
    }

    /**
     * 字符串通用规则
     */
    private static function evaluateStringRule($string, $operator, $value)
    {
        switch ($operator) {
            case 'contains':     return stripos($string, $value) !== false;
            case 'not_contains': return stripos($string, $value) === false;
            case 'equals':       return $string === $value;
            case 'not_equals':   return $string !== $value;
            case 'starts_with':  return stripos($string, $value) === 0;
            case 'ends_with':    return str_ends_with(strtolower($string), strtolower($value));
            case 'regex':        return @preg_match($value, $string);
            case 'match':        return self::matchPattern($string, $value);
        }
        return false;
    }

    /**
     * 执行动作（SVG标识版 + 自定义参数）
     */
    private static function applyConditionActions($link, $actions)
    {
        foreach ($actions as $action) {
            switch ($action['type']) {
                case 'add_rel':
                    if (!empty($action['values'])) {
                        foreach ($action['values'] as $rel) {
                            if (!in_array($rel, $link['attrs']['rel'])) {
                                $link['attrs']['rel'][] = $rel;
                            }
                        }
                    }
                    break;

                case 'add_utm':
                    if (!empty($action['enabled']) && !empty($action['data'])) {
                        $utmParams = [];
                        foreach ($action['data'] as $param => $value) {
                            if ($value) {
                                $utmParams[] = 'utm_' . $param . '=' . urlencode($value);
                            }
                        }
                        if ($utmParams) {
                            $link['url'] = self::appendParam($link['url'], implode('&', $utmParams));
                        }
                    }
                    break;

                case 'target_blank':
                    if (!empty($action['enabled'])) {
                        $link['attrs']['target'] = '_blank';
                    }
                    break;

                case 'force_https':
                    if (!empty($action['enabled']) && stripos($link['url'], 'http://') === 0) {
                        $link['url'] = preg_replace('/^http:/i', 'https:', $link['url']);
                    }
                    break;

                case 'add_class':
                    if (!empty($action['value'])) {
                        $link['attrs']['class'][] = $action['value'];
                    }
                    break;

                case 'add_title':
                    if (!empty($action['value'])) {
                        $link['attrs']['title'] = $action['value'];
                    }
                    break;

                case 'add_referer':
                    if (!empty($action['enabled']) && !empty($action['value'])) {
                        $link['attrs']['data-referer'] = $action['value'];
                        if (!in_array('js-referer', $link['attrs']['class'])) {
                            $link['attrs']['class'][] = 'js-referer';
                        }
                    }
                    break;

                case 'svg_suffix':
                    if (!empty($action['enabled'])) {
                        $link = self::processSvgSuffix($link, $action);
                    }
                    break;

                case 'add_to_blacklist':
                    if (!empty($action['enabled'])) {
                        $link = self::processBlacklist($link, $action);
                    }
                    break;

                case 'remove_utm':
                    if (!empty($action['enabled'])) {
                        $link['url'] = self::removeUtmParams($link['url']);
                    }
                    break;

                case 'remove_tracking':
                    if (!empty($action['enabled'])) {
                        $link['url'] = self::removeTrackingParams($link['url']);
                    }
                    break;

                case 'remove_params':
                    if (!empty($action['enabled']) && !empty($action['params'])) {
                        $link['url'] = self::removeCustomParams($link['url'], $action['params']);
                    }
                    break;
                
                case 'add_custom_params':
                    if (!empty($action['enabled']) && !empty($action['params'])) {
                        $link['url'] = self::addCustomParams($link['url'], $action['params']);
                    }
                    break;
                
                // 启用重定向动作
                case 'enable_redirect':
                    if (!empty($action['enabled'])) {
                        $link['use_redirect'] = true;
                    }
                    break;
            }
        }
        
        return $link;
    }

    /**
     * 处理 SVG 后缀标识
     */
    private static function processSvgSuffix($link, $action)
    {
        if (stripos($link['url'], '.svg') !== false) {
            $suffixText = $action['suffix_text'] ?? '[SVG]';
            $base64Code = $action['base64_code'] ?? '';
            
            // 在链接文本后添加后缀
            $link['text'] .= ' <span class="svg-suffix" style="font-size:0.8em;color:#6b7280;">' . htmlspecialchars($suffixText) . '</span>';
            
            // 如果有Base64代码，添加到链接后
            if ($base64Code) {
                $link['text'] .= ' <code class="svg-base64" style="font-size:0.7em;background:#f3f4f6;padding:2px 4px;border-radius:3px;color:#374151;">' . htmlspecialchars($base64Code) . '</code>';
            }
            
            // 添加SVG标识class
            if (!in_array('svg-link', $link['attrs']['class'])) {
                $link['attrs']['class'][] = 'svg-link';
            }
            
            self::logActivity('svg_suffix_applied', $link['url'] . ' - suffix: ' . $suffixText);
        }
        return $link;
    }

    /**
     * 黑名单动作处理（去掉重定向选项）
     */
    private static function processBlacklist($link, $action)
    {
        $mode = $action['action'] ?? 'disable';
        
        switch ($mode) {
            case 'disable':
                $link['disabled'] = true;
                // 确保blacklisted状态被添加到link属性中以便监控页面识别
                if (!in_array('blacklisted', $link['attrs']['rel'])) {
                    $link['attrs']['rel'][] = 'blacklisted';
                }
                break;
            case 'warning':
                $warningText = $action['warning_text'] ?? '[外链已屏蔽]';
                $link['warning_text'] = $warningText;
                $link['disabled'] = true;
                if (!in_array('blacklisted', $link['attrs']['rel'])) {
                    $link['attrs']['rel'][] = 'blacklisted';
                }
                break;
        }
        self::logActivity('blacklist_applied', $link['url'] . ' - mode:' . $mode);
        return $link;
    }

    /**
     * 添加自定义参数
     */
    private static function addCustomParams($url, $params)
    {
        if (empty($params) || !is_array($params)) return $url;
        
        $paramStrings = [];
        foreach ($params as $param) {
            if (isset($param['name']) && isset($param['value']) && $param['name'] && $param['value']) {
                $paramStrings[] = urlencode($param['name']) . '=' . urlencode($param['value']);
            }
        }
        
        if (!empty($paramStrings)) {
            $url = self::appendParam($url, implode('&', $paramStrings));
        }
        
        return $url;
    }

    /**
     * 移除标准 UTM 参数
     */
    private static function removeUtmParams($url)
    {
        $utmParams = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
        return self::removeCustomParams($url, $utmParams);
    }

    /**
     * 移除常见追踪参数
     */
    private static function removeTrackingParams($url)
    {
        $trackingParams = [
            'fbclid','gclid','msclkid','dclid','twclid','igshid','ttclid','li_fat_id',
            '_hsmi','_hsenc','mc_cid','mc_eid','mkt_tok','trk','trkCampaign',
            'ir','ref','referer','referrer'
        ];
        return self::removeCustomParams($url, $trackingParams);
    }

    /**
     * 移除自定义参数
     */
    private static function removeCustomParams($url, $params)
    {
        $parts = parse_url($url);
        if (!isset($parts['query'])) return $url;
        
        parse_str($parts['query'], $queryArray);
        foreach ($params as $param) unset($queryArray[$param]);
        $newQuery = http_build_query($queryArray);

        $result = '';
        if (isset($parts['scheme'])) $result .= $parts['scheme'] . '://';
        if (isset($parts['host'])) $result .= $parts['host'];
        if (isset($parts['port'])) $result .= ':' . $parts['port'];
        if (isset($parts['path'])) $result .= $parts['path'];
        if ($newQuery) $result .= '?' . $newQuery;
        if (isset($parts['fragment'])) $result .= '#' . $parts['fragment'];
        return $result;
    }

    /**
     * 构建最终 HTML
     */
    private static function buildFinalLink($link)
    {
        $attrs = '';
        
        if (!empty($link['attrs']['rel'])) {
            $attrs .= ' rel="' . implode(' ', array_unique($link['attrs']['rel'])) . '"';
        }
        if (!empty($link['attrs']['target'])) {
            $attrs .= ' target="' . htmlspecialchars($link['attrs']['target']) . '"';
        }
        if (!empty($link['attrs']['class'])) {
            $attrs .= ' class="' . implode(' ', array_unique($link['attrs']['class'])) . '"';
        }
        if (!empty($link['attrs']['title'])) {
            $attrs .= ' title="' . htmlspecialchars($link['attrs']['title']) . '"';
        }
        foreach ($link['attrs'] as $k=>$v) {
            if (strpos($k,'data-')===0) {
                $attrs .= ' '.$k.'="'.htmlspecialchars($v).'"';
            }
        }
        return '<a href="' . htmlspecialchars($link['url']) . '"' . $attrs . '>' . $link['text'] . '</a>';
    }

    /**
     * ========== 工具函数 ==========
     */
    private static function matchDomainPattern($host,$pattern)
    {
        if ($pattern==='') return false;
        if ($pattern==='*') return true;
        if ($pattern[0]==='/' && substr($pattern,-1)==='/') {
            return @preg_match($pattern,$host);
        }
        if (str_contains($pattern,'*')) {
            $regex = '/^' . str_replace('\*','.*',preg_quote($pattern,'/')) . '$/i';
            return @preg_match($regex,$host);
        }
        return strcasecmp($host,$pattern)===0;
    }

    private static function matchPattern($string,$pattern)
    {
        if ($pattern==='') return false;
        if ($pattern==='*') return true;
        if ($pattern[0]==='/' && substr($pattern,-1)==='/') {
            return @preg_match($pattern,$string);
        }
        if (str_contains($pattern,'*')) {
            $regex = '/^' . str_replace('\*','.*',preg_quote($pattern,'/')) . '$/i';
            return @preg_match($regex,$string);
        }
        return stripos($string,$pattern)!==false;
    }

    private static function parseRel($atag)
    {
        if (preg_match('/rel=["\']([^"\']+)["\']/i',$atag,$m)) {
            return preg_split('/\s+/',trim($m[1]));
        }
        return [];
    }
    private static function parseTarget($atag)
    {
        return preg_match('/target=["\']([^"\']+)["\']/i',$atag,$m)? trim($m[1]): '';
    }
    private static function parseClass($atag)
    {
        return preg_match('/class=["\']([^"\']+)["\']/i',$atag,$m)? preg_split('/\s+/',trim($m[1])): [];
    }
    private static function parseTitle($atag)
    {
        return preg_match('/title=["\']([^"\']+)["\']/i',$atag,$m)? trim($m[1]): '';
    }

    private static function appendParam($url,$paramStr)
    {
        return strpos($url,'?')===false ? $url.'?'.$paramStr : $url.'&'.$paramStr;
    }

    private static function logActivity($act,$detail='')
    {
        $opt = Helper::options()->plugin('LinkCare');
        if ($opt->enableLogging != '1') return; // 只有明确启用时才记录日志
        
        try{
            $logDir = __DIR__ . '/logs';
            if(!is_dir($logDir)) @mkdir($logDir,0755,true);
            $file = $logDir . '/linkcare_' . date('Y-m') . '.log';
            file_put_contents($file,"[".date('Y-m-d H:i:s')."] $act : $detail\n",FILE_APPEND|LOCK_EX);
        }catch(\Exception $e){}
    }

    /**
     * ========== 供监控页使用的方法 ==========
     */
    public static function getRules()
    {
        $opt = Helper::options()->plugin('LinkCare');
        $rules = json_decode($opt->linkRules,true);
        return is_array($rules)? $rules: [];
    }

    /**
     * 检查一个链接会命中哪些规则（支持页面上下文）
     */
    public static function checkLinkRules($url,$host,$pageContext = null)
    {
        $rules = self::getRules();
        $applied = [];

        // 如果没有提供页面上下文，使用默认值
        if (!$pageContext) {
            $pageContext = [
                'current_path' => '/',
                'page_type' => 'unknown',
                'page_name' => '',
                'is_special_page' => false
            ];
        }

        $linkBase = [
            'url'=>$url,
            'text'=>'',
            'host'=>$host,
            'page_context' => $pageContext,
            'use_redirect' => false,
            'attrs'=>['rel'=>[],'target'=>'','class'=>[]]
        ];

        foreach ($rules as $rule) {
            if (!empty($rule['enable'])) {
                $linkTest = self::applyAdvancedRule($linkBase,$rule);
                // 如果规则产生了任何修改/标记，可以认为匹配
                if ($linkTest !== $linkBase) {
                    $applied[] = $rule['name'];
                }
            }
        }
        return $applied;
    }
}
