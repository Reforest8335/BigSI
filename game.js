/* ============================================================
 *  校徽碰碰乐 · 校徽合成版
 *  纯原生 HTML + CSS + JavaScript，无任何依赖。
 *
 *  物理：PBD（位置约束求解）—— 3 个子步 × 6 次迭代，
 *        静止堆叠稳定，不抖动。
 *  玩法：相同级别接触即合成高一级；顶到警戒线超时判负。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------------------------------------------------
   *  常量
   * ------------------------------------------------------- */

  const W = 420;             // 逻辑宽度
  const H = 700;             // 逻辑高度
  const WALL = 10;           // 左右墙厚
  const DROP_Y = 74;         // 待投放水果的高度
  const DANGER_Y = 142;      // 警戒线

  const GRAVITY   = 2600;    // px/s²
  const SUBSTEPS  = 3;       // 每帧物理子步
  const ITER      = 6;       // 每个子步的约束迭代次数
  const DROP_MS   = 360;     // 两次投放的最小间隔
  const OVER_LIMIT = 1.5;    // 越线持续多少秒判负
  const REST_SPEED = 140;    // 线上方且速度低于它才算“卡住”（被弹飞路过的不算）
  const REST_SPEED2 = REST_SPEED * REST_SPEED;

  const MAX_TIER  = 10;      // 最大那只（第 11 级）的索引
  const MAX_BONUS = 500;     // 两个最高级相撞的奖励分
                             // （原来是 100 —— 合出全游戏最难的东西只给 100 分，太寒酸；
                             //  而且它同时清掉两块最大的，相当于救一条命，值这个价）
  const MAX_MERGE_GIVES_REVIVE = true;  // 两个最高级一起炸掉时，额外送一枚复活币
  const FREEZE_MS = 130;     // 清场时的定格，让这一下有重量
  const REVIVE_STEP = 2000;  // 每累计多少分，发一枚复活币
  const MERGE_PAD = 0.8;     // 合成判定的接触容差（px）

  /* —— Q 弹手感 —— */
  const RESTITUTION      = 0.38;  // 球与球之间的弹性
  const WALL_RESTITUTION = 0.45;  // 撞墙 / 撞地面的弹性
  const REST_THRESHOLD   = 55;    // 撞击速度低于此值不反弹（保证堆叠稳、不抖）
  const FRICTION         = 0.955; // 接触时的切向摩擦（每个子步）
  const SQUASH_DECAY     = 9;     // 挤压回弹速度
  const SQUASH_MAX       = 0.30;  // 最大挤压变形

  /* 原型链：索引越大越大。素材是 src/00..10.jpg 抠底后按文件名顺序对应的级别，
     00 = 第 1 级（最常见），10 = 最高级。
     因为素材是真实学校校徽，按作者要求**不显示校名**，一律称「第 N 级」。

     file : assets/fruits/ 下的贴图（由 tools/cutout_logos.py + optimize_sprites.py 生成）
     c1/c2: 贴图缺失且极模糊占位图也没有时的兜底配色（中性蓝灰，带一点该级的色相）
     pc1/pc2: 粒子/汁水颜色（取自贴图主体平均色） */
  const ASSET_FILL = 0.92;   // 贴图里主体占画布长边的比例，与生成脚本保持一致

  const FRUITS = [
    { name: '第1级',  r: 17,  c1: '#dfc2c4', c2: '#a88286', line: 'rgba(90,50,55,.35)',
      file: 'assets/fruits/00.webp', pc1: '#b46063', pc2: '#8d4649' },
    { name: '第2级',  r: 23,  c1: '#d6cfd8', c2: '#9a8f9c', line: 'rgba(70,60,75,.35)',
      file: 'assets/fruits/01.webp', pc1: '#b1a5b5', pc2: '#8a7d8e' },
    { name: '第3级',  r: 31,  c1: '#f7c3c7', c2: '#d2646c', line: 'rgba(140,50,60,.32)',
      file: 'assets/fruits/02.webp', pc1: '#ed868e', pc2: '#c26068' },
    { name: '第4级',  r: 39,  c1: '#d9c3c4', c2: '#9c7c7e', line: 'rgba(90,55,58,.32)',
      file: 'assets/fruits/03.webp', pc1: '#af8586', pc2: '#8a6465' },
    { name: '第5级',  r: 48,  c1: '#c6d6bc', c2: '#6f8f63', line: 'rgba(50,80,45,.32)',
      file: 'assets/fruits/04.webp', pc1: '#94b281', pc2: '#6f8f60' },
    { name: '第6级',  r: 58,  c1: '#ddcbcc', c2: '#a58384', line: 'rgba(95,60,62,.32)',
      file: 'assets/fruits/05.webp', pc1: '#be9999', pc2: '#987374' },
    { name: '第7级',  r: 69,  c1: '#9fc2d6', c2: '#4f7f9c', line: 'rgba(30,70,95,.35)',
      file: 'assets/fruits/06.webp', pc1: '#4883a6', pc2: '#336481' },
    { name: '第8级',  r: 81,  c1: '#c2dee1', c2: '#6fa3a9', line: 'rgba(35,80,85,.32)',
      file: 'assets/fruits/07.webp', pc1: '#97c4c9', pc2: '#71a0a5' },
    { name: '第9级',  r: 94,  c1: '#e2c2c1', c2: '#a87a79', line: 'rgba(95,55,55,.32)',
      file: 'assets/fruits/08.webp', pc1: '#c28281', pc2: '#9a6362' },
    { name: '第10级', r: 108, c1: '#d9e39a', c2: '#93a83f', line: 'rgba(75,95,20,.35)',
      file: 'assets/fruits/09.webp', pc1: '#b8cb51', pc2: '#8fa33b' },
    { name: '第11级', r: 124, c1: '#eaa9a8', c2: '#b83f3e', line: 'rgba(120,30,30,.4)',
      file: 'assets/fruits/10.webp', pc1: '#d55958', pc2: '#ab3c3b' }
  ];

  /* 合成出 tier 的得分（三角数） */
  const MERGE_SCORE = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55];

  /* 新掉落的权重（级别越小越常见） */
  const SPAWN_TIERS = [0, 1, 2, 3, 4];
  const SPAWN_WEIGHTS = [0.28, 0.24, 0.20, 0.16, 0.12];

  const BEST_KEY = 'xhp.best.v1';
  const MUTE_KEY = 'xhp.mute.v1';
  const MODE_KEY = 'xhp.drop.v1';     // 掉落模式 + 指定级别（想每次都是随机就把这条删掉）
  /* 音效默认**关闭**：很多人是在公共场合点开的，突然出声很尴尬。
     玩家主动点开之后会被记住（MUTE_KEY 存 '0'），下次不再默认静音。 */
  const MUTE_DEFAULT = true;

  /* ---------------------------------------------------------
   *  DOM
   * ------------------------------------------------------- */

  const canvas    = document.getElementById('game');
  const ctx       = canvas.getContext('2d');
  const stage     = document.getElementById('stage');
  const scoreEl   = document.getElementById('score');
  const bestEl    = document.getElementById('best');
  const finalScoreEl = document.getElementById('finalScore');
  const finalBestEl  = document.getElementById('finalBest');
  const nextCanvas = document.getElementById('next');
  const nextCtx    = nextCanvas.getContext('2d');
  const chainCanvas = document.getElementById('chain');
  const chainCtx    = chainCanvas.getContext('2d');
  const soundBtn   = document.getElementById('soundBtn');
  const modeBtn    = document.getElementById('modeBtn');
  const resetBtn   = document.getElementById('resetBtn');
  const restartBtn = document.getElementById('restartBtn');
  const overlayEl     = document.getElementById('overlay');
  const revivePromptEl = document.getElementById('revivePrompt');
  const overPanelEl    = document.getElementById('overPanel');
  const reviveScoreEl  = document.getElementById('reviveScore');
  const reviveLeftEl   = document.getElementById('reviveLeft');
  const reviveBtn      = document.getElementById('reviveBtn');
  const giveUpBtn      = document.getElementById('giveUpBtn');
  const reviveBadge    = document.getElementById('reviveBadge');
  const reviveCountEl  = document.getElementById('reviveCount');

  /* ---------------------------------------------------------
   *  功能开关
   * ------------------------------------------------------- */

  /* 在线排行榜：暂时禁用。
     代码（leaderboard.min.js / 结算流程）原样保留，只是不加载、不提交、不显示入口，
     将来想恢复把这里改成 true、并在 index.html 里把它的 <script> 取消注释即可。 */
  const LEADERBOARD_ENABLED = false;
  /* 赞助作者弹窗：已移除，作者要求改成页脚署名 + GitHub 链接 */
  const SPONSOR_ENABLED = false;

  /* ---------------------------------------------------------
   *  工具
   * ------------------------------------------------------- */

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const rand  = (a, b) => a + Math.random() * (b - a);

  /* 「下一个」是否允许和当前这颗相同。
     允许的话有约 22% 概率两边显示同一张图，看起来像“下一个显示的是当前这个”，
     所以默认避开；想恢复成完全随机就把它改成 false */
  const AVOID_REPEAT = true;

  /* ---------------------------------------------------------
   *  仓库 / 联系方式
   * ------------------------------------------------------- */

  /* 页面上所有对外链接都由这里统一注入（index.html 里只留 <a data-repo="..."> 占位）。
     **刻意不在页面上放邮箱、也不放作者账号主页**，一切沟通走 GitHub Issues：
     联系方式不散落在页面里，也方便公开留痕与追踪。
     想改地址 / 加回仓库链接，只改这三个常量即可，不用动 HTML。 */
  const REPO_URL = 'https://github.com/Reforest8335/BigSI';
  const ISSUES_URL = REPO_URL + '/issues';
  const ORIGIN_URL = 'https://github.com/YHSome/BigNaiWa';   // 原作者的仓库（署名用，见 README）

  function applyRepoLinks() {
    const links = document.querySelectorAll('[data-repo]');
    for (let i = 0; i < links.length; i++) {
      const kind = links[i].getAttribute('data-repo');
      const url = kind === 'issues' ? ISSUES_URL
                : kind === 'origin' ? ORIGIN_URL
                : REPO_URL;
      links[i].setAttribute('href', url);
      links[i].setAttribute('target', '_blank');
      links[i].setAttribute('rel', 'noopener noreferrer');
    }
  }

  /* ---------------------------------------------------------
   *  掉落模式（调试 / 自定义玩法）
   * ------------------------------------------------------- */

  /* 默认 random = 原来的随机加权掉落。
     其余模式都是为了「想让它一直掉同一个」而加的：
       fixed    : 永远掉 FIXED_TIER 这一级
       max      : 永远掉最高级（第 11 级）
       cycle    : 按 0,1,2,... 依次轮着掉，方便一次看全所有级别
       noRepeat : 随机，但严格避开上一颗（把 AVOID_REPEAT 的重试变成兜底保证）

     用对象包一层是为了能在运行时改：控制台里
       __DNW__.setDropMode('max')    // 一直掉最大的
       __DNW__.setDropMode('fixed')  // 一直掉第 1 级（改 __DNW__.setFixedTier(4) 换级别）
       __DNW__.setDropMode('random') // 恢复随机
     改完不需要重开一局，「下一个」下一颗就会按新模式出。 */
  const dropModeRef = { value: 'random', fixedTier: 0 };

  /* 掉落模式的界面文案与顺序（点一下按钮就轮换到下一个） */
  const DROP_MODES = ['random', 'max', 'cycle', 'noRepeat', 'fixed'];
  const DROP_MODE_LABEL = {
    random:   '随机',
    max:      '最高级',
    cycle:    '逐个',
    noRepeat: '不重复',
    fixed:    '指定'
  };

  /* 模式记到 localStorage：这是给调试/自定义玩法用的，
     刷新页面后还保持你选的那个模式更省事。想每次恢复随机就删掉这个函数调用。 */
  function loadDropMode() {
    try {
      const raw = localStorage.getItem(MODE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o && DROP_MODES.indexOf(o.mode) >= 0) {
        dropModeRef.value = o.mode;
        dropModeRef.fixedTier = clamp(o.fixedTier | 0, 0, MAX_TIER);
      }
    } catch (e) { /* 存档坏了就当没存过 */ }
  }

  function saveDropMode() {
    try {
      localStorage.setItem(MODE_KEY, JSON.stringify({
        mode: dropModeRef.value, fixedTier: dropModeRef.fixedTier
      }));
    } catch (e) { /* 隐私模式下写不进去，忽略 */ }
  }

  let cycleCursor = 0;

  const DROP_MODE_ALLOWS_REPEAT = () =>
    dropModeRef.value === 'fixed' || dropModeRef.value === 'max' || dropModeRef.value === 'cycle';

  function rollSpawnTier() {
    switch (dropModeRef.value) {
      case 'max':
        return MAX_TIER;
      case 'fixed':
        return clamp(dropModeRef.fixedTier | 0, 0, MAX_TIER);
      case 'cycle': {
        const t = cycleCursor % FRUITS.length;
        cycleCursor++;
        return t;
      }
      default: {
        let r = Math.random(), acc = 0;
        for (let i = 0; i < SPAWN_TIERS.length; i++) {
          acc += SPAWN_WEIGHTS[i];
          if (r <= acc) return SPAWN_TIERS[i];
        }
        return SPAWN_TIERS[0];
      }
    }
  }

  function pickSpawnTier(avoid) {
    /* 固定掉落时「避开重复」没有意义（本来就是同一个），直接返回 */
    if (DROP_MODE_ALLOWS_REPEAT()) return rollSpawnTier();
    if (!AVOID_REPEAT || avoid === undefined) return rollSpawnTier();
    for (let i = 0; i < 12; i++) {
      const t = rollSpawnTier();
      if (t !== avoid) return t;
    }
    return rollSpawnTier();     // 兜底：万一连撞就认了
  }

  /* ---------------------------------------------------------
   *  音效（WebAudio，无外部资源）
   * ------------------------------------------------------- */

  const Sound = {
    ctx: null,
    /* 没存过就按 MUTE_DEFAULT（默认静音）来；存过就听玩家的 */
    muted: (function () {
      const saved = localStorage.getItem(MUTE_KEY);
      return saved === null ? MUTE_DEFAULT : saved === '1';
    })(),

    ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
      return this.ctx;
    },

    tone(freq, freq2, dur, vol, type) {
      if (this.muted) return;
      const c = this.ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (freq2 && freq2 !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
      }
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    merge(tier) {
      const base = 240 * Math.pow(1.1225, tier * 2);
      this.tone(base, base * 1.7, 0.2, 0.16, 'sine');
      this.tone(base * 2, base * 3, 0.12, 0.06, 'triangle');
    },

    drop()   { this.tone(180, 120, 0.08, 0.05, 'sine'); },
    over()   { this.tone(420, 90, 0.7, 0.16, 'sawtooth'); },
    bonus()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.22, 0.12, 'triangle'), i * 90)); }
  };

  /* ---------------------------------------------------------
   *  手机震动反馈
   * ------------------------------------------------------- */

  /* 之前有两个问题，玩家反馈「震动不对等」：
   *   1. 时长写成 `6 + 级别` —— 同样的"合成成功"，级别不同震感差一倍
   *      （第1级 7ms、第9级 15ms）。改成按**档位**给固定时长：
   *      普通合成一律 9ms，大级别 13ms，最高级合体 18ms，游戏结束 60ms。
   *   2. `navigator.vibrate()` 是**替换**语义 —— 连续合成时后一次的短震会
   *      直接掐断前一次，所以同一级别也会时轻时重。这里做合流：
   *      短时间内只保留**最强**的那次，等这口气过去再补发。
   * 开关：HAPTIC_ENABLED 改 false 即完全关闭；它仍然跟随静音开关。 */
  const HAPTIC_ENABLED = true;
  const HAPTIC_WINDOW_MS = 45;          // 合流窗口
  const HAPTIC = {                        // 各档位的震动时长（ms）
    mergeLow: 9, mergeHigh: 13, mergeMax: 18, over: 60
  };
  /* 哪种合成算"大级别"：第 6 级（索引 5）往上 */
  const HAPTIC_BIG_TIER = 5;

  let hapticLast = 0, hapticTimer = 0, hapticPending = 0;

  function haptic(ms) {
    if (!HAPTIC_ENABLED || Sound.muted) return;
    if (!navigator.vibrate) return;
    const now = performance.now();
    if (now - hapticLast < HAPTIC_WINDOW_MS) {
      /* 窗口内：只记下最强的一次，窗口结束再补发 */
      if (ms > hapticPending) hapticPending = ms;
      if (!hapticTimer) {
        hapticTimer = setTimeout(() => {
          hapticTimer = 0;
          const v = hapticPending;
          hapticPending = 0;
          hapticLast = performance.now();
          if (v && !Sound.muted) { try { navigator.vibrate(v); } catch (e) {} }
        }, HAPTIC_WINDOW_MS);
      }
      return;
    }
    hapticLast = now;
    hapticPending = 0;
    try { navigator.vibrate(ms); } catch (e) { /* 忽略 */ }
  }

  /* 按级别取震动档位：同样的操作给同样的震感，只按"大/小"分档 */
  function hapticMerge(tier) {
    haptic(tier >= MAX_TIER ? HAPTIC.mergeMax
          : tier >= HAPTIC_BIG_TIER ? HAPTIC.mergeHigh
          : HAPTIC.mergeLow);
  }

  /* ---------------------------------------------------------
   *  画布尺寸
   * ------------------------------------------------------- */

  const view = { scale: 1, dpr: 1 };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    view.dpr = dpr;
    view.scale = (rect.width * dpr) / W;
  }

  /* ---------------------------------------------------------
   *  游戏状态
   * ------------------------------------------------------- */

  const state = {
    balls: [],
    particles: [],
    floats: [],
    score: 0,
    best: Number(localStorage.getItem(BEST_KEY) || 0),
    pending: 0,
    next: 0,
    ready: true,
    cooldown: 0,
    aimX: W / 2,
    over: false,
    flash: 0,
    revives: 0,        // 本局还剩几枚复活币（重开清零）
    reviveGiven: 0,    // 本局已经发放过几次（用来判断跨过新的 2000 分）
    freeze: 0          // 命中定格剩余秒数
  };

  /* ---------------------------------------------------------
   *  碰撞形状（按图片轮廓生成，不是圆形）
   *  assets/fruits/parts.js 由 tools/build_parts.py 从贴图的 alpha 轮廓算出：
   *  parts = [[ox, oy, s], ...] 单位是「以 r 为 1」，rb = 碰撞包围圆半径。
   *  没有数据时退化成单个半径 r 的圆，和老版本行为一致。
   * ------------------------------------------------------- */

  const SHAPES = (typeof window !== 'undefined' && window.SUIKA_PARTS) || [];
  const UNIT_SHAPE = { rb: 1, parts: [[0, 0, 1]] };

  function shapeOf(tier) {
    const s = SHAPES[tier];
    if (s && s.parts && s.parts.length) return s;
    return UNIT_SHAPE;
  }

  /* 把局部小圆换算到世界坐标（跟着刚体一起旋转平移） */
  function syncParts(b) {
    const c = Math.cos(b.angle), s = Math.sin(b.angle);
    const parts = b.parts, r = b.r;
    const wx = b.wx, wy = b.wy, ws = b.ws;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const ox = p[0] * r, oy = p[1] * r;
      wx[i] = b.x + ox * c - oy * s;
      wy[i] = b.y + ox * s + oy * c;
      ws[i] = p[2] * r;
    }
  }

  function makeBall(x, y, tier, vx, vy) {
    const r = FRUITS[tier].r;
    const m = r * r;
    const sh = shapeOf(tier);
    const n = sh.parts.length;
    const ball = {
      x, y, vx: vx || 0, vy: vy || 0,
      px: x, py: y,
      r, tier, angle: 0,
      mass: m, invMass: 1 / m,
      bornAt: performance.now(),
      overTime: 0,
      landed: false,
      dead: false,
      contacts: 0,
      pvx: 0, pvy: 0,          // 本子步求解前的速度（用于弹性冲量）
      sq: 0, sqA: 0,           // 挤压变形量 / 变形轴角度
      parts: sh.parts,
      rb: sh.rb * r,           // 包围圆半径（粗筛用）
      wx: new Float32Array(n), // 世界坐标下的子圆
      wy: new Float32Array(n),
      ws: new Float32Array(n)
    };
    syncParts(ball);
    return ball;
  }

  /* ---------------------------------------------------------
   *  物理
   * ------------------------------------------------------- */

  /* 收尾墙约束实际用了几轮（调试观测点：正常应该是 1~2 轮） */
  let maxWallIters = 0;

  function stepPhysics(dt) {
    const balls = state.balls;
    const merges = [];
    const contacts = [];      // 本子步的接触列表，用于弹性冲量

    /* --- 积分 --- */
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      b.px = b.x;
      b.py = b.y;
      b.vy += GRAVITY * dt;
      b.pvx = b.vx;           // 求解前速度：弹性冲量用它来算，避免被约束“吃掉”
      b.pvy = b.vy;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.contacts = 0;
      syncParts(b);
    }

    /* --- 约束求解 ---
       注意约束顺序：每轮迭代是「先解球球、后解墙」。
       反过来（墙在前）会有一个持续存在的漏洞：球球修正随时能把刚夹回墙内的球
       又推出去，而那之后本子步再也没有夹紧的机会，于是子步末尾就会留下出墙。
       实测旧顺序在墙边多球互挤时能留下 ~8.6px 出墙（约 10% 概率复现），
       把墙挪到最后之后，墙体成为每个子步最后生效的约束，这个漏洞就消失了。 */
    for (let it = 0; it < ITER; it++) {

      /* 球球：子圆两两求交，取“最接近/最深”的那一对做修正 */
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (a.dead) continue;
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (b.dead || a.dead) continue;

          /* 包围圆粗筛 */
          const cdx = b.x - a.x, cdy = b.y - a.y;
          const rbSum = a.rb + b.rb;
          if (cdx * cdx + cdy * cdy >= rbSum * rbSum) continue;

          const pa = a.parts.length, pb = b.parts.length;
          const brb = b.rb, arb = a.rb;
          let minGap = 1e9, bnx = 0, bny = 0;

          for (let m = 0; m < pa; m++) {
            const ax = a.wx[m], ay = a.wy[m], ar = a.ws[m];
            /* 小圆离对方中心太远就整组跳过 */
            const ddx = b.x - ax, ddy = b.y - ay;
            const far = brb + ar;
            if (ddx * ddx + ddy * ddy >= far * far) continue;

            for (let k = 0; k < pb; k++) {
              const bx = b.wx[k], by = b.wy[k], br = b.ws[k];
              const dx = bx - ax, dy = by - ay;
              const sum = ar + br;
              const d2 = dx * dx + dy * dy;
              if (d2 >= sum * sum) continue;
              const d = Math.sqrt(d2);
              const gap = d - sum;
              if (gap < minGap) {
                minGap = gap;
                if (d < 1e-4) { bnx = 1; bny = 0; }
                else { bnx = dx / d; bny = dy / d; }
              }
            }
          }

          if (minGap > MERGE_PAD || minGap === 1e9) continue;

          if (a.tier === b.tier && it === 0) {
            a.dead = true;
            b.dead = true;
            merges.push([a, b]);
            continue;
          }

          if (minGap >= 0) continue;            // 只是挨着，不用推开
          if (it === 0) contacts.push({ a: a, b: b, nx: bnx, ny: bny });
          const corr = Math.min(-minGap - 0.05, 4) * 0.9;
          if (corr <= 0) continue;
          const invSum = a.invMass + b.invMass;
          const wa = a.invMass / invSum;
          const wb = b.invMass / invSum;

          a.x -= bnx * corr * wa;  a.y -= bny * corr * wa;
          b.x += bnx * corr * wb;  b.y += bny * corr * wb;

          a.contacts++;
          b.contacts++;
          syncParts(a);
          syncParts(b);
        }
      }

      /* 墙 & 地面：每个子圆各自贴墙，推力累加到刚体中心上（一次到位）。
         放在每轮**最后**：这样它修正的是本轮球球分离之后的最终位置，
         墙体就成为该子步最后生效的约束，不会被子圆修正again顶穿。 */
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (b.dead) continue;
        let pushL = 0, pushR = 0, pushFloor = 0, pushCeil = 0;
        const n = b.parts.length;
        for (let k = 0; k < n; k++) {
          const x = b.wx[k], y = b.wy[k], rr = b.ws[k];
          const l = WALL - (x - rr);         if (l > pushL) pushL = l;
          const rgt = (x + rr) - (W - WALL); if (rgt > pushR) pushR = rgt;
          const dn = (y + rr) - (H - WALL);  if (dn > pushFloor) pushFloor = dn;
          const up = -(y - rr);              if (up > pushCeil) pushCeil = up;
        }
        if (pushL || pushR || pushFloor || pushCeil) {
          b.x += pushL - pushR;
          b.y += pushCeil - pushFloor;
          b.contacts++;
          /* 弹性冲量用的接触表：第一轮迭代时收集一次即可 */
          if (it === 0) {
            if (pushL)     contacts.push({ ball: b, nx: 1,  ny: 0 });
            if (pushR)     contacts.push({ ball: b, nx: -1, ny: 0 });
            if (pushFloor) contacts.push({ ball: b, nx: 0,  ny: -1 });
            if (pushCeil)  contacts.push({ ball: b, nx: 0,  ny: 1 });
          }
          syncParts(b);
        }
      }
    }

    /* --- 解包（de-engulf）：把"整颗卡在别人轮廓里"的球推出去 ---
       为什么单独需要这一段：球球约束只在**子圆相交**时给出法线。
       但小球整颗落进大球的碰撞轮廓内部时，小球的所有子圆都在大球内部，
       交集退化成一个"点"或空集，求解器拿不到可靠的向外方向；
       如果这时旁边还有墙推着它，它就会永远卡在里面以几百 px/s 抖动
       （实测 tier2 的小球卡在 tier10 里，d/大球半径 = 0.56，速度 266px/s 不衰减）。

       判据用「中心距 < 大球包围圆半径 × 0.9」：
       留 10% 余量是因为包围圆可能略大于实际碰撞面，
       真正常见的正常接触不会低于这个比例。 */
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.dead) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.dead) continue;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        const bigRb = Math.max(a.rb, b.rb);
        if (d >= bigRb * 0.9) continue;              // 正常接触，交给子圆约束
        if (d < 1e-4) { dx = 0; dy = -1; d = 1; }    // 完全重合：随便挑个方向
        const nx = dx / d, ny = dy / d;
        /* 把小球推到"刚好在大球包围圆外"，按逆质量分配（重的少动） */
        const need = bigRb * 0.95 - d;
        if (need <= 0) continue;
        const wa = a.invMass / (a.invMass + b.invMass);
        const wb = b.invMass / (a.invMass + b.invMass);
        const small = a.r <= b.r ? a : b;
        /* 只推小的那颗（大的通常是堆底，推它会连锁塌方） */
        const wA = (small === a) ? 1 : 0;
        const wB = (small === b) ? 1 : 0;
        a.x -= nx * need * wA;  a.y -= ny * need * wA;
        b.x += nx * need * wB;  b.y += ny * need * wB;
        a.contacts++; b.contacts++;
        syncParts(a); syncParts(b);
      }
    }

    /* --- 收尾墙约束（保险）---
       约束顺序改成「球球 -> 墙」之后，子步末尾本来就已经在墙内了。
       这一段是**兜底**：万一还有被顶出去的（例如合成分离产生的瞬时重叠），
       在这里跑到收敛为止，保证"子步结束时球一定在场内"这个不变量。
       maxWallIters 是调试观测点：正常情况第 1 轮就 break（没有任何球需要修正）。 */
    let wallIters = 0;
    for (let pass = 0; pass < 8; pass++) {
      let moved = 0;
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (b.dead) continue;
        let pushL = 0, pushR = 0, pushFloor = 0, pushCeil = 0;
        for (let k = 0; k < b.parts.length; k++) {
          const x = b.wx[k], y = b.wy[k], rr = b.ws[k];
          const l = WALL - (x - rr);         if (l > pushL) pushL = l;
          const rgt = (x + rr) - (W - WALL); if (rgt > pushR) pushR = rgt;
          const dn = (y + rr) - (H - WALL);  if (dn > pushFloor) pushFloor = dn;
          const up = -(y - rr);              if (up > pushCeil) pushCeil = up;
        }
        if (pushL || pushR || pushFloor || pushCeil) {
          b.x += pushL - pushR;
          b.y += pushCeil - pushFloor;
          b.contacts++;
          syncParts(b);
          moved++;
        }
      }
      wallIters++;
      if (!moved) break;              // 收敛了
    }
    if (wallIters > maxWallIters) maxWallIters = wallIters;

    /* --- 由位置差反推速度（PBD）+ 摩擦 + 滚动 --- */
    const invDt = 1 / dt;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.dead) continue;

      const dx = b.x - b.px;
      const dy = b.y - b.py;

      let vx = dx * invDt;
      let vy = dy * invDt;

      if (b.contacts > 0) vx *= FRICTION;   // 接触时的切向摩擦
      if (b.sq > 0) b.sq = Math.max(0, b.sq - b.sq * SQUASH_DECAY * dt);

      b.vx = vx;
      b.vy = vy;
      b.angle += dx / b.r * 0.85;           // 视觉滚动

      if (!b.landed) {
        if (b.contacts > 0 || performance.now() - b.bornAt > 900) b.landed = true;
      }
    }

    /* --- 弹性冲量 ---
       位置约束已经把法向速度吃掉了一部分，这里直接把法向相对速度“改写”成
       e × 碰撞前速度，这样回弹量只由 e 决定，不受子步/迭代次数影响。
       撞击速度低于阈值时完全不弹，保证堆叠静止时不抖。 */
    for (let k = 0; k < contacts.length; k++) {
      const ct = contacts[k];

      if (ct.ball) {
        /* 撞墙 / 撞地面 */
        const b = ct.ball;
        if (b.dead) continue;
        const vnPre = b.pvx * ct.nx + b.pvy * ct.ny;      // <0 表示还在往墙里钻
        if (vnPre < -REST_THRESHOLD) {
          const vnPost = b.vx * ct.nx + b.vy * ct.ny;
          const target = -WALL_RESTITUTION * vnPre;       // 期望的分离速度
          const j = target - vnPost;
          if (j > 0) {
            b.vx += j * ct.nx;
            b.vy += j * ct.ny;
            squash(b, ct.nx, ct.ny, -vnPre);
          }
        }
      } else {
        /* 球与球 */
        const a = ct.a, b = ct.b;
        if (a.dead || b.dead) continue;
        const nx = ct.nx, ny = ct.ny;                     // a → b
        const vnPre = (a.pvx - b.pvx) * nx + (a.pvy - b.pvy) * ny;   // >0 表示相互靠近
        if (vnPre > REST_THRESHOLD) {
          const vnPost = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          const target = -RESTITUTION * vnPre;
          const j = (vnPost - target) / (a.invMass + b.invMass);
          if (j > 0) {
            a.vx -= j * a.invMass * nx;  a.vy -= j * a.invMass * ny;
            b.vx += j * b.invMass * nx;  b.vy += j * b.invMass * ny;
            squash(a, -nx, -ny, vnPre);
            squash(b, nx, ny, vnPre);
          }
        }
      }
    }

    /* --- 处理合成 --- */
    if (merges.length) processMerges(merges);
  }

  /* 撞击挤压：沿撞击法线压扁、垂直方向拉伸，做出果冻感 */
  function squash(b, nx, ny, speed) {
    const k = Math.min(SQUASH_MAX, speed / 1500);
    if (k <= b.sq) return;
    b.sq = k;
    b.sqA = Math.atan2(ny, nx);
  }

  function processMerges(merges) {
    for (let k = 0; k < merges.length; k++) {
      const a = merges[k][0];
      const b = merges[k][1];
      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const tier = a.tier;

      if (tier >= MAX_TIER) {
        /* 两个最高级 → 一起炸掉，拿一大笔奖励分（外加一枚复活币）。
           注意：它同时清掉了两块最大的，是后期唯一的泄压阀，不能取消。
           分数的飘字不用 addScore 那个普通的，下面单独给了「大字 +500」。 */
        addScore(MAX_BONUS);
        burst(mx, my, MAX_TIER, 90, 560);
        burst(mx, my, MAX_TIER - 2, 42, 340);
        Sound.bonus();
        haptic(HAPTIC.over);
        state.flash = 1.4;                    // 比普通合成更亮的全屏闪
        state.freeze = FREEZE_MS / 1000;      // 定格一下，让这一下有重量
        state.floats.push({ x: mx, y: my - 74, text: '两个最高级 💥', life: 1.6 });
        state.floats.push({ x: mx, y: my - 16, text: '+' + MAX_BONUS, life: 2.2, big: true });
        if (MAX_MERGE_GIVES_REVIVE) {
          state.revives++;
          paintRevives(true);
        }
      } else {
        const nt = tier + 1;
        const nb = makeBall(mx, my, nt, (a.vx + b.vx) * 0.5, (a.vy + b.vy) * 0.5 - 60);
        /* 贴着墙合成时，新水果更大，先夹回场地内，避免瞬间穿墙 */
        nb.x = clamp(nb.x, WALL + nb.r, W - WALL - nb.r);
        nb.y = Math.min(nb.y, H - WALL - nb.r);
        nb.px = nb.x;
        nb.py = nb.y;
        nb.landed = true;
        nb.popAt = performance.now();
        state.balls.push(nb);

        addScore(MERGE_SCORE[nt], mx, my, '+' + MERGE_SCORE[nt]);
        burst(mx, my, nt, 8 + nt * 2, 140 + nt * 22);
        Sound.merge(nt);
        hapticMerge(nt);
        if (nt === MAX_TIER) state.flash = 1;
      }
    }

    /* 移除被合成的球 */
    const alive = [];
    for (let i = 0; i < state.balls.length; i++) {
      if (!state.balls[i].dead) alive.push(state.balls[i]);
    }
    state.balls = alive;
  }

  /* ---------------------------------------------------------
   *  特效 & 计分
   * ------------------------------------------------------- */

  function burst(x, y, tier, n, speed) {
    const f = FRUITS[Math.min(tier, MAX_TIER)];
    const c1 = f.pc1 || f.c1;
    const c2 = f.pc2 || f.c2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(speed * 0.25, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 70,
        r: rand(2, 5.5),
        life: 1,
        decay: rand(1.3, 2.4),
        color: Math.random() < 0.5 ? c1 : c2
      });
    }
    if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
  }

  /* 复活币胶囊：有币才显示，跨过 2000 分时弹一下。
     注意 0 枚时也要把文字刷成 ×0 —— 否则下次显示出来的是上一次的旧数字。 */
  function paintRevives(pop) {
    if (!reviveBadge) return;
    if (reviveCountEl) reviveCountEl.textContent = '×' + state.revives;
    if (state.revives > 0) {
      reviveBadge.hidden = false;
      if (pop) {
        reviveBadge.classList.remove('pop');
        void reviveBadge.offsetWidth;
        reviveBadge.classList.add('pop');
      }
    } else {
      reviveBadge.hidden = true;
      reviveBadge.classList.remove('pop');
    }
  }

  /* 每累计 REVIVE_STEP 分，发一枚复活币 */
  function grantRevives() {
    let got = 0;
    while (state.reviveGiven < Math.floor(state.score / REVIVE_STEP)) {
      state.reviveGiven++;
      state.revives++;
      got++;
    }
    if (!got) return;
    paintRevives(true);
    state.floats.push({ x: W / 2, y: 210, text: '+1 复活币', life: 1.4, big: true });
    Sound.merge(6);
  }

  function addScore(n, x, y, text) {
    state.score += n;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(BEST_KEY, String(state.best));
      bestEl.textContent = state.best;
    }
    scoreEl.textContent = state.score;
    bump(scoreEl);
    if (x !== undefined) {
      state.floats.push({ x, y, text: text || ('+' + n), life: 1 });
    }
    grantRevives();
  }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /* 屏幕提示条：给「音效开关」「掉落模式」这类**点了之后界面没明显变化**的操作一个反馈。
     不然在手机上点一下什么都不知道 —— 尤其掉落模式，只换了按钮上一个小图标。
     画在棋盘上方的药丸样式，同一时刻只留一条（新的顶掉旧的），免得刷屏。 */
  let toastSeq = 0;
  function toast(text) {
    for (let i = state.floats.length - 1; i >= 0; i--) {
      if (state.floats[i].toast) state.floats.splice(i, 1);
    }
    state.toastSeq = ++toastSeq;
    state.floats.push({
      x: W / 2, y: 250, text: text, life: 1.5, toast: true
    });
  }

  /* ---------------------------------------------------------
   *  投放 & 控制
   * ------------------------------------------------------- */

  function aimLimit(tier) {
    const r = FRUITS[tier].r * shapeOf(tier).rb;   // 用碰撞外形而不是圆形
    return [WALL + r + 0.5, W - WALL - r - 0.5];
  }

  function moveAim(x) {
    const [lo, hi] = aimLimit(state.pending);
    state.aimX = clamp(x, lo, hi);
  }

  function tryDrop() {
    if (state.over || !state.ready) return;
    const tier = state.pending;
    const [lo, hi] = aimLimit(tier);
    const x = clamp(state.aimX, lo, hi);

    const ball = makeBall(x, DROP_Y, tier, 0, 130);
    state.balls.push(ball);

    state.ready = false;
    state.cooldown = DROP_MS / 1000;
    state.pending = state.next;
    state.next = pickSpawnTier(state.pending);   // 和当前这颗不一样
    Sound.drop();
    drawNext();
    if (state.balls.length > 90) state.balls = state.balls.filter(b => !b.dead);
  }

  /* ---------------------------------------------------------
   *  判负
   * ------------------------------------------------------- */

  /* 判负用的「最高点」：取碰撞外形的真实上边缘，而不是 b.y - b.r。
     碰撞箱是按贴图轮廓生成的，可能是圆盘也可能是多圆轮廓，两者上边缘都
     不等于 r（实测包围圆半径在 0.99~1.13 r 之间）。用圆去判会和玩家看到的
     边缘差几个像素 —— 大徽章尤其明显，视觉上明明压线了却不判负（或反过来）。
     子圆坐标是世界坐标，直接取 y - 半径 的最小值即可。 */
  function topEdge(b) {
    let top = Infinity;
    for (let k = 0; k < b.parts.length; k++) {
      const t = b.wy[k] - b.ws[k];
      if (t < top) top = t;
    }
    return top === Infinity ? b.y - b.r : top;
  }

  function checkGameOver(dt) {
    let danger = false;
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (b.dead || !b.landed) continue;
      const top = topEdge(b);

      if (top < DANGER_Y) {
        danger = true;                     // 只要线上方有东西，虚线就闪红
        /* 只有「卡在线上方且基本停住」才计时：
           被弹起来、正在飞过线的不算，免得误判 */
        if (b.vx * b.vx + b.vy * b.vy < REST_SPEED2) {
          b.overTime += dt;
          if (b.overTime > OVER_LIMIT) { gameOver(); return; }
        } else {
          b.overTime = Math.max(0, b.overTime - dt * 2);
        }
      } else {
        /* 回到线下方 → 按 2 倍速倒扣，所以长时间待在线上方才会攒起来 */
        b.overTime = Math.max(0, b.overTime - dt * 2);
        if (b.overTime > 0) danger = true;
      }
    }
    state.danger = danger;
  }

  /* 正式结算：弹结算窗 + 把成绩交给排行榜（排行榜关闭时不提交任何东西） */
  function settle() {
    if (revivePromptEl) revivePromptEl.hidden = true;
    if (overPanelEl) overPanelEl.hidden = false;
    if (overlayEl) overlayEl.classList.add('show');
    /* 交给排行榜模块（关闭或没加载都不影响） */
    if (LEADERBOARD_ENABLED && window.DanaiwaBoard && window.DanaiwaBoard.onGameOver) {
      window.DanaiwaBoard.onGameOver(state.score);
    }
  }

  /* 越线那一屏：有复活币就先问一句 */
  function askRevive() {
    if (reviveScoreEl) reviveScoreEl.textContent = state.score;
    if (reviveLeftEl) reviveLeftEl.textContent = '还剩 ' + state.revives + ' 枚';
    if (revivePromptEl) revivePromptEl.hidden = false;
    if (overPanelEl) overPanelEl.hidden = true;
    if (overlayEl) overlayEl.classList.add('show');
  }

  function gameOver() {
    state.over = true;
    finalScoreEl.textContent = state.score;
    finalBestEl.textContent = state.best;
    Sound.over();
    if (state.revives > 0) { askRevive(); return; }
    settle();
  }

  /* 复活：消除最顶上那颗，再把仍压在警戒线以上的清掉（只清一颗的话会立刻再输），
     然后接着玩。返回 false 表示当前不能复活。 */
  function revive() {
    if (!state.over || state.revives <= 0) return false;

    /* 1) 找最顶上的：按碰撞外形的真实上边缘比，最小的最靠上 */
    let top = -1;
    let topMost = Infinity;
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (b.dead) continue;
      const edge = topEdge(b);
      if (edge < topMost) { topMost = edge; top = i; }
    }
    if (top >= 0) state.balls.splice(top, 1);

    /* 2) 还压在警戒线以上的，一并清掉（同样用真实边缘） */
    state.balls = state.balls.filter((b) => !b.dead && topEdge(b) >= DANGER_Y + 6);

    /* 越线计时清零，给玩家一个反应窗口 */
    for (let i = 0; i < state.balls.length; i++) state.balls[i].overTime = 0;

    state.revives--;
    state.over = false;
    state.danger = false;
    state.ready = true;
    state.cooldown = 0;
    state.flash = 0.6;               // 闪一下，让玩家知道救回来了
    if (revivePromptEl) revivePromptEl.hidden = true;
    if (overlayEl) overlayEl.classList.remove('show');
    paintRevives(false);
    Sound.ensure();
    return true;
  }

  function reset() {
    state.balls.length = 0;
    state.particles.length = 0;
    state.floats.length = 0;
    state.score = 0;
    state.over = false;
    state.ready = true;
    state.cooldown = 0;
    state.flash = 0;
    state.danger = false;
    state.aimX = W / 2;
    state.revives = 0;        // 复活币只在本局有效，重开清零
    state.reviveGiven = 0;
    state.freeze = 0;
    state.pending = pickSpawnTier();
    state.next = pickSpawnTier(state.pending);
    if (overlayEl) overlayEl.classList.remove('show');
    if (revivePromptEl) revivePromptEl.hidden = true;
    if (overPanelEl) overPanelEl.hidden = false;
    paintRevives(false);
    scoreEl.textContent = '0';
    bestEl.textContent = state.best;
    drawNext();
    Sound.ensure();
  }

  /* ---------------------------------------------------------
   *  绘制
   * ------------------------------------------------------- */

  function drawFruit(c, x, y, r, tier, angle, scale, squashShape) {
    const f = FRUITS[tier];
    const s = scale === undefined ? 1 : scale;

    c.save();
    c.translate(x, y);
    /* 撞击挤压：沿法线压扁、垂直拉伸（世界坐标，先于水果自身旋转） */
    if (squashShape && squashShape.k > 0.004) {
      c.rotate(squashShape.a);
      c.scale(1 - squashShape.k, 1 + squashShape.k * 0.85);
      c.rotate(-squashShape.a);
    }
    if (s !== 1) c.scale(s, s);
    c.rotate(angle || 0);

    /* —— 贴图模式：主体直接画 PNG，画布边长按 ASSET_FILL 换算，保证视觉大小 = 物理直径 —— */
    if (f.img) {
      const box = (r * 2) / ASSET_FILL;
      c.drawImage(f.img, -box / 2, -box / 2, box, box);
      c.restore();
      return;
    }

    /* —— 兜底一：贴图还没到位时，先画一张极模糊的同形状缩略图 ——
       观感是「图正在慢慢变清晰」，而不是「图挂了」看到一堆卡通脸。
       这张缩略图是内联的 data URL（assets/fruits/blur.js，约 8KB），不走网络。 */
    if (blurImg && blurCfg && blurCfg.cols > 0) {
      const idx = tier < blurCfg.cols ? tier : blurCfg.cols - 1;
      const box = (r * 2) / ASSET_FILL;
      const cell = blurCfg.cell;
      c.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in c) c.imageSmoothingQuality = 'high';
      c.drawImage(blurImg, idx * cell, 0, cell, cell, -box / 2, -box / 2, box, box);
      c.restore();
      return;
    }

    /* —— 兜底二：连缩略图都没有（blur.js 被拦了）才画程序化的占位徽章 ——
       原来这里画的是「一圈卡通笑脸」（水果的拟人化），换了校徽之后那个表情
       既不合适也没意义了，所以改成一个中性的圆形占位：外环 + 内环 + 底色，
       形状和徽章接近，玩家至少能读大小和颜色，不会看到一堆怪脸。 */
    const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, f.c1);
    g.addColorStop(1, f.c2);
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();

    /* 外环（贴着轮廓，和校徽一圈的观感一致） */
    c.lineWidth = Math.max(1.4, r * 0.055);
    c.strokeStyle = f.line;
    c.beginPath();
    c.arc(0, 0, r - c.lineWidth * 0.5, 0, Math.PI * 2);
    c.stroke();

    /* 内环：小尺寸下别画，否则糊成一团 */
    if (r >= 24) {
      c.lineWidth = Math.max(1, r * 0.032);
      c.strokeStyle = 'rgba(255,255,255,.52)';
      c.beginPath();
      c.arc(0, 0, r * 0.70, 0, Math.PI * 2);
      c.stroke();
    }

    /* 高光 */
    c.beginPath();
    c.ellipse(-r * 0.34, -r * 0.40, r * 0.28, r * 0.17, -0.7, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.fill();

    c.restore();
  }

  function drawBoard() {
    /* 背景：冷色调（天蓝 → 淡蓝），与页面的蓝色主题一致 */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f6faff');
    bg.addColorStop(0.55, '#e9f3fd');
    bg.addColorStop(1, '#d9e9f9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* 顶部投放区高光 */
    const top = ctx.createLinearGradient(0, 0, 0, 190);
    top.addColorStop(0, 'rgba(255,255,255,.85)');
    top.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 190);

    /* 内壁阴影 */
    ctx.save();
    ctx.strokeStyle = 'rgba(120,162,205,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WALL, 0);
    ctx.lineTo(WALL, H - WALL);
    ctx.lineTo(W - WALL, H - WALL);
    ctx.lineTo(W - WALL, 0);
    ctx.stroke();
    ctx.restore();

    /* 警戒线 */
    const danger = state.danger;
    ctx.save();
    ctx.setLineDash([9, 9]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = danger
      ? 'rgba(255,72,72,' + (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 140))) + ')'
      : 'rgba(150,180,205,.55)';
    ctx.beginPath();
    ctx.moveTo(WALL, DANGER_Y);
    ctx.lineTo(W - WALL, DANGER_Y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBalls() {
    const now = performance.now();
    const balls = state.balls;
    const sorted = balls.slice().sort((a, b) => a.r - b.r);

    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (b.dead) continue;

      /* 地面投影：只在**快贴到地面**的时候画，而且越高压得越淡。
         原来是无条件给每颗都画，于是悬在半空的徽章下面也挂着一个地面阴影，
         看起来像浮空 bug。这里按「底边离地高度 / 自身直径」做衰减。 */
      const floorY = H - WALL;
      const gap = floorY - (b.y + b.r * 0.86);      // 底边离地还有多少
      const near = 1 - clamp(gap / (b.r * 1.8), 0, 1);
      if (near > 0.02) {
        ctx.save();
        ctx.globalAlpha = 0.15 * near * near;
        ctx.fillStyle = '#2f5d85';
        ctx.beginPath();
        ctx.ellipse(b.x, floorY - 1, b.r * 0.86, Math.max(3, b.r * 0.17), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      let scale = 1;
      if (b.popAt) {
        const t = (now - b.popAt) / 220;
        if (t < 1) scale = 1 + 0.28 * (1 - t);
        else b.popAt = 0;
      }
      const shape = b.sq > 0.004 ? { a: b.sqA, k: b.sq } : null;
      drawFruit(ctx, b.x, b.y, b.r, b.tier, b.angle, scale, shape);
    }
  }

  function drawAim() {
    if (state.over) return;
    const tier = state.pending;
    const r = FRUITS[tier].r;
    const [lo, hi] = aimLimit(tier);
    const x = clamp(state.aimX, lo, hi);
    const bob = Math.sin(performance.now() / 320) * 2.5;
    const ready = state.ready;

    /* 只有能投的时候才画落点辅助线 */
    if (ready) {
      ctx.save();
      ctx.setLineDash([5, 8]);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(110,160,205,.5)';
      ctx.beginPath();
      ctx.moveTo(x, DROP_Y + r + 4);
      ctx.lineTo(x, H - WALL);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = FRUITS[tier].c1;
      ctx.beginPath();
      ctx.arc(x, DROP_Y + bob, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* 冷却中也要画：淡一点表示“下一颗就是它、但还不能投”。
       不然这段时间棋盘上只剩右上角的“下一个”，很容易被当成当前这颗 */
    ctx.save();
    if (!ready) ctx.globalAlpha = 0.4;
    drawFruit(ctx, x, DROP_Y + bob, r, tier, 0, 1);
    ctx.restore();
  }

  function drawEffects(dt) {
    /* 粒子 */
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.vy += 1400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.99;
      p.life -= p.decay * dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* 飘分 */
    ctx.textAlign = 'center';
    for (let i = state.floats.length - 1; i >= 0; i--) {
      const f = state.floats[i];
      const big = !!f.big;
      /* 提示条飘得慢一点、活得久一点，够看清 */
      f.y -= (big ? 24 : (f.toast ? 14 : 46)) * dt;
      f.life -= dt * (big ? 0.55 : (f.toast ? 0.75 : 1.05));
      if (f.life <= 0) { state.floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life * 1.4);

      /* 提示条（音效/掉落模式这些开关）：画成一颗药丸，不然白字叠在棋盘上看不清 */
      if (f.toast) {
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.font = '700 16px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
        const wTxt = ctx.measureText(f.text).width;
        const pw = wTxt + 34, ph = 38;
        const px = clamp(f.x - pw / 2, WALL + 6, W - WALL - 6 - pw);
        ctx.save();
        ctx.shadowColor = 'rgba(20,45,75,.28)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = 'rgba(22,48,77,.92)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(px, f.y - ph / 2, pw, ph, ph / 2);
          ctx.fill();
        } else {
          ctx.fillRect(px, f.y - ph / 2, pw, ph);
        }
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, px + pw / 2, f.y + 6);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
        continue;
      }

      ctx.font = big
        ? '900 40px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
        : '700 20px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
      ctx.lineWidth = big ? 9 : 4;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.strokeText(f.text, f.x, f.y);
      /* 普通飘分改成蓝色（原来是珊瑚红），大字的 +500 保留红色 —— 那是"最高级炸掉"
         的语义强调，跟警戒线一样属于语义色，不跟着主题走 */
      ctx.fillStyle = big ? '#e8342f' : '#2a72b8';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    /* 顶棚下一颗预览 */
    drawTopPreview();
  }

  function drawTopPreview() {
    /* 棋盘右上角永远显示「下一个」——当前那颗在准星位置上画着，别搞混 */
    const tier = state.next;
    const r = 15;
    const x = W - WALL - 30;
    const y = 32;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = '600 11px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(90,125,160,.9)';
    ctx.fillText('下一个', x - r - 10, y);
    ctx.restore();

    drawFruit(ctx, x, y, r, tier, 0, 1);
  }

  /* 面板中的“下一个” */
  function drawNext() {
    const w = nextCanvas.width;
    const h = nextCanvas.height;
    nextCtx.setTransform(1, 0, 0, 1, 0, 0);
    nextCtx.clearRect(0, 0, w, h);
    const tier = state.next;
    const r = FRUITS[tier].r;
    const k = (Math.min(w, h) * 0.42) / r;
    drawFruit(nextCtx, w / 2, h / 2, r * k, tier, 0, 1);
  }

  /* 面板中的“合成表” */
  function drawChain() {
    const cw = chainCanvas.width;
    const ch = chainCanvas.height;
    chainCtx.setTransform(1, 0, 0, 1, 0, 0);
    chainCtx.clearRect(0, 0, cw, ch);

    const slot = cw / FRUITS.length;
    const r = slot * 0.36;
    const cy = ch * 0.5;

    for (let i = 0; i < FRUITS.length; i++) {
      const x = slot * (i + 0.5);
      drawFruit(chainCtx, x, cy, r, i, 0, 1);
      if (i < FRUITS.length - 1) {
        chainCtx.save();
        chainCtx.globalAlpha = 0.45;
        chainCtx.fillStyle = '#7c9cbb';
        chainCtx.font = '600 ' + Math.round(ch * 0.2) + 'px system-ui, sans-serif';
        chainCtx.textAlign = 'center';
        chainCtx.textBaseline = 'middle';
        chainCtx.fillText('›', x + slot * 0.5, cy);
        chainCtx.restore();
      }
    }
  }

  /* ---------------------------------------------------------
   *  主循环
   * ------------------------------------------------------- */

  let last = performance.now();
  let acc = 0;
  const FIXED = 1 / 60;

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;      // 切后台回来不要瞬移
    acc += dt;

    let guard = 0;
    while (acc >= FIXED && guard < 5) {
      update(FIXED);
      acc -= FIXED;
      guard++;
    }
    /* 追不上时**不要把 acc 清零**。
       原来的 `if (guard >= 5) acc = 0;` 会直接丢掉攒下的时间，
       而手机上掉到 30fps 时几乎每帧都会撞到这个上限 ——
       于是每帧都丢一点时间，画面表现为周期性的顿挫/抖动。
       改成封顶：最多保留 1 帧的量，多出来的才丢，
       这样慢机器上是"整体节奏略慢"而不是"一顿一顿"。 */
    if (acc > FIXED) acc = FIXED;

    render(dt);
    requestAnimationFrame(frame);
  }

  function update(dt) {
    /* 清场命中定格：世界停一下，但画面照常重绘 */
    if (state.freeze > 0) { state.freeze = Math.max(0, state.freeze - dt); return; }

    if (state.over) return;          // 结束后冻结棋盘（粒子特效仍在 render 里继续）

    if (!state.ready) {
      state.cooldown -= dt;
      if (state.cooldown <= 0) state.ready = true;
    }

    /* 物理：子步细分，保证小水果不被穿透 */
    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) stepPhysics(sub);

    checkGameOver(dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.2);
  }

  function render(dt) {
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawBoard();
    drawBalls();
    drawAim();
    /* 定格期间把特效的 dt 也压成 0，让它跟世界一起停住 */
    drawEffects(state.freeze > 0 ? 0 : dt);

    if (state.flash > 0) {
      ctx.save();
      ctx.globalAlpha = state.flash * 0.35;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
   *  输入
   * ------------------------------------------------------- */

  function pointerToX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }

  /* 触屏是「拖动瞄准、松手投放」——手指不会挡住落点，也方便微调；
     鼠标保持「移动瞄准、按下即投」的桌面手感。 */
  let touchAiming = false;

  stage.addEventListener('pointermove', (e) => {
    if (state.over) return;
    if (e.pointerType === 'touch' && !touchAiming) return;
    moveAim(pointerToX(e.clientX));
  });

  stage.addEventListener('pointerdown', (e) => {
    if (state.over) return;
    Sound.ensure();
    moveAim(pointerToX(e.clientX));
    if (e.pointerType === 'touch') {
      touchAiming = true;
      /* 手指滑出棋盘也能收到 pointerup */
      if (stage.setPointerCapture) {
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
    } else {
      tryDrop();
    }
  });

  stage.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    if (!touchAiming) return;
    touchAiming = false;
    if (state.over) return;
    moveAim(pointerToX(e.clientX));
    tryDrop();
  });

  stage.addEventListener('pointercancel', () => { touchAiming = false; });

  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  /* 在输入框里打字时不要抢按键 */
  function isTyping(e) {
    const t = e.target;
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || t.isContentEditable === true;
  }

  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      /* 走 moveAim 而不是直接改 state.aimX：moveAim 会按当前级别的
         aimLimit 夹紧，保证「aimX 恒在合法区间内」这个不变量不被破坏
         （大徽章时 WALL..W 的范围比合法范围更宽，直接夹会越界） */
      moveAim(state.aimX - 14);
      e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      moveAim(state.aimX + 14);
      e.preventDefault();
    } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
      /* 空格/回车只在局内投放；结束后不再用它们重开（免得手快连着开新局） */
      if (!state.over) { tryDrop(); e.preventDefault(); }
    } else if (e.code === 'KeyR') {
      reset();
      e.preventDefault();
    }
  });

  /* 音效按钮里是 <span class="ico"> + <span class="lbl">，只改这两块文字 */
  function paintSoundBtn() {
    const ico = soundBtn.querySelector('.ico');
    const lbl = soundBtn.querySelector('.lbl');
    if (ico) ico.textContent = Sound.muted ? '🔇' : '🔊';
    if (lbl) lbl.textContent = Sound.muted ? '音效关' : '音效开';
    soundBtn.setAttribute('aria-pressed', String(!Sound.muted));
  }

  soundBtn.addEventListener('click', () => {
    Sound.muted = !Sound.muted;
    localStorage.setItem(MUTE_KEY, Sound.muted ? '1' : '0');
    paintSoundBtn();
    /* 点了之后必须让玩家知道结果：按钮上的图标变化太小了 */
    toast(Sound.muted ? '🔇 音效已关闭' : '🔊 音效已开启');
    if (!Sound.muted) Sound.merge(1);
  });

  resetBtn.addEventListener('click', reset);

  /* ---------------------------------------------------------
   *  掉落模式界面
   * ------------------------------------------------------- */

  /* 单一入口：给按钮用、也给 __DNW__.setDropMode 用，保证两边行为一致 */
  function applyDropMode(mode, fixedTier) {
    if (DROP_MODES.indexOf(mode) < 0) return false;
    dropModeRef.value = mode;
    if (fixedTier !== undefined) dropModeRef.fixedTier = clamp(fixedTier | 0, 0, MAX_TIER);
    cycleCursor = 0;
    saveDropMode();
    paintModeBtn();
    /* 立刻按新模式刷新「当前这颗」和「下一个」，不用等下一局 */
    state.pending = pickSpawnTier();
    state.next = pickSpawnTier(DROP_MODE_ALLOWS_REPEAT() ? undefined : state.pending);
    state.ready = true;
    state.cooldown = 0;
    drawNext();
    return true;
  }

  function paintModeBtn() {
    if (!modeBtn) return;
    const lbl = modeBtn.querySelector('.lbl');
    const ico = modeBtn.querySelector('.ico');
    const m = dropModeRef.value;
    let text = DROP_MODE_LABEL[m] || m;
    if (m === 'fixed') text = '第 ' + (dropModeRef.fixedTier + 1) + ' 级';
    if (lbl) lbl.textContent = '掉落：' + text;
    if (ico) ico.textContent = modeIcon(m);
    modeBtn.title = '掉落模式：' + text + '\n点一下换下一个模式（' + DROP_MODES.map(k => DROP_MODE_LABEL[k]).join(' → ') + '）';
  }

  function modeIcon(m) {
    return m === 'random' ? '🎲'
         : m === 'max' ? '👑'
         : m === 'cycle' ? '🔁'
         : m === 'noRepeat' ? '🚫'
         : '🎯';
  }

  /* 给提示条用的说明文案（要说清"现在是怎么样"，不只报个名字） */
  function modeToastText(m) {
    switch (m) {
      case 'max':      return '👑 掉落：一直掉最高级（第 11 级）';
      case 'fixed':    return '🎯 掉落：一直掉第 ' + (dropModeRef.fixedTier + 1) + ' 级';
      case 'cycle':    return '🔁 掉落：从第 1 级起逐个轮换';
      case 'noRepeat': return '🚫 掉落：随机，但不连着掉同一个';
      default:         return '🎲 掉落：随机';
    }
  }

  /* 点一下就往后轮换；轮换到「指定」时默认指向最高级，方便「一直掉最大的」。
     想换指定级别：控制台 __DNW__.setFixedTier(4)，或者改 dropModeRef.fixedTier。 */
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      const i = DROP_MODES.indexOf(dropModeRef.value);
      const next = DROP_MODES[(i + 1) % DROP_MODES.length];
      /* 从「指定」之外切进来时，先给一个保守的默认级别（最高级），
         这样「一直掉最大的」只需要点两下 */
      if (next === 'fixed' && dropModeRef.value !== 'fixed') dropModeRef.fixedTier = MAX_TIER;
      applyDropMode(next);
      /* 手机上按钮只显示一个图标，不提示的话根本不知道切成了什么 */
      toast(modeToastText(next));
      if (next === 'max') Sound.merge(6);
    });
  }
  restartBtn.addEventListener('click', reset);

  /* ---------------------------------------------------------
   *  素材加载
   * ------------------------------------------------------- */

  /* 贴图加载。三点很重要：
       1) 弱网下「一次没拉到」很常见，**不重试**的话玩家会一直看到兜底的程序化占位徽章
          观感就是"图挂了"，所以失败要退避重试；
       2) 必须等 decode() 完成再拿去 drawImage，否则浏览器会画出还没解码完的半成品；
       3) 全部失败也不影响玩，只是回退成程序化占位徽章。 */
  const SPRITE_RETRY = 3;      // 每个素材最多试几次

  let blurImg = null;          // 极模糊占位图（内联 data URL，秒到）
  const blurCfg = window.FRUIT_BLUR || null;

  function loadBlur() {
    if (!blurCfg || !blurCfg.src) return;
    const im = new Image();
    im.onload = () => { blurImg = im; };
    im.src = blurCfg.src;
  }

  function loadSprites() {
    let left = 0;

    function fetchOne(f, attempt) {
      const img = new Image();
      img.onload = () => {
        const ready = () => {
          f.img = img;
          if (--left === 0) refreshPreviews();
        };
        if (img.decode) img.decode().then(ready, ready);
        else ready();
      };
      img.onerror = () => {
        if (attempt < SPRITE_RETRY) {
          /* 退避 + 抖动，避免一批图同时重试又同时失败 */
          const wait = 600 * Math.pow(2.4, attempt - 1) + Math.random() * 300;
          setTimeout(() => fetchOne(f, attempt + 1), wait);
          return;
        }
        left--;
        if (window.console) console.warn('[xhp] 素材载入失败，已回退为程序化占位徽章：' + f.file);
        if (left === 0) refreshPreviews();
      };
      /* 重试时换一个带参地址，绕开浏览器对上次失败结果的缓存 */
      img.src = attempt > 1 ? (f.file + '?retry=' + attempt) : f.file;
    }

    for (let i = 0; i < FRUITS.length; i++) {
      const f = FRUITS[i];
      if (!f.file) continue;
      left++;
      fetchOne(f, 1);
    }
    return left;
  }

  function refreshPreviews() {
    drawNext();
    drawChain();
  }

  /* ---------------------------------------------------------
   *  启动
   * ------------------------------------------------------- */

  function boot() {
    resizeCanvas();
    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(stage);
    }
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));

    paintSoundBtn();

    /* 页脚里的仓库链接 */
    applyRepoLinks();

    /* 掉落模式：从存档恢复，再刷一次按钮文案。
       放在 reset() 之前 —— reset 里会重新 pickSpawnTier，得先知道模式。 */
    loadDropMode();
    paintModeBtn();

    /* 越线那一屏的两个按钮 */
    if (reviveBtn) reviveBtn.addEventListener('click', revive);
    if (giveUpBtn) giveUpBtn.addEventListener('click', settle);

    drawChain();
    reset();
    loadBlur();             // 占位图是内联的，几乎立刻可用
    loadSprites();          // 贴图异步到位，到了会自动重画预览
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* 调试句柄（控制台可用）：__DNW__.state / .reset() / .drop() / .FRUITS / .render()
     掉落模式控制台可改，例如 __DNW__.setDropMode('max') 一直掉最大的 */
  window.__DNW__ = { state, reset, revive, settle, gameOver, tryDrop, stepPhysics, update, FRUITS,
                     render, resizeCanvas, shapeOf, makeBall, paintRevives, addScore,
                     syncParts, topEdge,
                     MAX_BONUS, REVIVE_STEP, MAX_TIER,
                     /* 收尾墙约束观察到的最多轮数（物理调试用） */
                     getMaxWallIters: () => maxWallIters,
                     resetMaxWallIters: () => { maxWallIters = 0; },
                     getDropMode: () => dropModeRef.value,
                     getFixedTier: () => dropModeRef.fixedTier,
                     setDropMode: (m) => applyDropMode(m),
                     setFixedTier: (t) => applyDropMode('fixed', t),
                     /* 掉落的纯函数接口：方便控制台试、也是掉落模式自检的观测点 */
                     rollSpawnTier, pickSpawnTier,
                     blurReady: () => !!blurImg };
})();
