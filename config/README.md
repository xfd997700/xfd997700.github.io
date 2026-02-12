# config 配置说明（中文注释版）

本目录下的 JSON 文件用于驱动页面内容与样式。你可以把本 README 当作“集中注释”来维护。

## 目录与用途

| 文件 | 作用 |
|---|---|
| `main.json` | 页面内容主数据：个人信息、经历、开放服务、页脚等 |
| `settings.json` | 全局样式与功能开关：背景、卡片尺寸、交互开关等 |
| `news.json` | 新闻/动态列表 |
| `projects.json` | 项目卡片与项目详情关联数据 |
| `publications.json` | 论文列表与图形摘要数据 |
| `pic_eggs.json` | 终端彩蛋关键字与图片映射 |

## 通用约定

- 路径字段可使用相对路径（如 `imgs/...`）或完整 URL。
- 布尔开关推荐使用 `true/false`。
- 时间/尺寸类字段一般是数字，单位见字段名（如 `_px`, `_ms`, `_seconds`）。
- `projects.json` / `publications.json` 中 `template` 主要用于人工录入参考，不参与运行时渲染逻辑。

---

## 1) `main.json`

### 顶层字段

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `background_img_api` | string | 远程背景图 URL（当 `background_img_local` 为空时生效） | `https://picsum.photos/...` |
| `background_img_local` | string | 本地背景图路径；有值时优先级高于 `background_img_api` | `assets/bg.jpg` |
| `banner` | string[] | 顶部品牌打字机轮播文案 | `["Hello", "你好"]` |
| `foot` | string[] | 页脚文本行列表 | `["© 2026 ..."]` |
| `personal_info` | object | 个人信息区数据 | 见下表 |
| `career` | array/object | 经历列表（推荐数组） | 见下表 |
| `openserver` | object | Open Server 卡片数据（键名自定义） | 见下表 |
| `publications` | array | 论文兜底数据（仅当 `config/publications.json` 加载失败时尝试） | `[]` |
| `projects` | array | 项目兜底数据（当前主流程主要用 `config/projects.json`） | `[]` |

### `personal_info`

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 姓名 |
| `nickname` | string | 展示名（优先于 `name`） |
| `signature` | string | 签名 |
| `avatar` | string | 头像路径/URL |
| `links` | object | 社交链接集合，键名可自定义（如 `github`、`orcid`） |
| `tags` | string[] | 标签列表 |
| `contacts` | string[] / object[] | 联系方式。字符串若是邮箱会自动转 `mailto:` |
| `addresses` | object / array | 地址与地图链接，支持百度/谷歌地图 |

`links.<key>` 建议结构：

```json
{
  "label": "GitHub",
  "url": "https://github.com/xxx"
}
```

`addresses` 推荐结构：

```json
{
  "某地址文本": {
    "baidu": "https://...",
    "google": "https://..."
  }
}
```

### `career`（推荐数组）

每项字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `year` | string | 年份或区间，如 `2024-2026` |
| `organization` | string | 机构名 |
| `department` | string | 院系 |
| `city` | string | 城市 |
| `role` | string | 角色/职位 |
| `org_logo` | string | 机构 logo |
| `org_link` | string | 机构主页链接 |
| `group_link` | string | 课题组/团队页面链接（也兼容字段名 `link`） |

### `openserver`

结构为“键名 -> 服务对象”：

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 服务名 |
| `logo` | string | logo 图 |
| `link` | string | 服务链接。存在时整张卡片可点击 |
| `intro` | string | 简介 |

---

## 2) `news.json`

支持两种结构：
- 顶层数组：`[{...}, {...}]`
- 或对象包裹：`{ "news": [{...}] }`

每条新闻字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `year` | number | 是 | 年 |
| `month` | number | 是 | 月（1-12） |
| `day` | number | 是 | 日（1-31） |
| `short_en` | string | 与 `short_zh` 二选一至少一个 | 英文短文案 |
| `short_zh` | string | 与 `short_en` 二选一至少一个 | 中文短文案 |
| `link` / `href` / `url` | string | 否 | 可点击链接（支持 `http(s)`、`mailto:`、相对路径） |

说明：
- 渲染时按日期倒序。
- `settings.news.default_lang` 控制默认显示语言。

---

## 3) `pic_eggs.json`

支持两种结构：
- 顶层数组：`[{...}]`
- 或对象包裹：`{ "eggs": [{...}] }`

每项字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `keyword` | string[] | 触发关键字（大小写不敏感） |
| `pics` | string[] | 图片/GIF 路径列表 |

示例：

```json
{
  "keyword": ["wyf", "wangyifang"],
  "pics": ["imgs/common/eggs/wyf1.gif", "imgs/common/eggs/wyf2.gif"]
}
```

---

## 4) `projects.json`

### 顶层结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `template` | object | 项目录入模板（参考） |
| `projects` | object / array | 项目集合（推荐 object，键名为 `project_key`） |

### `projects.<project_key>` 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title_en` / `title_zh` | string | 英文/中文标题 |
| `authors_en` / `authors_zh` | string | 英文/中文作者（也兼容 `authors`） |
| `year` | string | 年份或区间 |
| `amount` | string | 金额/经费简写 |
| `abs_en` / `abs_zh` | string | 摘要 |
| `funding_en` / `funding_zh` | string | 经费来源（也兼容 `funding`） |
| `funding_no` | string | 经费编号 |
| `imgs` | string[] | 项目图（可轮播） |
| `related_publications` | string[] | 关联论文键，引用 `publications.json` 的 key |

说明：
- `related_publications` 用于在项目详情页自动渲染“相关论文”。
- `project_key` 会参与路由（如 `#projects/mol_motif`）和详情文件名匹配（如 `projects/mol_motif.html`）。

---

## 5) `publications.json`

### 顶层结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `template` | object | 论文录入模板（参考） |
| `publications` | object | 论文集合（键名建议唯一，如 `name+year+shortid`） |

### `publications.<ref_key>` 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `doi` | string | DOI（支持裸 DOI 或 `https://doi.org/...`） |
| `type` | string | 文献类型：`article`（默认）或 `inproceedings`（会议） |
| `title` | string | 标题 |
| `authors` | string | 作者字符串 |
| `year` | string | 年份（可含文本，但建议含四位年份） |
| `month` | string/number | 月份（可空，1-12） |
| `day` | string/number | 日期（可空，1-31） |
| `journal` | string | 期刊/会议名 |
| `volume` | string | 卷号 |
| `page` | string | 页码或文章号 |
| `abs` | string | 摘要 |
| `graph_abs` | string | 图形摘要图片路径 |

说明：
- DOI 会被规范化成可跳转链接。
- `type` 缺省时按 `article` 处理；仅当显式设置为 `inproceedings` 时按会议论文处理（含 Cite/BibTeX 格式）。
- 若 `settings.publications.resolve_doi_enabled=true`，会尝试在线补全/覆盖部分元信息（标题、作者等）。
- 当 `month` 和 `day` 都存在且有效时，页面日期显示为 `YYYY.MM.DD`；否则仅显示 `year`。

---

## 6) `settings.json`

用于控制样式、布局和交互行为。

### `background`

| 字段 | 类型 | 说明 |
|---|---|---|
| `blur_px` | number | 背景模糊半径（px） |
| `overlay_color` | string | 背景遮罩色（CSS 颜色） |

### `glass`

| 字段 | 类型 | 说明 |
|---|---|---|
| `blur_px` | number | 玻璃态卡片模糊度（px） |

### `banner`

| 字段 | 类型 | 说明 |
|---|---|---|
| `hold_ms` | number | 顶部打字机每条文案停留时间（ms） |

### `ui`

| 字段 | 类型 | 说明 |
|---|---|---|
| `top_action_button_height_px` | number | Projects/Publications 顶部操作按钮高度 |
| `base_card_hover_enabled` | boolean | 是否启用“底层大卡片” hover（如 Career/Open Server/News/右侧大卡） |

### `eggs`

| 字段 | 类型 | 说明 |
|---|---|---|
| `display_seconds` | number | 彩蛋显示时长（秒） |
| `image_height_px` | number | 彩蛋图高度 |
| `item_min_width_px` | number | 彩蛋网格项最小宽度 |
| `grid_max_width_px` | number | 彩蛋网格最大宽度 |

### `career`

| 字段 | 类型 | 说明 |
|---|---|---|
| `logo_height_px` | number | 经历区 logo 高度 |
| `logo_max_width_px` | number | 经历区 logo 最大宽度 |

### `news`

| 字段 | 类型 | 说明 |
|---|---|---|
| `default_show_count` | number | 首页默认显示条数（保留项） |
| `default_lang` | `"zh"`/`"en"` | 新闻默认语言 |
| `item_min_height_px` | number | 新闻项最小高度 |

### `openserver`

| 字段 | 类型 | 说明 |
|---|---|---|
| `columns` | number | Open Server 网格列数 |
| `logo_height_px` | number | logo 高度 |
| `logo_max_width_px` | number | logo 最大宽度 |

### `projects`

| 字段 | 类型 | 说明 |
|---|---|---|
| `home_card_width_px` / `home_card_height_px` | number | 首页项目卡片尺寸 |
| `overview_card_width_px` / `overview_card_height_px` | number | Projects 页项目卡片尺寸 |
| `card_gap_px` | number | 项目卡片间距 |
| `image_carousel_seconds` | number | 项目卡图轮播间隔（秒） |
| `home_abs_max_chars_en` / `home_abs_max_chars_zh` | number | 首页摘要截断长度 |
| `overview_abs_max_chars_en` / `overview_abs_max_chars_zh` | number | Projects 页摘要截断长度 |
| `breadcrumb_title_max_chars_en` / `breadcrumb_title_max_chars_zh` | number | 面包屑标题截断长度 |

### `publications`

| 字段 | 类型 | 说明 |
|---|---|---|
| `resolve_doi_enabled` | boolean | 是否按 DOI 在线补全元信息 |
| `author_highlight_keywords` | string[] | 作者高亮关键字 |
| `card_title_link_enabled` | boolean | 列表卡片标题是否可点击 DOI |
| `detail_title_link_enabled` | boolean | 详情弹窗标题是否可点击 DOI |
| `doi_timeout_ms` | number | DOI 请求超时 |
| `doi_request_interval_ms` | number | DOI 请求间隔 |
| `doi_stop_after_failures` | number | 连续失败后停止请求阈值 |
| `doi_proxy_url_prefix` | string | DOI 请求代理前缀 |
| `graph_abs_width_px` / `graph_abs_height_px` | number | 图形摘要弹窗尺寸 |
| `home.page_size` | number | 首页论文分页大小 |
| `home.show_graph_abs` | boolean | 首页默认是否显示图形摘要 |
| `page.default_view` | `"list"`/`"grid"` | 论文页桌面端默认视图 |
| `page.default_view_mobile` | `"list"`/`"grid"` | 论文页移动端默认视图 |
| `page.list_page_size` | number | 论文页列表模式分页大小 |
| `page.grid_shape` | number[2] | 网格模式形状 `[rows, cols]` |
| `page.grid_page_size` | number | 网格页大小（当未给 `grid_shape` 时兜底） |
| `page.list_show_graph_abs` | boolean | 列表模式默认显示图形摘要 |
| `page.grid_show_graph_abs` | boolean | 网格模式默认显示图形摘要 |

---

## 维护建议

- 新增字段时，同步更新本 README 对应章节。
- 尽量保持键名语义一致：`*_px`、`*_ms`、`*_enabled`。
- 内容数据（`main/news/projects/publications`）和表现参数（`settings`）分离维护，便于回滚和协作。
